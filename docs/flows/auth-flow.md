# Auth Flow

**Sources inspected:** `auth_controller.dart`, `auth_repository.dart`, `registration_wizard.dart`, `app_router.dart`, `auth.routes.ts`, `auth.service.ts`, `auth.validation.ts`

## Trigger

User chooses **Sign up** or **Sign in**, or app loads a protected route while session is unknown.

---

## Flow A — Register (learner only)

### User path

1. `/register` → select **Find materials**, fill account fields, broad learner interests, learner-specific goals, optional city/area, learner type, and skill level.
2. Review inside `/register`.
3. Submit → account created → land on `/home`.

### Frontend path

`RegistrationWizard` → `registrationDraftProvider` → `authController.register(draft.toRegisterRequest())` → `context.go(postAuthRouteForUser(user))`.

### Backend path

`POST /api/auth/register` → `auth.service` creates `users`, `user_roles`, `learner_profiles` (+ location for supplier path N/A).

### Database changes

Insert: `users`, `user_roles` (LEARNER), `learner_profiles`, optional `auth_tokens` (refresh hash).

### Success state

Authenticated session; access token in memory; refresh via cookie/body; user redirected to `/home`.

### Error states

- Validation 400 → field errors on form (`ApiException` mapping).
- Duplicate email 409 — **Needs verification** of exact code.
- Incomplete wizard state → inline `/register` error.

### Files involved

`registration_wizard.dart`, `registration_draft_notifier.dart`, `register_request.dart`, `auth_controller.dart`, `auth_api.dart`, `auth.service.ts`, `auth.repository.ts`

---

## Flow B — Register (supplier only)

Same as Flow A but intent **Share materials** collects supplier-specific goals, general pickup city/area, supplier type, supplier display name, and optional description. Supplier display name defaults to the account full name if the user does not change it. Learner-only interests are not shown for supplier-only registration. The register payload includes `supplierProfile.pickupArea` derived from onboarding city/area. If the supplier type requires organization verification, the wizard creates the authenticated session, uploads the document to `/api/uploads/supplier-verification-document`, submits `/api/supplier/verification/submit`, then routes to `/supplier/verification-pending`. Student and individual suppliers skip the verification step. If verification upload/submission fails after account creation, the wizard stays recoverable inside `/register` and lets the user retry verification without recreating the account.

---

## Flow C — Register (both roles)

1. Intent **Do both** stays inside `/register`.
2. The wizard collects broad learner interests once, dual-role goals, supplier pickup location, learner basics, supplier basics, verification document only when required, and review. Student learner types can preselect **Student supplier**; self-learners and makers can preselect **Individual supplier**.
3. Submit sends one register payload with roles `[LEARNER, SUPPLIER]`, `learnerProfile.interests`, and supplier `pickupArea` from city/area.
4. Redirect: organization suppliers go to `/supplier/verification-pending` after verification submission; otherwise `postAuthRouteForUser` routes the authenticated user.

---

## Flow D — Login

### Trigger

User submits login form on `/login`.

### User path

Email + password → home or supplier dashboard.

### Frontend path

`LoginForm` → `authController.login` → `auth_repository.login` → `POST /api/auth/login`.

### Backend path

Validate credentials → issue JWT + refresh → set refresh cookie (`sendAuthSessionResponse`).

### Database changes

Update `users.last_login_at`; insert/revoke `auth_tokens` for refresh — **Needs verification** of rotation rules.

### Success state

`AuthStatus.authenticated`; redirect per `postAuthRouteForUser` or `from` query param.

### Error states

- Invalid credentials 401 → inline error on login form.
- Unknown auth on protected route → `/auth/checking?from=...` then login.

### Files involved

`login_form.dart`, `auth_controller.dart`, `auth_api.dart`, `auth.controller.ts`, `auth.service.ts`

---

## Flow E — Session bootstrap

### Trigger

App start or navigation while `AuthStatus.unknown`.

### Frontend path

`app_router` → `/auth/checking` → **Needs verification** which widget calls `bootstrapSession` (likely `app.dart` / provider listener).

`auth_repository.restoreSession()` → `refresh()` → `me()`.

### Backend path

`POST /api/auth/refresh` (cookie or body) → `GET /api/auth/me`.

### Database changes

Read-only unless refresh rotates token.

### Success state

Hydrated `AuthState`; redirect to original `from` URL.

### Error states

Refresh fails → unauthenticated; protected routes redirect to login.

---

## Flow E2 — Access token refresh after 401

### Trigger

An authenticated request made through the shared Dio client receives `401`.

### Frontend path

