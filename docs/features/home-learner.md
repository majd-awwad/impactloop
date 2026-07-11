# Home (Learner) Feature

**Sources inspected:** `apps/frontend/lib/features/home/`, `apps/backend/src/modules/learner-home/`, `app_router.dart`, `docs/08-implementation-status.md`, `docs/features/material-discovery.md`, `docs/features/learning-hub.md`

## Purpose

Authenticated **learner dashboard** at `/home`: welcome hero, quick actions, and a **personalized recommendation feed** from `GET /api/learner/home`.

Requires login (router guard).

Role-scope framing: see [roles-and-capabilities](roles-and-capabilities.md).

## Current status

| Section | Status | Data source |
|---------|--------|-------------|
| Route `/home` | **Implemented** | `HomePage` → `LearnerHomePage` |
| Welcome hero + greeting | **Implemented** | **API-backed** — `authControllerProvider` user `displayName` |
| Quick actions | **Implemented** | Materials, My Reservations, Learning Hub, and **Become a supplier** use live routes/APIs |
| Personalized feed | **Implemented (first slice)** | **API-backed** — `GET /api/learner/home` via `learnerHomeFeedProvider`; vertical material grid + learning spotlight card styles |
| Suggested materials | **Implemented** | Section `suggested_materials` from learner home feed |
| Materials for saved projects | **Implemented** | Section `materials_for_saved_projects` |
| Suggested projects | **Implemented** | Section `suggested_projects` |
| Continue projects | **Implemented** | Section `continue_projects` (in-progress `ProjectBuild`) |
| Saved projects | **Implemented** | Section `saved_projects` |
| Free materials near you | **Implemented** | Section `free_materials_near_you` |
| Popular projects | **Implemented** | Section `popular_projects` (fallback / general discovery) |
| Profile completion hints | **Implemented** | `profileCompletion.hasInterests` drives interests prompt banner |
| Coming later (impact + AI) | **Frontend-only** | Empty / Coming Soon placeholders — no learner-facing APIs |

**Not documented as implemented:** learner reservation cancel, AI agent, learner impact analytics, neural/vector recommendations.

## Main user flow

1. Learner logs in → redirect `/home` (role-dependent routing in `app_router.dart`).
2. Page loads personalized feed from `GET /api/learner/home`.
3. Each recommended material/project card shows the first recommendation reason as a subtitle when available.
4. User taps **Browse Materials** → `/materials` (live API discovery).
5. User taps **Explore Learning Hub** → `/learning` (API-backed catalog).
6. User taps **My Reservations** (Quick actions) → `/learner/reservations`.
7. User taps **Become a supplier** → `supplierEntryRouteForUser(user)`.
8. Continue-project cards navigate to `/learning/:id/build`.
9. Disabled / Coming Soon cards show info snackbars for impact and AI helper.

## Frontend files

| Area | Path |
|------|------|
| Entry | `presentation/pages/home_page.dart` (wraps `LearnerHomePage`) |
| Page | `presentation/pages/learner_home_page.dart` |
| Providers | `application/learner_home_provider.dart` |
| Data | `data/learner_home_api.dart`, `data/learner_home_item_mapper.dart` |
| Models | `domain/learner_home_models.dart` |
| Browse page | `presentation/pages/learner_home_recommendations_page.dart` |
| Widgets | `presentation/widgets/learner_home_feed_sections.dart`, `home_material_recommendation_grid.dart`, `home_continue_project_card.dart`, `learning_spotlight_section.dart` (`HomeLearningProjectCard`), `home_action_card.dart`, `coming_soon_card.dart`, `empty_activity_card.dart`, `home_section_header.dart` |
| Legacy (unused on home) | `application/home_suggested_materials_provider.dart`, `suggested_materials_section.dart`, `learning_spotlight_section.dart` |
| Shared nav helper | `auth/application/auth_navigation.dart` |
| Router | `app/router/app_router.dart` — `/home`, `/learner/reservations` |

## Backend files

| Area | Path |
|------|------|
| Routes | `modules/learner-home/learner-home.routes.ts` |
| Service | `modules/learner-home/learner-home.service.ts` |
| Scoring | `modules/learner-home/learner-home.scoring.ts` |
| Affinity / behavior | `modules/learner-home/learner-home.affinity.ts` |
| Repository | `modules/learner-home/learner-home.repository.ts` |
| Tests | `modules/learner-home/learner-home.scoring.test.ts` |

## API endpoints

| Method | Path | Section |
|--------|------|---------|
| GET | `/api/learner/home` | Full personalized learner home feed (**Implemented**) |
| GET | `/api/learner/home/sections/:sectionKey` | Ranked Browse-all section feed (**Implemented**) |
| POST | `/api/reservations` | **Implemented MVP** — used from material detail, not home |
| GET | `/api/reservations/my` | My Reservations (**Implemented MVP**) — home links only |
| POST | `/api/auth/become-supplier` | Become a supplier CTA for learner-only accounts |
| POST | `/api/auth/switch-role` | Dual-role portal switch |

