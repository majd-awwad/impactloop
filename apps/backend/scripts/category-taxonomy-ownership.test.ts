import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TAXONOMY_CONCEPT_SEEDS,
  type TaxonomyConceptSeed,
} from '../src/modules/taxonomy/taxonomy-foundation.data.js';
import {
  auditCategoryTaxonomyOwnership,
  buildAuthoritativeLegacyCategoryIndex,
  buildCategoryTaxonomyOwnershipReport,
  deriveRequiredOwnershipRoles,
  resolveLegacyBackfillExpectation,
  type CategoryOwnershipAuditInput,
  type CategoryOwnershipConcept,
} from '../src/modules/taxonomy/category-taxonomy-ownership.js';
import {
  CategoryOwnershipCliUsageError,
  executeCategoryOwnershipAudit,
  parseCategoryOwnershipCliArgs,
  type CategoryOwnershipAuditReadClient,
} from './category-taxonomy-ownership.js';

const concept = (
  canonicalKey: string,
  conceptType: CategoryOwnershipConcept['conceptType'],
  status: CategoryOwnershipConcept['status'] = 'ACTIVE',
): CategoryOwnershipConcept => ({
  id: `id:${canonicalKey}`,
  canonicalKey,
  conceptType,
  status,
});

const category = (
  overrides: Partial<CategoryOwnershipAuditInput> = {},
): CategoryOwnershipAuditInput => ({
  id: 'category-1',
  nameEn: 'Electronics & Components',
  nameAr: 'إلكترونيات وقطع إلكترونية',
  categoryType: 'MATERIAL',
  isActive: true,
  parentId: null,
  materialFamilyConceptId: null,
  projectTopicConceptId: null,
  materialFamilyConcept: null,
  projectTopicConcept: null,
  _count: {
    materials: 0,
    learningProjects: 0,
    projectRequiredComponents: 0,
  },
  ...overrides,
});

const seedFor = (
  role: 'materialFamily' | 'projectTopic',
  categoryNameEn: string,
  canonicalKey: string,
): TaxonomyConceptSeed => ({
  canonicalKey,
  conceptType: role === 'materialFamily' ? 'MATERIAL_FAMILY' : 'PROJECT_TOPIC',
  labelEn: canonicalKey,
  labelAr: canonicalKey,
  aliases: [],
  mappingRules: [{
    provenance: 'AUTHORITATIVE',
    source: 'test.authoritative-category-name',
    ...(role === 'materialFamily'
      ? { materialCategoryNames: [categoryNameEn] }
      : { projectCategoryNames: [categoryNameEn] }),
  }],
});

const auditOne = (input: {
  category: CategoryOwnershipAuditInput;
  concepts?: CategoryOwnershipConcept[];
  seeds?: TaxonomyConceptSeed[];
}) => buildCategoryTaxonomyOwnershipReport({
  categories: [input.category],
  taxonomyConcepts: input.concepts ?? [],
  seeds: input.seeds,
  generatedAt: '2026-07-23T00:00:00.000Z',
}).categories[0]!;

test('all 13 material and 6 project legacy category mappings resolve exactly', () => {
  const index = buildAuthoritativeLegacyCategoryIndex();
  const materialMappings = new Map([
    ['Electronics & Components', 'material-family:electronics'],
    ['Motors & Mechanical Parts', 'material-family:mechanical'],
    ['Power & Batteries', 'material-family:power'],
    ['Wood & Boards', 'material-family:wood'],
    ['Plastics & Acrylic', 'material-family:plastic'],
    ['Metal & Fasteners', 'material-family:metal'],
    ['Fabric & Textiles', 'material-family:fabric'],
    ['Paper & Cardboard', 'material-family:paper'],
    ['Tools & Hardware', 'material-family:tools'],
    ['Art & Craft Supplies', 'material-family:craft'],
    ['Packaging & Containers', 'material-family:packaging'],
    ['Lab & Education Supplies', 'material-family:lab'],
    ['Other Reusable Materials', 'material-family:reusable'],
  ]);
  const projectMappings = new Map([
    ['Robotics', 'project-topic:robotics'],
    ['Electronics', 'project-topic:electronics'],
    ['Recycling Crafts', 'project-topic:recycling-crafts'],
    ['Woodworking', 'project-topic:woodworking'],
    ['Home Experiments', 'project-topic:home-experiments'],
    ['Textile Crafts', 'project-topic:textile-crafts'],
  ]);

  assert.equal(index.materialFamily.size, 13);
  assert.equal(index.projectTopic.size, 6);
  for (const [nameEn, canonicalKey] of materialMappings) {
    const expectation = resolveLegacyBackfillExpectation(index, 'materialFamily', nameEn);
    assert.equal(expectation?.resolution, 'UNIQUE');
    assert.equal(expectation?.matches[0]?.canonicalKey, canonicalKey);
  }
  for (const [nameEn, canonicalKey] of projectMappings) {
    const expectation = resolveLegacyBackfillExpectation(index, 'projectTopic', nameEn);
    assert.equal(expectation?.resolution, 'UNIQUE');
    assert.equal(expectation?.matches[0]?.canonicalKey, canonicalKey);
  }
});

