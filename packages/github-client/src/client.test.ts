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
    html_url:
      "https://github.com/octocat/Hello-World/issues/1347#issuecomment-9",
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
    const client = new GitHubClient({
      fetch: fetchMock,
      token: "secret-token",
      maxRetries: 0,
    });

    const result = await client.getIssue(reference);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://api.github.com/repos/octocat/Hello-World/issues/1347",
    );
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("error");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer secret-token",
    );
    expect(new Headers(init?.headers).get("x-github-api-version")).toBe(
      "2026-03-10",
    );
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
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("{}", { status, headers })),
    });

    await expect(client.getIssue(reference)).rejects.toMatchObject({
      name: "GitHubClientError",
      kind: expectedKind,
      status,
    });
  });

  it("rejects a pull request payload returned by the issues endpoint", async () => {
    const payload = {
      ...issueFixture(),
      pull_request: { url: "https://api.github.com/pulls/1" },
    };
    const client = new GitHubClient({
      maxRetries: 0,
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify(payload), { status: 200 }),
        ),
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
      fetch: vi
        .fn<typeof fetch>()
        .mockRejectedValue(new TypeError("connection failed")),
    });
    const timeoutClient = new GitHubClient({
      maxRetries: 0,
      fetch: vi
        .fn<typeof fetch>()
        .mockRejectedValue(new DOMException("deadline", "TimeoutError")),
    });

    await expect(networkClient.getIssue(reference)).rejects.toMatchObject({
      kind: "network",
    });
    await expect(timeoutClient.getIssue(reference)).rejects.toMatchObject({
      kind: "timeout",
    });
  });

  it("bounds pagination and stops after the configured maximum", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify([commentFixture()]), { status: 200 }),
      );
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 0 });

    const result = await client.listIssueComments(reference, {
      perPage: 1,
      maxPages: 2,
    });

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
      .mockImplementation(
        async () => new Response(JSON.stringify(fullPage), { status: 200 }),
      );
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 0 });

    const result = await client.listIssueComments(reference, {
      perPage: 1_000,
      maxPages: 100,
    });

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
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("{}", { status: 200 })),
    });

    await expect(client.listIssueComments(reference)).rejects.toMatchObject({
      kind: "invalid_payload",
    });
  });

  it("returns a classified error instead of partial comments when a later page fails", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([commentFixture()]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response("{}", { status: 429, headers: { "retry-after": "30" } }),
      );
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
      .mockResolvedValueOnce(
        new Response(JSON.stringify(issueFixture()), { status: 200 }),
      );
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 1 });

    await expect(client.getIssue(reference)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("collects at most 100 recent commits and normalizes nested dates", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            sha: "abc123",
            html_url: "https://github.com/octocat/Hello-World/commit/abc123",
            commit: { committer: { date: "2026-08-20T10:00:00Z" } },
          },
        ]),
        { status: 200 },
      ),
    );
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 0 });

    const result = await client.listRecentCommits(reference, { limit: 1_000 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.github.com/repos/octocat/Hello-World/commits?per_page=100",
    );
    expect(result.data).toEqual([
      {
        sha: "abc123",
        htmlUrl: "https://github.com/octocat/Hello-World/commit/abc123",
        committedAt: new Date("2026-08-20T10:00:00Z"),
      },
    ]);
  });

  it("collects at most 20 recent releases", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 7,
            tag_name: "v1.0.0",
            html_url:
              "https://github.com/octocat/Hello-World/releases/tag/v1.0.0",
            published_at: "2026-08-19T10:00:00Z",
          },
        ]),
        { status: 200 },
      ),
    );
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 0 });

    const result = await client.listRecentReleases(reference, { limit: 200 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.github.com/repos/octocat/Hello-World/releases?per_page=20",
    );
    expect(result.data[0]?.publishedAt).toEqual(
      new Date("2026-08-19T10:00:00Z"),
    );
  });

  it("normalizes repository community readiness without retaining upstream objects", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          health_percentage: 75,
          files: {
            contributing: {
              html_url: "https://github.com/example/contributing",
            },
            code_of_conduct: null,
            issue_template: { html_url: "https://github.com/example/issues" },
            pull_request_template: null,
          },
        }),
        { status: 200 },
      ),
    );
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 0 });

    const result = await client.getCommunityProfile(reference);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.github.com/repos/octocat/Hello-World/community/profile",
    );
    expect(result.data).toEqual({
      healthPercentage: 75,
      sourceUrl: "https://github.com/octocat/Hello-World/community",
      contributingGuide: true,
      codeOfConduct: false,
      issueTemplate: true,
      pullRequestTemplate: false,
    });
  });

  it.each([
    [
      "commits",
      () =>
        new GitHubClient({
          maxRetries: 0,
          fetch: vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
              JSON.stringify([
                { sha: "abc", html_url: "https://github.com/x", commit: {} },
              ]),
              {
                status: 200,
              },
            ),
          ),
        }).listRecentCommits(reference),
    ],
    [
      "releases",
      () =>
        new GitHubClient({
          maxRetries: 0,
          fetch: vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
              JSON.stringify([
                {
                  id: 1,
                  tag_name: "v1",
                  html_url: "https://github.com/x",
                  published_at: null,
                },
              ]),
              {
                status: 200,
              },
            ),
          ),
        }).listRecentReleases(reference),
    ],
    [
      "community profile",
      () =>
        new GitHubClient({
          maxRetries: 0,
          fetch: vi
            .fn<typeof fetch>()
            .mockResolvedValue(
              new Response(
                JSON.stringify({ health_percentage: 101, files: {} }),
                { status: 200 },
              ),
            ),
        }).getCommunityProfile(reference),
    ],
  ])("rejects malformed %s evidence", async (_name, request) => {
    await expect(request()).rejects.toMatchObject({ kind: "invalid_payload" });
  });

  it("bounds issue timeline pagination to three pages", async () => {
    const page = Array.from({ length: 100 }, (_, index) => ({
      node_id: `event-${index}`,
      event: "commented",
      actor: null,
      created_at: "2026-08-21T10:00:00Z",
    }));
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify(page), { status: 200 }),
      );
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 0 });

    const result = await client.listIssueTimeline(reference, {
      perPage: 1_000,
      maxPages: 50,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/timeline?per_page=100&page=1",
    );
    expect(fetchMock.mock.calls[2]?.[0]).toContain(
      "/timeline?per_page=100&page=3",
    );
    expect(result.data).toHaveLength(300);
    expect(result.data[0]).toMatchObject({
      event: "commented",
      actor: null,
      sourceUrl: reference.canonicalUrl,
      createdAt: new Date("2026-08-21T10:00:00Z"),
    });
  });

  it("collects at most 100 recently updated pull requests", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 11,
            number: 42,
            title: "Fix the bug",
            body: null,
            state: "open",
            draft: false,
            user: {
              login: "contributor",
              html_url: "https://github.com/contributor",
            },
            created_at: "2026-08-20T10:00:00Z",
            updated_at: "2026-08-21T10:00:00Z",
            closed_at: null,
            merged_at: null,
            html_url: "https://github.com/octocat/Hello-World/pull/42",
          },
        ]),
        { status: 200 },
      ),
    );
    const client = new GitHubClient({ fetch: fetchMock, maxRetries: 0 });

    const result = await client.listRecentPullRequests(reference, {
      limit: 2_000,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.github.com/repos/octocat/Hello-World/pulls?state=all&sort=updated&direction=desc&per_page=100",
    );
    expect(result.data[0]).toMatchObject({
      number: 42,
      state: "open",
      draft: false,
      author: { login: "contributor" },
    });
  });

  it("rejects malformed timeline and pull request evidence", async () => {
    const timelineClient = new GitHubClient({
      maxRetries: 0,
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify([{ event: "closed" }]), { status: 200 }),
        ),
    });
    const pullsClient = new GitHubClient({
      maxRetries: 0,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: 1,
              number: 2,
              title: "Bad state",
              body: null,
              state: "unknown",
              draft: false,
              user: { login: "x", html_url: "https://github.com/x" },
              created_at: "2026-08-20T10:00:00Z",
              updated_at: "2026-08-20T10:00:00Z",
              closed_at: null,
              merged_at: null,
              html_url: "https://github.com/octocat/Hello-World/pull/2",
            },
          ]),
          { status: 200 },
        ),
      ),
    });

    await expect(
      timelineClient.listIssueTimeline(reference),
    ).rejects.toMatchObject({
      kind: "invalid_payload",
    });
    await expect(
      pullsClient.listRecentPullRequests(reference),
    ).rejects.toMatchObject({
      kind: "invalid_payload",
    });
  });
});
