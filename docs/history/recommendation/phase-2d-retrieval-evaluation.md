# Recommendation Phase 2D — Full-Catalog Normalization Retrieval Validation

## 1. Executive Decision

This phase evaluated reviewed learner-interest aliases against the complete frozen catalog without changing active Learner Home behavior. The result is:

- bounded retrieval expansion added zero material candidates and zero project candidates;
- scoring-only normalization changed 48 already-retrieved material candidates and 8 already-retrieved project candidates;
- the reviewed scoring-only delta contained 16 relevant and 32 partially relevant material candidates, plus 2 relevant and 6 partially relevant project candidates, with 0 reviewed false positives;
- typed taxonomy, compatibility, component matching, schemas, seed data, APIs, and frontend behavior were untouched;
- bounded retrieval expansion increased material p95 in this local benchmark and is not promoted.

The chosen runtime option is scoring-only normalization. It is a recommendation for a later implementation; it was not activated in this phase.

## 2. Dataset Identity

The evaluator verifies these values before every run:

| Population | Count |
|---|---:|
| Frozen seeded materials | 159 |
| Frozen learning projects | 30 |
| Reviewed learner interests | 13 |
| Local test materials excluded | 40 |
| Public material rows evaluated by production eligibility | 150 |
| Public project rows evaluated by production eligibility | 29 |

The 30-project frozen population includes one non-published project, so the exact current public project query evaluates 29 rows. No row order is used for identity; the seeded supplier identity rule and stable title keys are used. No personal identifiers are written to the fixture.

## 3. Alias Inventory and Bounds

Only the 13 `INTEREST` concept seeds are used. Component, material-form, material-family, project-topic, and other cross-type aliases are excluded. Terms are normalized, deduplicated, deterministically ordered, and capped at 28 per interest. No interest reached the cap; the maximum observed bounded term count was 25 and zero terms were removed by the cap.

| Interest | Canonical terms | English aliases | Arabic labels/aliases | Bounded terms |
|---|---:|---:|---:|---:|
| electronics | 4 | 0 | 1 | 5 |
| arduino | 5 | 1 | 1 | 7 |
| robotics | 7 | 2 | 1 | 10 |
| sensors | 8 | 1 | 1 | 10 |
| circuits | 9 | 1 | 1 | 11 |
| displays | 8 | 2 | 1 | 11 |
| wires_connectors | 10 | 2 | 1 | 14 |
| audio_media | 11 | 1 | 1 | 13 |
| woodworking | 7 | 1 | 1 | 9 |
| fabric_textiles | 10 | 1 | 1 | 13 |
| art_crafts | 20 | 1 | 1 | 25 |
| recycling | 8 | 1 | 1 | 9 |
| home_diy | 7 | 2 | 1 | 9 |

Examples of bounded reviewed terms include `arduino`, `microcontroller`, `arduino board`, `أردوينو`; `robotics`, `robot`, `robots`, `الروبوتات`; and `fabric`, `textile`, `fabric remnants`, `أقمشة ومنسوجات`. Generic stop terms are not treated as alias evidence, while any term required by the current production search-term collector remains in the baseline-compatible retrieval predicate.

## 4. Baseline Parity

The evaluator reuses the current `collectMaterialCandidateSearchTerms`, `buildMaterialRelevanceWhere`, `loadProjectPool`, `matchLearnerInterestsAgainstMaterial`, and `matchLearnerInterestsAgainstHaystack` functions. It does not approximate production scoring or import cross-type taxonomy aliases.

Baseline content-scoring parity covered 2,444 checks (13 interests × 159 materials plus 13 interests × 29 public projects), with 0 mismatches. Project retrieval calls the current `loadProjectPool(120)` query. The component matcher is not evaluated or changed.

## 5. Full-Catalog Material Retrieval

Strategy A and strategy B have identical candidate IDs and retrieval order for all 13 interests. Strategy C also added zero candidates and dropped zero candidates after the unchanged 120-item cap. It changed no retrieval order after the final corrected bounded predicate.

The largest relevance match counts before the cap were 54 for both A and C. The final merged pool contains the existing relevance, popular, and free phases; final counts vary by interest because the production merge can contain fewer than 120 eligible rows locally.

