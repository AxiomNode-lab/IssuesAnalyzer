import { FixedWindowRateLimiter } from "@opportunity-radar/github-client";
import type { NextRequest } from "next/server";

const DEFAULT_MAX_BODY_BYTES = 32 * 1024;
const SENSITIVE_KEY = /(?:authorization|cookie|csrf|secret|token|password|database|session)/i;
const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i;

const anonymousLimiter = new FixedWindowRateLimiter(20, 10 * 60 * 1000);
const authenticatedLimiter = new FixedWindowRateLimiter(60, 10 * 60 * 1000);

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
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return `ip:${forwarded || realIp || "unknown"}`;
}

export function consumeAbuseBudget(request: NextRequest, userId?: string) {
  const limiter = userId ? authenticatedLimiter : anonymousLimiter;
  return limiter.consume(clientRateLimitKey(request, userId));
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
