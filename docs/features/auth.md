# Auth Feature

**Sources inspected:** `apps/frontend/lib/features/auth/`, `apps/backend/src/modules/auth/`, `apps/frontend/lib/app/router/app_router.dart`, `apps/frontend/lib/core/auth/`, `docs/backend/api-catalog.md`, `docs/08-implementation-status.md`

## Purpose

Public signup and login for **LEARNER** and **SUPPLIER** roles, session bootstrap, and authenticated access to protected routes. Profiles are collected inside the `/register` wizard and sent in a single `POST /api/auth/register` call.

**Not in scope (not implemented):** DRIVER/MODERATOR/ADMIN self-registration, learner-only post-login features beyond `/home`.

## Current status

| Layer | Status | Notes |
|-------|--------|-------|
| Backend `auth` module | **Implemented** | Register, login, refresh, logout, me, change-password, secure forgot/reset password |
| Flutter `auth` feature | **Implemented for auth MVP** | Register/login/session/change-password/forgot-reset work; shared Dio refreshes eligible 401s and retries once |
| Role invitations | **Implemented** | Admin invitation UI and `/invite/accept` exist; post-accept role portals vary by role |
| Forgot / reset password UI | **Implemented** | `/forgot-password`, `/reset-password?token=...` |

## Main user flow

1. Guest opens `/register` or `/login`.
2. **Register:** `/register` collects account details, intent (learner / supplier / both), role-aware onboarding options, optional learner location, learner basics, supplier basics, supplier pickup area when sharing materials, and supplier verification document only for organization supplier types. Learner and dual-role flows show broad interest pills for general project/material preferences; goals are specialized for learner, supplier, or dual-role intent. It then calls `POST /api/auth/register`. Organization supplier verification upload/submission happens inside the same wizard after the authenticated session is created.
3. **Login:** email/password → `POST /api/auth/login` → same redirect rule.
4. **Session restore:** app/router sends unknown auth to `/auth/checking` → `AuthController.bootstrapSession()` → refresh + `/me`.
5. **Authenticated request refresh:** shared Dio requests attach the in-memory access token. If an eligible request receives 401, the auth interceptor uses a bare refresh client to call `/api/auth/refresh`, updates the token holder/storage, and retries the original request once.
6. **Change password:** profile security page or supplier account security card → `authController.changePassword` → `PATCH /api/auth/change-password` (returns fresh session).
7. **Forgot/reset password:** `/login` link opens `/forgot-password` with optional email prefill. Forgot always shows a generic success message. Reset reads `token` from the query string, requires new password + confirmation in Flutter, calls `POST /api/auth/reset-password`, and links back to `/login` after success without creating a session.

## Frontend files

**Routes:** `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/checking`; `/complete-learner-profile` and `/complete-supplier-profile` are deprecated fallbacks that redirect to `/register` — see [routes-map](../frontend/routes-map.md).

| Area | Path |
|------|------|
| Application | `features/auth/application/auth_controller.dart`, `auth_providers.dart`, `auth_navigation.dart`, `registration_draft_notifier.dart` |
| Data | `features/auth/data/auth_api.dart`, `auth_repository.dart`, `models/` |
| Pages | `presentation/pages/login_page.dart`, `register_page.dart`, `forgot_password_page.dart`, `reset_password_page.dart`, `auth_checking_page.dart`, `deprecated_onboarding_page.dart` |
| Forms | `presentation/widgets/registration_wizard.dart`, `forgot_password_form.dart`, `reset_password_form.dart`, `complete_learner_profile_form.dart` (deprecated), `complete_supplier_profile_form.dart` (deprecated), `login_form.dart`, `become_learner_wizard.dart`, `become_supplier_wizard.dart`, `portal_switch_menu.dart` |
| Shell / theme | `presentation/widgets/auth_shell.dart`, `auth_*` widgets |

**Legacy (unwired):** `presentation/pages/choose_role_page.dart`, `choose_role_form.dart`.

**Cross-cutting:** `core/auth/token_storage.dart`, `access_token_holder.dart`, `auth_interceptor.dart`, `auth_session_refresh.dart`

## Backend files

