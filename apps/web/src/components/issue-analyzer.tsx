"use client";

import { parseGitHubIssueUrl } from "@opportunity-radar/domain";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { AnalysisReport } from "./analysis-report";
import type { AnalysisReportModel } from "./analysis-report";

type Status = "empty" | "invalid" | "loading" | "error" | "success";

export function IssueAnalyzer() {
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("empty");
  const [error, setError] = useState("");
  const [report, setReport] = useState<AnalysisReportModel | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;
    const normalized = value.trim();

    const parsed = parseGitHubIssueUrl(normalized);
    if (!parsed.ok) {
      setStatus("invalid");
      setError(parsed.error.message);
      setReport(null);
      return;
    }

    setStatus("loading");
    setError("");
    setReport(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueUrl: parsed.value.canonicalUrl }),
      });
      const payload = (await response.json()) as {
        report?: AnalysisReportModel;
        error?: string;
      };
      if (!response.ok || payload.report === undefined) {
        throw new Error(payload.error || "The issue could not be analyzed. Please try again.");
      }
      setReport(payload.report);
      setStatus("success");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The issue could not be analyzed. Please try again.",
      );
      setStatus("error");
    }
  }

  return (
    <>
      <div className="analyzer">
        <form onSubmit={submit} noValidate>
          <label htmlFor={inputId}>GitHub Issue URL</label>
          <div className="form-row">
            <input
              id={inputId}
              name="issue-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://github.com/owner/repository/issues/123"
              value={value}
              aria-invalid={status === "invalid" || status === "error"}
              aria-describedby={status === "invalid" || status === "error" ? errorId : undefined}
              onChange={(event) => {
                setValue(event.target.value);
                if (status !== "loading") setStatus("empty");
              }}
            />
            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Analyzing GitHub evidence…" : "Analyze issue"}
            </button>
          </div>
          {status === "invalid" && (
            <p className="form-message error" id={errorId} role="alert">
              {error}
            </p>
          )}
          {status === "loading" && (
            <p className="form-message" role="status" aria-live="polite">
              Analyzing GitHub evidence…
            </p>
          )}
          {status === "error" && (
            <p className="form-message error" id={errorId} role="alert">
              {error}
            </p>
          )}
          {status === "empty" && (
            <p className="form-hint">
              Public issues only. GitHub evidence is fetched securely by the server.
            </p>
          )}
        </form>
      </div>
      {status === "success" && report !== null && <AnalysisReport report={report} />}
    </>
  );
}
