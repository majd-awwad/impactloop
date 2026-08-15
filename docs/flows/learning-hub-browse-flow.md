# Learning Hub Browse Flow

**Sources inspected:** `learning_hub_page.dart`, `learning_project_details_page.dart`, `learning_project_submissions_page.dart`, `learning_spotlight_section.dart`, `learning_hub_providers.dart`, `api_learning_hub_repository.dart`, `learning-projects.service.ts`, `learning-projects.repository.ts`, `learning_add_draft_page.dart`

## Trigger

User opens **Learning Hub** from landing nav (`/learning`), Home spotlight (`/home`), or direct link to `/learning/:id`.

Public API returns **PUBLISHED** projects only (`learning-projects.repository.ts`).

---

## Flow — Browse project list (`/learning`)

### User path

1. Land on Learning Hub hero + category chips + search/difficulty/tag filters + list-mode tabs + project grid. Optional `/learning?q=<search>` opens with the search box pre-filled.
2. Optional: tap a category chip → list refetches with `categoryId`.
3. Optional: type a search term → list refetches with `q` after a short debounce.
4. Optional: choose difficulty → list refetches with `difficulty`.
5. Optional: tap a tag chip → list refetches with `tag`.
6. Optional: switch to **Saved** or **Following** → learner-only list refetches with the same filters from the saved/followed endpoint.
7. Optional: use **Previous** / **Next** pagination controls → refetches the active project list with the selected server page.
8. Tap a project card → detail page at `/learning/<uuid>`.

### Frontend path

`LearningHubPage(initialSearch: state.uri.queryParameters['q'])` → `learningProjectsProvider`, `savedLearningProjectsProvider`, or `followedLearningProjectsProvider` with `LearningProjectsQuery(page: selectedPage, limit: 12, q: …, categoryId: …, difficulty: …, tag: …)` → `ApiLearningHubRepository` → `LearningHubApiMapper`.

Category chips → `projectCategoriesProvider` → `GET /api/categories?type=PROJECT`.

Tag chips are derived from the `tags` array already returned by the project list response. There is no separate tags endpoint. The UI hides internal/mock tags such as `mock`, `pagination`, `test`, and `project-01`, and caps the visible chip list.

Project of the week renders only when a project DTO explicitly has a featured/spotlight flag. It is not inferred from the first/latest API result. Later pages and saved/followed tabs render as regular project grids.

**No mock fallback** on API failure — error panel with retry (`ref.invalidate`).

### Backend path

`GET /api/learning-projects` with optional query: `page`, `limit`, `q`, `categoryId`, `difficulty`, `tag`.

`GET /api/learning-projects/me/saved` and `GET /api/learning-projects/me/followed` require learner auth, accept the same query params, and filter the list to the viewer's saved or followed projects.

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
| Empty saved/followed tab without active filters | Saved/followed-specific empty state |
| Active filters return zero | “No projects match your filters” + **Clear filters** |

### Files involved

`learning_hub_page.dart`, `learning_hub_providers.dart`, `api_learning_hub_repository.dart`, `learning_hub_api_mapper.dart`, `learning_project_card.dart`, `featured_project_card.dart`, `learning_category_chips.dart`

---

## Flow — Project detail (`/learning/:id`)

### Trigger

Navigation to `/learning/:id` where `:id` is a backend UUID.

### User path

View title, summary/description, cover/first image, required components, project like count/toggle, save toggle, follow count/toggle, learner reviews, non-AI build checklist actions, steps, and clickable safe project links. Learning Hub list cards and Home spotlight cards expose the same compact like/save/follow controls.

Ratings are hidden when `ratingSummary` is null. When learner reviews exist, list/detail cards show the real average/count and detail shows recent reviews plus the authenticated learner's own review form.

### Frontend path

`LearningProjectDetailsPage` → `learningProjectProvider(id)` → `GET /api/learning-projects/:id` → mapper.

The like, save, and follow pills use widget-local optimistic state on list, Home spotlight, and detail surfaces. Guests are routed to `/login?from=/learning/<id>`, non-learner authenticated users receive an info snackbar, and learners call repository `likeProject` / `unlikeProject` / `saveProject` / `unsaveProject` / `followProject` / `unfollowProject` methods. Successful engagement mutations invalidate `learningProjectProvider(id)`, `learningProjectsProvider`, `savedLearningProjectsProvider`, and `followedLearningProjectsProvider` so saved/followed tabs refetch after unsave/unfollow. The reviews section uses repository `reviewProject` and `deleteProjectReview`, then invalidates `learningProjectProvider(id)`.

