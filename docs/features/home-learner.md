# Home (Learner) Feature

**Sources inspected:** `apps/frontend/lib/features/home/`, `apps/frontend/lib/app/router/app_router.dart`, `home_suggested_materials_provider.dart`, `learning_spotlight_section.dart`, `docs/08-implementation-status.md`, `docs/features/material-discovery.md`, `docs/features/learning-hub.md`

## Purpose

Authenticated **learner dashboard** at `/home`: welcome hero, quick actions, suggested materials preview, learning spotlight, and placeholder sections for future reservations, delivery, impact, and AI helper.

Requires login (router guard).

## Current status

| Section | Status | Data source |
|---------|--------|-------------|
| Route `/home` | **Implemented** | `HomePage` → `LearnerHomePage` |
| Welcome hero + greeting | **Implemented** | **API-backed** — `authControllerProvider` user `displayName` |
| Quick actions | **Partial** | Browse materials and My Reservations are API-backed; Learning Hub route is available, but the catalog/cards are mock-only until frontend API integration is completed; supplier onboarding **disabled** (“Coming soon”) |
| Suggested materials | **Implemented** | **API-backed** — `GET /api/materials` via `ApiMaterialDiscoveryRepository`, first 4 items |
| Learning spotlight | **Mock-only** | `learning_hub_mock_data.dart` — **not** `GET /api/learning-projects` |
| Future activity | **Partial** | My Reservations links to `/learner/reservations`; saved projects and delivery remain placeholders |
| Impact snapshot | **Frontend-only** | Empty placeholder copy |
| AI material helper | **Not implemented** | Coming soon card only |

**Not documented as implemented:** learner reservation cancel, delivery tracking, saved projects, AI agent, impact analytics.

## Main user flow

1. Learner logs in → redirect `/home` (role-dependent routing in `app_router.dart`).
2. Page loads suggested materials from discovery API.
3. Learning spotlight shows 2 mock projects from learning hub mock data.
4. User taps **Browse Materials** → `/materials` (live API discovery).
5. User taps **Explore Learning Hub** → `/learning` (Learning Hub route is available, but the catalog/cards are mock-only until frontend API integration is completed).
6. User taps **My Reservations** → `/learner/reservations` (live reservation status list).
7. Disabled cards show info snackbars for future features.

## Frontend files

| Area | Path |
|------|------|
| Entry | `presentation/pages/home_page.dart` (wraps `LearnerHomePage`) |
| Page | `presentation/pages/learner_home_page.dart` |
| Providers | `application/home_suggested_materials_provider.dart` |
| Widgets | `suggested_materials_section.dart`, `learning_spotlight_section.dart`, `home_action_card.dart`, `coming_soon_card.dart`, `empty_activity_card.dart`, `home_section_header.dart` |
| Shared | `shared/widgets/materials/app_material_card.dart`, `entry_nav_bar.dart` |
| Cross-feature | `material_discovery/data/api_material_discovery_repository.dart`, `learning_hub/data/learning_hub_mock_data.dart` |
| Router | `app/router/app_router.dart` — `/home` |

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
| GET | `/api/reservations/my` | My Reservations (**Implemented MVP**) |

## Database tables

Read-only via materials API: `materials`, `material_images`, `categories`, `locations` (city/area in DTO), supplier profile display fields.

No home-specific tables.

## Reusable components

- `AppMaterialCard` — suggested materials grid
- `HomeSectionHeader`, `HomeActionCard`, `ComingSoonCard`, `EmptyActivityCard` — home-specific (not in global reusable-widgets catalog)
- `EntryNavBar` — top bar (`homeRoute: '/home'`)

## Known gaps / Needs verification

- Learning spotlight subtitle explicitly says Learning Hub “remains UI-only” — keep in sync when [learning-hub](learning-hub.md) integrates API.
- “Become a supplier” on home disabled — suppliers register via `/register` with SUPPLIER intent elsewhere; **Needs verification** of intended learner→supplier path.
- Suggested materials uses unfiltered discovery list (first 4) — no personalization API.
- Supplier users may be redirected away from `/home` — see router role rules.

## Related docs

- [Material discovery](material-discovery.md)
- [Learning hub](learning-hub.md)
- [Landing](landing.md) — public entry, no auth
