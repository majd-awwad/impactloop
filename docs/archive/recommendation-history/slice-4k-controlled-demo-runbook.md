# Slice 4K — Controlled Demo Runbook and Policy Freeze

Date: 2026-07-20  
Scope: repeatable controlled-demo preflight, operator runbook, and accepted recommendation policy freeze.

## Frozen Recommendation Policy

The Slice 4J evaluation accepted the following implementation. **Do not change these policies without a new evaluated slice** — not via undocumented edits.

### Accepted versions

| Field | Value |
|-------|-------|
| `artifactVersion` (`model_version`) | `slice-4c-runtime-v2` |
| `featureSchemaVersion` | `runtime-approved-features-v2` |

Artifact files:

- `ml/recommendation/generated/portable-model/material-hybrid-runtime-v2.json`
- `ml/recommendation/generated/portable-model/project-hybrid-runtime-v2.json`

### Materials (LightFM + recent intent + confidence-gated fusion)

- 14-day recent history window
- 24-hour confidence burst window
- 4-day half-life decay
- NONE / LOW confidence: zero recent slots
- MEDIUM confidence: 1 slot in top 5, 1 slot in top 10
- HIGH confidence: 2 slots in top 5, 3 slots in top 10

Source: `recent-intent-confidence.ts`, `material-rank-fusion.ts`, `short-term-intent.ts`

### Projects (LightFM + recent intent + confidence-gated fusion)

- 21-day recent history window
- 72-hour confidence burst window
- 5-day half-life decay
- NONE / LOW confidence: zero recent slots
- MEDIUM confidence: 1 slot in top 5, 1 slot in top 10
- HIGH confidence: 2 slots in top 5, 3 slots in top 10
- Required project components only for runtime/artifact mapping

Source: `project-recent-intent.ts`, `project-rank-fusion.ts`, `project-runtime-candidate-mapping.ts`

### Serving and fallback

- Material and project serving are **independently feature-flagged**
- Deterministic ordering is the fail-closed fallback when shadow is off, serving is off, readiness is NOT_READY, or any scorer/fusion error occurs
- PostgreSQL project runtime readiness must be **READY** before project serving can reorder results

### Safe default flags (checkout / production-safe)

All recommendation ML flags default to `false`:

```
RECOMMENDATION_ML_SHADOW_ENABLED=false
RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED=false
RECOMMENDATION_ML_PROJECT_SERVING_ENABLED=false
```

---

## Before the Demo

### 1. Start PostgreSQL

Use the project's existing database startup (Docker Compose or local PostgreSQL). Confirm `DATABASE_URL` is set in `apps/backend/.env`.

### 2. Verify artifacts

Confirm both runtime-v2 portable model files exist and are readable:

```
ml/recommendation/generated/portable-model/material-hybrid-runtime-v2.json
ml/recommendation/generated/portable-model/project-hybrid-runtime-v2.json
```

### 3. Run preflight (read-only)

From the repository root:

```powershell
# Direct invocation (recommended on Windows when npm strips --mode)
npx tsx apps/backend/scripts/recommendations-demo-preflight.ts --mode=deterministic

# Or session env var with npm script
$env:PREFLIGHT_MODE="deterministic"; npm run recommendations:demo:preflight -w apps/backend
$env:PREFLIGHT_MODE="material"; npm run recommendations:demo:preflight -w apps/backend
$env:PREFLIGHT_MODE="project"; npm run recommendations:demo:preflight -w apps/backend
$env:PREFLIGHT_MODE="both"; npm run recommendations:demo:preflight -w apps/backend
```

From `apps/backend`:

```powershell
npx tsx scripts/recommendations-demo-preflight.ts --mode=both
```

Preflight is read-only: it does not write `.env`, does not create fixture users, and restores all process-level flags when it exits.

A blocking failure returns a non-zero exit code. Resolve blockers before enabling serving.

### 4. Start the backend

From the repository root:

```powershell
npm run backend:dev
```

Use Node.js per the project README. The backend must be fully restarted after any flag or artifact path change.