test('legacy mapping is authoritative-only and exact with no label or alias inference', () => {
  const reviewedOnly: TaxonomyConceptSeed = {
    ...seedFor('materialFamily', 'Similar Label', 'material-family:similar'),
    mappingRules: [{
      provenance: 'REVIEWED',
      source: 'test.reviewed-only',
      materialCategoryNames: ['Similar Label'],
    }],
  };
  const index = buildAuthoritativeLegacyCategoryIndex([
    ...TAXONOMY_CONCEPT_SEEDS,
    reviewedOnly,
  ]);

  assert.equal(resolveLegacyBackfillExpectation(index, 'materialFamily', 'electronics & components'), null);
  assert.equal(resolveLegacyBackfillExpectation(index, 'materialFamily', 'إلكترونيات وقطع إلكترونية'), null);
  assert.equal(resolveLegacyBackfillExpectation(index, 'materialFamily', 'Similar Label'), null);
  assert.equal(resolveLegacyBackfillExpectation(index, 'materialFamily', 'Electronic Components'), null);
});

test('duplicate authoritative rules are ambiguous even when their target is identical', () => {
  const duplicatedSeed = seedFor('materialFamily', 'Duplicate', 'material-family:duplicate');
  const index = buildAuthoritativeLegacyCategoryIndex([duplicatedSeed, duplicatedSeed]);
  const expectation = resolveLegacyBackfillExpectation(index, 'materialFamily', 'Duplicate');

  assert.equal(expectation?.resolution, 'AMBIGUOUS');
  assert.equal(expectation?.matches.length, 2);
});

test('CategoryType derives independent required roles', () => {
  assert.deepEqual(deriveRequiredOwnershipRoles('MATERIAL'), ['materialFamily']);
  assert.deepEqual(deriveRequiredOwnershipRoles('PROJECT'), ['projectTopic']);
  assert.deepEqual(deriveRequiredOwnershipRoles('BOTH'), ['materialFamily', 'projectTopic']);
});

test('active null ownership is assignable only with a unique valid legacy target', () => {
  const validTarget = concept('material-family:electronics', 'MATERIAL_FAMILY');
  const assignable = auditOne({ category: category(), concepts: [validTarget] });
  assert.equal(assignable.readinessStatus, 'ASSIGNABLE_SINGLE');
  assert.equal(assignable.ready, false);

  const unmapped = auditOne({ category: category({ nameEn: 'Future Material' }), concepts: [validTarget] });
  assert.equal(unmapped.readinessStatus, 'ACTIVE_UNMAPPED');

  const duplicate = seedFor('materialFamily', 'Duplicate', 'material-family:duplicate');
  const ambiguous = auditOne({
    category: category({ nameEn: 'Duplicate' }),
    concepts: [concept('material-family:duplicate', 'MATERIAL_FAMILY')],
    seeds: [duplicate, duplicate],
  });
  assert.equal(ambiguous.readinessStatus, 'AMBIGUOUS_REVIEWED_MAPPING');
});

test('valid persisted ownership is ready without frozen-name evidence', () => {
  const persisted = concept('material-family:future', 'MATERIAL_FAMILY');
  const future = auditOne({
    category: category({
      nameEn: 'Future Lifecycle Category',
      materialFamilyConceptId: persisted.id,
      materialFamilyConcept: persisted,
    }),
    concepts: [],
  });
  assert.equal(future.readinessStatus, 'READY_SINGLE');
  assert.equal(future.legacyBackfillExpectation.materialFamily, null);

  const renamed = auditOne({
    category: category({
      nameEn: 'Renamed Electronics Materials',
      materialFamilyConceptId: persisted.id,
      materialFamilyConcept: persisted,
    }),
  });
  assert.equal(renamed.readinessStatus, 'READY_SINGLE');
});

