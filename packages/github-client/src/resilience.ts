export type CachePolicy = Readonly<{
  freshMs: number;
  staleMs: number;
}>;

export type CacheState = "miss" | "fresh" | "stale";

export type CacheResult<T> = Readonly<{
  value: T;
  state: CacheState;
}>;

type CacheEntry<T> = Readonly<{
  value: T;
  freshUntil: number;
  staleUntil: number;
}>;

export class MemoryStaleCache {
  readonly #entries = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string, now = Date.now()): CacheResult<T> | null {
    const entry = this.#entries.get(key) as CacheEntry<T> | undefined;
    if (entry === undefined) return null;
    if (now <= entry.freshUntil) return { value: entry.value, state: "fresh" };
    if (now <= entry.staleUntil) return { value: entry.value, state: "stale" };
    this.#entries.delete(key);
    return null;
  }

  set<T>(key: string, value: T, policy: CachePolicy, now = Date.now()): void {
    const freshMs = Math.max(0, policy.freshMs);
    const staleMs = Math.max(freshMs, policy.staleMs);
    this.#entries.set(key, {
      value,
      freshUntil: now + freshMs,
      staleUntil: now + staleMs,
    });
  }

  delete(key: string): void {
    this.#entries.delete(key);
  }
}

export class InFlightDeduplicator {
  readonly #pending = new Map<string, Promise<unknown>>();

  run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const existing = this.#pending.get(key) as Promise<T> | undefined;
    if (existing !== undefined) return existing;

    const pending = work().finally(() => {
      if (this.#pending.get(key) === pending) this.#pending.delete(key);
    });
    this.#pending.set(key, pending);
    return pending;
  }
}

export type RateLimitDecision = Readonly<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}>;

type Bucket = {
  count: number;
  resetAt: number;
};

export class FixedWindowRateLimiter {
  readonly #buckets = new Map<string, Bucket>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("limit must be a positive integer");
    if (!Number.isFinite(windowMs) || windowMs < 1) throw new Error("windowMs must be positive");
  }

  consume(key: string, now = Date.now()): RateLimitDecision {
    let bucket = this.#buckets.get(key);
    if (bucket === undefined || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.#buckets.set(key, bucket);
    }

    if (bucket.count >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.limit - bucket.count),
      retryAfterSeconds: 0,
    };
  }
}

export function scopedCacheKey(scope: string, resource: string): string {
  if (scope.length === 0) throw new Error("cache scope is required");
  return `${scope}:${resource}`;
}
