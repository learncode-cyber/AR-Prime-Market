/**
 * Rate limiter for gateway-wrapped API routes.
 *
 * IMPORTANT — production scaling note (documented honestly, not hidden):
 * This is an in-memory sliding-window counter. It works correctly for a
 * single server process. On serverless/edge deploys that scale out to
 * multiple instances (which is how the Node/Nitro build target can run
 * behind a load balancer, and how Supabase Edge Functions always run),
 * each instance has its OWN counter — so the *effective* limit becomes
 * `limit × instance count`, not a strict global cap.
 *
 * This is intentionally shipped as the Module 2 baseline because it needs
 * zero new infrastructure and correctly stops the common cases (a single
 * client hammering an endpoint, a misconfigured retry loop). A follow-up
 * module (tracked in docs/architecture/API_GATEWAY.md → "Follow-ups") can
 * swap the backing store for Redis/Upstash without changing the
 * `RateLimiter` interface below — every call site depends on the interface,
 * not this implementation.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms
}

export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): RateLimitResult;
}

interface Bucket {
  count: number;
  windowStart: number;
}

export class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();
  // Prevent unbounded memory growth from an ever-growing set of keys
  // (e.g. one bucket per client IP). Oldest entries are evicted first.
  private readonly maxBuckets: number;

  constructor(maxBuckets = 50_000) {
    this.maxBuckets = maxBuckets;
  }

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || now - existing.windowStart >= windowMs) {
      this.evictIfFull();
      this.buckets.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    if (existing.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: existing.windowStart + windowMs };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: limit - existing.count,
      resetAt: existing.windowStart + windowMs,
    };
  }

  private evictIfFull() {
    if (this.buckets.size < this.maxBuckets) return;
    const oldestKey = this.buckets.keys().next().value;
    if (oldestKey !== undefined) this.buckets.delete(oldestKey);
  }

  /** Test/ops helper — not part of the RateLimiter interface. */
  size(): number {
    return this.buckets.size;
  }
}

// One shared instance per server process, reused across all gateway calls.
export const defaultRateLimiter = new InMemoryRateLimiter();

export function clientKeyFromRequest(request: Request, routeName: string): string {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${routeName}:${ip}`;
}
