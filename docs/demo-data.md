# Demo data

Durable guide for ImpactLoop’s community demo dataset: people, materials, learning projects, local assets, and deterministic behavior seeding.

## Three seed paths (do not confuse)

| Command | Purpose | Safety |
|---|---|---|
| `npm run prisma:seed -w apps/backend` | **Destructive** core catalog + workflow scenarios (truncates local DB) | Localhost + refuses CI/test/E2E/bench/prod-like DBs |
| `npm run demo:seed -w apps/backend` | **Additive** graduation/community demo preparation | Each stage refuses non-local hosts |
| `npm run seed:ci -w apps/backend` | **CI-only** minimal fixtures (`impactloop_ci`) | `guard:ci:database` + `IMPACTLOOP_CI_DATABASE=1` |

## Overview

| Dataset | Count / shape | Identity |
|---|---|---|
| Community people | 100 (`@impactloop.demo`) | email uniqueness |
| Community materials | 206 listings | `il-demo-mat:<seedKey>` |
| Learning projects | 37 stable (30 English catalog + 7 Arabic An-Najah) | `demo-project-key:<key>` |
| Community behavior | 35 learners’ engagement graph | `cdb1` / `cdb2` ownership keys |
| Material Request journeys | 3 OPEN demo requests | behavior journey plans |

Core scenario accounts from `prisma/seed.ts` (e.g. `learner@learner.com`, `majd@learner.com`) remain separate from the community demo pool.

## Normal graduation path

From a migrated local database (`DATABASE_URL` on localhost), after a core reset if needed:

```bash
# From repository root (or apps/backend without -w)
npm run prisma:seed -w apps/backend   # optional full reset — destructive
npm run demo:seed -w apps/backend     # people → materials → projects → najah → behavior → journeys
```

`demo:seed` runs these stages in order and fails fast on the first error:

1. `demo:seed:people`
2. `demo:seed:materials`
3. `demo:seed:projects` (stamp `demo-project-key:` tags / archive test pollution)
4. `demo:seed:projects:najah` (7 Arabic An-Najah projects)
5. `demo:seed:behavior`
6. `demo:seed:behavior:journeys`

Optional (not part of `demo:seed`):

```bash
# After prisma:seed — ensures Majd's project-budget material set for Obstacle Avoidance Robot
npm run demo:seed:project-budget -w apps/backend
```

## Advanced per-stage commands

```bash
npm run demo:seed:people -w apps/backend
npm run demo:seed:materials -w apps/backend
npm run demo:seed:projects -w apps/backend
npm run demo:seed:projects -w apps/backend -- --sync-covers   # optional cover repair for the 30 catalog projects
npm run demo:seed:projects:najah -w apps/backend
npm run demo:seed:behavior -w apps/backend
npm run demo:seed:behavior:journeys -w apps/backend
npm run demo:seed:project-budget -w apps/backend   # optional Project Budget UI materials
```

Community / demo seed scripts (including project sync and covers) refuse non-local database hosts.
Core `prisma:seed` also refuses non-local hosts and reserved CI/test/E2E/bench databases before truncate.

## People (100)

- Source: `prisma/demo-data/impactloop-demo-people.csv` and `community-demo-people.data.ts`
- Seed: `npm run demo:seed:people -w apps/backend`
- Result: 65 suppliers (27 organizations + 38 individuals) and 35 learners
- Password for newly created demo accounts: `password`
- Reruns skip existing emails/phones; does not replace core seed users

## Materials (206)

- Canonical CSV: `prisma/demo-data/materials/canonical-materials.csv`
- Provenance map: `owner-map.csv` (batch → owner lineage; not required at runtime)
- Quality layer: `community-materials-quality.ts` (condition mix, titles, ownership spread, `createdAt`)
- Seed: `npm run demo:seed:materials -w apps/backend` (idempotent upsert by `il-demo-mat:<seedKey>`)

### Local material images

- Disk: `prisma/demo-data/materials/source-images/`
- Public URL prefix: `/demo-assets/community-materials/...`
- Backend serves the folder via Express static mount in `app.ts`
- Clients resolve relative paths with the API base URL (no localhost baked into rows)

### Core catalog real photos (`seed-catalog/`)

- Selected `prisma/seed.ts` materials (stable `MaterialSeed.key`) use curated files under `source-images/seed-catalog/`
- Mapping source of truth: `prisma/demo-data/materials/seed-catalog-images.data.ts`
- `npx prisma migrate reset` / `npm run prisma:seed` recreates those Materials with the same demo URLs
- Runtime uploads still use `UPLOAD_ROOT_DIR` (`POST /api/uploads/material-images`) — keep demo assets and user uploads separate

