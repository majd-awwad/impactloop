# Learning Hub Feature

**Last updated:** LH-20 learning quality metrics, audit, and final closure
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
- No learner-facing My Builds / Portfolio / Admin learning integration yet (LH-19+)
- No automatic AI material matching
- Pausing does not pause reservation deadlines
- No duplicate active build attempts per project

## Learning Pack foundation (LH-14)

Internal-only reusable quiz storage:

| Model | Purpose |
|-------|---------|
| `ProjectLearningPack` | Versioned pack per project content hash |
| `ProjectLearningQuestion` | Bilingual START / STEP / FINAL questions |
| `ProjectLearningQuestionOption` | Graded options with stable keys |
| `ProjectBuildLearningSession` | 1:1 with a Build; pins `packId` |
| `ProjectBuildLearningQuestionAssignment` | Per-attempt question selection |
| `ProjectBuildLearningAnswerAttempt` | Graded answer history |

Pack lifecycle: `GENERATING` → `READY` | `FAILED`; historical packs may become `STALE`.

Migration: `20260805120000_project_learning_foundation`

No public Quiz HTTP routes. Correct-answer metadata is never exposed in learner DTOs.

## Shared AI Learning Pack generation (LH-15)

Internal service: `ensureReadyLearningPackForProject(projectId)` in `project-learning-pack-ensure.service.ts`.

### Canonical learning snapshot

Built by `buildProjectLearningCanonicalSnapshot()` from a published project with steps and components.

**Included in hash payload** (`buildProjectLearningHashPayload`):

- `hashSchemaVersion` (currently `1`)
- `title`, `shortDescription`, `description`
- `difficulty`, `estimatedDurationMinutes`
- Required components (stable `createdAt` order): name, material type, quantity, unit, role, required/substitution flags, notes, keyword alternatives when present
- Steps (stable `stepNumber` order): `stepNumber`, `title`, `description`

**Excluded from hash** (not in snapshot payload):

- Project ID, category, author, status timestamps
- Likes, saves, follows, views, comments, reviews
- Reservations, material availability, prices, locations
- Learner identity, builds, sessions, AI chat history
- Cover images, links, tags, taxonomy concept IDs

Text is trimmed, whitespace-normalized, and stripped of unsafe markup before hashing.

### Content hash

Format: `sha256:<64 lowercase hex>` via `stableContentHash` / `computeProjectLearningContentHash`.

Unique per `(projectId, contentHash)`. Unchanged learning content → same hash; step/component edits → new hash → new pack version.

### AI generation

- One bilingual structured provider call per new pack (Arabic + English together).
- Separate from learner AI chat; reuses provider configuration patterns only.
- Injectable `ProjectLearningPackGeneratorProvider` (`generateProjectLearningPack`).
- Tests use `MockProjectLearningPackGeneratorProvider` only — no real API keys.

**Pack size rules:**

| Stage | Count |
|-------|-------|
| START | 2–3 |
| STEP | 1–2 per project step |
| FINAL | 3–5 |

Supported types: `MULTIPLE_CHOICE`, `TRUE_FALSE`, `BEST_ACTION` — exactly one correct option each.

### Validation

Strict Zod schema + semantic checks in `project-learning-pack-validation.ts` (stage/step binding, option uniqueness, bounded text, no HTML/scripts, concept key format).

### Persistence and concurrency

1. Resolve snapshot + hash.
2. Reuse `READY` pack (zero AI calls).
3. Return `GENERATING` if another worker is generating (zero AI calls).
4. Return `FAILED` on ordinary ensure (explicit bounded retry only).
5. Winner/loser via unique `(projectId, contentHash)` — at most one provider call.
6. Transactional question/option insert; validation failure leaves no partial READY pack.
7. Unreferenced older `READY` packs marked `STALE` when a new `READY` pack publishes.

### Failure and retry

- `MAX_LEARNING_PACK_GENERATION_ATTEMPTS = 3`
- `retryFailedLearningPackGeneration(projectId, packId)` — explicit internal retry only
- Sanitized `failureReason` and `lastGenerationErrorCode`; no secrets stored

### LH-16 integration contract

`EnsureLearningPackResult`:

