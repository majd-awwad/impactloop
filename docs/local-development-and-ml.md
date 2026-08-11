# Local development and local ML runbook

Executable setup for a fresh ImpactLoop checkout through database seed, local LightFM artifact production, runtime modes, verification, and a minimal Learner Home demo.

This document is for **local development and local ML only**. It does not claim production readiness and does not describe Docker, CI deployment, remote artifact registries, or operational hardening.

## Prerequisites

| Requirement | Repository authority |
|-------------|----------------------|
| Node.js | CI pin `22.12.0` in `.github/workflows/recommendation-ci.yml`. Root and backend `package.json` do not declare an `engines` field; do not invent other versions. |
| npm | Use the root workspace lockfile via `npm ci` (same as recommendation CI). |
| PostgreSQL (+ PostGIS) | Backend stack uses Prisma + PostgreSQL + PostGIS (`README.md`, ADR 0001). Provide a local database reachable through `DATABASE_URL`. Confirm `CREATE EXTENSION postgis` works; DR-04 Available Jobs nearest/radius queries require PostGIS geography + GiST on `locations.location`. |
| Prisma client | Generated with `npm run prisma:generate` into `apps/backend/src/generated/prisma` (gitignored). |
| Flutter | `apps/frontend/pubspec.yaml` requires Dart SDK `^3.10.7`. Install Flutter tooling that satisfies that SDK constraint. |
| WSL/Linux (training only) | Native LightFM training requires a Linux Python 3.11 environment. Authority: `ml/recommendation/requirements-linux-lock.txt`, `ml/recommendation/pyproject.toml` (`requires-python = ">=3.11,<3.12"`, `lightfm==1.17`), and `ml/recommendation/slice-0c-linux-viability-report.md`. |
| Windows after artifacts exist | Snapshot export, artifact validation, smoke, backend, and Flutter run on Windows Node. Portable JSON artifacts are consumed by the TypeScript runtime without calling Python at request time. |

## Windows versus WSL

### Run on Windows (or any Node host with local PostgreSQL)

- `npm ci`
- Place `apps/backend/.env`
- Prisma generate / migrate / seed
- LM-04 snapshot export
- Artifact validation
- LM-09 smoke
- Backend typecheck, build, and `backend:dev`
- Flutter `pub get` / `flutter run`
- Recommendation pure and database tests

### Require WSL/Linux for LightFM training

1. Create or reuse a Linux Python 3.11 environment from `ml/recommendation/requirements-linux-lock.txt` (see also `ml/recommendation/pyproject.toml` and `ml/recommendation/slice-0c-linux-viability-report.md`).
2. Do **not** use `ml/recommendation/requirements-lock.txt` for accepted training; that Windows lock is historical evidence only. Windows-native LightFM is unsupported for accepted execution.
3. Point the training CLI at the Linux interpreter:
   - `--python wsl:<Distro>:</absolute/linux/python>`
   - or set `IMPACTLOOP_ML_PYTHON` (see `apps/backend/scripts/train-local-lightfm.ts`)

### Portable-artifact handoff

1. Training writes under `ml/recommendation/generated/local-lightfm/` (`current.json` plus `sets/<setId>/*-lightfm-v2.json`).
2. That tree is ignored by Git (`ml/recommendation/generated/` in `.gitignore`).
3. Configure `RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH` and `RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH` to those JSON files. The Windows (or any host) Node backend preloads TypeScript scorers from the JSON; no Python at request time.

## Fresh setup (ordered)

1. Clone or use a fresh checkout of the integration branch.
2. Install Node **22.12.0**. Ensure local PostgreSQL (+ PostGIS) is running.
3. Copy the committed example env to a developer-local untracked file:
   - From: `apps/backend/.env.example` (same content as `apps/backend/env.example`)
   - To: `apps/backend/.env` (gitignored via `.env` / `.env.*`)
     - Set at least (values redacted here):
     - `DATABASE_URL=<local PostgreSQL connection string>`
     - `TEST_DATABASE_URL=<dedicated test database connection string>` (required for `npm test`; must use database name `impactloop_test`, never `impactloop`)
     - `NODE_ENV=development`
     - `PORT=4000` (if unset, `apps/backend/src/config/env.ts` also defaults to `4000`)
     - JWT placeholder names already present in the example file
   - Do not commit or publish real values.
   - Automated backend tests refuse to start unless `TEST_DATABASE_URL` points at an isolated database. Create it once, then migrate with `npm run test:db:migrate -w apps/backend`.
4. From the **repository root**:

```bash
npm ci
```

5. Generate the Prisma client (from repository root):

```bash
npm run prisma:generate -w apps/backend
```

6. Apply local migrations (from repository root; package script runs `prisma migrate dev`):

