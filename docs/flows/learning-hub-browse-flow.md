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
6. Optional: use **Previous** / **Next** pagination controls → refetches the project list with the selected server page.
7. Tap a project card → detail page at `/learning/<uuid>`.

### Frontend path

`LearningHubPage` → `learningProjectsProvider(LearningProjectsQuery(page: selectedPage, limit: 12, q: …, categoryId: …, difficulty: …, tag: …))` → `ApiLearningHubRepository.fetchProjects` → `LearningHubApiMapper`.

Category chips → `projectCategoriesProvider` → `GET /api/categories?type=PROJECT`.

Tag chips are derived from the `tags` array already returned by the project list response. There is no separate tags endpoint.

Featured project = first item on page 1 (not a backend field). Later pages render as regular project grids.

**No mock fallback** on API failure — error panel with retry (`ref.invalidate`).

### Backend path

`GET /api/learning-projects` with optional query: `page`, `limit`, `q`, `categoryId`, `difficulty`, `tag`.

Repository filter: `status = PUBLISHED`, active PROJECT/BOTH categories.

### Database changes

Read-only.

### Success state

Grid shows API-backed project cards with UUID ids. Hero stats use `pagination.total`. Pagination controls are shown when `pagination.totalPages > 1`.

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

View title, summary/description, cover/first image, required components, project like count/toggle, save toggle, follow count/toggle, non-AI project planning actions, steps, and clickable safe project links.

Ratings are **hidden** when backend `ratingSummary` is null (current API always returns null).

### Frontend path

`LearningProjectDetailsPage` → `learningProjectProvider(id)` → `GET /api/learning-projects/:id` → mapper.

The like, save, and follow pills use widget-local optimistic state. Guests are routed to `/login?from=/learning/<id>`, non-learner authenticated users receive an info snackbar, and learners call repository `likeProject` / `unlikeProject` / `saveProject` / `unsaveProject` / `followProject` / `unfollowProject` methods.

404 / missing published project → “Project not found” (not mock slug lookup).

Invalid UUID → validation error panel with retry (not crash).

**No mock fallback** on API failure.

### Backend path

`GET /api/learning-projects/:id` — single project where `status = PUBLISHED`; optional Bearer auth enables viewer-specific `isLiked`, `isSaved`, and `isFollowing`.

`POST /api/learning-projects/:id/like` / `DELETE /api/learning-projects/:id/like` — learner-only, idempotent project engagement actions returning `{ projectId, likesCount, isLiked }`.

`POST /api/learning-projects/:id/save` / `DELETE /api/learning-projects/:id/save` — learner-only, idempotent private save actions returning `{ projectId, isSaved }`.

`POST /api/learning-projects/:id/follow` / `DELETE /api/learning-projects/:id/follow` — learner-only, idempotent follow actions returning `{ projectId, followersCount, isFollowing }`.

### Database changes

Like/unlike writes `project_likes`; save/unsave writes `project_saves`; follow/unfollow writes `project_follows`; detail read is otherwise read-only.

### Success state

Detail sections render from API DTOs (components, steps, links, images). Project links use `url_launcher` for valid `http`/`https` URLs; invalid or missing URLs render disabled. Like count, save state, and follow count/state update optimistically and then reconcile to the server response.

### Error states

| Condition | UI |
|-----------|-----|
| Loading | `CircularProgressIndicator` |
| Network/server error | “Unable to load project” + retry |
| 404 / not published | “Project not found” + back to `/learning` |

### Files involved

`learning_project_details_page.dart`, `learning_hub_providers.dart`, `api_learning_hub_repository.dart`, `project_components_section.dart`, `project_build_actions_panel.dart`, `project_steps_timeline.dart`, `project_link_list.dart`

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

User opens `/learning/add-draft` directly or from the Learning Hub "Add project draft" CTA.

### User path

Fill title, summary, components, steps, links → tap submit → project is sent for admin review.

### Frontend path

`LearningAddDraftPage` uses the shared form controls, validates title/summary/category plus optional component/step/link limits, maps difficulty to `BEGINNER` / `INTERMEDIATE` / `ADVANCED`, maps duration to minutes, parses component/step/link text, then calls `learningHubRepositoryProvider.submitProjectForReview` with one `Idempotency-Key` per form session. On success, the local draft is cleared and the learner returns to Learning Hub. Learners can also save an incomplete form as a local device draft; that local save does not create a backend project row.

### Backend path

`POST /api/learning-projects/submit` with JWT + `LEARNER` role + `Idempotency-Key`. Backend validates the body and creates a `PENDING_REVIEW` project. Same learner + same key + same body replays the stored response without inserting another project; same key with a different body returns `409 IDEMPOTENCY_KEY_REUSED`.

### Database changes

Creates a `learning_projects` row with `status = PENDING_REVIEW`, `submittedAt`, `submittedByUserId`, plus optional components, steps, and links. The successful response is stored in `idempotency_records` under scope `LEARNING_PROJECT_SUBMIT`.

### Files involved

`learning_add_draft_page.dart`, `learning_hub_providers.dart`, `api_learning_hub_repository.dart`, `learning-projects.routes.ts`, `learning-projects.service.ts`, `learning-projects.repository.ts`

---

## API query params — backend vs UI

| Param | Backend | Repository | UI exposed |
|-------|---------|------------|------------|
| `page` | Yes | Yes | **Yes** — Hub previous/next controls; Home: `1` |
| `limit` | Yes | Yes | Hub: `12`; Home: `2` |
| `categoryId` | Yes | Yes | **Yes** — category chips |
| `q` | Yes | Yes | **Yes** — search input |
| `difficulty` | Yes | Yes | **Yes** — Easy/Medium/Advanced chips mapped to `BEGINNER`/`INTERMEDIATE`/`ADVANCED` |
| `tag` | Yes | Yes | **Yes** — tag chips from returned project tags |

Hub page controls fetch server pages beyond `page=1` while preserving active filters.

---

## Legacy mock file (not production read path)

`learning_hub_mock_data.dart` still contains an unused mock catalog (`learningProjects`, `learningProjectById`, etc.) — **not** used by list/detail/home spotlight.

---

## Not implemented

- Learner booking materials from project components
- AI material matching (`ai-agent` module)
- Learning project ratings/reviews (API returns `ratingSummary: null`; no project review target type)
- Saved/followed-project listing and followed categories
- Moderator project review UI / moderator workspace

---

## Open questions

See [09-open-questions.md](../09-open-questions.md) — Learning hub section for ratings model, AI matching, and moderator workspace.
