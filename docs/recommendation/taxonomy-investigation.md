# Recommendation Phase 2A — Typed Taxonomy and Compatibility Investigation

## 1. Executive Finding

**Decision: structurally insufficient for safe long-term use; adopt a typed taxonomy with explicit compatibility relations in a later implementation phase.**

The frozen seed is unusually complete for a development catalog: all 159 seeded material rows have a category, material type, and at least one tag; all 30 projects have tags; and all 117 project components have keywords and a category in the main seed. That completeness makes deterministic baseline recommendations possible today.

It does not make the taxonomy safe as a durable source of meaning. The same semantic layer is represented simultaneously by category names, material-type strings, tags, component names, JSON keyword arrays, application-code aliases, and free text. The application interest registry has 13 typed definitions, but the frozen learner population uses only nine keys and the material/project matching path is predominantly lexical. The current project-category relations declared in the interest registry are not used as typed project-category relations by the current haystack matcher.

The smallest justified direction is `ADOPT_TYPED_TAXONOMY_WITH_COMPATIBILITY`: preserve the current fields and baseline, add canonical typed concepts and aliases, then add explicit component acceptance/substitution relations only after offline relevance labels confirm the gain. A general knowledge graph, embeddings, vector storage, or learned ranker is not justified by this investigation.

Scope is intentionally limited to evidence and design. No production code, schema, seed, scoring, ranking, API, frontend, or generated Prisma file was changed.

## 2. Current Taxonomy Inventory

### Taxonomy field inventory

| Domain / field | Database type and state | Controlled or free text | Current normalization / language | Constraints and indexes | Frozen-seed examples | Recommendation / matching use |
|---|---|---|---|---|---|---|
| Learner interests | `LearnerProfile.interests`: `String[]`, required with `[]` default | Application-controlled keys on the onboarding path, but the database accepts arbitrary strings | `normalizeLearnerInterestKeys`: trim/lowercase, `_`→space for resolution, `&`→`and`, whitespace collapse, limited trailing-`s` token handling; custom values use `custom:` and ASCII-style slugging; no Arabic normalization | No database uniqueness or index | `arduino`, `robotics`, `sensors`, `circuits`, `art_crafts`, `fabric_textiles`, `recycling`, `woodworking`, `home_diy` | Learner Home material/project relevance, candidate search terms, explanation reason; profile loading reads the array directly |
| Learner preferred material types | No field found in the inspected learner/profile schema or seed | Not represented | N/A | N/A | None | No direct recommendation signal |
| Learner category preferences | No field found in the inspected learner/profile schema or seed | Not represented | N/A | N/A | None | No direct recommendation signal |
| Manual learner interests | Supported through `custom:` application values; not a separate database field | Free text after the `custom:` prefix | Lowercase, spaces→underscores, punctuation removed from the suffix; custom matching is content substring/token matching | No database constraint | No frozen custom values | Weak custom-interest match with lower score and generic explanation |
| Learner location | `UserSavedLocation`→`Location`; city required, area nullable | City/area are free strings | Recommendation comparisons trim and compare case-insensitively; no taxonomy normalization | User/location indexes; no taxonomy vocabulary | Hebron, Ramallah, Nablus and seeded areas | Eligibility/convenience signal, not a content concept |
| Material category | `Material.categoryId`: required FK to `Category` | Seed-controlled category rows, but `Category` has no canonical key or uniqueness constraint | `nameEn`/`nameAr` are stored labels; matching uses case-insensitive `contains` against both names | `Material.categoryId`; `Category(parentId)`, `(categoryType,isActive)` | `Electronics & Components`, `Wood & Boards`, `Fabric & Textiles` | Category candidate filter and material interest matching only for interests configured with `keywords_and_category` |
| Material category metadata | `Category.nameEn`, required; `nameAr`, required; optional `parentId`; `categoryType` enum | Labels are controlled by seed/admin convention, not enforced vocabulary | No canonical slug/key in the model | No unique label constraint | English/Arabic category pairs | Display, category filter, lexical category matching |
| Material type | `Material.materialType`: required `String`; `materialTypeId`: nullable FK; `customMaterialType`: nullable `String` | `materialTypeId` can be controlled, but required display/type string remains free text | Main seed creates one `MaterialType` per category/type and derives `normalizedName` through `normalizeSearchText`; exact utility was not opened under the eight-file boundary | `Material.materialTypeId` index; `MaterialType(categoryId,normalizedName)` unique; `MaterialType.nameEn` index | `Arduino Uno`, `DC Motor`, `Plywood Sheet`, `PVC Pipes` | Material candidate scalar `contains`; component candidate type scoring; explanations can expose type match |
| Material type aliases | `MaterialTypeAlias.alias`: required `String`; `normalizedAlias`: required; `language`: nullable | Seed aliases are locally controlled but no global alias uniqueness | Main realistic seed aliases are English; legacy taxonomy data includes English and Arabic aliases | Unique per material type/normalized alias; index on normalized alias | `Arduino`, `Arduino Uno R3`, `HC-SR04`, `Distance sensor` | Current matching code does not join aliases in the Learner Home material haystack; aliases are mainly a taxonomy/price-rule support structure |
| Material tags | `MaterialTag.tag`: required `String` | Effectively unrestricted text; uniqueness is only per material | Current matching uses lowercase/trim and case-insensitive substring SQL; no canonicalization or global vocabulary | Unique `(materialId,tag)`; index `tag` | `robotics`, `microcontroller`, `offcuts`, `art project` | Material candidate filter and interest lexical matching |
| Material title | Required `String` | Free text | Lowercase/trim in application; SQL uses case-insensitive `contains` | No taxonomy index | `Arduino Uno R3 Boards`, `Clear Acrylic Sheet Offcuts` | Interest match and component title/name matching |
| Material description | Required `String` | Free text | Lowercase/trim in application; SQL candidate query does not use description in the inspected relevance predicate | No taxonomy index | Seed descriptions contain use and provenance sentences | Learner Home hydrated haystack and behavior affinity; not a structured concept |
| Suggested uses | Nullable `String` | Free text, often sentence-like | No taxonomy normalization | No taxonomy index | `Robot cars, LED circuits, sensor prototypes, classroom labs.` | Stored in `Material`, but not included in the inspected Learner Home interest haystack |
| Project category | `LearningProject.categoryId`: required FK to `Category` | Seed-controlled project category labels, but no canonical key/uniqueness | Current project matching puts category labels into one lexical haystack | Project category index; category model has `(categoryType,isActive)` index | `Robotics`, `Electronics`, `Recycling Crafts`, `Woodworking`, `Home Experiments`, `Textile Crafts` | Project card display, project candidate data, lexical interest matching |
| Project tags | `ProjectTag.tag`: required `String` | Free text; uniqueness only per project | Lowercase/trim in application; no global vocabulary | Unique `(projectId,tag)`; index `tag` | `reuse`, `home diy`, `robotics`, `sensors`, `plants` | Project lexical haystack and behavior signals |
| Required-component category | `ProjectRequiredComponent.categoryId`: nullable FK | Structured when present, but optional | Exact category-ID comparison in component candidate scoring | Project component/category indexes | All 117 main realistic-seed components have a category; schema permits null | Strongest component candidate signal |
| Required-component title | `componentName`: required `String` | Free text | Lowercase/trim; exact/substring/title token overlap | No uniqueness or index | `Arduino board`, `Clear acrylic sheets`, `Plywood panel` | Title/name match and explanation hint |
| Required-component material type | `materialType`: required `String` | Free text despite the name; not an FK | Lowercase/trim; bidirectional substring in build scorer | No direct index | `Arduino Uno`, `DC Motor`, `Plywood Sheet`, `Wood Glue` | Type match scoring; no canonical component concept |
| Component keywords | `searchKeywords`: nullable `Json`; seed values are string arrays | Free-text array | Lowercase/trim at match time; no alias table | No index inside JSON | `arduino`, `microcontroller`, `uno`; `plywood`; `clear sheet` | Candidate scoring and keyword hints |
| Alternative keywords | `alternativeKeywords`: nullable `Json` | Free-text array | Same as search keywords | No index inside JSON | Alternatives are seeded from component `alternatives` | Used for candidate scoring; does not establish a typed substitution relation |
| Component role / quantity / unit | Enum role; required `Decimal` quantity and required `String` unit | Role is controlled; unit is free text | No unit normalization or compatibility check in matching | Component/project indexes, no quantity/unit index | `REQUIRED_MATERIAL`, `2 pieces`, `1 panel`, `1 bottle` | Display/build semantics; current candidate matching ignores quantity sufficiency and unit compatibility |
| Substitution flag | Required Boolean `canBeSubstituted`, default false | Controlled Boolean | No relation target is stored | No dedicated index | 101/117 main components allow substitution | Affects build behavior, but not a canonical substitute-component relation |

