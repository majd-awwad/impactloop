# Slice 4A — Production-Compatible Scoring Parity and Shadow Integration

## 1. Manual domain decisions

- Materials: `PROCEED_TO_FEATURE_FLAGGED_SHADOW_INTEGRATION`.
- Projects: `PROCEED_TO_SHADOW_EVALUATION_ONLY`.
- `fit_partial`: `NOT_ADOPTED`.
- Slice decision: engineering acceptance passed. Neither scorer controls a user-visible response, and all serving flags remain disabled.

## 2. Runtime architecture

The accepted Benchmark A LightFM models are exported in Ubuntu Python to deterministic, portable JSON. The backend loads and validates the JSON once, caches the immutable artifact, and performs LightFM-compatible TypeScript scoring in process. No Python service, subprocess, network model call, WSL runtime dependency, online training, or database mutation was introduced.

## 3. Artifact schema

`impactloop-lightfm-portable-v1` contains metadata feature names, embeddings, biases, latent dimension, domain, model/schema versions, Benchmark A snapshot/training/mapping hashes, frozen hyperparameters, Python and LightFM versions, export timestamp, and a canonical logical-content hash. Decimal values are serialized canonically to make hash validation independent of JSON number formatting.

Generated artifacts are ignored. The material artifact is 59,504 bytes and the project artifact is 79,466 bytes. Their logical content hashes are respectively `1fa17e8bff7a9d509f3bd0578d696f5c5e702461ab7d6abd52a0ed7db0ee5bf7` and `c3c77a519a38c1bad3ff1de4f19851725a36c17cb4bbfff41ca877249052caf7`.

## 4. Artifact privacy audit

The exporter permits only Benchmark A and rejects Benchmark B extension markers, synthetic user and item identity features, material type, hidden intent, and simulator cohort features. The artifacts contain no raw database IDs, titles, descriptions, synthetic recommendation targets, or Pickle data. Actual users are represented only by available approved metadata features.

The loader rejects unsupported versions/domains, schema mismatches, duplicate feature keys, absent arrays, malformed dimensions, non-finite values, prohibited feature names, and content-hash mismatches.

## 5. Feature contract

Material scoring supports long-term interest, category, taxonomy concept, condition, free/paid, pickup, and delivery features. Project scoring supports long-term interest, project category/topic, taxonomy concepts, difficulty, and component concepts. Missing runtime metadata is omitted and counted as a bounded diagnostic; it is not fabricated. Hashed item or user identities are not metadata features. Material type remains excluded.

## 6. Python/TypeScript parity

Privacy-safe fixtures cover profile-only cold users, aligned likes, preference shift, project-driven evidence, accidental evidence, reversals, repeated views, decay, missing optional features, and metadata-only unseen items. Python and TypeScript long-term scores matched within `1e-9`; deterministic Top 5 and Top 10 orderings, including tie-breaking, were identical.

## 7. Short-term scorer parity

The TypeScript configuration is fixed at view `0.35`, active like `1.0`, project save/follow `1.8`, reservation/build start `2.5`, per-item view cap `2`, four-day half-life, and 35% recent-channel blend. Tests verify exposure-derived recent events, active-state reversals, capped refreshes, future timestamp rejection, deterministic decay, normalized channels, and parity with the accepted offline implementation. Failed or cancelled operations do not receive completed strong-action weight. The 14-day decay movement remains modest, as observed in Slice 3B.

## 8. Candidate-boundary proof

The shadow service receives the already-loaded active candidate set and ranks only that set. It verifies exact key-set equality, rejects duplicates, and enforces a 200-candidate bound. Any mismatch produces a fallback diagnostic and no shadow result. Existing material availability and project retrieval/business rules remain authoritative.

## 9. Shadow configuration

The following defaults are false: ML shadow, material ML serving, and project ML serving. Artifact paths are configured separately. Shadow calls run after the deterministic learner-home response is built and return the same response object. Serving flags are intentionally not used to change ordering in Slice 4A.

