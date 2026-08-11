# DR-05 Driver E2E Verification

## Environment setup

- Local PostgreSQL with PostGIS
- Developer database (default `impactloop`) remains untouched for fixture writes
- Disposable database: `impactloop_driver_e2e`
- Backend Node 22+

### Disposable DB safety

```bash
cd apps/backend
npm run test:driver:e2e
npm run test:driver:e2e -- --live-flutter
node --import tsx --test scripts/driver-e2e-db.test.ts
```

What this does:

1. Clones the current local schema with `CREATE DATABASE impactloop_driver_e2e TEMPLATE <source>`
2. Writes a temporary env file (does **not** mutate `.env`)
3. Loads `scripts/setup-driver-e2e-fixture.ts --reset`
4. Runs `scripts/driver-e2e-lifecycle.test.ts`
5. With `--live-flutter`: reloads fixture, starts disposable Backend, runs live API + snapshot widget smoke, Chrome boot, then stops Backend
6. Drops `impactloop_driver_e2e` and removes temp artifacts

#### Non-disruptive TEMPLATE clone (required)

PostgreSQL requires an exclusive lock on the template database. The harness:

- **May** terminate connections only to the disposable E2E database (`impactloop_driver_e2e`) before DROP/CREATE
- **Never** calls `pg_terminate_backend` for the source/developer database
- Queries `pg_stat_activity` for active source connections
- If any source clients are open, fails **before** `CREATE DATABASE` with an actionable message to stop:
  - local Backend
  - Prisma Studio
  - psql / GUI database clients

**Before running the TEMPLATE harness, stop active clients on the developer database.**

Flags:

- `--keep` preserve disposable DB after success
- `--keep-on-fail` preserve disposable DB after failure
- `--live-flutter` run live Flutter API smoke + Chrome boot after lifecycle

Safety guards:

- Refuses database names `impactloop`, `postgres`, and production-like names
- Local host only (`127.0.0.1` / `localhost`)
- Fixture refuses to run unless `DATABASE_URL` points at a disposable DB

### Known limitation (empty migrate chain)

A full empty `prisma migrate deploy` chain may be blocked by older unrelated migrations in this repository. DR-05 uses the supported **TEMPLATE clone of the current applied schema** instead. PostGIS, waiting B-tree, and geography GiST indexes are verified on the clone.

## Fixture command

```bash
# Prefer the orchestrator above. Manual steps:
# 1) Stop Backend / Prisma Studio / DB clients on the developer DB
# 2) create disposable DB (via scripts/driver-e2e-db.ts helpers / run-driver-e2e.ts)
# 3) point IMPACTLOOP_BACKEND_ENV_FILE_PATH at a temp env whose DATABASE_URL is the disposable DB
npx tsx scripts/setup-driver-e2e-fixture.ts --reset
npx tsx scripts/setup-driver-e2e-fixture.ts --manifest
npx tsx scripts/setup-driver-e2e-fixture.ts --cleanup
```

Password for all fixture accounts: `E2EPassword123!`

## Account matrix

| Email | Role | Notes |
|---|---|---|
| `e2e.driver.eligible.a@impactloop.test` | DRIVER | Eligible, Hebron |
| `e2e.driver.eligible.b@impactloop.test` | DRIVER | Eligible, Ramallah |
| `e2e.driver.paused@impactloop.test` | DRIVER | `acceptingNewJobs=false`, has reopen fixture |
| `e2e.driver.two.active@impactloop.test` | DRIVER | 2 active assignments |
| `e2e.driver.ceiling@impactloop.test` | DRIVER | 3 active (ceiling) |
| `e2e.driver.inactive@impactloop.test` | DRIVER | Profile INACTIVE |
| `e2e.driver.suspended@impactloop.test` | DRIVER | Profile SUSPENDED |
| `e2e.driver.disabled.user@impactloop.test` | DRIVER | Account DISABLED |
| `e2e.learner.main@impactloop.test` | LEARNER | Shared learner |
| `e2e.supplier.main@impactloop.test` | SUPPLIER | Shared supplier |
| `e2e.admin.main@impactloop.test` | ADMIN | Reopen actor |

