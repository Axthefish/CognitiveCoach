// Simple in-memory rate limiter based on IP + path key
// Note: For serverless multi-instance, consider external store (Redis). This is a best-effort local limiter.

type Counter = { count: number; resetAt: number };
const counters = new Map<string, Counter>();

export function buildRateKey(ip: string | null, path: string): string {
  return `${ip || 'unknown'}:${path}`;
}

export function checkRateLimit(
  key: string,
  limit: number = Number(process.env.RATE_LIMIT_PER_MINUTE || 60),
  windowMs: number = 60_000
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const existing = counters.get(key);
  if (!existing || existing.resetAt <= now) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (existing.count < limit) {
    existing.count += 1;
    return { allowed: true };
  }
  const retryAfter = Math.max(0, Math.ceil((existing.resetAt - now) / 1000));
  return { allowed: false, retryAfter };
}


