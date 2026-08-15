# Slice 1 — Privacy-Safe Catalog Export and Synthetic Behavior Simulator

Date: 2026-07-19

## 1. Decision

**PASSED.** Slice 1A exported the real public ImpactLoop catalog through a Windows-only read-only process. Slice 1B consumed only that sanitized snapshot in Ubuntu and generated three deterministic synthetic behavior variants. No recommendation model or baseline was trained or evaluated.

## 2. Runtime environment

- Interoperability: Ubuntu WSL2 invoked Windows PowerShell 5.1, which invoked Windows Node v22.16.0.
- Repository path resolved with `wslpath`; no Windows path was assumed.
- Exporter command: Windows Node running the repository's existing `tsx` loader against `ml/recommendation/catalog_export_windows.ts`.
- Simulator: Python 3.11.15 on Ubuntu WSL2, with fixed `PYTHONHASHSEED=0`.
- Parquet dependency: `pyarrow==18.1.0`, pinned in `pyproject.toml` and the explicit Linux lock.
- Clean verification environment: `/tmp/impactloop-slice1-linux-clean`, recreated from the 130-package Linux lock.
- LightFM exists only because the accepted Slice 0 environment is reused; no Slice 1 module imports or calls it.

## 3. Read-only catalog boundary

The exporter loaded the backend connection value only inside the Windows process. It was never printed, returned through a Linux environment variable, or written to an artifact.

The fixed query allowlist was limited to:

`categories`, `learning_project_concepts`, `learning_projects`, `material_concepts`, `material_types`, `materials`, `project_component_concepts`, `project_required_components`, and `taxonomy_concepts`.

The exporter rejects non-`SELECT` statements and any table outside that list. It successfully enforced `default_transaction_read_only = on`, began `BEGIN READ ONLY`, ran reviewed fixed queries, and ended with `ROLLBACK`. Audit result: **zero writes**. It queried no user, profile, like, view, reservation, build, impression, recommendation-action, notification, or authentication table.

## 4. Catalog identity

Two consecutive exports returned the same logical content hash:

`d7ec01b4d8fd39816f443ab9add5fbc56e6042fbe50f8ba25907cc812dc34c2c`

| Measure | Result |
|---|---:|
| Material rows selected | 199 |
| Eligible/public materials exported | 161 |
| Unavailable/non-public materials excluded | 38 |
| Project rows selected | 30 |
| Published projects exported | 29 |
| Non-public projects excluded | 1 |
| Categories represented | 19 |
| Controlled material types represented | 151 |
| Material concept coverage | 100% |
| Project concept coverage | 100% |
| Required-component concept coverage | 75.86% |
| Duplicate hashed keys | 0 |
| Invalid timestamps | 0 |
| Publication range | 2026-07-15 through 2026-07-17 UTC |

The 161 eligible materials are reported as observed. The earlier approximately-160 value was only an estimate; no row was added, removed, or corrected to match it. The project count remained 29.

Material keys use `sha256("impactloop-material:" + id)`, project keys use the project namespace, and category keys use a separate category namespace. Raw identifiers never leave the Windows process.

## 5. Privacy audit

Snapshot loaders reject unexpected fields, malformed hashes, non-public state, invalid timestamps, duplicate keys, or a content-hash mismatch. Tracked fixtures contain invented structural values only.

The snapshot and generated artifact scans found no credentials, connection URI, raw database ID, real user/account identifier, email, phone, name, address, coordinate, token, description, note, image URL, or unreviewed free text. The catalog snapshot is correctly labeled `IMPACTLOOP_CATALOG_READ_ONLY_SNAPSHOT`; only generated learners and behavior use `SYNTHETIC_SIMULATION`.

## 6. Simulator variants

| Seed | Variant | Marker | Exploration | Personas |
|---:|---|---|---:|---:|
| 11 | Balanced | STANDARD | 15.12% observed | 300 |
| 29 | Noisy/exploratory | STANDARD | 20.03% observed | 300 |
| 47 | Project-driven OOD | OOD_ROBUSTNESS_ONLY | 14.98% observed | 300 |

