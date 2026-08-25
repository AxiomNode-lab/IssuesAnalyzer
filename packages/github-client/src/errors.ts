export type GitHubClientErrorKind =
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "network"
  | "invalid_payload"
  | "upstream";

export class GitHubClientError extends Error {
  readonly kind: GitHubClientErrorKind;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;
  readonly requestId: string | null;

  constructor(
    kind: GitHubClientErrorKind,
    message: string,
    options: {
      status?: number | undefined;
      retryAfterSeconds?: number | undefined;
      requestId?: string | undefined;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "GitHubClientError";
    this.kind = kind;
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.requestId = options.requestId ?? null;
  }
}
