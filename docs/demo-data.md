# Demo data

Durable guide for ImpactLoop’s community demo dataset: people, materials, learning projects, local assets, and deterministic behavior seeding.

## Overview

| Dataset | Count / shape | Identity |
|---|---|---|
| Community people | 100 (`@impactloop.demo`) | email uniqueness |
| Community materials | 206 listings | `il-demo-mat:<seedKey>` |
| Learning projects | 37 stable (30 English catalog + 7 Arabic PROJECT-DATA-03) | `demo-project-key:<key>` |
| Community behavior | 35 learners’ engagement graph | `cdb1` / `cdb2` ownership keys |
| Material Request journeys | 3 OPEN demo requests | BEHAVIOR-DATA-02 plans |

Core scenario accounts from `prisma/seed.ts` (e.g. `learner@learner.com`, `majd@learner.com`) remain separate from the community demo pool.

## Fresh setup order

From a migrated local database (`DATABASE_URL` on localhost):

```bash
# From apps/backend
npm run seed                      # core catalog + workflow scenarios (resets local DB)
npm run seed:community-people     # 100 community people
npm run seed:community-materials  # 206 materials + local images
npm run seed:project-data-03      # 7 Arabic learning projects
npm run seed:community-behavior   # deterministic likes/views/builds
npm run seed:behavior-data-02     # viewsCount reconcile + 3 MR journeys
```

Optional live-DB helpers (no full reset):

```bash
npm run seed:learning-projects-sync    # stamp demo-project-key tags / archive test pollution
npm run seed:learning-project-covers   # validate + sync the 30 local catalog covers
```

Community seed scripts refuse non-local database hosts.

## People (100)

- Source: `prisma/demo-data/impactloop-demo-people.csv` and `community-demo-people.data.ts`
- Seed: `npm run seed:community-people`
- Result: 65 suppliers (27 organizations + 38 individuals) and 35 learners
- Password for newly created demo accounts: `password`
- Reruns skip existing emails/phones; does not replace core seed users

## Materials (206)

- Canonical CSV: `prisma/demo-data/materials/canonical-materials.csv`
- Provenance map: `owner-map.csv` (batch → owner lineage; not required at runtime)
- Quality layer: `community-materials-quality.ts` (condition mix, titles, ownership spread, `createdAt`)
- Seed: `npm run seed:community-materials` (idempotent upsert by `il-demo-mat:<seedKey>`)

### Local material images

- Disk: `prisma/demo-data/materials/source-images/`
- Public URL prefix: `/demo-assets/community-materials/...`
- Backend serves the folder via Express static mount in `app.ts`
- Clients resolve relative paths with the API base URL (no localhost baked into rows)

## Learning projects (37)

### Original 30 (English catalog)

- Defined in `prisma/seed.ts`; covers from `legacy-project-covers.data.ts`
- Local files: `prisma/demo-data/projects/source-images/covers/legacy/`
- Public URLs: `/demo-assets/community-projects/covers/legacy/<key>.jpg|png|...`
- Validate: `npx tsx prisma/demo-data/projects/validate-legacy-project-covers.ts`

### PROJECT-DATA-03 (7 Arabic)

- Data: `prisma/demo-data/projects/project-data-03.data.ts`
- Seed: `npm run seed:project-data-03` (upsert by `demo-project-key:<key>`; does not rewrite the original 30)
- Covers: `prisma/demo-data/projects/source-images/covers/najah-*-cover.png`
- Public URLs: `/demo-assets/community-projects/covers/<filename>.png`

Expected publish mix after full demo setup: **36 PUBLISHED**, **1 PENDING_REVIEW** (among the stable 37).

## Behavior & personalization

### BEHAVIOR-DATA-01

```bash
npm run seed:community-behavior
npm run behavior:audit
npm run behavior:personalization-smoke
```

- Deterministic RNG (mulberry32 from `cdb1|{email}|{purpose}`); no `Math.random()`
- Fixed epoch end `2026-08-11T12:00:00.000Z`, ~45-day recent-biased window
- Idempotent: reconciles owned community-demo engagement for the 35 learners, then rewrites the planned graph
- Builds are create-if-missing on `(learnerId, projectId, attemptNumber=1)`
- Core scenario users and non-demo views are never deleted

Learner activity tiers: HIGH 6 / MEDIUM 14 / LIGHT 11 / DORMANT 4.

### BEHAVIOR-DATA-02

```bash
npm run seed:behavior-data-02
```

- Reconciles core-catalog `viewsCount` to retained `MaterialView` counts (community rows untouched)
- Seeds three Material Request journeys (OPEN; user-facing descriptions stay clean; ownership via business key / optional legacy `[cdb2]` detection):
  1. Capacitance Sensing Circuit — OPEN, no suggestion
  2. GT2 Timing Belt — OPEN, no suggestion (intentional marketplace gap)
  3. OAK-D Camera — OPEN, DISMISSED Pi Camera suggestion
- Does not create reservations, deliveries, payments, or strikes

## QA commands worth keeping

| Command | Purpose |
|---|---|
| `npm run behavior:audit` | Engagement count / distribution report |
| `npm run behavior:personalization-smoke` | Learner Home persona matrix |
| `npm run tax01:resolution-matrix` | Live-DB material reference resolution matrix |
| `npm run seed:learning-project-covers` | Local cover validation + DB sync for the 30 |
| `npx tsx prisma/demo-data/projects/validate-legacy-project-covers.ts` | Disk-only cover decode check |

## Safe reruns

- Community people/materials/projects/behavior scripts are idempotent on localhost
- `npm run seed` truncates the local database — use only for a full reset
- After a full `seed`, re-run the community/project/behavior commands in the fresh-setup order above
