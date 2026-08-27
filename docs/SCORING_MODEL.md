# Scoring model

The Opportunity Score is deterministic decision support, never a guarantee.

## Current version

`opportunity-score-v2` combines four analyzer outputs:

| Component | Weight | Meaning |
| --- | ---: | --- |
| Repository activity | 20% | Recent public activity and contribution-readiness evidence |
| Visible competition | 25% | Assignees, claims, and linked implementation work; inverted for scoring |
| Maintainer responsiveness | 15% | Bounded historical response observations |
| Issue actionability | 40% | Whether the issue currently defines contribution-ready work |

Each analyzer returns a 0–100 score, confidence, provenance-linked facts, clearly labelled
inferences, and warnings. Missing evidence lowers confidence instead of becoming a fabricated zero.
The weighted result is rounded to the nearest integer.

## Verdicts and gates

- 70–100: `Pursue`
- 40–69: `Review Carefully`
- 0–39: `Skip`

Evidence-backed caps override an optimistic weighted result: archived or disabled repository (0),
closed issue (20), and high-confidence low actionability (39). The low-actionability gate prevents an
unresolved policy/design discussion from becoming `Pursue` merely because the repository is active
and no competing PR was found. An explicit accepted implementation direction can remove this gate.

Version 2 is a material semantic change from version 1; stored v1 scores must retain their original
version and should not be compared as if the formulas were identical.

## Visible competition

Active competition means an open or draft PR that GitHub exposes as a timeline cross-reference, or a
repository PR whose title/body explicitly references the issue. Duplicates are removed by URL. Merged
and closed-unmerged PRs are retained as weaker historical evidence. Generic issue, commit,
documentation, and repository references do not become PR competition.

Collection is bounded. A full timeline page or full recent-PR window signals possible truncation and
lowers confidence. “No active PR detected” never means that nobody is working privately.

## Issue actionability

Actionability uses only observable issue title, body, and labels. Positive signals include concrete
requested behavior, reproduction details, expected outcomes/checklists, specific code targets,
contribution-ready labels, and accepted implementation direction. Negative signals include
discussion/meta/question labels, multiple unresolved proposals, open-ended direction requests, and
tracking/umbrella language.

Labels are not absolute rules. Accepted direction can outweigh older discussion labels. The analyzer
uses no LLM and does not infer private maintainer intent.

## Confidence and limitations

Confidence measures completeness and strength of available public evidence, not certainty about the
future. A one-thread responsiveness sample remains low confidence. Bounded or unavailable PR evidence
cannot support a high-confidence claim of absence. Private forks, unpushed work, private discussion,
and activity beyond collection bounds are invisible.

Weights, thresholds, lexical rules, and gates require continued calibration against real-user
validation cases. Any material formula change requires a new score version.
