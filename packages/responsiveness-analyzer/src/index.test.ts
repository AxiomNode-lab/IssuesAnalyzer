import { describe, expect, it } from "vitest";

import {
  analyzeMaintainerResponsiveness,
  type InteractionEvidence,
  type ResponsivenessInput,
  type ThreadEvidence,
} from "./index";

const asOf = new Date("2026-08-26T00:00:00.000Z");
const repositoryUrl = "https://github.com/example/project";

function interaction(
  hoursAfterOpen: number,
  overrides: Partial<InteractionEvidence> = {},
): InteractionEvidence {
  return {
    actorLogin: "maintainer",
    actorIsBot: false,
    actorIsMaintainer: true,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    sourceUrl: `${repositoryUrl}/issues/1#comment`,
    ...overrides,
  };
}

function thread(
  responseHours: number | null,
  index = 1,
  extraInteractions: readonly InteractionEvidence[] = [],
): ThreadEvidence {
  const openedAt = new Date(`2026-08-${String(index).padStart(2, "0")}T00:00:00.000Z`);
  const response =
    responseHours === null
      ? []
      : [
          interaction(responseHours, {
            createdAt: new Date(openedAt.getTime() + responseHours * 3_600_000),
            sourceUrl: `${repositoryUrl}/issues/${index}#maintainer-response`,
          }),
        ];
  return {
    kind: index % 2 === 0 ? "pull_request" : "issue",
    openedAt,
    sourceUrl: `${repositoryUrl}/issues/${index}`,
    interactions: [...extraInteractions, ...response],
  };
}

function input(overrides: Partial<ResponsivenessInput> = {}): ResponsivenessInput {
  return {
    asOf,
    repositoryUrl,
    threads: [thread(12, 1), thread(24, 2), thread(36, 3)],
    ...overrides,
  };
}

describe("analyzeMaintainerResponsiveness", () => {
  it("classifies a responsive historical median", () => {
    const result = analyzeMaintainerResponsiveness(input());
    expect(result.status).toBe("responsive");
    expect(result.score).toBe(85);
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "responsiveness.observedMedianHours", value: 24 }),
    );
    expect(result.sample.respondedThreads).toBe(3);
  });

  it("uses the median so an extreme delay does not dominate", () => {
    const result = analyzeMaintainerResponsiveness(
      input({ threads: [thread(1, 1), thread(2, 2), thread(1_000, 3)] }),
    );
    expect(result.status).toBe("responsive");
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "responsiveness.observedMedianHours", value: 2 }),
    );
  });

  it("classifies mixed and slow historical patterns", () => {
    expect(
      analyzeMaintainerResponsiveness(
        input({ threads: [thread(72, 1), thread(96, 2), thread(120, 3)] }),
      ).status,
    ).toBe("mixed");
    expect(
      analyzeMaintainerResponsiveness(
        input({ threads: [thread(200, 1), thread(240, 2), thread(300, 3)] }),
      ).status,
    ).toBe("slow");
  });

  it("ignores bot and non-maintainer interactions", () => {
    const openedAt = new Date("2026-08-01T00:00:00.000Z");
    const ignored = [
      interaction(1, {
        actorLogin: "automation[bot]",
        actorIsBot: true,
        createdAt: new Date(openedAt.getTime() + 3_600_000),
      }),
      interaction(2, {
        actorLogin: "contributor",
        actorIsMaintainer: false,
        createdAt: new Date(openedAt.getTime() + 7_200_000),
      }),
    ];
    const result = analyzeMaintainerResponsiveness(
      input({
        threads: [thread(12, 1, ignored), thread(24, 2, ignored), thread(36, 3, ignored)],
      }),
    );
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "responsiveness.observedMedianHours", value: 24 }),
    );
  });

  it("reports insufficient evidence for sparse samples", () => {
    const result = analyzeMaintainerResponsiveness(input({ threads: [thread(4, 1)] }));
    expect(result.status).toBe("insufficient");
    expect(result.inferences).toHaveLength(0);
    expect(result.warnings).toContain(
      "The historical sample is too small for a responsiveness classification.",
    );
  });

  it("handles unanswered and missing samples without converting them to fast responses", () => {
    const unanswered = analyzeMaintainerResponsiveness(
      input({ threads: [thread(null, 1), thread(null, 2), thread(null, 3)] }),
    );
    expect(unanswered.status).toBe("insufficient");
    expect(unanswered.sample.unansweredThreads).toBe(3);

    const missing = analyzeMaintainerResponsiveness(input({ threads: null }));
    expect(missing.status).toBe("insufficient");
    expect(missing.confidence).toEqual({ level: "low", value: 0 });
    expect(missing.warnings).toContain("Historical responsiveness evidence is unavailable.");
  });

  it("never presents historical observations as a reply guarantee", () => {
    const result = analyzeMaintainerResponsiveness(input());
    expect(result.inferences[0]?.caution).toContain("does not predict");
    expect(result.inferences[0]?.caution).toContain("guarantee");
  });

  it("bounds threads and interactions", () => {
    const manyInteractions = Array.from({ length: 110 }, (_, index) =>
      interaction(index + 1, {
        actorIsMaintainer: false,
        sourceUrl: `${repositoryUrl}/comment/${index}`,
      }),
    );
    const threads = Array.from({ length: 60 }, (_, index) =>
      thread(12, (index % 20) + 1, manyInteractions),
    );
    const result = analyzeMaintainerResponsiveness(input({ threads }));
    expect(result.sample.threadsUsed).toBe(50);
    expect(result.sample.interactionsUsed).toBe(5_000);
    expect(result.warnings).toContain("Historical thread evidence was bounded to 50 records.");
    expect(result.warnings).toContain("Interactions were bounded to 100 records per thread.");
  });

  it("rejects impossible timestamps", () => {
    expect(() =>
      analyzeMaintainerResponsiveness(
        input({
          threads: [
            {
              ...thread(null, 1),
              interactions: [
                interaction(1, {
                  createdAt: new Date("2026-07-01T00:00:00.000Z"),
                }),
              ],
            },
          ],
        }),
      ),
    ).toThrow(new RangeError("Interaction date cannot be before thread opening."));

    expect(() =>
      analyzeMaintainerResponsiveness(
        input({
          threads: [
            {
              ...thread(null, 1),
              openedAt: new Date("2026-08-27T00:00:00.000Z"),
            },
          ],
        }),
      ),
    ).toThrow(new RangeError("thread opening date cannot be after asOf."));
  });

  it("is deterministic and returns provenance on every fact", () => {
    const result = analyzeMaintainerResponsiveness(input());
    expect(result).toEqual(analyzeMaintainerResponsiveness(input()));
    for (const fact of result.facts) {
      expect(fact.sourceUrl).not.toBe("");
      expect(fact.observedAt).toEqual(asOf);
    }
  });
});
