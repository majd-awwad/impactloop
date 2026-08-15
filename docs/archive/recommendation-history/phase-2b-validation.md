# Phase 2B Validation Report — Typed Taxonomy Foundation

## Decision

`ADOPT_WITH_CONDITIONS`

The additive foundation is suitable for offline evaluation and future shadow work. It is not approved for active recommendation behavior until compatibility semantics, coverage gaps, typed disambiguation, and runtime performance are separately reviewed.

## Scope and repository boundary

Implemented in six production files only:

1. `apps/backend/prisma/schema.prisma` — enums, concepts, aliases, and four mapping relations.
2. `apps/backend/prisma/migrations/20260718120000_add_typed_taxonomy_foundation/migration.sql` — additive PostgreSQL migration.
3. `apps/backend/src/modules/taxonomy/taxonomy-normalization.ts` — deterministic normalization.
4. `apps/backend/src/modules/taxonomy/taxonomy-foundation.data.ts` — reviewed bilingual vocabulary and exact mapping rules.
5. `apps/backend/src/modules/taxonomy/taxonomy-foundation.repository.ts` — validation, read-only resolution/loading, and idempotent backfill.
6. `apps/backend/scripts/seed-taxonomy.ts` — standalone backfill command.

No existing migration was edited. No frontend, API, scoring, candidate ranking, recommendation repository, or active Learner Home path was changed.

## Schema and vocabulary evidence

| Evidence | Result |
|---|---:|
| Concept types | 5 |
| Concepts | 74 |
| English/Arabic aliases | 189 |
| Same-type alias collisions | 0 |
| Intentional cross-type alias collisions | 37 |
| Compatibility relations | 0 (deferred) |

The canonical key format is globally prefixed (`interest:`, `material-family:`, `material-form:`, `project-topic:`, `component:`). The complete seed inventory and normalization contract are in [`taxonomy.md`](taxonomy.md) and the typed data module.

## Backfill and coverage

The migration was applied successfully to the local PostgreSQL database with Prisma. The initial foundation population run produced the following inserts:

| Relation | Inserted rows |
|---|---:|
| Concepts | 74 |
| Aliases | 189 |
| Learner interests | 13 |
| Materials | 228 |
| Learning projects | 30 |
| Required components | 56 |

A second run inserted zero duplicate aliases or mapping rows, demonstrating idempotence. Persisted counts remained 74/189/13/228/30/56.

Against the local validation database, distinct mapped entity coverage was:

- comparable Phase 2A seeded materials: 159/159;
- current local materials, including test rows: 199/199;
- learning projects: 30/30;
- required components: 56/117;
- learner interests: 13 reviewed keys.

The local 199-material count is 159 seeded rows plus 40 test materials. The seeded set is 150 primary rows plus 9 `(Spare Batch)` workflow copies. The 40 test rows belong to three test supplier accounts and were created on 2026-07-17; seeded rows were created on 2026-07-15. No user-created rows were identified. Current material statuses are AVAILABLE 160, PENDING_RESERVATION 6, RESERVED 30, and REUSED 3; source types are EDUCATIONAL_INSTITUTION 36, WORKSHOP_SURPLUS 115, STUDENT_LEFTOVER 15, and FACTORY_SURPLUS 33. There are no duplicate title/material-type/category groups.

The 61 unmapped required components are a coverage limitation, not an inferred negative label. They require vocabulary review before any component-based recommendation feature is enabled.

### Component role and reason breakdown

| Role | Total | Mapped | Unmapped |
|---|---:|---:|---:|
| Required material | 64 | 36 | 28 |
| Optional material | 32 | 9 | 23 |
| Consumable | 19 | 11 | 8 |
| Tool | 2 | 0 | 2 |

