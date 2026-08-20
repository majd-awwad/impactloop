# Landing Feature

**Sources inspected:** `apps/frontend/lib/features/landing/`, `apps/frontend/lib/app/router/app_router.dart`, `apps/backend/src/modules/public-landing/`, `docs/frontend/routes-map.md`

## Purpose

Public marketing **landing page** at `/` for unauthenticated visitors: brand message, feature highlights, live public projects, and navigation to browse or register/login.

## Current status

| Section | Status | Data source |
|---------|--------|-------------|
| Route `/` | **Implemented** | `LandingPage` |
| Nav bar (sign in / create account) | **Implemented** | Static CTAs → `/login`, `/register`; browse links → `/materials`, `/learning` |
| Hero (headline, CTAs, visual) | **Implemented** | Static copy + live public counts |
| Feature cards (3 columns) | **Implemented** | Static copy; Explore → `/materials`, Share → `/register`, Start building → `/learning` |
| Featured learning projects | **Implemented** | `GET /api/public/landing` — `PUBLISHED` only |
| Community avatars | **Implemented** | `GET /api/public/landing` — public learner/supplier profile photos |
| Footer | **Implemented** | Static |
| Auth state awareness | **Frontend-only** | Router redirects logged-in users away from `/` |

## Main user flow

1. Visitor opens `/` without logging in.
2. Reads hero, feature cards, and live published projects.
3. Taps **Explore materials** → `/materials` (or `/materials/:id` from discovery).
4. Taps **Start building** / a project card → `/learning` or `/learning/:id`.
5. Authenticated-only actions (reserve, like, start build, share materials) route to login with `from=`.

## Frontend files

| Area | Path |
|------|------|
| Page | `presentation/pages/landing_page.dart` |
| Widgets | `presentation/widgets/landing_nav_bar.dart`, `landing_hero_section.dart`, `landing_feature_cards.dart`, `landing_featured_projects.dart`, `landing_footer.dart` |
| Data | `data/landing_public_api.dart`, `application/landing_public_providers.dart` |
| Theme | `app/theme/landing_colors.dart` |
| Router | `app/router/app_router.dart` — `GoRoute(path: '/', ...)` |

## Backend files

| Area | Path |
|------|------|
| Public landing | `modules/public-landing/` |

## API endpoints

| Method | Path | Auth | Used by landing |
|--------|------|------|-----------------|
| GET | `/api/public/landing` | Public | Published projects, community avatars, public counts |
| GET | `/api/materials` | Public | Browse after landing |
| GET | `/api/materials/:id` | Public | Material details |
| GET | `/api/learning-projects` | Public | Learning Hub browse |
| GET | `/api/learning-projects/:id` | Public | Project details |

## Related docs

- [Auth](auth.md) — register/login targets
- [Material discovery](material-discovery.md) — public browse at `/materials`
- [Learning hub](learning-hub.md) — `/learning`
