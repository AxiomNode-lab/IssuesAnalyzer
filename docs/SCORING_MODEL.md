# Scoring model

The Opportunity Score is deterministic decision support, never a guarantee.

## Current version

`opportunity-score-v2` combines four analyzer outputs:

| Component | Weight | Meaning |
| --- | ---: | --- |
| Repository activity | 25% | Recent public activity and contribution-readiness evidence |
| Visible competition | 20% | Assignees, claims, and linked implementation work; inverted for scoring |
| Maintainer responsiveness | 20% | Bounded historical response observations |
| Issue actionability | 35% | Whether the issue currently defines contribution-ready work |

Each analyzer returns a 0–100 score, confidence, provenance-linked facts, clearly labelled inferences,
and warnings. Missing evidence lowers confidence instead of becoming a fabricated zero. Visible
competition is a risk dimension, so its score is inverted before weighting. The weighted result is
rounded to the nearest integer.

The calibration intentionally prevents a zero-competition signal from dominating weak repository
health or missing maintainer evidence.

## Verdicts and guardrails

- 70–100: `Pursue`
- 40–69: `Review Carefully`
- 0–39: `Skip`

Evidence-backed caps override an optimistic weighted result: archived or disabled repository (0),
closed issue (20), and high-confidence low actionability (39). A repository whose latest meaningful
activity is more than 180 days old while maintainer responsiveness remains insufficient is capped at
69. That stale-opportunity guardrail does not treat missing responsiveness as negative evidence; it
only prevents a strong `Pursue` recommendation when two critical signals are simultaneously weak or
unknown.

Repository creation age is never used as a staleness penalty. Recency is derived from public push,
commit, and release evidence. The operational bands used by orchestration are: recent (0–30 days),
moderately quiet (31–90), stale (91–180), and very stale (>180).

## Maintainer responsiveness

The application samples up to 15 recent issue threads, excluding the issue currently being analyzed.
The recent-issue list is one bounded GitHub request; each sampled issue uses at most one page of up to
100 comments. This adds at most 16 GitHub requests to a cold uncached analysis and remains subject to
the existing GitHub quota handling, analysis cache, and request deduplication.

Only `OWNER`, `MEMBER`, and `COLLABORATOR` author associations count as observable maintainer
responses. Bots do not count. For each thread the analyzer records whether a maintainer responded and
the delay to the first qualifying response.

Confidence is driven by sample size rather than by whether the observed result is positive or
negative:

- 10 or more threads: high
- 5–9 threads: medium
- 2–4 threads: low
- 0–1 threads: low / insufficient

With at least three threads, response coverage and median first-response time jointly classify the
historical pattern. A sufficiently large sample with no maintainer replies is real negative evidence;
a missing or one-thread sample is not.

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
future. Missing evidence is not scored as confirmed bad behavior. Bounded or unavailable PR evidence
cannot support a high-confidence claim of absence. Private forks, unpushed work, private discussion,
and activity beyond collection bounds are invisible.

Weights, thresholds, lexical rules, and guardrails require continued calibration against real-user
validation cases. Stored reports retain their score version so future scoring-version changes remain
explicit.