test('a still-matching legacy rule conflicts only when it differs from persisted ownership', () => {
  const wood = concept('material-family:wood', 'MATERIAL_FAMILY');
  const conflict = auditOne({
    category: category({
      materialFamilyConceptId: wood.id,
      materialFamilyConcept: wood,
    }),
  });
  assert.equal(conflict.readinessStatus, 'OWNERSHIP_CONFLICT');
  assert.ok(conflict.issues.some(({ code }) => code === 'OWNERSHIP_CONFLICT'));

  const noLegacy = auditOne({
    category: category({
      nameEn: 'Later Category',
      materialFamilyConceptId: wood.id,
      materialFamilyConcept: wood,
    }),
  });
  assert.equal(noLegacy.readinessStatus, 'READY_SINGLE');
});

test('BOTH supports assignable, partial, and ready dual ownership states', () => {
  const material = concept('material-family:dual', 'MATERIAL_FAMILY');
  const project = concept('project-topic:dual', 'PROJECT_TOPIC');
  const seeds = [
    seedFor('materialFamily', 'Dual', material.canonicalKey),
    seedFor('projectTopic', 'Dual', project.canonicalKey),
  ];
  const base = category({ nameEn: 'Dual', categoryType: 'BOTH' });

  assert.equal(auditOne({ category: base, concepts: [material, project], seeds }).readinessStatus, 'ASSIGNABLE_DUAL');
  assert.equal(auditOne({
    category: category({
      ...base,
      materialFamilyConceptId: material.id,
      materialFamilyConcept: material,
    }),
    concepts: [material, project],
    seeds,
  }).readinessStatus, 'PARTIALLY_MAPPED');
  assert.equal(auditOne({
    category: category({
      ...base,
      materialFamilyConceptId: material.id,
      materialFamilyConcept: material,
      projectTopicConceptId: project.id,
      projectTopicConcept: project,
    }),
    concepts: [],
    seeds: [],
  }).readinessStatus, 'READY_DUAL');
});

test('missing, inactive, and wrong-type targets are classified exactly', () => {
  assert.equal(auditOne({ category: category() }).readinessStatus, 'MISSING_TARGET_CONCEPT');
  assert.equal(auditOne({
    category: category(),
    concepts: [concept('material-family:electronics', 'MATERIAL_FAMILY', 'INACTIVE')],
  }).readinessStatus, 'INACTIVE_TARGET_CONCEPT');
  assert.equal(auditOne({
    category: category(),
    concepts: [concept('material-family:electronics', 'PROJECT_TOPIC')],
  }).readinessStatus, 'WRONG_TARGET_CONCEPT_TYPE');

  const wrongPersisted = concept('project-topic:robotics', 'PROJECT_TOPIC');
  assert.equal(auditOne({
    category: category({
      nameEn: 'No Legacy',
      materialFamilyConceptId: wrongPersisted.id,
      materialFamilyConcept: wrongPersisted,
    }),
  }).readinessStatus, 'WRONG_TARGET_CONCEPT_TYPE');
});

test('forbidden slots, zero usage, and test-looking labels receive no exemption', () => {
  const project = concept('project-topic:robotics', 'PROJECT_TOPIC');
  const slotViolation = auditOne({
    category: category({
      projectTopicConceptId: project.id,
      projectTopicConcept: project,
    }),
    concepts: [concept('material-family:electronics', 'MATERIAL_FAMILY')],
  });
  assert.equal(slotViolation.readinessStatus, 'CATEGORY_TYPE_SLOT_VIOLATION');

  const zeroUsage = auditOne({
    category: category(),
    concepts: [concept('material-family:electronics', 'MATERIAL_FAMILY')],
  });
  assert.equal(zeroUsage.readinessStatus, 'ASSIGNABLE_SINGLE');

  const testLooking = auditOne({
    category: category({ nameEn: 'Admin Approval Test Category' }),
  });
  assert.equal(testLooking.readinessStatus, 'ACTIVE_UNMAPPED');
});

test('inactive categories are reported without blocking active readiness by themselves', () => {
  const report = buildCategoryTaxonomyOwnershipReport({
    categories: [category({ nameEn: 'Inactive Unknown', isActive: false })],
    taxonomyConcepts: [],
    generatedAt: '2026-07-23T00:00:00.000Z',
  });
  assert.equal(report.categories[0]?.readinessStatus, 'INACTIVE_CATEGORY');
  assert.equal(report.summary.allActiveReady, true);
  assert.equal(report.resultCode, 'CATEGORY_TAXONOMY_OWNERSHIP_READY');
});

