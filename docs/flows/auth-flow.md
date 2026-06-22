# Auth Flow

**Sources inspected:** `auth_controller.dart`, `auth_repository.dart`, `unified_register_form.dart`, `complete_*_profile_form.dart`, `app_router.dart`, `auth.routes.ts`, `auth.service.ts`, `auth.validation.ts`

## Trigger

User chooses **Sign up** or **Sign in**, or app loads a protected route while session is unknown.

---

## Flow A — Register (learner only)

### User path

1. `/register` → fill basic fields + select **Find materials** intent.
2. `/complete-learner-profile` → learner type, skill level, interests, bio.
3. Submit → account created → land on `/home`.

### Frontend path

`UnifiedRegisterForm` → `registrationDraftProvider` → `CompleteLearnerProfileForm` → `authController.register(draft.toRegisterRequest())` → `context.go(postAuthRouteForUser(user))`.

### Backend path

`POST /api/auth/register` → `auth.service` creates `users`, `user_roles`, `learner_profiles` (+ location for supplier path N/A).

### Database changes

Insert: `users`, `user_roles` (LEARNER), `learner_profiles`, optional `auth_tokens` (refresh hash).

### Success state

Authenticated session; access token in memory; refresh via cookie/body; user redirected to `/home`.

### Error states

- Validation 400 → field errors on form (`ApiException` mapping).
- Duplicate email 409 — **Needs verification** of exact code.
- Incomplete draft → redirect `/register` with form error.

### Files involved

`unified_register_form.dart`, `complete_learner_profile_form.dart`, `registration_draft_notifier.dart`, `register_request.dart`, `auth_controller.dart`, `auth_api.dart`, `auth.service.ts`, `auth.repository.ts`

---

## Flow B — Register (supplier only)

Same as Flow A but intent **Share materials** → `/complete-supplier-profile` → registers with `supplierProfile` + `pickupArea` → redirect `/supplier` if SUPPLIER role.

---

## Flow C — Register (both roles)

1. Intent **Do both** → `/complete-learner-profile?intent=both`.
2. Learner step saves draft only → `/complete-supplier-profile`.
3. Supplier step → single `register` with both profiles and roles `[LEARNER, SUPPLIER]`.
4. Redirect: `postAuthRouteForUser` → `/supplier` (supplier role wins).

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

## Flow G — Forgot password (not implemented in UI)

### Status

**Backend-only.** Endpoints exist; Flutter shows snackbar “Forgot password screen coming soon.”

---

## Open questions

- Is `account_status = PENDING_VERIFICATION` enforced on login?
- Web session persistence without secure storage — cookie-only behavior on Flutter web?
- Does register always create a `locations` row for supplier `pickupArea`?
