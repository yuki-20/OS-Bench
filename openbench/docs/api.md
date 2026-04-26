# API reference

All endpoints are JSON. Bearer-token authentication. Tenant context is supplied via the
`X-Org-Id` header (defaults to the caller's first membership when missing).

Auto-generated, interactive docs are at `http://localhost:8000/docs` once the API is
running.

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | Create new org + admin user |
| POST | `/api/auth/login` | Email/password login → token pair |
| POST | `/api/auth/refresh` | Exchange refresh token |
| POST | `/api/auth/logout` | Best-effort logout |
| GET  | `/api/auth/me` | Current user + memberships |

## Documents

| Method | Path | Min role |
|---|---|---|
| POST   | `/api/documents/upload-direct` | reviewer |
| POST   | `/api/documents/upload` | reviewer (returns signed URL) |
| POST   | `/api/documents/{id}/finalize` | reviewer |
| GET    | `/api/documents` | operator |
| GET    | `/api/documents/{id}` | operator |
| GET    | `/api/documents/{id}/chunks` | operator |
| GET    | `/api/documents/{id}/download-url` | operator |
| DELETE | `/api/documents/{id}` | reviewer |

## Protocols / drafts / versions

| Method | Path |
|---|---|
| POST   | `/api/protocol-drafts/compile` |
| GET    | `/api/protocol-drafts/{id}` |
| PATCH  | `/api/protocol-drafts/{id}` |
| POST   | `/api/protocol-drafts/{id}/publish` |
| GET    | `/api/protocols` |
| GET    | `/api/protocol-versions/{id}` |
| POST   | `/api/protocol-versions/{id}/archive` |
| GET    | `/api/protocol-versions?status_filter=published` |

## Runs

Run lifecycle:

| Method | Path |
|---|---|
| POST | `/api/runs` |
| GET  | `/api/runs/{id}` |
| GET  | `/api/runs?status_filter=...` |
| POST | `/api/runs/{id}/start` |
| POST | `/api/runs/{id}/pause` |
| POST | `/api/runs/{id}/resume` |
| POST | `/api/runs/{id}/cancel` |

Step actions:

| Method | Path |
|---|---|
| POST | `/api/runs/{id}/steps/{stepId}/start` |
| POST | `/api/runs/{id}/steps/{stepId}/complete` |
| POST | `/api/runs/{id}/steps/{stepId}/skip` |

Run data:

| Method | Path |
|---|---|
| POST | `/api/runs/{id}/notes` |
| POST | `/api/runs/{id}/measurements` |
| POST | `/api/runs/{id}/deviations` |
| POST | `/api/runs/{id}/timers` |
| POST | `/api/runs/{id}/timers/{timerId}/elapsed` |
| POST | `/api/runs/{id}/override-requests` |
| POST | `/api/runs/{id}/override-requests/{eventId}/resolve?decision=approved` |

Attachments:

| Method | Path |
|---|---|
| POST | `/api/runs/{id}/attachments` (multipart) |
| GET  | `/api/attachments/{id}/download-url` |

AI:

| Method | Path |
|---|---|
| POST | `/api/runs/{id}/ask` |
| POST | `/api/runs/{id}/steps/{stepId}/photo-check` |
| GET  | `/api/runs/{id}/steps/{stepId}/photo-assessments` |

Handover:

| Method | Path |
|---|---|
| POST | `/api/runs/{id}/handover/generate` |
| GET  | `/api/runs/{id}/handover` |
| POST | `/api/runs/{id}/handover/finalize` |
| GET  | `/api/runs/{id}/handover/pdf` |

Deviations & dashboard:

| Method | Path |
|---|---|
| GET  | `/api/deviations[?state=open]` |
| POST | `/api/deviations/{id}/resolve` |
| GET  | `/api/dashboard` |
| GET  | `/api/dashboard/recent-runs` |

Admin:

| Method | Path |
|---|---|
| GET   | `/api/admin/users` |
| POST  | `/api/admin/users/invite` |
| PATCH | `/api/admin/memberships/{id}` |
| GET   | `/api/admin/settings` |
| PATCH | `/api/admin/settings` |
| GET   | `/api/admin/audit?limit=200` |
| GET   | `/api/admin/webhooks` |
| POST  | `/api/admin/webhooks` |
| DELETE| `/api/admin/webhooks/{id}` |

Sync:

| Method | Path |
|---|---|
| POST | `/api/sync/events` |

## Idempotency

Every mutation accepts an `idempotency_key` field. Replays with the same key on the same run
return the original event without creating a duplicate.

## Error format

```json
{
  "detail": "human-readable message",
  "code": "optional_error_code",
  "payload": { "...": "..." }
}
```