Scoring-only changes occurred for `robotics` (5 candidates), `woodworking` (7), `fabric_textiles` (3), and `art_crafts` (33). Only `fabric_textiles` and `art_crafts` changed the scored order. Alias-only evidence is assigned one bounded score and cannot multiply by synonym count.

## 6. Full-Catalog Project Retrieval

The current project query already retrieves all 29 public projects for every interest. Therefore strategy C has no retrieval work to add and no candidate delta to create. Strategy B changes scoring-only evidence for 8 project candidates under `art_crafts`; no project candidate IDs are added, removed, or duplicated.

## 7. Retrieval Delta Review

The generated [taxonomy-retrieval-delta-fixture.json](./taxonomy-retrieval-delta-fixture.json) includes every scoring-only candidate and an empty matrix for interests with no delta. It contains no newly retrieved candidate because bounded retrieval expansion produced none.

| Entity type | Interests | Fixture pairs | Newly retrieved relevant | Newly retrieved partial | Newly retrieved false positives | Scoring-only pairs |
|---|---:|---:|---:|---:|---:|---:|
| Materials | 13 | 48 | 0 | 0 | 0 | 48 |
| Projects | 13 | 8 | 0 | 0 | 0 | 8 |

Scoring-only reviewed labels were 16 relevant and 32 partially relevant for materials, and 2 relevant and 6 partially relevant for projects. Arabic-only useful retrieval count was 0 because no Arabic alias added a candidate absent from production retrieval.

## 8. Quality Metrics

The Phase 2C fixture was evaluated over the full-catalog candidate set. These are averages over the six interest matrices represented in that fixture; they do not use Recall@10 as a primary metric.

| Task/strategy | Candidate recall | Candidate precision | P@5 | NDCG@5 | MRR | Zero-result |
|---|---:|---:|---:|---:|---:|---:|
| Material A | .761 | .634 | .700 | .779 | .917 | 0% |
| Material B | .761 | .634 | .700 | .779 | .917 | 0% |
| Material C | .761 | .634 | .700 | .779 | .917 | 0% |
| Project A | .976 | .678 | .800 | .883 | 1.000 | 0% |
| Project B | .976 | .678 | .800 | .883 | 1.000 | 0% |
| Project C | .976 | .678 | .800 | .883 | 1.000 | 0% |

The scoring-only delta fixture is small and selected from candidates whose alias evidence differs from production scoring, so its quality metrics are descriptive rather than a promotion estimate:

| Delta task/strategy | Candidate recall | Candidate precision | P@5 | NDCG@5 | MRR | Zero-result |
|---|---:|---:|---:|---:|---:|---:|
| Material B/C | 1.000 | 1.000 | .900 | .891 | 1.000 | 0% |
| Project B/C | 1.000 | 1.000 | 1.000 | .862 | 1.000 | 0% |

These results show safe offline evidence for scoring-only aliases, not broad catalog precision at every possible interest phrase.

## 9. SQL and Query Shape

Material query-shape measurements use an approximate serialized predicate length because Prisma does not expose generated SQL text from this evaluator. A material evaluation uses four database calls: availability/match count plus one relevance, one popular, and one free candidate query. It uses three top-level OR branches inside the relevance predicate: scalar fields, tags, and category. B uses the exact A query shape; C uses the same three branches with bounded reviewed terms. There is no query per alias, entity, or taxonomy row.

| Strategy | Max normalized terms | Max approximate predicate length | OR branches | Query count | Max returned IDs before merge | Max duplicate IDs in merged phases |
|---|---:|---:|---:|---:|---:|---:|
| A | 24 | 7,244 | 3 | 4 | 162 | 50 |
| B | 24 | 7,244 | 3 | 4 | 162 | 50 |
| C | 25 | 7,531 | 3 | 4 | 162 | 50 |

Project retrieval uses one query, zero OR branches, zero normalized terms, 29 returned IDs, and zero duplicate IDs. Candidate IDs are hydrated only once by the production path; this evaluator compares IDs and does not add hydration queries.

## 10. Performance

