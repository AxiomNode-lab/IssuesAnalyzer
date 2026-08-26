import { describe, expect, it } from "vitest";

import {
  assertOwner,
  buildGithubAuthorizeUrl,
  decodeSession,
  encodeSession,
  verifyCsrf,
  type Session,
} from "./auth.js";

const secret = "a-secure-test-secret-that-is-at-least-32-characters";
const session: Session = {
  user: { userId: "11111111-1111-1111-1111-111111111111", githubUserId: 123, login: "octocat" },
  issuedAt: 1_800_000_000_000,
  expiresAt: 1_800_003_600_000,
};

describe("authentication policies", () => {
  it("requests only read:user during GitHub OAuth", () => {
    const url = new URL(
      buildGithubAuthorizeUrl({
        clientId: "client-id",
        redirectUri: "https://app.example/api/auth/github/callback",
        state: "state-token",
      }),
    );
    expect(url.origin).toBe("https://github.com");
    expect(url.searchParams.get("scope")).toBe("read:user");
    expect(url.searchParams.get("state")).toBe("state-token");
  });

  it("round-trips an untampered session and rejects tampering", async () => {
    const encoded = await encodeSession(session, secret);
    expect(await decodeSession(encoded, secret, 1_800_000_100_000)).toEqual(session);
    expect(await decodeSession(`${encoded}x`, secret, 1_800_000_100_000)).toBeNull();
  });

  it("rejects expired sessions", async () => {
    const encoded = await encodeSession(session, secret);
    expect(await decodeSession(encoded, secret, session.expiresAt)).toBeNull();
  });

  it("requires matching csrf cookie and submitted token", () => {
    expect(verifyCsrf("token", "token")).toBe(true);
    expect(verifyCsrf("token", "other")).toBe(false);
    expect(verifyCsrf(undefined, "token")).toBe(false);
  });

  it("enforces server-side ownership", () => {
    expect(assertOwner(session, session.user.userId)).toBe(session);
    expect(() => assertOwner(session, "22222222-2222-2222-2222-222222222222")).toThrow("FORBIDDEN");
    expect(() => assertOwner(null, session.user.userId)).toThrow("UNAUTHENTICATED");
  });
});
