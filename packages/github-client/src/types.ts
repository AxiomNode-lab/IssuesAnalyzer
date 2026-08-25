export type GitHubQuota = Readonly<{
  limit: number | null;
  remaining: number | null;
  used: number | null;
  resetAt: Date | null;
}>;

export type GitHubActor = Readonly<{
  login: string;
  profileUrl: string;
}>;

export type GitHubIssue = Readonly<{
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  locked: boolean;
  comments: number;
  author: GitHubActor;
  labels: readonly string[];
  assignees: readonly GitHubActor[];
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  htmlUrl: string;
}>;

export type GitHubIssueComment = Readonly<{
  id: number;
  body: string | null;
  author: GitHubActor;
  createdAt: Date;
  updatedAt: Date;
  htmlUrl: string;
}>;

export type GitHubRepository = Readonly<{
  id: number;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  archived: boolean;
  disabled: boolean;
  fork: boolean;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  createdAt: Date;
  updatedAt: Date;
  pushedAt: Date | null;
}>;

export type GitHubResponse<T> = Readonly<{
  data: T;
  quota: GitHubQuota;
  requestId: string | null;
}>;