The schema has useful structure, but it is not one taxonomy. It is a set of partially overlapping fields with different owners and different normalization behavior.

## 3. Data Profile

All counts below are from static evaluation of the frozen realistic seed. The main seed asserts 150 primary materials and 30 projects. It also creates nine workflow material copies; those copies are counted separately where relevant.

### Frozen-data totals

| Measure | Count | Notes |
|---|---:|---|
| Learners | 291 | Three named synthetic learners plus 288 generated learners |
| Learners with interests | 291 | 100% of frozen learners |
| Raw stored interest entries | 586 | Repeated across generated learners |
| Distinct stored interest values | 9 | All normalize to the nine keys used in the seed |
| Application interest definitions | 13 | Registry also defines `electronics`, `displays`, `wires_connectors`, and `audio_media` |
| Material categories | 13 | Main seed category source |
| Primary material rows | 150 | Main seed assertion |
| Material rows including workflow copies | 159 | Nine copies duplicate existing taxonomy values |
| Distinct normalized material types | 150 | Workflow copies do not add a type |
| Distinct normalized material tags | 308 | Per-material tags collapsed for profiling |
| Project categories | 6 | Main seed category source |
| Learning projects | 30 | Main seed assertion |
| Distinct normalized project tags | 54 | All projects have tags |
| Required/optional/tool/consumable components | 117 | 82 are marked `required`; 35 are optional/tool/other |
| Required components only | 82 | `isRequired=true` in the main seed |
| Distinct normalized component labels | 83 | Repeated labels occur across projects |
| Materials with no tags | 0/159 | Frozen seed is complete, schema does not require tags |
| Projects with no tags | 0/30 | Frozen seed is complete, schema does not require tags |
| Components with no keywords | 0/117 | Frozen seed is complete, JSON is nullable |
| Materials missing category/type | 0/159 | Schema requires category and display material type |
| Projects missing category | 0/30 | Schema requires project category |
| Components missing category in frozen seed | 0/117 | Schema permits nullable category; future user-authored data can omit it |
| Legacy taxonomy category rows | 12 | `material-taxonomy.data.ts`; not the same as the 13 main-seed categories |
| Legacy taxonomy material types | 39 | Separate data source |
| Legacy taxonomy aliases | 89 | Includes Arabic aliases; main realistic seed does not use this file as its source of truth |

### Category distribution

| Material category | Rows |
|---|---:|
| Electronics & Components | 46 |
| Fabric & Textiles | 16 |
| Tools & Hardware | 16 |
| Art & Craft Supplies | 14 |
| Motors & Mechanical Parts | 14 |
| Plastics & Acrylic | 10 |
| Packaging & Containers | 9 |
| Paper & Cardboard | 9 |
| Wood & Boards | 9 |
| Metal & Fasteners | 8 |
| Lab & Education Supplies | 3 |
| Power & Batteries | 3 |
| Other Reusable Materials | 2 |

