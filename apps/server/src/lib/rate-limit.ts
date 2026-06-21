/**
 * In-memory token-bucket rate limiter: RATE_LIMIT_PER_MIN requests/minute per
 * IP (default 100). Deliberately process-local (no Redis): the server runs as a
 * single process. Across multiple replicas the limit resets per-process.
 */

import { config } from '@/lib/config';

const WINDOW_MS = 60_000;
// Cap on tracked IPs so spoofed/rotating source IPs cannot grow memory without
// bound. When exceeded, drop fully-refilled (idle for at least one window)
// buckets: they hold no state a fresh bucket would not recreate identically.
const MAX_BUCKETS = 10_000;

interface Bucket {
  tokens: number;
  last: number;
}

const buckets = new Map<string, Bucket>();

function evictIdle(now: number): void {
  for (const [ip, b] of buckets) {
    if (now - b.last >= WINDOW_MS) buckets.delete(ip);
  }
}

/**
 * @returns true if the request is allowed (and consumes a token), false if the
 *          IP has exhausted its budget for the current window.
 */
export function allowRequest(ip: string, now: number = Date.now()): boolean {
  const cap = config.rateLimitPerMin();
  let b = buckets.get(ip);
  if (!b) {
    if (buckets.size >= MAX_BUCKETS) evictIdle(now);
    b = { tokens: cap, last: now };
    buckets.set(ip, b);
  }
  // Refill proportionally to elapsed time, capped at capacity.
  const elapsed = now - b.last;
  b.tokens = Math.min(cap, b.tokens + elapsed * (cap / WINDOW_MS));
  b.last = now;

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return true;
  }
  return false;
}

/** Test helper: clear all buckets. */
export function resetRateLimitForTests(): void {
  buckets.clear();
}
