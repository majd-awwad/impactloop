import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  TAXONOMY_CONCEPT_SEEDS,
  type TaxonomyConceptSeed,
} from './taxonomy-foundation.data.js';
import { TAXONOMY_ALIAS_SOURCE } from './learner-interest-resolver.js';
import {
  resolveComponentConceptAssignments,
  type ComponentConceptAssignmentRegistry,
  type ComponentConceptAssignmentRegistryConcept,
  type ComponentConceptAssignmentResult,
} from './component-concept-assignment.js';
import { normalizeTaxonomyAlias } from './taxonomy-normalization.js';
import {
  accumulateComponentClassification,
  buildComponentTaxonomyAuditReport,
  calculateRequiredCoverage,
  classifyComponentTaxonomyAssignment,
  collectApplyEligibleCandidates,
  COMPONENT_TAXONOMY_AUDIT_MAX_APPLY_ELIGIBLE,
  createComponentTaxonomyAuditAccumulator,
  evaluateApplyEligibleBound,
  evaluateRequiredGate,
  extractAuthoritativeSingleton,
  hashTaxonomyEvidence,
  renderComponentTaxonomyAuditTextReport,
  selectComponentAuditExitCode,
  type AuditComponentInput,
  type ComponentClassificationResult,
} from './component-taxonomy-audit.js';

const projectSeed = (
  seed: TaxonomyConceptSeed,
): ComponentConceptAssignmentRegistryConcept => ({
  id: `persisted:${seed.canonicalKey}`,
  canonicalKey: seed.canonicalKey,
  conceptType: seed.conceptType,
  status: 'ACTIVE',
  aliases: [
    {
      normalizedAlias: normalizeTaxonomyAlias(seed.labelEn),
      source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN,
      isActive: true,
    },
    {
      normalizedAlias: normalizeTaxonomyAlias(seed.labelAr),
      source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_AR,
      isActive: true,
    },
    ...seed.aliases.map((alias) => ({
      normalizedAlias: normalizeTaxonomyAlias(alias.alias),
      source: alias.source,
      isActive: true,
    })),
  ],
});

const foundationRegistry = (): ComponentConceptAssignmentRegistry => ({
  concepts: TAXONOMY_CONCEPT_SEEDS.map(projectSeed),
  componentNameMappings: TAXONOMY_CONCEPT_SEEDS.flatMap((seed) =>
    seed.conceptType === 'COMPONENT'
      ? seed.mappingRules.flatMap((rule) =>
          rule.provenance === 'REVIEWED'
            ? (rule.componentNameValues ?? []).map((value) => ({
                value,
                canonicalKey: seed.canonicalKey,
                provenance: 'REVIEWED' as const,
                source: rule.source,
              }))
            : [])
      : []),
  componentTypeMappings: TAXONOMY_CONCEPT_SEEDS.flatMap((seed) =>
    seed.conceptType === 'COMPONENT'
      ? seed.mappingRules.flatMap((rule) =>
          rule.provenance === 'REVIEWED'
            ? (rule.componentTypeValues ?? []).map((value) => ({
                value,
                canonicalKey: seed.canonicalKey,
                provenance: 'REVIEWED' as const,
                source: rule.source,
              }))
            : [])
      : []),
});

const breadboardId = 'persisted:component:breadboard';
const wireId = 'persisted:component:jumper-wires';

const component = (
  partial: Partial<AuditComponentInput> & Pick<AuditComponentInput, 'componentId'>,
): AuditComponentInput => ({
  projectId: partial.projectId ?? 'project-1',
  componentId: partial.componentId,
  componentName: partial.componentName ?? 'unknown-name',
  materialType: partial.materialType ?? 'Breadboard',
  isRequired: partial.isRequired ?? true,
  assignments: partial.assignments ?? [],
});

const classify = (
  input: AuditComponentInput,
  registry = foundationRegistry(),
  resolverOverride?: ComponentConceptAssignmentResult,
): ComponentClassificationResult => {
  const resolver =
    resolverOverride
    ?? resolveComponentConceptAssignments(
      {
        componentName: input.componentName,
        materialType: input.materialType,
      },
      registry,
    );
  return classifyComponentTaxonomyAssignment({
    component: input,
    resolver,
    registry,
  });
};

