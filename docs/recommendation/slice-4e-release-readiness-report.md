# Slice 4E — Recommendation Change-Set Consolidation and Release Readiness

Date: 2026-07-19

## Decision

`SLICE_4E_RELEASE_READINESS_BLOCKED`

Slices 0 through 4D retain their accepted engineering results, including `SLICE_4D_MATERIAL_RANK_FUSION_PASSED`. The recommendation design is internally consistent and keeps the visible deterministic learner-home response available and unchanged. This checkout is not ready to commit or release, however, because a fresh Slice 4E validation could not run in the available WSL environment and the working tree contains repository-wide line-ending churn.

No recommendation behavior, weight, confidence gate, hyperparameter, catalog row, taxonomy mapping, generated artifact, or serving default was changed in Slice 4E. No files were staged or committed. The only Slice 4E-created file is this report.

## Repository inventory and separation

The required inventory commands were run. An initial `git status` incorrectly appeared clean because the index stat cache was stale. `git update-index --refresh` (read-only with respect to file content and staging) exposed the actual state:

- 1,185 tracked files report modified, overwhelmingly because LF content in `HEAD` is CRLF in the worktree.
- 56 recommendation files are untracked and not ignored.
- `git diff --ignore-space-at-eol --name-only` reduces the tracked set to 10 files with substantive differences.
- Nine of those ten are recommendation changes. `docs/recommendation/final-recommendation-architecture.md` contains table-format-only changes unrelated to Slices 0–4D and must be left untouched.
- `.gitignore` is a recommendation change but is also affected by the repository-wide line-ending conversion.
- `git diff --check` fails extensively on CRLF-induced trailing-whitespace reports. This must be resolved outside the recommendation commits before staging.
- No source file was classified as recommendation work merely because its line endings changed.

Classification summary:

| Classification | Disposition |
| --- | --- |
| `ACCEPTED_RECOMMENDATION_CHANGE` | 47 untracked offline/runtime/test files, 8 substantive tracked integration/configuration files, and `.gitignore`; commit in Groups 1–4 |
| `ACCEPTED_RECOMMENDATION_DOCUMENTATION` | 9 historical Slice reports; commit in Group 5 |
| `GENERATED_IGNORED_ARTIFACT` | Local environments, caches, Parquet, snapshots, mappings, models, portable JSON, Benchmark B, casebooks, and evaluation outputs under ignored paths; never stage |
| `UNRELATED_PRE_EXISTING_CHANGE` | 1,176 EOL-only tracked changes plus the formatting-only architecture-document change; leave untouched |
| `REQUIRES_MANUAL_REVIEW` | The line-ending conversion, unavailable Linux Python environment, platform-mismatched Node dependencies, and unrerun test/typecheck gates |

## Slice-to-file traceability

“Required” means required for the final accepted source/test/evidence architecture. “Covered” identifies direct automated coverage; test and report files are self/evidence coverage. Every row below should be committed unless explicitly marked otherwise. Group names are defined in the commit plan.

### Tracked substantive files

| Path | Purpose | Owning slice | Class | Covered | Required | Commit | Group |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `.gitignore` | Excludes ML environments, caches, and generated outputs | 0C–4A | Offline boundary | Direct ignore audit | Yes | Yes, after EOL cleanup | 1 |
| `apps/backend/.env.example` | Safe disabled ML defaults | 4A | Production config | Shadow tests/static audit | Yes | Yes | 4 |
| `apps/backend/env.example` | Safe disabled ML defaults and empty artifact paths | 4A | Production config | Shadow tests/static audit | Yes | Yes | 4 |
| `apps/backend/src/config/env.ts` | Parses shadow, serving, and artifact-path flags with false/empty defaults | 4A | Production | `ml-shadow.test.ts` | Yes | Yes | 4 |
| `apps/backend/src/modules/learner-home/learner-home.repository.ts` | Recent-event hydration and two bounded concept batch reads | 4C | Production | runtime alignment/e2e/learner-home tests | Yes | Yes | 4 |
| `apps/backend/src/modules/learner-home/learner-home.service.ts` | Invokes fail-safe material/project shadow diagnostics without replacing response | 4A/4C/4D | Production | shadow e2e and learner-home regressions | Yes | Yes | 4 |
| `apps/backend/src/modules/learner-home/learner-home.types.ts` | Adds bounded recent-event context contract | 4A | Production | compile and learner-home tests | Yes | Yes | 4 |
| `apps/backend/src/modules/materials/materials.repository.ts` | Reports whether an authenticated view was newly recorded | 4C | Production | runtime alignment/material discovery | Yes | Yes | 4 |
| `apps/backend/src/modules/materials/materials.service.ts` | Invalidates only the viewing learner after a newly recorded authenticated view | 4C | Production | runtime alignment/material discovery | Yes | Yes | 4 |
| `docs/recommendation/final-recommendation-architecture.md` | Pre-existing final deterministic architecture document; worktree change only reformats a table | Not Slice 0–4D | Documentation | N/A | No for this change-set | **No** | Leave untouched |

