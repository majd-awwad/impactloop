import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TAXONOMY_COMPATIBILITY_RELATION_SEEDS,
  type TaxonomyCompatibilityRelationSeed,
} from './taxonomy-compatibility-relations.data.js';
import {
  assertSatisfiedByFoundationAuthority,
  prepareTaxonomyCompatibilityRelations,
} from './taxonomy-compatibility-relations.seed.js';
import { TAXONOMY_CONCEPT_RELATION_COMPATIBILITY } from './taxonomy-concept-relation.js';
import { TAXONOMY_CONCEPT_SEEDS } from './taxonomy-foundation.data.js';
import { isValidTaxonomyCanonicalKey } from './taxonomy-normalization.js';

const tuples = TAXONOMY_COMPATIBILITY_RELATION_SEEDS.map((relation) => [
  relation.relationType,
  relation.sourceCanonicalKey,
  relation.targetCanonicalKey,
]);

test('exports the complete reviewed LM-02 compatibility matrix', () => {
  assert.deepEqual(tuples, [
    ['INTEREST_RELEVANT_TO', 'interest:electronics', 'material-family:electronics'],
    ['INTEREST_RELEVANT_TO', 'interest:arduino', 'material-form:arduino-uno'],
    ['INTEREST_RELEVANT_TO', 'interest:robotics', 'material-family:electronics'],
    ['INTEREST_RELEVANT_TO', 'interest:robotics', 'material-family:mechanical'],
    ['INTEREST_RELEVANT_TO', 'interest:sensors', 'material-form:ultrasonic-sensor'],
    ['INTEREST_RELEVANT_TO', 'interest:circuits', 'material-family:electronics'],
    ['INTEREST_RELEVANT_TO', 'interest:wires-connectors', 'material-form:jumper-wires'],
    ['INTEREST_RELEVANT_TO', 'interest:woodworking', 'material-family:wood'],
    ['INTEREST_RELEVANT_TO', 'interest:fabric-textiles', 'material-family:fabric'],
    ['INTEREST_RELEVANT_TO', 'interest:art-crafts', 'material-family:craft'],
    ['INTEREST_RELEVANT_TO', 'interest:recycling', 'material-family:reusable'],
    ['INTEREST_RELEVANT_TO', 'interest:home-diy', 'material-family:tools'],
    ['SATISFIED_BY', 'component:arduino-board', 'material-form:arduino-uno'],
    ['SATISFIED_BY', 'component:ultrasonic-distance-sensor', 'material-form:ultrasonic-sensor'],
    ['SATISFIED_BY', 'component:dc-gear-motors', 'material-form:dc-motor'],
    ['SATISFIED_BY', 'component:jumper-wires', 'material-form:jumper-wires'],
    ['SATISFIED_BY', 'component:rubber-wheels', 'material-form:rubber-wheels'],
    ['SATISFIED_BY', 'component:breadboard', 'material-form:breadboard'],
    ['SATISFIED_BY', 'component:led', 'material-form:led-pack'],
    ['SATISFIED_BY', 'component:resistor', 'material-form:resistor-pack'],
    ['SATISFIED_BY', 'component:battery-holder', 'material-form:battery-holder'],
    ['SATISFIED_BY', 'component:acrylic-sheets', 'material-form:acrylic-sheet'],
    ['SATISFIED_BY', 'component:pvc-pipes', 'material-form:pvc-pipes'],
    ['SATISFIED_BY', 'component:small-hinges', 'material-form:small-hinges'],
    ['SATISFIED_BY', 'component:screws-and-nuts', 'material-form:screws-and-nuts'],
    ['SATISFIED_BY', 'component:plywood-panel', 'material-form:plywood-sheet'],
    ['SATISFIED_BY', 'component:mdf-offcut', 'material-form:mdf-offcuts'],
    ['SATISFIED_BY', 'component:cardboard-sheets', 'material-form:cardboard-sheets'],
    ['SATISFIED_BY', 'component:fabric-scraps', 'material-form:fabric-scraps'],
    ['SATISFIED_BY', 'component:denim-offcuts', 'material-form:denim-offcuts'],
    ['SATISFIED_BY', 'component:wooden-dowel', 'material-form:wooden-dowels'],
    ['SATISFIED_BY', 'component:wood-glue', 'material-form:wood-glue'],
  ]);
  assert.equal(TAXONOMY_COMPATIBILITY_RELATION_SEEDS.length, 32);
  assert.equal(
    TAXONOMY_COMPATIBILITY_RELATION_SEEDS.filter(({ relationType }) =>
      relationType === 'INTEREST_RELEVANT_TO').length,
    12,
  );
  assert.equal(
    TAXONOMY_COMPATIBILITY_RELATION_SEEDS.filter(({ relationType }) =>
      relationType === 'SATISFIED_BY').length,
    20,
  );
});