## Verification terminology (do not conflate)

| Layer | What it is | What it is not |
|---|---|---|
| Live API / data-layer | Real Dio/HTTP against disposable Backend | Not a headed UI click path |
| Snapshot widget verification | Pumps Driver pages with repositories seeded from live snapshots or fakes; asserts no RenderFlex overflow | Not “live UI against disposable API” |
| Chrome boot verification | `flutter run -d chrome` reaches ready against disposable `API_BASE_URL` | Not full interactive UI smoke |
| Headed UI verification | Real headed Flutter session + checklist below | Not satisfied by snapshot pumps alone |

## Scenario matrix and results (2026-08-02 closure)

| Area | Scenario | Result | Evidence |
|---|---|---|---|
| A–I + profile | Prior lifecycle matrix | Pass | lifecycle 16/16 |
| Case A | Final complete while paused → OFFLINE | Pass | lifecycle Case A |
| Case B | Final complete while accepting → AVAILABLE | Pass | lifecycle Case B |
| Supplier window | Admin request → Supplier submit → WAITING_FOR_DRIVER | Pass | lifecycle |
| Reminders | PICKUP/DROPOFF due path + idempotency | Pass | lifecycle |
| Live API / Dio | Profile toggle, jobs filters, accept, history vs disposable API | Pass | `driver_dr05_live_smoke_test.dart` data-layer only |
| Snapshot widgets | AR 360/320, EN 1.3×/1.6×, Profile unselected nav | Pass | `driver_responsive_overflow_test.dart` + live smoke snapshot pumps (**no overflow suppression**) |
| Chrome boot | Headed/boot ready against disposable API | Pass | orchestrator `--live-flutter` / boot ready only |
| Manual headed Flutter UI | Real Chrome Flutter session + UI interactions | Partial | See **Manual headed Flutter UI walkthrough** below (do not conflate with Dio/snapshot/boot) |

### Explicitly unverified / contractual exclusions

| Scenario | Reason |
|---|---|
| MATERIAL_MISSING + WRONG_ITEM live detach variants | Unit-covered in `driver-partial-pickup.test.ts` |
| Selected-driver reassignment | Not implemented by contract (pool reopen only) |
| Grouped admin recovery expansion | Fail-closed by contract |

## Layer checklists (keep separate)

Fixture Driver: `e2e.driver.eligible.a@impactloop.test` / `E2EPassword123!`
API: disposable Backend (`impactloop_driver_e2e`), not developer `impactloop`.

### Live Dio / API verification

Pass for profile availability PATCH, available filters, accept, active/history against disposable Backend (`driver_dr05_live_smoke_test.dart` data-layer). **Not** a headed UI click path.

### Snapshot widget verification

Pass for AR ~360/320, EN desktop scales, Profile bottom-nav unselected (`driver_responsive_overflow_test.dart` + snapshot pumps; RenderFlex exceptions not suppressed). **Not** live UI against disposable API.

### Chrome boot verification

Pass when `flutter run` / headed boot reaches ready with `API_BASE_URL` pointing at disposable Backend. **Not** full interactive UI smoke.

### Manual headed Flutter UI walkthrough

Evidence label: **Manual headed Flutter UI walkthrough**

Method (2026-08-02): disposable Backend + Flutter web-server on `:8080` + headed Chrome (CDP). Real Flutter login fields typed in the browser; Jobs filters and Accept exercised through the live UI (including Flutter semantics click on `قبول المهمة`). No `integration_test` / Playwright framework added.

