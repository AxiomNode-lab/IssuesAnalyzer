import * as React from "react";

export type ReportConfidence = "high" | "medium" | "low";
export type ReportVerdict = "pursue" | "review_carefully" | "skip";

export type ReportEvidence = Readonly<{
  label: string;
  value: string;
  sourceUrl: string;
  freshnessDays?: number;
}>;

export type ReportInference = Readonly<{
  label: string;
  value: string;
  caution: string;
}>;

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
  components: readonly ReportComponent[];
  risks: readonly string[];
}>;

const verdictLabels: Record<ReportVerdict, string> = {
  pursue: "Pursue",
  review_carefully: "Review carefully",
  skip: "Skip",
};

function confidenceLabel(value: ReportConfidence): string {
  return `${value[0]?.toUpperCase()}${value.slice(1)}`;
}

export function AnalysisReport({ report }: { report: AnalysisReportModel }) {
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
                  {component.warnings?.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>

      <section className="risk-panel" aria-labelledby="risk-title">
        <h3 id="risk-title">Risks and limitations</h3>
        {report.risks.length === 0 ? (
          <p>No material risk was identified from the available evidence.</p>
        ) : (
          <ul>
            {report.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        )}
        <p className="report-disclaimer">
          This report is decision support, not a guarantee of response, acceptance, payment, or
          completion time.
        </p>
      </section>
    </section>
  );
}
