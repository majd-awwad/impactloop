# Slice 4E-R — Clean Worktree Validation and Commit Preparation

Date: 2026-07-19

## 1. Original blockers

The original Slice 4E decision remains historical evidence: `SLICE_4E_RELEASE_READINESS_BLOCKED`. Its two environment blockers were reproduced and isolated from recommendation behavior: the `/mnt/c` checkout had repository-wide CRLF churn, and its Python/Node dependencies were Windows-native. Slice 4D remains `SLICE_4D_MATERIAL_RANK_FUSION_PASSED`; this rerun did not change recommendation behavior.

## 2. Clean-worktree construction

| Item | Value |
| --- | --- |
| Source repository | `/mnt/c/UNIVERCITY/03_Projects/Software Grad Project/impactloop` |
| Source HEAD | `575738cd0557c937d555ef4d8dd58515f8f06b25` |
| Source branch | `feature/recommendation` |
| Validation clone | `/tmp/impactloop-slice-4e-validation` on Linux ext4 |
| Validation HEAD | `575738cd0557c937d555ef4d8dd58515f8f06b25` |
| Validation state | detached HEAD |
| Local line-ending config | `core.autocrlf=input` |

The source checkout was not restored, cleaned, normalized, staged, or otherwise modified. A local `--no-hardlinks --no-checkout` clone was checked out detached at the same HEAD. Only manifest paths were transferred with `rsync --files-from`; copied text files alone were normalized to LF. Git metadata, `node_modules`, Python environments, generated recommendation data, and unrelated paths were not copied.

## 3. Canonical manifest and resolved count

The five exact `git add --` blocks in the original Slice 4E report contain 66 entries and 66 unique paths. Group counts are 33, 5, 6, 12, and 10. The per-file inventory also has 66 paths, but it includes the explicitly excluded `docs/recommendation/final-recommendation-architecture.md` and predates the Slice 4E report row. Replacing that excluded path with `docs/recommendation/slice-4e-release-readiness-report.md` reconciles the prose exactly:

```text
65 accepted Slice 0–4D files + 1 Slice 4E report = 66 canonical paths
```

The machine-readable manifest used for transfer is `/tmp/impactloop-slice-4e-accepted-manifest.txt`, outside the clone. Before this rerun report was created, the sorted manifest and `git status --porcelain` path set had no difference and both counted 66.

Canonical paths by group:

```text
Group 1 (33)
.gitignore
ml/recommendation/__init__.py
ml/recommendation/pyproject.toml
ml/recommendation/requirements-lock.txt
ml/recommendation/requirements-linux-lock.txt
ml/recommendation/viability.py
ml/recommendation/catalog_export_windows.ts
ml/recommendation/catalog_snapshot.py
ml/recommendation/privacy.py
ml/recommendation/schemas.py
ml/recommendation/config/simulation.yaml
ml/recommendation/candidate_universe.py
ml/recommendation/simulator.py
ml/recommendation/generate_dataset.py
ml/recommendation/tests/fixtures/catalog_fixture.json
ml/recommendation/tests/test_catalog_snapshot.py
ml/recommendation/tests/test_simulator_invariants.py
ml/recommendation/baselines.py
ml/recommendation/evaluation_splits.py
ml/recommendation/feature_audit.py
ml/recommendation/features.py
ml/recommendation/evaluate.py
ml/recommendation/scenario_evaluation.py
ml/recommendation/tests/test_evaluation_readiness.py
ml/recommendation/model_io.py
ml/recommendation/train_lightfm.py
ml/recommendation/recommend.py
ml/recommendation/tests/test_lightfm_smoke.py
ml/recommendation/tests/test_lightfm_training.py
ml/recommendation/tests/test_lightfm_viability.py
ml/recommendation/expanded_catalog.py
ml/recommendation/run_expanded.py
ml/recommendation/tests/test_expanded_new_user.py

Group 2 (5)
ml/recommendation/export_portable_model.py
ml/recommendation/portable_model_schema.json
ml/recommendation/tests/test_portable_export.py
apps/backend/src/modules/recommendations/ml-model-artifact.ts
apps/backend/src/modules/recommendations/ml-lightfm-scorer.ts

Group 3 (6)
ml/recommendation/short_term.py
ml/recommendation/tests/test_rank_fusion.py
apps/backend/src/modules/recommendations/short-term-intent.ts
apps/backend/src/modules/recommendations/recent-intent-confidence.ts
apps/backend/src/modules/recommendations/material-rank-fusion.ts
apps/backend/src/modules/recommendations/material-rank-fusion.test.ts

Group 4 (12)
apps/backend/.env.example
apps/backend/env.example
apps/backend/src/config/env.ts
apps/backend/src/modules/learner-home/learner-home.repository.ts
apps/backend/src/modules/learner-home/learner-home.service.ts
apps/backend/src/modules/learner-home/learner-home.types.ts
apps/backend/src/modules/materials/materials.repository.ts
apps/backend/src/modules/materials/materials.service.ts
apps/backend/src/modules/recommendations/ml-shadow.service.ts
apps/backend/src/modules/recommendations/ml-shadow.test.ts
apps/backend/src/modules/recommendations/ml-shadow.e2e.test.ts
apps/backend/src/modules/recommendations/ml-runtime-alignment.test.ts

Group 5 (10)
ml/recommendation/slice-0c-linux-viability-report.md
docs/recommendation/slice-1-synthetic-simulator-report.md
docs/recommendation/slice-2-baseline-evaluation-report.md
docs/recommendation/slice-3-lightfm-evaluation-report.md
docs/recommendation/slice-3b-expanded-new-user-report.md
docs/recommendation/slice-4a-shadow-integration-report.md
docs/recommendation/slice-4b-development-shadow-report.md
docs/recommendation/slice-4c-runtime-alignment-report.md
docs/recommendation/slice-4d-material-rank-fusion-report.md
docs/recommendation/slice-4e-release-readiness-report.md
```