| Project category | Projects |
|---|---:|
| Home Experiments | 8 |
| Electronics | 5 |
| Recycling Crafts | 5 |
| Woodworking | 5 |
| Textile Crafts | 4 |
| Robotics | 3 |

### Top values

| Field | Top values (value:count) |
|---|---|
| Material types | `Arduino Uno:2`, `Breadboard:2`, `DC Motor:2`, `Jumper Wires:2`, `LED Pack:2`, `Resistor Pack:2`, `Servo Motor:2`, `Ultrasonic Sensor:2`, `Wax Molds:2`; the remaining 141 types are singletons |
| Material tags | `craft:17`, `sewing:11`, `offcuts:10`, `robotics:10`, `reuse:8`, `mechanical:7`, `recycling:7`, `art:5`, `circuit:5`, `display:5`, `sensor:5`, `storage:5`, `wiring:5`, `woodworking:5`, `microcontroller:4`, `model:4`, `motion:4`, `structure:4`, `tool:4` |
| Project tags | `reuse:9`, `recycling:6`, `home diy:4`, `plants:4`, `arduino:3`, `robotics:3`, `sensors:3`, `wood:3`; 37 other project tags are singletons |
| Component labels | `arduino board:5`; `acrylic paint`, `breadboard`, `dc gear motors`, `jumper wires`, `led pack`, `rubber wheels`, `small hinges`, `wood glue`, `wooden dowel`: 3 each; several labels occur twice |

### Quality findings

| Finding | Evidence | Interpretation |
|---|---|---|
| Duplicate concepts via source drift | Main seed has 13 material categories and 150 generated material types; `material-taxonomy.data.ts` has 12 categories, 39 types, and 89 aliases | Two plausible sources of truth exist; future edits can diverge without a database constraint |
| Category naming drift | `Art & Craft Supplies`, `Art, Craft & Molding`, `Recycling Crafts`, and interest `art_crafts` describe related but different granularity | Category, interest, and use-case layers are mixed |
| Singular/plural drift | `sensor`/`sensors`, `wire`/`wires`, `board`/`boards`, `motor`/`motors`, `mold`/`molds`, and `offcut`/`offcuts` occur across tags, titles, aliases, and components | Current token heuristics partly bridge the drift; raw values remain distinct |
| Punctuation/conjunction drift | `&` and `and` variants occur in category labels and interest aliases; hyphenated device names occur beside spaced names | Matching is not globally canonical |
| Arabic/English asymmetry | Categories have required English and Arabic labels; main material type rows set `nameAr=null` and aliases to English; registry interest `labelAr` values are null | Arabic display exists in categories but not as a complete matching vocabulary |
| Numbers and seed artifacts | Device strings include `HC-SR04`, `AA and 9V`, `ESP32`, `DHT11`, `MQ-2`, `L298N`, `TB6612FNG`, `NEMA 17`, `16x2`, and `0.96-inch`-style device names | Numbers are meaningful identifiers, not cleanup candidates; token normalization must preserve them |
| Sentence-like concepts | Tags themselves are short labels; `suggestedUses` contains sentences such as `Robot cars, LED circuits, sensor prototypes, classroom labs.` | The sentence risk is concentrated in free-text fields, not the tag list; suggested uses must not be treated as controlled tags |
| Likely typo/quality risk | The seed contains both highly specific device identifiers and human-entered variants such as `DC Motor` versus `DC Gear Motors`, `Small Hinges` versus `Door hinge`, and `Plastic Trays` versus `Parts tray` | These are candidate review pairs, not automatically mergeable typos |

No automatic merging or relabeling was performed.

## 4. Concept Separation Findings

| Semantic layer | Current representation | Separation result |
|---|---|---|
| Domain interest | Application registry key, aliases, keywords, and related category-name arrays | Partially separated. It is the best-defined layer, but it is code-owned and English-centric |
| Material family | Mostly category labels such as Electronics, Wood, Plastic, Fabric, Metal | Not consistently separated from material form; current categories often combine family and form/use (`Wood & Boards`, `Packaging & Containers`) |
| Material form/type | `Material.materialType`, nullable `materialTypeId`, aliases | Present structurally, but the required display string is still authoritative in matching and is usually singleton-valued |
| Capability/attribute | Tags, descriptions, suggested uses, and occasional words such as `waterproof`, `motion`, `rechargeable`, `clear` | Not a separate layer; capability, use case, and material identity are mixed in tags/free text |
| Project component | `componentName`, `materialType`, category FK, JSON keywords, alternatives | Partially structured; identity is a free-text bundle and there is no component concept or accepted-material relation |
| Use case | Project title, short description, tags, suggested uses, and interest keywords | Mixed with domain interest and project topic; no explicit use-case field |

The current system therefore has typed *storage fragments* but not a typed semantic model. In particular, `materialType` is asked to behave as both a display label and an identity key; `tags` are asked to behave as both discoverability text and capability metadata; and component alternatives are represented as strings rather than relations.

## 5. Normalization Findings

### Current pipeline

1. Learner-interest resolution trims and lowercases, converts `_` to spaces, converts `&` to `and`, collapses whitespace, resolves known keys/aliases, and deduplicates resolved keys.
2. Interest tokenization splits on whitespace, commas, semicolons, slashes, and pipes. A simple trailing-`s` reduction is applied only to tokens longer than four characters.
3. Material/project application haystacks generally use trim/lowercase. Learner-interest matching checks title, description, material type, tags, and sometimes category names.
4. SQL candidate generation uses case-insensitive `contains` on material title/material type/tags/category names, plus structured category IDs from saved project components.
5. Component build ranking uses lowercase/trim, token overlap, bidirectional substring checks, and the same limited trailing-`s` reduction. It does not use Arabic normalization, diacritic removal, transliteration, stemming, or a language-aware tokenizer.
6. Material type seed aliases are normalized through the imported `normalizeSearchText` utility, but that utility was outside the eight-file production inspection boundary; its exact punctuation/Arabic behavior is therefore not asserted here.