```bash
npm run prisma:migrate -w apps/backend
```

7. Seed the database (from repository root):

```bash
npm run prisma:seed -w apps/backend
```

Destructive core catalog reset only. For graduation/community demo data afterward:

```bash
npm run demo:seed -w apps/backend
```

Do not confuse with CI fixtures (`npm run seed:ci -w apps/backend`). See `docs/demo-data.md`.

8. Install Flutter dependencies:

```bash
cd apps/frontend
flutter pub get
```

## ML setup

### When retraining is required

| Situation | Retrain? |
|-----------|----------|
| Fresh checkout (`ml/recommendation/generated/` is gitignored and not in the clone) | Yes |
| Artifacts missing, fail validation, or runtime reports `NOT_READY` / incompatible failure codes | Yes |
| Local set already published with valid `current.json` and material/project JSON that validate and preload as `READY` | No |

### Evaluation time

CLI flag name: `--evaluation-time`  
Value shape: ISO-8601 UTC timestamp ending in `Z` (example shape only: `2026-07-23T00:00:00.000Z`).

- Snapshot export: `--evaluation-time` is **required**.
- Local train: `--evaluation-time` is **required** unless `--snapshot` is provided.
- LM-09 smoke: accepts `--evaluation-time` / `--evaluation-time=`; if omitted, helpers default to `2026-07-23T00:00:00.000Z`.

### Ordered snapshot -> train -> validate -> configure

Use one evaluation timestamp consistently.

**1. LM-04 snapshot** (working directory `apps/backend`, or root with `-w apps/backend`):

```bash
npm run recommendations:ml:snapshot:local -- --evaluation-time <ISO-8601-UTC-ending-in-Z>
```

Default output: `ml/recommendation/generated/local-ml-training-snapshots/snapshot-<...>.json` (under the ignored `generated/` tree).

**2. LM-06 train** (repository root or `apps/backend`; use WSL Python on Windows hosts):

```bash
npm run recommendations:ml:train:local -- --evaluation-time <ISO-8601-UTC-ending-in-Z> --python wsl:<Distro>:</absolute/linux/python>
```

Optional confirmed flags: `--seed` (default `11`), `--snapshot <path>`, `--output <dir>`.

Default output root: `ml/recommendation/generated/local-lightfm/`  
Publishes `current.json` and `sets/<setId>/material-lightfm-v2.json`, `sets/<setId>/project-lightfm-v2.json`.

Do **not** run native LightFM training on Windows Python. Portable generated artifacts may be consumed by the Windows backend/runtime.

**3. Validate artifacts** (from `apps/backend` or `-w apps/backend`):

```bash
npm run recommendations:ml:validate:local -- --artifact ml/recommendation/generated/local-lightfm/sets/<setId>/material-lightfm-v2.json
npm run recommendations:ml:validate:local -- --artifact ml/recommendation/generated/local-lightfm/sets/<setId>/project-lightfm-v2.json
```

Optional confirmed flags: `--expected-domain`, `--expected-dataset-content-hash`.

**4. Runtime artifact configuration** in `apps/backend/.env` (names only; values redacted):

```bash
RECOMMENDATION_ML_RUNTIME_MODE=ML_LOCAL
RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH=<repo-relative or absolute material JSON path>
RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH=<repo-relative or absolute project JSON path>
```

`RECOMMENDATION_ML_RUNTIME_MODE` is resolved in `apps/backend/src/config/env.ts` (allowed: `DETERMINISTIC`, `SHADOW`, `ML_LOCAL`). Artifact path env names also appear in `apps/backend/.env.example`.

## Runtime modes

Config: `resolveRecommendationMlRuntimeConfig` in `apps/backend/src/config/env.ts`.  
Preload/rank: `apps/backend/src/modules/recommendations/ml-runtime-state.service.ts`.  
Learner Home ordering: `learner-home.ml-ordering.ts` / `learner-home.service.ts`.  
Startup (`apps/backend/src/server.ts`) awaits preload and still listens; missing or incompatible artifacts do **not** abort process startup.

### DETERMINISTIC

| Field | Behavior |
|-------|----------|
| Exact config | `RECOMMENDATION_ML_RUNTIME_MODE=DETERMINISTIC`, or omit mode and leave `RECOMMENDATION_ML_SHADOW_ENABLED=false` (default) |
| Artifacts | Not required |
| Readiness | Domains `DISABLED`; no artifact load |
| Ordering / scoring | Deterministic only; ML scores do not affect learner ordering |
| Fallback | ML disabled |

### SHADOW

