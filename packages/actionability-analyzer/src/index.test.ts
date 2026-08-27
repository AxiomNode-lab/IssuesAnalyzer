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

  it("records umbrella scope as a negative fact without making it an absolute rule", () => {
    const result = analyzeIssueActionability(
      input({
        body: "This is really many issues bundled together. Implement one missing handler.",
      }),
    );
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "actionability.trackingIssue", value: true }),
    );
    expect(result.score).toBeGreaterThan(0);
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
