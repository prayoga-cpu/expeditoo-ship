/**
 * Fixed-window rate limiter, in process memory.
 *
 * Deliberately small, and honest about what it is: the counter lives in one
 * server instance's heap, so on a multi-instance deployment a caller gets the
 * allowance once per instance, and a cold start forgets everything. That makes
 * it a brake on casual abuse of a public endpoint, not a security control. Any
 * limit that has to hold across instances needs shared storage — Redis or a
 * table — and this is not that.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Bound on the map so a stream of unique keys cannot grow it without limit. */
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets. Zero when the call was allowed. */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) sweep(now);
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
}

/** Test seam — the window map is module state and outlives a single test. */
export function resetRateLimits() {
  windows.clear();
}

/**
 * Best-effort client address. `x-forwarded-for` is a list, left-most being the
 * original client; Vercel sets `x-real-ip` too. Both are proxy-supplied and
 * spoofable, which is another reason this limiter is a brake and not a gate.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