| Field | Behavior |
|-------|----------|
| Exact config | `RECOMMENDATION_ML_RUNTIME_MODE=SHADOW`, or omit mode with `RECOMMENDATION_ML_SHADOW_ENABLED=true` |
| Artifacts | Paths used if set; empty paths yield domain `NOT_READY` / `ARTIFACT_PATH_MISSING` after preload |
| Readiness | Preload runs; failures classify to `NOT_READY` or `FAILED`; server still starts |
| Ordering / scoring | No user-visible ordering effect; decision status `SHADOW`; deterministic pool order preserved |
| Fallback | Shadow comparison failures are caught; response remains deterministic |

### ML_LOCAL

| Field | Behavior |
|-------|----------|
| Exact config | `RECOMMENDATION_ML_RUNTIME_MODE=ML_LOCAL` |
| Environment | Allowed only when `NODE_ENV` is `development` or `test` (otherwise `ML_LOCAL_ENVIRONMENT_FORBIDDEN`) |
| Artifacts | Required for domain `READY`; set both material and project path env vars |
| Readiness | Missing path -> `NOT_READY` + `ARTIFACT_PATH_MISSING`; incompatible/missing file -> `NOT_READY` with classified codes; scorer construction errors -> `FAILED`; **does not prevent startup** |
| Ordering / scoring | Domain `READY` and successful rank -> `ML_RANKED` (ML order on suggested material/project pools with deterministic tail containment). `NOT_READY` / `LOADING` / `DISABLED` -> `FALLBACK_NOT_READY` (original deterministic order). Hard failures -> `FALLBACK_FAILED` (deterministic order) |

## Verification commands

From the **repository root** unless noted.

### Local ML artifact validation

```bash
npm run recommendations:ml:validate:local -w apps/backend -- --artifact <path-to-artifact.json>
```

### LM-09 end-to-end local ML smoke

```bash
npm run recommendations:ml:smoke:local -- --evaluation-time=<ISO-8601-UTC-ending-in-Z>
```

(Also available as `npm run recommendations:ml:smoke:local` from `apps/backend`.)

### Backend typecheck and build

```bash
npm run backend:typecheck
npm run backend:build
```

### Recommendation pure tests

```bash
npm run ci:recommendations:pure
```

### Recommendation database tests

```bash
npm run ci:recommendations:db
```

Requires a reachable local database configured via `DATABASE_URL`.

## Starting the application

### Backend

From the repository root:

```bash
npm run backend:dev
```

Confirmed API base: `http://localhost:4000` when `PORT` is unset or `4000` (`apps/backend/src/config/env.ts`). Flutter defaults also target port `4000` (`apps/frontend/lib/core/config/api_config.dart`).

### Flutter web

```bash
cd apps/frontend
flutter run -d chrome
```

### Flutter mobile / other device

Same entrypoint; the repository README also permits running on another device:

```bash
cd apps/frontend
flutter run
```

Do not invent device IDs or platform flags beyond repository documentation.

## Manual Learner Home smoke

Use seeded learner identities only (no passwords in this document):

- `learner@learner.com`
- `majd@learner.com`
- `israa@learner.com`

(from `apps/backend/prisma/seed.ts`)

1. Start the backend (`npm run backend:dev`) and Flutter against the local API.
2. Log in as a seeded learner using the already-known local seed credential (do not print or commit it).
3. Open Learner Home (`/home`). Confirm the page loads and recommendation sections (for example suggested materials / suggested projects) render.
4. Mode-specific observations (backend startup log `[Recommendation ML runtime]` plus visible home behavior):
   - **DETERMINISTIC:** log shows mode `DETERMINISTIC` / domains `DISABLED`; home loads with deterministic recommendations.
   - **SHADOW:** log shows mode `SHADOW`; home loads with deterministic visible ordering (no ML reordering contract).
   - **ML_LOCAL** with valid artifacts: log domains `READY`; home loads; suggested sections may reflect ML ranking when ready.
   - **ML_LOCAL** with missing/incompatible artifacts: log domains `NOT_READY` (or `FAILED`); process still starts; home still loads via deterministic fallback. Flutter UI does not surface algorithm version tokens.

## Troubleshooting

### Missing generated Prisma client

1. **Symptom:** imports fail under `apps/backend/src/generated/prisma`.
2. **Cause:** Prisma client not generated after install.
3. **Fix:** `npm run prisma:generate -w apps/backend` (repository root).

### Missing ML evaluation time

1. **Symptom:** snapshot/train error that `--evaluation-time` is required.
2. **Cause:** required CLI option omitted (unless train is given `--snapshot`).
3. **Fix:** pass `--evaluation-time <ISO-8601-UTC-ending-in-Z>`.

### Missing Python `lightfm` package