`AuthInterceptor.onError` checks that the request is eligible for refresh. It skips login, register, refresh, logout, requests marked `skipAuthRefresh`, and requests already retried after refresh.

Eligible requests await `AuthSessionRefresher.refreshAccessToken()`, which uses a bare Dio client, not the shared intercepted client, to call `POST /api/auth/refresh`. On success it updates the in-memory access token and persists a rotated refresh token when the backend returns one. The original request is retried once with the new bearer token.

### Concurrency

Concurrent 401s share the same in-flight refresh future, so only one refresh request is sent. Each failed request awaits that result and then retries once.

### Error states

If refresh fails, the access token and refresh storage are cleared, `AuthController` receives a session-expired state event, and the original request fails with a `SESSION_EXPIRED` auth error.

---

## Flow F — Change password (supplier)

### Trigger

Supplier opens change password from profile/security UI.

### Path

`change_password_dialog.dart` → `authRepository.changePassword` → `PATCH /api/auth/change-password`.

### Database changes

Update `users.password_hash`; may revoke sessions — **Needs verification**.

---

## Flow G — Forgot password

### Trigger

User taps **Forgot password?** on `/login`.

### User path

`/login` → `/forgot-password?email=<prefill>` → submit email → generic success:

`If an account exists for this email, reset instructions have been sent.`

The same success text is shown whether the email exists or not.

### Frontend path

`LoginForm` → `context.go('/forgot-password?email=...')` → `ForgotPasswordForm` → `authRepository.forgotPassword` → `POST /api/auth/forgot-password`.

The forgot/reset API calls set `skipAuthRefresh`, so they do not trigger token refresh or mutate local auth storage.

### Backend path

`auth.routes.ts` applies per-IP and per-email rate limits, validates `{ email }`, then `auth.service.requestPasswordReset`:

1. Checks reset-link configuration.
2. Looks up the normalized email.
3. For an existing user only, invalidates older unused password reset tokens.
4. Creates a new `auth_tokens` row with `tokenType=PASSWORD_RESET`, hashed token, and default 30-minute expiry.
5. Sends a reset email through the auth email provider.
6. Returns the generic response with `data: null`.

### Error states

- Invalid email format → validation error.
- Missing reset-link base URL or production non-HTTPS base URL → server configuration error.
- Rate limit exceeded → `429 RATE_LIMITED`.
- Email provider failure is logged server-side and does not reveal whether the email exists.

---

## Flow H — Reset password

### Trigger

User opens the reset email link built from `APP_PUBLIC_BASE_URL`:

`/reset-password?token=<opaque-token>`

### User path

Enter new password + confirmation → submit → success state links to `/login`.

Missing token shows a clean inline error. The reset flow does not auto-login.

### Frontend path

`ResetPasswordPage` reads `token` from the route query → `ResetPasswordForm` validates password length and confirmation → `authRepository.resetPassword` → `POST /api/auth/reset-password`.

### Backend path

`auth.routes.ts` applies per-IP and per-token rate limits, validates `{ token, newPassword }`, then `auth.service.resetPasswordWithToken`:

1. Hashes the raw token and finds an active, unused, unexpired password-reset token.
2. Applies per-account reset rate limiting after token lookup.
3. Hashes the new password with the same password utility used by register/change-password.
4. In one transaction, marks the reset token used, updates `users.password_hash`, and revokes active `REFRESH_TOKEN` rows for that user.
5. Sends a password-changed notification email.
6. Returns success with `data: null`.

### Error states

- Missing/invalid token in Flutter → inline error.
- Invalid, expired, or used token → safe validation error.
- New password under policy length → validation error.
- Notification email failure is logged server-side and does not undo the password reset.


---

## Flow I — Become supplier (existing learner)

### Trigger

Learner-only account taps **Become a supplier** from `/home`, `/profile`, or the account menu.

### User path

1. `/become-supplier` wizard collects supplier type (Student/Individual only), public name, pickup area, and optional description/hours/notes.
2. Submit → account keeps `LEARNER` role, gains `SUPPLIER` role and supplier profile → lands on supplier portal (`postAuthRouteForUser`).

Organization supplier types are rejected; those users must register as supplier or use `/register?intent=supplier`.

### Frontend path

`BecomeSupplierWizard` → `authController.becomeSupplier` → `authRepository.becomeSupplier` → `POST /api/auth/become-supplier` → refresh session via `me()` → `context.go(postAuthRouteForUser(user))`.

Entry routing uses `supplierEntryRouteForUser`: learner-only → `/become-supplier`; existing supplier → `/supplier/profile`.

### Backend path

