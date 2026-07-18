# Phase 2B — Typed Taxonomy Foundation

This document describes the inactive, additive typed taxonomy foundation. It is a vocabulary and mapping layer for future recommendation experiments; it is not a replacement for the current recommendation path.

## Decision boundary

The foundation is persisted and queryable, but no active recommendation code reads it. Existing category, material-type, tag, project, and component fields remain authoritative for current behavior. There are no frontend changes, API changes, compatibility edges, scoring changes, candidate-pool changes, or runtime recommendation integrations in Phase 2B.

The implementation boundary is six production files: the Prisma schema, one additive migration, normalization, reviewed seed vocabulary, the read-only/backfill repository, and a standalone seed command. Tests and documentation are outside that boundary.

## Concept model

Canonical identity is globally prefixed so the same word can safely exist in multiple typed namespaces:

| Type | Key prefix | Seed count | Current ownership/mapping |
|---|---:|---:|---|
| Interest | `interest:` | 13 | Existing learner-interest string keys |
| Material family | `material-family:` | 13 | Frozen material category names |
| Material form | `material-form:` | 22 | Frozen material type names |
| Project topic | `project-topic:` | 6 | Frozen learning-project category names |
| Component | `component:` | 20 | Frozen required-component names/types |

The reviewed vocabulary contains 74 concepts and 189 bilingual aliases. Each concept has a stable canonical key, English label, Arabic label, lifecycle status, and optional future parent reference. Parent/child hierarchy is modeled but deliberately not populated in this phase.

The mapping tables are explicit and many-to-many where the domain permits it:

- `learner_interest_concepts` maps the existing learner-interest key to one concept.
- `material_concepts` maps materials to material families/forms.
- `learning_project_concepts` maps projects to project topics.
- `project_component_concepts` maps required components to component concepts.

Category-to-concept and material-type-to-concept tables were not added separately because the frozen evaluation slice can be deterministically backfilled through the direct entity mapping tables. Compatibility relations are intentionally deferred.

## Reviewed seed vocabulary

The machine-readable source is [`taxonomy-foundation.data.ts`](../../apps/backend/src/modules/taxonomy/taxonomy-foundation.data.ts). The canonical keys are:

- Interests: `electronics`, `arduino`, `robotics`, `sensors`, `circuits`, `displays`, `wires-connectors`, `audio-media`, `woodworking`, `fabric-textiles`, `art-crafts`, `recycling`, `home-diy`.
- Material families: `electronics`, `mechanical`, `power`, `wood`, `plastic`, `metal`, `fabric`, `paper`, `tools`, `craft`, `packaging`, `lab`, `reusable`.
- Material forms: `arduino-uno`, `ultrasonic-sensor`, `breadboard`, `jumper-wires`, `dc-motor`, `servo-motor`, `motor-driver`, `led-pack`, `resistor-pack`, `battery-holder`, `acrylic-sheet`, `pvc-pipes`, `rubber-wheels`, `plywood-sheet`, `mdf-offcuts`, `cardboard-sheets`, `fabric-scraps`, `denim-offcuts`, `small-hinges`, `screws-and-nuts`, `wooden-dowels`, `wood-glue`.
- Project topics: `robotics`, `electronics`, `recycling-crafts`, `woodworking`, `home-experiments`, `textile-crafts`.
- Components: `arduino-board`, `ultrasonic-distance-sensor`, `dc-gear-motors`, `jumper-wires`, `rubber-wheels`, `breadboard`, `led`, `resistor`, `battery-holder`, `acrylic-sheets`, `pvc-pipes`, `small-hinges`, `screws-and-nuts`, `plywood-panel`, `mdf-offcut`, `cardboard-sheets`, `fabric-scraps`, `denim-offcuts`, `wooden-dowel`, `wood-glue`.

Aliases are reviewed bilingual labels, explicit seed aliases, legacy forms, abbreviations, and translations. They are provenance-labeled; an alias is not treated as a semantic equivalence merely because normalization makes two strings equal.

## Normalization and resolution

`normalizeTaxonomyAlias` applies Unicode NFKC, trimming, case folding, Arabic tatweel/diacritic removal, conservative Arabic letter normalization, underscore-to-space conversion, punctuation normalization, and whitespace collapse. It preserves Unicode letters/numbers and meaningful separators such as `/`, `.`, and `-`.

Canonical keys are generated from the globally prefixed seed key and use lowercase ASCII key segments. Runtime alias resolution requires an active alias and active concept. Resolution is:

1. normalize the input;
2. filter by optional language and concept type;
3. ignore inactive aliases/concepts;
4. return `NOT_FOUND`, `RESOLVED`, or `AMBIGUOUS`;
5. never select a concept arbitrarily when multiple typed candidates remain.

The reviewed vocabulary has zero same-type collisions and 37 intentional cross-type collisions, including `electronics`, `robotics`, `arduino`, `breadboard`, and `jumper wires`. These are expected reasons to require a type hint or preserve the ambiguity result.

## Coexistence and lifecycle

Existing fields and current recommendation behavior remain unchanged. New concepts default to `ACTIVE` in the seed, but the repository filters inactive concepts and aliases from reads, allowing reviewed vocabulary to be disabled without deleting history. The migration uses additive tables, foreign keys, unique identities, and indexes for canonical keys, normalized aliases, and mapping lookups.

The standalone command is:

```text
cd apps/backend
tsx scripts/seed-taxonomy.ts
```

It upserts concepts by canonical key and inserts aliases/mappings with duplicate-safe writes. It does not run the application seed and does not activate taxonomy reads in production behavior.

## Acceptance database evidence

The local validation database currently contains 199 materials, but 199 is not the Phase 2A frozen baseline. The comparable seeded set is 159 rows: 150 primary seeded materials plus 9 explicitly named `(Spare Batch)` workflow copies. The additional 40 rows are test materials owned by three `[test-internal-delivery]`/`[test-handover-codes]` supplier accounts, created on 2026-07-17; the seeded rows were created on 2026-07-15. No user-created material rows were identified in this classification. The current local status distribution is AVAILABLE 160, PENDING_RESERVATION 6, RESERVED 30, and REUSED 3. There are no duplicate title/material-type/category groups.

Coverage must therefore be read as both 159/159 for the comparable seeded set and 199/199 for the current local database. Component coverage is reported separately by role in [`phase-2b-validation.md`](phase-2b-validation.md).

The final three-run audit preserved all existing material, learner-profile interest arrays, project, component, category, and tag values. It also preserved canonical taxonomy IDs and existing inactive status; an existing inactive concept is not reactivated by a later backfill.

## Deferred work

Compatibility edges, transitive closure, automatic synonym inference, category/material-type ownership tables, UI/API exposure, scoring features, and recommendation integration require a separate decision with compatibility evidence. They must not be inferred from alias collisions or enabled by this foundation.
