# Scoring engine

A pure, deterministic package that combines four evidence analyzers into an explainable Opportunity
Score.

## Version 2

Results store `opportunity-score-v2`. Version 2 adds issue actionability, changes weights, and adds an
evidence-backed low-actionability recommendation gate. Version 1 scores are not directly comparable.

| Component | Input meaning | Normalization | Weight |
| --- | --- | --- | ---: |
| Repository activity | Higher is better | unchanged | 20% |
| Visible competition | Higher means more visible competition | `100 - score` | 25% |
| Maintainer responsiveness | Higher is better | unchanged | 15% |
| Issue actionability | Higher means more contribution-ready | unchanged | 40% |

The weighted score is rounded to the nearest integer. Decisions remain:

- `Pursue`: 70–100
- `Review Carefully`: 40–69
- `Skip`: 0–39

## Evidence-backed caps

- archived repository: 0
- disabled repository: 0
- closed issue: 20
- high-confidence, low-actionability issue: 39

The actionability cap prevents an unresolved planning or policy discussion from receiving `Pursue`
solely because its repository is active and visible competition is low. It applies only when the
actionability analyzer has high confidence. Explicit accepted-direction evidence can raise
actionability and avoid the gate even when historical `meta` or `discuss` labels remain.

The strictest cap wins, while `uncappedScore` remains available for auditability. Results also expose
the strongest decision reason. Scores are decision support, not guarantees of availability,
maintainer response, acceptance, payment, or completion time.
