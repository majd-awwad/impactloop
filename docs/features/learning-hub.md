# Learning Hub Feature

**Sources inspected:** `apps/frontend/lib/features/learning_hub/`, `apps/backend/src/modules/learning-projects/`, `docs/08-implementation-status.md`

## Purpose

Browse educational project ideas (components, steps, links) for inspiration. The current UI supports browsing, saved/followed project tabs, detail, learner draft submission, admin review, project likes/saves/follows, project ratings/reviews, a frontend-local build checklist, and material browsing handoff. Persisted build checklists, in-hub booking, and AI material matching are not shipped yet.

## Current status

| Layer | Status | Notes |
|-------|--------|-------|
| Backend `learning-projects` | **Implemented** | Public read list + detail (`PUBLISHED` only in repository), learner likes/saves/follows, and learner submit |
| Flutter list/detail pages | **Partial** | `/learning` and `/learning/:id` use `ApiLearningHubRepository` + Riverpod providers; browse exposes category, search, optional `q` route search prefill, difficulty, tag filters, server-side page navigation, saved/followed tabs for learners, in-card engagement controls, rating summaries, and viewer saved/followed state |
| Home learning spotlight | **Implemented** | Reuses `learningProjectsProvider` with `limit: 2` on `/home` |
| Project likes | **Implemented** | List/home/detail surfaces have optimistic learner-only like/unlike controls backed by `POST`/`DELETE /api/learning-projects/:id/like` |
| Project saves | **Implemented** | List/home/detail surfaces have optimistic learner-only save/unsave controls backed by `POST`/`DELETE /api/learning-projects/:id/save` |
| Project follows | **Implemented** | List/home/detail surfaces have optimistic learner-only follow/unfollow controls backed by `POST`/`DELETE /api/learning-projects/:id/follow` |
| Add draft page | **Implemented for learner submit** | `LearningAddDraftPage` is reachable from Learning Hub, can save a local device draft, and posts to `POST /api/learning-projects/submit` with `Idempotency-Key`; submitted projects enter `PENDING_REVIEW` |
| Admin project moderation | **Implemented** | `/admin/learning-projects` lists, filters, reviews, approves/rejects/request-changes, hides/restores, and archives projects |
| Project build checklist | **Frontend-only** | Detail can start a local checklist from required components, manually mark `Available`, `Missing`, `Alternative`, `Already owned`, or `Reserved`, and deep-link each component to Materials search |
| Ratings/reviews | **Implemented** | List/home cards show real `ratingSummary` when reviews exist; detail shows recent reviews and a learner-only review form backed by `PUT`/`DELETE /api/learning-projects/:id/review` |
| Project links | **Implemented** | Detail links open safe `http`/`https` URLs through `url_launcher`; invalid/missing URLs are disabled |
| AI material agent | **Not implemented** | No `ai-agent` module |

Product intent from role planning: the learning hub should support persisted project-to-material linking, automatic material coverage, and durable start-build/checklist flows. Saved/followed project listing is now API-backed in the Learning Hub page; the current checklist is local UI state only and does not yet store project build progress.

**Critical:** Learning Hub list/detail, Home spotlight, learner project submission, and admin project moderation are API-backed. The legacy mock catalog is not a production read path.

## Main user flow (as shipped in Flutter)

1. User opens `/learning` (public).
2. Page loads published projects from `GET /api/learning-projects` via `learningProjectsProvider`; optional `/learning?q=<search>` pre-fills the search box and initial query.
3. Category chips filter by `categoryId` using `GET /api/categories?type=PROJECT`; search, difficulty, and tag filters use the existing learning projects query params.
4. Optional: switch between **All projects**, **Saved**, and **Following** tabs. Saved/followed tabs require an authenticated learner and call `GET /api/learning-projects/me/saved` or `GET /api/learning-projects/me/followed` with the same filters.
5. First list item on page 1 is shown as featured only in **All projects**; remaining items render in the grid. Later pages and saved/followed tabs render as paginated grids.
6. Next/previous pagination changes the `page` query sent to the active list endpoint while preserving active filters.
7. Tap project → `/learning/:id` → `learningProjectProvider(id)` loads detail from `GET /api/learning-projects/:id`; existing project links can be opened when they contain valid `http`/`https` URLs.
8. Authenticated learners can like/unlike, save/unsave, and follow/unfollow from list, Home spotlight, and detail cards; they can review the project from detail. Guests are sent to login and non-learner roles get an info snackbar.
9. Optional: `/learning/add-draft` — authenticated learner submits a draft to `POST /api/learning-projects/submit` with an `Idempotency-Key`; backend stores it as `PENDING_REVIEW` and replays duplicate same-key submissions without creating another project.
10. Home `/home` learning spotlight loads up to 2 published projects via `learningProjectsProvider`.

