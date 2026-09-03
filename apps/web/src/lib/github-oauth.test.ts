import { describe, expect, it, vi } from "vitest";

import { githubOAuthFetch } from "./github-oauth";

describe("githubOAuthFetch", () => {
  it("rejects redirects and supplies a request deadline", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
    await githubOAuthFetch(
      "https://api.github.com/user",
      { headers: { authorization: "Bearer secret" } },
      fetchMock,
    );
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.redirect).toBe("error");
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});
