import IORedis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var _rateLimitRedis: IORedis | undefined;
}

function getRedis(): IORedis {
  if (global._rateLimitRedis) return global._rateLimitRedis;

  const url = process.env.REDIS_URL!;
  if (!url) throw new Error("REDIS_URL environment variable is not defined");

  const client = new IORedis(url, {
    maxRetriesPerRequest: null,
    tls: url.startsWith("rediss://") ? {} : undefined,
  });

  if (process.env.NODE_ENV !== "production") {
    global._rateLimitRedis = client;
  }

  return client;
}

export async function checkRateLimit(
  key: string
): Promise<{ allowed: boolean; resetIn: number }> {
  const redis = getRedis();
  const redisKey = `rate_limit:story:${key}`;

  const count = await redis.incr(redisKey);

  if (count === 1) {
    // First submission this hour — set 1-hour TTL
    await redis.expire(redisKey, 3600);
  }

  if (count > 1) {
    const ttl = await redis.ttl(redisKey);
    return { allowed: false, resetIn: ttl > 0 ? ttl : 3600 };
  }

  return { allowed: true, resetIn: 0 };
}
