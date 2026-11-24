import Redis from "ioredis";

// Singleton instance to prevent multiple client connections in dev hot-reloads
const globalForRedis = globalThis as unknown as { redisClient?: Redis };

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let client: Redis;

try {
  client =
    globalForRedis.redisClient ||
    new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      retryStrategy(times) {
        if (times > 3) {
          return null; // Stop retrying after 3 rapid failures
        }
        return Math.min(times * 150, 1000);
      },
    });

  client.on("error", (err) => {
    // Non-fatal warning so missing/down Redis never crashes the Next.js app
    if (process.env.NODE_ENV !== "test") {
      console.warn("[Redis] Connection notice:", err?.message || err);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.redisClient = client;
  }
} catch (e) {
  console.warn("[Redis] Failed to initialize Redis client:", e);
  client = new Redis({ lazyConnect: true });
}

export const redis = client;

/**
 * Ensures connection is active when making calls
 */
async function ensureConnected(): Promise<boolean> {
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    return redis.status === "ready" || redis.status === "connecting" || redis.status === "connect";
  } catch {
    return false;
  }
}

/**
 * Retrieve cached JSON object
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const isOk = await ensureConnected();
    if (!isOk) return null;

    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    return null;
  }
}

/**
 * Store data as JSON with TTL in seconds
 */
export async function setCache(key: string, data: any, ttlSeconds: number = 60): Promise<void> {
  try {
    if (data === undefined || data === null) return;
    const isOk = await ensureConnected();
    if (!isOk) return;

    const serialized = JSON.stringify(data);
    await redis.set(key, serialized, "EX", ttlSeconds);
  } catch (err) {
    // Non-blocking catch
  }
}

/**
 * Delete one or more specific cache keys
 */
export async function delCache(...keys: string[]): Promise<void> {
  try {
    const validKeys = keys.filter(Boolean);
    if (validKeys.length === 0) return;

    const isOk = await ensureConnected();
    if (!isOk) return;

    await redis.del(...validKeys);
  } catch (err) {
    // Non-blocking catch
  }
}

/**
 * Delete all keys matching a prefix or pattern (e.g. "dashboard:*", "commissions:*")
 * Uses SCAN rather than KEYS to avoid blocking the Redis server
 */
export async function delByPattern(pattern: string): Promise<void> {
  try {
    const isOk = await ensureConnected();
    if (!isOk) return;

    let cursor = "0";
    do {
      const [nextCursor, foundKeys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (foundKeys.length > 0) {
        await redis.del(...foundKeys);
      }
    } while (cursor !== "0");
  } catch (err) {
    // Non-blocking catch
  }
}

/**
 * High-performance transparent fetcher wrapper:
 * 1. Returns cached value immediately if present.
 * 2. Otherwise calls fetcher(), caches result in the background, and returns it.
 * 3. In the event Redis is unavailable or fails, seamlessly executes fetcher() without throwing.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const cachedData = await getCache<T>(key);
    if (cachedData !== null && cachedData !== undefined) {
      return cachedData;
    }
  } catch {
    // Redis failed, proceed to direct database fetch
  }

  const fresh = await fetcher();

  if (fresh !== undefined && fresh !== null) {
    setCache(key, fresh, ttlSeconds).catch(() => {});
  }

  return fresh;
}
