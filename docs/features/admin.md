# Admin Feature (Gap Doc)

**Gap / stub — not an implementation guide.**

**Sources inspected:** `apps/backend/src/app.ts`, `apps/backend/src/modules/invitations/*`, `apps/frontend/lib/features/` (no `admin` folder), `apps/frontend/lib/app/router/app_router.dart`, `docs/01-requirements.md` (§Admin), `docs/05-roadmap.md` (Phase 7), `docs/features/invitations.md`, `docs/08-implementation-status.md`

## Intended purpose (requirements / roadmap — aspirational)

From [01-requirements.md](01-requirements.md) and [05-roadmap.md](05-roadmap.md) Phase 7:

- Admin dashboard, user/material/project/reservation/delivery management.
- Create Driver and Moderator invitation links.
- View AI logs and reports.

## Current code status

| Layer | Status | Evidence |
|-------|--------|----------|
| `admin` backend module | **Not implemented** | No folder under `modules/` |
| Admin Flutter feature / routes | **Not implemented** | No `features/admin`; no `/admin` in `app_router.dart` |
| `POST /api/invitations` (ADMIN create) | **Backend-only** | Only admin-gated API found |
| User/material/project/reservation admin APIs | **Not implemented** | No CRUD admin routers |
| Reports / AI log admin UI | **Not implemented** | |

**Overall:** **Not implemented** as a portal; **Backend-only** fragment via invitations create API.

## Existing related files

| Path | Role |
|------|------|
| `modules/invitations/invitations.routes.ts` | `requireRoles('ADMIN')` on create |
| `modules/invitations/invitations.service.ts` | Create/validate/accept |
| `middlewares/role.middleware.ts` | Role checks (used by invitations, supplier) |

No admin-specific frontend or backend controllers beyond invitations.

## What is missing

- Admin dashboard (web/mobile).
- User management, role assignment UI (beyond invitation accept).
- System stats, delivery oversight, reservation admin views.
- Invitation list/revoke/email from UI.
- AI usage and report viewers.
- Moderator queue hosting or separate moderator portal (see [moderator](moderator.md)).

## Risks

- Admins must use raw API/Postman for invitations today; dev-only `inviteToken` in response.
- No audit UI for sensitive actions.
- Phase 7 roadmap scope large — needs vertical slices.

## Questions before implementation

- Single `/admin` Flutter app vs web-only admin?
- Reuse `invitations` API or expand admin module?
- Which MVP admin screens first (invites only vs full user list)?
- See [09-open-questions.md](../09-open-questions.md) § Admin.

## Related docs

- [Invitations](invitations.md), [invitation-flow](../flows/invitation-flow.md)
- [Moderator](moderator.md)