| Status | Fields |
|--------|--------|
| `READY` | `packId`, `projectId`, `versionNumber`, `contentHash`, `questionCounts` |
| `GENERATING` | `packId`, `retryAfterSeconds` |
| `FAILED` | `packId`, `errorCode`, `retryEligible` |
| `INELIGIBLE` | `reasonCode` |

Questions are not returned through ensure. LH-16 attaches a `READY` pack when starting a Build learning session.

## Build learning session and Start Check (LH-16)

When a learner starts a build:

1. Build creation commits independently of AI pack generation.
2. `learningSetup` metadata is returned on build responses (`READY` / `PREPARING` / `UNAVAILABLE` / `NOT_REQUESTED`).
3. `setupLearningSessionForBuild` creates one session per build (idempotent, concurrency-safe).
4. Deterministic assignments pin START / STEP / FINAL questions from the READY pack.
5. Learner may set optional `learningGoal` and `confidenceBefore` (1–5).
6. Start Knowledge Check UI is optional and never blocks the build checklist.

### Learner HTTP routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/learning-projects/:id/builds/me/learning-session` | Session + setup status |
| POST | `/api/learning-projects/:id/builds/me/learning-session/setup` | Create session + assignments |
| PATCH | `/api/learning-projects/:id/builds/me/learning-session` | Update goal / confidence |
| POST | `.../assignments/:assignmentId/answer` | Submit graded attempt |
| POST | `.../assignments/:assignmentId/skip` | Skip assignment |
| POST | `.../assignments/:assignmentId/hint` | Mark hint viewed |

## Step learning checkpoints (LH-17)

After a learner completes a Project Step:

1. Step completion commits first and is never rolled back by checkpoint failures.
2. The optional Step Knowledge Check reuses the persisted STEP assignment from LH-16.
3. No new Pack generation or Question selection occurs during checkpoints.
4. Hint, Answer, Retry, and Skip are available while the build is `IN_PROGRESS` or `PAUSED`.
5. Completed or archived builds expose read-only checkpoint review only.
6. **Ask AI to explain** opens the existing build-guide chat with bounded handoff context; zero provider calls until the learner sends a message.

### Learner HTTP routes (STEP checkpoints)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/learning-projects/:id/builds/me/learning-session/steps/:stepId/check` | Load STEP checkpoint |
| POST | `.../steps/:stepId/check/hint` | View hint |
| POST | `.../steps/:stepId/check/answer` | Submit graded attempt |
| POST | `.../steps/:stepId/check/skip` | Skip checkpoint |
| GET | `.../steps/:stepId/check/ai-handoff` | Prepare AI explanation handoff |

## Final learning check, summary, and reflection (LH-18)

After all required Project Steps are complete:

1. Optional Final Check reuses persisted FINAL assignments from LH-16.
2. Build completion is never blocked by unanswered, skipped, or incorrect Final Questions.
3. Completing the last Step still auto-completes the Build; a non-blocking dialog may offer Review final check or Complete anyway.
4. Deterministic Learning Summary is computed from persisted answers only — no AI.
5. After COMPLETED, learners may set `goalOutcome`, `confidenceAfter`, and `finalReflection`.
6. ARCHIVED builds are read-only for Final Check and reflection.
7. Build again creates a new Session with no copied answers/reflection/summary.

### Final Check APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/learning-projects/:id/builds/me/learning-session/final-check` | Load FINAL check + progress + summary |
| POST | `.../final-check/assignments/:assignmentId/hint` | View hint |
| POST | `.../final-check/assignments/:assignmentId/answer` | Submit graded attempt |
| POST | `.../final-check/assignments/:assignmentId/skip` | Skip assignment |
| GET | `.../final-check/assignments/:assignmentId/ai-handoff` | Prepare AI explanation handoff |
| PATCH | `.../completion-reflection` | Save goal outcome / confidenceAfter / reflection |

Migration: `20260805160000_project_learning_goal_outcome` adds nullable `goal_outcome`.

## Learning progress in My Builds, Portfolio, and Admin (LH-19)

LH-19 exposes **bounded** persisted learning progress without recreating quizzes.

### My Builds (`GET /api/learner/builds`)

Additive `learning` object per card (counts/flags only):

- `status`: `NOT_AVAILABLE` | `NOT_STARTED` | `IN_PROGRESS` | `REVIEW_RECOMMENDED` | `COMPLETED`
- check handled/total for start/step/final
- `understoodConceptCount` / `reviewConceptCount`
- `goalOutcome`, `hasLearningGoal`, `hasReflection`