404 / missing published project → “Project not found” (not mock slug lookup).

Invalid UUID → validation error panel with retry (not crash).

The build checklist panel reads learner build state only for authenticated learner sessions. **Start build** calls `POST /api/learning-projects/:id/builds/start`, then opens `/learning/:id/build`. Existing builds show **Continue checklist**. Guests are sent to `/login?from=/learning/<id>/build`; non-learner authenticated users receive an info snackbar.

The build page fetches `GET /api/learning-projects/:id/builds/me`. If no build exists, the learner can start one. Checklist rows are initialized from required components and manually updated with `PATCH /api/learning-projects/:id/builds/me/items/:itemId`, body `{ status, learnerNote? }`. Supported statuses are `MISSING`, `ALREADY_OWNED`, `AVAILABLE`, `RESERVED`, and `ALTERNATIVE`. Each row exposes **Browse matching materials**, which loads `GET .../material-candidates`, lets the learner link/unlink a platform material, and shows a linked-material panel with reservation status when linked. **Reserve this material** opens `/materials/:id` with build context query params; reservation create may include `buildItemId` to set `linkedReservationId` in the same transaction. Linking alone does **not** auto-mark the item ready; progress uses `isReadyForBuild` (`ALREADY_OWNED` / `AVAILABLE` / `ALTERNATIVE`, or linked reservation `COMPLETED`). **Browse all materials** still opens `/materials?q=<component name>`. No AI matching or related-projects API is used.

**No mock fallback** on API failure.

### Backend path

`GET /api/learning-projects/:id` — single project where `status = PUBLISHED`; optional Bearer auth enables viewer-specific `isLiked`, `isSaved`, `isFollowing`, and `viewerReview`. Detail also returns `recentReviews`.

`POST /api/learning-projects/:id/like` / `DELETE /api/learning-projects/:id/like` — learner-only, idempotent project engagement actions returning `{ projectId, likesCount, isLiked }`.

`POST /api/learning-projects/:id/save` / `DELETE /api/learning-projects/:id/save` — learner-only, idempotent private save actions returning `{ projectId, isSaved }`.

`POST /api/learning-projects/:id/follow` / `DELETE /api/learning-projects/:id/follow` — learner-only, idempotent follow actions returning `{ projectId, followersCount, isFollowing }`.

`PUT /api/learning-projects/:id/review` / `DELETE /api/learning-projects/:id/review` — learner-only project review upsert/delete. Upsert body is `{ rating: 1..5, comment? }`; responses include the updated `ratingSummary`.

`GET /api/learning-projects/:id/builds/me` — learner-only current build checklist; returns `data: null` when the learner has not started the build yet.

`POST /api/learning-projects/:id/builds/start` — learner-only idempotent start; creates one build per learner/project and initializes checklist items from required components.

`PATCH /api/learning-projects/:id/builds/me/items/:itemId` — learner-only manual status/note update; returns the refreshed build checklist.

`GET /api/learning-projects/:id/builds/me/items/:itemId/material-candidates` — learner-only deterministic available-material suggestions (max 10), ranked by match quality/convenience/cost rather than listing freshness alone; includes `matchHints[]`.

`POST /api/learning-projects/:id/builds/me/items/:itemId/link-material` — learner-only link a platform material to the checklist item; body `{ materialId }`.

`DELETE /api/learning-projects/:id/builds/me/items/:itemId/link-material` — learner-only unlink; blocked while an active linked reservation exists.

`POST /api/learning-projects/:id/builds/me/items/:itemId/link-reservation` — learner-only repair link for an existing owned reservation; body `{ reservationId }`.

`POST /api/reservations` — optional `buildItemId` links the created reservation to the checklist item when `linkedMaterialId` matches.

### Database changes

Like/unlike writes `project_likes`; save/unsave writes `project_saves`; follow/unfollow writes `project_follows`; review upsert/delete writes `project_user_reviews`; build start/update writes `project_builds` and `project_build_items`.

### Success state

Detail sections render from API DTOs (components, steps, links, images, review summary/recent reviews). Project links use `url_launcher` for valid `http`/`https` URLs; invalid or missing URLs render disabled. Like count, save state, and follow count/state update optimistically on card/detail controls and then reconcile to the server response. Review create/update/delete refreshes the detail provider after success. Checklist state persists across refresh because it is backend-backed per learner/project.

### Error states

