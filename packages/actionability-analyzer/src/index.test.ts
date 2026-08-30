import { describe, expect, it } from "vitest";

import { analyzeIssueActionability, type ActionabilityInput } from "./index.js";

const asOf = new Date("2026-08-27T00:00:00.000Z");
const issueUrl = "https://github.com/example/project/issues/42";

function input(overrides: Partial<ActionabilityInput["issue"]> = {}): ActionabilityInput {
  return {
    asOf,
    issue: {
      title: "Fix parser behavior for empty input",
      body: "Steps to reproduce: call `parseInput`. Expected behavior: return an empty result.",
      labels: ["bug", "good first issue"],
      canonicalUrl: issueUrl,
      ...overrides,
    },
  };
}

describe("analyzeIssueActionability", () => {
  it("classifies a concrete coding task as highly actionable", () => {
    const result = analyzeIssueActionability(input());
    expect(result.status).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.confidence.level).toBe("high");
  });

  it("classifies an unresolved policy discussion as low actionability", () => {
    const result = analyzeIssueActionability(
      input({
        title: 'Improve how we handle active "good first issue" issues',
        labels: ["meta", "discuss"],
        body: `### Potential improvements
There are several approaches worth considering. I'd be happy to hear other approaches though.
#### 1. Use a different label
#### 2. Remove the label when a PR exists
#### 3. Create a claim system`,
      }),
    );
    expect(result.status).toBe("low");
    expect(result.confidence.level).toBe("high");
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "actionability.alternativeCount", value: 3 }),
    );
  });

  it("does not permanently block a discussion after an accepted direction", () => {
    const result = analyzeIssueActionability(
      input({
        title: "Meta: select parser behavior",
        labels: ["meta", "discuss"],
        body: `We have decided to use the strict parser. Please implement the accepted approach in
        \`parseInput\`. Expected behavior: invalid input returns a typed error.`,
      }),
    );
    expect(result.status).not.toBe("low");
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "actionability.acceptedDirection", value: true }),
    );
  });

  it("does not mistake numbered implementation instructions for unresolved alternatives", () => {
    const result = analyzeIssueActionability(
      input({
        body: `Follow these steps:
1. Open the parser module.
2. Add a failing test.
3. Implement the missing handler.`,
      }),
    );
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "actionability.alternativeCount", value: 0 }),
    );
  });

  it("treats umbrella scope as a low-actionability tracker", () => {
    const result = analyzeIssueActionability(
      input({
        body: "This is really many issues bundled together. Implement one missing handler.",
      }),
    );
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "actionability.trackingIssue", value: true }),
    );
    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.status).toBe("low");
  });

  it("detects a Renovate dependency dashboard even when optimistic labels are present", () => {
    const result = analyzeIssueActionability(
      input({
        title: "Dependency Dashboard",
        labels: ["good first issue", "automated", "bot", "renovate", "dependencies"],
        body: `This issue lists Renovate updates and detected dependencies.
- [ ] chore(deps): update node
- [ ] Check this box to trigger a request for Renovate to run again`,
      }),
    );
    expect(result.status).toBe("low");
    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "actionability.automatedIssue", value: true }),
    );
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "actionability.automatedOrTracking", value: true }),
    );
  });

  it("detects roadmap trackers as non-task issues", () => {
    const result = analyzeIssueActionability(
      input({
        title: "Public Roadmap",
        labels: [],
        body: "This is a tracking issue for navigating the living public roadmap.",
      }),
    );
    expect(result.status).toBe("low");
    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "actionability.trackingIssue", value: true }),
    );
  });

  it("downgrades a proposal-style issue without acceptance or reproduction evidence", () => {
    const result = analyzeIssueActionability(
      input({
        title: "Introduce multi-tier difficulty labels to improve newcomer onboarding",
        labels: [],
        body: `## Motivation
The current labels could improve newcomer onboarding.

## Proposal
Introduce multiple difficulty tiers so maintainers can classify issues more precisely.

## Why this is feasible
The repository already uses labels for triage.`,
      }),
    );
    expect(result.status).toBe("medium");
    expect(result.score).toBeLessThan(70);
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "actionability.proposalStyle", value: true }),
    );
    expect(result.warnings).toContain(
      "The issue reads like a proposal or coordination item without concrete acceptance or reproduction evidence.",
    );
  });

  it("keeps implementation-ready proposals strong once direction is accepted", () => {
    const result = analyzeIssueActionability(
      input({
        title: "Proposal: strict parser mode",
        labels: ["enhancement"],
        body: `We have decided to add strict parser mode. Please implement it in \`parseInput\`.
Expected behavior: invalid input returns a typed error.`,
      }),
    );
    expect(result.status).toBe("high");
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "actionability.proposalStyle", value: false }),
    );
  });

  it("lowers confidence instead of inventing clarity when the body is unavailable", () => {
    const result = analyzeIssueActionability(input({ body: null, labels: [] }));
    expect(result.confidence.level).toBe("low");
    expect(result.warnings).toContain(
      "Issue description is unavailable, so actionability is uncertain.",
    );
  });

  it("is deterministic and preserves provenance", () => {
    const source = input();
    expect(analyzeIssueActionability(source)).toEqual(analyzeIssueActionability(source));
    expect(
      analyzeIssueActionability(source).facts.every((fact) => fact.sourceUrl === issueUrl),
    ).toBe(true);
  });
});
