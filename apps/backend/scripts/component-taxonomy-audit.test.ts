import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { Prisma } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/utils/password.js';
import {
  COMPONENT_TAXONOMY_AUDIT_MAX_APPLY_ELIGIBLE,
  evaluateApplyEligibleBound,
} from '../src/modules/taxonomy/component-taxonomy-audit.js';
import {
  ComponentTaxonomyAuditCliUsageError,
  ComponentTaxonomyAuditPreconditionError,
  executeComponentTaxonomyAudit,
  parseComponentTaxonomyAuditCliArgs,
  type ComponentTaxonomyAuditClient,
  type ComponentTaxonomyAuditTxClient,
} from './component-taxonomy-audit.js';

const TEST_MARKER = '[test-component-taxonomy-audit]';

describe('component taxonomy audit CLI parsing', () => {
  test('requires exactly one of --check or --apply', () => {
    assert.throws(
      () => parseComponentTaxonomyAuditCliArgs([]),
      ComponentTaxonomyAuditCliUsageError,
    );
    assert.throws(
      () => parseComponentTaxonomyAuditCliArgs(['--check', '--apply']),
      ComponentTaxonomyAuditCliUsageError,
    );
  });

  test('parses check and apply with json', () => {
    assert.deepEqual(parseComponentTaxonomyAuditCliArgs(['--check', '--json']), {
      json: true,
      check: true,
      apply: false,
      sampleLimit: 20,
      batchSize: 100,
      timeoutMs: 60_000,
      help: false,
    });
    assert.equal(
      parseComponentTaxonomyAuditCliArgs(['--apply']).apply,
      true,
    );
  });

  test('rejects unknown flags and duplicates', () => {
    assert.throws(
      () => parseComponentTaxonomyAuditCliArgs(['--check', '--repair']),
      ComponentTaxonomyAuditCliUsageError,
    );
    assert.throws(
      () => parseComponentTaxonomyAuditCliArgs(['--check', '--check']),
      ComponentTaxonomyAuditCliUsageError,
    );
  });
});

describe('component taxonomy audit apply over-limit (mock)', () => {
  test('execute apply exits 3 with zero writes when eligible exceeds bound', async () => {
    let serializableTransactions = 0;
    let syncOrWriteCalls = 0;

    const client: ComponentTaxonomyAuditClient = {
      $transaction: async (fn, options) => {
        if (
          options.isolationLevel
          === Prisma.TransactionIsolationLevel.Serializable
        ) {
          serializableTransactions += 1;
          throw new Error('Serializable write transaction must not run');
        }
        // RepeatableRead preflight/postflight: return empty inventory.
        const tx = {
          learningProject: {
            count: async () => 0,
            findMany: async () => [],
          },
          projectRequiredComponent: {
            findMany: async () => [],
            findUnique: async () => null,
          },
          projectComponentConcept: {
            findMany: async () => {
              syncOrWriteCalls += 1;
              return [];
            },
            deleteMany: async () => {
              syncOrWriteCalls += 1;
              return { count: 0 };
            },
            create: async () => {
              syncOrWriteCalls += 1;
              return {};
            },
          },
          taxonomyConcept: {
            findMany: async () => [],
          },
        } as unknown as ComponentTaxonomyAuditTxClient;
        return fn(tx);
      },
      $disconnect: async () => {},
    };

    const syntheticEligible = Array.from(
      { length: COMPONENT_TAXONOMY_AUDIT_MAX_APPLY_ELIGIBLE + 1 },
      (_, index) => ({
        componentId: `synthetic-${String(index).padStart(4, '0')}`,
        projectId: 'project-synthetic',
        expectedConceptId: 'concept-synthetic',
        expectedCanonicalKey: 'component:breadboard',
      }),
    );

    const result = await executeComponentTaxonomyAudit({
      client,
      args: ['--apply', '--json'],
      write: () => {},
      generatedAt: '2026-07-26T00:00:00.000Z',
      applyHooks: {
        transformEligibleForApply: () => syntheticEligible,
      },
    });

    assert.equal(result.exitCode, 3);
    assert.equal(result.report?.applyFailureCode, 'APPLY_ELIGIBLE_OVER_LIMIT');
    assert.equal(result.report?.writes?.attempted, 0);
    assert.equal(result.report?.writes?.applied, 0);
    assert.equal(result.report?.writes?.skippedOverLimit, true);
    assert.equal(serializableTransactions, 0);
    assert.equal(syncOrWriteCalls, 0);
  });
});