### Backend runtime and tests

| Path | Purpose | Owning slice | Class | Covered | Required | Group |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/backend/src/modules/recommendations/ml-model-artifact.ts` | Portable schema/hash/domain/feature validator and loader | 4A/4C | Production | shadow/alignment/fusion tests | Yes | 2 |
| `apps/backend/src/modules/recommendations/ml-lightfm-scorer.ts` | Pure TypeScript LightFM scoring and normalized diagnostic blend | 4A | Production | parity/shadow/alignment tests | Yes | 2 |
| `apps/backend/src/modules/recommendations/short-term-intent.ts` | Bounded recent-intent profile and scores | 4A | Production | parity/shadow/fusion tests | Yes | 3 |
| `apps/backend/src/modules/recommendations/recent-intent-confidence.ts` | NONE/LOW/MEDIUM/HIGH policy | 4D | Production | fusion tests | Yes | 3 |
| `apps/backend/src/modules/recommendations/material-rank-fusion.ts` | Confidence-gated material-only rank fusion | 4D | Production shadow | fusion tests | Yes | 3 |
| `apps/backend/src/modules/recommendations/ml-shadow.service.ts` | Cached, fail-safe shadow orchestration and privacy-safe diagnostics | 4A–4D | Production shadow | shadow/e2e/alignment/fusion tests | Yes | 4 |
| `apps/backend/src/modules/recommendations/ml-shadow.test.ts` | Artifact, parity, defaults, fallback, bounds, cache, and timing tests | 4A | Test | Self | Yes | 4 |
| `apps/backend/src/modules/recommendations/ml-shadow.e2e.test.ts` | Learner-home response invariance and failure/cache integration | 4B | Test | Self | Yes | 4 |
| `apps/backend/src/modules/recommendations/ml-runtime-alignment.test.ts` | v2 feature decomposition, project limitation, and view invalidation | 4C | Test | Self | Yes | 4 |
| `apps/backend/src/modules/recommendations/material-rank-fusion.test.ts` | Confidence, guardrail, real-catalog scenario, and obsolete-blend regression | 4D | Test | Self | Yes | 3 |

### Offline foundation, evaluation, and export

| Path | Purpose | Owning slice | Class | Covered | Required | Group |
| --- | --- | --- | --- | --- | --- | --- |
| `ml/recommendation/__init__.py` | Offline package marker | 0C | Offline | suite import | Yes | 1 |
| `ml/recommendation/pyproject.toml` | Python 3.11 direct dependencies and pytest config | 0C | Offline config | viability/suite | Yes | 1 |
| `ml/recommendation/requirements-lock.txt` | Reproducible Windows evidence lock | 0C | Offline config | viability | Yes, as historical unsupported-native evidence | 1 |
| `ml/recommendation/requirements-linux-lock.txt` | Accepted explicit linux-64 environment lock | 0C | Offline config | viability | Yes | 1 |
| `ml/recommendation/viability.py` | Environment/import/LightFM/native smoke probes | 0/0B/0C | Offline | `test_lightfm_viability.py` | Yes | 1 |
| `ml/recommendation/catalog_export_windows.ts` | Read-only, allowlisted, redacted catalog export | 1 | Offline tooling | catalog snapshot tests/manual DB evidence | Yes | 1 |
| `ml/recommendation/catalog_snapshot.py` | Validates and privacy-normalizes catalog snapshot | 1 | Offline | `test_catalog_snapshot.py` | Yes | 1 |
| `ml/recommendation/privacy.py` | Stable privacy-safe keys and scans | 1 | Offline | simulator/readiness tests | Yes | 1 |
| `ml/recommendation/schemas.py` | Offline record schemas/contracts | 1 | Offline | simulator tests | Yes | 1 |
| `ml/recommendation/config/simulation.yaml` | Frozen synthetic simulation configuration | 1 | Offline config | simulator tests | Yes | 1 |
| `ml/recommendation/candidate_universe.py` | Time-aware authoritative candidate eligibility | 1/2 | Offline | readiness tests | Yes | 1 |
| `ml/recommendation/simulator.py` | Synthetic learners, impressions, and actions | 1 | Offline | simulator invariant tests | Yes | 1 |
| `ml/recommendation/generate_dataset.py` | Deterministic dataset generation entry point | 1 | Offline | simulator/readiness tests | Yes | 1 |
| `ml/recommendation/tests/fixtures/catalog_fixture.json` | Invented structural catalog fixture | 1 | Test fixture | catalog tests | Yes | 1 |
| `ml/recommendation/tests/test_catalog_snapshot.py` | Snapshot privacy/schema/hash tests | 1 | Test | Self | Yes | 1 |
| `ml/recommendation/tests/test_simulator_invariants.py` | Synthetic dataset invariants/privacy tests | 1 | Test | Self | Yes | 1 |
| `ml/recommendation/baselines.py` | Popularity and interest-aware baselines | 2 | Offline | evaluation readiness | Yes | 1 |
| `ml/recommendation/evaluation_splits.py` | Prospective/cold-start split logic | 2 | Offline | readiness tests | Yes | 1 |
| `ml/recommendation/feature_audit.py` | Coverage/leakage audit | 2 | Offline | readiness tests | Yes | 1 |
| `ml/recommendation/features.py` | Approved offline feature construction | 2/3 | Offline | training/readiness tests | Yes | 1 |
| `ml/recommendation/evaluate.py` | Baseline metrics/scenarios | 2 | Offline | readiness tests | Yes | 1 |
| `ml/recommendation/scenario_evaluation.py` | Controlled evaluation scenarios | 2 | Offline | readiness tests | Yes | 1 |
| `ml/recommendation/tests/test_evaluation_readiness.py` | Candidate, split, hash, privacy, and artifact readiness | 2 | Test | Self | Yes | 1 |
| `ml/recommendation/model_io.py` | Offline model persistence helpers; generated Pickles remain ignored | 3 | Offline | training tests | Yes | 1 |
| `ml/recommendation/train_lightfm.py` | Frozen hybrid/pure LightFM training and evaluation | 3 | Offline | smoke/training tests | Yes | 1 |
| `ml/recommendation/recommend.py` | Offline model recommendation helper | 3 | Offline | training/smoke tests | Yes | 1 |
| `ml/recommendation/tests/test_lightfm_smoke.py` | End-to-end LightFM smoke | 3 | Test | Self | Yes | 1 |
| `ml/recommendation/tests/test_lightfm_training.py` | Frozen hashes, training, metrics, and regressions | 3 | Test | Self | Yes | 1 |
| `ml/recommendation/tests/test_lightfm_viability.py` | Supported/unsupported environment probes | 0C/3 | Test | Self | Yes | 1 |
| `ml/recommendation/expanded_catalog.py` | Benchmark B synthetic catalog extension | 3B | Offline diagnostic | expanded-user tests | Yes | 1 |
| `ml/recommendation/short_term.py` | Offline recent-intent reference implementation | 3B | Offline diagnostic/reference | expanded/parity tests | Yes | 1 |
| `ml/recommendation/run_expanded.py` | Frozen Benchmark B/new-user evaluation driver | 3B | Offline diagnostic | expanded tests | Yes | 1 |
| `ml/recommendation/tests/test_expanded_new_user.py` | Benchmark B and recent-intent invariants | 3B | Test | Self | Yes | 1 |
| `ml/recommendation/export_portable_model.py` | v1 and runtime-compatible v2 JSON export plus parity fixtures | 4A/4C | Offline release tooling | portable export/parity tests | Yes | 2 |
| `ml/recommendation/portable_model_schema.json` | Portable artifact JSON schema | 4A | Offline contract | export/loader tests | Yes | 2 |
| `ml/recommendation/tests/test_portable_export.py` | Portable schema/hash/prohibited-feature checks | 4A/4C | Test | Self | Yes | 2 |
| `ml/recommendation/tests/test_rank_fusion.py` | Python/TypeScript fusion parity reference | 4D | Test | Self | Yes | 3 |

### Historical evidence reports

| Path | Purpose | Owning slice | Class | Covered | Required | Group |
| --- | --- | --- | --- | --- | --- | --- |
| `ml/recommendation/slice-0c-linux-viability-report.md` | Linux viability acceptance and Windows limitation | 0C | Documentation | Evidence | Yes | 5 |
| `docs/recommendation/slice-1-synthetic-simulator-report.md` | Simulator/catalog/privacy evidence | 1 | Documentation | Evidence | Yes | 5 |
| `docs/recommendation/slice-2-baseline-evaluation-report.md` | Baseline evaluation evidence | 2 | Documentation | Evidence | Yes | 5 |
| `docs/recommendation/slice-3-lightfm-evaluation-report.md` | Hybrid LightFM evidence and limitations | 3 | Documentation | Evidence | Yes | 5 |
| `docs/recommendation/slice-3b-expanded-new-user-report.md` | Benchmark B/recent-intent evidence | 3B | Documentation | Evidence | Yes | 5 |
| `docs/recommendation/slice-4a-shadow-integration-report.md` | Portable runtime/parity/shadow design evidence | 4A | Documentation | Evidence | Yes | 5 |
| `docs/recommendation/slice-4b-development-shadow-report.md` | Local development shadow evidence | 4B | Documentation | Evidence | Yes | 5 |
| `docs/recommendation/slice-4c-runtime-alignment-report.md` | v2 alignment, blocked blend, and taxonomy-gap evidence | 4C | Documentation | Evidence | Yes | 5 |
| `docs/recommendation/slice-4d-material-rank-fusion-report.md` | Accepted confidence-gated fusion evidence | 4D | Documentation | Evidence | Yes | 5 |

## Generated-artifact audit

Both requested direct tracked-file checks returned no matches:

```text
git ls-files | grep -Ei '\.(pkl|parquet|npy|npz|joblib)$'
git ls-files | grep -Ei 'generated|benchmark-b|catalog-snapshot|casebook'
```

The second expression also produces no tracked path; reviewed source references to those names are not themselves generated artifacts. Direct `git check-ignore -v` checks confirmed `.gitignore` covers:

- `.venv`, `.venv311`, `python311`, `conda-env`, `conda-env-repro`, and `miniconda` environments;
- `.pytest_cache` and all recommendation `__pycache__` directories;
- all of `ml/recommendation/generated/`, including catalog snapshots, raw privacy-safe mappings, simulator Parquet, model Pickles, portable v1/v2 JSON, Benchmark B extensions, casebooks, evaluation dumps, and temporary generated reports.

No generated file is proposed for commit. The tracked lock files, source, fixtures, and reviewed reports are not accidentally ignored. Root ignore rules do intentionally ignore `apps/backend/package-lock.json` and `apps/frontend/pubspec.lock`; both are already tracked, so Git continues to track modifications, but this broad rule is a repository policy concern and should not be altered in Slice 4E.

## Portable artifact boundary and future release contract

Observed backend behavior:

| Condition | Behavior |
| --- | --- |
| Shadow disabled | Returns the exact input response object with `DISABLED`; no artifact read |
| Artifact path absent while shadow enabled | Catches `artifact_path_missing`, logs privacy-safe `FALLBACK`, returns exact response |
| Artifact unavailable while shadow enabled | Cached load promise rejects, fallback is returned, and the rejected promise remains cached so requests do not repeatedly retry |
| Schema, domain, Benchmark A hashes, dimensions, finite values, duplicate feature names, prohibited features, runtime feature contract, or content hash invalid | Validation rejects, shadow falls back, deterministic response remains unchanged |
| Either serving flag true | No effect on API ordering because serving flags are parsed but have no production consumer |

Future artifact release requirements, not implemented here:

- Generation command: create the accepted Python 3.11 Linux environment from `requirements-linux-lock.txt`, run the frozen offline training pipeline, then run `python -m ml.recommendation.export_portable_model` using the approved Benchmark A outputs.
- Approved source: only the reviewed Slice 3 hybrid LightFM training result regenerated from the frozen Benchmark A catalog/training inputs; Benchmark B is evaluation-only and prohibited from the portable artifact.
- Contract: `impactloop-lightfm-portable-v1`, runtime `feature_schema_version=runtime-approved-features-v2`, domain-specific mapping hash, frozen catalog snapshot hash, training dataset hash, canonical SHA-256 `content_hash`, and reviewed file SHA-256.
- Ownership: recommendation/ML maintainers generate and sign off; backend owners approve runtime validation and deployment linkage.
- Storage: versioned, access-controlled artifact storage outside Git and outside the application image source tree. Do not use a developer-local path.
- Deployment linkage: deploy by immutable artifact identifier plus checksum, populate only the domain artifact-path secret/config, validate before enabling shadow, and keep both serving flags false until separately approved.
- Startup validation: verify readability, JSON/schema/version/domain, feature schema, Benchmark A hashes, mapping hash, dimensions, finite values, prohibited names, canonical content hash, and expected file SHA-256 before traffic. Current code validates lazily on first shadow call, so startup validation is a future release requirement.
- Rollback: set shadow false (immediate response-safe rollback), restore the previous immutable artifact identifier if needed, restart, and verify deterministic learner-home output. Serving flags remain false.
- Retention: retain the currently deployed and immediately previous approved artifacts plus their manifests/evidence; expire superseded experimental artifacts under the team retention policy without deleting reproducibility metadata.

## Configuration and runtime architecture audit

All recommendation ML configuration is accounted for:

```text
RECOMMENDATION_ML_SHADOW_ENABLED=false
RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED=false
RECOMMENDATION_ML_PROJECT_SERVING_ENABLED=false
RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH=
RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH=
```

Both tracked example files use those defaults; `env.ts` independently defaults all booleans to false and paths to empty. Test mutations save and restore values. No local Windows/WSL path is hardcoded in production/configuration. Generated-path references occur only in tests and offline tooling. Neither serving flag is read outside configuration/tests, so material fusion and project scores cannot affect API output.

Final material flow:

```text
authoritative existing retrieval and business eligibility
→ runtime feature hydration (two bounded concept batch reads)
→ TypeScript LightFM v2 long-term scoring
→ bounded recent-intent scoring
→ NONE / LOW / MEDIUM / HIGH confidence
→ material-only confidence-gated rank fusion
→ privacy-safe shadow diagnostics
→ exact existing deterministic learner-home response
```

Verified boundaries:

- The existing candidate universe remains authoritative; equality against active candidate keys is enforced before scoring.
- Shadow candidate count and concept hydration are each bounded at 200. Concept hydration uses one material query and one project query, not per-candidate queries.
- Only a newly recorded authenticated material view invalidates that learner’s cache. Anonymous views and deduplicated repeats do not invalidate; failed writes cannot reach invalidation.
- Artifacts are cached as promises after the first validation attempt. Successful artifacts are not reparsed; failed loads are not retried repeatedly.
- Runtime scoring is pure TypeScript; no Python process is needed.
- Shadow calls receive and return the same response object, and the caller ignores diagnostics for response construction.

## Obsolete linear blend review

The fixed 35% normalized linear blend is retained only as historical/diagnostic evidence (`linearBlendTop5Keys`) and parity support. Material fused ranking uses `fuseMaterialRankings`; 40% and 45% are not implemented or promoted. Project shadow still uses the old linear diagnostic because project rank fusion/serving is not approved. There is no user-visible selection path for either result. Diagnostic code must not be deleted because Slice 3B/4A parity tests and Slice 4C/4D reports depend on it.

## Project boundary

Projects remain `SHADOW_EVALUATION_ONLY`. Material fusion is guarded by `domain === 'material'`; project results cannot enter the learner-home response, and material flags cannot activate project serving. Project artifact/scoring failures are independently caught inside the project shadow call. The unresolved status is still documented exactly as `NO_COMPONENT_MATERIAL_CONCEPT_OVERLAP`; no fabricated crosswalk or string-similarity mapping exists, and no report presents it as solved.

Follow-up issue/spec title only:

```text
Human-Reviewed Project Component to Material Taxonomy Crosswalk
```

## Documentation consistency

The nine Slice reports preserve history correctly:

- Slice 4C remains described as blocked; Slice 4D records the later accepted replacement without rewriting it.
- Benchmark A catalog/training hashes used by the loader agree with Slice 2/training evidence. Domain mapping hashes are fixed in the runtime contract.
- Benchmark B remains explicitly synthetic, separately labeled, generated/ignored, and excluded from artifacts.
- v1 portable results and runtime-compatible v2 results are distinguished. The retained v2 content/file hashes in Slices 4C/4D are not confused with v1 hashes in Slice 4A.
- Synthetic/local/demo evidence is never called real-user proof.
- Project serving is never approved; material serving remains disabled.
- Slice 4D’s accepted policy matches code: NONE/LOW do not insert recent candidates, MEDIUM inserts at most one, HIGH at most two in Top 5 and three in Top 10, with a 0.05 qualification threshold and unchanged candidate universe.

The pre-existing `final-recommendation-architecture.md` still says LightFM is “not implemented.” That statement describes the previously frozen user-visible architecture but is now incomplete with respect to offline/shadow implementation. Its current worktree edit only reformats a table and must not be folded into this change-set. A later documentation update should clarify “implemented offline/shadow, not serving” without rewriting historical Slice reports.

## Dependency audit

`pyproject.toml` pins Python 3.11 and eight direct dependencies. Each is used: LightFM (model), NumPy/SciPy (arrays/sparse matrices), pandas (tabular evaluation), scikit-learn (metrics/utilities), PyYAML (simulation config), PyArrow (Parquet tooling), and pytest (test runner). The Linux explicit lock contains linux-64 Python 3.11.15, LightFM 1.17, and the pinned direct versions; PostgreSQL client libraries arrive transitively through the Arrow/conda stack, while database access itself is performed by the TypeScript catalog exporter. PyArrow matches the Slice 1 Parquet pipeline. No temporary probe dependency appears in `pyproject.toml`.

The Windows explicit lock is historical evidence only. The viability report correctly states Windows-native LightFM is unsupported for accepted execution. No dependency version was changed in Slice 4E.

## Security and privacy audit

Tracked recommendation source, tests, fixtures, reports, and the touched integration files were scanned for connection strings, credentials, tokens, emails, phones, raw identifiers, mappings, local paths, embeddings, and histories.

- The two env examples contain placeholder local PostgreSQL URLs/passwords, placeholder JWT secrets, a placeholder email domain, and an empty Gemini key. Disposition: reviewed templates, not credentials.
- `catalog_export_windows.ts` contains the invented redaction probe `postgresql://secret@example/db`. Disposition: deliberate test string; never used to connect.
- Reports mention that a credential was used in a local read-only export but do not print it.
- Hashes are privacy-safe reproducibility identifiers.
- Dates, invented candidate keys, and structural fixtures are synthetic.
- Portable model embeddings and full interaction histories exist only in ignored generated artifacts, not tracked fixtures.
- No real email, phone, raw user identifier, raw catalog mapping, demo-account name, local machine path, token, or credential was found in the proposed tracked change-set.

