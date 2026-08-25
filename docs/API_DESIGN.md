# API Design

Base path: `/api/v1`. JSON only. OpenAPI is generated and checked in CI.

## Endpoints
- `POST /analyses` — create or reuse an issue analysis.
- `GET /analyses/{id}` — retrieve report and evidence.
- `POST /analyses/{id}/refresh` — request bounded refresh.
- `GET /analyses/{id}/changes` — compare evidence snapshots.
- `GET /me/profile` — retrieve contributor preferences.
- `PATCH /me/profile` — update explicit skills and goals.
- `POST /saved-opportunities` and `DELETE /saved-opportunities/{id}`.
- `GET /health/live` and `GET /health/ready`.

## Rules
- Idempotency key required for analysis and refresh creation.
- Cursor pagination only.
- Stable machine-readable error codes.
- Strict request/response schemas; reject unknown security-sensitive fields.
- Request IDs returned in headers.
- Per-user and per-IP throttling.
- No GitHub tokens or raw upstream headers in responses.
- Analysis response includes `generated_at`, `evidence_as_of`, `score_version`, and `confidence`.

## Example verdict
```json
{
  "verdict": "good_candidate",
  "score": 81,
  "confidence": "medium",
  "components": [{"name":"maintainer_responsiveness","score":72,"weight":20}],
  "warnings": ["No explicit acceptance criteria"],
  "facts": [{"label":"Last commit","value":"2 days ago","source_url":"https://github.com/..."}],
  "inferences": [{"label":"Likely available","reason":"No assignee or linked open PR was found"}]
}
```
