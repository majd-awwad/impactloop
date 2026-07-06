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
| `forgotPasswordRoute` | `/forgot-password` |
| `resetPasswordRoute` | `/reset-password` |
| `authCheckingRoute` | `/auth/checking` |
| `supplierPortalRoute` | `/supplier` |
| `driverPortalRoute` | `/driver/jobs` |
| `adminPortalRoute` | `/admin` |
| `inviteAcceptRoute` | `/invite/accept` |
| `homeRoute` | `/home` |

## Access levels

Defined in `app_router.dart` as `_RouteAccessLevel`:

| Level | Paths | Guard behavior |
|-------|-------|----------------|
| **public** | Most routes (landing, materials, learning, auth pages, register deprecated fallbacks) | No login required |
| **authenticated** | `/home`, `/profile`, `/profile/*`, `/supplier/access-denied`, `/admin/access-denied` | Requires login |
| **learner** | `/learning/add-draft`, `/learner/reservations`, `/learner/reservations/:id`, `/learner/deliveries/:id` | Requires login + `LEARNER` role; non-learners redirect to `/home` |
| **supplier** | `/supplier`, `/supplier/*` (except access-denied) | Requires login + `SUPPLIER` role |
| **driver** | `/driver`, `/driver/*` | Requires login + `DRIVER` role; non-drivers redirect to `/home` |
| **admin** | `/admin`, `/admin/*` (except access-denied) | Requires login + `ADMIN` role |

### Redirect rules (summary)

**Inspected:** `_resolveRouteRedirect`, `_resolveProtectedRoute`, `legacyOnboardingRedirect` in `app_router.dart`

1. **Auth unknown** → redirect to `/auth/checking?from=<destination>`
2. **Protected route + unauthenticated** → `/login?from=<destination>`
3. **Supplier route without SUPPLIER role** → `/supplier/access-denied` (except `/supplier/onboarding`, which is authenticated-only)
4. **Active portal mismatch** — authenticated users with `activeRole=SUPPLIER` are redirected from learner home/reservations/add-draft to `/supplier`; users with `activeRole=LEARNER` are redirected from supplier portal routes to `/home` (except onboarding/verification routes)
5. **Post-auth landing** uses `activeRole` from `/api/auth/me` (not role priority alone)
6. **Driver route without DRIVER role** → `/home`
7. **Admin route without ADMIN role** → `/admin/access-denied`
8. **Authenticated user on login/register/forgot/reset auth pages** → redirect to `from` query or `postAuthRouteForUser(user)`:
   - Admin `activeRole` → `/admin`
   - Supplier `activeRole` → `/supplier` (or verification gate when required)
   - Driver `activeRole` → `/driver/jobs`
   - Learner `activeRole` → `/home`
9. **Deprecated registration continuation paths** (`/complete-learner-profile`, `/complete-supplier-profile`) → `legacyOnboardingRedirect` sends users to `/register`

## Route table

| Path | Page widget | Access | Notes |
|------|-------------|--------|-------|
| `/` | `LandingPage` | public | |
| `/health` | `HealthPage` | public | Backend health diagnostic |
| `/home` | `HomePage` → `LearnerHomePage` | authenticated | |
| `/profile` | `ProfilePage` | authenticated | Account summary hub; mobile bottom Profile tab and avatar menu target this route |

