import { Queue } from "bullmq";
import IORedis from "ioredis";

export interface ModerationJobData {
  storyId: string;
  storyTitle: string;
  storyBody: string;
  storyThemes: string[];
  userEmail?: string;
  submittedAt?: string;
}

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

// Lazy singleton — only instantiated when first used, not at module import time
let _queue: Queue<ModerationJobData> | null = null;

export function getModerationQueue(): Queue<ModerationJobData> {
  if (!_queue) {
    _queue = new Queue<ModerationJobData>("moderation", {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return _queue;
}

export interface IllustrationJobData {
  storyId: string;
}

let _illustrationQueue: Queue<IllustrationJobData> | null = null;

export function getIllustrationQueue(): Queue<IllustrationJobData> {
  if (!_illustrationQueue) {
    _illustrationQueue = new Queue<IllustrationJobData>("illustration", {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    });
  }
  return _illustrationQueue;
}

export async function closeQueues(): Promise<void> {
  await Promise.all([_queue?.close(), _illustrationQueue?.close()]);
  for (const connection of connections) connection.disconnect();
  connections.clear();
  _queue = null;
  _illustrationQueue = null;
}

// Queues an illustration for a story. The jobId stops the same story being
// queued twice while a job for it is still waiting or running.
export async function enqueueIllustration(storyId: string): Promise<void> {
  await getIllustrationQueue().add(
    "illustrate-story",
    { storyId },
    { jobId: `illustrate-${storyId}` }
  );
}