## Learning projects (37)

### Original 30 (English catalog)

- Defined in `prisma/seed.ts`; covers from `legacy-project-covers.data.ts`
- Local files: `prisma/demo-data/projects/source-images/covers/legacy/`
- Public URLs: `/demo-assets/community-projects/covers/legacy/<key>.jpg|png|...`
- Stamp / archive: `npm run demo:seed:projects -w apps/backend`
- Cover repair: `npm run demo:seed:projects -w apps/backend -- --sync-covers`
- Validate disk only: `npx tsx prisma/demo-data/projects/validate-legacy-project-covers.ts`

### An-Najah Arabic projects (7)

- Data: `prisma/demo-data/projects/najah-projects.data.ts` (batch tag string remains `project-data-03` in DB)
- Seed: `npm run demo:seed:projects:najah -w apps/backend` (upsert by `demo-project-key:<key>`; does not rewrite the original 30)
- Covers: `prisma/demo-data/projects/source-images/covers/najah-*-cover.png`
- Public URLs: `/demo-assets/community-projects/covers/<filename>.png`

Expected publish mix after full demo setup: **36 PUBLISHED**, **1 PENDING_REVIEW** (among the stable 37).

## Behavior & personalization

### Community behavior engagement

```bash
npm run demo:seed:behavior -w apps/backend
npm run demo:audit:behavior -w apps/backend
npm run demo:smoke:personalization -w apps/backend
```

- Deterministic RNG (mulberry32 from `cdb1|{email}|{purpose}`); no `Math.random()`
- Fixed epoch end `2026-08-11T12:00:00.000Z`, ~45-day recent-biased window
- Idempotent: reconciles owned community-demo engagement for the 35 learners, then rewrites the planned graph
- Builds are create-if-missing on `(learnerId, projectId, attemptNumber=1)`
- Core scenario users and non-demo views are never deleted

Learner activity tiers: HIGH 6 / MEDIUM 14 / LIGHT 11 / DORMANT 4.

### Behavior journeys (viewsCount + MR journeys)

```bash
npm run demo:seed:behavior:journeys -w apps/backend
```

- Reconciles core-catalog `viewsCount` to retained `MaterialView` counts (community rows untouched)
- Seeds three Material Request journeys (OPEN; user-facing descriptions stay clean; ownership via business key / optional legacy `[cdb2]` detection):
  1. Capacitance Sensing Circuit — OPEN, no suggestion
  2. GT2 Timing Belt — OPEN, no suggestion (intentional marketplace gap)
  3. OAK-D Camera — OPEN, DISMISSED Pi Camera suggestion
- Does not create reservations, deliveries, payments, or strikes

## Project Budget demo materials (optional)

Project Budget estimation remains a live product path. The additive helper:

```bash
npm run demo:seed:project-budget -w apps/backend
```

requires a prior `prisma:seed` (Majd supplier + Obstacle Avoidance Robot) and upserts the small Majd AVAILABLE material set used by that UI. It is **not** included in the default `demo:seed` orchestrator because the canonical graduation demo does not require it.

## QA commands worth keeping

| Command | Purpose |
|---|---|
| `npm run demo:audit:behavior` | Engagement count / distribution report |
| `npm run demo:smoke:personalization` | Learner Home persona matrix |
| `npm run taxonomy:resolution-matrix` | Read-only live-DB material reference resolution matrix (does not mutate aliases; use `demo:seed:materials` for alias ensure/repair) |
| `npm run demo:seed:projects -- --sync-covers` | Local cover validation + DB sync for the 30 |
| `npx tsx prisma/demo-data/projects/validate-legacy-project-covers.ts` | Disk-only cover decode check |
| `npm run demo:seed:project-budget` | Optional Majd Project Budget material set |

## Safe reruns

- Community people/materials/projects/behavior scripts are idempotent on localhost
- `npm run prisma:seed` truncates the local database — use only for a full reset
- After a full `prisma:seed`, re-run `demo:seed` (or the per-stage commands above)

## Demo data vs ML artifacts

Demo seed prepares **database content** (materials, projects, behavior). It does **not** train or refresh LightFM artifacts.

| Action | Affects DB | Affects ML artifacts |
|--------|------------|----------------------|
| `demo:seed` | Yes | No |
| `recommendations:ml:train:local` | No | Yes |

If taxonomy, demo materials, or feature contracts change materially, regenerate snapshot → retrain → validate per [development/local-ml.md](development/local-ml.md). Stale artifacts may cause NOT_READY or deterministic fallback under ML_PRIMARY even when demo data looks correct.
