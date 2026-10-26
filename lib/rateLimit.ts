import IORedis from "ioredis";
import mongoose from "mongoose";
import { createHash } from "crypto";
import { connectDB } from "@/lib/mongodb";
import { RateLimit } from "@/models/RateLimit";
import { queueBackend } from "@/lib/queue/config";

declare global {
  // eslint-disable-next-line no-var
  var _rateLimitRedis: IORedis | undefined;
}

function getRedis(): IORedis {
  if (global._rateLimitRedis) return global._rateLimitRedis;

  const url = process.env.REDIS_URL!;
  if (!url) throw new Error("REDIS_URL environment variable is not defined");

  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    commandTimeout: 3000,
    tls: url.startsWith("rediss://") ? {} : undefined,
  });

  client.on("error", () => console.error("[Rate limit] Redis unavailable"));
  global._rateLimitRedis = client;

  return client;
}

const WINDOW_SECONDS = 3600;

// One submission per key per hour. Stored in Redis or MongoDB, following
// QUEUE_BACKEND, so the mongo setting needs no Redis at all.
export async function checkRateLimit(
  key: string
): Promise<{ allowed: boolean; resetIn: number }> {
  const hashed = createHash("sha256").update(key).digest("hex");
  return queueBackend() === "mongo" ? checkMongo(hashed) : checkRedis(hashed);
}

async function checkMongo(hashed: string): Promise<{ allowed: boolean; resetIn: number }> {
  if (mongoose.connection.readyState !== 1) await connectDB();
  const id = `story:${hashed}`;
  const now = new Date();
  // MongoDB's TTL cleanup can lag by a minute; clear an expired counter first
  await RateLimit.deleteOne({ _id: id, expires_at: { $lte: now } });
  const upsert = () =>
    RateLimit.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(now.getTime() + WINDOW_SECONDS * 1000) } },
      { upsert: true, new: true }
    ).lean<{ count: number; expires_at: Date }>();
  let doc;
  try {
    doc = await upsert();
  } catch (err) {
    // Two simultaneous first requests both tried to insert; the retry updates
    if ((err as { code?: number }).code !== 11000) throw err;
    doc = await upsert();
  }
  const resetIn = Math.max(1, Math.ceil((doc!.expires_at.getTime() - now.getTime()) / 1000));
  return { allowed: doc!.count <= 1, resetIn: doc!.count > 1 ? resetIn : 0 };
}

async function checkRedis(hashed: string): Promise<{ allowed: boolean; resetIn: number }> {
  const redis = getRedis();
  const redisKey = `rate_limit:story:${hashed}`;

  // Atomic: a process crash cannot leave a permanent key without an expiry.
  const result = await redis.eval(`
    local count = redis.call('INCR', KEYS[1])
    if count == 1 or redis.call('TTL', KEYS[1]) < 0 then
      redis.call('EXPIRE', KEYS[1], ${WINDOW_SECONDS})
    end
    return {count, redis.call('TTL', KEYS[1])}
  `, 1, redisKey) as [number, number];
  return { allowed: result[0] <= 1, resetIn: result[0] > 1 ? Math.max(1, result[1]) : 0 };
}