## 10. Material shadow behavior

The material path constructs available metadata features, applies the portable long-term scorer, builds recent intent from a bounded existing learner-home behavior context, normalizes both channels, applies the fixed 35% blend, and logs comparison aggregates. Missing or invalid artifacts, candidate mismatch, scorer errors, absent interests, stale evidence, and reversals fall back without changing the response.

## 11. Project shadow status

The same artifact and scorer contract supports offline/shadow project comparison. Project ML serving remains disabled and unauthorized. Conclusions retain the 29-item real-catalog warning, small-domain saturation warning, weaker project evidence, and shadow-only decision.

## 12. Diagnostics

Privacy-safe diagnostics include artifact/model version, domain, candidate count, Top-5/Top-10 overlap, recent evidence count, recent-channel presence, missing-feature count, duration, load/scoring status, fallback reason, and error category. They exclude raw user IDs, titles, descriptions, histories, feature vectors, and embeddings.

## 13. Failure and fallback behavior

Artifact validation/loading and all scoring are inside a fail-safe boundary. Failures are categorized and logged as aggregate shadow diagnostics, while the existing response is returned unchanged. Artifacts are cached after validation; candidate and recent-event inputs are bounded. There is no synchronous Python execution, network dependency, online update, or automatic artifact replacement.

## 14. Performance

Windows Node measurements on the Benchmark A catalog scale after artifact caching:

| Measurement | Result |
|---|---:|
| Material artifact load | 2.53 ms |
| Project artifact load | 1.81 ms |
| 161-material cached score p50 / p95 | 2.62 / 4.29 ms |
| 29-project cached score p50 / p95 | 0.084 / 0.188 ms |
| Short-term profile construction | 0.047 ms |
| Combined reranking | 0.135 ms |
| Measured process memory increase | 0 bytes at fixture scale |

The material p95 is below the 50 ms acceptance boundary. These local fixture measurements do not include database retrieval, which remains part of the existing request path rather than ML scoring.

## 15. Files changed

Slice 4A implementation is bounded to the portable exporter/schema, one backend artifact loader, one LightFM-compatible scorer, one short-term scorer, one shadow service, focused Python/TypeScript tests, learner-home wiring/context fields, disabled environment configuration, and this report. No Prisma schema, migration, seed, frontend, API response contract, or production scorer weights were changed for Slice 4A.

## 16. Repository state

The worktree already contained extensive uncommitted Slice 1–3B and unrelated changes; they were preserved. Benchmark A logical hashes still match their frozen manifest. Benchmark B artifacts remain separate. Portable JSON, Pickle models, expanded catalogs, and other generated artifacts remain ignored and absent from Git's tracked file list. No commit was created. The repository-wide `git diff --check` continues to report pre-existing CRLF/trailing-whitespace noise across unrelated files; the Slice 4A-focused diff check is clean.

Verification results:

- Ubuntu ML suite: 65 passed.
- Windows focused shadow plus learner-home regression suite: 23 passed.
- Backend TypeScript typecheck: passed.
- Focused `git diff --check`: passed.
- No generated serving artifact is tracked.

## 17. Known limitations

- Runtime taxonomy/component features are used only when already present in the bounded candidate context; missing values reduce feature coverage and are diagnosed.
- Long-term embeddings remain frozen between separately approved offline retraining runs; actual recent behavior affects only the deterministic recent channel.
- Local latency fixtures do not substitute for production observability under traffic.
- Shadow results are synthetic-offline-derived evidence, not proof of real-user recommendation quality.
- Project evidence remains constrained by the small catalog and is not approved for serving.

## 18. Slice decision

Portable export, artifact validation, score/ranking parity, short-term parity, exact candidate boundaries, disabled-by-default shadow operation, fail-safe response preservation, performance, and focused tests pass. No model controls user-visible ordering, no online update exists, and no production state was changed.

`SLICE_4A_SHADOW_INTEGRATION_PASSED`
