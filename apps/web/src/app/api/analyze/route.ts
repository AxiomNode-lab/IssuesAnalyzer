import { GitHubClientError } from "@opportunity-radar/github-client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { analyzeIssue, InvalidAnalysisInputError } from "../../../lib/analysis";
import {
  observeLatency,
  recordMetric,
  reportOperationalError,
  structuredLog,
} from "../../../lib/observability";
import {
  assertSameOrigin,
  consumeAbuseBudget,
  isApiPreflightAllowed,
  readBoundedJson,
} from "../../../lib/security";

const MAX_ANALYSIS_BODY_BYTES = 4 * 1024;

type AnalyzeBody = Readonly<{ issueUrl?: unknown }>;

function errorResponse(status: number, message: string, retryAfterSeconds?: number | null) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (retryAfterSeconds !== undefined && retryAfterSeconds !== null) {
    headers.set("Retry-After", String(retryAfterSeconds));
  }
  return NextResponse.json({ error: message }, { status, headers });
}

export function OPTIONS(request: NextRequest) {
  if (!isApiPreflightAllowed(request))
    return errorResponse(403, "Cross-origin requests are not allowed.");
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
    },
  });
}

type Analyze = (issueUrl: string) => Promise<Awaited<ReturnType<typeof analyzeIssue>>>;

export function createAnalyzePostHandler(analyze: Analyze = analyzeIssue) {
  return async function post(request: NextRequest) {
    if (!assertSameOrigin(request))
      return errorResponse(403, "Cross-origin requests are not allowed.");
    if (request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") {
      return errorResponse(415, "Content-Type must be application/json.");
    }

    const budget = consumeAbuseBudget(request);
    if (!budget.allowed) {
      return errorResponse(
        429,
        "Too many analysis requests. Please try again later.",
        budget.retryAfterSeconds,
      );
    }

    let body: AnalyzeBody;
    try {
      body = await readBoundedJson<AnalyzeBody>(request, MAX_ANALYSIS_BODY_BYTES);
    } catch (error) {
      if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
        return errorResponse(413, "The analysis request is too large.");
      }
      return errorResponse(400, "The request body must be valid JSON.");
    }

    if (typeof body.issueUrl !== "string") {
      return errorResponse(400, "A GitHub Issue URL is required.");
    }
    const issueUrl = body.issueUrl;

    try {
      const report = await observeLatency("analysis_request", () => analyze(issueUrl));
      recordMetric("analysis_success", 1);
      structuredLog("info", "analysis_success", {
        repository: report.repository,
        issueNumber: report.issueNumber,
        partial: report.partial,
        stale: report.stale,
      });
      return NextResponse.json({ report }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      recordMetric("analysis_failure", 1);
      if (error instanceof InvalidAnalysisInputError)
        return errorResponse(400, error.publicMessage);
      if (error instanceof GitHubClientError) {
        if (error.kind === "not_found" || error.kind === "forbidden") {
          return errorResponse(404, "The public GitHub repository or issue was not found.");
        }
        if (error.kind === "rate_limited") {
          return errorResponse(
            429,
            "GitHub's API quota is temporarily exhausted. Please try again later.",
            error.retryAfterSeconds,
          );
        }
        reportOperationalError(error, { operation: "analyze_github_issue", kind: error.kind });
        return errorResponse(
          502,
          "GitHub evidence could not be collected safely. Please try again.",
        );
      }
      reportOperationalError(error, { operation: "analyze_github_issue" });
      return errorResponse(500, "Analysis is temporarily unavailable.");
    }
  };
}

export const POST = createAnalyzePostHandler();