| Area | Path |
|------|------|
| Module | `modules/auth/auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.repository.ts`, `auth.validation.ts` |
| Token delivery | `modules/auth/auth-token-delivery.ts` (httpOnly refresh cookie + optional body token) |
| Middleware | `middlewares/auth.middleware.ts`, `rate-limit.middleware.ts`, `role.middleware.ts` (used by other modules) |
| Auth email | `modules/auth/email/*` (mock or SMTP provider for reset/change notifications) |

## API endpoints

| Method | Path | Used by Flutter today |
|--------|------|------------------------|
| POST | `/api/auth/register` | Yes |
| POST | `/api/auth/login` | Yes |
| POST | `/api/auth/refresh` | Yes (bootstrap / interceptor) |
| POST | `/api/auth/logout` | Yes |
| GET | `/api/auth/me` | Yes |
| PATCH | `/api/auth/change-password` | Yes (supplier portal) |
| POST | `/api/auth/forgot-password` | Yes |
| POST | `/api/auth/become-supplier` | Yes |
| POST | `/api/auth/become-learner` | Yes |
| POST | `/api/auth/switch-role` | Yes (account menu, profile, supplier popover) |

Forgot/reset password behavior:
- `POST /api/auth/forgot-password` body `{ email }`; response is always generic for existing and non-existing emails and never includes a reset token.
- Reset links are built from configured `APP_PUBLIC_BASE_URL`; production requires HTTPS.
- Reset tokens use cryptographically secure random bytes, are stored as hashes in `auth_tokens`, expire by `PASSWORD_RESET_EXPIRES_IN` (default `30m`), and older unused reset tokens are invalidated when a new reset is requested.
- `POST /api/auth/reset-password` body `{ token, newPassword }`; successful reset marks the token used, updates the password hash, revokes active refresh tokens, sends a password-changed notification email, and does not auto-login.

Related but separate flow: invitations for `DRIVER`, `MODERATOR`, and `ADMIN` use `/api/invitations/*`, `/api/admin/invitations*`, and `/invite/accept`; see [invitations](invitations.md).

## Database tables

| Table | Role |
|-------|------|
| `users` | Account identity |
| `user_roles` | LEARNER / SUPPLIER (and invitation-assigned roles) |
| `auth_tokens` | Refresh tokens, password reset, OTP hashes |
| `learner_profiles` | Created on register when LEARNER role |
| `supplier_profiles` | Created on register when SUPPLIER role |
| `locations` | Supplier pickup area parsed from `pickupArea` on register — created as `defaultPickupLocation` in `auth.repository.ts` |

## Reusable components

From [reusable-widgets](../frontend/reusable-widgets.md):

- `AppTextField`, `AppTextArea`, `AppDropdownField`, `AppPrimaryButton`, `AppInlineError` — used in profile forms
- Auth-specific widgets (`AuthShell`, `AuthFormCard`, etc.) — **not** promoted for reuse outside auth

## Account status and verification (code-verified)

| Field / gate | Registration default | Login | Refresh | `authMiddleware` protected APIs |
|--------------|---------------------|-------|---------|--------------------------------|
| `accountStatus` | `PENDING_VERIFICATION` (schema default) | Blocks only `SUSPENDED` and `DISABLED` | Same as login | Blocks only `SUSPENDED` and `DISABLED` |
| `emailVerifiedAt` | `null` on public register | Not checked | Not checked | Not checked |
| `phoneVerifiedAt` | `null` on public register | Not checked | Not checked | Not checked |

- **Email verification is not implemented end-to-end.** `AuthTokenType.EMAIL_VERIFICATION` exists in schema, but there is no verify-email API, mail flow, or login gate.
- **Phone verification is not implemented end-to-end.** `AuthTokenType.PHONE_OTP` exists in schema; profile PATCH clears `phoneVerifiedAt` on phone change, but there is no OTP send/verify flow or login gate.
- `PENDING_VERIFICATION` does **not** block login, refresh, or protected API access today. Invitation-created users are created as `ACTIVE` with `emailVerifiedAt` set immediately.

## Session and token behavior (code-verified)