### Representative behavior

| Pair / input | Current result | Why |
|---|---|---|
| `Arduino` / `arduino` | Matches | Lowercase/trim and known-interest alias resolution |
| `Arduino` / `Arduino board` | Not a single deterministic interest-key match | The registry has `Arduino` and `arduino boards` as an alias, but no general phrase-to-concept expansion for every compound |
| `Arduino board` / `Arduino-compatible board` | Not exact; may match by substring in component/material type contexts | Component matching is bidirectional substring/token logic, not canonical concept equality |
| `لوحة أردوينو` / `اردوينو` | Does not resolve as learner-interest aliases | No Arabic learner-interest alias set or Arabic letter normalization exists |
| `DC motor` / `DC motors` | Usually matches in component token comparison | `motors` reduces to `motor` in the component scorer |
| `motor` / `محرك` | Does not match | No bilingual alias relation or transliteration layer |
| `art & crafts` / `art and crafts` | Resolves to the same `art_crafts` interest | Interest normalization maps `&` to `and` and has an explicit alias |
| `DIY` / `home DIY` | `DIY` alone does not resolve to a key; `home DIY` resolves to `home_diy` | A keyword is not automatically a key or alias; the compound alias is explicit |
| slash-separated terms | Tokenized for interest candidate terms; no canonical multi-value representation is stored | Behavior depends on the caller and field path |
| Arabic diacritics/letter variants | No normalization | Arabic labels can display but are not safely interchangeable during matching |

The most important result is not that lexical matching fails everywhere; it is that the same value can match differently depending on whether it travels through interest resolution, SQL candidate generation, Learner Home scoring, or project build scoring.

## 6. Interest Coverage

Coverage uses current production matching semantics first. Material counts include 159 available frozen-seed rows, including workflow copies. Project matching uses the current project haystack fields: title, short description, category labels, and project tags. These are lexical matches, not evidence that a learner would prefer the item.

| Stored interest key | Matching materials | Matching projects | Material matches only free-text | No material match | No project match | Coverage reading |
|---|---:|---:|---:|---:|---:|---|
| `arduino` | 6 | 4 | 6 (100%) | 0 | 0 | Strong but narrow; device identity dominates |
| `robotics` | 16 | 5 | 16 (100%) | 0 | 0 | Good coverage, with broad motion/robot terms |
| `sensors` | 13 | 7 | 13 (100%) | 0 | 0 | Good coverage; sensor subtypes are lexical |
| `circuits` | 13 | 3 | 13 (100%) | 0 | 0 | Material coverage exceeds project coverage |
| `art_crafts` | 10 | 24 | 10 (100%) | 0 | 0 | Very broad project lexical coverage; likely over-inclusive |
| `fabric_textiles` | 20 | 19 | 20 (100%) | 0 | 0 | Good coverage; sewing and textile tags do most of the work |
| `recycling` | 24 | 15 | 24 (100%) | 0 | 0 | Broadest material coverage; likely mixes reuse, packaging, and art |
| `woodworking` | 32 | 11 | 32 (100%) | 0 | 0 | Strong coverage, but `wood`, `board`, and `pallet` are broad |
| `home_diy` | 3 | 12 | 3 (100%) | 0 | 0 | Weak material coverage; project tags and titles compensate |
| **Total distinct interest-match events** | **137** | **100** | **137 (100%)** | **0/9 keys** | **0/9 keys** | **No zero-result key in this frozen seed** |

The zero-result rate is therefore 0% on this synthetic seed, but that is not a cold-start guarantee: all generated learners are assigned one of six repeated interest sets, and every catalog row is hand-authored with matching English terms.

### Matching-source finding

For the nine stored learner keys, 137/137 material matches (100%) were attributed to title, description, material type, or tags. No stored learner key in the frozen seed obtained a category-only match. The current production interest registry contains `relatedMaterialCategoryNames` and `relatedProjectCategoryNames`, but the stored learner keys are mostly configured as `keywords_only`, and the project matcher passes one combined haystack rather than resolving a typed project-category relation.

### Alternative alias review

An analysis-only alias review grouped likely equivalents such as `arduino`/`arduino board`, `sensor`/`sensors`, `wire`/`wires`, `wood`/`woodworking`, `art crafts`/`art & crafts`, `fabric`/`textile`, `reuse`/`recycling`, `pvc`/`plastic pipe`, and `plywood`/`wood panel`. These groups are useful candidates for Baseline B, but they were not applied to production matching and were not treated as automatic merges.

## 7. Component Compatibility Coverage

The frozen-seed profile evaluates each of 117 components against 159 seeded available material rows using the current candidate/relevance signals: category ID, component/material type substring, component name/title overlap, keyword/alternative-keyword occurrence, and tag overlap. Availability was treated as eligible for this frozen seed because the seed creates the primary and workflow copies as `AVAILABLE`; no real reservation or quantity mutation was performed.

| Coverage category | Components | Percentage | Evidence |
|---|---:|---:|---|
| `STRONG_STRUCTURED_MATCH` | 117 | 100.0% | Every component has a seeded category and at least one candidate with category and type-compatible signals |
| `PARTIAL_STRUCTURED_MATCH` | 0 | 0.0% | No frozen component lacked both structured signals |
| `FREE_TEXT_ONLY` | 0 | 0.0% | No component was unmatched by category/type in this seed |
| `NO_MATCH` | 0 | 0.0% | Every component produced at least one candidate |
| `AMBIGUOUS` | 117 | 100.0% risk flag | Strong candidate exists, but candidate-set sizes are broad and compatibility is not explicit |
| `UNMATCHABLE_WITH_CURRENT_DATA` | 0 | 0.0% | Frozen seed contains no missing category/keywords case |

The first five rows are deliberately not mutually exclusive in the risk interpretation: a component can have a strong structured candidate and still be ambiguous because the category contains many materials.

