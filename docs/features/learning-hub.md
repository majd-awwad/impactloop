# Learning Hub Feature

**Last updated:** LH-04 core journey closure
**Sources:** `apps/frontend/lib/features/learning_hub/`, `apps/backend/src/modules/learning-projects/`, learner material requests, reservations, supplier material requests

## Purpose

Browse published learning projects, start or continue a persisted build checklist, link platform materials, create material requests, reserve suggested materials, track acquisition readiness, complete build steps, and finish the project build.

## Core learner journey (implemented)

1. **Discover** — `/learning` lists published projects with search, category, difficulty, tag filters, and pagination. Learners can switch Saved/Followed tabs. Learner Home spotlight and continuation cards reuse the same APIs.
2. **Project details** — `/learning/:id` shows components, steps, engagement, reviews, and **Start build** / **Continue checklist**.
3. **Build checklist** — `/learning/:id/build` persists per-learner progress. Each required component exposes canonical acquisition state (Missing, Selected, Reserved, Needs attention, Acquired, Already owned) plus allocation detail (sufficient, insufficient quantity, incompatible unit).
4. **Material selection** — Browse ranked candidates, manually link a material, or create a **Material Request** from the build item.
5. **Supplier suggestion** — Supplier suggests an owned material on the request. Learner sees it on the request detail and can reserve using `materialRequestMatchId`.
6. **Reservation** — Creating a reservation with `buildItemId` links `project_build_items.linked_reservation_id`. Active reservations show Reserved/In progress. Terminal failures clear stale reservation links and release capacity.
7. **Completion** — When reservation is `COMPLETED`, fulfilled material requests sync to the build item. Quantity-safe readiness marks the item ready only when acquired quantity and units are sufficient/compatible.
8. **Acquired access** — Learners can open non-public acquired materials via authenticated `GET /api/materials/:id` (reservation-based fallback).
9. **Remove allocation** — `POST .../remove-acquired-allocation` clears build links without deleting reservation/request history; reconciliation will not re-link dismissed allocations.
10. **Step unlock** — Build steps unlock from the same canonical readiness result as item cards and progress.
11. **Build completion** — Completing all required steps sets `ProjectBuild.status = COMPLETED`. Completed builds are excluded from Learner Home **Continue project** (`status = IN_PROGRESS` only).

## Build item states

| State | Meaning |
|-------|---------|
| Missing | No linked material and no acquisition source |
| Selected | Material linked but not yet acquired |
| Reserved | Active linked reservation in progress |
| Needs attention | Linked reservation requires resolution |
| Acquired | Completed reservation exists |
| Already owned | Manual learner-owned status (separate from Acquired) |

Readiness requires `acquisitionState = acquired`, `allocationResult = sufficient`, compatible units, and no allocation conflict. Partial or incompatible acquisitions remain visible but not ready.

## Automatic refresh

- Flutter polls the current build only while pending acquisition states exist (`projectBuildRefreshInterval`, 10s).
- Polling stops when no item needs active refresh.
- Build fetch runs bounded material-request reconciliation (max 20 fulfilled requests per build) and terminal reservation repair; already-synced reads do not write.

## API endpoints (core journey)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/learning-projects` | Public browse |
| GET | `/api/learning-projects/:id` | Public detail |
| POST | `/api/learning-projects/:id/builds/start` | Start/continue build |
| GET | `/api/learning-projects/:id/builds/me` | Build checklist + reconciliation on read |
| GET | `.../material-candidates` | Ranked candidates (max 10) |
| POST | `.../link-material` | Manual link |
| DELETE | `.../link-material` | Unlink selected material |
| POST | `.../remove-acquired-allocation` | Remove completed allocation from component |
| POST | `.../link-reservation` | Repair link for existing reservation |
| POST | `.../steps/:stepId/complete` | Complete build step |
| POST | `/api/learner/material-requests` | Create request (optional build linkage) |
| POST | `/api/supplier/material-requests/:id/suggest` | Supplier suggestion |
| POST | `/api/reservations` | Create reservation (`buildItemId`, `materialRequestMatchId`) |
| GET | `/api/materials/:id` | Public detail; optional auth enables acquired fallback |

## Verification commands

### Backend (targeted)

```bash
node --import tsx --test \
  src/modules/learning-projects/learning-projects.core-journey.test.ts \
  src/modules/learning-projects/learning-projects.build-material-request-sync.test.ts \
  src/modules/learning-projects/learning-projects.build-material-allocation.test.ts \
  src/modules/learning-projects/learning-projects.build-item-state.test.ts \
  src/modules/learning-projects/learning-projects.build-steps.test.ts \
  src/modules/learning-projects/learning-projects.build-acquired-removal.test.ts \
  src/modules/learning-projects/learning-projects.build-reservation-sync.test.ts \
  src/modules/materials/materials.acquired-access.http.test.ts \
  src/modules/materials/materials.acquired-access.test.ts \
  src/modules/supplier-material-requests/supplier-material-requests.test.ts
```

### Flutter (targeted)

```bash
flutter test \
  test/learning_hub_api_mapper_test.dart \
  test/project_build_item_display_test.dart \
  test/project_build_acquisition_state_test.dart \
  test/project_build_linked_material_panel_test.dart \
  test/project_build_refresh_test.dart \
  test/project_build_route_refresh_test.dart \
  test/learner_material_requests_test.dart \
  test/notification_display_test.dart \
  test/learner_notifications_navigation_test.dart
```

## Manual smoke-test runbook

1. Log in as learner → open **Learning Hub** → browse/search/filter projects.
2. Open a project → **Start build**.
3. On a missing component → **Request material** → submit request.
4. As supplier → suggest a matching owned material.
5. As learner → open request notification/detail → **View material** → create reservation.
6. Confirm build item shows **Reserved**; wait or complete reservation as supplier/driver.
7. Confirm item becomes **Acquired** and ready only when quantity/units match.
8. Complete unlocked build steps → build status **Completed**.
9. Open acquired non-public material from reservation history (authenticated).
10. **Remove from this component** → item returns to Missing; reservation history still works.
11. Guest/unrelated learner still gets 404 on acquired non-public material.

## Known intentional limitations

- No completed-build portfolio or history list yet
- No multiple build attempts per project yet
- No learner Material → Related Projects discovery yet
- No browse readiness filter/sorting on project cards yet
- No E-learning layer, checkpoints, or outcomes yet
- No general unit-conversion engine (compatibility is exact/normalized string match)
- Already-owned quantity remains boolean/manual, not quantity-evaluated
- No automatic AI material matching

## Frontend files

| Area | Path |
|------|------|
| Repository | `domain/learning_project_repository.dart`, `data/api_learning_hub_repository.dart` |
| Providers | `application/learning_hub_providers.dart`, `project_build_refresh.dart` |
| State display | `presentation/widgets/project_build_acquisition_state.dart`, `project_build_item_display.dart` |
| Pages | `learning_hub_page.dart`, `learning_project_details_page.dart`, `learning_project_build_page.dart` |
| L10n | `presentation/l10n/learning_project_build_l10n.dart` |

## Backend files

| Area | Path |
|------|------|
| Learning projects | `modules/learning-projects/` |
| Build item state | `learning-projects.build-item-state.ts` |
| Quantity allocation | `learning-projects.build-material-allocation.ts` |
| MR sync | `learning-projects.build-material-request-sync.ts` |
| Reservation sync | `learning-projects.build-reservation-sync.ts` |
| Acquired access | `modules/materials/materials.acquired-access.ts` |
| Continuation | `project-build-continuation.ts` |