The complete 61-row reason breakdown is: 51 missing canonical component concepts intentionally deferred, 8 consumables, and 2 tools. There were 0 ambiguous aliases, 0 malformed/weak source rows, 0 capability-only rows, and 0 persisted fuzzy mappings. Representative deferred material concepts for future review include DHT11/IR/soil-moisture/water-level/light sensors, LCD/OLED displays, ESP32 boards, motor drivers, servo motors, buzzers, and common reusable supplies such as cardboard tubes, felt, plastic trays, wood strips, and fabric offcuts. Tools and consumables should remain separate from physical material-component concepts unless a later vocabulary slice establishes that ownership.

## Normalization, collision, and ambiguity checks

Focused tests passed 5/5. They cover bilingual punctuation/diacritics, stable canonical keys, malformed/blank values, inactive alias filtering, ambiguity reporting, and same-type/cross-type collision validation.

The 37 cross-type collisions are preserved as explicit ambiguity rather than silently merged. Examples include `electronics` across interest/material-family/project-topic, `arduino` across interest/component, and `breadboard` across material-form/component. A future caller must provide type context or handle `AMBIGUOUS`; no fallback ranking or transitive compatibility is implemented.

## Offline shadow feature dataset

[`taxonomy-shadow-dataset.json`](taxonomy-shadow-dataset.json) contains five deterministic examples derived from frozen seed sections: one learner interest, two materials, one project, and one required component. It demonstrates typed feature emission only; it is not connected to recommendation scoring or API output and is not evidence of user-level recommendation quality.

## Read and backfill performance

The read-only repository enforces a maximum batch of 500 IDs per bounded loading call and issues four bounded mapping reads in parallel. On the local PostgreSQL database, 30 iterations produced:

| Operation | p50 | p95 | Iterations |
|---|---:|---:|---:|
| English alias lookup (`arduino`) | 3.02 ms | 5.82 ms | 30 |
| Bounded mapping load (199 materials, 30 projects, 117 components, 13 interests) | 20.87 ms | 64.75 ms | 30 |
| Bounded mapping load (159 comparable materials, 30 projects, 117 components, 13 interests) | 19.83 ms | 46.02 ms | 30 |

The bounded-loader audit used 199 current materials, the comparable 159-material set, 30 projects, 117 components, and 13 learner interests. Thirty iterations measured p50/p95 of 20.87/64.75 ms for current materials and 19.83/46.02 ms for the comparable set; the exact 500-input case measured 11.71/15.84 ms. Empty, duplicate, unknown, mixed, exact-500, 501, repeated-call, and zero-inactive-concept cases were exercised. Duplicate input IDs are deduplicated before querying; the 501 case rejects with `Material taxonomy batch exceeds 500`. Query-event instrumentation was not enabled, so query count is not claimed. No recommendation request path calls this repository.

## Validation commands

- Prisma schema validation, formatting, and client generation passed.
- Additive migration deployment passed locally.
- Focused taxonomy test passed: 5/5.
- Repository-wide TypeScript validation remains blocked by the pre-existing `apps/backend/src/modules/admin-people/admin-people.service.ts:52` nullability error; no taxonomy error was reported.
- The temporary benchmark script and temporary Prisma workaround directory were removed after measurement.
- No commit was created.

## Conditions before activation

## Final acceptance verification

### Backfill preservation and three-run audit

The local database started with 74/189/13/228/30/56 taxonomy rows. Each of three consecutive runs reported zero inserted aliases or mappings and preserved the same counts. Existing-data snapshots were value-equivalent before and after every run: 199 materials, 303 learner profiles, 30 projects, 117 components, 23 categories, and 484 material tags. Learner interest arrays, project/component display fields, material fields, and IDs were unchanged. Canonical taxonomy IDs were stable, no mappings were deleted, and the database contained zero inactive concepts before or after the audit. The backfill now also preserves an existing inactive concept status instead of reactivating it.