## Frontend files

| Area | Path |
|------|------|
| Repository | `domain/learning_project_repository.dart`, `data/api_learning_hub_repository.dart`, `data/learning_hub_api_mapper.dart` |
| Providers | `application/learning_hub_providers.dart` |
| Legacy mock data | `data/learning_hub_mock_data.dart` (unused sample catalog only) |
| Theme | `presentation/theme/learning_ui_palette.dart`, `learning_project_visuals.dart` |
| Domain | `domain/models/learning_project.dart`, `domain/learning_projects_result.dart` |
| Pages | `presentation/pages/learning_hub_page.dart`, `learning_project_details_page.dart`, `learning_add_draft_page.dart` |
| Widgets | `learning_project_card.dart`, `featured_project_card.dart`, `learning_hub_hero.dart`, `learning_category_chips.dart`, `project_components_section.dart`, `project_build_actions_panel.dart`, `project_steps_timeline.dart`, `project_link_list.dart`, `project_reviews_section.dart`, `project_engagement_strip.dart` |

## Backend files

| Area | Path |
|------|------|
| Module | `modules/learning-projects/learning-projects.routes.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `.validation.ts` |

Repository filter: `status: 'PUBLISHED'` (`learning-projects.repository.ts`).

## API endpoints

| Method | Path | Auth | Flutter wired |
|--------|------|------|---------------|
| GET | `/api/learning-projects` | Public | **Yes** — Learning Hub list |
| GET | `/api/learning-projects/me/saved` | JWT + LEARNER | **Yes** — Learning Hub Saved tab |
| GET | `/api/learning-projects/me/followed` | JWT + LEARNER | **Yes** — Learning Hub Following tab |
| GET | `/api/learning-projects/:id` | Public | **Yes** — Learning Hub detail |
| POST | `/api/learning-projects/:id/like` | JWT + LEARNER | **Yes** — list/Home/detail like |
| DELETE | `/api/learning-projects/:id/like` | JWT + LEARNER | **Yes** — list/Home/detail unlike |
| POST | `/api/learning-projects/:id/save` | JWT + LEARNER | **Yes** — list/Home/detail save |
| DELETE | `/api/learning-projects/:id/save` | JWT + LEARNER | **Yes** — list/Home/detail unsave |
| POST | `/api/learning-projects/:id/follow` | JWT + LEARNER | **Yes** — list/Home/detail follow |
| DELETE | `/api/learning-projects/:id/follow` | JWT + LEARNER | **Yes** — list/Home/detail unfollow |
| PUT | `/api/learning-projects/:id/review` | JWT + LEARNER | **Yes** — detail review create/update |
| DELETE | `/api/learning-projects/:id/review` | JWT + LEARNER | **Yes** — detail review delete |
| POST | `/api/learning-projects/submit` | Learner auth | **Yes** — add-draft submit for admin review |
| GET | `/api/categories?type=PROJECT` | Public | **Yes** — category chips |
| POST | `/api/learning-projects/submit` | JWT + LEARNER + `Idempotency-Key` | **Yes** — add-draft submit |
| GET/PATCH | `/api/admin/learning-projects*` | JWT + ADMIN | **Yes** — admin moderation portal |

Optional list filters: `page`, `limit`, `q`, `categoryId`, `difficulty`, `tag`. Saved/followed learner list endpoints support the same filters and return the same list response shape. List/detail DTOs include `likesCount`, `followersCount`, nullable `ratingSummary`, viewer-specific `isLiked`, viewer-specific `isSaved`, and viewer-specific `isFollowing`; detail also includes `recentReviews` and nullable `viewerReview`. Unauthenticated reads receive false engagement state and `viewerReview: null`. Flutter `/learning` exposes `page`, `q`, `categoryId`, `difficulty`, and tag chips derived from tags returned in the project list response.

## Database tables

| Table | Role |
|-------|------|
| `learning_projects` | Core project |
| `project_images` | Gallery |
| `project_required_components` | BOM-style components |
| `project_steps` | Instructions |
| `project_links` | External links |
| `project_tags` | Tags on list items |
| `project_likes` | Learner project engagement |
| `project_saves` | Private learner saved project state |
| `project_follows` | Learner project follow state and follower count source |
| `project_user_reviews` | Learner project rating/review state and rating summary source |
| `categories` | Project category (PROJECT or BOTH type) |

## Reusable components

- App-level: `EntryNavBar`
- Learning hub widgets are **feature-specific** — not in `shared/widgets/` (see [reusable-widgets](../frontend/reusable-widgets.md))

## Known gaps / Needs verification

- Project moderation is admin-backed; a separate moderator portal/workspace is still **not implemented**.
- AI material matching — **not implemented**.
- Follow category, stored build progress, automatic material coverage, and in-hub booking from project components — **not implemented**.
