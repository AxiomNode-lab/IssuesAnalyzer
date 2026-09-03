import type { NextRequest } from "next/server";
import { isIP } from "node:net";
import { createClient } from "redis";
import { FixedWindowRateLimiter } from "../../../../packages/github-client/src/resilience";

const DEFAULT_MAX_BODY_BYTES = 32 * 1024;
const SENSITIVE_KEY = /(?:authorization|cookie|csrf|secret|token|password|database|session)/i;
const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i;

type LimiterPolicy = Readonly<{ name: string; limit: number; windowMs: number }>;
const POLICIES = {
  anonymousBurst: { name: "anonymous-burst", limit: 5, windowMs: 30_000 },
  anonymousSustained: { name: "anonymous-sustained", limit: 20, windowMs: 10 * 60_000 },
  authenticatedBurst: { name: "authenticated-burst", limit: 15, windowMs: 30_000 },
  authenticatedSustained: { name: "authenticated-sustained", limit: 60, windowMs: 10 * 60_000 },
} satisfies Record<string, LimiterPolicy>;
const localLimiters = new Map<string, FixedWindowRateLimiter>();
let redisClient: ReturnType<typeof createClient> | undefined;
let redisConnecting: Promise<void> | undefined;
let redisUnavailableUntil = 0;

function localConsume(policy: LimiterPolicy, key: string) {
  let limiter = localLimiters.get(policy.name);
  if (!limiter) {
    limiter = new FixedWindowRateLimiter(policy.limit, policy.windowMs);
    localLimiters.set(policy.name, limiter);
  }
  return limiter.consume(key);
}

async function distributedConsume(policy: LimiterPolicy, key: string) {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return localConsume(policy, key);
  if (Date.now() < redisUnavailableUntil) return localConsume(policy, key);
  try {
    if (!redisClient) {
      redisClient = createClient({ url: redisUrl });
      redisClient.on("error", () => undefined);
    }
    if (!redisClient.isOpen) {
      redisConnecting ??= redisClient
        .connect()
        .then(() => undefined)
        .finally(() => {
          redisConnecting = undefined;
        });
      await redisConnecting;
    }
    const redisKey = `gor:rate-limit:${policy.name}:${key}`;
    const result = (await redisClient.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('PTTL',KEYS[1])}",
      { keys: [redisKey], arguments: [String(policy.windowMs)] },
    )) as [number, number];
    const count = Number(result[0]);
    const ttlMs = Math.max(1, Number(result[1]));
    redisUnavailableUntil = 0;
    return {
      allowed: count <= policy.limit,
      remaining: Math.max(0, policy.limit - count),
      retryAfterSeconds: count <= policy.limit ? 0 : Math.max(1, Math.ceil(ttlMs / 1000)),
    };
  } catch {
    // Cache/rate-limit infrastructure must not crash the service. The bounded local limiter is a
    // conservative degraded fallback; production logs surface the missing shared protection.
    redisUnavailableUntil = Date.now() + 30_000;
    console.warn(
      JSON.stringify({ level: "warn", event: "rate_limit_store_unavailable", retryInMs: 30_000 }),
    );
    return localConsume(policy, key);
  }
}

export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' https://avatars.githubusercontent.com data:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://github.com https://api.github.com",
  ].join("; ");
}

export function securityHeaders(production: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": contentSecurityPolicy(),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  if (production) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}

export function assertSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin === null || origin === request.nextUrl.origin;
}

export function isApiPreflightAllowed(request: NextRequest): boolean {
  return assertSameOrigin(request) && request.headers.get("access-control-request-method") !== null;
}

export function clientRateLimitKey(request: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`;
  const trustedProxyCount = Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "0", 10);
  if (Number.isInteger(trustedProxyCount) && trustedProxyCount > 0) {
    const chain = request.headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((value) => value.trim())
      .filter((value) => isIP(value) !== 0);
    const candidate = chain?.at(-(trustedProxyCount + 1));
    if (candidate) return `ip:${candidate}`;
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp && isIP(realIp)) return `ip:${realIp}`;
  }
  return "ip:unknown";
}

export async function consumeAbuseBudget(request: NextRequest, userId?: string) {
  const policies = userId
    ? [POLICIES.authenticatedBurst, POLICIES.authenticatedSustained]
    : [POLICIES.anonymousBurst, POLICIES.anonymousSustained];
  const decisions = await Promise.all(
    policies.map((policy) => distributedConsume(policy, clientRateLimitKey(request, userId))),
  );
  const rejected = decisions.find((decision) => !decision.allowed);
  return rejected ?? decisions[decisions.length - 1]!;
}

export async function readBoundedJson<T>(
  request: Request,
  maxBytes = DEFAULT_MAX_BODY_BYTES,
): Promise<T> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const bytes = Number(declared);
    if (!Number.isFinite(bytes) || bytes < 0) {
      throw new Error("INVALID_CONTENT_LENGTH");
    }
    if (bytes > maxBytes) throw new Error("BODY_TOO_LARGE");
  }

  const reader = request.body?.getReader();
  if (!reader) return JSON.parse(await request.text()) as T;

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("BODY_TOO_LARGE");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export function safeExternalUrl(value: string): string | null {
  if (!ABSOLUTE_URL.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "github.com" && url.hostname !== "avatars.githubusercontent.com") {
      return null;
    }
    if (url.username || url.password || url.port) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function redactForLog(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]")
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgresql://[REDACTED]")
      .replace(/(?:gh[opsu]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)/g, "[REDACTED]");
  }
  if (Array.isArray(value)) return value.map(redactForLog);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactForLog(item),
      ]),
    );
  }
  return value;
}