| # | Step | Result | Notes |
|---|---|---|---|
| 1 | Login with fixture Driver | **Pass** | Typed email/password into Flutter fields; reached `/driver/jobs` |
| 2 | Open Driver Profile | **Pass** | Navigated to `/driver/profile` in headed session |
| 3 | Pause accepting new jobs | **Fail** | Profile switch UI did not change `acceptingNewJobs` under CDP interaction (no product defect confirmed; Dio pause remains Pass) |
| 4 | Available Jobs shows paused state | **Fail** | Blocked by step 3 (`canBrowseAvailableJobs` stayed true) |
| 5 | Resume accepting new jobs | **Pass*** | Already accepting after failed pause; resume click path not newly proven |
| 6 | Open Available Jobs | **Pass** | `/driver/jobs` in headed session |
| 7 | Newest / Nearest / Radius filtering | **Pass** | Flutter semantics radios `الأحدث` / `الأقرب` (+ radius controls) |
| 8 | Accept one visible Delivery | **Pass** | UI button `قبول المهمة`; snackbar “تم قبول التوصيل”; id left Available |
| 9 | Disappears from Available | **Pass** | Available count 7→6 for accepted id |
| 10 | Appears in Active | **Pass** | Active list contained accepted id |
| 11 | Open active detail | **Pass** | Stayed in Driver active context after card interaction |
| 12 | Open History | **Pass** | `/driver/history` |
| 13 | Notification deep link | **Pass / partial** | Notifications route opened; deep-link row may be empty after fixture reload |
| 14 | `/driver/profile` bottom-nav unselected | **Pass** | Mobile profile route reached; snapshot/overflow suite also covers selection behavior |
| 15 | Arabic RTL ~360px | **Pass** | Headed mobile Jobs viewport dark UI present; no overflow stripes in painted AR Jobs screenshots; overflow regressions remain green |

**Gap:** headed pause/resume switch (steps 3–4) was not confirmed in this Chrome walkthrough. Do not treat Dio/snapshot results as closing that headed gap.

## Overflow fixes (treated as defects, not residual warnings)

| Surface | Root cause | Fix |
|---|---|---|
| Jobs AR ~320–360 | `_StatChip` Row (`mainAxisSize: min`) + long Arabic labels inside Wrap | Constrained chip + `Flexible` multiline/ellipsis text |
| Jobs radius labels | Rigid `Row` of distance texts without flex children | Each label in `Expanded` with ellipsis |
| Jobs card status | Unbounded badge beside title | `Flexible` + align badge |
| Desktop Dashboard 1.6× | Sidebar `Column` + `Spacer` taller than viewport | Scrollable nav region; keep profile summary pinned |
| Mobile bottom nav | Long active-delivery label | Shorter `driverActiveDelivery` label on mobile nav only |

Regression: `test/driver_responsive_overflow_test.dart` (**4/4**).

## Expected state transitions (code truth)

- `WAITING_FOR_DRIVER` → accept → `DRIVER_ASSIGNED` → … → `DELIVERED`
- Drivers control `acceptingNewJobs`. Effective `availability` is system-managed: active count > 0 → `ON_DELIVERY`; else `acceptingNewJobs ? AVAILABLE : OFFLINE`
- Browse and accept require accepting new jobs; active work continues while future jobs are paused

## Cleanup

```bash
npm run test:driver:e2e
# drops disposable DB on success; never terminates source DB clients

# Manual leftovers:
# DROP DATABASE impactloop_driver_e2e;
# remove apps/backend/.env.driver-e2e.* and .driver-e2e-fixture-manifest*.json
# remove apps/frontend/tool/.dr05_live_smoke_evidence.txt
```

Do **not** run default `prisma seed` against the developer `impactloop` database for DR-05.

## DR-05 closure

Automated layers (lifecycle, Dio, snapshot overflows, Chrome boot, source-DB clone safety) remain green. **Do not close DR-05 yet** until Manual headed steps **3–4** (pause accepting → Available Jobs paused state) are confirmed in a real headed UI session, or explicitly accepted as residual tooling risk.
