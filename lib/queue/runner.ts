// Starts a queue consumer on whichever backend QUEUE_BACKEND selects.
import { Worker, UnrecoverableError } from "bullmq";
import IORedis from "ioredis";
import { mongoPollSeconds, QUEUE_SETTINGS, QueueName, queueBackend } from "./config";
import { JobHandler, PermanentJobError } from "./job";
import { RunningWorker, startMongoWorker } from "./mongoQueue";
import { workerPollingOptions } from "./polling";

export type { RunningWorker } from "./mongoQueue";

export function startWorker<T>(
  queue: QueueName,
  handler: JobHandler<T>,
  options: { concurrency: number; label: string }
): RunningWorker {
  if (queueBackend() === "mongo") {
    return startMongoWorker(queue, handler, { ...options, pollSeconds: mongoPollSeconds() });
  }
  return startRedisWorker(queue, handler, options);
}

export function describeQueueBackend(): string {
  if (queueBackend() === "mongo") {
    return `MongoDB queue, checking for jobs every ${mongoPollSeconds()}s`;
  }
  const polling = workerPollingOptions();
  return `Redis queue, idle wait ${polling.drainDelay}s, stalled-job check every ${polling.stalledInterval / 1000}s`;
}

function startRedisWorker<T>(
  queue: QueueName,
  handler: JobHandler<T>,
  options: { concurrency: number; label: string }
): RunningWorker {
  const url = process.env.REDIS_URL!;
  const connection = new IORedis(url, {
    maxRetriesPerRequest: null,
    tls: url.startsWith("rediss://") ? {} : undefined,
  });
  connection.on("error", () => console.error(`[${options.label}] Redis connection unavailable`));

  const attempts = QUEUE_SETTINGS[queue].attempts;
  const worker = new Worker(
    queue,
    async (job) => {
      const maxAttempts = job.opts.attempts ?? attempts;
      const attempt = job.attemptsMade + 1;
      try {
        return await handler({
          id: String(job.id),
          data: job.data as T,
          attempt,
          maxAttempts,
          isLastAttempt: attempt >= maxAttempts,
        });
      } catch (err) {
        // BullMQ's equivalent of "don't retry"
        if (err instanceof PermanentJobError) throw new UnrecoverableError(err.message);
        throw err;
      }
    },
    // Fewer Redis round-trips while idle — see polling.ts
    { connection, concurrency: options.concurrency, ...workerPollingOptions() }
  );

  worker.on("completed", (job) => console.log(`[${options.label}] Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`[${options.label}] Job ${job?.id} failed:`, err.message));
  worker.on("error", (err) => console.error(`[${options.label}] Worker error:`, err));

  return {
    async close() {
      await worker.close();
      connection.disconnect();
    },
  };
}
