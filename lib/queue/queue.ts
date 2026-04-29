import { Queue } from "bullmq";
import IORedis from "ioredis";

export interface ModerationJobData {
  storyId: string;
  storyTitle: string;
  storyBody: string;
  storyThemes: string[];
  userEmail?: string;
}

function createRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is not defined");

  return new IORedis(url, {
    maxRetriesPerRequest: null,
    // Upstash uses TLS (rediss:// scheme) — ioredis handles it automatically
    tls: url.startsWith("rediss://") ? {} : undefined,
  });
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