| Component signal | Components with at least one matching candidate | Percentage |
|---|---:|---:|
| Category | 117/117 | 100.0% |
| Material type | 117/117 | 100.0% |
| Title/name | 85/117 | 72.6% |
| Keyword/alternative keyword | 115/117 | 98.3% |
| Material tag | 112/117 | 95.7% |
| Component allows substitution | 101/117 | 86.3% |
| Required quantity/unit present | 117/117 | 100.0% |
| Quantity/unit enforced during matching | 0/117 | 0.0% |

Candidate counts ranged from 2 to 51, with an average of 23.35 candidates per component. This is the main quality risk: the current seed makes matching look complete because category and type strings were deliberately aligned, but it does not state which materials are acceptable, which are merely related, or how much quantity is needed.

Representative risks:

- `Arduino board` can retrieve many electronics rows because category and broad `microcontroller`/`board` terms are shared; exact device compatibility is not represented.
- `Nylon rope`, `Battery holder`, and `Screws` have small candidate sets, but the scorer still treats type substring/keyword hits as relevance without a formal concept relation.
- `Plywood panel` and `Pine strips` distinguish form/type in strings but do not declare whether MDF, wood blocks, or other board forms are acceptable substitutes.
- `Bolts and washers`, `Screws and nuts`, and `Small hinges` use category and keyword overlap; quantity and unit compatibility remain external to candidate relevance.
- `canBeSubstituted` is a Boolean on the component. It does not identify a substitute component, accepted material family, or prohibited material.

## 8. Human-Relevance Sample Results

This is an engineering review sample, not an academic ground-truth dataset. It contains 110 stable synthetic pair rows: 30 learner-interest→material pairs, 30 learner-interest→project pairs, and 50 component→material pairs. No personal data is included; learner references are `L-01` through `L-03` only. The sample was stratified to include current positives, negative candidates, high-score pairs, borderline pairs, bilingual category metadata, category-only evidence, tag-only evidence, and text-only evidence.

### Reviewed sample summary

| Pair family | Rows | Relevant | Partially relevant | Not relevant | Insufficient information |
|---|---:|---:|---:|---:|---:|
| Interest → material | 30 | 22 | 5 | 2 | 1 |
| Interest → project | 30 | 21 | 6 | 2 | 1 |
| Component → material | 50 | 36 | 8 | 5 | 1 |
| **Total** | **110** | **79** | **19** | **9** | **3** |

### Representative reviewed rows

| ID | Pair | Current signal | Label | Short reason |
|---|---|---|---|---|
| IM-01 | `arduino` → Arduino Uno R3 Boards | title/type/tag | RELEVANT | Exact device family and explicit robotics/electronics terms |
| IM-02 | `robotics` → Rubber Wheels | tag/title/use text | RELEVANT | Wheels are a credible robotics component and the seed tag says robotics |
| IM-03 | `sensors` → HC-SR04 Ultrasonic Sensors | title/type/tag | RELEVANT | Exact sensor subtype |
| IM-04 | `circuits` → Breadboard Kits | tag/description | RELEVANT | Breadboard and circuit terms are explicit |
| IM-05 | `art_crafts` → Acrylic Paint | type/tag/use text | RELEVANT | Craft/art terms are explicit |
| IM-06 | `fabric_textiles` → Denim Offcuts | type/tag | RELEVANT | Fabric/sewing material with textile tags |
| IM-07 | `recycling` → Plastic Bottle Caps | tag/description | RELEVANT | Reuse/recycling is explicit |
| IM-08 | `woodworking` → Plywood Sheet Offcuts | title/type/tag | RELEVANT | Wood form and woodworking use are explicit |
| IM-09 | `home_diy` → Plywood Sheet Offcuts | no current interest signal | PARTIALLY_RELEVANT | Plausible DIY material, but no DIY/home/repair term in the match path |
| IM-10 | `home_diy` → Arduino Uno R3 Boards | no current signal | NOT_RELEVANT | Electronics item is not a useful default DIY match without a project context |
| IM-11 | `art_crafts` → DC Gear Motors | no current signal | NOT_RELEVANT | Robotics/mechanical component is outside the craft interest |
| IM-12 | `fabric_textiles` → Acrylic Paint | no current signal | INSUFFICIENT_INFORMATION | Paint could support textile decoration, but the listing does not identify that use |
| IP-01 | `robotics` → Obstacle Avoidance Robot | category/title/tag | RELEVANT | Exact project topic and seeded tags |
| IP-02 | `arduino` → Line Follower Robot | tag/component text | RELEVANT | Arduino component and project tag are explicit |
| IP-03 | `circuits` → Simple LED Circuit | title/description/tag | RELEVANT | Exact use case |
| IP-04 | `art_crafts` → Recycled Cardboard Desk Organizer | tag/description | RELEVANT | Craft and recycling use case |
| IP-05 | `fabric_textiles` → Fabric Pencil Case | title/tag/component | RELEVANT | Exact textile project |
| IP-06 | `recycling` → Glass Jar Herb Planter | tag/title/description | PARTIALLY_RELEVANT | Reuse is explicit; gardening is a use case, not a recycling concept by itself |
| IP-07 | `home_diy` → Plywood Laptop Stand | title/tag/component | RELEVANT | DIY/home use is explicit in tags and project framing |
| IP-08 | `home_diy` → Simple LED Circuit | no direct home/DIY term | NOT_RELEVANT | Electronics learning project is not automatically home DIY |
| IP-09 | `art_crafts` → Obstacle Avoidance Robot | no direct craft signal | NOT_RELEVANT | Robotics project is a negative lexical candidate |
| IP-10 | `fabric_textiles` → Recycled Cardboard Desk Organizer | broad reuse/craft terms | INSUFFICIENT_INFORMATION | Craft overlap exists, but no textile construction evidence |
| CM-01 | Arduino board → Arduino Uno R3 Boards | category+type+title+keywords | RELEVANT | Exact candidate and strong structured agreement |
| CM-02 | Arduino board → ESP32 Development Board | category+type+keywords | PARTIALLY_RELEVANT | Plausible substitute, but not declared as accepted by the component |
| CM-03 | Arduino board → Paint Brushes | no signal | NOT_RELEVANT | Negative candidate |
| CM-04 | Ultrasonic distance sensor → HC-SR04 Ultrasonic Sensors | category+type+title+keywords | RELEVANT | Exact sensor identity |
| CM-05 | DC gear motors → Small DC Gear Motors Pair | category+type+title+tag | RELEVANT | Exact motor family |
| CM-06 | DC gear motors → Servo Motor | same broad mechanical category | PARTIALLY_RELEVANT | Mechanical/actuator relation does not make it a safe substitute |
| CM-07 | Plywood panel → Plywood Sheet Offcuts | category+type+keyword | RELEVANT | Exact form and family |
| CM-08 | Plywood panel → MDF Offcuts | category+keyword | PARTIALLY_RELEVANT | Plausible board substitute, but dimensional/strength rules are absent |
| CM-09 | Plywood panel → Ultrasonic Sensor | no signal | NOT_RELEVANT | Negative candidate |
| CM-10 | Screws → Screws and Nuts Box | category+type+tag | RELEVANT | Exact hardware family |
| CM-11 | Screws → Small Hinges | category/tag overlap | PARTIALLY_RELEVANT | Same hardware category but not interchangeable |
| CM-12 | Nylon rope → Nylon Rope | category+type+title | RELEVANT | Exact material type |
| CM-13 | Nylon rope → Wooden Dowels | no meaningful type relation | NOT_RELEVANT | Negative candidate |
| CM-14 | Clear acrylic sheets → Acrylic Sheet Offcuts | category+type+title+keywords | RELEVANT | Exact form/material |
| CM-15 | Clear acrylic sheets → Polycarbonate Sheet | category+keywords | PARTIALLY_RELEVANT | Transparent sheet may substitute, but capability/thickness is absent |

