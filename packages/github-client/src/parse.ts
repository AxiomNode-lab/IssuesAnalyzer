import { GitHubClientError } from "./errors";
import type { GitHubActor, GitHubIssue, GitHubIssueComment, GitHubRepository } from "./types";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new GitHubClientError("invalid_payload", "GitHub returned an invalid object.");
  }
  return value as JsonObject;
}

function string(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new GitHubClientError("invalid_payload", `GitHub returned an invalid ${field}.`);
  }
  return value;
}

function number(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new GitHubClientError("invalid_payload", `GitHub returned an invalid ${field}.`);
  }
  return value;
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new GitHubClientError("invalid_payload", `GitHub returned an invalid ${field}.`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  return value === null ? null : string(value, field);
}

function date(value: unknown, field: string): Date {
  const parsed = new Date(string(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new GitHubClientError("invalid_payload", `GitHub returned an invalid ${field}.`);
  }
  return parsed;
}

function nullableDate(value: unknown, field: string): Date | null {
  return value === null ? null : date(value, field);
}

function actor(value: unknown): GitHubActor {
  const source = object(value);
  return {
    login: string(source.login, "actor login"),
    profileUrl: string(source.html_url, "actor profile URL"),
  };
}

export function parseIssue(value: unknown): GitHubIssue {
  const source = object(value);
  if ("pull_request" in source) {
    throw new GitHubClientError(
      "invalid_payload",
      "Expected an issue but GitHub returned a pull request.",
    );
  }

  const state = string(source.state, "issue state");
  if (state !== "open" && state !== "closed") {
    throw new GitHubClientError("invalid_payload", "GitHub returned an invalid issue state.");
  }

  if (!Array.isArray(source.labels) || !Array.isArray(source.assignees)) {
    throw new GitHubClientError("invalid_payload", "GitHub returned invalid issue collections.");
  }

  return {
    id: number(source.id, "issue id"),
    number: number(source.number, "issue number"),
    title: string(source.title, "issue title"),
    body: nullableString(source.body, "issue body"),
    state,
    locked: boolean(source.locked, "locked state"),
    comments: number(source.comments, "comment count"),
    author: actor(source.user),
    labels: source.labels.map((label) => string(object(label).name, "label name")),
    assignees: source.assignees.map(actor),
    createdAt: date(source.created_at, "created date"),
    updatedAt: date(source.updated_at, "updated date"),
    closedAt: nullableDate(source.closed_at, "closed date"),
    htmlUrl: string(source.html_url, "issue URL"),
  };
}

export function parseIssueComment(value: unknown): GitHubIssueComment {
  const source = object(value);
  return {
    id: number(source.id, "comment id"),
    body: nullableString(source.body, "comment body"),
    author: actor(source.user),
    createdAt: date(source.created_at, "created date"),
    updatedAt: date(source.updated_at, "updated date"),
    htmlUrl: string(source.html_url, "comment URL"),
  };
}

export function parseIssueCommentPage(value: unknown): readonly GitHubIssueComment[] {
  if (!Array.isArray(value)) {
    throw new GitHubClientError("invalid_payload", "GitHub returned an invalid comment page.");
  }
  return value.map(parseIssueComment);
}

export function parseRepository(value: unknown): GitHubRepository {
  const source = object(value);
  return {
    id: number(source.id, "repository id"),
    fullName: string(source.full_name, "repository name"),
    htmlUrl: string(source.html_url, "repository URL"),
    description: nullableString(source.description, "repository description"),
    archived: boolean(source.archived, "archived state"),
    disabled: boolean(source.disabled, "disabled state"),
    fork: boolean(source.fork, "fork state"),
    defaultBranch: string(source.default_branch, "default branch"),
    stars: number(source.stargazers_count, "star count"),
    forks: number(source.forks_count, "fork count"),
    openIssues: number(source.open_issues_count, "open issue count"),
    createdAt: date(source.created_at, "created date"),
    updatedAt: date(source.updated_at, "updated date"),
    pushedAt: nullableDate(source.pushed_at, "pushed date"),
  };
}
