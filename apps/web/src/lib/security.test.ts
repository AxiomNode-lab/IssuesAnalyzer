import { describe, expect, it } from "vitest";

import {
  assertSameOrigin,
  clientRateLimitKey,
  contentSecurityPolicy,
  readBoundedJson,
  redactForLog,
  safeExternalUrl,
  securityHeaders,
} from "./security";

function request(url: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return new Request(url, init);
}

describe("security hardening", () => {
  it("sets restrictive security headers and only enables HSTS in production", () => {
    const development = securityHeaders(false);
    const production = securityHeaders(true);
    expect(development["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(development["X-Content-Type-Options"]).toBe("nosniff");
    expect(development["X-Frame-Options"]).toBe("DENY");
    expect(development["Strict-Transport-Security"]).toBeUndefined();
    expect(production["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(contentSecurityPolicy()).not.toContain("default-src *");
  });

  it("rejects cross-origin API requests", () => {
    const same = {
      headers: new Headers({ origin: "https://app.example" }),
      nextUrl: new URL("https://app.example/api/saved"),
    };
    const cross = {
      headers: new Headers({ origin: "https://evil.example" }),
      nextUrl: new URL("https://app.example/api/saved"),
    };
    expect(assertSameOrigin(same as never)).toBe(true);
    expect(assertSameOrigin(cross as never)).toBe(false);
  });

  it("rejects oversized bodies before parsing JSON", async () => {
    const body = JSON.stringify({ value: "x".repeat(100) });
    await expect(readBoundedJson(request("https://app.example/api", { method: "POST", body }), 32)).rejects.toThrow(
      "BODY_TOO_LARGE",
    );
  });

  it("accepts only safe GitHub-controlled HTTPS links", () => {
    expect(safeExternalUrl("https://github.com/openai/openai/issues/1")).toBeTruthy();
    expect(safeExternalUrl("https://avatars.githubusercontent.com/u/1?v=4")).toBeTruthy();
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("http://github.com/openai/openai")).toBeNull();
    expect(safeExternalUrl("https://github.com.evil.test/openai/openai")).toBeNull();
    expect(safeExternalUrl("https://user:pass@github.com/openai/openai")).toBeNull();
  });

  it("redacts representative secrets recursively", () => {
    const redacted = redactForLog({
      authorization: "Bearer abc.def.ghi",
      cookie: "gor_session=secret",
      nested: {
        csrfToken: "csrf-secret",
        databaseUrl: "postgresql://user:password@db.example/app",
        note: "github_pat_ABC123",
      },
    }) as Record<string, unknown>;

    expect(redacted.authorization).toBe("[REDACTED]");
    expect(redacted.cookie).toBe("[REDACTED]");
    expect(JSON.stringify(redacted)).not.toContain("csrf-secret");
    expect(JSON.stringify(redacted)).not.toContain("password@db.example");
    expect(JSON.stringify(redacted)).not.toContain("github_pat_ABC123");
  });

  it("separates authenticated and anonymous abuse-control keys", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    const fake = { headers } as never;
    expect(clientRateLimitKey(fake)).toBe("ip:203.0.113.5");
    expect(clientRateLimitKey(fake, "user-1")).toBe("user:user-1");
  });
});
