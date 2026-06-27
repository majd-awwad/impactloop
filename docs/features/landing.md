# Landing Feature

**Sources inspected:** `apps/frontend/lib/features/landing/`, `apps/frontend/lib/app/router/app_router.dart`, `apps/frontend/lib/app/widgets/hero_workshop_visual.dart`, `docs/frontend/routes-map.md`

## Purpose

Public marketing **landing page** at `/` for unauthenticated visitors: brand message, feature highlights, and navigation to register/login.

No backend API calls — purely presentational.

## Current status

| Section | Status | Data source |
|---------|--------|-------------|
| Route `/` | **Implemented** | `LandingPage` |
| Nav bar (sign in / create account) | **Implemented** | Static → `/login`, `/register` |
| Hero (headline, CTAs, visual) | **Implemented** | **Static** copy + `HeroWorkshopVisual` |
| Feature cards (3 columns) | **Implemented** | **Static** content; CTAs → `/register` |
| Footer | **Implemented** | **Static** |
| Live materials / learning preview | **Not implemented** | No API fetch on landing |
| Auth state awareness | **Frontend-only** | Router redirects logged-in users away from auth pages; landing itself does not personalize |

## Main user flow

1. Visitor opens `/`.
2. Reads hero and feature cards.
3. Taps **Create account** / **Sign in** → `/register` or `/login`.
4. Feature card links also route to `/register` (not directly to `/materials` or `/learning`).

## Frontend files

| Area | Path |
|------|------|
| Page | `presentation/pages/landing_page.dart` |
| Widgets | `presentation/widgets/landing_nav_bar.dart`, `landing_hero_section.dart`, `landing_feature_cards.dart`, `landing_footer.dart`, `landing_hero_visual.dart` |
| Theme | `app/theme/landing_colors.dart` |
| Shared | `app/widgets/entry_nav_bar.dart`, `app/widgets/hero_workshop_visual.dart` |
| Router | `app/router/app_router.dart` — `GoRoute(path: '/', ...)` |

## Backend files

**None** — landing does not call the API.

## API endpoints

None.

## Database tables

None.

## Reusable components

- `EntryNavBar` — shared with home/learning entry chrome
- `HeroWorkshopVisual` — shared hero illustration
- `LandingColors` — landing-specific theme tokens

## Known gaps / Needs verification

- Feature cards describe materials/learning but link to **register**, not live catalog.
- No deep links to `/materials` or `/learning` from hero (by design in current code).
- Mobile vs desktop layout breakpoints in hero/cards — UI only.

## Related docs

- [Auth](auth.md) — register/login targets
- [Material discovery](material-discovery.md) — public browse at `/materials` (separate route)
- [Learning hub](learning-hub.md) — `/learning` (mock UI)
