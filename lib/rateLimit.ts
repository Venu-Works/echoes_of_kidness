import IORedis from "ioredis";
import { createHash } from "crypto";

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

export async function checkRateLimit(
  key: string
): Promise<{ allowed: boolean; resetIn: number }> {
  const redis = getRedis();
  const redisKey = `rate_limit:story:${createHash("sha256").update(key).digest("hex")}`;

  // Atomic: a process crash cannot leave a permanent key without an expiry.
  const result = await redis.eval(`
    local count = redis.call('INCR', KEYS[1])
    if count == 1 or redis.call('TTL', KEYS[1]) < 0 then
      redis.call('EXPIRE', KEYS[1], 3600)
    end
    return {count, redis.call('TTL', KEYS[1])}
  `, 1, redisKey) as [number, number];
  return { allowed: result[0] <= 1, resetIn: result[0] > 1 ? Math.max(1, result[1]) : 0 };
}
