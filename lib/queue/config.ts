// Which system holds the job queue (and the submission rate limit).
// "redis" (default): BullMQ on Redis/Upstash.
// "mongo": a collection in the app's existing MongoDB — no Redis needed.
export type QueueBackend = "redis" | "mongo";

type Env = Record<string, string | undefined>;

export function queueBackend(env: Env = process.env): QueueBackend {
  const value = (env.QUEUE_BACKEND ?? "redis").trim().toLowerCase();
  if (value === "" || value === "redis") return "redis";
  if (value === "mongo") return "mongo";
  throw new Error("QUEUE_BACKEND must be redis or mongo");
}

export type QueueName = "moderation" | "illustration";

export interface QueueSettings {
  attempts: number;
  // First retry waits this long; each later retry doubles it
  backoffMs: number;
  // Keep finished jobs for a while (so the same jobId stays deduplicated and
  // failures can be inspected), or delete them so the job can be re-queued
  keepCompleted: boolean;
  keepFailed: boolean;
}

// Shared by both backends so they behave the same way
export const QUEUE_SETTINGS: Record<QueueName, QueueSettings> = {
  moderation: { attempts: 3, backoffMs: 5000, keepCompleted: true, keepFailed: true },
  illustration: { attempts: 2, backoffMs: 10000, keepCompleted: false, keepFailed: false },
};

// Seconds an idle Mongo-backed worker waits between checks for new jobs
export function mongoPollSeconds(env: Env = process.env): number {
  const raw = env.MONGO_QUEUE_POLL_SECONDS;
  if (raw === undefined || raw === "") return 5;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1 || value > 60) {
    throw new Error("MONGO_QUEUE_POLL_SECONDS must be a number from 1 to 60");
  }
  return value;
}