## Validation matrix

### Fresh Slice 4E execution

| Check | Result | Disposition |
| --- | --- | --- |
| Ubuntu Python recommendation suite | **BLOCKED before collection** | System Python is 3.10.12 and lacks pytest/dependencies; accepted project requires 3.11. Local project Python environments are Windows executables; WSL launch fails with a vsock error. |
| Backend focused recommendation/learner-home/material-view suites | **BLOCKED before test loading** | Installed `node_modules` contains `@esbuild/win32-x64`; WSL requires `@esbuild/linux-x64`. 17 files were discovered and all failed in the `tsx` transform loader, not in assertions. |
| Focused changed-file typecheck | **Not independently runnable** | Repository has no focused tsconfig/script; the appropriate compiler input is the backend project. |
| Repository-wide backend typecheck | **No diagnostic output observed** | Direct pure-JavaScript TypeScript compiler invocation completed without emitted diagnostics, but the execution harness did not return an exit code. Treat as inconclusive, not a pass. The expected unrelated `admin-people.service.ts:52` nullable-location error did not appear in this checkout. |
| `git diff --check` | **FAIL** | Repository-wide CRLF conversion is reported as trailing whitespace. |
| Tracked generated-artifact checks | **PASS** | Both required `git ls-files` checks returned no matches. |
| Static architecture/config/privacy audit | **PASS with documentation follow-up** | Serving remains disabled and response-invariant; frozen architecture summary is incomplete for new shadow work. |

