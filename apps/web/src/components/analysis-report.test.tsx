import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnalysisReport, type AnalysisReportModel } from "./analysis-report.js";

const report: AnalysisReportModel = {
  repository: "owner/repo",
  issueNumber: 42,
  issueTitle: "Example issue",
  issueUrl: "https://github.com/owner/repo/issues/42",
  score: 64,
  scoreVersion: "opportunity-score-v1",
  verdict: "review_carefully",
  confidence: "medium",
  generatedAt: "2026-08-26T09:00:00.000Z",
  partial: true,
  stale: true,
  nextAction: "Confirm the issue is still available.",
  risks: ["Historical evidence is limited."],
  components: [
    {
      key: "activity",
      label: "Repository activity",
      score: 80,
      weight: 0.3,
      confidence: "high",
      reason: "Recent activity is visible.",
      facts: [
        {
          label: "Latest activity",
          value: "2 days ago",
          sourceUrl: "https://github.com/owner/repo/commits/main",
          freshnessDays: 2,
        },
      ],
      inferences: [
        {
          label: "Activity pattern",
          value: "Active",
          caution: "Recent activity does not guarantee maintainer attention.",
        },
      ],
      warnings: ["Release evidence is unavailable."],
    },
  ],
};

describe("AnalysisReport", () => {
  it("renders facts and inferences as distinct labelled sections with source links", () => {
    const html = renderToStaticMarkup(<AnalysisReport report={report} />);

    expect(html).toContain("Facts");
    expect(html).toContain("Inferences");
    expect(html).toContain('href="https://github.com/owner/repo/commits/main"');
    expect(html).toContain("Source");
    expect(html).toContain("Recent activity does not guarantee maintainer attention.");
  });

  it("announces partial and stale report limitations honestly", () => {
    const html = renderToStaticMarkup(<AnalysisReport report={report} />);

    expect(html).toContain('role="status"');
    expect(html).toContain("Some evidence was unavailable, so confidence is reduced.");
    expect(html).toContain("Some evidence is stale and may no longer reflect current activity.");
  });

  it("renders verdict, confidence, next action, risks, and disclaimer", () => {
    const html = renderToStaticMarkup(<AnalysisReport report={report} />);

    expect(html).toContain("Review carefully");
    expect(html).toContain("64 / 100");
    expect(html).toContain("Medium");
    expect(html).toContain("Confirm the issue is still available.");
    expect(html).toContain("Historical evidence is limited.");
    expect(html).toContain("not a guarantee of response, acceptance, payment, or completion time");
  });
});
