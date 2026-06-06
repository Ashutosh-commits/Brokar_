import Redis from "ioredis";

let redis: Redis | null = null;

// Redis is optional — app works without it, just without caching
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  redis.on("error", (err) => {
    console.warn("Redis connection error (caching disabled):", err.message);
  });

  redis.connect().catch(() => {
    console.warn("Could not connect to Redis — running without cache");
    redis = null;
  });
}

export async function cacheGet(key: string): Promise<string | null> {
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds = 300
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value, "EX", ttlSeconds);
  } catch {
    // silently ignore cache write errors
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // silently ignore
  }
}

export { redis };
