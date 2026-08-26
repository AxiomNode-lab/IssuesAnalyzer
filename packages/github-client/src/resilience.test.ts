import { describe, expect, it, vi } from "vitest";

import {
  FixedWindowRateLimiter,
  InFlightDeduplicator,
  MemoryStaleCache,
  scopedCacheKey,
} from "./resilience";

describe("MemoryStaleCache", () => {
  it("distinguishes fresh, stale, and expired entries", () => {
    const cache = new MemoryStaleCache();
    cache.set("public:repo", { ok: true }, { freshMs: 100, staleMs: 300 }, 1_000);

    expect(cache.get("public:repo", 1_050)?.state).toBe("fresh");
    expect(cache.get("public:repo", 1_200)?.state).toBe("stale");
    expect(cache.get("public:repo", 1_301)).toBeNull();
  });

  it("keeps personalized scopes separate", () => {
    expect(scopedCacheKey("user:1", "issue:42")).not.toBe(
      scopedCacheKey("user:2", "issue:42"),
    );
  });
});

describe("InFlightDeduplicator", () => {
  it("runs concurrent work for the same key once", async () => {
    const dedupe = new InFlightDeduplicator();
    const work = vi.fn(async () => "done");

    const [first, second] = await Promise.all([
      dedupe.run("analysis:1", work),
      dedupe.run("analysis:1", work),
    ]);

    expect(first).toBe("done");
    expect(second).toBe("done");
    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe("FixedWindowRateLimiter", () => {
  it("throttles each identity independently and exposes retry timing", () => {
    const limiter = new FixedWindowRateLimiter(2, 10_000);

    expect(limiter.consume("user:1", 1_000).allowed).toBe(true);
    expect(limiter.consume("user:1", 1_001).allowed).toBe(true);
    const blocked = limiter.consume("user:1", 1_002);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(10);
    expect(limiter.consume("ip:203.0.113.5", 1_002).allowed).toBe(true);
    expect(limiter.consume("user:1", 11_000).allowed).toBe(true);
  });
});