This Slice 4E-R report is a new 67th changed path and belongs with documentation if a later green rerun approves commits.

## 4. Unrelated-file exclusion proof

Before creating this report:

- `git status --porcelain` contained exactly the 66 canonical paths.
- `comm -3` between the canonical manifest and changed paths returned no output.
- `git diff --exit-code -- docs/recommendation/final-recommendation-architecture.md` returned exit 0.
- No package manifest or package lock changed during dependency installation.
- No repository-wide EOL normalization occurred.

## 5. Generated-artifact audit

Both required tracked scans returned no matches:

```text
git ls-files | grep -Ei '\.(pkl|parquet|npy|npz|joblib)$'
git ls-files | grep -Ei 'generated|benchmark-b|catalog-snapshot|casebook'
```

No recommendation generated artifact was copied or created. In particular, the clone contains no catalog snapshot, simulator Parquet, model Pickle, portable model JSON, parity fixture, Benchmark B output, or casebook. This is also the cause of most test failures below.

`npm run prisma:generate` created the normal ignored Prisma client under `apps/backend/src/generated/prisma`, required for backend loading. Pytest created ignored cache/bytecode. These are ignored validation/build products, not recommendation artifacts, and do not appear in `git ls-files --others --exclude-standard` or the changed-path set. Source, explicit locks, structural fixtures, and reviewed reports are not ignored.

## 6. Python environment recreation

Micromamba 2.8.1 recreated `/tmp/impactloop-slice-4e-python` directly from the unchanged explicit Linux lock. The environment contains 130 Linux packages and no Windows executable reuse.

```text
Python 3.11.15
LightFM 1.17
NumPy 1.26.4
SciPy 1.13.1
pandas 2.2.3
scikit-learn 1.5.2
PyArrow 18.1.0
pytest 8.3.5
```

Imports of all required modules passed. Micromamba warned that the explicit URL lock does not carry package checksums in local repodata records; it nevertheless installed the exact URL/build entries without solving or upgrading versions.

## 7. Node dependency recreation

The first `npm ci` correctly failed under system Node 21.7.0 because Prisma 7.8 requires Node 20.19+, 22.12+, or 24+. The rerun then used official Linux Node 22.12.0 and the unchanged root `package-lock.json`:

```text
npm ci: exit 0
294 packages installed
@esbuild/linux-x64 selected
package-lock.json unchanged
```

Npm reported three moderate audit findings; no audit fix or dependency update was run. Prisma client generation completed with exit 0. The focused loader test reached recommendation assertions, proving `tsx`/esbuild loaded correctly.

