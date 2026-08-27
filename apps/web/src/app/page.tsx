import { IssueAnalyzer } from "../components/issue-analyzer";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-content">
            <h1 id="hero-title">Know before you code.</h1>
            <p className="lede">
              Paste a public GitHub Issue URL and get instant insight into activity, competition,
              responsiveness, actionability, and risk.
            </p>
            <IssueAnalyzer />
          </div>
        </section>
      </main>
    </>
  );
}
