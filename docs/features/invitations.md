# Invitations Feature

**Sources inspected:** `apps/backend/src/modules/invitations/*`, `apps/backend/src/app.ts`, `apps/backend/prisma/schema.prisma` (`RoleInvitation`), `apps/backend/src/config/env.ts`, `docs/backend/api-catalog.md`, `docs/08-implementation-status.md`

## Purpose

Invite users into **invitation-only roles**: `DRIVER`, `MODERATOR`, `ADMIN`. Public registration remains **LEARNER** and **SUPPLIER** only (`auth` module).

This is a **backend API fragment** — there is **no** admin portal, **no** Flutter accept UI, and **no** email delivery integration in code (dev returns raw token). This module is **Partial** at backend/module level and **Backend-only** from the Flutter UI perspective.

## Current status

| Area | Status | Notes |
|------|--------|-------|
| Admin create invitation | **Backend-only** | `POST /api/invitations` — ADMIN JWT |
| Validate token | **Backend-only** | `GET /api/invitations/validate/:token` — public |
| Accept invitation | **Backend-only** | `POST /api/invitations/accept` — creates user + session |
| Email / SMS delivery | **Not implemented** | Dev-only `inviteToken` in create response |
| Admin UI | **Not implemented** | No `admin` Flutter feature |
| Accept UI | **Not implemented** | No `invitation` references in `apps/frontend` |
| List/revoke invitations | **Not implemented** | No list/delete endpoints |

## Main flow (API-only)

1. **ADMIN** calls create with `targetRole`, optional `targetEmail` / `targetPhone`, `notes`.
2. System stores `role_invitations` with hashed token; in development, raw token returned once.
3. Invitee (external client) validates token → receives role + expiry metadata.
4. Invitee accepts with account details → user created with target role → auth session returned (same shape as login).

See [invitation-flow](../flows/invitation-flow.md).

## Frontend files

**None** — no Flutter module or routes for invitations.

## Backend files

| File | Role |
|------|------|
| `modules/invitations/invitations.routes.ts` | Route mounting |
| `modules/invitations/invitations.controller.ts` | HTTP handlers |
| `modules/invitations/invitations.service.ts` | Create, validate, accept + session |
| `modules/invitations/invitations.repository.ts` | Prisma access + accept transaction |
| `modules/invitations/invitations.validation.ts` | Zod schemas |
| `modules/auth/auth.service.ts` | `createAuthSessionForUser` on accept |

## API endpoints

Mounted at `/api/invitations` (`app.ts`).

| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/api/invitations` | Bearer JWT | **ADMIN** |
| GET | `/api/invitations/validate/:token` | Public | — |
| POST | `/api/invitations/accept` | Public | — |

### Create body (summary)

`targetRole`: `DRIVER` | `MODERATOR` | `ADMIN`; optional `targetEmail`, `targetPhone`, `notes`.

### Accept body (summary)

`token`, `displayName`, `email`, `password`, optional `phone` — must match invitation targets when set.

## Database tables

| Table | Role |
|-------|------|
| `role_invitations` | Pending/used invitations (`token_hash`, `target_role`, `expires_at`, `status`, etc.) |
| `users`, `user_roles` | Created on accept |
| `auth_tokens` | Refresh session on accept |

Enums: `RoleInvitationTargetRole`, `RoleInvitationStatus` — see [enums](../database/enums.md).

## Reusable components

None in Flutter.

## Known gaps / Needs verification

- **No admin portal** — invitations must be created via API client (Postman, seed, or future admin UI).
- **No email** — `createInvitation` TODO notes dev-only token exposure.
- No invitation list, cancel, or resend endpoints.
- DRIVER/MODERATOR/ADMIN **portals** — **not implemented** after accept.
- Expiry duration from `env.invitationExpiresIn` — **Needs verification** of production `.env` value.

## Related docs

- [Auth](auth.md) — public registration vs invitation roles
- [Invitation flow](../flows/invitation-flow.md)