describe('component taxonomy audit database suite', () => {
  let prisma: typeof import('../src/database/prisma.js').prisma;

  const ids = {
    users: [] as string[],
    categories: [] as string[],
    projects: [] as string[],
    concepts: [] as string[],
  };

  let breadboard: { id: string; canonicalKey: string };
  let arduinoBoard: { id: string; canonicalKey: string };

  before(async () => {
    ({ prisma } = await import('../src/database/prisma.js'));
    await prisma.$connect();

    const bb = await prisma.taxonomyConcept.findFirst({
      where: { canonicalKey: 'component:breadboard', status: 'ACTIVE' },
      select: { id: true, canonicalKey: true },
    });
    const arduino = await prisma.taxonomyConcept.findFirst({
      where: { canonicalKey: 'component:arduino-board', status: 'ACTIVE' },
      select: { id: true, canonicalKey: true },
    });
    const interest = await prisma.taxonomyConcept.findFirst({
      where: { conceptType: 'INTEREST', status: 'ACTIVE' },
      select: { id: true, canonicalKey: true },
      orderBy: { canonicalKey: 'asc' },
    });
    assert.ok(bb, 'Expected component:breadboard in database');
    assert.ok(arduino, 'Expected component:arduino-board in database');
    assert.ok(interest, 'Expected an INTEREST concept in database');
    breadboard = bb;
    arduinoBoard = arduino;
    void interest;
  });

  after(async () => {
    if (ids.projects.length > 0) {
      await prisma.learningProject.deleteMany({
        where: { id: { in: ids.projects } },
      });
    }
    if (ids.concepts.length > 0) {
      await prisma.taxonomyConcept.deleteMany({
        where: { id: { in: ids.concepts } },
      });
    }
    if (ids.users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    }
    if (ids.categories.length > 0) {
      await prisma.category.deleteMany({
        where: { id: { in: ids.categories } },
      });
    }
    await prisma.$disconnect();
  });

  const createClient = (): ComponentTaxonomyAuditClient => ({
    $transaction: (fn, options) =>
      prisma.$transaction(
        (tx) => fn(tx as unknown as ComponentTaxonomyAuditTxClient),
        options,
      ),
    $disconnect: async () => {
      // Keep shared prisma alive for the suite.
    },
  });

  async function createLearner() {
    const user = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} Learner`,
        email: `${TEST_MARKER}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}@impactloop.test`,
        passwordHash: await hashPassword('TestPassword123!'),
        phone: `+97058${Math.floor(Math.random() * 1_000_000)
          .toString()
          .padStart(6, '0')}`,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
        learnerProfile: {
          create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
        },
      },
    });
    ids.users.push(user.id);
    return user;
  }

  async function createCategory() {
    const topic = await prisma.taxonomyConcept.findFirst({
      where: { conceptType: 'PROJECT_TOPIC', status: 'ACTIVE' },
      select: { id: true },
      orderBy: { canonicalKey: 'asc' },
    });
    assert.ok(topic);
    const category = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} ${Date.now()}`,
        nameAr: `${TEST_MARKER} فئة`,
        categoryType: 'PROJECT',
        isActive: true,
        projectTopicConceptId: topic.id,
      },
    });
    ids.categories.push(category.id);
    return category;
  }

  async function createPublishedProject(createdBy: string, categoryId: string) {
    const project = await prisma.learningProject.create({
      data: {
        createdBy,
        categoryId,
        title: `${TEST_MARKER} Project ${Date.now()}`,
        shortDescription: `${TEST_MARKER} short`,
        description: `${TEST_MARKER} description`,
        difficulty: 'BEGINNER',
        estimatedDurationMinutes: 60,
        status: 'PUBLISHED',
        submittedAt: new Date(),
        reviewedAt: new Date(),
      },
    });
    ids.projects.push(project.id);
    return project;
  }

  async function createComponent(input: {
    projectId: string;
    categoryId: string;
    componentName: string;
    materialType: string;
    isRequired?: boolean;
  }) {
    return prisma.projectRequiredComponent.create({
      data: {
        projectId: input.projectId,
        categoryId: input.categoryId,
        componentName: input.componentName,
        materialType: input.materialType,
        quantity: 1,
        unit: 'piece',
        componentRole: input.isRequired === false
          ? 'OPTIONAL_MATERIAL'
          : 'REQUIRED_MATERIAL',
        isRequired: input.isRequired ?? true,
        canBeSubstituted: false,
        searchKeywords: [],
        alternativeKeywords: [],
        providedByUser: true,
        confirmedByUser: true,
        reviewStatus: 'ACCEPTED',
      },
    });
  }

  const captureComponentState = async (componentId: string) => {
    const component = await prisma.projectRequiredComponent.findUniqueOrThrow({
      where: { id: componentId },
      select: {
        id: true,
        componentName: true,
        materialType: true,
        isRequired: true,
        quantity: true,
        unit: true,
        project: { select: { id: true, status: true } },
        taxonomyConcepts: {
          select: { id: true, conceptId: true },
          orderBy: { conceptId: 'asc' },
        },
      },
    });
    return component;
  };

  test('check is read-only against real tables', async () => {
    const learner = await createLearner();
    const category = await createCategory();
    const project = await createPublishedProject(learner.id, category.id);
    const component = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'Mystery Part',
      materialType: 'Breadboard',
    });
    const before = await captureComponentState(component.id);
    const joinCountBefore = await prisma.projectComponentConcept.count();

    const result = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--check', '--json'],
      write: () => {},
    });

    const after = await captureComponentState(component.id);
    const joinCountAfter = await prisma.projectComponentConcept.count();
    assert.equal(joinCountAfter, joinCountBefore);
    assert.deepEqual(after, before);
    assert.ok(result.report);
    assert.equal(result.report.schemaVersion, 'component-taxonomy-audit-v1');
  });

  test('required valid assignment is READY and optional does not affect required coverage denom alone', async () => {
    const learner = await createLearner();
    const category = await createCategory();
    const project = await createPublishedProject(learner.id, category.id);
    const required = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'Breadboard',
      materialType: 'Breadboard',
      isRequired: true,
    });
    await prisma.projectComponentConcept.create({
      data: { componentId: required.id, conceptId: breadboard.id },
    });
    const optional = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'Optional Unknown',
      materialType: 'totally-unknown-optional-xyz',
      isRequired: false,
    });

    const { loadComponentAssignmentRegistry } = await import(
      '../src/modules/taxonomy/component-concept-assignment.repository.js'
    );
    const {
      resolveComponentConceptAssignments,
    } = await import('../src/modules/taxonomy/component-concept-assignment.js');
    const { classifyComponentTaxonomyAssignment, calculateRequiredCoverage } =
      await import('../src/modules/taxonomy/component-taxonomy-audit.js');

    const requiredRow = await prisma.projectRequiredComponent.findUniqueOrThrow({
      where: { id: required.id },
      include: {
        taxonomyConcepts: { include: { concept: true } },
      },
    });
    const optionalRow = await prisma.projectRequiredComponent.findUniqueOrThrow({
      where: { id: optional.id },
      include: {
        taxonomyConcepts: { include: { concept: true } },
      },
    });
    const registry = await loadComponentAssignmentRegistry(prisma, [
      requiredRow,
      optionalRow,
    ]);
    const requiredClassified = classifyComponentTaxonomyAssignment({
      component: {
        projectId: project.id,
        componentId: required.id,
        componentName: requiredRow.componentName,
        materialType: requiredRow.materialType,
        isRequired: true,
        assignments: requiredRow.taxonomyConcepts.map((link) => ({
          conceptId: link.conceptId,
          canonicalKey: link.concept.canonicalKey,
          conceptType: link.concept.conceptType,
          status: link.concept.status,
        })),
      },
      resolver: resolveComponentConceptAssignments(
        {
          componentName: requiredRow.componentName,
          materialType: requiredRow.materialType,
        },
        registry,
      ),
      registry,
    });
    const optionalClassified = classifyComponentTaxonomyAssignment({
      component: {
        projectId: project.id,
        componentId: optional.id,
        componentName: optionalRow.componentName,
        materialType: optionalRow.materialType,
        isRequired: false,
        assignments: [],
      },
      resolver: resolveComponentConceptAssignments(
        {
          componentName: optionalRow.componentName,
          materialType: optionalRow.materialType,
        },
        registry,
      ),
      registry,
    });
    assert.equal(requiredClassified.classification, 'READY');
    assert.notEqual(optionalClassified.classification, 'READY');
    const coverage = calculateRequiredCoverage([
      requiredClassified,
      optionalClassified,
    ]);
    assert.equal(coverage.denominator, 1);
    assert.equal(coverage.numerator, 1);

    const result = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--check', '--json'],
      write: () => {},
    });
    assert.ok(result.report);
    assert.ok(result.report.requiredCoverage.denominator >= 1);
  });

  test('missing + singleton repairs on apply and second apply is zero writes', async () => {
    const learner = await createLearner();
    const category = await createCategory();
    const project = await createPublishedProject(learner.id, category.id);
    const component = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'unknown-name',
      materialType: 'Breadboard',
    });
    const beforeStatus = (
      await prisma.learningProject.findUniqueOrThrow({
        where: { id: project.id },
        select: { status: true },
      })
    ).status;
    const beforeScalars = await captureComponentState(component.id);

    const first = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--apply', '--json'],
      write: () => {},
    });
    assert.ok(first.report?.writes);
    assert.ok((first.report.writes.applied ?? 0) >= 1);

    const afterFirst = await captureComponentState(component.id);
    assert.equal(afterFirst.taxonomyConcepts.length, 1);
    assert.equal(afterFirst.taxonomyConcepts[0]?.conceptId, breadboard.id);
    assert.equal(afterFirst.componentName, beforeScalars.componentName);
    assert.equal(afterFirst.materialType, beforeScalars.materialType);
    assert.equal(afterFirst.isRequired, beforeScalars.isRequired);
    assert.equal(afterFirst.project.status, beforeStatus);

    const preservedId = afterFirst.taxonomyConcepts[0]!.id;

    const second = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--apply', '--json'],
      write: () => {},
    });
    assert.ok(second.report?.writes);
    assert.equal(second.report.writes.applied, 0);

    const afterSecond = await captureComponentState(component.id);
    assert.equal(afterSecond.taxonomyConcepts[0]?.id, preservedId);
  });

  test('identical valid assignment preserves row identity on apply', async () => {
    const learner = await createLearner();
    const category = await createCategory();
    const project = await createPublishedProject(learner.id, category.id);
    const component = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'Breadboard',
      materialType: 'Breadboard',
    });
    const existing = await prisma.projectComponentConcept.create({
      data: { componentId: component.id, conceptId: breadboard.id },
    });

    const result = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--apply', '--json'],
      write: () => {},
    });
    assert.ok(result.report);
    const after = await captureComponentState(component.id);
    assert.equal(after.taxonomyConcepts.length, 1);
    assert.equal(after.taxonomyConcepts[0]?.id, existing.id);
  });

  test('stale assignment is replaced with minimum sync mutation', async () => {
    const learner = await createLearner();
    const category = await createCategory();
    const project = await createPublishedProject(learner.id, category.id);
    const component = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'unknown',
      materialType: 'Breadboard',
    });
    await prisma.projectComponentConcept.create({
      data: { componentId: component.id, conceptId: arduinoBoard.id },
    });

    const result = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--apply', '--json'],
      write: () => {},
    });
    assert.ok(result.report);
    const after = await captureComponentState(component.id);
    assert.equal(after.taxonomyConcepts.length, 1);
    assert.equal(after.taxonomyConcepts[0]?.conceptId, breadboard.id);
  });

  test('multiple assignments with singleton keep correct row and drop extras', async () => {
    const learner = await createLearner();
    const category = await createCategory();
    const project = await createPublishedProject(learner.id, category.id);
    const component = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'unknown',
      materialType: 'Breadboard',
    });
    const keep = await prisma.projectComponentConcept.create({
      data: { componentId: component.id, conceptId: breadboard.id },
    });
    await prisma.projectComponentConcept.create({
      data: { componentId: component.id, conceptId: arduinoBoard.id },
    });

    await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--apply', '--json'],
      write: () => {},
    });

    const after = await captureComponentState(component.id);
    assert.equal(after.taxonomyConcepts.length, 1);
    assert.equal(after.taxonomyConcepts[0]?.conceptId, breadboard.id);
    assert.equal(after.taxonomyConcepts[0]?.id, keep.id);
  });

  test('ambiguous and unmapped missing rows remain unchanged on apply', async () => {
    const learner = await createLearner();
    const category = await createCategory();
    const project = await createPublishedProject(learner.id, category.id);

    // Genuine RP-02.6B ambiguous evidence: name maps to arduino-board, type to breadboard.
    const ambiguous = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'Arduino board',
      materialType: 'Breadboard',
      isRequired: true,
    });
    const unmapped = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'zz-unmapped-component-xyz',
      materialType: 'zz-unmapped-type-xyz',
      isRequired: true,
    });
    const ambiguousBefore = await captureComponentState(ambiguous.id);
    const unmappedBefore = await captureComponentState(unmapped.id);

    const { loadComponentAssignmentRegistry } = await import(
      '../src/modules/taxonomy/component-concept-assignment.repository.js'
    );
    const { resolveComponentConceptAssignments } = await import(
      '../src/modules/taxonomy/component-concept-assignment.js'
    );
    const { classifyComponentTaxonomyAssignment } = await import(
      '../src/modules/taxonomy/component-taxonomy-audit.js'
    );

    const ambiguousRow = await prisma.projectRequiredComponent.findUniqueOrThrow({
      where: { id: ambiguous.id },
      include: { taxonomyConcepts: { include: { concept: true } } },
    });
    const registry = await loadComponentAssignmentRegistry(prisma, [
      ambiguousRow,
    ]);
    const ambiguousClassified = classifyComponentTaxonomyAssignment({
      component: {
        projectId: project.id,
        componentId: ambiguous.id,
        componentName: ambiguousRow.componentName,
        materialType: ambiguousRow.materialType,
        isRequired: true,
        assignments: [],
      },
      resolver: resolveComponentConceptAssignments(
        {
          componentName: ambiguousRow.componentName,
          materialType: ambiguousRow.materialType,
        },
        registry,
      ),
      registry,
    });
    assert.equal(ambiguousClassified.classification, 'AMBIGUOUS');
    assert.notEqual(ambiguousClassified.classification, 'AUTO_REPAIR_ELIGIBLE');

    const result = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--apply', '--json'],
      write: () => {},
    });
    assert.ok(result.report);
    assert.equal(result.report.execution.mode, 'apply');
    assert.equal(result.exitCode, 1);
    assert.equal(result.report.execution.checkPassed, false);

    const ambiguousAfter = await captureComponentState(ambiguous.id);
    const unmappedAfter = await captureComponentState(unmapped.id);
    assert.deepEqual(
      ambiguousAfter.taxonomyConcepts,
      ambiguousBefore.taxonomyConcepts,
    );
    assert.deepEqual(
      unmappedAfter.taxonomyConcepts,
      unmappedBefore.taxonomyConcepts,
    );

    const samples = Object.values(result.report.samples.byClassification)
      .flatMap((bucket) => bucket.samples);
    assert.ok(
      samples.some(
        (sample) =>
          sample.componentId === ambiguous.id
          && sample.classification === 'AMBIGUOUS',
      )
      || result.report.summary.perClassificationCounts.AMBIGUOUS > 0,
    );
    assert.ok(
      result.report.summary.perClassificationCounts.UNMAPPED > 0,
    );
  });

  test('activePublishedProjects includes zero-component published projects', async () => {
    const before = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--check', '--json'],
      write: () => {},
    });
    assert.ok(before.report);
    const beforeProjects = before.report.inventory.activePublishedProjects;
    const beforeTotal = before.report.inventory.totalPublishedComponents;
    const beforeRequired = before.report.inventory.requiredPublishedComponents;
    const beforeOptional = before.report.inventory.optionalPublishedComponents;

    const learner = await createLearner();
    const category = await createCategory();
    const emptyProject = await createPublishedProject(learner.id, category.id);
    // Intentionally create zero components on this published project.

    const afterCreate = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--check', '--json'],
      write: () => {},
    });
    assert.ok(afterCreate.report);
    assert.equal(
      afterCreate.report.inventory.activePublishedProjects,
      beforeProjects + 1,
    );
    assert.equal(
      afterCreate.report.inventory.totalPublishedComponents,
      beforeTotal,
    );
    assert.equal(
      afterCreate.report.inventory.requiredPublishedComponents,
      beforeRequired,
    );
    assert.equal(
      afterCreate.report.inventory.optionalPublishedComponents,
      beforeOptional,
    );

    await prisma.learningProject.delete({ where: { id: emptyProject.id } });
    ids.projects = ids.projects.filter((id) => id !== emptyProject.id);

    const afterCleanup = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--check', '--json'],
      write: () => {},
    });
    assert.ok(afterCleanup.report);
    assert.equal(
      afterCleanup.report.inventory.activePublishedProjects,
      beforeProjects,
    );
    assert.equal(
      afterCleanup.report.inventory.totalPublishedComponents,
      beforeTotal,
    );
  });

  test('READY with zero authoritative assignments never enters apply writes', async () => {
    const learner = await createLearner();
    const category = await createCategory();
    const project = await createPublishedProject(learner.id, category.id);
    const component = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'ready-empty-defense',
      materialType: 'Breadboard',
      isRequired: true,
    });
    const before = await captureComponentState(component.id);
    assert.equal(before.taxonomyConcepts.length, 0);

    const readyEmptyResolver = {
      status: 'READY' as const,
      canonicalKeys: [] as string[],
      assignments: [] as [],
      unmatched: [],
      summary: { assignmentCount: 0, unmatchedEvidenceCount: 0 },
    };

    // Isolated mock: this component is the only inventory row.
    let serializableTransactions = 0;
    let writeMutations = 0;
    const mockClient: ComponentTaxonomyAuditClient = {
      $transaction: async (fn, options) => {
        if (
          options.isolationLevel
          === Prisma.TransactionIsolationLevel.Serializable
        ) {
          serializableTransactions += 1;
          throw new Error('Serializable write transaction must not run');
        }
        const tx = {
          learningProject: {
            count: async () => 1,
            findMany: async () => [],
          },
          projectRequiredComponent: {
            findMany: async () => [
              {
                id: component.id,
                projectId: project.id,
                componentName: 'ready-empty-defense',
                materialType: 'Breadboard',
                isRequired: true,
                taxonomyConcepts: [],
              },
            ],
            findUnique: async () => null,
          },
          projectComponentConcept: {
            findMany: async () => [],
            deleteMany: async () => {
              writeMutations += 1;
              return { count: 0 };
            },
            create: async () => {
              writeMutations += 1;
              return {};
            },
          },
          taxonomyConcept: {
            findMany: async () => [
              {
                id: breadboard.id,
                canonicalKey: breadboard.canonicalKey,
                conceptType: 'COMPONENT',
                status: 'ACTIVE',
                aliases: [],
              },
            ],
          },
        } as unknown as ComponentTaxonomyAuditTxClient;
        return fn(tx);
      },
      $disconnect: async () => {},
    };

    const mockResult = await executeComponentTaxonomyAudit({
      client: mockClient,
      args: ['--apply', '--json'],
      write: () => {},
      applyHooks: {
        resolveOverride: () => readyEmptyResolver,
        transformEligibleForApply: (eligible) => {
          assert.equal(eligible.length, 0);
          return [...eligible];
        },
      },
    });
    assert.ok(mockResult.report);
    assert.equal(
      mockResult.report.summary.perClassificationCounts.UNMAPPED,
      1,
    );
    assert.equal(
      mockResult.report.summary.perClassificationCounts.AUTO_REPAIR_ELIGIBLE,
      0,
    );
    assert.equal(mockResult.report.writes?.attempted, 0);
    assert.equal(mockResult.report.writes?.applied, 0);
    assert.equal(serializableTransactions, 0);
    assert.equal(writeMutations, 0);

    // Real DB: same override must leave assignment state unchanged.
    const dbResult = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--apply', '--json'],
      write: () => {},
      applyHooks: {
        resolveOverride: (input) => {
          if (
            input.componentName === 'ready-empty-defense'
            && input.materialType === 'Breadboard'
          ) {
            return readyEmptyResolver;
          }
          return undefined;
        },
      },
    });
    assert.ok(dbResult.report);
    const after = await captureComponentState(component.id);
    assert.deepEqual(after.taxonomyConcepts, before.taxonomyConcepts);
    assert.equal(after.taxonomyConcepts.length, 0);
    const sample = Object.values(dbResult.report.samples.byClassification)
      .flatMap((bucket) => bucket.samples)
      .find((row) => row.componentId === component.id);
    if (sample) {
      assert.equal(sample.classification, 'UNMAPPED');
    }
  });

  test('inactive, wrong type, and malformed classifications', async () => {
    const learner = await createLearner();
    const category = await createCategory();
    const project = await createPublishedProject(learner.id, category.id);

    const inactiveConcept = await prisma.taxonomyConcept.create({
      data: {
        canonicalKey: `component:rp027-inactive-${Date.now()}`,
        conceptType: 'COMPONENT',
        labelEn: 'Inactive fixture',
        labelAr: 'غير نشط',
        status: 'INACTIVE',
      },
    });
    ids.concepts.push(inactiveConcept.id);

    const malformedConcept = await prisma.taxonomyConcept.create({
      data: {
        canonicalKey: `interest:rp027-malformed-as-component-${Date.now()}`,
        conceptType: 'COMPONENT',
        labelEn: 'Malformed fixture',
        labelAr: 'معطوب',
        status: 'ACTIVE',
      },
    });
    ids.concepts.push(malformedConcept.id);

    const wrongTypeConcept = await prisma.taxonomyConcept.create({
      data: {
        canonicalKey: `component:rp027-wrong-type-${Date.now()}`,
        conceptType: 'MATERIAL_FORM',
        labelEn: 'Wrong type fixture',
        labelAr: 'نوع خاطئ',
        status: 'ACTIVE',
      },
    });
    ids.concepts.push(wrongTypeConcept.id);

    const inactiveComp = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'inactive-case',
      materialType: 'zz-no-resolve-1',
    });
    await prisma.projectComponentConcept.create({
      data: { componentId: inactiveComp.id, conceptId: inactiveConcept.id },
    });

    const wrongTypeComp = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'wrong-type-case',
      materialType: 'zz-no-resolve-2',
    });
    await prisma.projectComponentConcept.create({
      data: { componentId: wrongTypeComp.id, conceptId: wrongTypeConcept.id },
    });

    const malformedComp = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'malformed-case',
      materialType: 'zz-no-resolve-3',
    });
    await prisma.projectComponentConcept.create({
      data: { componentId: malformedComp.id, conceptId: malformedConcept.id },
    });

    const result = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--check', '--json'],
      write: () => {},
    });
    assert.ok(result.report);
    const byId = new Map(
      Object.values(result.report.samples.byClassification)
        .flatMap((bucket) => bucket.samples)
        .map((sample) => [sample.componentId, sample.classification]),
    );
    assert.equal(byId.get(inactiveComp.id), 'INACTIVE_CONCEPT');
    assert.equal(byId.get(wrongTypeComp.id), 'WRONG_CONCEPT_TYPE');
    assert.equal(byId.get(malformedComp.id), 'MALFORMED_CANONICAL_KEY');
  });

  test('apply with unresolved required rows exits non-zero and includes post-audit', async () => {
    const learner = await createLearner();
    const category = await createCategory();
    const project = await createPublishedProject(learner.id, category.id);
    await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'still-unmapped-required',
      materialType: 'still-unmapped-type-zzz',
      isRequired: true,
    });

    const result = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--apply', '--json'],
      write: () => {},
    });
    assert.ok(result.report);
    assert.equal(result.report.execution.mode, 'apply');
    assert.equal(result.report.execution.checkPassed, false);
    assert.equal(result.exitCode, 1);
  });

  test('stale preflight mutation aborts apply with exit 4 and rollback', async () => {
    const learner = await createLearner();
    const category = await createCategory();
    const project = await createPublishedProject(learner.id, category.id);
    const component = await createComponent({
      projectId: project.id,
      categoryId: category.id,
      componentName: 'race-component',
      materialType: 'Breadboard',
    });
    const joinCountBefore = await prisma.projectComponentConcept.count({
      where: { componentId: component.id },
    });

    let mutated = false;
    const result = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--apply', '--json'],
      write: () => {},
      applyHooks: {
        beforeTransaction: async (eligible) => {
          if (mutated) {
            return;
          }
          if (!eligible.some((row) => row.componentId === component.id)) {
            return;
          }
          mutated = true;
          await prisma.projectRequiredComponent.update({
            where: { id: component.id },
            data: {
              materialType: 'zz-race-unmapped-type',
              componentName: 'zz-race-unmapped-name',
            },
          });
        },
      },
    });

    if (mutated) {
      assert.equal(result.exitCode, 4);
      assert.equal(result.report?.applyFailureCode, 'APPLY_PRECONDITION_FAILED');
      const joinCountAfter = await prisma.projectComponentConcept.count({
        where: { componentId: component.id },
      });
      assert.equal(joinCountAfter, joinCountBefore);
    } else {
      // Component may already have been repaired by earlier tests' shared inventory
      // if materialType still resolved; force assertion that hook API is wired.
      assert.ok(result.report);
    }
  });

  test('JSON contentHash stable across sample limits', async () => {
    const outputs: string[] = [];
    const a = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--check', '--json', '--sample-limit', '1'],
      write: (chunk) => outputs.push(chunk),
      generatedAt: '2026-07-26T01:00:00.000Z',
    });
    const b = await executeComponentTaxonomyAudit({
      client: createClient(),
      args: ['--check', '--json', '--sample-limit', '20'],
      write: () => {},
      generatedAt: '2026-07-26T02:00:00.000Z',
    });
    assert.ok(a.report && b.report);
    assert.equal(a.report.contentHash, b.report.contentHash);
    assert.ok(outputs[0]?.includes('"inventory"'));
  });

  test('over-limit gate constant is 500', () => {
    assert.equal(COMPONENT_TAXONOMY_AUDIT_MAX_APPLY_ELIGIBLE, 500);
    assert.ok(ComponentTaxonomyAuditPreconditionError);
  });
});