The remaining 95 rows use the same review rubric and stable IDs (`IM-13..IM-30`, `IP-11..IP-30`, `CM-16..CM-50`). They cover the repeated labels from `Cardboard Sheets`, `Fabric Scraps`, `Rubber Wheels`, `Battery Holder`, `PVC Pipes`, `Bolts and Washers`, `Small Hinges`, `Wood Glue`, `Wooden Dowels`, `Plastic Trays`, and the corresponding cross-category negatives. The full row count and aggregate labels above are the durable evidence; temporary row-generation outputs were removed before completion.

## 9. Confirmed Quality Problems

| Status | Problem | Evidence and impact |
|---|---|---|
| `CONFIRMED` | Interest→material matching is free-text dependent | 137/137 frozen interest→material matches used title, description, material type, or tags; none was a stored canonical relation |
| `CONFIRMED` | The database does not enforce one taxonomy source | Main seed and `material-taxonomy.data.ts` contain different category/type/alias inventories |
| `CONFIRMED` | Tags are not controlled vocabulary | `MaterialTag` and `ProjectTag` are required strings with only per-parent uniqueness; 308 material-tag values and 54 project-tag values remain globally unrestricted |
| `CONFIRMED` | Component identity is not canonical | `componentName`, component `materialType`, keywords, alternatives, and nullable category are separate fields with no component concept FK |
| `CONFIRMED` | Quantity and unit are not part of candidate matching | All 117 components have quantity/unit, but the matching scorer does not verify candidate quantity, unit conversion, or sufficiency |
| `CONFIRMED` | Substitution is not a relation | `canBeSubstituted` is a Boolean; alternatives are JSON/string keywords, not accepted substitute concepts |
| `CONFIRMED` | Arabic matching is incomplete | Main material type rows have null Arabic names and English aliases; learner-interest definitions have null Arabic labels and no Arabic alias normalization |
| `CONFIRMED` | Project-category relation metadata is not a typed matching relation | The registry declares related project category names, but the current project matcher evaluates one lexical haystack instead of a category ID/concept relation |
| `STRONGLY_INDICATED` | Broad categories create false positives | Component candidate sets range from 2 to 51, averaging 23.35, even though every component has a structured category/type candidate |
| `STRONGLY_INDICATED` | `recycling`, `art_crafts`, and `woodworking` are broad interests | They produce 24, 10, and 32 material matches respectively, with lexical terms spanning family, use case, and provenance |
| `STRONGLY_INDICATED` | `suggestedUses` is underused taxonomy evidence | It contains useful use-case sentences but is not part of the inspected material interest haystack |
| `HYPOTHESIS` | Explicit compatibility edges will improve human relevance enough to justify schema cost | The seed shows strong structured coverage, but the review sample is small and offline comparison is still required |

## 10. Design Options

| Option | Advantages | Limitations / maintenance cost | Assessment |
|---|---|---|---|
| 0 — Keep current structure | No migration; compatible with baseline; easy seed authoring; adequate for current synthetic seed | Repeated aliases, broad tags, free-text components, bilingual gaps, fragile substring behavior, weak explanations, and no explicit substitution/acceptance semantics | Accept only as the short-term baseline/fallback |
| 1 — Controlled vocabulary only | Reduces spelling drift; aliases become data; low conceptual complexity | One flat concept table would mix interest, material family, component, capability, and use case; relations would remain implicit and ambiguous | Better than current fields, but insufficient alone |
| 2 — Typed concept vocabulary | Separates `INTEREST`, `MATERIAL_FAMILY`, `MATERIAL_FORM`, `CAPABILITY`, `PROJECT_TOPIC`, `COMPONENT`, and `USE_CASE`; supports bilingual labels, aliases, features, and explanations | Requires concept ownership, alias review, backfill, and seed/admin discipline; can be overengineered if all types are added immediately | Recommended foundation |
| 3 — Typed compatibility rules | Makes `component accepts family/form`, `component may substitute component`, `project uses component`, and `interest relates to topic` explicit; improves candidate precision and explanation codes | More relations and integrity rules; needs carefully labeled review data to avoid encoding arbitrary expert assumptions | Recommended after Option 2; justified for component matching |
| 4 — General knowledge graph | Flexible arbitrary nodes/edges; expressive for future research | High query and integrity complexity, difficult admin tooling, unclear ownership, hard-to-test edges, and no demonstrated benefit over typed relations | Defer/reject for current scope |

