# Slice 4E-R2 — Reproducible Artifact and Test-Database Validation

## 1. Decision

The infrastructure prerequisites were successfully provisioned without changing recommendation source or behavior. The complete Python suite passed. The exact backend matrix then produced three post-provisioning test failures, including an actual Slice 4B shadow E2E assertion failure. Per the stop condition, no further validation or source change was attempted.

Final decision: blocked.

## 2. Previous blocker summary

Slice 4E-R established a clean detached Linux clone, a reconciled 66-path canonical manifest, Linux Python 3.11.15 with LightFM 1.17, Linux Node 22.12 dependencies, clean line endings, and disabled serving defaults. It was blocked because ignored accepted artifacts and a seeded PostgreSQL test database were absent.

The two preserved reports had these SHA-256 hashes both before and after R2:

| Path | SHA-256 before | SHA-256 after |
|---|---|---|
| `docs/recommendation/slice-4e-release-readiness-report.md` | `2f5c5f99fccf1828301d5e3008ae4d2ef8054ac656038d8cd07e144506930f7e` | `2f5c5f99fccf1828301d5e3008ae4d2ef8054ac656038d8cd07e144506930f7e` |
| `docs/recommendation/slice-4e-release-readiness-rerun-report.md` | `ce749af9cd8da51def157b2c30029cb8a135c46b9b506d5183c33a91b2b29aad` | `ce749af9cd8da51def157b2c30029cb8a135c46b9b506d5183c33a91b2b29aad` |

## 3. Failure classification

The pre-provisioning failures were rerun only through prerequisite classification. No assertion was changed or skipped.

| Test file or set | Failing outcomes | Missing prerequisite | Dependency | Class | Provisioning action |
|---|---:|---|---|---|---|
| `test_catalog_snapshot.py` | 1 | accepted catalog snapshot | Benchmark A catalog | `MISSING_ACCEPTED_BENCHMARK_ARTIFACT` | verified ignored snapshot |
| `test_evaluation_readiness.py` | 5 | evaluation masks/results | Benchmark A evaluation | `MISSING_ACCEPTED_BENCHMARK_ARTIFACT` | verified ignored outputs |
| `test_expanded_new_user.py` | 13 | expanded artifacts | Benchmark B evaluation | `MISSING_ACCEPTED_BENCHMARK_ARTIFACT` | verified ignored Benchmark B set |
| `test_lightfm_training.py` | 13 | selected model/evaluation files | Benchmark A models | `MISSING_ACCEPTED_BENCHMARK_ARTIFACT` | verified ignored models/results |
| `test_portable_export.py` | 3 | selected Pickles and portable files | Benchmark A portable export | `MISSING_PORTABLE_MODEL_ARTIFACT` | verified ignored source and exports |
| `test_rank_fusion.py` | 1 | frozen casebook | Benchmark B casebook | `MISSING_ACCEPTED_BENCHMARK_ARTIFACT` | verified ignored casebook |
| `test_simulator_invariants.py` | 6 | seed datasets/catalog | Benchmark A simulator | `MISSING_ACCEPTED_BENCHMARK_ARTIFACT` | verified ignored datasets |
| Backend artifact/parity/shadow files | prior artifact failures | portable material/project artifacts | Benchmark A runtime artifacts | `MISSING_PORTABLE_MODEL_ARTIFACT` | verified ignored v1/v2 artifacts |
| Backend learner-home/material integration files | prior database failures | migrated deterministic fixtures | PostgreSQL integration | `MISSING_SEEDED_TEST_DATABASE` | disposable migrated/seeded database |
| `ml-shadow.e2e.test.ts` | at least 1 of 3 final failures | none after provisioning | generated-artifact and database integration | `ACTUAL_TEST_FAILURE` | stop; source investigation belongs outside R2 |
| Two additional backend outcomes | 2 | none after provisioning | exact focused matrix | `ACTUAL_TEST_FAILURE` | runner summary recorded; detailed output was truncated, and the mandated stop prevented a diagnostic rerun |

The final backend run conclusively changed the classification from missing infrastructure to actual test failure.

## 4. Artifact provenance and hashes

