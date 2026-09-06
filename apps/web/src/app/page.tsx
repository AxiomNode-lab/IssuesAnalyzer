import { IssueAnalyzer } from "../components/issue-analyzer";

function LogoMark() {
  return (
    <span className="app-logo" aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <circle cx="27" cy="27" r="16" />
        <path d="M39.5 39.5 53 53" />
      </svg>
    </span>
  );
}

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <a className="brand" href="/" aria-label="Issue Analyzer home">
          <LogoMark />
          <span className="brand-copy">
            <strong>Issue Analyzer</strong>
            <small>Know before you code.</small>
          </span>
          <span className="beta-badge">Beta</span>
        </a>

        <nav className="top-nav" aria-label="Primary navigation">
          <a href="#about">About</a>
          <a href="#how-it-works">How it works</a>
          <a className="signin-link" href="/api/auth/github/start">
            Sign in with GitHub
          </a>
        </nav>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-content">
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot" aria-hidden="true" />
              Public GitHub issue intelligence
            </div>
            <h1 id="hero-title">
              Know before
              <span>you code.</span>
            </h1>
            <p className="lede">
              Turn a public GitHub issue into a clear, evidence-backed decision. Understand
              activity, competition, maintainer responsiveness, actionability, and risk before
              investing your time.
            </p>

            <IssueAnalyzer />

            <div className="hero-meta" aria-label="Product promises and validation">
              <span>Validated against real-world GitHub issue scenarios</span>
              <span>Public data only</span>
              <span>Explainable scoring</span>
              <span>No repository write access</span>
            </div>
          </div>
        </section>

        <section className="results-shell" id="results" aria-label="Analysis results">
          <div className="results-heading-row">
            <div className="results-intro">
              <span>Analysis report</span>
              <h2>Evidence, not guesswork.</h2>
            </div>
            <p>
              Your report separates facts from inferences, highlights freshness, and explains the
              recommendation behind the score.
            </p>
          </div>

          <div className="results-placeholder">
            <div className="placeholder-icon" aria-hidden="true">
              <LogoMark />
            </div>
            <div>
              <strong>Ready when you are.</strong>
              <span>Paste a public issue URL above to generate the first analysis.</span>
            </div>
          </div>
        </section>

        <section className="info-section" id="how-it-works" aria-labelledby="how-title">
          <div className="section-copy">
            <span className="section-kicker">How it works</span>
            <h2 id="how-title">A faster way to decide where your time is worth spending.</h2>
            <p>
              The analyzer turns scattered GitHub signals into one structured pre-flight report so
              you can move forward with more context.
            </p>
          </div>

          <div className="info-strip">
            <div>
              <span>01</span>
              <h3>Paste an issue</h3>
              <p>Start with any supported public GitHub issue URL.</p>
            </div>
            <div>
              <span>02</span>
              <h3>Inspect the evidence</h3>
              <p>We evaluate activity, competition, response patterns, and freshness.</p>
            </div>
            <div id="about">
              <span>03</span>
              <h3>Make the call</h3>
              <p>Get an explainable pursue, review carefully, or skip recommendation.</p>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <span className="footer-brand">
          <LogoMark />
          <strong>Issue Analyzer</strong>
        </span>
        <span>Decision support, not a guarantee.</span>
      </footer>
    </>
  );
}
