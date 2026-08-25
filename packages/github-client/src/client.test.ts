import { describe, expect, it, vi } from "vitest";

import { GitHubClient } from "./client";
import { GitHubClientError } from "./errors";

const reference = {
  owner: "octocat",
  repository: "Hello-World",
  issueNumber: 1347,
  canonicalUrl: "https://github.com/octocat/Hello-World/issues/1347",
} as const;

function issueFixture(): Record<string, unknown> {
  return {
    id: 1,
    number: 1347,
    title: "Found a bug",
    body: "Details",
    state: "open",
    locked: false,
    comments: 2,
    user: { login: "octocat", html_url: "https://github.com/octocat" },
    labels: [{ name: "bug" }],
    assignees: [],
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-02T10:00:00Z",
    closed_at: null,
    html_url: "https://github.com/octocat/Hello-World/issues/1347",
  };
}

function commentFixture(): Record<string, unknown> {
  return {
    id: 9,
    body: "A comment",
    user: { login: "reviewer", html_url: "https://github.com/reviewer" },
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
    html_url: "https://github.com/octocat/Hello-World/issues/1347#issuecomment-9",
  };
}

describe("GitHubClient", () => {
  it("uses the fixed GitHub origin, read-only headers, and normalizes an issue", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(issueFixture()), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-github-request-id": "REQ-1",
          "x-ratelimit-limit": "5000",
          "x-ratelimit-remaining": "4999",
          "x-ratelimit-used": "1",
          "x-ratelimit-reset": "1787650000",
        },
      }),
    );
    const client = new GitHubClient({ fetch: fetchMock, token: "secret-token", maxRetries: 0 });

    const result = await client.getIssue(reference);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.github.com/repos/octocat/Hello-World/issues/1347");
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("error");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret-token");
    expect(new Headers(init?.headers).get("x-github-api-version")).toBe("2026-03-10");
    expect(result.data.title).toBe("Found a bug");
    expect(result.data.createdAt).toEqual(new Date("2026-08-01T10:00:00Z"));
    expect(result.quota.remaining).toBe(4999);
    expect(result.requestId).toBe("REQ-1");
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it.each([
    [404, {}, "not_found"],
    [403, {}, "forbidden"],
    [403, { "x-ratelimit-remaining": "0" }, "rate_limited"],
    [429, { "retry-after": "60" }, "rate_limited"],
    [500, {}, "upstream"],
  ])("classifies HTTP %s safely", async (status, headers, expectedKind) => {
    const client = new GitHubClient({
      maxRetries: 0,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status, headers })),
    });

    await expect(client.getIssue(reference)).rejects.toMatchObject({
      name: "GitHubClientError",
      kind: expectedKind,
      status,
    });
  });

  it("rejects a pull request payload returned by the issues endpoint", async () => {
    const payload = { ...issueFixture(), pull_request: { url: "https://api.github.com/pulls/1" } };
    const client = new GitHubClient({
      maxRetries: 0,
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })),
    });

    await expect(client.getIssue(reference)).rejects.toMatchObject({
      kind: "invalid_payload",
    });
  });

  it("rejects malformed upstream JSON without exposing its body", async () => {
    const client = new GitHubClient({
      maxRetries: 0,
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("{token: secret}", { status: 200 })),
    });

    try {
      await client.getIssue(reference);
      throw new Error("Expected request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(GitHubClientError);
      expect(String(error)).not.toContain("secret");
    }
  });

  it("classifies network and timeout failures", async () => {
    const networkClient = new GitHubClient({
      maxRetries: 0,
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError("connection failed")),
    });
    const timeoutClient = new GitHubClient({
      maxRetries: 0,
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new DOMException("deadline", "TimeoutError")),
    });

    await expect(networkClient.getIssue(reference)).rejects.toMatchObject({ kind: "network" });
    await expect(timeoutClient.getIssue(reference)).rejects.toMatchObject({ kind: "timeout" });
  });

  it("bounds pagination and stops after the configured maximum", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify([commentFixture()]), { status: 200 }),
      );
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 0 });

    const result = await client.listIssueComments(reference, { perPage: 1, maxPages: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.github.com/repos/octocat/Hello-World/issues/1347/comments?per_page=1&page=1",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.github.com/repos/octocat/Hello-World/issues/1347/comments?per_page=1&page=2",
    );
    expect(result.data).toHaveLength(2);
  });

  it("clamps perPage to 100 and pagination to five pages", async () => {
    const fullPage = Array.from({ length: 100 }, commentFixture);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify(fullPage), { status: 200 }));
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 0 });

    const result = await client.listIssueComments(reference, { perPage: 1_000, maxPages: 100 });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("?per_page=100&page=1");
    expect(fetchMock.mock.calls[4]?.[0]).toContain("?per_page=100&page=5");
    expect(result.data).toHaveLength(500);
  });

  it("stops pagination when GitHub returns a short page", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 0 });

    await client.listIssueComments(reference, { perPage: 100, maxPages: 5 });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects a malformed comment-page payload", async () => {
    const client = new GitHubClient({
      maxRetries: 0,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 })),
    });

    await expect(client.listIssueComments(reference)).rejects.toMatchObject({
      kind: "invalid_payload",
    });
  });

  it("returns a classified error instead of partial comments when a later page fails", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([commentFixture()]), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "retry-after": "30" } }));
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 0 });

    await expect(
      client.listIssueComments(reference, { perPage: 1, maxPages: 5 }),
    ).rejects.toMatchObject({
      kind: "rate_limited",
      status: 429,
      retryAfterSeconds: 30,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries bounded transient upstream failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(issueFixture()), { status: 200 }));
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 1 });

    await expect(client.getIssue(reference)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
