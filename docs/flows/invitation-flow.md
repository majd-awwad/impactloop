# Invitation Flow

**Sources inspected:** `apps/backend/src/modules/invitations/*`, `apps/backend/src/modules/auth/*`, `docs/features/invitations.md`

## Trigger

An **ADMIN** user needs to onboard a **DRIVER**, **MODERATOR**, or **ADMIN** account outside public LEARNER/SUPPLIER registration.

**Prerequisite:** No full admin portal — flow is **API-only** today.

---

## Flow — Create invitation (admin)

### Trigger

Authenticated ADMIN calls create endpoint (manual API / script).

### User path

N/A in Flutter — operator uses API client with ADMIN credentials.

### Frontend path

**Not implemented.**

### Backend path

1. `POST /api/invitations` — `authMiddleware` + `requireRoles('ADMIN')`.
2. `createInvitation` generates opaque token, stores `hashToken(rawToken)` in `role_invitations`.
3. Response: invitation summary; in `development`, includes `inviteToken` for manual distribution.

### Database changes

Insert `role_invitations` (`status: PENDING`, `expires_at` from `env.invitationExpiresIn`).

### Success state

`201` with invitation metadata (and dev token).

### Error states

- 401/403 if not authenticated ADMIN
- Validation errors on body (invalid role, email format, etc.)

### Files involved

`invitations.routes.ts`, `invitations.controller.ts`, `invitations.service.ts`, `invitations.repository.ts`, `utils/token.ts`

---

## Flow — Validate token (pre-accept)

### Trigger

Prospective invitee opens link with token (future UI) or client calls validate before showing accept form.

### User path

Check whether token is still valid and which role/email it targets.

### Frontend path

**Not implemented.**

### Backend path

`GET /api/invitations/validate/:token` → `validateInvitationToken` → lookup pending, non-expired invitation by token hash.

### Database changes

Read-only.

### Success state

`{ valid: true, targetRole, targetEmail?, expiresAt? }` or `{ valid: false }`.

### Error states

Invalid/expired token → `valid: false` (not necessarily HTTP error).

### Files involved

`invitations.routes.ts`, `invitations.service.ts`, `invitations.repository.ts`

---

## Flow — Accept invitation (register invited role)

### Trigger

Invitee submits account details with invitation token.

### User path

N/A in Flutter — API client posts accept payload.

### Frontend path

**Not implemented.**

### Backend path

1. `POST /api/invitations/accept` (public, no JWT).
2. Resolve pending invitation by token hash.
3. Validate email/phone match invitation targets when provided.
4. Reject if email/phone already registered (`409 CONFLICT`).
5. `acceptInvitationTransaction`: create `users` + `user_roles`, mark invitation used.
6. `createAuthSessionForUser` → access + refresh tokens (same as login response).

### Database changes

Insert `users`, `user_roles`; update `role_invitations` (`status`, `used_at`, `used_by_user_id`); insert `auth_tokens` for refresh.

### Success state

`201` with auth session payload (user + tokens).

### Error states

| Condition | Response |
|-----------|----------|
| Invalid/expired token | 400 `VALIDATION_ERROR` |
| Email mismatch | 400 `VALIDATION_ERROR` |
| Phone mismatch | 400 `VALIDATION_ERROR` |
| Email already exists | 409 `CONFLICT` |
| Phone already exists | 409 `CONFLICT` |

### Files involved

`invitations.service.ts`, `invitations.repository.ts`, `auth.service.ts`, `auth.repository.ts`

---

## Not implemented

- Admin portal to create/manage invitations
- Flutter accept-invitation page / deep link route
- Email or SMS token delivery
- Invitation revoke/list APIs
- Post-accept DRIVER/MODERATOR/ADMIN dashboards

---

## Open questions

- Production distribution of `inviteToken` without email service?
- Should validate endpoint rate-limit token guessing?
- Profile onboarding for DRIVER/MODERATOR after accept?
