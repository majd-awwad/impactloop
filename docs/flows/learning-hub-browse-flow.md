# Learning Hub Browse Flow

**Sources inspected:** `learning_hub_page.dart`, `learning_project_details_page.dart`, `learning_spotlight_section.dart`, `learning_hub_providers.dart`, `api_learning_hub_repository.dart`, `learning-projects.service.ts`, `learning-projects.repository.ts`, `learning_add_draft_page.dart`

## Trigger

User opens **Learning Hub** from landing nav (`/learning`), Home spotlight (`/home`), or direct link to `/learning/:id`.

Public API returns **PUBLISHED** projects only (`learning-projects.repository.ts`).

---

## Flow — Browse project list (`/learning`)

### User path

1. Land on Learning Hub hero + category chips + search/difficulty/tag filters + featured card + project grid.
2. Optional: tap a category chip → list refetches with `categoryId`.
3. Optional: type a search term → list refetches with `q` after a short debounce.
4. Optional: choose difficulty → list refetches with `difficulty`.
5. Optional: tap a tag chip → list refetches with `tag`.
6. Optional: tap **Load more** → reveals more items from the **current first page** (client-side chunk; does not fetch `page > 1` yet).
7. Tap a project card → detail page at `/learning/<uuid>`.

### Frontend path

`LearningHubPage` → `learningProjectsProvider(LearningProjectsQuery(page: 1, limit: 20, q: …, categoryId: …, difficulty: …, tag: …))` → `ApiLearningHubRepository.fetchProjects` → `LearningHubApiMapper`.

Category chips → `projectCategoriesProvider` → `GET /api/categories?type=PROJECT`.

Tag chips are derived from the `tags` array already returned by the project list response. There is no separate tags endpoint.

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
| Empty published list without active filters | “No published projects yet.” |
| Active filters return zero | “No projects match your filters” + **Clear filters** |

### Files involved

`learning_hub_page.dart`, `learning_hub_providers.dart`, `api_learning_hub_repository.dart`, `learning_hub_api_mapper.dart`, `learning_project_card.dart`, `featured_project_card.dart`, `learning_category_chips.dart`

---

## Flow — Project detail (`/learning/:id`)

### Trigger

Navigation to `/learning/:id` where `:id` is a backend UUID.

### User path

View title, summary/description, cover/first image, required components, steps, clickable safe project links, and disabled AI panel.

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

Detail sections render from API DTOs (components, steps, links, images). Project links use `url_launcher` for valid `http`/`https` URLs; invalid or missing URLs render disabled.

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

## Flow — Add draft submit (`/learning/add-draft`)

### Trigger

User navigates to `/learning/add-draft`.

### User path

Fill title, summary, components, steps, links → tap submit → project is sent for admin review.

### Frontend path

`LearningAddDraftPage` validates title/summary/category, maps difficulty to `BEGINNER` / `INTERMEDIATE` / `ADVANCED`, parses component/step/link text, then calls `learningHubRepositoryProvider.submitProjectForReview`.

### Backend path

`POST /api/learning-projects/submit` with JWT + `LEARNER` role. Backend validates the body and creates a `PENDING_REVIEW` project.

### Database changes

Creates a `learning_projects` row with `status = PENDING_REVIEW`, `submittedAt`, `submittedByUserId`, plus optional components, steps, and links.

### Files involved

`learning_add_draft_page.dart`, `learning_hub_providers.dart`, `api_learning_hub_repository.dart`, `learning-projects.routes.ts`, `learning-projects.service.ts`, `learning-projects.repository.ts`

---

## API query params — backend vs UI

| Param | Backend | Repository | UI exposed |
|-------|---------|------------|------------|
| `page` | Yes | Yes | Hub: always `1`; Home: `1` |
| `limit` | Yes | Yes | Hub: `20`; Home: `2` |
| `categoryId` | Yes | Yes | **Yes** — category chips |
| `q` | Yes | Yes | **Yes** — search input |
| `difficulty` | Yes | Yes | **Yes** — Easy/Medium/Advanced chips mapped to `BEGINNER`/`INTERMEDIATE`/`ADVANCED` |
| `tag` | Yes | Yes | **Yes** — tag chips from returned project tags |

Hub “Load more” is client-side pagination within the first fetched page, not server `page > 1`.

---

## Legacy mock file (not production read path)

`learning_hub_mock_data.dart` still exists for:

- Disabled AI panel copy
- Unused mock catalog (`learningProjects`, `learningProjectById`, etc.) — **not** used by list/detail/home spotlight

---

## Not implemented

- Learner booking materials from project components
- AI material matching (`ai-agent` module)
- Learning project ratings/reviews (API returns `ratingSummary: null`; no project review target type)
- Server-side page navigation
- Moderator project review UI / moderator workspace

---

## Open questions

See [09-open-questions.md](../09-open-questions.md) — Learning hub section for ratings model, AI matching, moderator workspace, and server-side pagination UI.
