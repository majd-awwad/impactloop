# Recommendation feature-token contract v3

Status: specification infrastructure only; inactive and aggregation-blocked.

The machine-readable contract is [`recommendation-feature-token-contract-v3.json`](../../contracts/recommendation/recommendation-feature-token-contract-v3.json). Its existence does not activate a recommender or make any existing artifact v3-compatible.

## Authority boundary

The JSON contract is the cross-language authority for token grammar, namespaces, feature groups, side and domain applicability, cardinality, weighting, aggregation status, portable-runtime eligibility, unknown/deprecation behavior, and legacy compatibility.

`TAXONOMY_CONCEPT_SEEDS` remains the authority for exact canonical taxonomy membership. The JSON contract is not a second taxonomy registry and cannot, by itself, give Python the current list of canonical concepts. A later slice must provide Python with an automatically generated or database-exported vocabulary verified against the same fingerprint; it must not introduce a separately maintained copy.

`taxonomyVocabularyFingerprint` covers only entries serialized as `<conceptType>\t<canonicalKey>`, sorted by canonical key using ASCII ordering, joined with LF, and hashed as UTF-8 with SHA-256. Labels, aliases, and mapping rules are deliberately excluded so human-resolution changes do not falsely make the token vocabulary incompatible.

## Identity and resolution

Canonical taxonomy keys are already complete token identities:

- `interest:arduino`
- `material-family:electronics`
- `material-form:arduino-uno`
- `project-topic:robotics`
- `component:dc-gear-motors`

The validator accepts canonical tokens only after resolution. It does not resolve aliases, map persisted learner interests, normalize display labels into identifiers, or create new taxonomy concepts. An external mapping layer may use the Unicode-safe `normalizeTaxonomyAlias` helper, but must return an exact foundation key. English and Arabic display labels, generated database IDs, and hashes are never token identity.

Generic and doubled wrappers such as `category:material-family:electronics`, `concept:material-form:arduino-uno`, and `component:component:dc-motor` are invalid.

## Portable feature policy

Portable v3 supports equal-weight declared canonical interests and semantic material/project metadata only. Every portable occurrence has weight `1.0`, and duplicate tokens use set semantics.

Material rows require at least one material-family concept and exactly one condition, free/paid state, pickup state, and delivery state. Material-form concepts are optional. The condition vocabulary covers `NEW`, `LIKE_NEW`, `GOOD`, `USED`, and `NEEDS_REPAIR`; each boolean group covers both `true` and `false`.

Project rows require at least one project-topic concept and exactly one difficulty. Required-component concepts are optional. Difficulty covers `BEGINNER`, `INTERMEDIATE`, and `ADVANCED`.

A user with no resolved declared interest, or an item missing a required group, is ineligible for portable scoring. The contract does not invent a replacement token. Future integrations must preserve deterministic fallback.

Identity columns are allowed only in explicitly isolated warm training experiments. Synthetic persona identities, activity bands, preference buckets, project-tendency features, inferred affinities, and session context are not portable v3 features. Generated Prisma IDs and hashed category IDs are prohibited as semantic metadata even when pseudonymized.

## Normalization and aggregation

Three operations remain separate:

1. Human input and aliases are normalized by an external, Unicode-safe resolver.
2. The resulting canonical feature token is validated byte-for-byte against this contract and, for taxonomy tokens, the foundation vocabulary.
3. Validated and deduplicated feature rows are aggregated according to the contract-selected vector mode.

No aggregation mode is selected in v3.0.0. Weighted sum, weighted mean, L1, and L2 remain experiment candidates. `portableActivationAllowed` is false until a controlled experiment selects one global mode for user and item rows across both domains and records it in a compatible contract revision.

## Loading and validation

The TypeScript helper uses Zod for generic document structure and derives semantic checks from the parsed JSON. It does not contain a second hard-coded namespace or feature-group table.

Importing the helper performs no file I/O. The explicit loader reads with `node:fs/promises`, resolves the repository contract from `import.meta.url`, and supports an explicit file URL or absolute path for tests. The same relative layout works from both `src/modules/recommendations` and `dist/modules/recommendations`. Missing, unreadable, malformed, structurally invalid, and semantically invalid files have distinct load errors.

## Legacy and activation boundary

`impactloop-lightfm-portable-v1`, `slice-3-approved-features-v1`, and `runtime-approved-features-v2` remain historical experimental contracts. They are not relabeled or automatically rewritten. Future v3 artifacts must explicitly include the v3 contract ID/version, taxonomy vocabulary fingerprint, and selected aggregation mode.

This slice is not consumed by ML shadow, Python training, artifact export, deterministic scoring, database reads, or production APIs. Integrating any of those systems requires a separate reviewed slice.
