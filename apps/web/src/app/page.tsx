import {
  AnalysisReport,
  type AnalysisReportModel,
} from "../components/analysis-report";
import { IssueAnalyzer } from "../components/issue-analyzer";

const signals = [
  ["Repository activity", "Recent commits, releases, and contribution readiness"],
  ["Maintainer response", "Historical response patterns and review behavior"],
  ["Competition", "Assignments, claims, references, and competing pull requests"],
  ["Decision support", "A versioned score with confidence, warnings, and next action"],
] as const;

const previewReport: AnalysisReportModel = {
  repository: "example/project",
  issueNumber: 142,
  issueTitle: "Improve cache invalidation for repository metadata",
  issueUrl: "https://github.com/example/project/issues/142",
  score: 67,
  scoreVersion: "opportunity-score-v1",
  verdict: "review_carefully",
  confidence: "medium",
  generatedAt: "Preview data",
  partial: true,
  stale: false,
  nextAction: "Confirm the issue is still unclaimed before starting implementation.",
  risks: [
    "Historical responsiveness evidence is limited in this preview.",
    "No visible competing work does not prove nobody else is working on the issue.",
  ],
  components: [
    {
      key: "activity",
      label: "Repository activity",
      score: 82,
      weight: 0.3,
      confidence: "high",
      reason: "Recent repository activity and contribution-readiness signals are visible.",
      facts: [
        {
          label: "Latest activity",
          value: "12 days ago",
          sourceUrl: "https://github.com/example/project/commits/main",
          freshnessDays: 12,
        },
        {
          label: "Contribution guide",
          value: "Present",
          sourceUrl: "https://github.com/example/project/blob/main/CONTRIBUTING.md",
          freshnessDays: 0,
        },
      ],
    },
    {
      key: "competition",
      label: "Visible competition",
      score: 35,
      weight: 0.4,
      confidence: "medium",
      reason: "No assignee or linked pull request is visible, but one related reference exists.",
      facts: [
        {
          label: "Assignees",
          value: "0",
          sourceUrl: "https://github.com/example/project/issues/142",
          freshnessDays: 0,
        },
        {
          label: "Linked pull requests",
          value: "0",
          sourceUrl: "https://github.com/example/project/issues/142",
          freshnessDays: 0,
        },
      ],
      inferences: [
        {
          label: "Competition signal",
          value: "Low visible competition",
          caution:
            "Absence of visible signals is not proof that no one else is working on the issue.",
        },
      ],
    },
    {
      key: "responsiveness",
      label: "Maintainer responsiveness",
      score: 50,
      weight: 0.3,
      confidence: "low",
      reason: "The historical sample is too small for a strong responsiveness classification.",
      facts: [
        {
          label: "Historical sample",
          value: "2 threads",
          sourceUrl: "https://github.com/example/project/issues",
          freshnessDays: 0,
        },
      ],
      warnings: ["Too few maintainer responses were observed for a reliable classification."],
    },
  ],
};

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="GitHub Opportunity Radar home">
          <span className="brand-mark" aria-hidden="true">
            ⌁
          </span>
          <span>Opportunity Radar</span>
        </a>
        <span className="version">MVP v0.1</span>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">Evidence before effort</p>
          <h1 id="hero-title">Know whether an issue deserves your time.</h1>
          <p className="lede">
            Paste a public GitHub Issue URL. The analyzer is designed to explain activity,
            responsiveness, visible competition, confidence, and risk before you start coding.
          </p>
          <IssueAnalyzer />
        </section>

        <section className="signals" aria-labelledby="signals-title">
          <div className="section-heading">
            <p className="eyebrow">The evidence ledger</p>
            <h2 id="signals-title">One report. The signals that matter.</h2>
          </div>
          <div className="signal-grid">
            {signals.map(([title, description], index) => (
              <article className="signal-card" key={title}>
                <span className="index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="report-preview" aria-labelledby="preview-heading">
          <div className="section-heading">
            <p className="eyebrow">Report preview</p>
            <h2 id="preview-heading">Facts stay facts. Inferences stay labeled.</h2>
            <p>
              This example uses illustrative data only. Live GitHub evidence will replace it when
              the analysis orchestration endpoint is connected.
            </p>
          </div>
          <AnalysisReport report={previewReport} />
        </section>
      </main>

      <footer>
        <span>GitHub Opportunity Radar</span>
        <span>Recommendations are estimates, not guarantees.</span>
      </footer>
    </>
  );
}