| Snapshot count | Before run 1 | After run 1 | Before run 2 | After run 2 | Before run 3 | After run 3 |
|---|---:|---:|---:|---:|---:|---:|
| Taxonomy concepts | 74 | 74 | 74 | 74 | 74 | 74 |
| Taxonomy aliases | 189 | 189 | 189 | 189 | 189 | 189 |
| Learner-interest mappings | 13 | 13 | 13 | 13 | 13 | 13 |
| Material mappings | 228 | 228 | 228 | 228 | 228 | 228 |
| Project mappings | 30 | 30 | 30 | 30 | 30 | 30 |
| Component mappings | 56 | 56 | 56 | 56 | 56 | 56 |
| Existing materials | 199 | 199 | 199 | 199 | 199 | 199 |
| Learner profiles / projects / components | 303 / 30 / 117 | same | 303 / 30 / 117 | same | 303 / 30 / 117 | same |
| Categories / material tags | 23 / 484 | same | 23 / 484 | same | 23 / 484 | same |

### Mapping provenance and reviewed samples

Persisted rows are generated only by exact reviewed rules. No substring, fuzzy distance, inferred translation, first-match fallback, or ambiguous alias is persisted.

| Entity group | AUTHORITATIVE | REVIEWED | DERIVED_EXACT | UNMAPPED |
|---|---:|---:|---:|---:|
| Learner interests | 13 | 0 | 0 | 0 |
| Materials | 199 | 29 | 0 | 0 |
| Learning projects | 30 | 0 | 0 | 0 |
| Project components | 0 | 56 | 0 | 61 |

Reviewed rule samples (20):

| Entity/value | Concept | Provenance | Exact rule |
|---|---|---|---|
| interest `arduino` | `interest:arduino` | AUTHORITATIVE | `learner-interest-registry.key` |
| interest `robotics` | `interest:robotics` | AUTHORITATIVE | `learner-interest-registry.key` |
| interest `sensors` | `interest:sensors` | AUTHORITATIVE | `learner-interest-registry.key` |
| interest `circuits` | `interest:circuits` | AUTHORITATIVE | `learner-interest-registry.key` |
| interest `art_crafts` | `interest:art-crafts` | AUTHORITATIVE | `learner-interest-registry.key` |
| category `Electronics & Components` | `material-family:electronics` | AUTHORITATIVE | exact `category.nameEn` |
| category `Motors & Mechanical Parts` | `material-family:mechanical` | AUTHORITATIVE | exact `category.nameEn` |
| material type `Arduino Uno` | `material-form:arduino-uno` | REVIEWED | exact `materialType` |
| material type `Ultrasonic Sensor` | `material-form:ultrasonic-sensor` | REVIEWED | exact `materialType` |
| material type `Breadboard` | `material-form:breadboard` | REVIEWED | exact `materialType` |
| material type `Jumper Wires` | `material-form:jumper-wires` | REVIEWED | exact `materialType` |
| material type `DC Motor` | `material-form:dc-motor` | REVIEWED | exact `materialType` |
| project category `Robotics` | `project-topic:robotics` | AUTHORITATIVE | exact `category.nameEn` |
| project category `Recycling Crafts` | `project-topic:recycling-crafts` | AUTHORITATIVE | exact `category.nameEn` |
| project category `Woodworking` | `project-topic:woodworking` | AUTHORITATIVE | exact `category.nameEn` |
| component name `Arduino board` | `component:arduino-board` | REVIEWED | exact `componentName` |
| component name `Ultrasonic distance sensor` | `component:ultrasonic-distance-sensor` | REVIEWED | exact `componentName` |
| component name `DC gear motors` | `component:dc-gear-motors` | REVIEWED | exact `componentName` |
| component name `Rubber wheels` | `component:rubber-wheels` | REVIEWED | exact `componentName` |
| component type `Wood Glue` | `component:wood-glue` | REVIEWED | exact `materialType` |

### Alias matrix

There are 113 English aliases and 76 Arabic aliases. All 37 normalized cross-type collisions are intentionally ambiguous without a type hint; a type hint selects the unique concept in that type, while untyped lookup returns `AMBIGUOUS`.

