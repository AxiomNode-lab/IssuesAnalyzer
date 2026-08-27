import { GitHubClientError } from "@opportunity-radar/github-client";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import type { AnalysisReportModel } from "../../../components/analysis-report";
import { createAnalyzePostHandler } from "./route";

const report: AnalysisReportModel = {
  repository: "sympy/sympy",
  issueNumber: 27888,
  issueTitle: "Issue",
  issueUrl: "https://github.com/sympy/sympy/issues/27888",
  score: 70,
  scoreVersion: "opportunity-score-v1",
  verdict: "pursue",
  confidence: "medium",
  generatedAt: "2026-08-27T12:00:00.000Z",
  partial: false,
  stale: false,
  nextAction: "Review it.",
  components: [],
  risks: [],
};

function request(body: BodyInit, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/analyze", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "x-real-ip": `test-${Math.random()}`,
      ...headers,
    },
  });
}

describe("POST /api/analyze", () => {
  it("returns the normalized report", async () => {
    const analyze = vi.fn(async () => report);
    const response = await createAnalyzePostHandler(analyze)(
      request(JSON.stringify({ issueUrl: report.issueUrl })),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ report });
    expect(analyze).toHaveBeenCalledWith(report.issueUrl);
  });

  it("rejects cross-origin requests", async () => {
    const response = await createAnalyzePostHandler(vi.fn(async () => report))(
      request("{}", { origin: "https://evil.test" }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects malformed and oversized bodies", async () => {
    const handler = createAnalyzePostHandler(vi.fn(async () => report));
    expect((await handler(request("{"))).status).toBe(400);
    expect((await handler(request("{}", { "content-length": "5000" }))).status).toBe(413);
  });

  it("maps GitHub not-found and quota errors safely", async () => {
    const notFound = createAnalyzePostHandler(
      vi.fn(async () => {
        throw new GitHubClientError("not_found", "private detail");
      }),
    );
    const limited = createAnalyzePostHandler(
      vi.fn(async () => {
        throw new GitHubClientError("rate_limited", "private detail", {
          retryAfterSeconds: 60,
        });
      }),
    );

    expect((await notFound(request(JSON.stringify({ issueUrl: report.issueUrl })))).status).toBe(
      404,
    );
    const rateResponse = await limited(request(JSON.stringify({ issueUrl: report.issueUrl })));
    expect(rateResponse.status).toBe(429);
    expect(rateResponse.headers.get("retry-after")).toBe("60");
    expect(await rateResponse.text()).not.toContain("private detail");
  });

  it("maps malformed upstream evidence to a safe gateway error", async () => {
    const handler = createAnalyzePostHandler(
      vi.fn(async () => {
        throw new GitHubClientError("invalid_payload", "sensitive parser detail");
      }),
    );

    const response = await handler(request(JSON.stringify({ issueUrl: report.issueUrl })));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("sensitive parser detail");
  });
});
