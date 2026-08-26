# Scoring engine

A pure, deterministic package that combines the three MVP analyzers into an explainable Opportunity Score.

## Version

Every result stores `opportunity-score-v1`. Any change to weights, normalization, thresholds, or hard-warning caps requires a new score version.

## Formula

| Component | Input meaning | Normalization | Weight |
| --- | --- | --- | --- |
| Activity | Higher is better | unchanged | 30% |
| Competition | Higher means more visible competition | `100 - score` | 40% |
| Responsiveness | Higher is better | unchanged | 30% |

The weighted score is rounded to the nearest integer. Decisions are:

- `Pursue`: 70–100
- `Review Carefully`: 40–69
- `Skip`: 0–39

These are decision-support signals, not guarantees of acceptance, response, payment, or completion time.

## Hard warnings

Version 1 supports explicit evidence-backed caps:

- archived repository: 0
- disabled repository: 0
- closed issue: 20

The strictest applicable cap wins. The uncapped score remains in the result for auditability.

## Guarantees

- no network, database, environment, or system-clock access
- fixed component order and weights
- all scores and confidence values validated as integers from 0 to 100
- evidence keys, reasons, confidence, weights, and warnings retained per component
- bounded output and monotonicity covered by tests
