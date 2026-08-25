# Frontend Experience and Visual System

## Product experience

GitHub Opportunity Radar should feel like a trusted technical instrument: focused, evidence-based, fast, and calm. The visual identity combines restrained Ancient Roman references with the density and familiarity of modern GitHub tooling.

The Roman theme is not costume design. It appears through proportion, typography, borders, seals, arches, and language hierarchy. Core workflows must still behave like a professional developer product.

## Design direction: Roman technical archive

### Principles

1. **Evidence is the monument.** Data and linked facts receive more visual weight than decoration.
2. **Roman restraint.** Use architectural geometry and engraved details, not large statues, photographic ruins, or animated marble.
3. **GitHub familiarity.** Repositories, issues, labels, timestamps, code, and links should look and behave predictably.
4. **Readable before beautiful.** Decorative typography is limited to short headings; interface text remains highly legible.
5. **Progressive disclosure.** Show the decision first, then scores, evidence, methodology, and raw details.
6. **Dark and light parity.** Both themes are first-class and meet the same contrast requirements.

## Visual language

### Brand concept

Working visual phrase: **The Forum for GitHub Opportunities**.

Suggested logo mark: a minimal arch containing a branching Git symbol or a laurel ring around a small issue-dot. It must remain recognizable at 16 pixels and use a single color.

Avoid:
- realistic statues, weapons, emperors, flags, or political symbols;
- fake cracked textures behind text;
- excessive gold gradients;
- Roman numerals for data, dates, scores, or navigation;
- decorative fonts in forms, tables, or body text.

### Color tokens

Exact values may be tuned after contrast testing.

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `--canvas` | `#F4F0E6` | `#0D1117` | page background |
| `--surface` | `#FFFCF5` | `#161B22` | cards and panels |
| `--surface-muted` | `#E9E1D0` | `#21262D` | secondary areas |
| `--text` | `#24201A` | `#F0F3F6` | primary text |
| `--text-muted` | `#665F54` | `#9DA7B3` | secondary text |
| `--border` | `#B9AA91` | `#30363D` | borders and dividers |
| `--bronze` | `#8A5A2B` | `#D19A66` | brand accent |
| `--laurel` | `#536B45` | `#7FA36A` | positive/pursue |
| `--warning` | `#9A6700` | `#D29922` | review carefully |
| `--danger` | `#B42318` | `#F85149` | skip/error |
| `--link` | `#0969DA` | `#58A6FF` | familiar GitHub-style link |

Color must never be the only carrier of meaning. Every status also needs text and, where helpful, an icon.

### Typography

- Display headings: a locally hosted or system-safe classical serif with strong capitals.
- UI and body: a neutral system sans-serif for GitHub-like readability.
- Code, repository paths, and identifiers: system monospace.
- No external font request is allowed in the first render; fonts should be local or self-hosted.
- Minimum body size: 16px. Supporting metadata may use 14px, never below 12px.
- Use ordinary Arabic numerals for all measurements and scores.

### Shape and ornament

- Cards use thin double-line or inset borders inspired by engraved stone tablets.
- Section headers may use a small laurel, dot, or arch divider.
- Corners are slightly rounded, not pill-shaped everywhere.
- Shadows are subtle and short; depth comes mainly from borders and surface contrast.
- Motion is functional and limited to 150–250ms. Respect `prefers-reduced-motion`.

## Information architecture

### Public routes

| Route | Purpose |
| --- | --- |
| `/` | Explain the value and accept a GitHub Issue URL. |
| `/analyze` | Validate input and start analysis. |
| `/reports/[id]` | Display a stable analysis report. |
| `/methodology` | Explain scores, confidence, limitations, and evidence. |
| `/privacy` | Explain collected data and retention. |
| `/about` | Product purpose and non-guarantee statement. |

Authenticated history and settings are deferred until MVP-11.

## Global application shell

### Header

- Compact wordmark and logo.
- Navigation: Analyze, Methodology, About.
- Theme control with accessible name.
- GitHub sign-in appears only when authentication exists.
- On mobile, navigation collapses into a keyboard-accessible menu.

### Main content

- Maximum reading width around 1200px.
- Report page uses a responsive two-column grid: primary evidence and a narrow decision summary.
- On small screens the decision summary moves above the evidence.

### Footer

- Methodology, privacy, GitHub repository, status, and version.
- Short disclaimer: recommendations are estimates, not guarantees.

## Screen specifications

### 1. Landing and issue input

Hero heading: **Know whether an issue deserves your time.**

Supporting text explains that the tool examines activity, responsiveness, competition, clarity, and skill fit.

Primary control:
- label: `GitHub Issue URL`;
- example: `https://github.com/owner/repository/issues/123`;
- button: `Analyze issue`;
- optional sample-report link.

Validation occurs after submit and may also provide non-intrusive feedback on blur. Do not block pasting. Preserve input when an error occurs.

Below the form, show three short stages:

