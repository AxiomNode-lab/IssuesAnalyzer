# Frontend Experience and Visual System

## Product direction

GitHub Opportunity Radar is primarily an analysis backend with a focused presentation layer.
The interface should feel like a trusted technical instrument: calm, fast, evidence-based, and
professional.

The visual identity combines restrained Ancient Roman geometry with familiar GitHub tooling.
Roman references appear in proportion, serif headings, engraved borders, a compact seal, and
bronze accents—not statues, textures, or decorative clutter.

## MVP information architecture

MVP v0.1 has one public route: `/`.

The same page owns the complete visual flow:

1. Empty issue URL input.
2. Precise local format error.
3. Accessible loading status.
4. Backend/API unavailable notice during MVP-02.
5. Analysis report in later milestones.

Separate Analyze, Report, About, Methodology, and account pages are intentionally deferred.
Methodology and evidence explanations will use inline disclosure when implemented.

## Page composition

- Compact header: product identity and version only.
- Hero: one clear value statement and GitHub Issue URL form.
- Evidence ledger: four concise signal summaries.
- Report preview: recommendation, score, confidence, and next action.
- Compact footer with the non-guarantee notice.

No dashboard, sidebar, marketing carousel, or complex navigation is included.

## Core report

When backend analysis is connected, the single-page result must present:

- issue summary;
- repository activity;
- maintainer responsiveness;
- competition;
- issue clarity;
- skill fit;
- opportunity score;
- confidence;
- risks;
- decision: `Pursue`, `Review Carefully`, or `Skip`.

Facts must link to their GitHub evidence. Inferences must be labeled. The product must never
promise acceptance, payment, or maintainer response.

## Visual tokens

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| canvas | `#F4F0E6` | `#0D1117` | Page |
| surface | `#FFFDF7` | `#161B22` | Panels |
| text | `#24201A` | `#F0F3F6` | Primary text |
| muted | `#665F54` | `#9DA7B3` | Supporting text |
| border | `#B9AA91` | `#30363D` | Dividers |
| bronze | `#7A4C24` | `#D19A66` | Brand accent |
| focus | `#0969DA` | `#58A6FF` | Keyboard focus |

Use system sans-serif for controls and body text, Georgia/system serif for short display
headings, and monospace for identifiers. No external font request belongs in the critical path.

## Required interaction states

| State | Behavior |
| --- | --- |
| Empty | Explain the accepted URL and privacy boundary. |
| Invalid | Identify the expected GitHub Issue URL format and preserve input. |
| Loading | Announce progress using a polite live region; never show fake percentages. |
| Unavailable | State that the API is not connected and that the URL was not sent. |
| Partial | Later: render available evidence and reduce confidence. |
| Rate limited | Later: give retry guidance without leaking implementation details. |
| Success | Later: render decision, confidence, evidence, limitations, and risks inline. |

## Accessibility

Target WCAG 2.2 AA:

- semantic landmarks and logical heading order;
- skip link and visible keyboard focus;
- associated labels and form errors;
- polite loading announcements;
- status conveyed with text, not color alone;
- practical 44px touch targets;
- no essential information lost at 200% zoom;
- reduced-motion preference respected.

## Responsive behavior

The layout is mobile-first. Form controls stack on narrow screens. Evidence cards move from
four columns to two and then one. The report becomes a single readable column without hidden
horizontal content.

## Performance and security boundaries

- Server components by default; only the form state is a client component.
- No large decorative image, third-party tracker, or external font in the first render.
- Browser code receives no GitHub token, private key, database credential, or stack trace.
- GitHub content is rendered as text; raw untrusted HTML is prohibited.
- External GitHub calls will be validated and executed server-side in later milestones.
- The URL check in MVP-02 is presentation feedback, not the authoritative security validator.

## MVP-02 boundary

Implemented here: the one-page shell, local format feedback, preview loading/error states,
responsive styles, light/dark tokens, and accessibility foundations.

Deferred: GitHub API access, authoritative URL validation, scoring, authentication, storage,
background jobs, payment, and real report calculation.