Loaded via one narrow `learningSession` include on the list query (no N+1 session fetches; no AI; no writes).

Flutter cards show **one** compact learning line; lifecycle CTA remains primary.

### Private Portfolio (`GET /api/learner/portfolio`)

Optional `learning` story only when meaningful fields exist (goal, outcome, confidence, reflection, concepts). Separate from My Builds compact DTO. Attempts stay isolated. Portfolio remains private (owner LEARNER only).

### Admin read-only (Admin People)

Chosen surface: **Admin People** user detail.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/people/:id/builds` | Bounded build list with learning flags |
| GET | `/api/admin/people/:id/builds/:buildId/learning` | Read-only learning inspection |

No PATCH/POST/DELETE for learning mutations. Admin UI section **Learning activity** has View only (no Edit/Grade/Approve).

## Question quality metrics and unclear feedback (LH-20)

### Metrics strategy

**Option A — query-derived aggregates** over Assignments, Answer Attempts, and Feedback.

Chosen because:

- sample sizes remain bounded per Question;
- selection only fetches metrics when a Step has multiple candidates;
- avoids unsafe concurrent counters;
- source of truth remains Assignment/Attempt rows.

No custom model training. Learner Answers are never reused as shared Pack content.

### Classification thresholds

- `assignmentCount < 10` → `INSUFFICIENT_DATA`
- `unclearReportRate >= 0.25` or `skipRate >= 0.60` or (`eventualCorrectRate <= 0.20` with `handledCount >= 10`) → `NEEDS_REVIEW`
- multiple severe signals or `unclearReportRate >= 0.40` → `DEPRIORITIZED`
- otherwise → `HEALTHY`

Difficulty alone (high hint + eventual correct after retry) stays `HEALTHY`.

### Quality-aware selection

New Sessions only. Prefer HEALTHY → INSUFFICIENT_DATA → NEEDS_REVIEW → DEPRIORITIZED for STEP candidates, then deterministic Build-specific hash within the best class. Existing Sessions are never reassigned. START/FINAL counts remain complete.

### Unclear report APIs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `.../assignments/:assignmentId/report-unclear` | Idempotent unclear report |
| DELETE | `.../assignments/:assignmentId/report-unclear` | Clear report |

Migration: `20260805180000_project_learning_question_quality` adds feedback table + `ai_explanation_requested_at`.

### Local deterministic Pack generation (development only)

When Gemini is unavailable or returns invalid Pack JSON locally, Learning setup can become `UNAVAILABLE` (Build stays usable).

Enable an explicit non-production generator:

```bash
# apps/backend/.env — never enable this in production
PROJECT_LEARNING_GENERATOR_MODE=local_deterministic
```

Behavior:

- uses `LocalDeterministicProjectLearningPackGeneratorProvider` (`providerName: local-deterministic`, `modelName: local-template-v1`);
- no network calls and no Gemini key required;
- same Zod + semantic Pack validation as Gemini;
- same ensure / concurrency / content-hash / versioning path;
- ordinary `ensureReadyLearningPackForProject` still does **not** auto-retry `FAILED` Packs;
- learner **Retry learning setup** / session setup may explicitly retry eligible `FAILED` Packs; in local deterministic mode the attempt budget may be reset for unpinned Packs;
- production ignores `local_deterministic` and never silently falls back to it.

Verify READY reuse: second learner on the same Project content hash must receive the same Pack with zero additional generation calls.

### Local-only Session reset (development)

**LOCAL DEVELOPMENT ONLY — DO NOT RUN IN PRODUCTION**

Use this when a local Build Session was generated with an old low-quality Pack (for example Simple LED Circuit) and you need a fresh Session after generator fixes. Normal Sessions remain immutable in application code; this is a manual DBA procedure for local dev only.

**Verified FK behavior (Prisma schema):**

| Parent deleted | Child | `onDelete` |
|--------------|-------|------------|
| `project_build_learning_sessions` | assignments | `Cascade` |
| assignments | answer attempts, feedback | `Cascade` |
| `project_learning_packs` | questions | `Cascade` |
| questions | options | `Cascade` |
| `project_learning_packs` | sessions referencing pack | `Restrict` (blocks pack delete) |
| `project_builds` | learning session | `Cascade` (do **not** delete builds here) |

**Safe strategy:**

1. Delete **only** the target Build’s learning Session row.
2. Session delete cascades to that Build’s assignments, attempts, and feedback only.
3. Count remaining Sessions for the Pack.
4. Delete the Pack **only** when the count is zero — Pack delete cascades to questions and options.
5. Never delete questions or options directly while any Session still references the Pack.
6. Never delete `project_builds` or `learning_projects`.
7. Wrap in a transaction; roll back on any failure.

Replace `TARGET_BUILD_ID` with your local Build id (example Simple LED Circuit: `cmsf3i6e3000d44vg7ybqfp0s`).

```sql
-- LOCAL DEVELOPMENT ONLY — DO NOT RUN IN PRODUCTION
BEGIN;

