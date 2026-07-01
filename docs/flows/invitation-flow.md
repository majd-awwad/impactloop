# Invitation Flow

**Sources inspected:** `apps/backend/src/modules/invitations/*`, `apps/backend/src/modules/admin/*`, `apps/backend/src/modules/auth/*`, `apps/frontend/lib/features/invitations/`, `apps/frontend/lib/features/admin_portal/`, `docs/features/invitations.md`

## Trigger

An **ADMIN** user needs to onboard a **DRIVER**, **MODERATOR**, or **ADMIN** account outside public LEARNER/SUPPLIER registration.

**Prerequisite:** Admin user has `ADMIN` role. Admin accounts are invitation-only.

---

## Flow — Create invitation (admin)

### Trigger

Authenticated ADMIN creates an invitation from the admin invitations page or API.

### User path

Admin opens `/admin/invitations`, fills target role/contact details, and submits the invitation.

### Frontend path

`AdminInvitationsPage` uses `admin_invitations_api.dart` and invalidates the admin invitation list after successful create/resend/revoke.

### Backend path

1. Preferred route: `POST /api/admin/invitations` — `authMiddleware` + `requireRoles('ADMIN')`.
2. Legacy/admin-compatible route: `POST /api/invitations`.
3. `createInvitation` generates opaque token, stores `hashToken(rawToken)` in `role_invitations`.
4. Email/mock provider attempts delivery when configured.
5. Response returns invitation summary; mock/dev behavior may expose delivery token metadata for local testing.

### Database changes

Insert `role_invitations` (`status: PENDING`, `expires_at` from `env.invitationExpiresIn`).

### Success state

`201` with invitation metadata.

### Error states

- 401/403 if not authenticated ADMIN
- Validation errors on body (invalid role, email format, etc.)

### Files involved

`admin.routes.ts`, `admin-invitations.controller.ts`, `invitations.routes.ts`, `invitations.controller.ts`, `invitations.service.ts`, `invitations.repository.ts`, `utils/token.ts`

---

## Flow — Validate token (pre-accept)

### Trigger

Prospective invitee opens `/invite/accept?token=...`.

### User path

Flutter checks whether token is still valid and which role/contact it targets before showing the accept form.

### Frontend path

`InviteAcceptPage` reads the token query parameter and calls the invitation validation API.

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

Invitee submits account details from `/invite/accept`.

### User path

Invitee completes display name, email, password, and optional phone fields. Targeted email/phone invitations must match the invitation.

### Frontend path

`InviteAcceptPage` submits the accept payload through the invitations data layer.

### Backend path

1. `POST /api/invitations/accept` (public, no JWT).
2. Resolve pending invitation by token hash.
3. Validate email/phone match invitation targets when provided.
4. Reject if email/phone already registered (`409 CONFLICT`).
5. `acceptInvitationTransaction`: create `users` + `user_roles`, mark invitation used.
6. If target role is `DRIVER`, create `driver_profiles`.
7. `createAuthSessionForUser` returns access + refresh tokens (same as login response).

### Database changes

Insert `users`, `user_roles`; insert `driver_profiles` for driver invitations; update `role_invitations` (`status`, `used_at`, `used_by_user_id`); insert `auth_tokens` for refresh.

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

## Admin manage invitations

Implemented under `/admin/invitations`:

- List invitations.
- Resend invitation.
- Revoke invitation.

Backend routes:

- `GET /api/admin/invitations`
- `POST /api/admin/invitations/:id/resend`
- `PATCH /api/admin/invitations/:id/revoke`

## Not implemented / partial

- Moderator post-accept portal.
- Full admin audit trail for invitation operations.
- Production email/SMS behavior needs environment verification.
- Driver and admin portals are partial role experiences after accept.

---

## Open questions

- Production distribution behavior when email provider is not configured?
- Should validate endpoint rate-limit token guessing?
- What moderator onboarding/workspace should exist after accept?