| Topic | Behavior |
|-------|----------|
| Access token | JWT (`sub`, `roles`); default expiry `JWT_ACCESS_EXPIRES_IN` → `15m` |
| Refresh token | JWT stored hashed in `auth_tokens`; rotated on each refresh (old row marked `usedAt`) |
| Refresh reuse | Used refresh tokens are rejected; no token-family reuse detection that revokes all sessions |
| Logout | Revokes the presented refresh token only; web also clears httpOnly cookie |
| Logout-all | **Not implemented** (no API) |
| Change password | Updates hash, revokes **all** refresh tokens in one transaction, issues one fresh session for current client, sends password-changed email (failure logged only) | Profile `/profile/security` + supplier dialog via `authController.changePassword` |
| Reset password | Marks token used, updates hash, revokes **all** user refresh tokens, sends password-changed email; does not auto-login |
| Role changes | `become-supplier`, `become-learner`, and `switch-role` issue fresh access+refresh tokens with updated JWT `roles` |
| Stale JWT roles | Access tokens carry JWT `roles` until expiry; `requireRoles` checks JWT claims, not live DB role rows |
| Suspended user + valid access token | Next protected request fails in `authMiddleware` with `403 ACCOUNT_SUSPENDED` (DB check) |
| Admin manual suspend | Sets `SUSPENDED` but **does not** revoke refresh tokens (unlike strike auto-suspend) |
| Token version / security stamp | **Not implemented** |

### Web vs mobile refresh delivery

| Client | `X-Client-Platform` | Refresh transport | Access token storage |
|--------|---------------------|-------------------|----------------------|
| Web | `web` | httpOnly cookie `refreshToken`, path `/api/auth`, `SameSite=Lax`, `Secure` only in production; **not** returned in JSON | In-memory `AccessTokenHolder` only |
| Mobile | `mobile` | JSON `refreshToken` in login/register/refresh responses | `FlutterSecureStorage` |

Web Dio uses `withCredentials: true`; backend CORS sets `credentials: true`. `WebCookieTokenStorage` is intentionally a no-op.

Bootstrap: `ImpactLoopApp` watches `authNetworkBootstrapProvider`, which microtask-calls `AuthController.bootstrapSession()` → refresh + `/me`.

401 handling: shared `AuthInterceptor` single-flights refresh, retries once, skips auth endpoints and `skipAuthRefresh` requests; refresh failure clears local session.

## Registration rules (code-verified)

- Public roles: `LEARNER`, `SUPPLIER` only (`auth.validation.ts`).
- Email normalized to lowercase via `bodyEmailSchema()`.
- Password policy: min 8, max 128.
- Duplicate email → `409 CONFLICT`; duplicate phone → `409 CONFLICT`.
- Supplier register creates `locations` row for `defaultPickupLocation` inside the same transaction (`auth.repository.ts`).
- Register issues access+refresh immediately regardless of `PENDING_VERIFICATION`.
- Post-register org verification upload failure is recoverable in Flutter without recreating the account.

## Known gaps

- Manual admin suspend should revoke refresh tokens for parity with strike auto-suspend.
- Email/phone verification flows and `PENDING_VERIFICATION` enforcement are product decisions still open.
- Web cookie session persistence across browser restarts is implemented in code but needs manual cross-browser verification.
- `choose_role_page.dart` exists but is **not** in `app_router.dart`.
- Reset/change password on web does not explicitly clear a stale httpOnly refresh cookie unless the user logs out (reset does not auto-login; revoked server tokens still fail refresh).

## Test coverage (auth)

| Area | Backend | Flutter |
|------|---------|---------|
| Registration | `auth.registration.test.ts` | `registration_wizard_test.dart`, `widget_test.dart` |
| Password reset | `auth.password-reset.test.ts` | `auth_password_reset_test.dart` |
| Role switch / become flows | `auth.role-switch.test.ts` | `portal_navigation_test.dart` |
| 401 refresh interceptor | — | `auth_interceptor_test.dart` |
| Login gates by account status | **Not covered** | **Not covered** |
| Change password | `auth.change-password.test.ts` | `auth_change_password_test.dart` |