## 8. Python validation result

Command:

```text
/tmp/impactloop-slice-4e-python/bin/python -m pytest ml/recommendation/tests
```

Result:

```text
exit: 1
collected: 66
passed: 24
failed: 37
errors: 5
skipped: 0
duration: 2.42s (pytest summary)
```

The first failure is `test_real_snapshot_schema_privacy_hash_and_ignore`, which cannot open `ml/recommendation/generated/catalog-snapshot/materials.json`. All 37 failures and 5 setup errors trace to absent ignored catalog snapshots, frozen simulator/evaluation outputs, trained Pickles, portable exports, or Benchmark B/casebook artifacts. LightFM smoke and all five viability tests passed in the recreated Linux environment.

The missing outputs were not copied or regenerated because this rerun explicitly forbids copying generated artifacts and regenerating accepted benchmark outputs merely to satisfy tests. Therefore the committed Python suite is not clean-checkout self-contained.

## 9. Backend validation result

Command used Linux Node 22.12.0, a non-secret placeholder `DATABASE_URL`, and the requested 17 test files.

```text
exit: 1
test files: 17
file-level pass: 10
file-level fail: 7
skipped: 0
duration: 7065.46ms
```

Failure disposition:

- `material-rank-fusion.test.ts`, `ml-shadow.test.ts`, and the scoring portion of `ml-runtime-alignment.test.ts` require absent ignored portable JSON/parity/casebook artifacts. A direct focused fusion run confirmed two assertions pass before the third fails on missing `material-hybrid-runtime-v2.json`; direct shadow unit execution reported 1 pass and 6 missing-artifact-derived failures.
- `ml-shadow.e2e.test.ts`, the view-invalidation portion of `ml-runtime-alignment.test.ts`, `learner-home.consolidation.test.ts`, `learner-home.outbox-runtime.test.ts`, and `materials.discovery.test.ts` require a reachable seeded PostgreSQL test database. No repository script or isolated test database was provided by the accepted change-set. Their first database operation failed before behavioral assertions.
- Ten learner-home unit/regression files passed under Linux.

No failing suite was omitted. The failures are environment/fixture provisioning failures, not evidence of changed recommendation assertions, but a pass cannot be claimed.

## 10. Typecheck result

The actual repository script was run with Linux Node 22.12.0:

```text
npm run backend:typecheck
exit: 2
```

The sole diagnostic was:

```text
apps/backend/src/modules/admin-people/admin-people.service.ts:52:16
TS18049: 'location' is possibly 'null' or 'undefined'.
```

That path is absent from the 66-path canonical manifest and unchanged in the clean clone. It is the known unrelated pre-existing error and was not modified. The run is conclusive but not green.

## 11. Diff and line-ending gate

Before adding this rerun report:

```text
git diff --check: exit 0
changed paths: 66
manifest set difference: empty
accepted files with CRLF: 0
final-recommendation-architecture.md diff: none
package-lock/package manifests changed by install: none
```

The nine tracked substantive files show 171 insertions and 2 deletions; the remaining 57 canonical paths are untracked accepted source/tests/reports. Git does not include untracked files in `git diff --stat`, so status/manifest comparison is the authoritative complete gate. After this report, the only additional path is this requested report. Nothing is staged.

## 12. Configuration and serving state

Static review and the passing defaults assertion confirm:

```text
RECOMMENDATION_ML_SHADOW_ENABLED=false
RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED=false
RECOMMENDATION_ML_PROJECT_SERVING_ENABLED=false
RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH=
RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH=
```

`env.ts` independently defaults the booleans to false and paths to empty. Serving-flag searches find only configuration and tests; there is no production serving consumer. Test overrides use save/restore cleanup. Material fusion remains inside material shadow diagnostics, project remains shadow evaluation only, and the learner-home caller returns its deterministic response rather than a shadow ranking.

## 13. Architecture, privacy, and security revalidation

Static verification confirms:

- scorer candidates are rejected above 200;
- candidate keys must be unique and exactly equal the authoritative active candidate set;
- concept hydration separately rejects material/project lists above 200 and uses one material batch query plus one project batch query, not an N+1 loop;
- backend scoring is pure TypeScript and starts no Python process;
- missing/invalid artifacts are caught and return the original response;
- artifact promises, including rejected loads, are cached by domain/path so failures do not retry per request;
- authenticated newly recorded views alone invalidate the relevant learner cache; anonymous, deduplicated, and failed views do not reach that invalidation branch.

