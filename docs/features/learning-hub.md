# Learning Hub Feature

**Sources inspected:** `apps/frontend/lib/features/learning_hub/`, `apps/backend/src/modules/learning-projects/`, `docs/08-implementation-status.md`

## Purpose

Browse educational project ideas (components, steps, links) for inspiration. **Learning only** in the current UI: no in-hub booking, build checklist, or AI material matching is shipped yet.

## Current status

| Layer | Status | Notes |
|-------|--------|-------|
| Backend `learning-projects` | **Implemented** | Public read list + detail (`PUBLISHED` only in repository) |
| Flutter list/detail pages | **Partial** | `/learning` and `/learning/:id` use `ApiLearningHubRepository` + Riverpod providers; browse exposes category, search, difficulty, and tag filters |
| Home learning spotlight | **Implemented** | Reuses `learningProjectsProvider` with `limit: 2` on `/home` |
| Add draft page | **Implemented for learner submit** | `LearningAddDraftPage` posts to `POST /api/learning-projects/submit`; submitted projects enter `PENDING_REVIEW` |
| Admin project moderation | **Implemented** | `/admin/learning-projects` lists, filters, reviews, approves/rejects/request-changes, hides/restores, and archives projects |
| AI panel on detail | **Frontend-only** | `disabled_ai_panel.dart` — placeholder |
| Ratings on cards/detail | **Partial** | Hidden when backend `ratingSummary` is null (current API returns null) |
| Project links | **Implemented** | Detail links open safe `http`/`https` URLs through `url_launcher`; invalid/missing URLs are disabled |
| AI material agent | **Not implemented** | No `ai-agent` module |

Product intent from role planning: the learning hub should eventually support project-to-material matching, material coverage, missing materials, alternatives, already-owned markers, saved projects, likes, and start-build/checklist flows. These are planned/future unless code changes prove otherwise.

**Critical:** Learning Hub list/detail, Home spotlight, learner project submission, and admin project moderation are API-backed. The disabled AI panel and legacy mock catalog are not production read paths.

## Main user flow (as shipped in Flutter)

1. User opens `/learning` (public).
2. Page loads published projects from `GET /api/learning-projects` via `learningProjectsProvider`.
3. Category chips filter by `categoryId` using `GET /api/categories?type=PROJECT`; search, difficulty, and tag filters use the existing learning projects query params.
4. First list item is shown as featured; remaining items render in the grid.
5. Tap project → `/learning/:id` → `learningProjectProvider(id)` loads detail from `GET /api/learning-projects/:id`; existing project links can be opened when they contain valid `http`/`https` URLs.
6. Optional: `/learning/add-draft` — authenticated learner submits a draft to `POST /api/learning-projects/submit`; backend stores it as `PENDING_REVIEW`.
7. Home `/home` learning spotlight loads up to 2 published projects via `learningProjectsProvider`.

## Frontend files

| Area | Path |
|------|------|
| Repository | `domain/learning_project_repository.dart`, `data/api_learning_hub_repository.dart`, `data/learning_hub_api_mapper.dart` |
| Providers | `application/learning_hub_providers.dart` |
| Legacy mock data | `data/learning_hub_mock_data.dart` (disabled AI copy + unused sample catalog only) |
| Theme | `presentation/theme/learning_ui_palette.dart`, `learning_project_visuals.dart` |
| Domain | `domain/models/learning_project.dart`, `domain/learning_projects_result.dart` |
| Pages | `presentation/pages/learning_hub_page.dart`, `learning_project_details_page.dart`, `learning_add_draft_page.dart` |
| Widgets | `learning_project_card.dart`, `featured_project_card.dart`, `learning_hub_hero.dart`, `learning_category_chips.dart`, `project_components_section.dart`, `project_steps_timeline.dart`, `project_link_list.dart`, `disabled_ai_panel.dart` |

## Backend files

| Area | Path |
|------|------|
| Module | `modules/learning-projects/learning-projects.routes.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `.validation.ts` |

Repository filter: `status: 'PUBLISHED'` (`learning-projects.repository.ts`).

## API endpoints

| Method | Path | Auth | Flutter wired |
|--------|------|------|---------------|
| GET | `/api/learning-projects` | Public | **Yes** — Learning Hub list |
| GET | `/api/learning-projects/:id` | Public | **Yes** — Learning Hub detail |
| GET | `/api/categories?type=PROJECT` | Public | **Yes** — category chips |
| POST | `/api/learning-projects/submit` | JWT + LEARNER | **Yes** — add-draft submit |
| GET/PATCH | `/api/admin/learning-projects*` | JWT + ADMIN | **Yes** — admin moderation portal |

Optional list filters: `page`, `limit`, `q`, `categoryId`, `difficulty`, `tag`. Flutter `/learning` exposes `q`, `categoryId`, `difficulty`, and tag chips derived from tags returned in the project list response.

## Database tables

| Table | Role |
|-------|------|
| `learning_projects` | Core project |
| `project_images` | Gallery |
| `project_required_components` | BOM-style components |
| `project_steps` | Instructions |
| `project_links` | External links |
| `project_tags` | Tags on list items |
| `categories` | Project category (PROJECT or BOTH type) |

## Reusable components

- App-level: `EntryNavBar`
- Learning hub widgets are **feature-specific** — not in `shared/widgets/` (see [reusable-widgets](../frontend/reusable-widgets.md))

## Known gaps / Needs verification

- Project IDs are backend UUIDs; old mock slug bookmarks will not resolve.
- `ratingSummary` is currently null in backend responses — rating UI stays hidden.
- Project moderation is admin-backed; a separate moderator portal/workspace is still **not implemented**.
- Hub “Load more” is client-side within the first fetched page; server `page > 1` navigation is not exposed in the UI yet.
- AI material matching — **not implemented**.
- Save project, like project, follow project/category, start build, build checklist, and available/missing/alternative material coverage — **not implemented**.