Option 3 is not justified because graphs are fashionable; it is justified because a component match has a different meaning from an interest match, a material-family match, or a capability match. The current Boolean substitution flag cannot express those distinctions.

## 11. Recommended Minimal Design

### Immediate concepts

| Model/relation | Purpose | Minimum fields and constraints | Ownership / source of truth | Recommendation use |
|---|---|---|---|---|
| `CanonicalConcept` | Stable identity for one semantic concept | `id`, `conceptType` enum, `canonicalKey` unique, `labelEn`, `labelAr`, `isActive`, timestamps | Curated taxonomy owner; seed/admin source | Feature IDs, deterministic joins, explanation metadata |
| `ConceptAlias` | Bilingual and legacy lookup | `conceptId`, `alias`, `normalizedAlias`, `language`, `source`; unique `(language,normalizedAlias)` where unambiguous | Curated review; collisions require explicit disambiguation | Resolve old interests/types/tags without changing display text |
| `MaterialConcept` | Attach family/form/capability/use-case concepts to a material | `materialId`, `conceptId`, optional `relationType`; unique `(materialId,conceptId,relationType)` | Material curator or reviewed ingestion | Structured candidate filters and item features |
| `ProjectConcept` | Attach project topic/use-case/concept metadata | `projectId`, `conceptId`, relation type; unique parent/concept/relation | Project curator | Project-topic matching and explanation |
| `ComponentConcept` | Give a required component a canonical identity | `componentId`, `conceptId`, relation type; unique parent/concept/relation | Project author/reviewer | Component matching and LightFM item/project features |
| `ComponentCompatibility` | Explicitly state accepted family/form or substitution | `componentId`, `targetConceptId` or `targetComponentConceptId`, `relationType`, `strength`, optional `isRequired`, provenance; unique relation key | Reviewed project taxonomy owner | Candidate filtering, substitution, explanation, coverage metrics |

The first implementation slice should not require all seven concept types. Start with `INTEREST`, `MATERIAL_FAMILY`, `MATERIAL_FORM`, `PROJECT_TOPIC`, and `COMPONENT`. Add `CAPABILITY` only for repeated, reviewable attributes such as conductive, waterproof, flexible, heat-resistant, or rechargeable. Add `USE_CASE` only when the offline sample shows it improves beyond project topic.

### Deferred concepts

- `CAPABILITY` as a full controlled vocabulary: useful later, but not required to prove the first component-quality gain.
- `USE_CASE`: useful for explanations and semantic experiments, but currently mixed into titles/descriptions and requires clearer labeling guidance.
- General arbitrary graph nodes/edges: rejected for this phase.
- Embeddings, pgvector, Qdrant, LightFM, ALS, and learned ranking: downstream experiments only.

### Fallback behavior

Until a row is migrated or reviewed, retain current fields and production matcher behavior. A missing canonical concept must never exclude an otherwise eligible material or project. Explanations should distinguish `canonical concept`, `legacy lexical`, and `fallback text` evidence. A compatibility rule should be additive first; it should not make availability or business eligibility softer or harder without a separately approved experiment.

## 12. Existing Field Migration Strategy

| Existing field | Decision | Rationale and future use |
|---|---|---|
| Material category | Retain as display/legacy field; migrate semantic meaning to `MATERIAL_FAMILY` and, where justified, `MATERIAL_FORM` | Existing category FK is useful for browsing and fallback; do not assume one category equals one family |
| Material type | Retain as display field; migrate identity to canonical `MATERIAL_FORM`/`COMPONENT` concepts | The string is valuable for users and backward compatibility, but singleton type rows and aliases need canonical identity |
| Material tags | Keep temporarily for search/discovery; map reviewed tags to typed concepts; deprecate taxonomy authority later | Tags currently mix capability, use case, family, and marketing terms |
| Project category | Retain as display/filter field; map to `PROJECT_TOPIC` | Current category labels are useful but not a sufficient bilingual concept relation |
| Project tags | Keep for discovery; map only reviewed values to project topics/use cases/capabilities | Do not bulk-convert tags without pair-level review |
| Learner interests | Keep array for backward compatibility; resolve to canonical `INTEREST` IDs at read/write boundaries later | Current application registry is the strongest existing source but needs bilingual aliases and database-backed ownership |
| Required-component title | Retain as display field; map to canonical `COMPONENT` | Human-facing name should not be discarded |
| Component keywords | Keep temporarily as lexical fallback; map reviewed terms to component/material-form aliases | JSON keywords are useful candidate hints but not a relation model |

No current field is removed in this phase. A migration should be dual-read/dual-write only after canonical seed fixtures and collision reports exist.

## 13. Offline Evaluation Plan

Use the same reviewed 110-row pair dataset for all candidates, with pair labels and evidence-source annotations preserved.

| Candidate | Definition |
|---|---|
| Baseline A | Current production matcher and current deterministic hybrid recommender |
| Baseline B | Current matcher plus manually reviewed alias groups only; no schema or score change |
| Candidate C | Typed concept matching using canonical concepts and aliases; no explicit compatibility edges |
| Candidate D | Candidate C plus typed component/material-family/form compatibility and reviewed substitution relations |

### Required metrics

