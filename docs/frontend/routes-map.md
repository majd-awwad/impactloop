# Flutter Routes Map

Routes and access guards derived from `apps/frontend/lib/app/router/app_router.dart` and `apps/frontend/lib/features/auth/application/auth_navigation.dart`.

Related frontend architecture docs:
- [reusable-widgets.md](reusable-widgets.md)
- [state-management.md](state-management.md)
- [../07-theme-system.md](../07-theme-system.md)

**Source files:**
- `app_router.dart` — route tree and redirect logic
- `auth_navigation.dart` — route constants and post-auth routing
- `supplier_nav_config.dart` — supplier shell nav items (not separate routes)

## Route constants

From `auth_navigation.dart`:

| Constant | Path |
|----------|------|
| `rootRoute` | `/` |
| `loginRoute` | `/login` |
| `registerRoute` | `/register` |
| `authCheckingRoute` | `/auth/checking` |
| `supplierPortalRoute` | `/supplier` |
| `homeRoute` | `/home` |

## Access levels

Defined in `app_router.dart` as `_RouteAccessLevel`:

| Level | Paths | Guard behavior |
|-------|-------|----------------|
| **public** | Most routes (landing, materials, learning, auth pages, profile completion) | No login required |
| **authenticated** | `/home`, `/supplier/access-denied`, `/admin/access-denied` | Requires login |
| **supplier** | `/supplier`, `/supplier/*` (except access-denied) | Requires login + `SUPPLIER` role |
| **admin** | `/admin`, `/admin/*` (except access-denied) | Requires login + `ADMIN` role |

### Redirect rules (summary)

**Inspected:** `_resolveRouteRedirect`, `_resolveProtectedRoute`, `legacyOnboardingRedirect` in `app_router.dart`

1. **Auth unknown** → redirect to `/auth/checking?from=<destination>`
2. **Protected route + unauthenticated** → `/login?from=<destination>`
3. **Supplier route without SUPPLIER role** → `/supplier/access-denied`
4. **Admin route without ADMIN role** → `/admin/access-denied`
5. **Authenticated user on login/register** → redirect to `from` query or `postAuthRouteForUser(user)`:
   - Supplier role → `/supplier`
   - Otherwise → `/home`
5. **Profile completion paths** (`/complete-learner-profile`, `/complete-supplier-profile`) → `legacyOnboardingRedirect` validates `registrationDraftProvider` and intent

## Route table

| Path | Page widget | Access | Notes |
|------|-------------|--------|-------|
| `/` | `LandingPage` | public | |
| `/health` | `HealthPage` | public | Backend health diagnostic |
| `/home` | `HomePage` → `LearnerHomePage` | authenticated | |
| `/auth/checking` | `AuthCheckingPage` | public | Auth bootstrap / redirect hub |
| `/learning` | `LearningHubPage` | public | **Partial** — mock data; backend API exists but not wired |
| `/learning/add-draft` | `LearningAddDraftPage` | public | **Mock form** — no submit API |
| `/learning/:id` | `LearningProjectDetailsPage` | public | **Mock data** |
| `/materials` | `MaterialsDiscoveryPage` | public | API-backed default |
| `/materials/:id` | `MaterialDetailsPage` | public | API-backed default |
| `/login` | `LoginPage` | public | `_AuthPageGuard` |
| `/register` | `RegisterPage` | public | `_AuthPageGuard` |
| `/complete-learner-profile` | `CompleteLearnerProfilePage` | public | Registration draft flow; `?intent=both` supported |
| `/complete-supplier-profile` | `CompleteSupplierProfilePage` | public | Registration draft flow |
| `/supplier/access-denied` | `SupplierAccessDeniedPage` | authenticated | |
| `/supplier` | `SupplierDashboardPage` | supplier | Inside `SupplierShell` |
| `/supplier/materials/new` | `AddMaterialPage` | supplier | Query: `categoryRequestId`, `priceRuleRequestId` |
| `/supplier/materials/:id` | `SupplierOwnedMaterialDetailPage` | supplier | Redirects `id=new` → `/supplier/materials/new` |
| `/supplier/materials` | `SupplierMyMaterialsPage` | supplier | |
| `/supplier/reservations` | `SupplierIncomingRequestsPage` | supplier | Query: `tab`, `focus` |
| `/supplier/pickup-schedule` | `SupplierPickupSchedulePage` | supplier | |
| `/supplier/notifications` | `SupplierNotificationsPage` | supplier | |
| `/supplier/profile` | `SupplierProfilePage` | supplier | |
| `/supplier/verification-pending` | `SupplierVerificationPendingPage` | supplier | Org supplier awaiting admin approval |
| `/supplier/verification-status` | `SupplierVerificationStatusPage` | supplier | Rejected / changes requested + resubmit |
| `/admin/access-denied` | `AdminAccessDeniedPage` | authenticated | |
| `/admin` | `AdminOverviewPage` | admin | Inside `AdminShell` |
| `/admin/users` | `AdminPlaceholderPage` | admin | Placeholder |
| `/admin/suppliers` | `AdminPlaceholderPage` | admin | Placeholder |
| `/admin/supplier-verification` | `AdminSupplierVerificationPage` | admin | Review org supplier documents |
| `/admin/materials` | `AdminPlaceholderPage` | admin | Placeholder |
| `/admin/approvals` | `AdminApprovalsPage` | admin | Category + price approvals |
| `/admin/invitations` | `AdminInvitationsPage` | admin | Admin invitation management |
| `/admin/impact` | `AdminPlaceholderPage` | admin | Placeholder |
| `/admin/audit-logs` | `AdminPlaceholderPage` | admin | Placeholder |