The dirty checkout was used read-only. Exact ignored artifacts were copied temporarily because byte-identical regeneration would require the immutable ignored Benchmark A catalog input, would change timestamp/timing-bearing files, and could rerun a prohibited hyperparameter search. No environment, cache, credential, database file, or unrelated output was copied.

Key accepted logical hashes:

- Benchmark A catalog: `94c3165783ba4fca06d959f9b9d566434793c03f79858c089ab9cbe26dcd4186`, schema `impactloop-catalog-snapshot-v2`, 161 materials and 29 projects.
- Seed 11 dataset: `99523dc1037e076b7472358581d7388cec3eb68b777555f8000e6d79879f4eb4`.
- Seed 29 dataset: `71307d2e807d2af01833871c43e34e144b06f62dd4674ff825d85585bc035dc5`.
- Seed 47 dataset: `86c564cd0aba4b49cd2d4a60e280f2a55f052aff96c0cfd84eeb62c589c8c697`.
- Benchmark B extension/training/user hashes: `8f1abf55b347c33cde3942aefb710dc7c5e79ed4f7fd3f5f9920ece9a35eed5c`, `8d167b4768d62dd26c9539fbcd8a0bce463516deb84ce5d716778e26ebfc9528`, and `2a8c1e2c6cd9d56795abd7fc0a4aae40bf17dab36e0231622ffe7c3454712cd3`.

Portable v2 validation:

| Domain | Feature schema | Dimension | Mapping hash | Content hash | File SHA-256 |
|---|---|---:|---|---|---|
| material | `runtime-approved-features-v2` | 16 | `9134fa696422546d1edafc2c88defcdacee39b19801e45c6094d6ce3bd8f82e3` | `f88bb0741b7b66ded580e28668b70037412ff634d0422aa08da842e2fabd1c17` | `f9bffaaca76905646eef0a0cf92e48eded6e761088ccc65b016c6c5b766cb4b2` |
| project | `runtime-approved-features-v2` | 32 | `6e06d51dda79194108f14bdd89694819cd603ae5e72b7d8e44ae24bb19685448` | `2ce13d6f2a2418fc831b548ed9d6021f275da6254b68e6115b0af4de02f402d5` | `46f42a1d727e7046497fcdf8624359aae7dcc1a29e722735aeff017e9612582e` |

Both used artifact version `impactloop-lightfm-portable-v1`, the accepted snapshot/training hashes, correct domains and finite dimensions, and excluded prohibited features. The parity fixture SHA-256 was `71be03c6dc2a0c4378e2983f0081bc24e007a94e256ee609eb90b37f71219735`.

## 5. Benchmark A/B separation

Benchmark A remained tied to its immutable verified real read-only privacy-safe catalog snapshot; no current-catalog substitute was used. Seed 47 was not used for tuning. Benchmark B remained fixed at Seed 101, evaluation-only, and was never supplied as a production portable artifact.

## 6. Artifact bootstrap commands

The accepted source pipeline and frozen configuration were inspected. For this exact-evidence rerun, the approved fallback strategy was used: verify hashes and metadata in the dirty checkout, copy the exact 79-file ignored `ml/recommendation/generated` set into the same ignored path in the isolated clone, execute tests, then remove it. No hyperparameter search, simulator retuning, production-data access, or artifact regeneration occurred.

## 7. Disposable PostgreSQL setup

- Server: PostgreSQL 18.4 with PostGIS 3.6.4, installed only under `/tmp`.
- Exposure: localhost only, port 55432, trust authentication in a disposable cluster.
- Database: uniquely named test-only database `impactloop_slice_4e_r2`.
- Migration command: `npm exec -w apps/backend -- prisma migrate deploy`.
- Migration state: all 52 repository migrations applied.
- Fixture command: `npm run prisma:seed -w apps/backend`.
- Seed state: 300 users, 159 materials, 30 learning projects, 21 material likes, and 10 material views.

The initial plain server correctly failed the first migration because PostGIS was absent. The failed cluster was destroyed, PostGIS was added to the temporary server environment, and a fresh cluster migrated successfully. No schema, migration, or seed source was modified.

Pre-test and post-test aggregate counts were identical. All recommendation request, generation, impression, candidate-trace, event-outbox, and action tables remained at zero. No test-created behavior or diagnostic rows persisted.

## 8. Python results

Command: `python -m pytest ml/recommendation/tests`