**Learner shell tabs:** `/home`, `/materials`, `/learning`, `/learner/reservations`, and `/profile` are siblings inside `AppMobileNavigationShell`. Switch between them with `context.go(...)`, not `context.push(...)`, so Flutter web keeps the browser URL in sync. Detail routes outside the shell (for example `/materials/:id`, `/learner/reservations/:id`) should continue to use `push`.
| `/profile/edit` | `ProfileEditPage` | authenticated | Edit display name, phone, and profile photo |
| `/profile/learner/edit` | `LearnerProfileEditPage` | authenticated | Edit learner type, skill level, interests, and bio (`LEARNER` role required) |
| `/profile/security` | `ProfileSecurityPage` | authenticated | Change password via `/api/auth/change-password` |
| `/notifications` | `UserNotificationsPage` | authenticated | Persisted inbox from `/api/notifications`; reservation rows deep-link to learner/supplier reservation routes |
| `/profile/locations` | `SavedLocationsPage` | authenticated | Manage private saved locations via `/api/locations/saved`; exact address and coordinates are visible only to the owner |
| `/learner/reservations` | `LearnerReservationsPage` | learner | Learner reservation status list |
| `/learner/reservations/:id` | `LearnerReservationDetailPage` | learner | Single reservation detail with refresh + shared reservation card |
| `/learner/deliveries/:id/track` | `LearnerDeliveryTrackingPage` | learner | Live driver map (after pickup), polls `GET /api/deliveries/:id/tracking` every 45s |
| `/learner/deliveries/:id` | `LearnerDeliveryDetailPage` | learner | Learner-owned delivery status/timeline; **Track delivery** opens `/track` when `canTrack` |
| `/auth/checking` | `AuthCheckingPage` | public | Auth bootstrap / redirect hub |
| `/learning` | `LearningHubPage` | public | **Partial** — API-backed list/detail with search, difficulty, tag, category filters, saved/followed learner tabs, and server-side page navigation; optional `q` query pre-fills search; add-draft submits for review; AI material matching is not implemented |
| `/learning/add-draft` | `LearningAddDraftPage` | learner | Learner project submission form; posts to `/api/learning-projects/submit` |
| `/learning/:id` | `LearningProjectDetailsPage` | public | API-backed project detail with local build checklist and material-search handoff |
| `/materials` | `MaterialsDiscoveryPage` | public | API-backed default; optional `q` query pre-fills search |
| `/materials/:id` | `MaterialDetailsPage` | public | API-backed default |
| `/login` | `LoginPage` | public | `_AuthPageGuard` |
| `/forgot-password` | `ForgotPasswordPage` | public | `_AuthPageGuard`; optional `email` query pre-fills the form |
| `/reset-password` | `ResetPasswordPage` | public | `_AuthPageGuard`; reads reset `token` query |
| `/register` | `RegisterPage` | public | `_AuthPageGuard`; unified onboarding wizard for learner, supplier, and dual-role registration |
| `/complete-learner-profile` | `DeprecatedOnboardingPage` | public | Deprecated fallback; redirects to `/register` |
| `/complete-supplier-profile` | `DeprecatedOnboardingPage` | public | Deprecated fallback; redirects to `/register` |
| `/supplier/onboarding` | redirect | authenticated | Legacy alias → `/become-supplier` |
| `/become-learner` | `BecomeLearnerPage` | authenticated personal supplier without learner profile | Reuses `RegistrationWizard` in `LearnerSetupMode.addToExistingAccount` (interests, goals, location, learner basics, review); no email/password; redirects when learner access already exists |
| `/become-supplier` | `BecomeSupplierPage` | authenticated learner without supplier profile | Personal learner → supplier wizard (Student/Individual only); redirects to `/supplier/overview` when supplier profile already exists; blocked for admin/moderator/driver |
| `/supplier/access-denied` | `SupplierAccessDeniedPage` | authenticated | |
| `/driver` | redirect | driver | Redirects to `/driver/jobs` |
| `/driver/jobs` | `DriverJobsPage` | driver | Driver available jobs + active delivery panel inside `DriverPortalShell` |
| `/driver/deliveries/:id` | `DriverDeliveryDetailPage` | driver | Active assigned delivery detail/status updates and manual foreground location ping |
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
| `/admin/users` | `AdminPeoplePage` | admin | People management; optional `?tab=SUPPLIERS` etc. |
| `/admin/suppliers` | redirect → `/admin/users?tab=SUPPLIERS` | admin | Legacy path; no standalone page |
| `/admin/supplier-verification` | `AdminSupplierVerificationPage` | admin | Review org supplier documents |
| `/admin/materials` | `AdminMaterialsPage` | admin | Materials moderation + reports |
| `/admin/approvals` | `AdminApprovalsPage` | admin | Category + price approvals |
| `/admin/invitations` | `AdminInvitationsPage` | admin | Admin invitation management |
| `/admin/impact` | `AdminImpactPage` | admin | Reuse + estimated CO₂ analytics from dashboard API |
| `/admin/audit-logs` | `AdminAuditLogsPage` | admin | Paginated `admin_activity_logs` with backend filters, summary stats, actor/date filters, details dialog |
| `/admin/reservations` | `AdminReservationsPage` | admin | Read-only platform reservations monitor with filters, summary stats, detail dialog |
| `/admin/deliveries` | `AdminDeliveriesPage` | admin | Read-only delivery lifecycle monitor with timeline/location history, filters, detail dialog |
| `/admin/learning-projects` | `AdminLearningProjectsPage` | admin | Learning Hub project moderation: summary stats, filters, review detail dialog, approve/reject/hide/archive actions |

