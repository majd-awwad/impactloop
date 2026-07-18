# Recommendation Phase 1D — Flutter Impression Propagation

## Contract

The backend’s optional `recommendationImpressionId` is nested inside the
returned `material` or `project` entity. Flutter maps it into the existing
typed `DiscoveryMaterial` and `LearningProject` models. Missing, null, or
blank values remain null. The response shape and recommendation ordering are
unchanged.

The value is carried only as transient route context:

`Learner Home card → GoRouter extra → detail page → supported action request`

It is not placed in the URL, secure storage, shared preferences, a global
provider, or a global Dio interceptor. The only new request header is
`X-Recommendation-Impression-Id`; `X-Recommendation-Surface` is intentionally
not emitted by Flutter.

## Supported journeys

| Journey | Context source | Header behavior |
| --- | --- | --- |
| Recommended material → detail/view | material entity → material route | detail request carries the ID |
| Recommended material → like/unlike | material detail state | action carries the same ID |
| Recommended material → reservation | material detail state | create request carries the same ID; body is unchanged |
| Recommended project → detail/view | project entity → project route | detail page retains the ID for supported actions |
| Recommended project → like/unlike | project detail state | action carries the same ID |
| Recommended project → save/unsave/follow/unfollow | project detail state | action carries the same ID |
| Recommended project → build start | project detail state/build route | start request carries the same ID |
| Recommended project → build progress | build route extra | progress updates carry the same ID |
| Normal discovery/deep link | no recommendation entity context | no recommendation header |

The project-detail existing-build “continue checklist” path forwards its
current route extra. Continue Projects itself supplies no impression context,
so an unrelated existing build starts with no recommendation header. Changing
the material ID, repository, or impression context reloads detail state; build
state resets when its project or context changes, preventing stale-context
leakage.

## Privacy and delivery semantics

The identifier is opaque and is stored only in an in-memory Dart field and
transient route extra. Flutter sends no learner ID, score, reason, section,
surface, or other recommendation metadata. The backend validates attribution
and its bounded window; direct and assisted attribution remain separate server
semantics. Project views and supplier-side reservation lifecycle actions are
not claimed as supported by this client change.

Header construction is additive and non-fatal to the existing business
request. Blank values are omitted. There are no additional HTTP calls and no
per-item client writes. Existing clients and non-recommendation flows remain
valid when the optional field is absent.

## Validation plan and evidence

Focused coverage includes:

- mapper acceptance and omission for material and project payloads;
- normalization of null/blank/trimmed identifiers;
- material view, like, and unlike headers;
- reservation header plus unchanged request body;
- project engagement and build-progress headers;
- omission of the header when no context is present and absence of a surface
  header.

Run from `apps/frontend`:

```text
flutter test test/material_discovery_api_mapper_test.dart \
  test/learning_hub_api_mapper_test.dart \
  test/recommendation_impression_headers_test.dart
flutter analyze
```

Observed validation:

- focused propagation suite: 9/9 passed;
- mapper suite plus propagation suite: 34/34 passed;
- complete affected material/project/reservation/spotlight/build/widget set:
  128/128 passed;
- direct analyzer over the changed core, home, material-discovery,
  learning-hub, and reservation paths: no issues reported;
- repository-wide `flutter test`: 392 tests executed; the recommendation and
  affected learner flows passed. The prior run reported 8 pre-existing
  failures; an isolated reproduction deterministically reproduced 6: four
  `admin_portal_pages_render_test.dart` expectations, the
  `supplier_project_impact_panel_test.dart` “Solar charger” expectation, and
  `registration_wizard_test.dart`’s `LearnerProfileDraft.toJson` compilation
  failure. Two additional failures from the prior aggregate count were not
  reproducible in isolation and no Phase 1D file touches any of these tests;
- full `flutter analyze` exceeded the local two-minute command window without
  diagnostics; the targeted analyzer completed cleanly. Dart format completed
  successfully, but its command exits non-zero when the SDK cannot update the
  workspace-external telemetry session file.

No production migration, generated Prisma file, frontend global state, or
temporary benchmark instrumentation is part of Phase 1D.

## Final scope audit

All 21 changed production files are required: two model/mapping files carry
the additive field, one request helper and six repository/API files add
request-scoped headers, three navigation/card files carry transient context,
five material/project detail/action files retain it through supported flows,
two build files cover start/progress lifetime, and three reservation files
forward create context. The mock repository and three existing test fakes only
adopt optional named parameters required by the repository contracts. No
production change was classified unnecessary or overbroad; no shared model
equality/hash behavior exists to alter, and no global API-client state was
introduced.

The final audit added strict non-string rejection for material IDs, safe route
extra parsing, concurrent A/B/C header isolation, recommended-to-ordinary
replacement coverage, cross-entity request-path assertions, and a build-route
state reset guard. All supported API calls remain one business request; there
is no tracking request, detail recovery request, refresh, retry duplication,
or persistent attribution state.

The proposed buildable commit split is: (1) models/header helper/parsing
tests, (2) material/reservation propagation, (3) project/build propagation,
and (4) documentation. No commit was created during this audit.

## Limitations

Route extras are intentionally ephemeral: a browser refresh, app restart, or
direct deep link cannot recover a prior recommendation impression. This is a
privacy and isolation tradeoff; durable attribution remains the backend
outbox/event system’s responsibility. The client does not validate entity
ownership or the 24-hour attribution window.