1. Gather public evidence.
2. Explain the opportunity.
3. Recommend pursue, review, or skip.

### 2. Analysis progress

Use a progress region with an accessible live status:

- Validating issue URL.
- Reading issue and repository.
- Measuring activity and responsiveness.
- Checking competition and clarity.
- Building the report.

Never show fake percentage precision. If part of the analysis fails, continue with available evidence and reduce confidence.

### 3. Report header

Display:
- owner/repository and issue number;
- issue title and current state;
- generated time and evidence freshness;
- recommendation: `Pursue`, `Review Carefully`, or `Skip`;
- opportunity score;
- confidence level;
- direct link to the GitHub issue.

The recommendation appears as an engraved seal-like badge, but remains plain text to screen readers.

### 4. Evidence summary

Six consistent score cards:

- Repository Activity.
- Maintainer Responsiveness.
- Competition.
- Issue Clarity.
- Skill Fit.
- Contribution Readiness.

Each card contains:
- score and qualitative label;
- one-sentence explanation;
- evidence count;
- control to reveal supporting facts;
- freshness or missing-data warning.

### 5. Evidence timeline

Chronological events such as commits, releases, issue replies, assignments, and competing PRs. Each event links to its GitHub source. Facts and inferences must be visually distinct.

### 6. Risks and next action

Risks are ranked by severity and explain impact. The next-action panel suggests safe, professional steps such as asking the maintainer whether the issue is available before investing significant work.

The tool must never claim payment, acceptance, or response is guaranteed.

### 7. Methodology

Explain:
- input signals;
- score weights and model version;
- missing-data behavior;
- confidence calculation;
- known limitations;
- why two similar issues may receive different outcomes.

## Required states

| State | Required behavior |
| --- | --- |
| Empty | Explain accepted URL format and provide an example. |
| Invalid URL | Identify the exact format error without sending a request. |
| Not found | Distinguish missing/private/inaccessible where evidence permits. |
| Loading | Announce meaningful stages and keep layout stable. |
| Partial | Show available sections and explain missing evidence. |
| Rate limited | Give retry guidance without exposing credentials or internals. |
| Server error | Provide a retry action and a short request identifier. |
| Success | Show recommendation, confidence, evidence, and limitations. |

## Components

- `AppHeader`
- `IssueUrlForm`
- `AnalysisProgress`
- `RepositoryIdentity`
- `DecisionSeal`
- `ScoreCard`
- `ConfidenceIndicator`
- `EvidenceList`
- `EvidenceTimeline`
- `RiskPanel`
- `NextActionPanel`
- `DataFreshness`
- `MethodologyDisclosure`
- `AppFooter`

Components must use semantic HTML and remain usable without animation.

## Accessibility acceptance criteria

- Target WCAG 2.2 AA.
- Entire workflow is keyboard operable.
- Visible focus is never removed.
- A skip link reaches the main content.
- Form errors are associated with their fields.
- Loading updates use a polite live region.
- Heading order is logical.
- Status is not communicated by color alone.
- Touch targets are at least 44 by 44 CSS pixels where practical.
- At 200% zoom, no essential information or action is lost.
- Light and dark themes meet contrast requirements.

## Responsive behavior

- Mobile-first CSS.
- Breakpoints are content-driven, not device-brand-driven.
- Score cards: one column on narrow screens, two on medium, three on wide screens.
- Tables become labeled stacked rows when horizontal scrolling would hide meaning.
- Report actions remain reachable without a sticky element covering content.

## Performance budget

Initial targets for a production mobile run:

- Core route JavaScript: aim below 170KB compressed.
- Landing page LCP: at or below 2.5 seconds at the 75th percentile.
- CLS: at or below 0.1.
- INP: at or below 200ms.
- No large decorative image in the critical path.
- Server components by default; client components only for interaction.
- Stream report sections when backend latency justifies it.
- Cache immutable assets and avoid third-party trackers in the MVP.

Budgets are targets until production telemetry exists; they must not be presented as measured results.

## Security and privacy constraints

- Browser code never receives a GitHub App private key or server token.
- The browser sends only the issue URL and necessary user preferences.
- All outbound GitHub requests originate from validated server-side code.
- Render GitHub text as text; do not trust repository HTML.
- External links use safe rel attributes when opening new tabs.
- Avoid raw HTML injection.
- Do not expose stack traces or GitHub tokens in errors.
- Analytics are opt-in or privacy-preserving and are excluded from the first MVP.

## MVP-02 boundary

MVP-02 implements:
- application shell;
- landing page;
- URL form;
- local validation presentation;
- empty, invalid, loading-demo, and generic error states;
- light/dark tokens;
- responsive and accessible component foundations.

MVP-02 does not implement:
- real GitHub API calls;
- scoring;
- authentication;
- persistence;
- payment;
- background jobs;
- final report calculations.

These boundaries keep the pull request reviewable and prevent UI code from silently becoming an API or security layer.