1. **Symptom:** train fails with Python exit / import failure from `ml.recommendation.train_local_lightfm`.
2. **Cause:** wrong interpreter or incomplete Linux environment.
3. **Fix:** use the Linux env from `requirements-linux-lock.txt` / `pyproject.toml` and pass `--python wsl:<Distro>:</path/to/python>`.

### Native LightFM crash on Windows

1. **Symptom:** native access violation or train failure when using Windows Python.
2. **Cause:** Windows-native LightFM is unsupported for accepted execution.
3. **Fix:** train via WSL/Linux interpreter; consume portable JSON on Windows Node.

### Missing artifacts

1. **Symptom:** runtime domains `NOT_READY` / `ARTIFACT_PATH_MISSING`, or smoke `ARTIFACTS_MISSING`.
2. **Cause:** no env paths and no `ml/recommendation/generated/local-lightfm/current.json`.
3. **Fix:** run local train to publish artifacts, then set `RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH` and `RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH`.

### Incompatible artifacts

1. **Symptom:** `NOT_READY` with codes such as `ARTIFACT_SCHEMA_INVALID`, `FEATURE_CONTRACT_MISMATCH`, `AGGREGATION_MODE_MISMATCH`, `TAXONOMY_FINGERPRINT_MISMATCH`, `MAPPING_HASH_MISMATCH`, `ARTIFACT_INTEGRITY_MISMATCH`.
2. **Cause:** artifact fails v2/contract expectations on preload or validate.
3. **Fix:** `npm run recommendations:ml:validate:local -w apps/backend -- --artifact <path>`, then retrain with current contracts/snapshot.

### `ML_LOCAL` domain result `NOT_READY`

1. **Symptom:** startup JSON shows `NOT_READY`; home still serves deterministic fallback.
2. **Cause:** expected local readiness failure (missing/incompatible artifacts or preload not ready).
3. **Fix:** confirm `RECOMMENDATION_ML_RUNTIME_MODE=ML_LOCAL`, artifact paths, validate/retrain, and restart the backend after config/artifact fixes.

### Database connection failure

1. **Symptom:** Prisma migrate, seed, or `backend:dev` fails on connection.
2. **Cause:** PostgreSQL is down or `DATABASE_URL` is wrong.
3. **Fix:** verify local PostgreSQL and the redacted `DATABASE_URL` in `apps/backend/.env`.

## Secrets and redaction policy

**May be named:** environment variable names; npm/Flutter/Prisma script names; seeded learner emails; ports and URLs declared in the repository (`PORT` default `4000`, Flutter API defaults); runtime mode enum values; artifact relative paths under `ml/recommendation/generated/`; readiness failure codes.

**Must stay redacted:** real `DATABASE_URL` credentials, JWT secrets, SMTP credentials, API keys, demo/seed passwords, and any live `.env` values.

**Must not be committed:**

- `apps/backend/.env` (and other `.env` / `.env.*` files)
- Generated Prisma client under `apps/backend/src/generated/`
- Generated snapshots and ML artifacts under `ml/recommendation/generated/`
- Python virtual environments under ignored ML paths
- `node_modules/`, backend `dist/`, Flutter build outputs

## Command quick reference

| Purpose | Exact command | Working directory |
|---------|---------------|-------------------|
| Install workspace deps | `npm ci` | repository root |
| Prisma generate | `npm run prisma:generate -w apps/backend` | repository root |
| Migrate (local) | `npm run prisma:migrate -w apps/backend` | repository root |
| Seed (destructive core) | `npm run prisma:seed -w apps/backend` | repository root |
| Demo seed (graduation/community) | `npm run demo:seed -w apps/backend` | repository root |
| Flutter deps | `flutter pub get` | `apps/frontend` |
| LM-04 snapshot | `npm run recommendations:ml:snapshot:local -- --evaluation-time <ISO-Z>` | `apps/backend` or `-w apps/backend` |
| LM-06 train | `npm run recommendations:ml:train:local -- --evaluation-time <ISO-Z> --python wsl:<Distro>:</absolute/linux/python>` | repository root or `apps/backend` |
| Validate artifact | `npm run recommendations:ml:validate:local -- --artifact <path>` | `apps/backend` or `-w apps/backend` |
| LM-09 smoke | `npm run recommendations:ml:smoke:local -- --evaluation-time=<ISO-Z>` | repository root or `apps/backend` |
| Typecheck | `npm run backend:typecheck` | repository root |
| Build | `npm run backend:build` | repository root |
| Recs pure tests | `npm run ci:recommendations:pure` | repository root |
| Recs DB tests | `npm run ci:recommendations:db` | repository root |
| Backend dev | `npm run backend:dev` | repository root |
| Flutter web | `flutter run -d chrome` | `apps/frontend` |
| Flutter other device | `flutter run` | `apps/frontend` |