Fresh test execution is therefore mandatory in the validated environments before release. Historical report results remain evidence but are not substituted for the requested Slice 4E rerun.

Required rerun commands after restoring the accepted Linux Python 3.11 environment and Linux Node dependencies:

```bash
python -m pytest ml/recommendation/tests
node --import tsx --test apps/backend/src/modules/recommendations/*.test.ts apps/backend/src/modules/learner-home/*.test.ts apps/backend/src/modules/materials/materials.discovery.test.ts
npm run backend:typecheck
git diff --check
```

## Commit plan and dependency validation

Do not stage until line endings are normalized intentionally and the validation matrix is green.

### Group 1 — ML offline foundation

Message: `feat(recommendations): add offline LightFM evaluation pipeline`

Contains environment/locks, viability, catalog/simulator, baseline evaluation, LightFM training, expanded benchmark source/tests, and `.gitignore`. It has no dependency on later groups. It is safe to cherry-pick as offline-only after its Python suite passes; it does not affect backend runtime. No generated output is included.

### Group 2 — Portable runtime scoring

Message: `feat(recommendations): add portable LightFM shadow scorer`

Contains exporter/schema, artifact loader, TypeScript scorer, and portable export tests. It depends on Group 1 training/model conventions. It does not integrate with learner-home and is safe to cherry-pick after Group 1. TypeScript parity coverage lands in Group 4 because the indivisible shadow test file also imports Group 3 recent-intent code. There is no production behavior change.

