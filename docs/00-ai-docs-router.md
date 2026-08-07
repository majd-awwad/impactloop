# AI Documentation Router

Before editing code, read this file.

## Always read first

- [AGENTS.md](../AGENTS.md)
- [01-project-map.md](01-project-map.md)
- [02-architecture.md](02-architecture.md)
- [08-implementation-status.md](08-implementation-status.md) — what is actually built
- [09-open-questions.md](09-open-questions.md) — unresolved risks and **Needs verification** items
- [features/roles-and-capabilities.md](features/roles-and-capabilities.md) — canonical role-scope framing with implemented vs planned capabilities

## If editing Flutter

Read:

- [frontend/routes-map.md](frontend/routes-map.md)
- [frontend/reusable-widgets.md](frontend/reusable-widgets.md)
- [frontend/state-management.md](frontend/state-management.md) if Riverpod providers/controllers/repositories changed
- [07-theme-system.md](07-theme-system.md) if theme, tokens, palettes, reusable visual primitives, or dark/light behavior changed
- [07-ui-style-guide.md](07-ui-style-guide.md) only if auth UI changed (legacy/auth-specific reference)
- **Future:** `06-frontend-guide.md` — not written yet

Update:

- [frontend/routes-map.md](frontend/routes-map.md) if routes/guards changed
- [frontend/reusable-widgets.md](frontend/reusable-widgets.md) if a shared widget was added/changed
- [frontend/state-management.md](frontend/state-management.md) if provider/controller/repository organization changed
- [07-theme-system.md](07-theme-system.md) if shared theme, tokens, palettes, dark/light handling, or reusable visual architecture changed
- [08-implementation-status.md](08-implementation-status.md) if feature ship status changed
- Matching [features/](features/) and [flows/](flows/) doc when user-facing behavior changed (see [Feature & flow docs](#feature--flow-docs))

## If editing backend API

Read:

- [04-api-conventions.md](04-api-conventions.md)
- [backend/api-catalog.md](backend/api-catalog.md)
- [backend/modules-map.md](backend/modules-map.md)
- [backend/observability.md](backend/observability.md) if error handling, logging, or request correlation changed

Update:

- [backend/api-catalog.md](backend/api-catalog.md) if endpoint/request/response changed
- [backend/modules-map.md](backend/modules-map.md) if module responsibilities changed
- [backend/observability.md](backend/observability.md) if error handling, logging, or request correlation changed
- [08-implementation-status.md](08-implementation-status.md) if feature ship status changed
- Matching [features/](features/) and [flows/](flows/) doc when API or flow behavior changed (see [Feature & flow docs](#feature--flow-docs))

## If editing Prisma/database

Read:

- [database/schema-overview.md](database/schema-overview.md)
- [database/tables-catalog.md](database/tables-catalog.md)
- [database/enums.md](database/enums.md)

Update:

- [database/schema-overview.md](database/schema-overview.md) if model relationships changed
- [database/tables-catalog.md](database/tables-catalog.md) if table/field meaning changed
- [database/enums.md](database/enums.md) if enums changed
- [08-implementation-status.md](08-implementation-status.md) if schema enables new capability
- **Future:** `docs/adr/` for major design decisions

**Stale:** [03-database.md](03-database.md) — do not update; use `docs/database/*` instead.

## If editing auth/roles/security

Read:

- [04-api-conventions.md](04-api-conventions.md)
- [backend/api-catalog.md](backend/api-catalog.md) (auth section)
- [features/auth.md](features/auth.md)
- [flows/auth-flow.md](flows/auth-flow.md)
- [features/invitations.md](features/invitations.md) if invitation roles change
- [flows/invitation-flow.md](flows/invitation-flow.md)

Ask the human if:

- A new role is introduced
- Public registration rules change
- Token storage changes
- Role permissions change

## Feature & flow docs

Code-derived narratives. Status labels match [08-implementation-status.md](08-implementation-status.md).

### Phase 2A — core features

| Feature | Feature doc | Flow doc(s) | Ship status (summary) |
|---------|-------------|-------------|------------------------|
| Roles and capabilities | [features/roles-and-capabilities.md](features/roles-and-capabilities.md) | — | Product framing; mixes current code status with planned capabilities |
| Auth | [features/auth.md](features/auth.md) | [flows/auth-flow.md](flows/auth-flow.md) | **Implemented for auth MVP** — login/register/refresh/logout/me, forgot/reset, role switch; email/phone verification not implemented; change-password does not revoke sessions |
| Material discovery | [features/material-discovery.md](features/material-discovery.md) | [flows/material-discovery-flow.md](flows/material-discovery-flow.md) | **Implemented** |
| Supplier portal | [features/supplier-portal.md](features/supplier-portal.md) | [flows/supplier-material-listing-flow.md](flows/supplier-material-listing-flow.md), [flows/supplier-reservation-flow.md](flows/supplier-reservation-flow.md) | **Partial** — material read/create/edit/delete; supplier reservations; delivery complete guarded backend-only |
| Learning hub | [features/learning-hub.md](features/learning-hub.md) | [flows/learning-hub-browse-flow.md](flows/learning-hub-browse-flow.md) | **Partial** — read path API-backed (`/learning`, `/learning/:id`, Home spotlight); add-draft submit, admin moderation, server-side page navigation, and learner project likes/saves/follows/reviews wired; legacy mock file retained for sample catalog only |

### Phase 2B — supporting features

| Area | Feature doc | Flow doc(s) | Ship status (summary) |
|------|-------------|-------------|------------------------|
| Materials listing (shared data layer) | [features/materials-listing.md](features/materials-listing.md) | — (see [supplier-material-listing-flow](flows/supplier-material-listing-flow.md)) | **Partial** — supplier create support; no update/delete |
| Locations | [features/locations.md](features/locations.md) | — | **Partial** — forward/reverse geocode + profile/material usage; public redaction **Needs verification** |
| Invitations | [features/invitations.md](features/invitations.md) | [flows/invitation-flow.md](flows/invitation-flow.md) | **Implemented** — admin UI + accept UI exist; email delivery depends on provider |
| Landing | [features/landing.md](features/landing.md) | — | **Implemented** — static UI; no API |
| Home (learner) | [features/home-learner.md](features/home-learner.md) | `GET /api/learner/home` | **Partial** — personalized home feed (7 sections) **API-backed** |

### Phase 2C — gaps and open questions

| Area | Feature doc | Flow doc(s) | Ship status (summary) |
|------|-------------|-------------|------------------------|
| Open questions (index) | [09-open-questions.md](09-open-questions.md) | — | Unresolved / **Needs verification** across features |
| Reservations (learner) | [features/reservations.md](features/reservations.md) | [flows/learner-reservation-flow.md](flows/learner-reservation-flow.md) | Learner create/read + material detail status **Partial**; supplier workflow **Partial** |
| Payments (Mock) | [features/payments.md](features/payments.md) | [flows/payment-flow.md](flows/payment-flow.md) | **Implemented** for local Mock + enforcement-ON (PAY-01…PAY-07); real PSP / Admin Payment Center not implemented |
| Delivery | [features/delivery.md](features/delivery.md) | [flows/delivery-flow.md](flows/delivery-flow.md) | **Partial** — learner request/status/tracking summary/map marker UI and driver jobs/status/manual ping UI; realtime tracking stream not implemented |
| AI material matching agent | [features/ai-agent.md](features/ai-agent.md) | [flows/ai-material-matching-flow.md](flows/ai-material-matching-flow.md) | **Not implemented** (distinct from price suggestion **Partial**) |
| Admin portal | [features/admin.md](features/admin.md) | — | **Partial** — dashboard, invitations, supplier verification, approvals, materials moderation, and people management |
| Moderator portal | [features/moderator.md](features/moderator.md) | — | **Not implemented** |

Gap docs are stubs — see [09-open-questions.md](09-open-questions.md) before implementing.

**Not documented as implemented:** live realtime tracking stream, AI material matching agent, moderator portal, persisted project build checklist, and moderator-owned project review workflow.

ADRs (`docs/adr/`) — accepted architecture decisions.

## Doc filename reference

| Older / planned name | Use instead |
|----------------------|-------------|
| `01-project-map.md` | ✅ exists |
| `05-database-guide.md` | `database/schema-overview.md` + `tables-catalog.md` |
| `06-frontend-guide.md` | Not written — use `frontend/routes-map.md` + `frontend/reusable-widgets.md` + `frontend/state-management.md` |
| `07-ui-style-guide.md` | Legacy/auth-specific reference — use `07-theme-system.md` for app theme architecture |

## ADRs

Use [docs/adr/](adr/) for accepted architecture decisions. Do not create ADRs for unresolved questions or not-implemented features unless the ADR explicitly records a proven current decision.

## If unsure whether docs need update

Ask explicitly:

"Should I update docs for this change? The likely files are: ..."

Do not silently skip documentation when behavior, API, DB, architecture, or reusable UI changed.

## No docs update needed when

- Pure formatting
- Renaming local variables only
- Fixing typo in private implementation without behavior change
- Minor styling inside one screen without shared theme/design impact

## Aspirational docs (context only — not implementation proof)

- [00-vision.md](00-vision.md)
- [01-requirements.md](01-requirements.md)
- [04-api-conventions.md](04-api-conventions.md) — conventions yes; endpoint list → [backend/api-catalog.md](backend/api-catalog.md)
- [05-roadmap.md](05-roadmap.md)
- [03-database.md](03-database.md)

Always verify against code and [08-implementation-status.md](08-implementation-status.md).

## Recommendation System

Start with:

* `docs/recommendation/README.md`

Read the full evaluation specification only for recommendation experiments, datasets, model evaluation, or model promotion:

* `docs/recommendation/recommendation-evaluation-experiment-spec.ar.md`

Architecture decisions:

* `docs/recommendation/decisions.md`

Verified implementation state:

* `docs/recommendation/implementation-status.md`

Do not load the full recommendation specification for unrelated tasks.
