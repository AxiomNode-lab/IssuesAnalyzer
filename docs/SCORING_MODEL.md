# Scoring Model

The score is a decision aid, never a guarantee.

## Components
| Component | MVP weight | Example evidence |
|---|---:|---|
| Skill fit | 25 | languages, labels, paths, declared skills |
| Repository activity | 20 | commits, releases, archived state |
| Maintainer responsiveness | 20 | sampled first-response and review times |
| Competition | 15 | assignees, linked PRs, recent claim comments |
| Issue clarity | 10 | reproduction, expected behavior, acceptance criteria |
| Contribution readiness | 10 | CONTRIBUTING, tests, CI, templates, license |

## Method
- Deterministic rules first; no opaque model in MVP.
- Normalize each component to 0–100.
- Missing evidence does not become zero; it lowers confidence.
- Hard warnings override optimistic scores: archived repository, closed issue, existing merged fix.
- Every component returns score, evidence, reason, and confidence.
- Version formulas (`score-v1`, `score-v2`) and preserve historical reports.

## Bias and abuse controls
- Stars are weak evidence and receive no direct MVP weight.
- Do not penalize small or volunteer-run projects merely for slower responses.
- Use medians and bounded recent samples.
- Treat label text as a signal, not truth.
- Never infer personal characteristics of maintainers.
- Evaluate false positives and false negatives with a labeled benchmark.

## Initial verdict bands
- 80–100: strong candidate
- 65–79: worth reviewing
- 45–64: uncertain
- 0–44: high time-risk

These bands must be calibrated with user studies before marketing claims.