## Admin shell navigation

From `admin_sidebar.dart`:

| Nav label | Route |
|-----------|-------|
| Overview | `/admin` |
| Users | `/admin/users` |
| Suppliers | `/admin/suppliers` |
| Supplier Verification | `/admin/supplier-verification` |
| Materials | `/admin/materials` |
| Approvals | `/admin/approvals` |
| Invitations | `/admin/invitations` |
| Impact Analytics | `/admin/impact` |
| Audit Logs | `/admin/audit-logs` |

## Supplier shell navigation

From `supplier_nav_config.dart` — `supplierNavItems` (sidebar / desktop):

| Nav label key | Route |
|---------------|-------|
| overview | `/supplier` |
| myMaterials | `/supplier/materials` |
| addMaterial | `/supplier/materials/new` |
| incomingRequests | `/supplier/reservations` |
| pickupSchedule | `/supplier/pickup-schedule` |
| browseMaterials | `/materials` (exits shell to public discovery) |
| notifications | `/supplier/notifications` |
| profile | `/supplier/profile` |

Mobile bottom nav (`supplierMobileNavItems`): overview, myMaterials, addMaterial, incomingRequests, profile.

## Pages **not** in router

**Inspected:** `app_router.dart` has no import/route for:

| File | Status |
|------|--------|
| `auth/presentation/pages/choose_role_page.dart` | **Unwired** — legacy; registration uses `UnifiedRegisterForm` with intent chips |
| `supplier_portal/presentation/pages/supplier_coming_soon_page.dart` | **Unwired** |

## Query parameters

| Route | Params | Purpose |
|-------|--------|---------|
| `/login`, `/register`, protected redirects | `from` | Return URL after auth |
| `/complete-learner-profile` | `intent=both` | Dual-role registration hint |
| `/supplier/materials/new` | `categoryRequestId`, `priceRuleRequestId` | Resume listing from approved request |
| `/supplier/reservations` | `tab`, `focus` | Deep link into reservation inbox |

## Post-auth default destination

`postAuthRouteForUser` (`auth_navigation.dart`) — first matching role wins:

1. `ADMIN` → `/admin`
2. `SUPPLIER` → `/supplier`
3. `DRIVER` → `/home` (no driver portal route yet)
4. `MODERATOR` → `/home` (no moderator portal route yet)
5. Else → `/home`

Users with both `ADMIN` and `SUPPLIER` land on `/admin`. Admins who open `/home` can use the account menu **Admin Portal** item or the **Open Admin Portal** quick action card.
