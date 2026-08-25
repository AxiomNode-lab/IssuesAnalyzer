"use client";

import { FormEvent, useId, useState } from "react";

type Status = "empty" | "invalid" | "loading" | "unavailable";

function isIssueUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "github.com" &&
      parts.length === 4 &&
      parts[2] === "issues" &&
      /^[1-9]\d*$/.test(parts[3] ?? "")
    );
  } catch {
    return false;
  }
}

export function IssueAnalyzer() {
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("empty");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = value.trim();

    if (!isIssueUrl(normalized)) {
      setStatus("invalid");
      return;
    }

    setStatus("loading");
    window.setTimeout(() => setStatus("unavailable"), 700);
  }

  return (
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
            aria-invalid={status === "invalid"}
            aria-describedby={status === "invalid" ? errorId : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              if (status !== "empty") setStatus("empty");
            }}
          />
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Preparing…" : "Analyze issue"}
          </button>
        </div>
        {status === "invalid" && (
          <p className="form-message error" id={errorId} role="alert">
            Enter a public GitHub issue URL in the format github.com/owner/repository/issues/123.
          </p>
        )}
        {status === "loading" && (
          <p className="form-message" role="status" aria-live="polite">
            Validating the issue and preparing the analysis…
          </p>
        )}
        {status === "unavailable" && (
          <div className="form-message notice" role="status">
            <strong>Interface preview complete.</strong> Live GitHub analysis arrives with the API milestone.
            Your URL was not sent anywhere.
          </div>
        )}
        {status === "empty" && (
          <p className="form-hint">Public issues only. No GitHub token is used in this interface milestone.</p>
        )}
      </form>
    </div>
  );
}
