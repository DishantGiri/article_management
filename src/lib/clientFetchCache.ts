"use client";

const DEFAULT_TTL_MS = 45_000;
const MAX_CACHE_ENTRIES = 120;

interface CacheEntry {
  body: string;
  status: number;
  statusText: string;
  contentType: string;
  timestamp: number;
}

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<CacheEntry | null>>();

let isInstalled = false;

export function clearClientApiCache(prefix?: string) {
  if (!prefix) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function toRelativeApiPath(rawUrl: string): string | null {
  try {
    if (rawUrl.startsWith("/api/")) return rawUrl;
    if (typeof window !== "undefined") {
      const parsed = new URL(rawUrl, window.location.origin);
      if (parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/")) {
        return `${parsed.pathname}${parsed.search}`;
      }
    }
  } catch {
    // Ignore malformed URLs
  }
  return null;
}

function shouldSkipCache(apiPath: string): boolean {
  return (
    apiPath.startsWith("/api/auth/") ||
    apiPath.startsWith("/api/notices/pending") ||
    apiPath.startsWith("/api/dev/")
  );
}

function makeResponse(entry: CacheEntry): Response {
  return new Response(entry.body, {
    status: entry.status,
    statusText: entry.statusText,
    headers: {
      "Content-Type": entry.contentType || "application/json",
      "X-Client-Cache": "HIT",
    },
  });
}

function setCacheEntry(key: string, entry: CacheEntry) {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, entry);
}

/**
 * Installs a lightweight in-memory cache + in-flight deduplicator for same-origin
 * GET /api/* JSON requests so switching between sidebar tabs renders immediately
 * without re-hitting the server. Automatically invalidates on mutations and
 * live WebSocket updates.
 */
export function installClientFetchCache() {
  if (typeof window === "undefined" || isInstalled) return;
  isInstalled = true;

  const originalFetch = window.fetch.bind(window);

  // Invalidate cached API responses on real-time WebSocket updates
  const invalidateOnRealtime = () => {
    responseCache.clear();
  };
  window.addEventListener("live-notification", invalidateOnRealtime);
  window.addEventListener("notice-published", invalidateOnRealtime);
  window.addEventListener("notice-acknowledged", invalidateOnRealtime);
  window.addEventListener("notifications-marked-read", () => clearClientApiCache("/api/notifications"));
  window.addEventListener("notifications-updated", () => clearClientApiCache("/api/notifications"));

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = getRequestUrl(input);
    const apiPath = toRelativeApiPath(rawUrl);

    if (!apiPath) {
      return originalFetch(input, init);
    }

    const method = (
      init?.method ||
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    // Any mutating API call bypasses cache and invalidates cached GET data on success
    if (method !== "GET") {
      const res = await originalFetch(input, init);
      if (res.ok && !apiPath.startsWith("/api/auth/")) {
        responseCache.clear();
      }
      return res;
    }

    // Respect explicit opt-outs or auth/pending endpoints
    const bypassCache =
      shouldSkipCache(apiPath) ||
      init?.cache === "no-store" ||
      init?.cache === "reload";

    if (bypassCache) {
      return originalFetch(input, init);
    }

    const now = Date.now();
    const cached = responseCache.get(apiPath);
    if (cached && now - cached.timestamp < DEFAULT_TTL_MS) {
      return makeResponse(cached);
    }

    // Deduplicate concurrent identical GET requests
    const existingFlight = inFlightRequests.get(apiPath);
    if (existingFlight) {
      const entry = await existingFlight;
      if (entry) return makeResponse(entry);
      return originalFetch(input, init);
    }

    const fetchAndCache = async (): Promise<{ res: Response; entry: CacheEntry | null }> => {
      const res = await originalFetch(input, init);
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const text = await res.clone().text();
        const entry: CacheEntry = {
          body: text,
          status: res.status,
          statusText: res.statusText,
          contentType,
          timestamp: Date.now(),
        };
        setCacheEntry(apiPath, entry);
        return { res, entry };
      }
      return { res, entry: null };
    };

    let resolveFlight!: (entry: CacheEntry | null) => void;
    const flightPromise = new Promise<CacheEntry | null>((resolve) => {
      resolveFlight = resolve;
    });
    inFlightRequests.set(apiPath, flightPromise);

    try {
      const { res, entry } = await fetchAndCache();
      resolveFlight(entry);
      return res;
    } catch (err) {
      resolveFlight(null);
      throw err;
    } finally {
      inFlightRequests.delete(apiPath);
    }
  };
}