The logical hashes are respectively `99523dc…f4eb4`, `71307d2…35dc5`, and `86c564c…c697`; variant outputs and distributions differ.

## 7. Persona distributions

Personas use only `sim_user_0001` through `sim_user_0300`. Interest selection is varied and non-uniform across 19 hashed category interests.

| Seed | Stable | Gradual | Abrupt | Exploratory | Noisy | Low / Medium / High activity |
|---:|---:|---:|---:|---:|---:|---|
| 11 | 88 | 68 | 61 | 42 | 41 | 99 / 147 / 54 |
| 29 | 102 | 59 | 45 | 66 | 28 | 88 / 157 / 55 |
| 47 | 94 | 59 | 67 | 50 | 30 | 80 / 157 / 63 |

Broad location buckets are non-uniform and contain no addresses or coordinates.

## 8. Hidden intent design

Hidden state is stored separately. Stable personas have no episodes; every abrupt-task persona has at least one bounded episode; other non-stable cohorts receive zero to two episodes. Intent differs from the long-term primary interest, gradual cohorts use gradual transitions, and Seed 47 has stronger task-driven behavior. Future hidden state is used only while generating the applicable timestamp and is never copied into resolved training feedback.

## 9. Exposure and exploration design

The fixed prospective window is 2026-07-20 through 2026-08-18 UTC, after the latest observed publication timestamp. This preserves publication eligibility without fabricating dates. Each learner has 5–12 sessions; each slate contains 6–10 unique eligible entities. Every impression is recorded before any action and is labeled `POLICY_SELECTED` or `RANDOM_EXPLORATION`.

Hidden utility is a bounded stochastic combination of current-intent match, imperfect long-term loyalty, variant-specific loyalty, and independent Gaussian/uniform noise. It deliberately omits the active ImpactLoop scorer's production weights and signals. Actions sample a logistic transform of this utility, so exposure never deterministically implies engagement.

## 10. Action funnel

Generated actions include material views, likes/reversals, and reservation chains, plus project likes/reversals, saves, follows, and build outcomes. Material views exceed material likes; reservations and builds remain rare. Completed, accepted/progress, cancelled/rejected/expired, and abandoned outcomes receive different semantics. Repeated material views are capped at three per learner/item/day. Non-engagement remains an exposure with `engaged=false`, never an explicit dislike.

## 11. Raw-to-resolved semantics

Raw impressions and actions remain separate. Deterministic operation keys group durable chains. Resolution deduplicates operation state, removes reversed likes/saves/follows, distinguishes terminal reservation/build outcomes, applies bounded weights and a deterministic 14-day half-life, and emits at most one contribution per resolved operation/state. Unobserved items are not materialized as negatives.

## 12. Temporal splits

Timestamp-derived splits use days 1–21 train, 22–25 validation, and 26–30 test. All operation chains remain within one split; resolved operations occur in exactly one split; no future state appears in train.

| Seed | Train | Validation | Test |
|---:|---:|---:|---:|
| 11 | 4,544 | 894 | 1,047 |
| 29 | 3,292 | 610 | 805 |
| 47 | 3,214 | 655 | 681 |

## 13. Data-sufficiency diagnostics

| Seed/domain | Rows | Unique pairs | Density | Users train / validation / test |
|---|---:|---:|---:|---|
| 11 material | 4,614 | 3,170 | 6.56% | 285 / 142 / 149 |
| 11 project | 1,871 | 1,461 | 16.79% | 270 / 102 / 129 |
| 29 material | 3,216 | 2,427 | 5.02% | 282 / 122 / 135 |
| 29 project | 1,491 | 1,267 | 14.56% | 270 / 100 / 129 |
| 47 material | 1,480 | 1,207 | 2.50% | 184 / 52 / 40 |
| 47 project | 3,070 | 2,217 | 25.48% | 295 / 163 / 184 |