`POST /api/auth/become-supplier` (authenticated) → `auth.service.becomeSupplier` → `authRepository.becomeSupplierForUser` adds `SUPPLIER` role, creates supplier profile, sets `activeRole` to `SUPPLIER`, returns fresh auth session (JWT roles in sync). Rejects organization supplier types, restricted staff roles, and accounts that already have a supplier profile.

### Database changes

Insert or update: `user_roles` (SUPPLIER), `supplier_profiles`, optional `locations` from `pickupArea`; update `users.active_role`.

### Success state

Dual-role session; supplier API routes authorize immediately; learner data and reservations remain on the same account.

### Error states

- Organization supplier type → `400 VALIDATION_ERROR`.
- Admin/driver/moderator account → `403 FORBIDDEN`.
- Field validation errors map to wizard inline errors.

### Files involved

`become_supplier_wizard.dart`, `become_supplier_request.dart`, `auth_controller.dart`, `auth_api.dart`, `auth.service.ts`, `auth.repository.ts`, `role-capabilities.ts`

---

## Flow J — Become learner (existing personal supplier)

### Trigger

Personal supplier (`STUDENT_SUPPLIER` or `INDIVIDUAL_SUPPLIER`) without learner profile taps **Become a Learner** from the supplier account menu.

### User path

1. `/become-learner` reuses `RegistrationWizard` in `LearnerSetupMode.addToExistingAccount`: interests, goals, optional location, learner type, skill level, review.
2. Submit → account keeps `SUPPLIER` role, gains `LEARNER` role and learner profile → snackbar “Learner access added to your account.” → lands on learner portal (`postAuthRouteForUser`).

No email, password, or new user creation. Organization supplier types are rejected.

### Frontend path

`BecomeLearnerPage` → `RegistrationWizard(mode: addToExistingAccount)` → `registrationDraftProvider.toBecomeLearnerRequest()` → `authController.becomeLearner` → `POST /api/auth/become-learner` → `context.go(postAuthRouteForUser(user))`.

### Backend path

`POST /api/auth/become-learner` (authenticated) → `auth.service.becomeLearner` → `authRepository.becomeLearnerForUser` adds `LEARNER` role, creates learner profile, sets `activeRole` to `LEARNER`, returns fresh auth session. Rejects organization supplier types, restricted staff roles, and idempotently handles existing learner profile.

### Database changes

Insert or update: `user_roles` (LEARNER), `learner_profiles`; update `users.active_role`.

### Success state

Dual-role session; learner portal routes authorize immediately; supplier data remains on the same account.

### Error states

- Organization supplier type → `403 FORBIDDEN`.
- Admin/driver/moderator account → `403 FORBIDDEN`.
- Field validation errors map to wizard inline errors.

### Files involved

`become_learner_wizard.dart`, `registration_wizard.dart`, `learner_setup_mode.dart`, `become_learner_request.dart`, `auth_controller.dart`, `auth_api.dart`, `auth.service.ts`, `auth.repository.ts`, `role-capabilities.ts`

---

## Flow K — Switch active portal (dual-role)

### Trigger

Dual-role user chooses **Switch to Supplier** or **Switch to Learner** from the account menu, profile page, or supplier profile popover.

### User path

Switch action → navigate to the opposite portal home (`/supplier/overview` or `/learning` per `oppositePortalSwitchRoute`).

### Frontend path

`PortalSwitchMenuItems` → `handlePortalRoleSwitch` → `authController.switchActiveRole` → `POST /api/auth/switch-role` → `me()` → `context.go(oppositePortalSwitchRoute(...))`.

Router guards redirect mismatched portal URLs when `activeRole` does not match the destination (learner mode cannot browse supplier portal except onboarding/verification routes).

### Backend path

`POST /api/auth/switch-role` body `{ activeRole: "LEARNER" | "SUPPLIER" }` → capability checks in `role-capabilities.ts` → may grant `LEARNER` on first switch for student/individual suppliers → `setUserActiveRole` → fresh auth session.

Organization suppliers without an existing `LEARNER` role cannot switch to learner mode.

### Database changes

Update `users.active_role`; may insert `user_roles` (LEARNER) on first eligible switch.

### Success state

Updated `activeRole`, refreshed tokens, portal routes match active mode.

### Error states

- Switch not allowed for account type → `403 FORBIDDEN` snackbar.
- Invalid `activeRole` → `400`.

### Files involved

`portal_switch_menu.dart`, `portal_navigation.dart`, `auth_controller.dart`, `app_router.dart`, `auth.service.ts`, `role-capabilities.ts`

---

## Open questions

- Is `account_status = PENDING_VERIFICATION` enforced on login?
- Web session persistence without secure storage — cookie-only behavior on Flutter web?
- Does register always create a `locations` row for supplier `pickupArea`?
