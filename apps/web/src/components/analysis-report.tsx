import * as React from "react";
export type ReportConfidence = "high" | "medium" | "low";
export type ReportVerdict = "pursue" | "review_carefully" | "skip";
export type ReportEvidence = Readonly<{
  label: string;
  value: string;
  sourceUrl: string;
  freshnessDays?: number;
}>;
export type ReportInference = Readonly<{ label: string; value: string; caution: string }>;
export type ReportComponent = Readonly<{
  key: string;
  label: string;
  score: number;
  weight: number;
  confidence: ReportConfidence;
  reason: string;
  facts: readonly ReportEvidence[];
  inferences?: readonly ReportInference[];
  warnings?: readonly string[];
}>;
export type AnalysisReportModel = Readonly<{
  repository: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  score: number;
  scoreVersion: string;
  verdict: ReportVerdict;
  confidence: ReportConfidence;
  generatedAt: string;
  partial: boolean;
  stale: boolean;
  nextAction: string;
  decisionReason: string;
  components: readonly ReportComponent[];
  risks: readonly string[];
}>;
const verdictLabels: Record<ReportVerdict, string> = {
  pursue: "Pursue",
  review_carefully: "Review carefully",
  skip: "Skip",
};
const confidenceLabel = (v: ReportConfidence) => `${v[0]?.toUpperCase()}${v.slice(1)}`;
function scoreExplanation(report: AnalysisReportModel): string[] {
  const c = Object.fromEntries(report.components.map((x) => [x.key, x]));
  const parts: string[] = [];
  const action = c.actionability,
    competition = c.competition,
    responsiveness = c.responsiveness,
    activity = c.activity;
  if (action)
    parts.push(
      action.score >= 85
        ? `Actionability is a major positive (${action.score}/100): the issue is unusually implementation-ready.`
        : action.score >= 70
          ? `Actionability supports the score (${action.score}/100), but scope or clarity leaves some implementation risk.`
          : `Actionability holds the score back (${action.score}/100); the task is not fully contribution-ready.`,
    );
  if (competition)
    parts.push(
      competition.score === 0
        ? "No visible assignee, claim, or linked implementation was found, which supports availability."
        : competition.score >= 75
          ? `Visible competition is a major negative (${competition.score}/100 risk); assignment or active implementation makes duplicate work more likely.`
          : `Visible competition is moderate (${competition.score}/100 risk); contributor claims matter, but are weaker evidence than an assignee or active PR.`,
    );
  if (responsiveness)
    parts.push(
      responsiveness.score >= 60
        ? `Observed maintainer response evidence is supportive (${responsiveness.score}/100).`
        : responsiveness.score === 50
          ? "Maintainer response evidence is insufficient, so it is treated neutrally rather than as a failure."
          : `Maintainer responsiveness is a negative (${responsiveness.score}/100) based on the observed historical sample.`,
    );
  if (activity)
    parts.push(
      activity.score >= 65
        ? `Repository activity is healthy (${activity.score}/100), reducing abandonment risk.`
        : `Repository activity contributes only ${activity.score}/100, increasing uncertainty.`,
    );
  return parts;
}
export function AnalysisReport({ report }: { report: AnalysisReportModel }) {
  const explanation = scoreExplanation(report);
  return (
    <section className="report" aria-labelledby="report-title">
      <header className="report-header">
        <div>
          <p className="eyebrow">Analysis report</p>
          <h2 id="report-title">
            {report.repository} #{report.issueNumber}
          </h2>
          <a className="report-issue-link" href={report.issueUrl} target="_blank" rel="noreferrer">
            {report.issueTitle}
            <span className="sr-only"> (opens on GitHub in a new tab)</span>
          </a>
        </div>
        <div className={`report-verdict verdict-${report.verdict}`}>
          <span className="report-verdict-label">{verdictLabels[report.verdict]}</span>
          <strong>{report.score} / 100</strong>
          <small>{report.scoreVersion}</small>
        </div>
      </header>
      <p className="report-decision-reason">{report.decisionReason}</p>
      <div className="score-explanation" role="note" aria-label="Why this score">
        <strong>Why this score?</strong>
        <ul>
          {explanation.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      {(report.partial || report.stale) && (
        <div className="report-state" role="status" aria-label="Report limitations">
          <strong>Evidence limitations:</strong>{" "}
          {report.partial && "Some evidence was unavailable, so confidence is reduced."}
          {report.partial && report.stale && " "}
          {report.stale && "Some evidence is stale and may no longer reflect current activity."}
        </div>
      )}
      <dl className="report-summary" aria-label="Report summary">
        <div>
          <dt>Confidence</dt>
          <dd>{confidenceLabel(report.confidence)}</dd>
        </div>
        <div>
          <dt>Generated</dt>
          <dd>
            <time dateTime={report.generatedAt}>{report.generatedAt}</time>
          </dd>
        </div>
        <div>
          <dt>Next action</dt>
          <dd>{report.nextAction}</dd>
        </div>
      </dl>
      <div className="report-components" aria-label="Score components">
        {report.components.map((component) => (
          <article className="report-component" key={component.key}>
            <header className="component-header">
              <div>
                <p className="component-kicker">{Math.round(component.weight * 100)}% weight</p>
                <h3>{component.label}</h3>
              </div>
              <div
                className="component-score"
                aria-label={`${component.label} score ${component.score} out of 100`}
              >
                {component.score}
              </div>
            </header>
            <p className="component-reason">{component.reason}</p>
            <p className="component-confidence">
              Confidence: {confidenceLabel(component.confidence)}
            </p>
            <div className="evidence-columns">
              <section aria-labelledby={`${component.key}-facts`}>
                <h4 id={`${component.key}-facts`}>Facts</h4>
                <ul className="fact-list">
                  {component.facts.map((fact) => (
                    <li key={`${component.key}-${fact.label}-${fact.sourceUrl}`}>
                      <span>
                        <strong>{fact.label}:</strong> {fact.value}
                      </span>
                      <span className="fact-meta">
                        {fact.freshnessDays !== undefined && (
                          <span>
                            {fact.freshnessDays === 0 ? "Current" : `${fact.freshnessDays}d old`}
                          </span>
                        )}
                        <a href={fact.sourceUrl} target="_blank" rel="noreferrer">
                          Source
                          <span className="sr-only"> for {fact.label} (opens in a new tab)</span>
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="inference-panel" aria-labelledby={`${component.key}-inferences`}>
                <h4 id={`${component.key}-inferences`}>Inferences</h4>
                {(component.inferences?.length ?? 0) === 0 ? (
                  <p className="empty-evidence">
                    No additional inference is needed for this component.
                  </p>
                ) : (
                  <ul className="inference-list">
                    {component.inferences?.map((inference) => (
                      <li key={`${component.key}-${inference.label}`}>
                        <strong>{inference.label}:</strong> {inference.value}
                        <small>{inference.caution}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
            {(component.warnings?.length ?? 0) > 0 && (
              <div
                className="component-warnings"
                role="note"
                aria-label={`${component.label} warnings`}
              >
                <strong>Warnings</strong>
                <ul>
                  {component.warnings?.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="risk-panel">
        <h3>Risks and limitations</h3>
        {report.risks.length === 0 ? (
          <p>No material limitations were detected in the available evidence.</p>
        ) : (
          <ul>
            {report.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        )}
        <p>
          This report is decision support, not a guarantee of response, acceptance, payment, or
          completion time.
        </p>
      </div>
    </section>
  );
}
