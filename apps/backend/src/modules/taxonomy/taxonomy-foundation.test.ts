import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAXONOMY_CONCEPT_SEEDS,
} from './taxonomy-foundation.data.js';
import {
  MAX_TAXONOMY_BATCH_SIZE,
  TaxonomyFoundationRepository,
  resolveTaxonomyAliasCandidates,
  validateTaxonomyVocabulary,
} from './taxonomy-foundation.repository.js';
import {
  isValidTaxonomyCanonicalKey,
  normalizeTaxonomyAlias,
} from './taxonomy-normalization.js';

test('normalization preserves identifiers and handles bilingual punctuation safely', () => {
  assert.equal(normalizeTaxonomyAlias(' Arduino '), 'arduino');
  assert.equal(normalizeTaxonomyAlias('Arduino-compatible board'), 'arduino-compatible board');
  assert.equal(normalizeTaxonomyAlias('لوحة أردوينو'), 'لوحة اردوينو');
  assert.equal(normalizeTaxonomyAlias('أَرْدُوِينُو'), 'اردوينو');
  assert.equal(normalizeTaxonomyAlias('HC-SR04'), 'hc-sr04');
  assert.equal(normalizeTaxonomyAlias('5V relay'), '5v relay');
  assert.equal(normalizeTaxonomyAlias('LCD 16x2'), 'lcd 16x2');
  assert.equal(normalizeTaxonomyAlias('art & crafts'), 'art and crafts');
  assert.equal(normalizeTaxonomyAlias('art and crafts'), 'art and crafts');
  assert.equal(normalizeTaxonomyAlias('home_diy'), 'home diy');
  assert.equal(normalizeTaxonomyAlias('A/B'), 'a / b');
  assert.notEqual(normalizeTaxonomyAlias('DC motor'), normalizeTaxonomyAlias('DC motors'));
});

test('canonical keys use globally prefixed stable identity', () => {
  assert.equal(isValidTaxonomyCanonicalKey('interest:arduino'), true);
  assert.equal(isValidTaxonomyCanonicalKey('material-form:hc-sr04'), true);
  assert.equal(isValidTaxonomyCanonicalKey('Arduino'), false);
  assert.equal(isValidTaxonomyCanonicalKey('material form:wood'), false);
});

test('reviewed vocabulary is unique within type and reports explicit cross-type ambiguity', () => {
  const validation = validateTaxonomyVocabulary();

  assert.equal(validation.sameTypeCollisions.length, 0);
  assert.equal(validation.conceptCount, TAXONOMY_CONCEPT_SEEDS.length);
  assert.ok(validation.aliasCount > validation.conceptCount);
  assert.ok(validation.crossTypeCollisions.some((collision) => collision.includes('arduino')));
});

test('alias resolution rejects inactive candidates and exposes collisions', () => {
  const resolved = resolveTaxonomyAliasCandidates([
    {
      canonicalKey: 'interest:arduino',
      conceptType: 'INTEREST',
      labelEn: 'Arduino',
      labelAr: 'أردوينو',
      status: 'ACTIVE',
    },
    {
      canonicalKey: 'interest:old-arduino',
      conceptType: 'INTEREST',
      labelEn: 'Old Arduino',
      labelAr: 'أردوينو قديم',
      status: 'INACTIVE',
    },
  ]);
  assert.equal(resolved.status, 'RESOLVED');
  if (resolved.status === 'RESOLVED') {
    assert.equal(resolved.concepts[0].canonicalKey, 'interest:arduino');
  }

  const ambiguous = resolveTaxonomyAliasCandidates([
    {
      canonicalKey: 'interest:arduino',
      conceptType: 'INTEREST',
      labelEn: 'Arduino',
      labelAr: 'أردوينو',
      status: 'ACTIVE',
    },
    {
      canonicalKey: 'component:arduino-board',
      conceptType: 'COMPONENT',
      labelEn: 'Arduino Board',
      labelAr: 'لوحة أردوينو',
      status: 'ACTIVE',
    },
  ]);
  assert.equal(ambiguous.status, 'AMBIGUOUS');
});