## Admin shell navigation

From `admin_sidebar.dart`:

| Nav label | Route |
|-----------|-------|
| Overview | `/admin` |
| Users | `/admin/users` |
| Supplier Verification | `/admin/supplier-verification` |
| Materials | `/admin/materials` |
| Approvals | `/admin/approvals` |
| Invitations | `/admin/invitations` |
| Impact Analytics | `/admin/impact` |
| Audit Logs | `/admin/audit-logs` |
| Reservations | `/admin/reservations` |
| Deliveries | `/admin/deliveries` |
| Learning Projects | `/admin/learning-projects` |

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
| `auth/presentation/pages/choose_role_page.dart` | **Unwired** — legacy; registration uses `RegistrationWizard` with intent chips |
| `supplier_portal/presentation/pages/supplier_coming_soon_page.dart` | **Unwired** |

## Query parameters

| Route | Params | Purpose |
|-------|--------|---------|
| `/login`, `/register`, protected redirects | `from` | Return URL after auth |
| `/forgot-password` | `email` | Optional email prefill from the login form |
| `/reset-password` | `token` | Password reset token from email link |
| `/complete-learner-profile`, `/complete-supplier-profile` | any | Deprecated fallback paths; redirected to `/register` |
| `/materials` | `q` | Optional initial search term, used by Learning Hub component handoff |
| `/learning` | `q` | Optional initial search term, used by material detail project handoff |
| `/supplier/materials/new` | `categoryRequestId`, `priceRuleRequestId` | Resume listing from approved request |
| `/supplier/reservations` | `tab`, `focus` | Deep link into reservation inbox |

## Navigation stack behavior

Primary app navigation replaces the current route with `context.go(...)`: entry nav links, mobile bottom tabs, supplier/admin sidebars, portal switchers, auth redirects, and direct filter-reset URL updates.

Page-level drill-ins preserve the previous page with `context.push(...)`: material/project/reservation/delivery detail opens, profile subpages, supplier material add/edit/detail flows, notification deep links, dashboard shortcut cards, and admin overview shortcut cards.

Back/save/delete completion paths use `context.popOrGo(<fallback>)` from `app/router/navigation_extensions.dart` when a page must return to the caller if history exists, while still supporting direct web URL entry with a stable fallback route.

## Post-auth default destination

`postAuthRouteForUser` (`auth_navigation.dart`) — first matching role wins:

1. `ADMIN` → `/admin`
2. `SUPPLIER` → `/supplier` (or verification gate when required)
3. `DRIVER` → `/driver/jobs`
4. `MODERATOR` → `/home` (no moderator portal route yet)
5. Else → `/home`

Users with both `ADMIN` and `SUPPLIER` land on `/admin`. Admins who open `/home` can use the account menu **Admin Portal** item or the **Open Admin Portal** quick action card.
