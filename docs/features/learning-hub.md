# Learning Hub Feature

**Sources inspected:** `apps/frontend/lib/features/learning_hub/`, `apps/backend/src/modules/learning-projects/`, `docs/08-implementation-status.md`

## Purpose

Browse educational project ideas (components, steps, links) for inspiration. **Learning only** — no in-hub material booking or AI matching in the current UI.

## Current status

| Layer | Status | Notes |
|-------|--------|-------|
| Backend `learning-projects` | **Implemented** | Public read list + detail (`PUBLISHED` only in repository) |
| Flutter list/detail pages | **Partial** | `/learning` and `/learning/:id` use `ApiLearningHubRepository` + Riverpod providers |
| Home learning spotlight | **Mock-only** | Still reads `learning_hub_mock_data.dart` until Phase 2 |
| Add draft page | **Mock-only** | Interactive form; **no submit API** |
| AI panel on detail | **Frontend-only** | `disabled_ai_panel.dart` — placeholder |
| Ratings on cards/detail | **Partial** | Hidden when backend `ratingSummary` is null (current API returns null) |
| AI material agent | **Not implemented** | No `ai-agent` module |

**Critical:** Learning Hub main pages are API-backed. Do **not** treat Home spotlight or add-draft as API-backed.

## Main user flow (as shipped in Flutter)

1. User opens `/learning` (public).
2. Page loads published projects from `GET /api/learning-projects` via `learningProjectsProvider`.
3. Category chips filter by `categoryId` using `GET /api/categories?type=PROJECT`.
4. First list item is shown as featured; remaining items render in the grid.
5. Tap project → `/learning/:id` → `learningProjectProvider(id)` loads detail from `GET /api/learning-projects/:id`.
6. Optional: `/learning/add-draft` — mock form only; submit does not persist.
7. Home `/home` learning spotlight still uses mock preview data (Phase 2).

## Frontend files

| Area | Path |
|------|------|
| Repository | `domain/learning_project_repository.dart`, `data/api_learning_hub_repository.dart`, `data/learning_hub_api_mapper.dart` |
| Providers | `application/learning_hub_providers.dart` |
| Legacy mock data | `data/learning_hub_mock_data.dart` (Home spotlight + add-draft only) |
| Theme | `presentation/theme/learning_ui_palette.dart`, `learning_project_visuals.dart` |
| Domain | `domain/models/learning_project.dart`, `domain/learning_projects_result.dart` |
| Pages | `presentation/pages/learning_hub_page.dart`, `learning_project_details_page.dart`, `learning_add_draft_page.dart` |
| Widgets | `learning_project_card.dart`, `featured_project_card.dart`, `learning_hub_hero.dart`, `learning_category_chips.dart`, `project_components_section.dart`, `project_steps_timeline.dart`, `project_link_list.dart`, `disabled_ai_panel.dart` |

## Backend files

| Area | Path |
|------|------|
| Module | `modules/learning-projects/learning-projects.routes.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `.validation.ts` |

Repository filter: `status: 'PUBLISHED'` (`learning-projects.repository.ts`).

## API endpoints (backend-only relative to current Flutter UI)

| Method | Path | Auth | Flutter wired |
|--------|------|------|---------------|
| GET | `/api/learning-projects` | Public | **Yes** — Learning Hub list |
| GET | `/api/learning-projects/:id` | Public | **Yes** — Learning Hub detail |
| GET | `/api/categories?type=PROJECT` | Public | **Yes** — category chips |

Optional list filters: `page`, `limit`, `q`, `categoryId`, `difficulty`, `tag`.

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

- Home learning spotlight still mock-only until it reuses `learningProjectsProvider` (Phase 2).
- Project IDs are backend UUIDs; old mock slug bookmarks will not resolve.
- `ratingSummary` is currently null in backend responses — rating UI stays hidden.
- Project links are display-only (`url_launcher` not in dependencies).
- Project submission / moderator review — **not implemented** in Flutter; draft page is mock.
- AI material matching — **not implemented**.