test('unknown and malformed values do not resolve', () => {
  assert.equal(resolveTaxonomyAliasCandidates([]).status, 'NOT_FOUND');
  assert.equal(normalizeTaxonomyAlias('   '), '');
  assert.throws(
    () => validateTaxonomyVocabulary([
      {
        ...TAXONOMY_CONCEPT_SEEDS[0]!,
        canonicalKey: 'interest:blank-alias',
        aliases: [{ alias: '   ', language: 'EN', aliasType: 'EXPLICIT', source: 'test' }],
      },
    ]),
    /Blank taxonomy alias/,
  );
});

test('normalization contract covers Unicode, Arabic, technical punctuation, and mixed identifiers', () => {
  assert.equal(normalizeTaxonomyAlias('Ａｒｄｕｉｎｏ'), 'arduino');
  assert.equal(normalizeTaxonomyAlias('  DC   motor  '), 'dc motor');
  assert.equal(normalizeTaxonomyAlias('لوحةـ أَرْدُوينو / HC-SR04'), 'لوحة اردوينو / hc-sr04');
  assert.equal(normalizeTaxonomyAlias('٥V relay'), '٥v relay');
  assert.equal(normalizeTaxonomyAlias('"LCD 16x2"'), 'lcd 16x2');
  assert.equal(normalizeTaxonomyAlias('motor / board'), 'motor / board');
  assert.equal(normalizeTaxonomyAlias('motor-board'), 'motor-board');
});

test('canonical keys are unique and aliases are unique within the selected type/language scope', () => {
  const keys = TAXONOMY_CONCEPT_SEEDS.map((seed) => seed.canonicalKey);
  assert.equal(new Set(keys).size, keys.length);
  const validation = validateTaxonomyVocabulary();
  assert.deepEqual(validation.sameTypeCollisions, []);
});

test('English and Arabic alias candidates resolve only with explicit type context when needed', () => {
  const candidates = [
    {
      canonicalKey: 'interest:electronics',
      conceptType: 'INTEREST' as const,
      labelEn: 'Electronics',
      labelAr: 'إلكترونيات',
      status: 'ACTIVE' as const,
    },
    {
      canonicalKey: 'project-topic:electronics',
      conceptType: 'PROJECT_TOPIC' as const,
      labelEn: 'Electronics',
      labelAr: 'إلكترونيات',
      status: 'ACTIVE' as const,
    },
  ];
  assert.equal(resolveTaxonomyAliasCandidates(candidates).status, 'AMBIGUOUS');
  assert.equal(resolveTaxonomyAliasCandidates(candidates.filter((candidate) => candidate.conceptType === 'INTEREST')).status, 'RESOLVED');
  assert.equal(normalizeTaxonomyAlias('إِلِكْتْرُونِيَّات'), normalizeTaxonomyAlias('إلكترونيات'));
});

test('bounded batch limit rejects more than 500 unique IDs before querying', async () => {
  const repository = new TaxonomyFoundationRepository();
  await assert.rejects(
    repository.loadMappingsForEntities({ materialIds: Array.from({ length: MAX_TAXONOMY_BATCH_SIZE + 1 }, (_, index) => `unknown-${index}`) }),
    /batch exceeds 500/,
  );
});

test('active recommendation paths do not import the typed taxonomy foundation', () => {
  const files = [
    '../learner-home/learner-home.controller.ts',
    '../learner-home/learner-home.service.ts',
    '../learner-home/learner-home.repository.ts',
    '../learner-home/learner-home.scoring.ts',
    '../learner-home/learner-home.ranking.ts',
    '../learner-home/learner-home.routes.ts',
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /modules\/taxonomy|taxonomy-foundation|TaxonomyConcept|taxonomy_concepts/);
  }
});