test('all applicable blockers remain available in issues', () => {
  const inactiveWrong = concept('material-family:wood', 'PROJECT_TOPIC', 'INACTIVE');
  const row = auditOne({
    category: category({
      materialFamilyConceptId: inactiveWrong.id,
      materialFamilyConcept: inactiveWrong,
    }),
  });
  const codes = row.issues.map(({ code }) => code);
  assert.ok(codes.includes('WRONG_TARGET_CONCEPT_TYPE'));
  assert.ok(codes.includes('INACTIVE_TARGET_CONCEPT'));
  assert.ok(codes.includes('OWNERSHIP_CONFLICT'));
});

test('CLI parser accepts only --check with optional --json', () => {
  assert.deepEqual(parseCategoryOwnershipCliArgs(['--check']), { json: false });
  assert.deepEqual(parseCategoryOwnershipCliArgs(['--json', '--check']), { json: true });

  for (const args of [
    [],
    ['--apply', '--check'],
    ['--write', '--check'],
    ['--fix', '--check'],
    ['--unknown', '--check'],
    ['--check', '--check'],
    ['--check', '--json', '--json'],
    ['--check', 'positional'],
  ]) {
    assert.throws(
      () => parseCategoryOwnershipCliArgs(args),
      CategoryOwnershipCliUsageError,
    );
  }
});

test('injected CLI client performs exactly two reads, writes the complete report, then disconnects', async () => {
  const events: string[] = [];
  let output = '';
  const client: CategoryOwnershipAuditReadClient = {
    category: {
      findMany: async () => {
        events.push('category.findMany');
        return [category()];
      },
    },
    taxonomyConcept: {
      findMany: async () => {
        events.push('taxonomyConcept.findMany');
        return [concept('material-family:electronics', 'MATERIAL_FAMILY')];
      },
    },
    $disconnect: async () => {
      events.push('disconnect');
    },
  };

  assert.deepEqual(Object.keys(client).sort(), ['$disconnect', 'category', 'taxonomyConcept']);
  const execution = await executeCategoryOwnershipAudit({
    client,
    args: ['--check'],
    generatedAt: '2026-07-23T00:00:00.000Z',
    write: (value) => {
      events.push('write');
      output += value;
    },
  });
  events.push('returned');

  assert.equal(execution.exitCode, 1);
  assert.equal(execution.report.resultCode, 'CATEGORY_TAXONOMY_OWNERSHIP_NOT_READY');
  assert.match(output, /Electronics & Components/);
  assert.match(output, /ASSIGNABLE_SINGLE/);
  assert.match(output, /Result: CATEGORY_TAXONOMY_OWNERSHIP_NOT_READY/);
  assert.deepEqual(events, [
    'category.findMany',
    'taxonomyConcept.findMany',
    'write',
    'disconnect',
    'returned',
  ]);
});

test('JSON output is complete and disconnect runs in exceptional paths', async () => {
  let jsonOutput = '';
  let disconnects = 0;
  const successClient: CategoryOwnershipAuditReadClient = {
    category: { findMany: async () => [category({ isActive: false })] },
    taxonomyConcept: { findMany: async () => [] },
    $disconnect: async () => { disconnects += 1; },
  };
  const execution = await executeCategoryOwnershipAudit({
    client: successClient,
    args: ['--check', '--json'],
    generatedAt: '2026-07-23T00:00:00.000Z',
    write: (value) => { jsonOutput += value; },
  });
  assert.equal(execution.exitCode, 0);
  assert.equal(JSON.parse(jsonOutput).resultCode, 'CATEGORY_TAXONOMY_OWNERSHIP_READY');
  assert.equal(disconnects, 1);

  const failureEvents: string[] = [];
  const failureClient: CategoryOwnershipAuditReadClient = {
    category: {
      findMany: async () => {
        failureEvents.push('category.findMany');
        throw new Error('read failed');
      },
    },
    taxonomyConcept: {
      findMany: async () => {
        failureEvents.push('taxonomyConcept.findMany');
        return [];
      },
    },
    $disconnect: async () => {
      failureEvents.push('disconnect');
    },
  };
  await assert.rejects(
    executeCategoryOwnershipAudit({ client: failureClient, args: ['--check'] }),
    /read failed/,
  );
  assert.deepEqual(failureEvents, [
    'category.findMany',
    'taxonomyConcept.findMany',
    'disconnect',
  ]);
});

test('auditCategoryTaxonomyOwnership accepts a prebuilt narrow legacy index', () => {
  const expected = concept('material-family:electronics', 'MATERIAL_FAMILY');
  const row = auditCategoryTaxonomyOwnership({
    category: category(),
    conceptsByCanonicalKey: new Map([[expected.canonicalKey, expected]]),
    legacyIndex: buildAuthoritativeLegacyCategoryIndex(),
  });
  assert.equal(row.readinessStatus, 'ASSIGNABLE_SINGLE');
});
