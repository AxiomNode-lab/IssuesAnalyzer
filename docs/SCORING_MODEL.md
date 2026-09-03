# Scoring model

The Opportunity Score answers one question: **how good is this issue as an opportunity for a new contributor right now?** It is deterministic decision support, never a guarantee of response, acceptance, payment, or completion time.

## Current version

`opportunity-score-v4` uses an evidence-first hybrid model with three separate layers:

1. a positive opportunity score,
2. explicit evidence-backed risk adjustments,
3. hard eligibility/collision caps.

Confidence remains separate from the opportunity score.

## Positive opportunity score

The existing analyzers remain the source of observable evidence, but v4 changes their influence so that implementation readiness has the largest share and optimistic repository signals cannot dominate a weak task.

| Component | Weight | Direction | Meaning |
| --- | ---: | --- | --- |
| Issue actionability | 50% | higher is better | Is the issue sufficiently concrete and implementation-ready? |
| Visible competition | 25% | lower raw risk is better | Assignees, contributor claims, and linked implementation work |
| Repository activity | 15% | higher is better | Is the repository alive and contribution-ready? |
| Maintainer responsiveness | 10% | higher is better | What does observed historical maintainer response evidence show? |

The competition analyzer remains a risk score (`100 = more competition`). The scoring engine converts it to availability (`100 - competition risk`) before weighting.

The v4 base score is the rounded weighted total. There is **no nonlinear high-tail calibration**. This intentionally removes the previous behavior where already-strong scores could be inflated into the 90s.

## Risk adjustments

Positive evidence is not allowed to hide material execution risk. After the base score is calculated, v4 applies bounded deductions only when a corresponding evidence key was actually observed.

| Evidence-backed risk | Adjustment |
| --- | ---: |
| Maintainer decision still required | -15 |
| Unresolved prerequisite/dependency | -15 |
| Research, architecture, or unresolved design required | -10 |
| Migration or backfill | -8 |
| Large/cross-cutting implementation | -10 |
| Heavy unresolved discussion | -12 |
| Trivial/copy-paste contribution with low contribution value | -15 |

These adjustments are additive but the final score remains bounded to 0–100.

The actionability analyzer now emits conditional evidence keys for unresolved maintainer decisions, dependency risk, research/architecture risk, migration risk, large-scope risk, and unusually trivial contributions. Conditional facts are emitted only when the signal is present, so absence of evidence is not interpreted as negative evidence.

## Hard gates and caps

Some states are not ordinary risk and therefore are not represented as small point deductions.

| Condition | Maximum final score |
| --- | ---: |
| Repository archived | 0 |
| Repository disabled | 0 |
| Issue closed | 0 |
| Active linked implementation already exists | 20 |
| Issue assigned **and** active linked implementation exists | 15 |
| Automated/non-standalone tracker | 15 |
| High-confidence low-actionability issue | 35 |
| Very stale repository + insufficient maintainer evidence | 69 |
| Competition evidence incomplete | no score cap; confidence only |

This is the main protection against score compensation. A healthy repository, `good first issue` label, or clear description cannot raise an issue with active competing implementation above the collision cap.

## Confidence is separate from score

Confidence measures the completeness and quality of public evidence. It does not answer whether the opportunity itself is good.

Missing or bounded evidence lowers confidence and can produce warnings, but it does not silently become a negative score. For example, insufficient maintainer-response history is treated as uncertainty rather than proof that maintainers are slow.

## Labels are weak evidence

Labels such as `good first issue`, `help wanted`, and `easy to fix` are useful but weak signals. They cannot override assignment, active pull requests, unresolved decisions, dependency blockers, or low contribution value.

This prevents a repository from receiving very high opportunity scores simply because it creates many beginner-labelled microtasks.

## Contribution value vs ease

V4 explicitly distinguishes an easy task from a valuable contribution opportunity. A task can be perfectly actionable and still receive a contribution-value deduction when the issue itself describes work as effectively copy/paste, browser-only, requiring no setup/code, or taking less than about a minute.

This signal is deliberately narrow. It is not meant to penalize small legitimate fixes; it targets unusually trivial contribution tasks where `easy` should not automatically mean `strong opportunity`.

## Actionability evidence

Actionability uses observable issue title, body, and labels. Positive signals include concrete requested behavior, reproduction details, expected outcomes/checklists, specific code targets, contribution-ready labels, and accepted implementation direction.

Negative or risk signals include open-ended implementation decisions, proposal-style requests without acceptance criteria, multiple unresolved approaches, tracking/umbrella language, automated dependency-management output, migrations/backfills, prerequisites, research/architecture requirements, and broad cross-cutting scope.

## Competition evidence

Active competition means an open or draft pull request linked through GitHub timeline evidence or an explicitly referencing repository pull request. Assignment is also strong competition evidence. Contributor claim language is weaker and is scored below an assignee or active PR.

Closed/merged work remains historical evidence. Generic issue references do not automatically become competing implementation.

## Decision bands

- `70–100`: Pursue
- `40–69`: Review Carefully
- `0–39`: Skip

The band is applied only after evidence adjustments and hard caps.

## Benchmark-driven calibration

V4 should be calibrated against a human-reviewed benchmark set rather than individual anecdotal examples. When a benchmark differs from the application result, diagnosis should identify whether the error came from:

- missing/incorrect GitHub evidence collection,
- feature classification,
- feature weight,
- risk adjustment,
- hard-cap logic,
- or confidence estimation.

The model should not receive one-off issue-specific patches. New rules must represent a general observable pattern and must be covered by tests.

Stored reports keep their score version so future score changes remain explicit.
