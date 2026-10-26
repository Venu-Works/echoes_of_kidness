// Job queue stored in MongoDB, used when QUEUE_BACKEND=mongo.
//
// Guarantees mirror what the app relies on from BullMQ:
// - adding a job_id that already exists is a no-op (unique index)
// - a job is claimed by exactly one worker (atomic findOneAndUpdate)
// - failed attempts are retried with exponential backoff
// - if a worker dies mid-job, its lock expires and another worker reclaims it
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { connectDB } from "@/lib/mongodb";
import { QueueJob } from "@/models/QueueJob";
import { QUEUE_SETTINGS, QueueName } from "./config";
import { afterFailure, JobHandler, PermanentJobError, retryDelayMs } from "./job";

// A job running longer than this is assumed abandoned and may be reclaimed.
// Moderation and illustration jobs take well under a minute.
const LOCK_MS = 10 * 60 * 1000;
const KEEP_COMPLETED_MS = 7 * 24 * 60 * 60 * 1000;
const KEEP_FAILED_MS = 30 * 24 * 60 * 60 * 1000;

async function ensureConnected() {
  if (mongoose.connection.readyState !== 1) await connectDB();
}

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

// ── Producer ──────────────────────────────────────────────────────────────

export async function addMongoJob(queue: QueueName, jobId: string, data: object): Promise<void> {
  await ensureConnected();
  const settings = QUEUE_SETTINGS[queue];
  try {
    await QueueJob.create({
      queue,
      job_id: jobId,
      data,
      max_attempts: settings.attempts,
      backoff_ms: settings.backoffMs,
      run_at: new Date(),
    });
  } catch (err) {
    // Same job_id already queued, running, or recently finished: nothing to do
    if (!isDuplicateKey(err)) throw err;
  }
}

export type MongoJobState = "waiting" | "active" | "completed" | "failed";

export async function getMongoJobState(queue: QueueName, jobId: string): Promise<MongoJobState | null> {
  await ensureConnected();
  const job = await QueueJob.findOne({ queue, job_id: jobId }).select("status").lean<{ status: MongoJobState }>();
  return job?.status ?? null;
}

export async function mongoInFlightStoryIds(queue: QueueName): Promise<Set<string>> {
  await ensureConnected();
  const jobs = await QueueJob.find({ queue, status: { $in: ["waiting", "active"] } })
    .select("data.storyId")
    .lean<{ data: { storyId?: string } }[]>();
  return new Set(jobs.map((j) => j.data.storyId).filter((id): id is string => !!id));
}

export async function retryMongoJob(queue: QueueName, jobId: string): Promise<void> {
  await ensureConnected();
  await QueueJob.updateOne(
    { queue, job_id: jobId, status: "failed" },
    {
      status: "waiting", attempts_made: 0, run_at: new Date(),
      locked_until: null, locked_by: null, last_error: null, expire_at: null,
    }
  );
}

// ── Consumer ──────────────────────────────────────────────────────────────

interface ClaimedJob {
  _id: mongoose.Types.ObjectId;
  job_id: string;
  data: unknown;
  attempts_made: number;
  max_attempts: number;
  backoff_ms: number;
}

async function claimJob(queue: QueueName, workerId: string): Promise<ClaimedJob | null> {
  const now = new Date();
  return QueueJob.findOneAndUpdate(
    {
      queue,
      $or: [
        { status: "waiting", run_at: { $lte: now } },
        // Lock expired: the worker that held it is gone
        { status: "active", locked_until: { $lt: now } },
      ],
    },
    {
      $set: { status: "active", locked_until: new Date(now.getTime() + LOCK_MS), locked_by: workerId },
      $inc: { attempts_made: 1 },
    },
    { sort: { run_at: 1 }, new: true }
  ).lean<ClaimedJob>();
}

async function finishJob(queue: QueueName, job: ClaimedJob, workerId: string, error: unknown) {
  const settings = QUEUE_SETTINGS[queue];
  const mine = { _id: job._id, locked_by: workerId, status: "active" };
  const now = Date.now();

  if (!error) {
    if (settings.keepCompleted) {
      await QueueJob.updateOne(mine, {
        status: "completed", locked_until: null, locked_by: null,
        expire_at: new Date(now + KEEP_COMPLETED_MS),
      });
    } else {
      await QueueJob.deleteOne(mine);
    }
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  const outcome = afterFailure(job.attempts_made, job.max_attempts, error instanceof PermanentJobError);
  if (outcome === "retry") {
    await QueueJob.updateOne(mine, {
      status: "waiting", locked_until: null, locked_by: null, last_error: message,
      run_at: new Date(now + retryDelayMs(job.backoff_ms, job.attempts_made)),
    });
  } else if (settings.keepFailed) {
    await QueueJob.updateOne(mine, {
      status: "failed", locked_until: null, locked_by: null, last_error: message,
      expire_at: new Date(now + KEEP_FAILED_MS),
    });
  } else {
    await QueueJob.deleteOne(mine);
  }
}

export interface RunningWorker {
  close(): Promise<void>;
}

export function startMongoWorker<T>(
  queue: QueueName,
  handler: JobHandler<T>,
  options: { concurrency: number; pollSeconds: number; label: string }
): RunningWorker {
  const workerId = `${process.pid}-${randomUUID().slice(0, 8)}`;
  const active = new Set<Promise<void>>();
  let closing = false;
  let wake: (() => void) | null = null;
  const nudge = () => wake?.();

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(() => { wake = null; resolve(); }, ms);
      wake = () => { clearTimeout(timer); wake = null; resolve(); };
    });

  async function run(job: ClaimedJob) {
    let error: unknown = null;
    try {
      if (job.attempts_made > job.max_attempts) {
        // Reclaimed after its worker died too many times — give up on it
        throw new PermanentJobError("Job was abandoned by a worker too many times");
      }
      await handler({
        id: job.job_id,
        data: job.data as T,
        attempt: job.attempts_made,
        maxAttempts: job.max_attempts,
        isLastAttempt: job.attempts_made >= job.max_attempts,
      });
    } catch (err) {
      error = err;
      console.error(`[${options.label}] Job ${job.job_id} failed:`, err instanceof Error ? err.message : err);
    }
    try {
      await finishJob(queue, job, workerId, error);
    } catch (err) {
      // The lock will expire and the job will be retried
      console.error(`[${options.label}] Could not record result for ${job.job_id}:`, (err as Error).message);
    }
  }

  const loop = (async () => {
    while (!closing) {
      if (active.size >= options.concurrency) {
        await sleep(options.pollSeconds * 1000);
        continue;
      }
      let job: ClaimedJob | null = null;
      try {
        await ensureConnected();
        job = await claimJob(queue, workerId);
      } catch (err) {
        console.error(`[${options.label}] Could not check for jobs:`, (err as Error).message);
      }
      if (!job) {
        await sleep(options.pollSeconds * 1000);
        continue;
      }
      const task = run(job).finally(() => {
        active.delete(task);
        nudge(); // a slot freed up — look for more work straight away
      });
      active.add(task);
    }
  })();

  return {
    async close() {
      closing = true;
      nudge();
      await loop;
      await Promise.all(active);
    },
  };
}
