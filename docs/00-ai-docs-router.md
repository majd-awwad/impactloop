# AI Documentation Router

Before editing code, read this file.

## Always read first

- [AGENTS.md](../AGENTS.md)
- [01-project-map.md](01-project-map.md)
- [02-architecture.md](02-architecture.md)
- [08-implementation-status.md](08-implementation-status.md) — what is actually built

## If editing Flutter

Read:

- [frontend/routes-map.md](frontend/routes-map.md)
- [frontend/reusable-widgets.md](frontend/reusable-widgets.md)
- [07-ui-style-guide.md](07-ui-style-guide.md) if auth UI changed (partial theme coverage)
- **Future:** `06-frontend-guide.md` — not written yet

Update:

- [frontend/routes-map.md](frontend/routes-map.md) if routes/guards changed
- [frontend/reusable-widgets.md](frontend/reusable-widgets.md) if a shared widget was added/changed
- [08-implementation-status.md](08-implementation-status.md) if feature ship status changed
- Matching [features/](features/) and [flows/](flows/) doc when user-facing behavior changed (see [Feature & flow docs](#feature--flow-docs))

## If editing backend API

Read:

- [04-api-conventions.md](04-api-conventions.md)
- [backend/api-catalog.md](backend/api-catalog.md)
- [backend/modules-map.md](backend/modules-map.md)

Update:

- [backend/api-catalog.md](backend/api-catalog.md) if endpoint/request/response changed
- [backend/modules-map.md](backend/modules-map.md) if module responsibilities changed
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
| Auth | [features/auth.md](features/auth.md) | [flows/auth-flow.md](flows/auth-flow.md) | **Partial** — forgot-password UI not built |
| Material discovery | [features/material-discovery.md](features/material-discovery.md) | [flows/material-discovery-flow.md](flows/material-discovery-flow.md) | **Implemented** |
| Supplier portal | [features/supplier-portal.md](features/supplier-portal.md) | [flows/supplier-material-listing-flow.md](flows/supplier-material-listing-flow.md), [flows/supplier-reservation-flow.md](flows/supplier-reservation-flow.md) | **Partial** — material read/create; supplier reservations only; no learner create |
| Learning hub | [features/learning-hub.md](features/learning-hub.md) | [flows/learning-hub-browse-flow.md](flows/learning-hub-browse-flow.md) | **Partial** — Flutter **mock-only**; `GET /api/learning-projects` **backend-only** until wired |

### Phase 2B — supporting features

| Area | Feature doc | Flow doc(s) | Ship status (summary) |
|------|-------------|-------------|------------------------|
| Materials listing (shared data layer) | [features/materials-listing.md](features/materials-listing.md) | — (see [supplier-material-listing-flow](flows/supplier-material-listing-flow.md)) | **Partial** — supplier create support; no update/delete |
| Locations | [features/locations.md](features/locations.md) | — | **Partial** — reverse geocode + profile/material usage; public redaction **Needs verification** |
| Invitations | [features/invitations.md](features/invitations.md) | [flows/invitation-flow.md](flows/invitation-flow.md) | **Backend-only** — no admin portal or Flutter accept UI |
| Landing | [features/landing.md](features/landing.md) | — | **Implemented** — static UI; no API |
| Home (learner) | [features/home-learner.md](features/home-learner.md) | — | **Partial** — suggested materials **API-backed**; learning spotlight **mock-only** |

**Not documented as implemented:** learner reservations, delivery, AI agent, admin portal, moderator portal (unless code changes prove otherwise).

ADRs (`docs/adr/`) — not written yet.

## Doc filename reference

| Older / planned name | Use instead |
|----------------------|-------------|
| `01-project-map.md` | ✅ exists |
| `05-database-guide.md` | `database/schema-overview.md` + `tables-catalog.md` |
| `06-frontend-guide.md` | Not written — use `frontend/routes-map.md` + `reusable-widgets.md` |
| `07-theme-system.md` | `07-ui-style-guide.md` (auth only) until theme doc expanded |

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