DO $$
DECLARE
  target_build_id TEXT := 'TARGET_BUILD_ID';
  target_pack_id TEXT;
  remaining_sessions INT;
BEGIN
  SELECT pack_id INTO target_pack_id
  FROM project_build_learning_sessions
  WHERE build_id = target_build_id;

  IF target_pack_id IS NULL THEN
    RAISE NOTICE 'No learning session for build %', target_build_id;
  ELSE
    -- Step 1–2: remove only this Build's Session (cascades assignments/attempts/feedback).
    DELETE FROM project_build_learning_sessions
    WHERE build_id = target_build_id;

    IF NOT EXISTS (SELECT 1 FROM project_builds WHERE id = target_build_id) THEN
      RAISE EXCEPTION 'Build % was removed unexpectedly', target_build_id;
    END IF;

    -- Step 3–4: delete Pack only when no Session references it (cascades questions/options).
    SELECT COUNT(*) INTO remaining_sessions
    FROM project_build_learning_sessions
    WHERE pack_id = target_pack_id;

    IF remaining_sessions = 0 THEN
      DELETE FROM project_learning_packs
      WHERE id = target_pack_id;
      RAISE NOTICE 'Deleted unreferenced pack %', target_pack_id;
    ELSE
      RAISE NOTICE 'Pack % kept (% other session(s) still reference it)', target_pack_id, remaining_sessions;
    END IF;
  END IF;
END $$;

COMMIT;
```

Regenerate via the existing setup endpoint (authenticated learner):

`POST /api/learning-projects/{projectId}/builds/me/learning-session/setup`

with `PROJECT_LEARNING_GENERATOR_MODE=local_deterministic` and `NODE_ENV=development`.

### Intentional limitations

- no formal grading / pass-fail / certificates / badges / leaderboards;
- no public Portfolio;
- no AI grading or AI-written reflection;
- no automatic Pack regeneration from metrics;
- no custom model training;
- no Admin question authoring in this phase;
- `STALE` Pack status remains content-hash only.

### Verification commands (LH-14 through LH-20)

```bash
cd apps/backend
npx prisma format && npx prisma validate && npx prisma migrate deploy && npx prisma generate

node --import tsx --test \
  src/modules/project-learning/project-learning-foundation.test.ts \
  src/modules/project-learning/project-learning-pack-snapshot.test.ts \
  src/modules/project-learning/project-learning-pack-ensure.test.ts \
  src/modules/project-learning/project-learning-session-lh16.test.ts \
  src/modules/project-learning/project-learning-session-lh17.test.ts \
  src/modules/project-learning/project-learning-session-lh18.test.ts \
  src/modules/project-learning/project-learning-question-quality.test.ts \
  src/modules/learner-builds/learner-builds-learning-lh19.test.ts \
  src/modules/learning-projects/project-build-lifecycle.test.ts
```

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
| Learning packs (LH-14–20) | `modules/project-learning/` |
| Question quality | `project-learning-question-quality.service.ts`, `project-learning-question-feedback.service.ts` |
| Final check / summary / reflection (LH-18) | `final-learning-check.service.ts`, `project-learning-summary.service.ts`, `learning-completion-reflection.service.ts` |
| Migration | `prisma/migrations/20260804180000_project_build_lifecycle/`, `20260805120000_project_learning_foundation/`, `20260805140000_project_learning_pack_generation_metadata/`, `20260805160000_project_learning_goal_outcome/`, `20260805180000_project_learning_question_quality/` |
