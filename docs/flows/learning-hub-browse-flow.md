# Learning Hub Browse Flow

**Sources inspected:** `learning_hub_page.dart`, `learning_project_details_page.dart`, `learning_spotlight_section.dart`, `learning_hub_providers.dart`, `api_learning_hub_repository.dart`, `learning-projects.service.ts`, `learning-projects.repository.ts`, `learning_add_draft_page.dart`

## Trigger

User opens **Learning Hub** from landing nav (`/learning`), Home spotlight (`/home`), or direct link to `/learning/:id`.

Public API returns **PUBLISHED** projects only (`learning-projects.repository.ts`).

---

## Flow — Browse project list (`/learning`)

### User path

1. Land on Learning Hub hero + category chips + featured card + project grid.
2. Optional: tap a category chip → list refetches with `categoryId`.
3. Optional: tap **Load more** → reveals more items from the **current first page** (client-side chunk; does not fetch `page > 1` yet).
4. Tap a project card → detail page at `/learning/<uuid>`.

### Frontend path

`LearningHubPage` → `learningProjectsProvider(LearningProjectsQuery(page: 1, limit: 20, categoryId: …))` → `ApiLearningHubRepository.fetchProjects` → `LearningHubApiMapper`.

Category chips → `projectCategoriesProvider` → `GET /api/categories?type=PROJECT`.

Featured project = first item in API list (not a backend field).

**No mock fallback** on API failure — error panel with retry (`ref.invalidate`).

### Backend path

`GET /api/learning-projects` with optional query: `page`, `limit`, `q`, `categoryId`, `difficulty`, `tag`.

Repository filter: `status = PUBLISHED`, active PROJECT/BOTH categories.

### Database changes

Read-only.

### Success state

Grid shows API-backed project cards with UUID ids. Hero stats use `pagination.total`.

### Error states

| Condition | UI |
|-----------|-----|
| Network/server error | “Unable to load learning projects” + **Try again** |
| Empty published list | “No published projects yet.” |
| Category filter returns zero | Same empty state (chips hidden until data returns) |

### Files involved

`learning_hub_page.dart`, `learning_hub_providers.dart`, `api_learning_hub_repository.dart`, `learning_hub_api_mapper.dart`, `learning_project_card.dart`, `featured_project_card.dart`, `learning_category_chips.dart`

---

## Flow — Project detail (`/learning/:id`)

### Trigger

Navigation to `/learning/:id` where `:id` is a backend UUID.

### User path

View title, summary/description, cover/first image, required components, steps, links, and disabled AI panel.

Ratings are **hidden** when backend `ratingSummary` is null (current API always returns null).

### Frontend path

`LearningProjectDetailsPage` → `learningProjectProvider(id)` → `GET /api/learning-projects/:id` → mapper.

404 / missing published project → “Project not found” (not mock slug lookup).

Invalid UUID → validation error panel with retry (not crash).

**No mock fallback** on API failure.

### Backend path

`GET /api/learning-projects/:id` — single project where `status = PUBLISHED`.

### Database changes

Read-only.

### Success state

Detail sections render from API DTOs (components, steps, links, images).

### Error states

| Condition | UI |
|-----------|-----|
| Loading | `CircularProgressIndicator` |
| Network/server error | “Unable to load project” + retry |
| 404 / not published | “Project not found” + back to `/learning` |

### Files involved

`learning_project_details_page.dart`, `learning_hub_providers.dart`, `project_components_section.dart`, `project_steps_timeline.dart`, `project_link_list.dart`, `disabled_ai_panel.dart`

**Not used on detail:** `learning_hub_mock_data.dart`, `mock_rating_summary_card.dart`

---

## Flow — Home learning spotlight (`/home`)

### Trigger

Authenticated learner opens `/home`.

### User path

See up to two published projects; tap card → `/learning/<uuid>`.

### Frontend path

`LearningSpotlightSection` → `learningProjectsProvider(LearningProjectsQuery(page: 1, limit: 2))` — same provider/repository as Hub list.

Loading / error / empty states; **no mock fallback**.

### Backend path

Same as list: `GET /api/learning-projects? page=1&limit=2`.

### Files involved

`learning_spotlight_section.dart`, `learning_hub_providers.dart`

---

## Flow — Add draft (mock only)

### Trigger

User navigates to `/learning/add-draft`.

### User path

Fill title, summary, components, steps, links → tap submit → snackbar only (“Project review flow will be connected later.”).

### Frontend path

`LearningAddDraftPage` — local controllers; imports `learning_hub_mock_data.dart` for palette re-export and legacy copy only.

### Backend path

**None.** No create/submit endpoint mounted.

### Database changes

**None.**

### Files involved

`learning_add_draft_page.dart`, `learning_hub_mock_data.dart`, `disabled_ai_panel.dart`

---

## API query params — backend vs UI

| Param | Backend | Repository | UI exposed |
|-------|---------|------------|------------|
| `page` | Yes | Yes | Hub: always `1`; Home: `1` |
| `limit` | Yes | Yes | Hub: `20`; Home: `2` |
| `categoryId` | Yes | Yes | **Yes** — category chips |
| `q` | Yes | Yes | **No** |
| `difficulty` | Yes | Yes | **No** |
| `tag` | Yes | Yes | **No** |

Hub “Load more” is client-side pagination within the first fetched page, not server `page > 1`.

---

## Legacy mock file (not production read path)

`learning_hub_mock_data.dart` still exists for:

- Add-draft page palette/constants
- Disabled AI panel copy
- Unused mock catalog (`learningProjects`, `learningProjectById`, etc.) — **not** used by list/detail/home spotlight

---

## Not implemented

- Project create/submit/review workflow (backend POST + moderator approve)
- Learner booking materials from project components
- AI material matching (`ai-agent` module)
- Learning project ratings/reviews (API returns `ratingSummary: null`; no project review target type)
- Clickable external links (`url_launcher` not wired — display-only URLs)
- Hub search (`q`), difficulty filter, tag filter, server-side page navigation
- Admin/moderator project review UI

---

## Open questions

See [09-open-questions.md](../09-open-questions.md) — Learning hub section for submission workflow, ratings model, AI matching, external links, and filter/pagination UI.