### 5. Start Flutter

Launch the Flutter client using the project's standard development workflow. Sign in as any seeded learner with engagement history (profile interests, material views/likes, or project saves).

### 6. Confirm safe defaults

Before enabling serving, confirm all three ML flags are `false` unless you intentionally set them for the demo.

---

## Enabling Serving (PowerShell session-only)

Set flags in the **current PowerShell session only**. Do not edit `.env` for a temporary demo unless you intend a persistent change.

### Material only

```powershell
$env:RECOMMENDATION_ML_SHADOW_ENABLED="true"
$env:RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED="true"
$env:RECOMMENDATION_ML_PROJECT_SERVING_ENABLED="false"
```

### Projects only

```powershell
$env:RECOMMENDATION_ML_SHADOW_ENABLED="true"
$env:RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED="false"
$env:RECOMMENDATION_ML_PROJECT_SERVING_ENABLED="true"
```

### Both material and project serving

```powershell
$env:RECOMMENDATION_ML_SHADOW_ENABLED="true"
$env:RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED="true"
$env:RECOMMENDATION_ML_PROJECT_SERVING_ENABLED="true"
```

**Important:** Stop and fully restart the backend after changing flags or artifact paths. Learner Home caches responses per flag combination; a restart ensures the new configuration is active.

Optional artifact path overrides (only if files are not at default locations):

```powershell
$env:RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH="C:\path\to\material-hybrid-runtime-v2.json"
$env:RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH="C:\path\to\project-hybrid-runtime-v2.json"
```

---

## Demo Sequence

Use any seeded learner with sufficient catalog engagement. Do not depend on private hardcoded accounts.

1. **Deterministic baseline** — With all ML flags `false`, open Learner Home. Note Suggested Materials and Suggested Projects ordering. This is the fail-closed default.

2. **Enable material serving** — Set material-only flags, restart backend, refresh Learner Home. Open Suggested Materials and compare ordering to the baseline.

3. **Coherent material interactions** — View and like several materials in the same category/concept cluster. Refresh Learner Home.

4. **Bounded material movement** — Confirm recent-slot movement is bounded (at most 2 positions in top 5 and 3 in top 10 at HIGH confidence). LOW/NONE confidence shows no recent slots.

5. **Enable project serving** — Set project-only flags (or both), restart backend, refresh. Open Suggested Projects.

6. **Coherent project behavior** — Save, like, or start building projects in a coherent cluster. Refresh Learner Home.

7. **Bounded project movement** — Confirm bounded recent movement in Suggested Projects. Other sections should remain stable.

8. **Unchanged sections** — Verify Saved Projects, Continue Projects, Popular Projects, and unrelated material sections (e.g. Popular Materials) are unchanged by ML serving. Only Suggested Materials / Suggested Projects reorder when serving gates pass.

9. **Rollback** — Disable all ML flags, restart backend, refresh. Ordering returns to deterministic baseline immediately.

---

## Expected Diagnostics (privacy-safe)

When inspecting backend dev logs or preflight output, look for these fields only:

| Field | Meaning |
|-------|---------|
| `domain` | `material` or `project` |
| `mode` | `DETERMINISTIC`, `SHADOW`, `SERVED`, or `FALLBACK` |
| `status` | Shadow status: `DISABLED`, `SCORED`, or `FALLBACK` |
| `projectReadinessStatus` | `READY`, `NOT_READY`, or `FALLBACK` |
| `confidenceLevel` | `NONE`, `LOW`, `MEDIUM`, or `HIGH` |
| `confidenceSource` | Burst/evidence classification |
| `recentSlotsUsedTop5` | Recent slots consumed in top 5 |
| `recentSlotsUsedTop10` | Recent slots consumed in top 10 |
| `fallbackReason` | Present when status is `FALLBACK` |
| `scorerDurationMs` | LightFM scoring duration |
| `fusionDurationMs` | Rank fusion duration |
| `totalRecommendationDurationMs` | End-to-end recommendation duration |

