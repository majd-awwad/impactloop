# Home (Learner) Feature

**Sources inspected:** `apps/frontend/lib/features/home/`, `apps/frontend/lib/app/router/app_router.dart`, `home_suggested_materials_provider.dart`, `learning_spotlight_section.dart`, `auth_navigation.dart`, `docs/08-implementation-status.md`, `docs/features/material-discovery.md`, `docs/features/learning-hub.md`

## Purpose

Authenticated **learner dashboard** at `/home`: welcome hero, quick actions, suggested materials preview, learning spotlight preview, activity updates, and demoted placeholders for impact and AI helper.

Requires login (router guard).

## Current status

| Section | Status | Data source |
|---------|--------|-------------|
| Route `/home` | **Implemented** | `HomePage` → `LearnerHomePage` |
| Welcome hero + greeting | **Implemented** | **API-backed** — `authControllerProvider` user `displayName` |
| Quick actions | **Partial** | Materials and My Reservations use live routes/APIs; Learning Hub catalog is mock-only until frontend API integration; supplier CTA is active but learner self-upgrade API is **not** complete |
| Suggested materials | **Implemented** | **API-backed** — `GET /api/materials` via `ApiMaterialDiscoveryRepository`, first 4 items |
| Learning spotlight | **Mock-only** | `learning_hub_mock_data.dart` — **not** `GET /api/learning-projects`; API wiring belongs in `learning_hub` first |
| Activity updates | **Partial** | Delivery/reservation entry links to `/learner/reservations`; saved projects remain Coming Soon |
| Coming later (impact + AI) | **Frontend-only** | Empty / Coming Soon placeholders — no learner-facing APIs |

**Not documented as implemented:** learner reservation cancel, saved projects, AI agent, learner impact analytics, existing-account supplier role upgrade.

## Main user flow

1. Learner logs in → redirect `/home` (role-dependent routing in `app_router.dart`).
2. Page loads suggested materials from discovery API.
3. Learning spotlight shows 2 **mock preview** projects from `learning_hub_mock_data.dart`.
4. User taps **Browse Materials** → `/materials` (live API discovery).
5. User taps **Explore Learning Hub** → `/learning` (route live; catalog still mock-only).
6. User taps **My Reservations** (Quick actions) → `/learner/reservations` (live reservation + delivery request/status).
7. User taps **Track reservations and delivery** (Activity updates) → `/learner/reservations` (same destination, delivery-focused copy).
8. User taps **Become a supplier** → `supplierEntryRouteForUser(user)`:
   - Supplier role → `/supplier/profile`
   - Learner-only → `/supplier/onboarding` (status page; self-upgrade API pending)
   - Unauthenticated defensive path → `/register?intent=supplier`
9. Disabled / Coming Soon cards show info snackbars for saved projects, impact, and AI helper.

## Frontend files

| Area | Path |
|------|------|
| Entry | `presentation/pages/home_page.dart` (wraps `LearnerHomePage`) |
| Page | `presentation/pages/learner_home_page.dart` |
| Providers | `application/home_suggested_materials_provider.dart` |
| Widgets | `suggested_materials_section.dart`, `learning_spotlight_section.dart`, `home_action_card.dart`, `coming_soon_card.dart`, `empty_activity_card.dart`, `home_section_header.dart` |
| Shared nav helper | `auth/application/auth_navigation.dart` — `supplierEntryRouteForUser`, `learnerReservationsRoute` |
| Cross-feature | `material_discovery/data/api_material_discovery_repository.dart`, `learning_hub/data/learning_hub_mock_data.dart` |
| Router | `app/router/app_router.dart` — `/home`, `/learner/reservations` |

## Backend files

Indirect only:

| API | Used by |
|-----|---------|
| `GET /api/materials` | Suggested materials section |
| `GET /api/auth/me` (via auth controller) | Greeting name |

No dedicated `/api/home` or learner dashboard endpoint.

## API endpoints

| Method | Path | Section |
|--------|------|---------|
| GET | `/api/materials` | Suggested materials (**Implemented**) |
| GET | `/api/learning-projects` | **Not wired** to learning spotlight |
| POST | `/api/reservations` | **Implemented MVP** — used from material detail, not home |
| GET | `/api/reservations/my` | My Reservations (**Implemented MVP**) — home links only |

## Database tables

Read-only via materials API: `materials`, `material_images`, `categories`, `locations` (city/area in DTO), supplier profile display fields.

No home-specific tables.

## Reusable components

- `AppMaterialCard` — suggested materials grid
- `HomeSectionHeader`, `HomeActionCard`, `ComingSoonCard`, `EmptyActivityCard` — home-specific (not in global reusable-widgets catalog)
- `EntryNavBar` — top bar (`homeRoute: '/home'`)

## Known gaps / Needs verification

- Learning spotlight stays mock until [learning-hub](learning-hub.md) adds a shared repository/provider; Home must not duplicate API logic.
- Existing learner-to-supplier role upgrade API is **not implemented**. `/supplier/onboarding` is a status/next-action page, not a completed self-upgrade flow.
- Suggested materials uses unfiltered discovery list (first 4) — no personalization API.
- Supplier users may land on `/supplier` after login via `postAuthRouteForUser` but can still open `/home` manually.

## Related docs

- [Material discovery](material-discovery.md)
- [Learning hub](learning-hub.md)
- [Reservations](reservations.md)
- [Landing](landing.md) — public entry, no auth
