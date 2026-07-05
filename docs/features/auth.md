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
6. **Change password:** supplier account security card → `PATCH /api/auth/change-password` (uses `authRepository`).
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
| `locations` | Supplier pickup area parsed from `pickupArea` on register — **Needs verification** of exact create path in `auth.repository.ts` |

## Reusable components

From [reusable-widgets](../frontend/reusable-widgets.md):

- `AppTextField`, `AppTextArea`, `AppDropdownField`, `AppPrimaryButton`, `AppInlineError` — used in profile forms
- Auth-specific widgets (`AuthShell`, `AuthFormCard`, etc.) — **not** promoted for reuse outside auth

## Known gaps / Needs verification

- Web refresh token: `WebCookieTokenStorage` is a no-op; refresh relies on **httpOnly cookie** from backend (`auth-token-delivery.ts`) and a credentialed bare refresh Dio client — **Needs verification** on all browsers.
- Existing learner accounts can become suppliers from `/become-supplier` via `POST /api/auth/become-supplier` without creating a second account or removing `LEARNER`. Only **Student supplier** and **Individual supplier** types are allowed in this self-upgrade flow; organization types (`WORKSHOP`, `FACTORY`, `EDUCATIONAL_INSTITUTION`) are rejected with a separate-verification message. Admin, moderator, driver, and accounts that already have a supplier profile cannot use this endpoint. The response issues fresh auth tokens so supplier API routes authorize immediately.
- Personal suppliers (`STUDENT_SUPPLIER`, `INDIVIDUAL_SUPPLIER`) without learner access can add learner role from `/become-learner` via `POST /api/auth/become-learner`. The page reuses `RegistrationWizard` with `LearnerSetupMode.addToExistingAccount` (same interests/goals/location/learner-basics steps as registration, without account fields). Organization supplier types, admin, moderator, and driver cannot use this endpoint. Response sets `activeRole` to `LEARNER` and returns refreshed auth session.
- Dual-role users switch active portal with `POST /api/auth/switch-role` (`activeRole` = `LEARNER` or `SUPPLIER`). Organization supplier types (`WORKSHOP`, `FACTORY`, `EDUCATIONAL_INSTITUTION`) cannot switch to learner unless they already have the `LEARNER` role. Response includes refreshed auth tokens and updated `user`.
- `RegistrationIntent.both` registers both roles in one `/register` wizard. Interests are collected once and mapped to `learnerProfile.interests`; learner bio is not collected during registration. Student/self-learner selections can suggest a matching supplier type, supplier public name defaults to the account full name, and supplier `pickupArea` is derived from onboarding city/area. Default `activeRole` after register is `LEARNER` when both roles are present.
- Email/phone verification enforcement — **Needs verification** (`account_status` vs actual gate).
- `choose_role_page.dart` exists but is **not** in `app_router.dart`.