The evaluator command is:

```text
cd apps/backend
node --import tsx scripts/evaluate-normalized-retrieval.ts --fixture-output=../../docs/recommendation/taxonomy-retrieval-delta-fixture.json
```

The default output is stdout. An explicit fixture output path is required to write the reviewed delta fixture; no result JSON is created automatically.

Twenty measured executions were run for each strategy/task, covering all 13 interests, repeated high-alias interests, and Arabic-interest vocabulary. Durations below are milliseconds; the full per-execution vectors are emitted in evaluator JSON stdout.

| Strategy/task | p50 | sample p95 | max | errors |
|---|---:|---:|---:|---:|
| A material | 51.0 | 101.4 | 101.4 | 0 |
| B material | 48.7 | 133.0 | 133.0 | 0 |
| C material | 66.7 | 144.1 | 144.1 | 0 |
| A project | 9.9 | 12.7 | 12.7 | 0 |
| B project | 8.9 | 12.9 | 12.9 | 0 |
| C project | 8.4 | 12.9 | 12.9 | 0 |

Concurrent material batches completed without errors:

| Batch | A wall time | B wall time | C wall time |
|---|---:|---:|---:|
| 5 concurrent | 339.5 ms | 77.3 ms | 113.8 ms |
| 10 concurrent | 154.2 ms | 154.5 ms | 190.4 ms |

Strategy C material p95 was 42.7 ms above A and exceeded the larger of the 10% or 15 ms gate. It also increased predicate length and term count. Strategy B does not change candidate query count or predicate shape; its measured p95 variance is in the same database-bound request path, so it remains the safer placement for a later runtime change.

## 11. Explanation Quality

Scoring-only explanations are bounded and distinguish evidence type:

- `Matches your robotics interest` for current production lexical evidence;
- `Matched through the Arabic alias ...` for a reviewed Arabic alias;
- `Related through a reviewed Arduino interest term` for reviewed English alias evidence.

No explanation claims exact taxonomy overlap, compatibility, or component equivalence. Component matching and compatibility explanations were not changed or generated.

## 12. Runtime Option Comparison

| Option | Evidence | Result |
|---|---|---|
| Scoring only | 48 material and 8 project scoring-only candidates; 0 reviewed false positives; no candidate query change | Recommended for a later implementation |
| Bounded retrieval + scoring | 0 new candidates; 0 dropped candidates; material p95 gate failed | Do not adopt |
| Offline only | Safe fallback if runtime review is not approved | Not required by measured quality, but activation remains deferred |

## 13. Risks and Limitations

- The delta fixture is small and intentionally biased toward candidates whose alias evidence differs from current scoring.
- Review labels are title/content reviews of frozen seed rows, not user outcome labels.
- Project retrieval has no meaningful expansion surface while the current public pool is smaller than its 120-row cap.
- Local database timings are process- and database-state-specific; they are comparative evidence, not production SLOs.
- The evaluator does not assess component matching, compatibility, typed concept ranking, semantic retrieval, or learned ranking.

## 14. Files Changed

- [evaluate-normalized-retrieval.ts](../../apps/backend/scripts/evaluate-normalized-retrieval.ts)
- [evaluate-normalized-retrieval.test.ts](../../apps/backend/scripts/evaluate-normalized-retrieval.test.ts)
- [taxonomy-retrieval-delta-fixture.json](./taxonomy-retrieval-delta-fixture.json)
- This report.

## 15. Repository State

Focused evaluator tests passed: 3/3. The evaluator typecheck passed. Two full evaluator runs produced the same deterministic core hash:

`53654b6d47ff209b17c802232ce71425ba3441a2f4e16310b18259e0ab146712`

The recorded run was `2026-07-18T02:26:55Z`. No production files, schemas, migrations, seeds, APIs, frontend code, taxonomy runtime queries, or database rows were changed. Temporary evaluator output JSON files were removed before handoff. No commit was created.

## 16. Decision

Normalization should be considered for scoring only after a separate implementation review. Bounded retrieval expansion should not proceed from this evidence, and this phase does not activate either option in Learner Home.

ADOPT_SCORING_ONLY