## Ranking (first slice)

Deterministic weighted scoring — no AI, vectors, or new preference tables.

**Interest normalization:** `LearnerProfile.interests` stores stable taxonomy keys (e.g. `arduino`, `audio_media`, `fabric_textiles`). Legacy display labels are mapped on read via `learner-interest-taxonomy.ts`. Controlled options are exposed at `GET /api/profile/learner/interests/options` (public read-only).

**Taxonomy-aware matching:** Narrow interests require keyword/tag matches in title, description, material type, or tags — not category alone. General `electronics` may also match category with a weaker “Related to your … interest” reason. `audio_media` does not match generic Electronics items such as jumper wires/resistors unless audio/media keywords are present.

**Tiered suggested-material ranking:** Suggested materials and Browse All use tier-first ordering: (1) strong interest match, (2) behavior/activity match, (3) saved project component, (4) weak/custom interest, (5) starter fallback. `materials_for_saved_projects` uses saved-component tiers first. `free_materials_near_you` uses free+near, then free+interest/activity, then free fallback. Free/delivery/location bonuses never outrank direct matches in suggested materials. Home preview prefers interest/activity matches before saved-project-only items.

**Behavior-aware affinity (Phase 3):** Existing engagement tables feed a bounded behavior context (liked/viewed/reserved materials; saved/liked/followed projects; in-progress builds). `buildBehaviorAffinityProfile()` uses **behavior rows only** (no explicit interests). `buildLearnerAffinityProfile()` merges interests for legacy/internal use, but scoring/reasons use the behavior-only profile so explicit interests never produce “recent activity” reasons. Material likes are a **strong** signal (+0.55 affinity weight, +0.2 extra per liked tag) and drive `scoreMaterialSimilarityToLikedMaterials()` — recommending **similar unliked** materials via shared tags/taxonomy/category (not description bleed). Liked items receive an already-liked penalty in `suggested_materials` so Nano/Breadboard/Jumper/Sensors rank above repeating the exact liked board. Similarity reasons are specific (“Similar to your liked Arduino materials”, “Similar to materials you liked”) and only appear for real overlap. Material views are recorded only on material detail (`source: material_detail`) and stay weak (+0.08, capped at 3 views/material). Other behavior reasons: “Similar to materials you reserved”, “Related to your saved projects”, etc. “Matches your recent activity” appears only for intentional detail views when no stronger behavior reason applies.

**Suggested materials relevance gate:** When the learner has interests, saved-project components, or meaningful **behavior** affinity (not explicit interests alone), only materials with a **strong** signal (interest match, saved-component match, or behavior affinity match) enter `suggested_materials`. Weak signals (free, delivery, recency, popularity, location alone) boost already-relevant items but cannot promote unrelated items. The section may show fewer than 4 cards rather than force-fill with irrelevant items.

**Materials:** interest match (+40), saved-project component match (+45), saved location (+25), free (+8), delivery allowed (+6), popularity up to (+10), recency up to (+5); unavailable materials heavily penalized.

**Free materials sections:** free (+16 base in `free_materials_near_you`), location (+25 when near saved location), popularity/recency as tie-breakers. Free-only unrelated items belong here, not in `suggested_materials`.

**Projects:** interest match (+40), matching available materials (+20), popularity up to (+15), recency up to (+5).

**Display dedupe:** Home preview and section pages suppress near-duplicate material titles (normalized lowercase, punctuation stripped, safe plural trim) in addition to ID dedupe.

**Section subtitles (`suggested_materials` / `suggested_projects`):** Interests only → “Personalized from your interests and saved projects.” Interests + activity → “…and activity.” Activity only (no interests) → “Personalized from your recent activity.” Neither → starter suggestions copy.

**Profile completion:** `profileCompletion.hasActivity` is true only when user-specific behavior rows exist (likes, detail views, reservations, saves, follows, in-progress builds) — explicit interests alone do not count.

**Fallbacks:** learners without interests still receive popular projects, free materials, and recent available materials; sections include `emptyState` copy for profile prompts. Material sections dedupe across `materials_for_saved_projects` → `suggested_materials` → `free_materials_near_you` (fallback duplicates only when alternatives are exhausted). Saved projects are excluded from `suggested_projects` when enough unsaved alternatives exist.

**Browse all:** Home section headers link to `/home/recommendations/:sectionKey`, which loads `GET /api/learner/home/sections/:sectionKey?limit=10|20|30|40|50&offset=0|20|…`. Response includes `nextOffset` and `hasMore` for Load More. Browse All sorts all tiers (most useful → least useful); home preview still trims to up to 4 interest/activity matches when available. Suggested materials Browse All includes a “Show up to N recommendations” control (10–50, default 20) beside the section header.

## Database tables

Read-only use of existing tables: `learner_profiles`, `materials`, `material_tags`, `material_likes`, `material_views`, `reservations`, `learning_projects`, `project_tags`, `project_saves`, `project_likes`, `project_follows`, `project_builds`, `project_build_items`, `user_saved_locations`, material/project engagement counts. No migration required for this slice.