### Group 3 — Recent intent and confidence-gated fusion

Message: `feat(recommendations): add confidence-gated material rank fusion`

Contains offline/runtime recent-intent references, confidence classification, material fusion, and parity/scenario tests. It depends on Group 2 scoring/artifact contracts for the real-catalog scenario test. It remains uncalled production code until Group 4, so cherry-picking after Group 2 is safe.

### Group 4 — Runtime alignment and development shadow integration

Message: `feat(recommendations): integrate response-invariant ML shadow diagnostics`

Contains configuration, learner-home hydration/calls, targeted view invalidation, shadow service, and integration/regression tests. It depends on Groups 2 and 3. It must be atomic: splitting `learner-home.service.ts` from `ml-shadow.service.ts`, or the service from fusion/recent-intent modules, creates unresolved imports; splitting the repository/service view changes breaks the recorded-view contract. Cherry-pick only after Groups 1–3 and only with both serving defaults false.

### Group 5 — Historical documentation

Message: `docs(recommendations): document LightFM evaluation and shadow integration`

Contains the nine Slice reports and this Slice 4E report. It depends conceptually on Groups 1–4 but not for compilation. It is safe to cherry-pick as documentation, although the report’s blocked status must remain accurate until reruns pass. Do not add the formatting-only `final-recommendation-architecture.md` worktree change.

