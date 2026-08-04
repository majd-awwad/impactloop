# Learning Hub Feature

**Last updated:** LH-10–13 build lifecycle, portfolio, completion story
**Sources:** `apps/frontend/lib/features/learning_hub/`, `apps/frontend/lib/features/learner_builds/`, `apps/backend/src/modules/learning-projects/`, `apps/backend/src/modules/learner-builds/`, learner material requests, reservations

## Purpose

Browse published learning projects, start or continue a persisted build checklist, link platform materials, create material requests, reserve suggested materials, track acquisition readiness, complete build steps, pause/resume/archive builds, add an optional completion story, and review completed work in a private portfolio.

## Build lifecycle (LH-10–13)

| Status | Meaning |
|--------|---------|
| `IN_PROGRESS` | Active build; polling and mutations allowed |
| `PAUSED` | Learner paused; progress preserved; **reservation deadlines continue**; no build polling while inactive |
| `COMPLETED` | All required steps done; core build data read-only; completion story editable |
| `ARCHIVED` | Learner stopped an unfinished build; read-only history preserved |

### Pause / resume

- Pause allowed only from `IN_PROGRESS` (idempotent if already paused).
- Resume allowed only from `PAUSED` (idempotent if already in progress).
- Pausing does **not** cancel reservations, unlink materials, or reset steps.

### Archive blockers

Archive is rejected (`BUILD_ARCHIVE_BLOCKED`) when linked workflows remain open:

- Active reservations (`PENDING`, `ACCEPTED`, etc.)
- `AWAITING_RESOLUTION`
- Open build-linked material requests (`status = OPEN`)

Terminal reservations and fulfilled requests do not block archival.

### Multiple attempts

- At most one `IN_PROGRESS` or `PAUSED` build per learner + project.
- `POST .../builds/start` returns the active attempt (including paused).
- `POST .../builds/again` starts a new attempt after `COMPLETED` or `ARCHIVED`.
- `attemptNumber` is stable per learner/project.

### Completion story (optional)

- Reflection (max 3000 chars), caption (max 120), up to 6 photos (JPG/PNG/WebP).
- Editable after completion; does not change build readiness or completion date.
- Photos stored under `/uploads/build-completion/` (local dev).

### Impact summary

Snapshot at completion uses persisted data only:

- Required/ready component counts, already-owned count, acquired-via-ImpactLoop count, step counts, elapsed calendar time.
- No CO₂, weight, or money estimates.

### My Builds & Portfolio

| Route | Purpose |
|-------|---------|
| `/learner/builds` | Tabs: Active, Paused, Completed, Archived |
| `/learner/portfolio` | Completed builds as achievements (private) |

Public portfolio sharing is **not** implemented.

## Core learner journey (LH-01–09 preserved)

1. **Discover** — `/learning` with filters, coverage, sort (LH-07–09).
2. **Project details** — Start / Continue / Resume / View completed / Build again.
3. **Build checklist** — acquisition states, material linking, requests, reservations.
4. **Step unlock** — canonical readiness rules unchanged.
5. **Build completion** — all required steps → `COMPLETED` + snapshot.
6. **Learner Home** — continues `IN_PROGRESS` and `PAUSED` only (not completed/archived).

## API endpoints

### Learning projects (existing + new)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/learning-projects/:id/builds/start` | Start or return active attempt |
| POST | `/api/learning-projects/:id/builds/again` | New attempt after completed/archived |
| GET | `/api/learning-projects/:id/builds/me?buildId=` | Build detail (optional historical attempt) |
| POST | `.../steps/:stepId/complete` | Complete step; creates snapshot when finished |