describe('component taxonomy audit classification precedence', () => {
  test('singleton match is READY', () => {
    const result = classify(
      component({
        componentId: 'c1',
        assignments: [
          {
            conceptId: breadboardId,
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
        ],
      }),
    );
    assert.equal(result.classification, 'READY');
    assert.equal(result.authoritativeSingletonValid, true);
  });

  test('missing assignment with singleton is AUTO_REPAIR_ELIGIBLE', () => {
    const result = classify(component({ componentId: 'c2' }));
    assert.equal(result.classification, 'AUTO_REPAIR_ELIGIBLE');
    assert.equal(result.authoritativeSingleton?.conceptId, breadboardId);
  });

  test('multiple assignments without singleton is MULTIPLE_ASSIGNMENTS', () => {
    const registry = foundationRegistry();
    const resolver: ComponentConceptAssignmentResult = {
      status: 'UNMAPPED',
      canonicalKeys: [],
      assignments: [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };
    const result = classify(
      component({
        componentId: 'c3',
        assignments: [
          {
            conceptId: breadboardId,
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
          {
            conceptId: wireId,
            canonicalKey: 'component:jumper-wires',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
        ],
      }),
      registry,
      resolver,
    );
    assert.equal(result.classification, 'MULTIPLE_ASSIGNMENTS');
  });

  test('multiple assignments with singleton is AUTO_REPAIR_ELIGIBLE', () => {
    const result = classify(
      component({
        componentId: 'c4',
        assignments: [
          {
            conceptId: breadboardId,
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
          {
            conceptId: wireId,
            canonicalKey: 'component:jumper-wires',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
        ],
      }),
    );
    assert.equal(result.classification, 'AUTO_REPAIR_ELIGIBLE');
  });

  test('READY with empty assignments is UNMAPPED and never auto-repair', () => {
    const registry = foundationRegistry();
    const resolver: ComponentConceptAssignmentResult = {
      status: 'READY',
      canonicalKeys: [],
      assignments: [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };
    assert.equal(extractAuthoritativeSingleton(resolver, registry), null);
    const result = classify(
      component({ componentId: 'c5' }),
      registry,
      resolver,
    );
    assert.equal(result.classification, 'UNMAPPED');
    assert.equal(
      collectApplyEligibleCandidates([result]).length,
      0,
    );
  });

  test('malformed key beats wrong type and inactive', () => {
    const registry = foundationRegistry();
    const resolver: ComponentConceptAssignmentResult = {
      status: 'UNMAPPED',
      canonicalKeys: [],
      assignments: [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };
    const result = classify(
      component({
        componentId: 'c6',
        materialType: 'totally-unknown',
        assignments: [
          {
            conceptId: 'bad',
            canonicalKey: 'not-a-valid-key',
            conceptType: 'INTEREST',
            status: 'INACTIVE',
          },
        ],
      }),
      registry,
      resolver,
    );
    assert.equal(result.classification, 'MALFORMED_CANONICAL_KEY');
  });

  test('wrong type precedes inactive', () => {
    const registry = foundationRegistry();
    const resolver: ComponentConceptAssignmentResult = {
      status: 'UNMAPPED',
      canonicalKeys: [],
      assignments: [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };
    const result = classify(
      component({
        componentId: 'c7',
        materialType: 'totally-unknown',
        assignments: [
          {
            conceptId: 'x',
            canonicalKey: 'component:custom-thing',
            conceptType: 'INTEREST',
            status: 'INACTIVE',
          },
        ],
      }),
      registry,
      resolver,
    );
    assert.equal(result.classification, 'WRONG_CONCEPT_TYPE');
  });

  test('inactive concept classification', () => {
    const registry = foundationRegistry();
    const resolver: ComponentConceptAssignmentResult = {
      status: 'UNMAPPED',
      canonicalKeys: [],
      assignments: [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };
    const result = classify(
      component({
        componentId: 'c8',
        materialType: 'totally-unknown',
        assignments: [
          {
            conceptId: breadboardId,
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'INACTIVE',
          },
        ],
      }),
      registry,
      resolver,
    );
    assert.equal(result.classification, 'INACTIVE_CONCEPT');
  });

  test('structurally valid without singleton is STALE_ASSIGNMENT', () => {
    const registry = foundationRegistry();
    const resolver: ComponentConceptAssignmentResult = {
      status: 'UNMAPPED',
      canonicalKeys: [],
      assignments: [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };
    const result = classify(
      component({
        componentId: 'c9',
        materialType: 'totally-unknown',
        assignments: [
          {
            conceptId: breadboardId,
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
        ],
      }),
      registry,
      resolver,
    );
    assert.equal(result.classification, 'STALE_ASSIGNMENT');
  });

  test('zero assignments with AMBIGUOUS resolver', () => {
    const registry = foundationRegistry();
    const resolver: ComponentConceptAssignmentResult = {
      status: 'AMBIGUOUS',
      canonicalKeys: [],
      assignments: [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };
    const result = classify(
      component({
        componentId: 'c10',
        materialType: 'totally-unknown',
      }),
      registry,
      resolver,
    );
    assert.equal(result.classification, 'AMBIGUOUS');
  });

  test('zero assignments with UNMAPPED resolver', () => {
    const registry = foundationRegistry();
    const resolver: ComponentConceptAssignmentResult = {
      status: 'UNMAPPED',
      canonicalKeys: [],
      assignments: [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };
    const result = classify(
      component({
        componentId: 'c11',
        materialType: 'totally-unknown',
      }),
      registry,
      resolver,
    );
    assert.equal(result.classification, 'UNMAPPED');
  });

  test('ambiguous and unmapped never enter apply eligible set', () => {
    const registry = foundationRegistry();
    const ambiguous = classify(
      component({ componentId: 'a1', materialType: 'totally-unknown' }),
      registry,
      {
        status: 'AMBIGUOUS',
        canonicalKeys: [],
        assignments: [],
        unmatched: [],
        summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
      },
    );
    const unmapped = classify(
      component({ componentId: 'u1', materialType: 'totally-unknown' }),
      registry,
      {
        status: 'UNMAPPED',
        canonicalKeys: [],
        assignments: [],
        unmatched: [],
        summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
      },
    );
    assert.deepEqual(collectApplyEligibleCandidates([ambiguous, unmapped]), []);
  });
});

describe('component taxonomy audit coverage and hash', () => {
  test('optional rows are excluded from required coverage denominator', () => {
    const requiredReady = classify(
      component({
        componentId: 'r1',
        isRequired: true,
        assignments: [
          {
            conceptId: breadboardId,
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
        ],
      }),
    );
    const optionalUnmapped = classify(
      component({
        componentId: 'o1',
        isRequired: false,
        materialType: 'totally-unknown',
      }),
    );
    const coverage = calculateRequiredCoverage([
      requiredReady,
      optionalUnmapped,
    ]);
    assert.equal(coverage.denominator, 1);
    assert.equal(coverage.numerator, 1);
    assert.equal(coverage.percentage, 100);
    assert.equal(evaluateRequiredGate(coverage, [requiredReady, optionalUnmapped]), true);
  });

  test('required invalid fails gate even if optional ready', () => {
    const requiredMissing = classify(
      component({ componentId: 'r2', isRequired: true }),
    );
    const optionalReady = classify(
      component({
        componentId: 'o2',
        isRequired: false,
        assignments: [
          {
            conceptId: breadboardId,
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
        ],
      }),
    );
    const coverage = calculateRequiredCoverage([
      requiredMissing,
      optionalReady,
    ]);
    assert.equal(coverage.denominator, 1);
    assert.equal(coverage.numerator, 0);
    assert.equal(evaluateRequiredGate(coverage, [requiredMissing, optionalReady]), false);
  });

  const accumulateMany = (
    rows: ComponentClassificationResult[],
    sampleLimit: number,
  ) => {
    const acc = createComponentTaxonomyAuditAccumulator(sampleLimit);
    for (const row of rows) {
      accumulateComponentClassification(
        acc,
        {
          projectId: row.projectId,
          componentId: row.componentId,
          componentName: row.componentName,
          materialType: row.materialType,
          isRequired: row.isRequired,
          assignments: [],
        },
        row,
      );
    }
    return acc;
  };

  test('different sample limits produce the same semantic contentHash', () => {
    const rows = Array.from({ length: 5 }, (_, index) =>
      classify(
        component({
          componentId: `hash-${index}`,
          componentName: `name-${index}`,
          materialType: index % 2 === 0 ? 'Breadboard' : 'totally-unknown',
          isRequired: index !== 4,
        }),
      ));
    const reportA = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'json',
      sampleLimit: 1,
      batchSize: 50,
      timeoutMs: 1000,
      generatedAt: '2026-01-01T00:00:00.000Z',
      accumulator: accumulateMany(rows, 1),
    });
    const reportB = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'text',
      sampleLimit: 20,
      batchSize: 200,
      timeoutMs: 5000,
      generatedAt: '2026-07-01T00:00:00.000Z',
      accumulator: accumulateMany(rows, 20),
    });
    assert.equal(reportA.contentHash, reportB.contentHash);
    assert.notEqual(reportA.generatedAt, reportB.generatedAt);
    assert.notEqual(reportA.execution.sampleLimit, reportB.execution.sampleLimit);
  });

  test('reordered rows produce the same contentHash', () => {
    const rows = [
      classify(component({ componentId: 'z', componentName: 'zeta' })),
      classify(
        component({
          componentId: 'a',
          componentName: 'alpha',
          materialType: 'totally-unknown',
        }),
      ),
    ];
    const forward = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'json',
      sampleLimit: 20,
      batchSize: 100,
      timeoutMs: 1000,
      accumulator: accumulateMany(rows, 20),
    });
    const reverse = buildComponentTaxonomyAuditReport({
      mode: 'apply',
      outputMode: 'json',
      sampleLimit: 20,
      batchSize: 100,
      timeoutMs: 1000,
      accumulator: accumulateMany([...rows].reverse(), 20),
    });
    assert.equal(forward.contentHash, reverse.contentHash);
  });

  test('changing a row outside bounded samples changes the hash', () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      classify(
        component({
          componentId: `outside-${index}`,
          componentName: `outside-name-${index}`,
          materialType: 'totally-unknown',
          isRequired: true,
        }),
      ));
    const baseline = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'json',
      sampleLimit: 1,
      batchSize: 100,
      timeoutMs: 1000,
      accumulator: accumulateMany(rows, 1),
    });
    const mutatedRows = rows.map((row, index) =>
      index === 5
        ? classify(
            component({
              componentId: row.componentId,
              componentName: row.componentName,
              materialType: 'Breadboard',
              isRequired: true,
            }),
          )
        : row);
    const mutated = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'json',
      sampleLimit: 1,
      batchSize: 100,
      timeoutMs: 1000,
      accumulator: accumulateMany(mutatedRows, 1),
    });
    assert.equal(baseline.samples.byClassification.UNMAPPED.samples.length, 1);
    assert.notEqual(baseline.contentHash, mutated.contentHash);
  });

  test('changing only DB IDs does not change the contentHash', () => {
    const semanticSameA = classify(
      component({
        projectId: 'project-aaa',
        componentId: 'component-aaa',
        componentName: 'shared-name',
        materialType: 'Breadboard',
        assignments: [
          {
            assignmentId: 'assign-1',
            conceptId: breadboardId,
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
        ],
      }),
    );
    const semanticSameB = classify(
      component({
        projectId: 'project-bbb',
        componentId: 'component-bbb',
        componentName: 'shared-name',
        materialType: 'Breadboard',
        assignments: [
          {
            assignmentId: 'assign-2',
            conceptId: breadboardId,
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
        ],
      }),
    );
    const reportA = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'json',
      sampleLimit: 20,
      batchSize: 100,
      timeoutMs: 1000,
      accumulator: accumulateMany([semanticSameA], 20),
    });
    const reportB = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'json',
      sampleLimit: 20,
      batchSize: 100,
      timeoutMs: 1000,
      accumulator: accumulateMany([semanticSameB], 20),
    });
    assert.equal(reportA.contentHash, reportB.contentHash);
    assert.notEqual(
      reportA.samples.byClassification.READY.samples[0]?.componentId,
      reportB.samples.byClassification.READY.samples[0]?.componentId,
    );
  });

  test('multi-assignment hash ignores concept/assignment IDs and DB order', () => {
    const registry = foundationRegistry();
    const resolverUnmapped: ComponentConceptAssignmentResult = {
      status: 'UNMAPPED',
      canonicalKeys: [],
      assignments: [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };
    const leftFirst = classify(
      component({
        componentId: 'multi-a',
        componentName: 'multi-shared',
        materialType: 'totally-unknown',
        assignments: [
          {
            assignmentId: 'asg-1',
            conceptId: 'concept-id-aaa',
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
          {
            assignmentId: 'asg-2',
            conceptId: 'concept-id-zzz',
            canonicalKey: 'component:arduino-board',
            conceptType: 'COMPONENT',
            status: 'INACTIVE',
          },
        ],
      }),
      registry,
      resolverUnmapped,
    );
    const rightFirst = classify(
      component({
        componentId: 'multi-b',
        componentName: 'multi-shared',
        materialType: 'totally-unknown',
        assignments: [
          {
            assignmentId: 'asg-9',
            conceptId: 'concept-id-other-zzz',
            canonicalKey: 'component:arduino-board',
            conceptType: 'COMPONENT',
            status: 'INACTIVE',
          },
          {
            assignmentId: 'asg-8',
            conceptId: 'concept-id-other-aaa',
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
        ],
      }),
      registry,
      resolverUnmapped,
    );
    assert.equal(leftFirst.classification, 'MULTIPLE_ASSIGNMENTS');
    assert.equal(rightFirst.classification, 'MULTIPLE_ASSIGNMENTS');
    assert.deepEqual(
      leftFirst.semantic.assignmentStructural,
      rightFirst.semantic.assignmentStructural,
    );
    const reportA = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'json',
      sampleLimit: 5,
      batchSize: 10,
      timeoutMs: 1000,
      accumulator: accumulateMany([leftFirst], 5),
    });
    const reportB = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'json',
      sampleLimit: 5,
      batchSize: 10,
      timeoutMs: 1000,
      accumulator: accumulateMany([rightFirst], 5),
    });
    assert.equal(reportA.contentHash, reportB.contentHash);
  });

  test('rows sharing partial fields but differing resolver/status hash stably under reverse order', () => {
    const registry = foundationRegistry();
    const ambiguous: ComponentConceptAssignmentResult = {
      status: 'AMBIGUOUS',
      canonicalKeys: ['component:breadboard', 'component:arduino-board'],
      assignments: [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };
    const unmapped: ComponentConceptAssignmentResult = {
      status: 'UNMAPPED',
      canonicalKeys: [],
      assignments: [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };
    const rowAmbiguous = classify(
      component({
        componentId: 'same-evidence-1',
        componentName: 'same-evidence',
        materialType: 'same-type',
      }),
      registry,
      ambiguous,
    );
    const rowUnmapped = classify(
      component({
        componentId: 'same-evidence-2',
        componentName: 'same-evidence',
        materialType: 'same-type',
      }),
      registry,
      unmapped,
    );
    assert.equal(rowAmbiguous.classification, 'AMBIGUOUS');
    assert.equal(rowUnmapped.classification, 'UNMAPPED');
    const forward = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'json',
      sampleLimit: 20,
      batchSize: 100,
      timeoutMs: 1000,
      accumulator: accumulateMany([rowAmbiguous, rowUnmapped], 20),
    });
    const reverse = buildComponentTaxonomyAuditReport({
      mode: 'apply',
      outputMode: 'text',
      sampleLimit: 20,
      batchSize: 100,
      timeoutMs: 1000,
      accumulator: accumulateMany([rowUnmapped, rowAmbiguous], 20),
    });
    assert.equal(forward.contentHash, reverse.contentHash);
  });

  test('actual semantic structural change changes the hash', () => {
    const registry = foundationRegistry();
    const resolver: ComponentConceptAssignmentResult = {
      status: 'UNMAPPED',
      canonicalKeys: [],
      assignments: [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };
    const active = classify(
      component({
        componentId: 'struct-1',
        componentName: 'struct-case',
        materialType: 'totally-unknown',
        assignments: [
          {
            conceptId: breadboardId,
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'ACTIVE',
          },
        ],
      }),
      registry,
      resolver,
    );
    const inactive = classify(
      component({
        componentId: 'struct-1',
        componentName: 'struct-case',
        materialType: 'totally-unknown',
        assignments: [
          {
            conceptId: breadboardId,
            canonicalKey: 'component:breadboard',
            conceptType: 'COMPONENT',
            status: 'INACTIVE',
          },
        ],
      }),
      registry,
      resolver,
    );
    const reportActive = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'json',
      sampleLimit: 5,
      batchSize: 10,
      timeoutMs: 1000,
      accumulator: accumulateMany([active], 5),
    });
    const reportInactive = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'json',
      sampleLimit: 5,
      batchSize: 10,
      timeoutMs: 1000,
      accumulator: accumulateMany([inactive], 5),
    });
    assert.notEqual(reportActive.contentHash, reportInactive.contentHash);
  });

  test('samples hash evidence and omit raw component names', () => {
    const result = classify(
      component({
        componentId: 'privacy-1',
        componentName: 'Secret Component',
      }),
    );
    const serialized = JSON.stringify(result.sample);
    assert.equal(serialized.includes('Secret Component'), false);
    assert.equal(
      result.sample.componentNameEvidenceHash,
      hashTaxonomyEvidence('Secret Component'),
    );
  });

  test('apply eligible bound rejects counts above 500', () => {
    assert.deepEqual(evaluateApplyEligibleBound(500), { allowed: true });
    assert.deepEqual(evaluateApplyEligibleBound(501), {
      allowed: false,
      code: 'APPLY_ELIGIBLE_OVER_LIMIT',
    });
    assert.equal(COMPONENT_TAXONOMY_AUDIT_MAX_APPLY_ELIGIBLE, 500);
  });

  test('exit code selection', () => {
    assert.equal(
      selectComponentAuditExitCode({ checkPassed: true }),
      0,
    );
    assert.equal(
      selectComponentAuditExitCode({ checkPassed: false }),
      1,
    );
    assert.equal(
      selectComponentAuditExitCode({ usageError: true, checkPassed: false }),
      2,
    );
    assert.equal(
      selectComponentAuditExitCode({
        applyOverLimit: true,
        checkPassed: false,
      }),
      3,
    );
    assert.equal(
      selectComponentAuditExitCode({
        runtimeError: true,
        checkPassed: false,
      }),
      3,
    );
    assert.equal(
      selectComponentAuditExitCode({
        applyPreconditionFailed: true,
        checkPassed: false,
      }),
      4,
    );
  });

  test('text mode includes bounded samples, truncation, and privacy-safe fields only', () => {
    const rows = Array.from({ length: 3 }, (_, index) =>
      classify(
        component({
          componentId: `text-${index}`,
          projectId: `project-text-${index}`,
          componentName: `Secret Raw Name ${index}`,
          materialType: `Secret Raw Type ${index}`,
          isRequired: true,
        }),
      ));
    const report = buildComponentTaxonomyAuditReport({
      mode: 'check',
      outputMode: 'text',
      sampleLimit: 1,
      batchSize: 100,
      timeoutMs: 1000,
      generatedAt: '2026-07-26T00:00:00.000Z',
      accumulator: (() => {
        const acc = createComponentTaxonomyAuditAccumulator(1);
        for (const row of rows) {
          accumulateComponentClassification(
            acc,
            {
              projectId: row.projectId,
              componentId: row.componentId,
              componentName: row.componentName,
              materialType: row.materialType,
              isRequired: row.isRequired,
              assignments: [],
            },
            row,
          );
        }
        return acc;
      })(),
    });
    const text = renderComponentTaxonomyAuditTextReport(report);
    assert.match(text, /Bounded samples by classification:/);
    assert.match(text, /UNMAPPED: total=3 shown=1 truncated=true/);
    assert.match(text, /componentId=text-/);
    assert.match(text, /nameHash=sha256:/);
    assert.match(text, /typeHash=sha256:/);
    assert.equal(text.includes('Secret Raw Name'), false);
    assert.equal(text.includes('Secret Raw Type'), false);
    assert.equal(report.contentHash, buildComponentTaxonomyAuditReport({
      mode: 'apply',
      outputMode: 'json',
      sampleLimit: 1,
      batchSize: 50,
      timeoutMs: 2000,
      generatedAt: '2099-01-01T00:00:00.000Z',
      accumulator: (() => {
        const acc = createComponentTaxonomyAuditAccumulator(1);
        for (const row of rows) {
          accumulateComponentClassification(
            acc,
            {
              projectId: row.projectId,
              componentId: row.componentId,
              componentName: row.componentName,
              materialType: row.materialType,
              isRequired: row.isRequired,
              assignments: [],
            },
            row,
          );
        }
        return acc;
      })(),
    }).contentHash);
  });
});