Do **not** enable detailed stage tracing for the demo. Do not log or share emails, user IDs, material IDs, project IDs, titles, tokens, or complete rankings.

---

## Emergency Rollback

Fastest rollback to deterministic ordering:

```powershell
$env:RECOMMENDATION_ML_SHADOW_ENABLED="false"
$env:RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED="false"
$env:RECOMMENDATION_ML_PROJECT_SERVING_ENABLED="false"
```

Then **fully restart the backend**. The application continues using deterministic recommendations. No database migration or Flutter change is required.

---

## Troubleshooting

### Backend unavailable

- Confirm PostgreSQL is running and `DATABASE_URL` is correct.
- Check backend console for startup errors.
- Verify port is not in use.

### Learner Home timeout

- Shadow scoring has a 1-second timeout per domain; slow environments may hit `FALLBACK`.
- Check database latency and restart the backend.
- Run `npm run recommendations:demo:preflight -w apps/backend -- --mode=deterministic` to isolate DB vs ML issues.

### Project readiness `NOT_READY`

- Run preflight; inspect `project_catalog_readiness` in the report.
- Common causes: missing artifact mappings, duplicate runtime candidates, non-finite scores, hydration failures.
- Resolve artifact/runtime alignment before enabling project serving.

### Artifact missing or rejected

- Confirm runtime-v2 JSON files exist at the expected paths.
- Preflight checks `model_version === slice-4c-runtime-v2` and `feature_schema_version === runtime-approved-features-v2`.
- Re-export artifacts with the approved training pipeline if versions mismatch.

### Mode unexpectedly `DETERMINISTIC`

- Shadow is disabled (`RECOMMENDATION_ML_SHADOW_ENABLED=false`), or serving flag for that domain is off.
- Restart backend after setting flags.

### Mode `FALLBACK`

- Scorer timeout, fusion error, or injected failure. Response remains deterministic.
- Check `fallbackReason` in diagnostics.

### No recent slots despite MEDIUM / HIGH confidence

- Recent slots apply only when serving gates pass and confidence thresholds are met with coherent burst evidence.
- Scattered interactions produce LOW confidence and zero slots by design.

### Confidence remains LOW

- Insufficient coherent burst evidence within the burst window (24h materials, 72h projects).
- Perform additional coherent interactions and refresh.

### Stale cache after flag changes

- Learner Home caches per user and flag combination.
- **Full backend restart** is required after flag or artifact changes during the demo.

### Logs not appearing

- ML decision logs are dev-environment only.
- Ensure `NODE_ENV` is development and log level permits info output.

### Fixture cleanup verification

After running the Slice 4J evaluation harness, confirm no ephemeral fixtures remain:

```sql
SELECT COUNT(*) FROM "User" WHERE email LIKE '%@evaluation.invalid';
SELECT COUNT(*) FROM "MaterialView" WHERE "viewSource" = 'evaluation_fixture';
```

Both counts must be zero. Preflight checks this automatically via `no_fixture_users`.

---

## Preflight Command Reference

| Command | Purpose |
|---------|---------|
| `npx tsx apps/backend/scripts/recommendations-demo-preflight.ts --mode=deterministic` | DB, artifacts, catalog readiness, deterministic smoke (no scorer) |
| `npx tsx apps/backend/scripts/recommendations-demo-preflight.ts --mode=material` | Above + material serving smoke |
| `npx tsx apps/backend/scripts/recommendations-demo-preflight.ts --mode=project` | Above + project serving smoke (requires READY) |
| `npx tsx apps/backend/scripts/recommendations-demo-preflight.ts --mode=both` | Above + independent material and project serving smoke |

On Windows, if `npm run ... -- --mode=` is stripped by npm, use `PREFLIGHT_MODE` instead:

```powershell
$env:PREFLIGHT_MODE="both"; npm run recommendations:demo:preflight -w apps/backend
```

Preflight temporarily applies process-level flags for smoke checks and restores previous values in `finally`. It never writes environment variables to disk.
