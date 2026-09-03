const OWNER_PATTERN = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;
const REPOSITORY_PATTERN = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;
const ISSUE_NUMBER_PATTERN = /^[1-9]\d*$/;

export type GitHubIssueUrl = Readonly<{
  owner: string;
  repository: string;
  issueNumber: number;
  canonicalUrl: string;
}>;

export type GitHubIssueUrlErrorCode =
  | "EMPTY"
  | "MALFORMED_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "UNSUPPORTED_HOST"
  | "CREDENTIALS_NOT_ALLOWED"
  | "PORT_NOT_ALLOWED"
  | "QUERY_NOT_ALLOWED"
  | "FRAGMENT_NOT_ALLOWED"
  | "UNSUPPORTED_PATH"
  | "INVALID_OWNER"
  | "INVALID_REPOSITORY"
  | "INVALID_ISSUE_NUMBER";

export type GitHubIssueUrlError = Readonly<{
  code: GitHubIssueUrlErrorCode;
  message: string;
}>;

export type GitHubIssueUrlResult =
  | Readonly<{ ok: true; value: GitHubIssueUrl }>
  | Readonly<{ ok: false; error: GitHubIssueUrlError }>;

function failure(code: GitHubIssueUrlErrorCode, message: string): GitHubIssueUrlResult {
  return { ok: false, error: { code, message } };
}

export function parseGitHubIssueUrl(input: string): GitHubIssueUrlResult {
  if (input.length > 2_048) {
    return failure("MALFORMED_URL", "The GitHub issue URL is too long.");
  }
  if (/[\\\u0000-\u001F\u007F]/.test(input)) {
    return failure("MALFORMED_URL", "Control characters and backslashes are not allowed.");
  }

  const candidate = input.trim();

  if (candidate.length === 0) {
    return failure("EMPTY", "Enter a GitHub issue URL.");
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return failure("MALFORMED_URL", "Enter a complete, valid URL.");
  }

  if (url.protocol !== "https:") {
    return failure("UNSUPPORTED_PROTOCOL", "The URL must use HTTPS.");
  }

  if (url.hostname.toLowerCase() !== "github.com") {
    return failure("UNSUPPORTED_HOST", "Only github.com issue URLs are supported.");
  }

  if (url.username !== "" || url.password !== "") {
    return failure("CREDENTIALS_NOT_ALLOWED", "Credentials are not allowed in the URL.");
  }

  const authority = candidate.match(/^https:\/\/([^/?#]*)/i)?.[1] ?? "";
  const hostWithPort = authority.slice(authority.lastIndexOf("@") + 1);
  if (url.port !== "" || hostWithPort.toLowerCase() !== "github.com") {
    return failure("PORT_NOT_ALLOWED", "Explicit ports are not allowed.");
  }

  if (url.search !== "") {
    return failure("QUERY_NOT_ALLOWED", "Query parameters are not allowed.");
  }

  if (url.hash !== "") {
    return failure("FRAGMENT_NOT_ALLOWED", "URL fragments are not allowed.");
  }

  if (/%[0-9a-f]{2}/i.test(url.pathname) || url.pathname.includes("\\")) {
    return failure("UNSUPPORTED_PATH", "Encoded or ambiguous path characters are not allowed.");
  }

  const pathMatch = /^\/([^/]+)\/([^/]+)\/issues\/([^/]+)\/?$/.exec(url.pathname);
  if (pathMatch === null) {
    return failure(
      "UNSUPPORTED_PATH",
      "Use the format https://github.com/owner/repository/issues/123.",
    );
  }

  const [, owner, repository, issueNumberText] = pathMatch;

  if (owner === undefined || !OWNER_PATTERN.test(owner)) {
    return failure("INVALID_OWNER", "The GitHub owner name is invalid.");
  }

  if (repository === undefined || !REPOSITORY_PATTERN.test(repository)) {
    return failure("INVALID_REPOSITORY", "The GitHub repository name is invalid.");
  }

  if (issueNumberText === undefined || !ISSUE_NUMBER_PATTERN.test(issueNumberText)) {
    return failure("INVALID_ISSUE_NUMBER", "The issue number must be a positive integer.");
  }

  const issueNumber = Number(issueNumberText);
  if (!Number.isSafeInteger(issueNumber)) {
    return failure("INVALID_ISSUE_NUMBER", "The issue number is outside the supported range.");
  }

  return {
    ok: true,
    value: {
      owner,
      repository,
      issueNumber,
      canonicalUrl: `https://github.com/${owner}/${repository}/issues/${issueNumber}`,
    },
  };
}