## Exact staging commands (do not execute yet)

Group 1:

```bash
git add -- .gitignore ml/recommendation/__init__.py ml/recommendation/pyproject.toml ml/recommendation/requirements-lock.txt ml/recommendation/requirements-linux-lock.txt ml/recommendation/viability.py ml/recommendation/catalog_export_windows.ts ml/recommendation/catalog_snapshot.py ml/recommendation/privacy.py ml/recommendation/schemas.py ml/recommendation/config/simulation.yaml ml/recommendation/candidate_universe.py ml/recommendation/simulator.py ml/recommendation/generate_dataset.py ml/recommendation/tests/fixtures/catalog_fixture.json ml/recommendation/tests/test_catalog_snapshot.py ml/recommendation/tests/test_simulator_invariants.py ml/recommendation/baselines.py ml/recommendation/evaluation_splits.py ml/recommendation/feature_audit.py ml/recommendation/features.py ml/recommendation/evaluate.py ml/recommendation/scenario_evaluation.py ml/recommendation/tests/test_evaluation_readiness.py ml/recommendation/model_io.py ml/recommendation/train_lightfm.py ml/recommendation/recommend.py ml/recommendation/tests/test_lightfm_smoke.py ml/recommendation/tests/test_lightfm_training.py ml/recommendation/tests/test_lightfm_viability.py ml/recommendation/expanded_catalog.py ml/recommendation/run_expanded.py ml/recommendation/tests/test_expanded_new_user.py
```

