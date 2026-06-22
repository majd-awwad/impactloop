# Auth Feature

**Sources inspected:** `apps/frontend/lib/features/auth/`, `apps/backend/src/modules/auth/`, `apps/frontend/lib/app/router/app_router.dart`, `apps/frontend/lib/core/auth/`, `docs/backend/api-catalog.md`, `docs/08-implementation-status.md`

## Purpose

Public signup and login for **LEARNER** and **SUPPLIER** roles, session bootstrap, and authenticated access to protected routes. Profiles are collected during multi-step registration and sent in a single `POST /api/auth/register` call.

**Not in scope (not implemented):** DRIVER/MODERATOR/ADMIN self-registration, forgot-password UI, invitation acceptance UI, learner-only post-login features beyond `/home`.

## Current status

| Layer | Status | Notes |
|-------|--------|-------|
| Backend `auth` module | **Implemented** | Register, login, refresh, logout, me, change-password, forgot/reset **API** |
| Flutter `auth` feature | **Partial** | Register/login/session/change-password work; forgot-password shows “coming soon” |
| Role invitations | **Backend-only** | `invitations` module — no Flutter accept flow |
| Forgot / reset password UI | **Not implemented** | `login_form.dart` |

## Main user flow

1. Guest opens `/register` or `/login`.
2. **Register:** basic info + intent (learner / supplier / both) → profile completion page(s) → `POST /api/auth/register` → redirect to `/home` or `/supplier` based on roles.
3. **Login:** email/password → `POST /api/auth/login` → same redirect rule.
4. **Session restore:** app/router sends unknown auth to `/auth/checking` → `AuthController.bootstrapSession()` → refresh + `/me`.
5. **Change password:** supplier account security card → `PATCH /api/auth/change-password` (uses `authRepository`).

## Frontend files

**Routes:** `/login`, `/register`, `/auth/checking`, `/complete-learner-profile`, `/complete-supplier-profile` — see [routes-map](../frontend/routes-map.md).

| Area | Path |
|------|------|
| Application | `features/auth/application/auth_controller.dart`, `auth_providers.dart`, `auth_navigation.dart`, `registration_draft_notifier.dart` |
| Data | `features/auth/data/auth_api.dart`, `auth_repository.dart`, `models/` |
| Pages | `presentation/pages/login_page.dart`, `register_page.dart`, `auth_checking_page.dart`, `complete_*_profile_page.dart` |
| Forms | `presentation/widgets/unified_register_form.dart`, `complete_learner_profile_form.dart`, `complete_supplier_profile_form.dart`, `login_form.dart` |
| Shell / theme | `presentation/widgets/auth_shell.dart`, `auth_*` widgets |

**Legacy (unwired):** `presentation/pages/choose_role_page.dart`, `choose_role_form.dart`.

**Cross-cutting:** `core/auth/token_storage.dart`, `access_token_holder.dart`, `auth_interceptor.dart`

## Backend files

| Area | Path |
|------|------|
| Module | `modules/auth/auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.repository.ts`, `auth.validation.ts` |
| Token delivery | `modules/auth/auth-token-delivery.ts` (httpOnly refresh cookie + optional body token) |
| Middleware | `middlewares/auth.middleware.ts`, `role.middleware.ts` (used by other modules) |

## API endpoints

| Method | Path | Used by Flutter today |
|--------|------|------------------------|
| POST | `/api/auth/register` | Yes |
| POST | `/api/auth/login` | Yes |
| POST | `/api/auth/refresh` | Yes (bootstrap / interceptor) |
| POST | `/api/auth/logout` | Yes |
| GET | `/api/auth/me` | Yes |
| PATCH | `/api/auth/change-password` | Yes (supplier portal) |
| POST | `/api/auth/forgot-password` | **No UI** |
| POST | `/api/auth/reset-password` | **No UI** |

Related but separate module: `/api/invitations/*` — **Backend-only**.

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

- Forgot-password and reset-password screens **not implemented** on Flutter.
- Web refresh token: `WebCookieTokenStorage` is a no-op; refresh relies on **httpOnly cookie** from backend (`auth-token-delivery.ts`) — **Needs verification** on all browsers.
- `RegistrationIntent.both` registers both roles in one API call after both profile steps.
- Email/phone verification enforcement — **Needs verification** (`account_status` vs actual gate).
- `choose_role_page.dart` exists but is **not** in `app_router.dart`.
