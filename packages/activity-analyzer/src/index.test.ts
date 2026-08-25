import { describe, expect, it } from "vitest";

import {
  analyzeRepositoryActivity,
  type RepositoryActivityInput,
  type TimestampEvidence,
} from "./index";

const asOf = new Date("2026-08-25T00:00:00.000Z");
const source = "https://github.com/example/project";
const evidence = (date: string, suffix = "commit"): TimestampEvidence => ({
  occurredAt: new Date(date),
  sourceUrl: `${source}/${suffix}`,
});

function input(overrides: Partial<RepositoryActivityInput> = {}): RepositoryActivityInput {
  return {
    asOf,
    repository: {
      htmlUrl: source,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      pushedAt: new Date("2026-08-20T00:00:00.000Z"),
      archived: false,
      disabled: false,
    },
    commits: [evidence("2026-08-20T00:00:00.000Z")],
    releases: [evidence("2026-08-01T00:00:00.000Z", "release")],
    readiness: {
      contributingGuide: true,
      codeOfConduct: true,
      issueTemplates: true,
      sourceUrl: `${source}/community`,
    },
    ...overrides,
  };
}

describe("analyzeRepositoryActivity", () => {
  it("classifies a recently active and contribution-ready repository", () => {
    const result = analyzeRepositoryActivity(input());
    expect(result.status).toBe("active");
    expect(result.score).toBe(100);
    expect(result.confidence).toEqual({ level: "high", value: 100 });
    expect(result.version).toBe("activity-v1");
  });

  it("classifies a quiet repository without treating it as archived", () => {
    const result = analyzeRepositoryActivity(
      input({
        repository: {
          htmlUrl: source,
          createdAt: new Date("2020-01-01T00:00:00.000Z"),
          pushedAt: new Date("2025-01-01T00:00:00.000Z"),
          archived: false,
          disabled: false,
        },
        commits: [evidence("2025-01-01T00:00:00.000Z")],
        releases: [],
        readiness: {
          contributingGuide: false,
          codeOfConduct: false,
          issueTemplates: false,
          sourceUrl: `${source}/community`,
        },
      }),
    );
    expect(result.status).toBe("quiet");
    expect(result.score).toBeLessThan(50);
  });

  it("classifies a young sparse repository as new", () => {
    const result = analyzeRepositoryActivity(
      input({
        repository: {
          htmlUrl: source,
          createdAt: new Date("2026-08-10T00:00:00.000Z"),
          pushedAt: new Date("2026-08-10T00:00:00.000Z"),
          archived: false,
          disabled: false,
        },
        commits: [evidence("2026-08-10T00:00:00.000Z")],
        releases: [],
      }),
    );
    expect(result.status).toBe("new");
  });

  it("makes archived status decisive", () => {
    const result = analyzeRepositoryActivity(
      input({ repository: { ...input().repository, archived: true } }),
    );
    expect(result.status).toBe("archived");
    expect(result.score).toBe(0);
  });

  it("lowers confidence for missing evidence instead of converting it to zero", () => {
    const result = analyzeRepositoryActivity(
      input({ commits: null, releases: null, readiness: null }),
    );
    expect(result.confidence).toEqual({ level: "low", value: 25 });
    expect(result.score).toBeGreaterThan(0);
    expect(result.warnings).toHaveLength(3);
  });

  it("bounds commit and release evidence windows", () => {
    const commits = Array.from({ length: 120 }, (_, index) =>
      evidence("2026-08-20T00:00:00.000Z", `commit/${index}`),
    );
    const releases = Array.from({ length: 30 }, (_, index) =>
      evidence("2026-08-01T00:00:00.000Z", `release/${index}`),
    );
    const result = analyzeRepositoryActivity(input({ commits, releases }));
    expect(result.evidenceWindow).toEqual({ commitsUsed: 100, releasesUsed: 20 });
    expect(result.warnings).toContain("Commit evidence was bounded to 100 records.");
    expect(result.warnings).toContain("Release evidence was bounded to 20 records.");
  });

  it("is deterministic for the same explicit evidence and asOf timestamp", () => {
    expect(analyzeRepositoryActivity(input())).toEqual(analyzeRepositoryActivity(input()));
  });
});
