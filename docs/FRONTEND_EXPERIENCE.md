# Frontend Experience and Visual System

## Product direction

The public interface presents a focused GitHub issue analysis workflow. It should feel like a technical instrument: calm, fast, evidence-based, and professional.

The visual identity uses restrained geometry, strong typography, bronze accents, and familiar GitHub-oriented cues without decorative clutter.

## Current information architecture

The public route is `/`.

1. Header and product identity.
2. Issue URL input.
3. Local validation.
4. Accessible loading and error states.
5. Server-side analysis.
6. Evidence-backed report with score, confidence, warnings, and recommendation.
7. Short explanation of how the analysis works.

No dashboard or marketing carousel is part of the current interface.

## Analysis report

The report can present:

- issue summary;
- repository activity;
- maintainer responsiveness;
- visible competition;
- issue actionability;
- skill fit;
- opportunity score;
- confidence;
- risks and warnings;
- recommendation: `Pursue`, `Review Carefully`, or `Skip`.

Facts link to GitHub evidence. Inferences are labeled. The product does not promise acceptance, payment, or maintainer response.

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

Use system sans-serif for controls and body text, Georgia/system serif for short display headings, and monospace for identifiers. No external font request belongs in the critical path.

## Required interaction states

| State | Behavior |
| --- | --- |
| Empty | Explain the accepted URL and privacy boundary. |
| Invalid | Identify the expected GitHub Issue URL format and preserve input. |
| Loading | Announce progress using a polite live region; do not show fake percentages. |
| Unavailable | Explain that analysis could not be completed. |
| Success | Render the report, evidence, confidence, limitations, and recommendation. |
| Rate limited | Give retry guidance without leaking implementation details. |

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

The layout is mobile-first. Form controls stack on narrow screens. Evidence cards reflow from four columns to two and then one. The report remains readable without hidden horizontal content.

## Performance and security boundaries

- Server components are preferred; the interactive issue form is a client component.
- No large decorative image, third-party tracker, or external font belongs in the critical path.
- Browser code receives no GitHub token, private key, database credential, or stack trace.
- GitHub content is rendered as text; raw untrusted HTML is not used.
- GitHub API calls run server-side through the read-only client.
- Authoritative URL validation and abuse controls run on the server.
