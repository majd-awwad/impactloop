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
- **Future:** `docs/features/<feature>.md` when that doc exists

## If editing backend API

Read:

- [04-api-conventions.md](04-api-conventions.md)
- [backend/api-catalog.md](backend/api-catalog.md)
- [backend/modules-map.md](backend/modules-map.md)

Update:

- [backend/api-catalog.md](backend/api-catalog.md) if endpoint/request/response changed
- [backend/modules-map.md](backend/modules-map.md) if module responsibilities changed
- [08-implementation-status.md](08-implementation-status.md) if feature ship status changed
- **Future:** `docs/features/<feature>.md`, `docs/flows/<flow>.md`

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
- **Future:** `docs/features/auth.md`, `docs/flows/auth-flow.md`

Ask the human if:

- A new role is introduced
- Public registration rules change
- Token storage changes
- Role permissions change

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
