// In-memory fixed-window rate limits (PRD 9/T8).
// ponytail: single-process Map is enough for one demo server; use Redis if ever multi-instance.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return false; }
  arr.push(now);
  hits.set(key, arr);
  return true;
}

export const LIMITS = {
  orderPerSession: { max: 10, windowMs: 10 * 60_000 }, // 10 orders / 10 min / session
  sessionPerIp: { max: 30, windowMs: 10 * 60_000 },
  webhook: { max: 60, windowMs: 60_000 },
} as const;