| Normalized alias | Concepts involved | Type hint | Untyped |
|---|---|---|---|
| `electronics` | `interest:electronics`, `material-family:electronics`, `project-topic:electronics` | resolves | AMBIGUOUS |
| `الكترونيات` | `interest:electronics`, `material-family:electronics`, `project-topic:electronics` | resolves | AMBIGUOUS |
| `arduino` | `component:arduino-board`, `interest:arduino` | resolves | AMBIGUOUS |
| `arduino board` | `component:arduino-board`, `interest:arduino` | resolves | AMBIGUOUS |
| `robotics` | `interest:robotics`, `project-topic:robotics` | resolves | AMBIGUOUS |
| `الروبوتات` | `interest:robotics`, `project-topic:robotics` | resolves | AMBIGUOUS |
| `woodworking` | `interest:woodworking`, `project-topic:woodworking` | resolves | AMBIGUOUS |
| `اعمال خشبية` | `interest:woodworking`, `project-topic:woodworking` | resolves | AMBIGUOUS |
| `fabric and textiles` | `interest:fabric-textiles`, `material-family:fabric` | resolves | AMBIGUOUS |
| `اقمشة ومنسوجات` | `interest:fabric-textiles`, `material-family:fabric` | resolves | AMBIGUOUS |
| `hc-sr04` | `component:ultrasonic-distance-sensor`, `material-form:ultrasonic-sensor` | resolves | AMBIGUOUS |
| `breadboard` | `component:breadboard`, `material-form:breadboard` | resolves | AMBIGUOUS |
| `لوحة تجارب` | `component:breadboard`, `material-form:breadboard` | resolves | AMBIGUOUS |
| `jumper wires` | `component:jumper-wires`, `material-form:jumper-wires` | resolves | AMBIGUOUS |
| `اسلاك توصيل` | `component:jumper-wires`, `material-form:jumper-wires` | resolves | AMBIGUOUS |
| `dupont wires` | `component:jumper-wires`, `material-form:jumper-wires` | resolves | AMBIGUOUS |
| `battery holder` | `component:battery-holder`, `material-form:battery-holder` | resolves | AMBIGUOUS |
| `حامل بطارية` | `component:battery-holder`, `material-form:battery-holder` | resolves | AMBIGUOUS |
| `pvc pipes` | `component:pvc-pipes`, `material-form:pvc-pipes` | resolves | AMBIGUOUS |
| `انابيب pvc` | `component:pvc-pipes`, `material-form:pvc-pipes` | resolves | AMBIGUOUS |
| `rubber wheels` | `component:rubber-wheels`, `material-form:rubber-wheels` | resolves | AMBIGUOUS |
| `عجلات مطاطية` | `component:rubber-wheels`, `material-form:rubber-wheels` | resolves | AMBIGUOUS |
| `لوح خشب رقائقي` | `component:plywood-panel`, `material-form:plywood-sheet` | resolves | AMBIGUOUS |
| `plywood panel` | `component:plywood-panel`, `material-form:plywood-sheet` | resolves | AMBIGUOUS |
| `cardboard sheets` | `component:cardboard-sheets`, `material-form:cardboard-sheets` | resolves | AMBIGUOUS |
| `الواح كرتون` | `component:cardboard-sheets`, `material-form:cardboard-sheets` | resolves | AMBIGUOUS |
| `fabric scraps` | `component:fabric-scraps`, `material-form:fabric-scraps` | resolves | AMBIGUOUS |
| `بقايا اقمشة` | `component:fabric-scraps`, `material-form:fabric-scraps` | resolves | AMBIGUOUS |
| `denim offcuts` | `component:denim-offcuts`, `material-form:denim-offcuts` | resolves | AMBIGUOUS |
| `بقايا جينز` | `component:denim-offcuts`, `material-form:denim-offcuts` | resolves | AMBIGUOUS |
| `small hinges` | `component:small-hinges`, `material-form:small-hinges` | resolves | AMBIGUOUS |
| `مفصلات صغيرة` | `component:small-hinges`, `material-form:small-hinges` | resolves | AMBIGUOUS |
| `screws and nuts` | `component:screws-and-nuts`, `material-form:screws-and-nuts` | resolves | AMBIGUOUS |
| `براغي وصواميل` | `component:screws-and-nuts`, `material-form:screws-and-nuts` | resolves | AMBIGUOUS |
| `wooden dowel` | `component:wooden-dowel`, `material-form:wooden-dowels` | resolves | AMBIGUOUS |
| `wood glue` | `component:wood-glue`, `material-form:wood-glue` | resolves | AMBIGUOUS |
| `غراء خشب` | `component:wood-glue`, `material-form:wood-glue` | resolves | AMBIGUOUS |