| Condition | UI |
|-----------|-----|
| Loading | `CircularProgressIndicator` |
| Network/server error | “Unable to load project” + retry |
| 404 / not published | “Project not found” + back to `/learning` |

### Files involved

`learning_project_details_page.dart`, `learning_project_build_page.dart`, `learning_hub_providers.dart`, `api_learning_hub_repository.dart`, `project_components_section.dart`, `project_build_actions_panel.dart`, `project_build_material_linking.dart`, `project_reviews_section.dart`, `project_steps_timeline.dart`, `project_link_list.dart`

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

## Flow — Learner submissions and resubmit (`/learning/submissions`)

### Trigger

Authenticated learner opens **My submissions** from `/learning`, a direct URL, or a `LEARNING_PROJECT_MODERATION` notification.

### User path

1. `/learning/submissions` loads the learner's own submitted projects.
2. Cards show status chips for `PENDING_REVIEW`, `CHANGES_REQUESTED`, `REJECTED`, and `PUBLISHED`, submitted/reviewed dates, and admin feedback preview when relevant.
3. `PENDING_REVIEW` is view-only.
4. `CHANGES_REQUESTED` opens `/learning/submissions/:id/edit`; the edit form loads server data, including component ids, and does not touch the local `/learning/add-draft` draft storage.
5. **Save changes** calls PATCH and keeps the project in `CHANGES_REQUESTED`.
6. **Save and resubmit** calls PATCH, then POST `/resubmit`; backend moves the project back to `PENDING_REVIEW`.
7. `REJECTED` is view-only in this slice. Duplicate-as-new-draft is not implemented.
8. `PUBLISHED` shows a CTA to `/learning/:id`.

### Frontend path

`LearningProjectSubmissionsPage` → `myLearningProjectSubmissionsProvider` → `GET /api/learning-projects/mine`.

`LearningProjectSubmissionDetailPage` and `LearningProjectSubmissionEditPage` → `myLearningProjectSubmissionProvider(id)` → `GET /api/learning-projects/mine/:id`.

Edit actions use `learningHubRepositoryProvider.updateMyLearningProjectSubmission(id, payload)` and optionally `resubmitMyLearningProjectSubmission(id)`, then invalidate `myLearningProjectSubmissionProvider(id)` and `myLearningProjectSubmissionsProvider`.

Learning Project notifications route to `/learning/submissions/:id`; they do not route to public `/learning/:id` because unpublished submissions are intentionally not public.

### Backend path

`GET /api/learning-projects/mine` — learner-only, owner-scoped list; supports `page`, `limit`, and optional `status`.

`GET /api/learning-projects/mine/:id` — learner-only owner detail; includes moderation fields visible to the submitter.

`PATCH /api/learning-projects/mine/:id` — learner-only owner edit; allowed only when status is `DRAFT` or `CHANGES_REQUESTED`. Existing component ids are updated in place, new components are created, removed components are deleted only for editable unpublished submissions, and admin enrichment fields are preserved where they are not part of the learner edit payload.

`POST /api/learning-projects/mine/:id/resubmit` — learner-only owner resubmit; allowed only from `CHANGES_REQUESTED`; sets `status = PENDING_REVIEW`, updates `submittedAt`, clears current review fields, and preserves project content.

Public `GET /api/learning-projects/:id` still returns only `PUBLISHED` projects.

### Error states

| Condition | UI/API behavior |
|-----------|-----------------|
| Non-owner id | 404-style not found detail |
| PENDING_REVIEW edit attempt | Locked/view-only UI; backend returns conflict |
| PUBLISHED/REJECTED/HIDDEN/ARCHIVED edit attempt | Locked/view-only UI; backend returns conflict |
| Validation failure | Form/snackbar error from API |

### Files involved

`learning_project_submissions_page.dart`, `learning_hub_providers.dart`, `api_learning_hub_repository.dart`, `learning_hub_api_mapper.dart`, `learning-projects.routes.ts`, `learning-projects.controller.ts`, `learning-projects.service.ts`, `learning-projects.repository.ts`

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

- Learner booking materials directly from project components
- AI material matching (`ai-agent` module)
- Followed categories
- Automatic reservation without learner action from checklist links
- Related projects API on material detail
- Moderator project review UI / moderator workspace
- Admin/moderator-selected Project of the week spotlight workflow

---

## Open questions

See [product/open-questions.md](../product/open-questions.md) — Learning hub section for ratings model, AI matching, and moderator workspace.