Users with at least 2/5/10 unique interacted items were 300/299/271, 300/295/222, and 300/292/195. Items with interactions from at least 2/3/5 users were 190/190/189, 190/190/190, and 189/182/156. Seed 47 intentionally shifts support toward projects and is not made easier. These are diagnostics only; no simulator parameter was selected using model outcomes.

Material/project cold-user counts were 3/9, 8/7, and 83/1 for seeds 11, 29, and 47; cold-item count was zero in every domain/variant. Material interactions per user (minimum/median/maximum) were 0/15/40, 0/10/39, and 0/4/31; project values were 0/5/22, 0/4/19, and 0/10/26. Every domain/variant spans the full active period from 2026-07-20 through 2026-08-18. The Seed 47 material cohort is intentionally the weakest-support cohort; future evaluation should mark unsupported subcohorts `INSUFFICIENT_SYNTHETIC_SUPPORT` rather than adding rows.

## 14. Determinism

Every seed was generated twice in-process using fixed Python and NumPy seeds, sorted mappings, fixed UTC anchor, explicit simulator version, and fixed hash seed. Logical row content, mappings, split membership, summaries, and hashes matched. Validation-only mode reloaded Parquet and reproduced each logical hash. Different seeds produced different hashes and distributions. Parquet file metadata was not used for determinism decisions.

## 15. Performance

The second Windows export completed connection, query, transformation, and JSON output in approximately 70 ms as recorded by its credential-safe audit. Linux generation took 1.13 s, 1.76 s, and 1.57 s for seeds 11, 29, and 47; Parquet writes took 0.38 s, 0.66 s, and 0.53 s. Generated per-seed artifact totals were approximately 4.30 MB, 3.67 MB, and 3.67 MB. Peak memory was not recorded because no safe cross-runtime measurement was available.

## 16. Generated artifacts

Ignored files include the three JSON catalog snapshots and per-seed Parquet datasets for personas, impressions, actions, material/project feedback, splits, and hidden state, plus aggregate summaries. Git ignore checks passed; no raw mapping was necessary or created.

## 17. Tests

Primary and clean lock-recreated environments both passed **17 tests**. Coverage includes fixed query/table allowlists, prohibited tables, read-only setup, namespaced keys, snapshot schema/privacy/hash, raw-ID rejection, invented fixture safety, exactly 300 synthetic personas, deterministic/different variants, exposure ordering and identity, session/slate bounds, exploration tolerance, drift cohorts, reversals, outcomes, view caps, temporal integrity, raw/resolved reconciliation, artifact reload, ignore rules, and absence of PostgreSQL/LightFM imports in the Linux pipeline. A successful real Windows read-only export was performed twice; mocks did not replace it.

## 18. Files changed

Slice 1 changes are confined to the offline ML area, this report, the Linux dependency specification/lock, and existing ignore coverage. Five new Python implementation modules and one isolated TypeScript exporter are within the approved module bound.

## 19. Repository state

Generated data and environments remain ignored. No model artifact exists. No Node backend runtime, Flutter, Prisma schema, migration, seed, API, or production recommendation file was modified by Slice 1. The worktree still contains extensive unrelated pre-existing user modifications, including an unrelated documentation change and global CRLF whitespace findings; they remain untouched. No commit was created.

## 20. Known limitations

This simulator is controlled synthetic evidence, not real learner behavior. Category/type labels are privacy-safe keys, so reports cannot provide human-readable category names. Component concept coverage is 75.86%. Seed 47 has a deliberately smaller material test cohort. Future evaluation must flag unsupported cohorts rather than manufacturing interactions.

## 21. Slice decision

Slice 1A and Slice 1B satisfy the privacy, read-only, determinism, temporal-integrity, reconciliation, exploration, and artifact-tracking gates. Slice 2 has not started.