```text
collected: 66
passed: 66
failed: 0
errors: 0
skipped: 0
duration: 12.96s
exit code: 0
```

This covers viability, catalog privacy, simulation, evaluation, LightFM training, expanded new-user evaluation, portable export, and rank-fusion parity.

## 9. Backend results

The exact 17-file globbed matrix was executed against the disposable database and verified artifacts.

```text
files: 17
tests: 151
passed: 148
failed: 3
skipped: 0
cancelled: 0
duration: 18.039845117s
exit code: 1
```

The captured actual failure was `apps/backend/src/modules/recommendations/ml-shadow.e2e.test.ts:247`: the Slice 4B local learner-home shadow validation asserted a truthy feature-coverage expression and received false. Its diagnostic showed condition coverage about 0.9983 but zero concept, difficulty, and component coverage for relevant domains. Two other failing outcomes were included in the runner summary but their detail was outside the retained truncated output. R2 did not rerun them because the instruction requires an immediate stop once an actual assertion/implementation failure remains after provisioning.

## 10. Typecheck results

R2 did not rerun repository-wide or focused typechecks after the actual backend failure. The previous clean rerun remains the latest evidence: repository-wide typecheck exited 2 only for `apps/backend/src/modules/admin-people/admin-people.service.ts:52` (`location` may be null), a path outside the 66-file recommendation manifest. R2 cannot claim the required focused graph exit 0, so this gate is incomplete.

## 11. Cleanup proof

The disposable database was dropped and PostgreSQL stopped. Its cluster, server environment, socket, and log were removed. All copied generated artifacts, Python caches, pytest cache, and generated Prisma client files were removed from the clone.

After cleanup:

- pre-report `git status --short --untracked-files=all` contained exactly 67 intended paths;
- `git diff --check` exited 0;
- no `.pkl`, `.parquet`, `.npy`, `.npz`, `.joblib`, or `.pyc` remained under the validated source trees;
- `git ls-files --others --exclude-standard` contained only accepted untracked source/reports;
- dependency lock diff was clean;
- `docs/recommendation/final-recommendation-architecture.md` remained unchanged;
- nothing was staged or committed.

## 12. Final diff manifest

- Original canonical accepted paths: 66.
- First rerun report: `docs/recommendation/slice-4e-release-readiness-rerun-report.md`.
- R2 report: `docs/recommendation/slice-4e-release-readiness-r2-report.md`.
- Final unique changed paths: 68.
- Group counts after adding both rerun reports: 33, 5, 6, 12, and 12.

The explicitly unrelated `docs/recommendation/final-recommendation-architecture.md` and all unrelated/generated paths remain excluded.

## 13. Configuration and serving state

No recommendation source or configuration was changed during R2. Static evidence and the passing Python/backend flag tests retain these defaults:

```text
RECOMMENDATION_ML_SHADOW_ENABLED=false
RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED=false
RECOMMENDATION_ML_PROJECT_SERVING_ENABLED=false
```

Artifact paths default empty. Material fusion remains shadow-only, projects remain shadow-evaluation-only, and the deterministic learner-home response remains authoritative.

## 14. Commit groups and commands

No group is approved for staging while the actual backend failure remains. Counts include both rerun reports in Group 5.

| Group | Files | Dependencies | Direct validation/buildability | Recommendation |
|---|---:|---|---|---|
| 1 — ML offline foundation | 33 | none | Python suite passed with verified prerequisites | Structurally buildable; message remains accurate |
| 2 — Portable runtime scoring | 5 | Group 1 | Portable export and parity passed in the complete matrices | Buildable after Group 1, but safest with Groups 3–4 |
| 3 — Recent intent and fusion | 6 | Group 2 | Python fusion passed; TS matrix has unresolved failures | Not independently release-ready |
| 4 — Runtime alignment/shadow | 12 | Groups 2–3 | Actual `ml-shadow.e2e` failure | Not buildable as an accepted green boundary |
| 5 — Historical documentation | 12 | documents Groups 1–4 | No build output; preserves blocked evidence | Last only, after technical gates pass |

Safe cherry-pick order remains 1, then merged 2–4, then 5. Merging 2–4 avoids temporarily under-tested runtime boundaries. Proposed messages remain accurate, but no command should be executed:

```bash
git add -- .gitignore ml/recommendation/__init__.py ml/recommendation/pyproject.toml ml/recommendation/requirements-lock.txt ml/recommendation/requirements-linux-lock.txt ml/recommendation/viability.py ml/recommendation/catalog_export_windows.ts ml/recommendation/catalog_snapshot.py ml/recommendation/privacy.py ml/recommendation/schemas.py ml/recommendation/config/simulation.yaml ml/recommendation/candidate_universe.py ml/recommendation/simulator.py ml/recommendation/generate_dataset.py ml/recommendation/tests/fixtures/catalog_fixture.json ml/recommendation/tests/test_catalog_snapshot.py ml/recommendation/tests/test_simulator_invariants.py ml/recommendation/baselines.py ml/recommendation/evaluation_splits.py ml/recommendation/feature_audit.py ml/recommendation/features.py ml/recommendation/evaluate.py ml/recommendation/scenario_evaluation.py ml/recommendation/tests/test_evaluation_readiness.py ml/recommendation/model_io.py ml/recommendation/train_lightfm.py ml/recommendation/recommend.py ml/recommendation/tests/test_lightfm_smoke.py ml/recommendation/tests/test_lightfm_training.py ml/recommendation/tests/test_lightfm_viability.py ml/recommendation/expanded_catalog.py ml/recommendation/run_expanded.py ml/recommendation/tests/test_expanded_new_user.py

git add -- ml/recommendation/export_portable_model.py ml/recommendation/portable_model_schema.json ml/recommendation/tests/test_portable_export.py apps/backend/src/modules/recommendations/ml-model-artifact.ts apps/backend/src/modules/recommendations/ml-lightfm-scorer.ts ml/recommendation/short_term.py ml/recommendation/tests/test_rank_fusion.py apps/backend/src/modules/recommendations/short-term-intent.ts apps/backend/src/modules/recommendations/recent-intent-confidence.ts apps/backend/src/modules/recommendations/material-rank-fusion.ts apps/backend/src/modules/recommendations/material-rank-fusion.test.ts apps/backend/.env.example apps/backend/env.example apps/backend/src/config/env.ts apps/backend/src/modules/learner-home/learner-home.repository.ts apps/backend/src/modules/learner-home/learner-home.service.ts apps/backend/src/modules/learner-home/learner-home.types.ts apps/backend/src/modules/materials/materials.repository.ts apps/backend/src/modules/materials/materials.service.ts apps/backend/src/modules/recommendations/ml-shadow.service.ts apps/backend/src/modules/recommendations/ml-shadow.test.ts apps/backend/src/modules/recommendations/ml-shadow.e2e.test.ts apps/backend/src/modules/recommendations/ml-runtime-alignment.test.ts

git add -- ml/recommendation/slice-0c-linux-viability-report.md docs/recommendation/slice-1-synthetic-simulator-report.md docs/recommendation/slice-2-baseline-evaluation-report.md docs/recommendation/slice-3-lightfm-evaluation-report.md docs/recommendation/slice-3b-expanded-new-user-report.md docs/recommendation/slice-4a-shadow-integration-report.md docs/recommendation/slice-4b-development-shadow-report.md docs/recommendation/slice-4c-runtime-alignment-report.md docs/recommendation/slice-4d-material-rank-fusion-report.md docs/recommendation/slice-4e-release-readiness-report.md docs/recommendation/slice-4e-release-readiness-rerun-report.md docs/recommendation/slice-4e-release-readiness-r2-report.md
```

Suggested messages remain:

1. `feat(recommendations): add offline LightFM evaluation pipeline`
2. `feat(recommendations): add portable scoring intent fusion and shadow integration`
3. `docs(recommendations): document LightFM evaluation and shadow integration`

## 15. Remaining blockers

1. Diagnose the three actual backend failures from the fully provisioned exact matrix, beginning with `ml-shadow.e2e.test.ts:247`, outside Slice 4E-R2.
2. Repeat the exact backend matrix after an separately authorized resolution; all tests must pass.
3. Obtain a focused recommendation integration-graph typecheck exit 0 and rerun the repository typecheck with a conclusive exit code.

No source change was made because R2 explicitly forbids broadening into implementation fixes.

## 16. Final decision

SLICE_4E_RELEASE_READINESS_BLOCKED
