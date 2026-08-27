import { afterEach, describe, expect, it, vi } from "vitest";

import {
  metricsSnapshot,
  observeLatency,
  recordMetric,
  resetMetricsForTest,
  structuredLog,
} from "./observability";

afterEach(() => {
  resetMetricsForTest();
  vi.restoreAllMocks();
});

describe("observability", () => {
  it("records cache, quota, and latency metrics", async () => {
    recordMetric("cache_hit", 1);
    recordMetric("cache_miss", 1);
    recordMetric("github_quota_remaining", 4999);
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    await observeLatency("test.operation", async () => "ok");

    const snapshot = metricsSnapshot();
    expect(snapshot.cache_hit?.count).toBe(1);
    expect(snapshot.cache_miss?.count).toBe(1);
    expect(snapshot.github_quota_remaining?.last).toBe(4999);
    expect(snapshot.request_latency_ms?.count).toBe(1);
  });

  it("emits JSON logs with secret redaction", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const output = structuredLog("info", "test", {
      authorization: "Bearer secret-token",
      databaseUrl: "postgresql://user:pass@db.example/app",
    });

    const payload = JSON.parse(output) as Record<string, unknown>;
    expect(payload.event).toBe("test");
    expect(payload.authorization).toBe("[REDACTED]");
    expect(payload.databaseUrl).toBe("[REDACTED]");
    expect(output).not.toContain("secret-token");
    expect(output).not.toContain("user:pass");
  });
});
