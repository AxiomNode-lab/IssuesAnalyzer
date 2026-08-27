import { IssueAnalyzer } from "../components/issue-analyzer";

function LogoMark() {
  return (
    <span className="app-logo" aria-hidden="true">
      <span className="app-logo-dot" />
      <span className="app-logo-ring" />
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
            Sign in
          </a>
        </nav>
      </header>

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
            <p className="privacy-note">Only public GitHub data is analyzed. No code is accessed.</p>
            <a className="scroll-cue" href="#results" aria-label="Scroll to analysis results">
              ↓
            </a>
          </div>
        </section>

        <section className="results-shell" id="results" aria-label="Analysis results">
          <div className="results-intro">
            <span>Analysis report</span>
            <h2>Results overview</h2>
          </div>
          <p className="results-placeholder">
            Your live analysis will appear here after you submit an issue URL above.
          </p>
        </section>

        <section className="info-strip" id="how-it-works" aria-labelledby="how-title">
          <div>
            <span>01</span>
            <h2 id="how-title">Paste an issue</h2>
            <p>Use any public GitHub issue URL.</p>
          </div>
          <div>
            <span>02</span>
            <h2>We inspect the evidence</h2>
            <p>Activity, competition, maintainer response, actionability, and freshness.</p>
          </div>
          <div id="about">
            <span>03</span>
            <h2>Make a better decision</h2>
            <p>Get an explainable pursue, review carefully, or skip recommendation.</p>
          </div>
        </section>
      </main>

      <footer>
        <span>Issue Analyzer</span>
        <span>Decision support, not a guarantee.</span>
      </footer>
    </>
  );
}
