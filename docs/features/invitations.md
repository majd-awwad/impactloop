# Invitations Feature

**Sources inspected:** `apps/backend/src/modules/invitations/*`, `apps/backend/src/modules/admin/*`, `apps/backend/src/app.ts`, `apps/backend/prisma/schema.prisma`, `apps/frontend/lib/features/invitations/`, `apps/frontend/lib/features/admin_portal/`, `apps/frontend/lib/app/router/app_router.dart`, `docs/backend/api-catalog.md`, `docs/frontend/routes-map.md`, `docs/08-implementation-status.md`

## Purpose

Invite users into invitation-only operational roles: `DRIVER`, `MODERATOR`, and `ADMIN`.

Public registration remains limited to `LEARNER` and `SUPPLIER`. Invitation tokens must never be stored raw; the database stores token hashes.

## Current status

| Area | Status | Notes |
|------|--------|-------|
| Create invitation | **Implemented** | Admin UI + `/api/admin/invitations` |
| List invitations | **Implemented** | Admin UI + `/api/admin/invitations` |
| Resend invitation | **Implemented** | Admin UI + `/api/admin/invitations/:id/resend` |
| Revoke invitation | **Implemented** | Admin UI + `/api/admin/invitations/:id/revoke` |
| Validate token | **Implemented** | Public `/api/invitations/validate/:token` |
| Accept invitation | **Implemented** | Public `/api/invitations/accept`; Flutter `/invite/accept` |
| Driver profile on accept | **Implemented** | Driver invitations create `DriverProfile` |
| Email delivery | **Partial** | Mock or SMTP provider depending on environment |
| Moderator portal after accept | **Not implemented** | `MODERATOR` role exists, but no workspace |
| Admin portal after accept | **Partial** | `/admin` portal exists |
| Driver portal after accept | **Partial** | `/driver` portal exists |

**Overall:** **Implemented** for invitation creation/list/revoke/resend/validate/accept. Post-accept role experiences vary by role.

## Main flow

1. Admin creates an invitation for `DRIVER`, `MODERATOR`, or `ADMIN`.
2. Backend stores `role_invitations.token_hash`; raw token is only used for delivery or dev/mock response.
3. Invitee opens `/invite/accept?token=...`.
4. Flutter validates the token through `GET /api/invitations/validate/:token`.
5. Invitee submits account details.
6. `POST /api/invitations/accept` creates the user, assigns the invited role, marks the invitation accepted, and creates driver profile when applicable. **It does not issue auth tokens** — Flutter shows success and routes to `/login`.
7. `DRIVER` invitation acceptance also creates a driver profile.

See [invitation-flow](../flows/invitation-flow.md).

## Frontend files

| Area | Path |
|------|------|
| Public accept UI | `apps/frontend/lib/features/invitations/presentation/pages/invite_accept_page.dart` |
| Invitation data | `apps/frontend/lib/features/invitations/data/*` |
| Admin UI | `apps/frontend/lib/features/admin_portal/presentation/pages/admin_invitations_page.dart` |
| Admin data | `apps/frontend/lib/features/admin_portal/data/admin_invitations_api.dart` |
| Routes | `/invite/accept`, `/admin/invitations` |

## Backend files

| File | Role |
|------|------|
| `modules/invitations/invitations.routes.ts` | Public validate/accept and legacy create route |
| `modules/invitations/invitations.controller.ts` | Public invitation handlers |
| `modules/invitations/invitations.service.ts` | Create, validate, accept, session creation |
| `modules/invitations/invitations.repository.ts` | Prisma access and accept transaction |
| `modules/invitations/invitations.validation.ts` | Zod schemas |
| `modules/admin/admin-invitations.controller.ts` | Admin list/create/resend/revoke handlers |
| `modules/admin/admin.routes.ts` | `/api/admin/invitations*` routes |

## API endpoints

Public invitation endpoints:

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/invitations/validate/:token` | Public |
| POST | `/api/invitations/accept` | Public |

Admin invitation endpoints:

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/admin/invitations` | ADMIN |
| POST | `/api/admin/invitations` | ADMIN |
| POST | `/api/admin/invitations/:id/resend` | ADMIN |
| PATCH | `/api/admin/invitations/:id/revoke` | ADMIN |

Legacy/admin-compatible endpoint:

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/invitations` | ADMIN |

### Create body (summary)

`targetRole`: `DRIVER` | `MODERATOR` | `ADMIN`; optional `targetEmail`, `targetPhone`, `notes`.

### Accept body (summary)

`token`, `displayName`, `email`, `password`, optional `phone`. Targeted email/phone invitations must match when set.

## Database tables

| Table | Role |
|-------|------|
| `role_invitations` | Pending/used invitations (`token_hash`, target role/contact, expiry, send status, lifecycle status) |
| `users`, `user_roles` | Created on accept |
| `driver_profiles` | Created on accept for `DRIVER` invitations |
| `auth_tokens` | Refresh session on accept |

Enums: `RoleInvitationTargetRole`, `RoleInvitationStatus`, `RoleInvitationSendStatus` — see [enums](../database/enums.md).

## Role outcomes

| Invited role | After accept |
|--------------|--------------|
| `DRIVER` | User can access partial driver portal |
| `MODERATOR` | Role assigned, but no moderator portal exists |
| `ADMIN` | User can access partial admin portal |

## Known gaps / Needs verification

- Production email/SMS delivery configuration depends on environment; mock provider may expose dev token behavior.
- Production value of invitation expiry needs environment verification.
- Moderator role has no post-login workspace.
- Admin resend/revoke behavior should be manually tested against email provider configuration before production.

## Related docs

- [Roles and capabilities](roles-and-capabilities.md)
- [Auth](auth.md)
- [Admin](admin.md)
- [Invitation flow](../flows/invitation-flow.md)