### Learner builds (LH-10–13)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/learner/builds` | Paginated list (`status=ACTIVE\|IN_PROGRESS\|PAUSED\|COMPLETED\|ARCHIVED`) |
| GET | `/api/learner/portfolio` | Completed builds only |
| GET | `/api/learner/builds/:buildId` | Owner-scoped detail |
| POST | `/api/learner/builds/:buildId/pause` | Pause build |
| POST | `/api/learner/builds/:buildId/resume` | Resume build |
| POST | `/api/learner/builds/:buildId/archive` | Archive with blocker checks |
| PATCH | `/api/learner/builds/:buildId/completion-story` | Update reflection/caption |
| POST | `/api/learner/builds/:buildId/completion-story/photos` | Upload photo |
| DELETE | `/api/learner/builds/:buildId/completion-story/photos/:photoId` | Remove photo |

## Migration

`20260804180000_project_build_lifecycle`:

- Adds `PAUSED`, `attemptNumber`, `pausedAt`, `archivedAt`
- Replaces single-build unique with `(projectId, learnerId, attemptNumber)`
- Partial unique index: one active build per learner/project
- Completion story, photos, snapshot tables

## Verification commands

### Backend (focused)

```bash
cd apps/backend
npx prisma format && npx prisma validate && npx prisma migrate deploy && npx prisma generate

node --import tsx --test \
  src/modules/learning-projects/project-build-lifecycle.test.ts \
  src/modules/learning-projects/project-build-continuation.test.ts \
  src/modules/learning-projects/learning-projects.build-steps.test.ts \
  src/modules/learning-projects/learning-projects.build-material-request-sync.test.ts \
  src/modules/learning-projects/learning-projects.build-material-allocation.test.ts \
  src/modules/learning-projects/learning-projects.build-item-state.test.ts \
  src/modules/learning-projects/learning-projects.build-acquired-removal.test.ts \
  src/modules/learning-projects/learning-projects.build-reservation-sync.test.ts \
  src/modules/learning-projects/learning-projects.material-coverage.test.ts \
  src/modules/learning-projects/learning-projects.browse-coverage.test.ts \
  src/modules/materials/materials.acquired-access.test.ts \
  src/modules/learner-material-requests/learner-material-requests.test.ts
```

### Flutter (focused)

```bash
cd apps/frontend
flutter test \
  test/learner_builds_lifecycle_test.dart \
  test/learner_portfolio_test.dart \
  test/project_build_actions_panel_test.dart \
  test/project_build_refresh_test.dart \
  test/learning_hub_api_mapper_test.dart \
  test/learning_project_card_layout_test.dart \
  test/learner_material_requests_test.dart
```

## Manual smoke-test matrix

| Scenario | Verify |
|----------|--------|
| Active build, no reservations | Pause preserves progress |
| Active build + active reservation | Pause; reservation still active |
| Paused build | Resume restores `IN_PROGRESS`; appears as Resume on Home |
| Archive with blockers | Actionable error; succeeds after resolve |
| Completed build | Read-only; hidden from Continue; portfolio entry |
| Archived build | Read-only; Build again creates new attempt |
| Completion story | Skip, add later, photos persist |
| Arabic / RTL | Tabs, dialogs, cards |

## Intentional limitations

- No public portfolio sharing, certificates, or social reactions
- No environmental CO₂ / diversion estimates
- No E-learning layer, checkpoints, or outcomes
- No automatic AI material matching
- Pausing does not pause reservation deadlines
- No duplicate active build attempts per project

## Frontend files

| Area | Path |
|------|------|
| Learning hub | `features/learning_hub/` |
| My Builds / Portfolio | `features/learner_builds/` |
| Build lifecycle UI | `learning_project_build_page.dart`, `project_build_completion_story_section.dart` |
| Profile quick actions | `learner_profile_dashboard_widgets.dart` |

## Backend files

| Area | Path |
|------|------|
| Lifecycle | `project-build-lifecycle.ts`, `project-build-completion-snapshot.ts`, `project-build-completion-story.ts` |
| Learner builds API | `modules/learner-builds/` |
| Continuation | `project-build-continuation.ts` |
| Migration | `prisma/migrations/20260804180000_project_build_lifecycle/` |