Known examples `electronics`, `robotics`, `arduino`, `breadboard`, `jumper wires`, `motor`, `board`, `display`, and `fabric` were checked. The first five are in the 37-collision set and remain ambiguous without a type; `motor`, `board`, `display`, and `fabric` are unknown/unambiguous in this reviewed vocabulary and do not resolve by result order.

### Test coverage matrix

| Required behavior | Exact test/evidence |
|---|---|
| Canonical keys unique | `canonical keys are unique and aliases are unique within the selected type/language scope` |
| Alias uniqueness by scope | same test; `validateTaxonomyVocabulary` |
| English and Arabic resolution | `English and Arabic alias candidates resolve only with explicit type context when needed` |
| Unknown/ambiguous aliases | `unknown and malformed values do not resolve`; same English/Arabic test |
| Type hint, inactive concept/alias filtering | `alias resolution rejects inactive candidates and exposes collisions`; repository `isActive`/concept-status filters |
| Blank/malformed aliases | `unknown and malformed values do not resolve` |
| Technical identifiers and Arabic normalization | `normalization preserves identifiers and handles bilingual punctuation safely`; `normalization contract covers Unicode, Arabic, technical punctuation, and mixed identifiers` |
| Backfill idempotence and existing fields unchanged | three-run acceptance audit; all three runs `existingUnchanged: true`, zero inserted rows |
| No duplicate mappings | three-run acceptance audit; second and third runs inserted zero mapping rows |
| Learner/material/project/component mappings | reviewed provenance table and persisted counts |
| Cross-entity isolation, empty/duplicate/unknown/mixed IDs | bounded-loader acceptance audit |
| Bounded batch limit | `bounded batch limit rejects more than 500 unique IDs before querying` and exact-500/501 audit |
| No active recommendation integration | `active recommendation paths do not import the typed taxonomy foundation` plus static source audit |

### Runtime inactivity proof

The active Learner Home and recommendation files do not import `modules/taxonomy`, query taxonomy tables, read concept IDs, expose taxonomy fields, or register a taxonomy route. The only application entry point is the explicitly invoked standalone `apps/backend/scripts/seed-taxonomy.ts`; application startup does not import or run it. The schema/migration/repository changes are outside the active recommendation modules, so candidate queries, scoring, ranking, API responses, and current output behavior remain unchanged. No compatibility relations, semantic retrieval, ML, fuzzy persistence, or frontend/API behavior were added.

### Shadow fixture classification

[`taxonomy-shadow-dataset.json`](taxonomy-shadow-dataset.json) is a deterministic five-example contract fixture, not a relevance dataset, quality benchmark, or claim of typed-matching improvement. It contains no personal data, uses stable redacted seed keys rather than local database IDs, and is not consumed by runtime code. It should remain small and manually regenerable from the frozen seed sections.

1. Review and expand the 56/117 component coverage, with explicit ownership for unmapped and ambiguous values.
2. Decide whether category/material-type mapping tables are needed for broader catalog coverage.
3. Define typed compatibility semantics separately; do not derive them from aliases.
4. Add an evaluation dataset and compare any taxonomy-assisted retrieval against the current rule-based baseline.
5. Re-measure on production-like data and confirm operational monitoring before any runtime integration.

ADOPT_WITH_CONDITIONS