Group 2:

```bash
git add -- ml/recommendation/export_portable_model.py ml/recommendation/portable_model_schema.json ml/recommendation/tests/test_portable_export.py apps/backend/src/modules/recommendations/ml-model-artifact.ts apps/backend/src/modules/recommendations/ml-lightfm-scorer.ts
```

Group 3:

```bash
git add -- ml/recommendation/short_term.py ml/recommendation/tests/test_rank_fusion.py apps/backend/src/modules/recommendations/short-term-intent.ts apps/backend/src/modules/recommendations/recent-intent-confidence.ts apps/backend/src/modules/recommendations/material-rank-fusion.ts apps/backend/src/modules/recommendations/material-rank-fusion.test.ts
```

Group 4:

```bash
git add -- apps/backend/.env.example apps/backend/env.example apps/backend/src/config/env.ts apps/backend/src/modules/learner-home/learner-home.repository.ts apps/backend/src/modules/learner-home/learner-home.service.ts apps/backend/src/modules/learner-home/learner-home.types.ts apps/backend/src/modules/materials/materials.repository.ts apps/backend/src/modules/materials/materials.service.ts apps/backend/src/modules/recommendations/ml-shadow.service.ts apps/backend/src/modules/recommendations/ml-shadow.test.ts apps/backend/src/modules/recommendations/ml-shadow.e2e.test.ts apps/backend/src/modules/recommendations/ml-runtime-alignment.test.ts
```

