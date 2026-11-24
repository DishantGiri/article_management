import Redis from "ioredis";

// Singleton instance to prevent multiple client connections in dev hot-reloads
const globalForRedis = globalThis as unknown as {
  redisClient?: Redis;
  serverMemCache?: Map<string, { value: any; expiresAt: number }>;
  redisCooldownUntil?: number;
};

const MAX_MEM_CACHE_SIZE = 500;
const memoryCache =
  globalForRedis.serverMemCache ?? new Map<string, { value: any; expiresAt: number }>();
globalForRedis.serverMemCache = memoryCache;

function memGet<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function memSet(key: string, value: any, ttlSeconds: number) {
  if (memoryCache.size >= MAX_MEM_CACHE_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memDel(...keys: string[]) {
  for (const k of keys) {
    memoryCache.delete(k);
  }
}

function memDelByPattern(pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const regex = new RegExp(`^${escaped}$`);
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
    }
  }
}

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let client: Redis;

try {
  client =
    globalForRedis.redisClient ||
    new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 400,
      retryStrategy(times) {
        if (times > 1) {
          return null;
        }
        return 100;
      },
    });

  client.on("error", (err) => {
    // Enter cooldown so requests never stall waiting on an unreachable Redis server
    globalForRedis.redisCooldownUntil = Date.now() + 30_000;
    if (process.env.NODE_ENV !== "test") {
      console.warn("[Redis] Connection notice:", err?.message || err);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.redisClient = client;
  }
} catch (e) {
  console.warn("[Redis] Failed to initialize Redis client:", e);
  globalForRedis.redisCooldownUntil = Date.now() + 30_000;
  client = new Redis({ lazyConnect: true });
}

export const redis = client;

/**
 * Ensures connection is active when making calls, with fast circuit-breaker
 * so a down Redis instance adds 0ms latency instead of hanging every request.
 */
async function ensureConnected(): Promise<boolean> {
  if (redis.status === "ready") return true;
  if (globalForRedis.redisCooldownUntil && Date.now() < globalForRedis.redisCooldownUntil) {
    return false;
  }
  try {
    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect();
    }
    return redis.status === "ready";
  } catch {
    globalForRedis.redisCooldownUntil = Date.now() + 30_000;
    return false;
  }
}

/**
 * Retrieve cached JSON object (checks L1 in-memory cache first, then Redis)
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const memHit = memGet<T>(key);
  if (memHit !== null) return memHit;

  try {
    const isOk = await ensureConnected();
    if (!isOk) return null;

    const data = await redis.get(key);
    if (!data) return null;
    const parsed = JSON.parse(data) as T;
    // Populate L1 memory cache for ultra-fast repeat reads (cap at 30s)
    memSet(key, parsed, 30);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Store data in L1 in-memory cache and Redis with TTL in seconds
 */
export async function setCache(key: string, data: any, ttlSeconds: number = 60): Promise<void> {
  if (data === undefined || data === null) return;
  memSet(key, data, ttlSeconds);

  try {
    const isOk = await ensureConnected();
    if (!isOk) return;

    const serialized = JSON.stringify(data);
    await redis.set(key, serialized, "EX", ttlSeconds);
  } catch {
    // Non-blocking catch
  }
}

/**
 * Delete one or more specific cache keys from L1 memory and Redis
 */
export async function delCache(...keys: string[]): Promise<void> {
  const validKeys = keys.filter(Boolean);
  if (validKeys.length === 0) return;
  memDel(...validKeys);

  try {
    const isOk = await ensureConnected();
    if (!isOk) return;

    await redis.del(...validKeys);
  } catch {
    // Non-blocking catch
  }
}

/**
 * Delete all keys matching a prefix or pattern (e.g. "dashboard:*", "commissions:*")
 */
export async function delByPattern(pattern: string): Promise<void> {
  memDelByPattern(pattern);

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
  } catch {
    // Non-blocking catch
  }
}

/**
 * High-performance transparent fetcher wrapper:
 * 1. Returns L1 memory or Redis cached value immediately if present.
 * 2. Deduplicates concurrent identical fetches for the same key.
 * 3. Otherwise calls fetcher(), caches result, and returns it.
 */
const inFlightCacheFetches = new Map<string, Promise<any>>();

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
    // Proceed to direct database fetch
  }

  const existing = inFlightCacheFetches.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetcher()
    .then((fresh) => {
      if (fresh !== undefined && fresh !== null) {
        setCache(key, fresh, ttlSeconds).catch(() => {});
      }
      return fresh;
    })
    .finally(() => {
      inFlightCacheFetches.delete(key);
    });

  inFlightCacheFetches.set(key, promise);
  return promise;
}
