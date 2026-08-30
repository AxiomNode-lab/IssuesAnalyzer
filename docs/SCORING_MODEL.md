# Scoring model

The Opportunity Score is deterministic decision support, never a guarantee.

## Current version

`opportunity-score-v3` combines four analyzer outputs:

| Component | Weight | Meaning |
| --- | ---: | --- |
| Repository activity | 20% | Recent public activity and contribution-readiness evidence |
| Visible competition | 30% | Assignees, claims, and linked implementation work; converted from risk to contributor availability before weighting |
| Maintainer responsiveness | 15% | Bounded historical response observations |
| Issue actionability | 35% | Whether the issue currently defines contribution-ready work |

The weighting intentionally gives more influence to whether work is still available and whether the issue is actually implementable. Maintainer responsiveness remains useful, but its bounded historical sampling has less power to drag an otherwise strong opportunity toward the middle.

## Tail calibration

V2 tended to compress both excellent and poor opportunities toward the 50–70 range. V3 first computes a normal weighted base score and then expands distance from the midpoint:

`calibrated = 50 + (base - 50) * 1.25`

The result is clamped to 0–100. A base score of 80 becomes 88, a base score of 20 becomes 13, and a base score of 50 stays 50. This preserves sensible middle-range results while giving strong and weak evidence more separation.

## Confidence is separate from score

Confidence measures evidence completeness; it is not a hidden penalty on opportunity quality. Missing or bounded evidence lowers confidence and creates warnings, but it does not automatically cap a strong score. In particular, reaching the pull-request or timeline collection bound no longer forces a score of 69.

Competition analyzer output remains a risk score for backwards-compatible explainability (`100 = more visible competition`). Before weighting, the scoring engine converts it to contributor availability (`100 - competition risk`). This keeps every weighted dimension pointed in the same direction without changing the analyzer contract.

## Verdicts and guardrails

- 70–100: `Pursue`
- 40–69: `Review Carefully`
- 0–39: `Skip`

Evidence-backed caps still override an optimistic calibrated result:

- archived or disabled repository: 0
- closed issue: 20
- high-confidence low-actionability issue: 25
- active linked implementation: 49
- assigned issue plus active linked implementation: 39
- very stale repository plus insufficient maintainer evidence: 69

Incomplete competition evidence has a cap of 100, which means it affects confidence/warnings only.

## Automated dashboards, roadmaps, and trackers

Actionability v2 detects issues that are not standalone contribution tasks even when they contain optimistic labels or checklists. Strong signals include titles/body text such as `Dependency Dashboard`, `Public Roadmap`, explicit tracking/umbrella language, Renovate-generated dependency output, and labels such as `automated`, `bot`, or `renovate`.

These cases are capped to low actionability before final scoring. This prevents an automated dependency dashboard from receiving a high score simply because the repository is active or the issue contains generated checkboxes and `good first issue` labels.

## Visible competition

Active competition means an open or draft PR that GitHub exposes as a timeline cross-reference, or a repository PR whose title/body explicitly references the issue. Duplicates are removed by URL. Merged and closed-unmerged PRs are retained as weaker historical evidence. Generic issue, commit, documentation, and repository references do not become PR competition.

Collection is bounded. A full timeline page or full recent-PR window signals possible truncation and lowers confidence. “No active PR detected” never means that nobody is working privately.

## Maintainer responsiveness

The application samples up to 15 recent issue threads, excluding the issue currently being analyzed. Only `OWNER`, `MEMBER`, and `COLLABORATOR` author associations count as observable maintainer responses, and bots do not count. Because this evidence can be sparse or imperfect, its weight is 15% in v3 rather than 20%.

## Issue actionability

Actionability uses only observable issue title, body, and labels. Positive signals include concrete requested behavior, reproduction details, expected outcomes/checklists, specific code targets, contribution-ready labels, and accepted implementation direction. Negative signals include discussion/meta/question labels, multiple unresolved proposals, open-ended direction requests, tracking/umbrella language, roadmaps, and automated dependency-management output.

Labels are not absolute rules. Generated or automated issue structure is explicitly prevented from masquerading as a high-quality contribution task.

## Confidence and limitations

Confidence measures completeness and strength of available public evidence, not certainty about the future. Private forks, unpushed work, private discussion, and activity beyond collection bounds are invisible.

Weights, calibration strength, lexical rules, thresholds, and guardrails should continue to be tested against a human-reviewed benchmark set. Stored reports retain their score version so future scoring changes remain explicit.