| Metric | Definition / slice |
|---|---|
| Precision@K | Reviewed relevant pairs in top K, for K=5 and K=10 |
| Recall@K | Reviewed relevant pairs retrieved in top K |
| HitRate@K | At least one relevant result in top K per interest/component query |
| Component coverage | Components with at least one acceptable material candidate |
| Zero-result rate | Queries with no eligible candidate |
| False-positive rate | Retrieved pairs labeled not relevant |
| False-negative rate | Reviewed relevant pairs not retrieved |
| Explanation coverage | Results with a specific typed or lexical reason, not a generic fallback |
| Taxonomy coverage | Items/queries with canonical concepts and resolved aliases |
| Cold-start coverage | New learner with interests but no interactions; new item/project with no interactions |

### Promotion gates

| Gate | Minimum condition for the next candidate |
|---|---|
| No regression | Candidate C/D must not reduce Precision@10 or HitRate@10 by more than 2 percentage points overall or in either language slice |
| Component quality | Candidate D must improve component Precision@10 by at least 5 percentage points over Baseline A, or reduce false positives by at least 20% with no more than 2-point recall loss |
| Coverage | Zero-result rate must not increase; component coverage must remain at least Baseline A |
| Explanations | At least 95% of promoted results have a specific source code; typed matches must name the relation |
| Cold start | Candidate must improve or preserve cold-start HitRate@10 and taxonomy coverage |
| Operational safety | No additional synchronous database fan-out on the Learner Home request path; current eligibility rules remain authoritative |
| Evidence quality | Results must hold across category, component role, English/Arabic metadata, and high/low candidate-set slices; seed-only gains are not sufficient for production adoption |

No A/B experiment was implemented.

## 14. ML Readiness

The minimal typed design can provide stable metadata without replacing collaborative signals.

| Future consumer | Taxonomy feature |
|---|---|
| LightFM item features | Material family/form/capability concept IDs; project topic/use-case/component concept IDs; source/condition remain separate non-taxonomy features |
| LightFM user features | Learner interest concept IDs, skill level, and optionally language/region features if policy permits |
| Cold-start retrieval | Interest→project-topic and interest→material-family relations; component→accepted-form relations |
| Hard retrieval filters | Eligibility, availability, ownership, quantity, and explicit compatibility constraints; taxonomy must not override business rules |
| Ranking features | Count/strength of typed concept overlaps, exact form match, accepted substitution, relation provenance, and taxonomy confidence |
| Explanation metadata | Canonical label, relation type, alias used, source, confidence, and fallback-vs-typed evidence |

Details that add complexity without current measurable ML value include an unrestricted graph, every possible material attribute, unreviewed ontology hierarchies, automatic stemming, and storing embeddings before lexical/typed baselines are measured. Taxonomy features should complement—not replace—interaction, popularity, recency, location, availability, and reservation signals.

## 15. Risks and Limitations

- The frozen seed is synthetic and intentionally aligned; it demonstrates implementation behavior, not real-world recommendation quality.
- The profile is static-source analysis. It does not query production or user data and does not mutate a database.
- The eight-file production inspection boundary prevented opening the shared `normalizeSearchText` utility; its exact behavior is recorded as an audit limitation.
- The human-relevance sample is small, engineering-reviewed, and not statistically generalizable.
- Category/type coverage is stronger in the seed than the nullable/free-text schema guarantees for future authored projects and materials.
- Current candidate counts do not prove that every candidate is returned after availability, ownership, reservation, and location filters.
- Arabic labels are present in category rows but not sufficient to claim bilingual semantic matching.
- The recommendation baseline, event/outbox, hydration, caching, and performance foundations were not revisited; this report treats them as accepted context.
- No manual relabeling was applied to production data, and no alias group was added to application code.

## 16. Proposed Implementation Slices

1. **Taxonomy contract and fixture slice** — define typed concept enums, canonical keys, bilingual labels, alias collision rules, and review fixture format; no recommender behavior change.
2. **Read-only inventory and collision report** — materialize candidate mappings from current fields, report ambiguous aliases/category collisions, and require review sign-off.
3. **Canonical concept storage** — add concepts and aliases with dual-read fallback; migrate only reviewed seed fixtures.
4. **Material/project/component attachments** — attach reviewed concepts while retaining legacy fields and current matcher behavior.
5. **Typed explanation metadata** — expose internal reason codes for canonical, alias, compatibility, and fallback lexical matches without changing public contracts.
6. **Component compatibility offline candidate** — implement analysis-only component-family/form/substitution matching and compare against Baselines A/B.
7. **Shadow evaluation** — run Candidates C/D offline and in shadow mode with current eligibility and observability controls; define promotion decision.
8. **Controlled rollout or defer** — only after promotion gates pass; otherwise retain the current baseline and improve the reviewed taxonomy set.

## 17. Files Inspected

### Recommendation documentation

- `docs/recommendation/README.md`
- `docs/recommendation/implementation-status.md`
- `docs/recommendation/recommendation-evaluation-experiment-spec.ar.md`
- `docs/recommendation/events.md`
- `docs/recommendation/version-registry.md`

### Production files (eight-file boundary)

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/seed.ts`
- `apps/backend/prisma/seeds/material-taxonomy.data.ts`
- `apps/backend/prisma/seeds/mock-learning-projects.data.ts`
- `apps/backend/src/modules/learner-home/learner-home.repository.ts`
- `apps/backend/src/modules/learner-home/learner-home.scoring.ts`
- `apps/backend/src/modules/learning-projects/learning-projects.build-candidate-ranking.ts`
- `apps/backend/src/modules/learner-home/learner-interest-taxonomy.ts`

The mock project seed was inspected for its schema shape and generic pagination fixtures; the realistic 30-project inventory is defined in `prisma/seed.ts`. Unrelated delivery, supplier, admin, authentication, AI chat, notification, and reservation lifecycle modules were not inspected.

## 18. Temporary Analysis Artifacts

A read-only profiling script was created under `apps/backend/scripts/tmp-taxonomy-profile.ts` and a generated JSON profile was created at the repository root during analysis. Both were removed before completion. No generated dataset, credential, user data, schema change, seed change, or production-code change remains.

## 19. Decision

ADOPT_TYPED_TAXONOMY_WITH_COMPATIBILITY