Group 5:

```bash
git add -- ml/recommendation/slice-0c-linux-viability-report.md docs/recommendation/slice-1-synthetic-simulator-report.md docs/recommendation/slice-2-baseline-evaluation-report.md docs/recommendation/slice-3-lightfm-evaluation-report.md docs/recommendation/slice-3b-expanded-new-user-report.md docs/recommendation/slice-4a-shadow-integration-report.md docs/recommendation/slice-4b-development-shadow-report.md docs/recommendation/slice-4c-runtime-alignment-report.md docs/recommendation/slice-4d-material-rank-fusion-report.md docs/recommendation/slice-4e-release-readiness-report.md
```

After every `git add`, inspect `git diff --cached --check`, `git diff --cached --stat`, and `git diff --cached` before committing. Never use `git add -A` or a directory-wide add in this worktree.

## Final change summary

- Files to commit: the 65 accepted recommendation/configuration/test/report files enumerated above, plus this Slice 4E report, partitioned into five dependency-safe groups. (The count includes `.gitignore` and excludes generated artifacts and the unrelated architecture-format edit.)
- Files to leave untouched: every unrelated tracked EOL-only change and `docs/recommendation/final-recommendation-architecture.md`’s formatting-only worktree edit.
- Ignored generated artifacts: all local Python/Conda environments, caches, bytecode, snapshots, privacy-safe raw mappings, simulator Parquet, Pickles, portable JSON, Benchmark B extensions, casebooks, evaluation dumps, and temporary outputs under `ml/recommendation/generated/`.
- Known unresolved issues: `NO_COMPONENT_MATERIAL_CONCEPT_OVERLAP`; project shadow evaluation only; no artifact storage/deployment/startup-validation implementation; frozen architecture summary needs a later clarification; repository-wide CRLF churn; fresh tests unavailable in this environment.
- Serving state: shadow default false; material serving false; project serving false; no serving consumer exists; deterministic learner-home response remains available.
- Release gate: repair/replace the validation environments without altering recommendation logic, rerun the complete matrix, clear `git diff --check`, inspect exact staged diffs, then commit Groups 1→5. Stop before committing.
