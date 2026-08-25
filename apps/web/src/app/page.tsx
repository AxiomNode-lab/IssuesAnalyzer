import { IssueAnalyzer } from "../components/issue-analyzer";

const signals = [
  ["Repository activity", "Recent commits, releases, and issue movement"],
  ["Maintainer response", "Response patterns and review behavior"],
  ["Competition", "Assignments, claims, and competing pull requests"],
  ["Issue clarity", "Scope, acceptance criteria, and missing context"],
] as const;

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
            Paste a public GitHub Issue URL. The finished analyzer will explain activity,
            responsiveness, competition, clarity, fit, and risk before you start coding.
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

        <section className="decision-preview" aria-labelledby="preview-title">
          <div>
            <p className="eyebrow">Report structure</p>
            <h2 id="preview-title">A clear decision, backed by evidence.</h2>
            <p>
              No promise of acceptance or payment—only a transparent estimate with confidence and
              risks.
            </p>
          </div>
          <div className="preview-card">
            <div className="seal" aria-label="Example recommendation: Review carefully">
              Review carefully
            </div>
            <dl>
              <div>
                <dt>Opportunity score</dt>
                <dd>— / 100</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>Awaiting evidence</dd>
              </div>
              <div>
                <dt>Next action</dt>
                <dd>Confirm availability</dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      <footer>
        <span>GitHub Opportunity Radar</span>
        <span>Recommendations are estimates, not guarantees.</span>
      </footer>
    </>
  );
}
