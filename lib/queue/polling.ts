// How often idle BullMQ workers talk to Redis. Upstash bills (and caps the
// free tier) per command, and an idle worker with BullMQ's defaults sends
// roughly a million commands a month. These settings cut that ~20x without
// slowing anything down: a newly queued job still wakes the worker instantly.

type Env = Record<string, string | undefined>;

function readNumber(env: Env, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number from ${min} to ${max}`);
  }
  return value;
}

export interface PollingOptions {
  // Seconds a worker waits on Redis for a job before checking again
  // (BullMQ default: 5). New jobs interrupt the wait immediately.
  drainDelay: number;
  // Milliseconds between checks for jobs left behind by a crashed worker
  // (BullMQ default: 30000). Only affects how fast a crash is recovered.
  stalledInterval: number;
}

export function workerPollingOptions(env: Env = process.env): PollingOptions {
  return {
    drainDelay: readNumber(env, "WORKER_IDLE_WAIT_SECONDS", 120, 5, 600),
    stalledInterval: readNumber(env, "WORKER_STALLED_CHECK_SECONDS", 300, 30, 3600) * 1000,
  };
}
