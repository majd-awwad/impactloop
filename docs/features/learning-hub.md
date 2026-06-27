# Learning Hub Feature

**Sources inspected:** `apps/frontend/lib/features/learning_hub/`, `apps/backend/src/modules/learning-projects/`, `docs/08-implementation-status.md`

## Purpose

Browse educational project ideas (components, steps, links) for inspiration. **Learning only** — no in-hub material booking or AI matching in the current UI.

## Current status

| Layer | Status | Notes |
|-------|--------|-------|
| Backend `learning-projects` | **Implemented** | Public read list + detail (`PUBLISHED` only in repository) |
| Flutter `learning_hub` | **Partial** | **Frontend mock-only** — does not call API |
| Add draft page | **Mock-only** | Interactive form; **no submit API** |
| AI panel on detail | **Frontend-only** | `disabled_ai_panel.dart` — placeholder |
| Ratings on cards | **Mock-only** | `MockRatingSummaryCard`, mock rating fields in mock data |
| AI material agent | **Not implemented** | No `ai-agent` module |

**Critical:** Do **not** treat Learning Hub UI as API-backed. Backend API exists separately and is used by seeds/tests — **not** wired in `learning_hub_page.dart` or `learning_project_details_page.dart`.

## Main user flow (as shipped in Flutter)

1. User opens `/learning` (public).
2. Page reads `learningProjects` from `learning_hub_mock_data.dart` — featured + paginated “load more” client-side.
3. User filters categories via chips (local mock data).
4. Tap project → `/learning/:id` → `learningProjectById(projectId)` from same mock file.
5. Optional: `/learning/add-draft` — edit mock form; submit does not persist.

## Frontend files

| Area | Path |
|------|------|
| Mock data | `data/learning_hub_mock_data.dart` |
| Domain | `domain/models/learning_project.dart` |
| Pages | `presentation/pages/learning_hub_page.dart`, `learning_project_details_page.dart`, `learning_add_draft_page.dart` |
| Widgets | `learning_project_card.dart`, `featured_project_card.dart`, `learning_hub_hero.dart`, `learning_category_chips.dart`, `project_components_section.dart`, `project_steps_timeline.dart`, `project_link_list.dart`, `disabled_ai_panel.dart`, `mock_rating_summary_card.dart` |

**No** `learning_hub_api.dart` or repository provider found.

## Backend files

| Area | Path |
|------|------|
| Module | `modules/learning-projects/learning-projects.routes.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `.validation.ts` |

Repository filter: `status: 'PUBLISHED'` (`learning-projects.repository.ts`).

## API endpoints (backend-only relative to current Flutter UI)

| Method | Path | Auth | Flutter wired |
|--------|------|------|---------------|
| GET | `/api/learning-projects` | Public | **No** |
| GET | `/api/learning-projects/:id` | Public | **No** |

Optional category filter via query — see `learning-projects.validation.ts`.

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

- **Wire Flutter to `GET /api/learning-projects`** — primary integration gap.
- Mock project IDs (e.g. `robot-sorter`) will not match database UUIDs until API integration.
- `ratingSummary: null` in backend list mapper — ratings **not** in API.
- Project submission / moderator review — **not implemented** in Flutter; draft page is mock.
- AI material matching — **not implemented**.
