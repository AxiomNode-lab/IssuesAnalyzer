import { GitHubClientError } from "./errors";
import type {
  GitHubActor,
  GitHubCommitEvidence,
  GitHubCommunityProfile,
  GitHubIssue,
  GitHubIssueComment,
  GitHubIssueEvent,
  GitHubPullRequestEvidence,
  GitHubReleaseEvidence,
  GitHubRepository,
} from "./types";

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

function percentage(value: unknown, field: string): number {
  const parsed = number(value, field);
  if (parsed > 100) {
    throw new GitHubClientError("invalid_payload", `GitHub returned an invalid ${field}.`);
  }
  return parsed;
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

function nullableActor(value: unknown): GitHubActor | null {
  return value === null ? null : actor(value);
}

function filePresent(value: unknown, field: string): boolean {
  if (value === null) return false;
  object(value);
  return true;
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

export function parseCommitPage(value: unknown): readonly GitHubCommitEvidence[] {
  if (!Array.isArray(value)) {
    throw new GitHubClientError("invalid_payload", "GitHub returned an invalid commit page.");
  }

  return value.map((entry) => {
    const source = object(entry);
    const commit = object(source.commit);
    const committer = object(commit.committer);
    return {
      sha: string(source.sha, "commit SHA"),
      htmlUrl: string(source.html_url, "commit URL"),
      committedAt: date(committer.date, "commit date"),
    };
  });
}

export function parseReleasePage(value: unknown): readonly GitHubReleaseEvidence[] {
  if (!Array.isArray(value)) {
    throw new GitHubClientError("invalid_payload", "GitHub returned an invalid release page.");
  }

  return value.map((entry) => {
    const source = object(entry);
    return {
      id: number(source.id, "release id"),
      tagName: string(source.tag_name, "release tag"),
      htmlUrl: string(source.html_url, "release URL"),
      publishedAt: date(source.published_at, "release published date"),
    };
  });
}

export function parseCommunityProfile(
  value: unknown,
  sourceUrl: string,
): GitHubCommunityProfile {
  const source = object(value);
  const files = object(source.files);
  return {
    healthPercentage: percentage(source.health_percentage, "community health percentage"),
    sourceUrl,
    contributingGuide: filePresent(files.contributing, "contributing guide"),
    codeOfConduct: filePresent(files.code_of_conduct, "code of conduct"),
    issueTemplate: filePresent(files.issue_template, "issue template"),
    pullRequestTemplate: filePresent(files.pull_request_template, "pull request template"),
  };
}

export function parseIssueEventPage(
  value: unknown,
  sourceUrl: string,
): readonly GitHubIssueEvent[] {
  if (!Array.isArray(value)) {
    throw new GitHubClientError("invalid_payload", "GitHub returned an invalid timeline page.");
  }

  return value.map((entry) => {
    const source = object(entry);
    return {
      nodeId: string(source.node_id, "timeline node id"),
      event: string(source.event, "timeline event"),
      actor: nullableActor(source.actor),
      createdAt: date(source.created_at, "timeline event date"),
      sourceUrl,
    };
  });
}

export function parsePullRequestPage(value: unknown): readonly GitHubPullRequestEvidence[] {
  if (!Array.isArray(value)) {
    throw new GitHubClientError("invalid_payload", "GitHub returned an invalid pull request page.");
  }

  return value.map((entry) => {
    const source = object(entry);
    const state = string(source.state, "pull request state");
    if (state !== "open" && state !== "closed") {
      throw new GitHubClientError(
        "invalid_payload",
        "GitHub returned an invalid pull request state.",
      );
    }

    return {
      id: number(source.id, "pull request id"),
      number: number(source.number, "pull request number"),
      title: string(source.title, "pull request title"),
      body: nullableString(source.body, "pull request body"),
      state,
      draft: boolean(source.draft, "pull request draft state"),
      author: actor(source.user),
      createdAt: date(source.created_at, "pull request created date"),
      updatedAt: date(source.updated_at, "pull request updated date"),
      closedAt: nullableDate(source.closed_at, "pull request closed date"),
      mergedAt: nullableDate(source.merged_at, "pull request merged date"),
      htmlUrl: string(source.html_url, "pull request URL"),
    };
  });
}