The accepted diff contains only reviewed template connection values/secrets, an invented URI-redaction probe, privacy-safe hashes, synthetic dates/keys, and controlled structural fixtures. No real credential, email, phone, raw real-user ID, full history, model embedding, demo-account name, or machine-specific path was found. Validation used a non-secret placeholder database URL that was not written to the repository.

## 14. Commit-group dependency validation

| Group | Files | Prior dependency | Required tests after commit | Builds at that point | Recommendation |
| --- | ---: | --- | --- | --- | --- |
| 1 — ML offline foundation | 33 | None | complete Python suite | Source/import viability works, but suite is not clean-checkout runnable without ignored catalog/training/evaluation artifacts | Message remains accurate; not commit-ready until fixtures are provisioned reproducibly |
| 2 — Portable runtime scoring | 5 | Group 1 model/export conventions | portable export and TypeScript loader/scorer parity | TypeScript source is structurally buildable, but its only direct Python export test and later TS parity tests require ignored Group 1 outputs | Message accurate; direct coverage is insufficient at this boundary |
| 3 — Recent intent and fusion | 6 | Group 2 scorer/artifact contract | Python fusion parity and TS fusion scenarios | Source is structurally buildable after Group 2, but both committed tests depend on ignored Benchmark B/portable outputs | Message accurate; boundary is test-broken in a clean checkout |
| 4 — Runtime alignment/shadow | 12 | Groups 2–3 plus existing learner-home/material runtime | shadow, parity, alignment, database integration, learner-home/material regressions, typecheck | Imports resolve after Groups 2–3; tests still require ignored portable outputs and a seeded database; repository typecheck retains one unrelated error | Message accurate; not independently green |
| 5 — Historical documentation | 10 | Conceptual Groups 1–4 | link/path/diff review | Documentation itself builds, but it would document a change-set whose clean validation is red | Message accurate; retain blocked evidence |

No file should move merely to conceal the missing-fixture problem. Group 2 does not have sufficient direct runnable tests before Group 4: `ml-shadow.test.ts` is correctly in Group 4 because it imports Group 3 code, while Group 2’s Python test requires missing generated model inputs. Prefer merging Groups 2–4 into one portable runtime, intent, fusion, and shadow-integration commit if the fixture/provisioning contract is fixed; this avoids three commits whose tests cannot independently pass. Group 1 may remain separate only after its clean-checkout data-generation/fixture procedure is approved and demonstrated.

## 15. Exact files ready for commit

No file is approved for commit by this rerun because mandatory Python/backend/typecheck gates are not green. The exact candidate set remains the 66 canonical paths listed in Section 3; this report would become the 67th documentation path after a later passing rerun. `docs/recommendation/final-recommendation-architecture.md`, generated recommendation artifacts, ignored build/cache output, dependencies, and all unrelated files remain excluded.

## 16. Remaining blockers

1. Define an approved clean-checkout fixture strategy for the frozen catalog snapshot, Benchmark A training/evaluation artifacts, portable/parity fixtures, and Benchmark B casebook inputs. The present tests require them, while repository policy ignores them and this rerun prohibited copying/regenerating them.
2. Provision a reproducible isolated PostgreSQL test database with the required migrations and seed data, or separate database-dependent e2e suites from self-contained focused tests with an explicit supported command.
3. Rerun all 66 Python tests and all 17 backend files after those prerequisites are approved; both must pass.
4. Resolve or formally gate the unrelated `admin-people.service.ts:52` error so the repository typecheck exits 0. Do not fix it in a recommendation commit.
5. Re-run the final 67-path manifest/diff/line-ending/generated-artifact gate and keep all paths unstaged until approval.

## 17. Final decision

The CRLF and Linux-runtime blockers are resolved in isolation, and the accepted recommendation behavior remains unchanged. Release readiness is still blocked because the complete clean-checkout test matrix depends on unprovisioned ignored artifacts and a seeded database, and repository typecheck exits 2 on the known unrelated error.

SLICE_4E_RELEASE_READINESS_BLOCKED
