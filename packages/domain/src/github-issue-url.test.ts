import { describe, expect, it } from "vitest";

import { parseGitHubIssueUrl } from "./github-issue-url";

describe("parseGitHubIssueUrl", () => {
  it("returns canonical identifiers for a valid public issue URL", () => {
    expect(
      parseGitHubIssueUrl("https://github.com/GittieLabs/hardware-agent-studio/issues/247"),
    ).toEqual({
      ok: true,
      value: {
        owner: "GittieLabs",
        repository: "hardware-agent-studio",
        issueNumber: 247,
        canonicalUrl: "https://github.com/GittieLabs/hardware-agent-studio/issues/247",
      },
    });
  });

  it("trims surrounding whitespace and removes a trailing slash", () => {
    expect(parseGitHubIssueUrl("  https://github.com/openai/openai/issues/1/  ")).toEqual({
      ok: true,
      value: {
        owner: "openai",
        repository: "openai",
        issueNumber: 1,
        canonicalUrl: "https://github.com/openai/openai/issues/1",
      },
    });
  });

  it.each([
    ["", "EMPTY"],
    ["github.com/owner/repository/issues/1", "MALFORMED_URL"],
    ["http://github.com/owner/repository/issues/1", "UNSUPPORTED_PROTOCOL"],
    ["https://github.com.evil.test/owner/repository/issues/1", "UNSUPPORTED_HOST"],
    ["https://evil.test/github.com/owner/repository/issues/1", "UNSUPPORTED_HOST"],
    ["https://127.0.0.1/owner/repository/issues/1", "UNSUPPORTED_HOST"],
    ["https://[::1]/owner/repository/issues/1", "UNSUPPORTED_HOST"],
    ["https://user:secret@github.com/owner/repository/issues/1", "CREDENTIALS_NOT_ALLOWED"],
    ["https://github.com:443/owner/repository/issues/1", "PORT_NOT_ALLOWED"],
    ["https://github.com/owner/repository/issues/1?redirect=http://127.0.0.1", "QUERY_NOT_ALLOWED"],
    ["https://github.com/owner/repository/issues/1#comment", "FRAGMENT_NOT_ALLOWED"],
    ["https://github.com/owner/repository/pull/1", "UNSUPPORTED_PATH"],
    ["https://github.com/owner/repository/issues", "UNSUPPORTED_PATH"],
    ["https://github.com/owner/repository/issues/1/extra", "UNSUPPORTED_PATH"],
    ["https://github.com/owner%2Frepository/issues/1", "UNSUPPORTED_PATH"],
    ["https://github.com/-owner/repository/issues/1", "INVALID_OWNER"],
    ["https://github.com/owner-/repository/issues/1", "INVALID_OWNER"],
    ["https://github.com/owner/repository/issues/0", "INVALID_ISSUE_NUMBER"],
    ["https://github.com/owner/repository/issues/-1", "INVALID_ISSUE_NUMBER"],
    ["https://github.com/owner/repository/issues/1.5", "INVALID_ISSUE_NUMBER"],
    ["https://github.com/owner/repository/issues/9007199254740992", "INVALID_ISSUE_NUMBER"],
  ])("rejects %s with %s", (input, expectedCode) => {
    const result = parseGitHubIssueUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(expectedCode);
  });

  it("preserves the canonicalization property across many valid identifiers", () => {
    const owners = ["a", "OpenAI", "owner-123", "A".repeat(39)];
    const repositories = ["r", "repo.js", "hardware_agent-studio", "z".repeat(100)];
    const issueNumbers = [1, 2, 247, 999_999, Number.MAX_SAFE_INTEGER];

    for (const owner of owners) {
      for (const repository of repositories) {
        for (const issueNumber of issueNumbers) {
          const result = parseGitHubIssueUrl(
            `https://GITHUB.com/${owner}/${repository}/issues/${issueNumber}/`,
          );

          expect(result).toEqual({
            ok: true,
            value: {
              owner,
              repository,
              issueNumber,
              canonicalUrl: `https://github.com/${owner}/${repository}/issues/${issueNumber}`,
            },
          });
        }
      }
    }
  });

  it("rejects every generated lookalike host", () => {
    for (const prefix of ["api", "www", "github", "safe"]) {
      for (const suffix of [".evil.test", ".localhost", ".example.com"]) {
        const result = parseGitHubIssueUrl(
          `https://${prefix}.github.com${suffix}/owner/repository/issues/1`,
        );

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe("UNSUPPORTED_HOST");
      }
    }
  });
});
