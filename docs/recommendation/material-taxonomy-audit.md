# Material taxonomy coverage and staleness audit (RP-02.5)

Read-only readiness command for supplier material concept assignments.

## Authoritative invocation

```bash
cd apps/backend
npx tsx scripts/material-taxonomy-audit.ts --json
npx tsx scripts/material-taxonomy-audit.ts --check --json
```

Package script convenience (single `--` only):

```bash
npm run taxonomy:material-audit -- --json
npm run taxonomy:material-audit -- --check --json
```

## What it does

- Loads category ownership and the taxonomy registry once.
- Pages materials with keyset pagination inside a Prisma `RepeatableRead` transaction.
- Computes desired assignments with the **exact** live persistence path:
  `buildEvidenceScopedAssignmentRegistry` → `resolveMaterialConceptAssignments` → `toFreeCreateConceptIds`.
- Classifies stored `MaterialConcept` rows against that desired set.
- Reports registry/alias health, reviewed-rule targets, and MaterialType coverage.
- Emits privacy-safe samples (hashed evidence; no raw titles or supplier PII).
- Does **not** repair, backfill, or mutate any rows.

## Populations

| Population | Statuses |
| --- | --- |
| Operational / `--check` gate | `AVAILABLE`, `PENDING_RESERVATION`, `RESERVED`, `UNAVAILABLE` |
| Historical (reported only) | `REUSED` |
| Publicly discoverable (status set from public read path) | `AVAILABLE`, `PENDING_RESERVATION`, `RESERVED` |

Public list/detail also require an active `MATERIAL`/`BOTH` category; that is a category filter, not an extra MaterialStatus.

## Exit codes

| Code | Meaning |
| --- | ---: |
| 0 | Report completed, or `--check` passed |
| 1 | Audit completed and `--check` found critical failures |
| 2 | CLI usage / argument error |
| 3 | Execution, database, timeout, or unexpected failure |

## Critical `--check` policy

For every operational material whose desired assignment resolves successfully, the persisted concept ID set must equal the exact desired set. Failures include missing/stale/extra/unexpected form rows and blockers. Family-only is healthy when desired is family-only.

Optional form coverage is reported; unknown form evidence alone does not fail the gate.

## Flags

- `--json`
- `--check`
- `--sample-limit <n>` (1–100, default 20; included in `contentHash`)
- `--batch-size <n>` (1–500, default 100; execution-only, not hashed)
- `--timeout-ms <n>` (default 60000, max 300000; execution-only)
- `--help`

Write flags (`--repair`, `--apply`, `--backfill`, `--fix`) are rejected.

## Activation boundary

A green audit does **not** activate taxonomy-backed recommendation scoring or ML serving. Historical repair remains a separate explicit decision.
