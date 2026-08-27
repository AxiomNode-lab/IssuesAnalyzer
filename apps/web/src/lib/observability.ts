import { runtimeConfig } from "./runtime-config";
import { redactForLog } from "./security";

type MetricKey =
  | "request_latency_ms"
  | "cache_hit"
  | "cache_miss"
  | "github_quota_remaining";

type MetricState = {
  count: number;
  sum: number;
  last: number;
};

const metrics = new Map<MetricKey, MetricState>();

export function recordMetric(name: MetricKey, value: number): void {
  if (!Number.isFinite(value)) return;
  const current = metrics.get(name) ?? { count: 0, sum: 0, last: 0 };
  metrics.set(name, {
    count: current.count + 1,
    sum: current.sum + value,
    last: value,
  });
}

export function metricsSnapshot(): Record<string, MetricState> {
  return Object.fromEntries(metrics.entries());
}

export function resetMetricsForTest(): void {
  metrics.clear();
}

export function structuredLog(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
): string {
  const config = runtimeConfig();
  const payload = JSON.stringify(
    redactForLog({
      timestamp: new Date().toISOString(),
      level,
      event,
      service: config.serviceName,
      environment: config.environment,
      release: config.release,
      ...fields,
    }),
  );

  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);

  return payload;
}

export function reportOperationalError(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  const normalized =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: String(error) };
  structuredLog("error", "operational_error", { ...context, error: normalized });
}

export async function observeLatency<T>(
  event: string,
  work: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    return await work();
  } finally {
    const durationMs = performance.now() - started;
    recordMetric("request_latency_ms", durationMs);
    structuredLog("info", event, { durationMs: Math.round(durationMs) });
  }
}
