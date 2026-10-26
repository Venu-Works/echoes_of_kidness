// Public queue API used by the website, worker and scripts. Jobs go to
// Redis/BullMQ or MongoDB depending on QUEUE_BACKEND (see config.ts).
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_SETTINGS, QueueName, queueBackend } from "./config";
import type { IllustrationJobData, ModerationJobData } from "./job";
import { addMongoJob, getMongoJobState, mongoInFlightStoryIds, retryMongoJob } from "./mongoQueue";

export type { ModerationJobData, IllustrationJobData } from "./job";

// ── Redis / BullMQ ────────────────────────────────────────────────────────

const connections = new Set<IORedis>();

function createRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is not defined");

  const connection = new IORedis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    commandTimeout: 5000,
    // Upstash uses TLS (rediss:// scheme) — ioredis handles it automatically
    tls: url.startsWith("rediss://") ? {} : undefined,
  });
  connection.on("error", () => console.error("[Queue] Redis connection unavailable"));
  connections.add(connection);
  return connection;
}

// Lazy singletons — only instantiated when first used, not at module import time
const redisQueues: Partial<Record<QueueName, Queue>> = {};

function getRedisQueue(name: QueueName): Queue {
  if (!redisQueues[name]) {
    const settings = QUEUE_SETTINGS[name];
    redisQueues[name] = new Queue(name, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: settings.attempts,
        backoff: { type: "exponential", delay: settings.backoffMs },
        removeOnComplete: settings.keepCompleted ? { count: 1000 } : true,
        removeOnFail: settings.keepFailed ? { count: 500 } : true,
      },
    });
  }
  return redisQueues[name]!;
}

// ── Producer API ──────────────────────────────────────────────────────────

export async function enqueueModeration(data: ModerationJobData, jobId: string): Promise<void> {
  if (queueBackend() === "mongo") return addMongoJob("moderation", jobId, data);
  await getRedisQueue("moderation").add("moderate-story", data, { jobId });
}

// Queues an illustration for a story. The jobId stops the same story being
// queued twice while a job for it is still waiting or running.
export async function enqueueIllustration(storyId: string): Promise<void> {
  const data: IllustrationJobData = { storyId };
  const jobId = `illustrate-${storyId}`;
  if (queueBackend() === "mongo") return addMongoJob("illustration", jobId, data);
  await getRedisQueue("illustration").add("illustrate-story", data, { jobId });
}

// ── Inspection (used by scripts/recover-moderation.ts) ────────────────────

export async function moderationStoryIdsInFlight(): Promise<Set<string>> {
  if (queueBackend() === "mongo") return mongoInFlightStoryIds("moderation");
  const jobs = await getRedisQueue("moderation").getJobs(["wait", "active", "delayed", "paused", "prioritized"]);
  return new Set(jobs.map((job) => (job.data as ModerationJobData).storyId));
}

// Returns the job's state, or null if no job with this ID exists
export async function moderationJobState(jobId: string): Promise<string | null> {
  if (queueBackend() === "mongo") return getMongoJobState("moderation", jobId);
  const job = await getRedisQueue("moderation").getJob(jobId);
  return job ? await job.getState() : null;
}

export async function retryFailedModerationJob(jobId: string): Promise<void> {
  if (queueBackend() === "mongo") return retryMongoJob("moderation", jobId);
  await (await getRedisQueue("moderation").getJob(jobId))?.retry();
}

export async function closeQueues(): Promise<void> {
  await Promise.all(Object.values(redisQueues).map((queue) => queue?.close()));
  for (const connection of connections) connection.disconnect();
  connections.clear();
  for (const name of Object.keys(redisQueues) as QueueName[]) delete redisQueues[name];
}