test('uses canonical-key identity with unique, directed, compatible rows only', () => {
  const identities = new Set<string>();

  for (const relation of TAXONOMY_COMPATIBILITY_RELATION_SEEDS) {
    assert.deepEqual(Object.keys(relation).sort(), [
      'relationType',
      'sourceCanonicalKey',
      'sourceConceptType',
      'targetCanonicalKey',
      'targetConceptType',
    ]);
    assert.equal(isValidTaxonomyCanonicalKey(relation.sourceCanonicalKey), true);
    assert.equal(isValidTaxonomyCanonicalKey(relation.targetCanonicalKey), true);
    assert.notEqual(relation.sourceCanonicalKey, relation.targetCanonicalKey);

    const compatibility = TAXONOMY_CONCEPT_RELATION_COMPATIBILITY[relation.relationType];
    assert.ok((compatibility.sourceTypes as readonly string[]).includes(relation.sourceConceptType));
    assert.ok((compatibility.targetTypes as readonly string[]).includes(relation.targetConceptType));

    const identity = tuples.find((tuple) => tuple[1] === relation.sourceCanonicalKey &&
      tuple[2] === relation.targetCanonicalKey && tuple[0] === relation.relationType)!.join(':');
    assert.equal(identities.has(identity), false);
    identities.add(identity);
  }

  assert.equal(prepareTaxonomyCompatibilityRelations(TAXONOMY_COMPATIBILITY_RELATION_SEEDS),
    TAXONOMY_COMPATIBILITY_RELATION_SEEDS);
});

test('every matrix endpoint exists in the foundation with its declared type', () => {
  const concepts = new Map(TAXONOMY_CONCEPT_SEEDS.map((seed) => [seed.canonicalKey, seed]));

  for (const relation of TAXONOMY_COMPATIBILITY_RELATION_SEEDS) {
    assert.equal(concepts.get(relation.sourceCanonicalKey)?.conceptType, relation.sourceConceptType);
    assert.equal(concepts.get(relation.targetCanonicalKey)?.conceptType, relation.targetConceptType);
  }
});

test('all reviewed component mappings have one exact material form authority', () => {
  assert.doesNotThrow(() =>
    assertSatisfiedByFoundationAuthority(TAXONOMY_COMPATIBILITY_RELATION_SEEDS),
  );

  const satisfiedSources = new Set(
    TAXONOMY_COMPATIBILITY_RELATION_SEEDS
      .filter(({ relationType }) => relationType === 'SATISFIED_BY')
      .map(({ sourceCanonicalKey }) => sourceCanonicalKey),
  );
  const componentKeys = TAXONOMY_CONCEPT_SEEDS
    .filter(({ conceptType }) => conceptType === 'COMPONENT')
    .map(({ canonicalKey }) => canonicalKey);
  assert.deepEqual([...satisfiedSources].sort(), componentKeys.sort());
});

test('ambiguous component material-type authority is rejected instead of silently included', () => {
  const arduinoForm = TAXONOMY_CONCEPT_SEEDS.find(
    ({ canonicalKey }) => canonicalKey === 'material-form:arduino-uno',
  )!;
  const ambiguousFoundation = [
    ...TAXONOMY_CONCEPT_SEEDS,
    { ...arduinoForm, canonicalKey: 'material-form:arduino-uno-duplicate' },
  ];

  assert.throws(
    () => assertSatisfiedByFoundationAuthority(
      TAXONOMY_COMPATIBILITY_RELATION_SEEDS,
      ambiguousFoundation,
    ),
    /Ambiguous material form authority: component:arduino-board/,
  );
});

test('unsupported interests and invalid matrix structures fail closed', () => {
  const sourceKeys = new Set(
    TAXONOMY_COMPATIBILITY_RELATION_SEEDS.map(({ sourceCanonicalKey }) => sourceCanonicalKey),
  );
  assert.equal(sourceKeys.has('interest:displays'), false);
  assert.equal(sourceKeys.has('interest:audio-media'), false);

  const first = TAXONOMY_COMPATIBILITY_RELATION_SEEDS[0]!;
  assert.throws(
    () => prepareTaxonomyCompatibilityRelations([first, first]),
    /Duplicate taxonomy compatibility relation/,
  );
  assert.throws(
    () => prepareTaxonomyCompatibilityRelations([{
      ...first,
      targetCanonicalKey: first.sourceCanonicalKey,
    }]),
    /Self taxonomy relation/,
  );
  assert.throws(
    () => prepareTaxonomyCompatibilityRelations([{
      ...first,
      sourceCanonicalKey: 'not-a-canonical-key',
    } as TaxonomyCompatibilityRelationSeed]),
    /Invalid taxonomy source canonical key/,
  );
});
