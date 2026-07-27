import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../src/database/prisma.js';
import {
  buildCanonicalMaterialRuntimeFeatures,
  buildCanonicalProjectRuntimeFeatures,
  getCanonicalRuntimeFeatureAuthority,
} from '../src/modules/recommendations/canonical-runtime-item-features.js';
import {
  commitRecommendationMaterialView,
  recommendationMaterialViewDeduplicationKey,
  RECOMMENDATION_VIEW_IDEMPOTENCY_SCOPE,
} from '../src/modules/recommendation-events/recommendation-events.service.js';
import { stableOpaqueKey } from '../src/modules/recommendations/local-ml-training-snapshot.schema.js';
import {
  buildLocalMlSnapshotFromDatabase,
  writeSnapshotAtomically,
} from './export-local-ml-training-snapshot.js';

const marker = `lm04-${process.pid}-${Date.now()}-${randomUUID()}`;
const evaluationTime = new Date('2099-07-26T12:00:00.000Z');
const futureTime = new Date('2100-07-26T12:00:00.000Z');
const sentinel = {
  name: `LM04_NAME_${marker}`,
  email: `lm04-${marker}@pii.invalid`,
  phone: `+970${String(Date.now()).slice(-9)}`,
  bio: `LM04_BIO_${marker}`,
  address: `LM04_ADDRESS_${marker}`,
  materialTitle: `LM04_MATERIAL_TITLE_${marker}`,
  materialDescription: `LM04_MATERIAL_DESCRIPTION_${marker}`,
  projectTitle: `LM04_PROJECT_TITLE_${marker}`,
  projectDescription: `LM04_PROJECT_DESCRIPTION_${marker}`,
  reservationMessage: `LM04_RESERVATION_${marker}`,
};

let realUserId = '';
let demoUserId = '';
let testUserId = '';
let locationId = '';
let categoryId = '';
let materialId = '';
let futureMaterialId = '';
let unavailableMaterialId = '';
let missingFeatureMaterialId = '';
let projectId = '';
let futureProjectId = '';
let draftProjectId = '';
let componentId = '';
let tempDirectory = '';
const viewOperationIds = [`${marker}-view-1`, `${marker}-view-2`];

const sourceCounts = async () => ({
  materialLikes: await prisma.materialLike.count(),
  materialViews: await prisma.materialView.count(),
  projectSaves: await prisma.projectSave.count(),
  projectLikes: await prisma.projectLike.count(),
  projectFollows: await prisma.projectFollow.count(),
  projectBuilds: await prisma.projectBuild.count(),
  reservations: await prisma.reservation.count(),
});

const createLearner = async (suffix: string, eligibility: 'ELIGIBLE' | 'EXCLUDED_DEMO' | 'EXCLUDED_TEST') => {
  const user = await prisma.user.create({
    data: {
      displayName: `${sentinel.name}_${suffix}`,
      email: `${suffix}-${sentinel.email}`,
      phone: suffix === 'real' ? sentinel.phone : undefined,
      passwordHash: `LM04_PASSWORD_${marker}`,
      accountStatus: 'ACTIVE',
      recommendationEvidenceEligibility: eligibility,
      activeRole: 'LEARNER',
      roles: { create: { role: 'LEARNER', isPrimary: true } },
      learnerProfile: {
        create: {
          interests: ['interest:arduino'],
          bio: `${sentinel.bio}_${suffix}`,
        },
      },
    },
  });
  return user.id;
};

const createMaterial = async (input: {
  title: string;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  createdAt?: Date;
}) =>
  prisma.material.create({
    data: {
      ownerId: realUserId,
      categoryId,
      title: input.title,
      description: sentinel.materialDescription,
      materialType: `LM04_TYPE_${marker}`,
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'STUDENT_LEFTOVER',
      status: input.status,
      isFree: true,
      locationId,
      pickupAllowed: true,
      deliveryAllowed: false,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });

const createProject = async (input: {
  title: string;
  status: 'PUBLISHED' | 'DRAFT';
  createdAt?: Date;
  reviewedAt?: Date | null;
}) =>
  prisma.learningProject.create({
    data: {
      categoryId,
      createdBy: realUserId,
      title: input.title,
      shortDescription: `${sentinel.projectDescription}_SHORT`,
      description: sentinel.projectDescription,
      difficulty: 'BEGINNER',
      status: input.status,
      reviewedAt:
        input.reviewedAt === undefined
          ? input.status === 'PUBLISHED'
            ? new Date()
            : null
          : input.reviewedAt,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });

describe('LM-04 local database snapshot exporter', () => {
  before(async () => {
    const [interest, family, form, topic, component] = await Promise.all(
      [
        'interest:arduino',
        'material-family:electronics',
        'material-form:arduino-uno',
        'project-topic:robotics',
        'component:dc-gear-motors',
      ].map((canonicalKey) =>
        prisma.taxonomyConcept.findUniqueOrThrow({ where: { canonicalKey } }),
      ),
    );
    assert.equal(interest.status, 'ACTIVE');

    realUserId = await createLearner('real', 'ELIGIBLE');
    demoUserId = await createLearner('demo', 'EXCLUDED_DEMO');
    testUserId = await createLearner('test', 'EXCLUDED_TEST');
    locationId = (
      await prisma.location.create({
        data: {
          country: 'PS',
          city: 'LM04 City',
          area: sentinel.address,
          addressLine: sentinel.address,
        },
      })
    ).id;
    categoryId = (
      await prisma.category.create({
        data: {
          nameEn: `LM04 Category ${marker}`,
          nameAr: `LM04 Category ${marker}`,
          categoryType: 'BOTH',
          isActive: true,
          materialFamilyConceptId: family.id,
          projectTopicConceptId: topic.id,
        },
      })
    ).id;

    materialId = (await createMaterial({ title: sentinel.materialTitle, status: 'AVAILABLE' })).id;
    futureMaterialId = (
      await createMaterial({ title: `${sentinel.materialTitle}_FUTURE`, status: 'AVAILABLE', createdAt: futureTime })
    ).id;
    unavailableMaterialId = (
      await createMaterial({ title: `${sentinel.materialTitle}_UNAVAILABLE`, status: 'UNAVAILABLE' })
    ).id;
    missingFeatureMaterialId = (
      await createMaterial({ title: `${sentinel.materialTitle}_MISSING`, status: 'AVAILABLE' })
    ).id;
    await prisma.materialConcept.createMany({
      data: [
        { materialId, conceptId: family.id },
        { materialId, conceptId: form.id },
      ],
    });

    projectId = (await createProject({ title: sentinel.projectTitle, status: 'PUBLISHED' })).id;
    futureProjectId = (
      await createProject({
        title: `${sentinel.projectTitle}_FUTURE`,
        status: 'PUBLISHED',
        createdAt: futureTime,
        reviewedAt: futureTime,
      })
    ).id;
    draftProjectId = (
      await createProject({ title: `${sentinel.projectTitle}_DRAFT`, status: 'DRAFT' })
    ).id;
    await prisma.learningProjectConcept.create({ data: { projectId, conceptId: topic.id } });
    componentId = (
      await prisma.projectRequiredComponent.create({
        data: {
          projectId,
          categoryId,
          componentName: `LM04 Component ${marker}`,
          materialType: `LM04 Type ${marker}`,
          quantity: 1,
          unit: 'piece',
          componentRole: 'REQUIRED_MATERIAL',
          isRequired: true,
          reviewStatus: 'ACCEPTED',
        },
      })
    ).id;
    await prisma.projectComponentConcept.create({
      data: { componentId, conceptId: component.id },
    });

    await prisma.materialLike.create({ data: { materialId, userId: realUserId } });
    const reversed = await prisma.materialLike.create({ data: { materialId, userId: demoUserId } });
    await prisma.materialLike.delete({ where: { id: reversed.id } });
    await prisma.projectSave.create({ data: { projectId, userId: demoUserId } });
    await prisma.projectLike.create({ data: { projectId, userId: demoUserId } });
    await prisma.projectFollow.create({ data: { projectId, userId: demoUserId } });
    await prisma.materialView.create({
      data: {
        materialId,
        viewerUserId: testUserId,
        viewSource: 'material_detail',
      },
    });
    await prisma.materialView.create({
      data: {
        materialId,
        viewerUserId: realUserId,
        viewSource: 'unsupported-legacy-source',
      },
    });
    await prisma.materialView.create({
      data: {
        materialId,
        viewerUserId: realUserId,
        viewSource: 'material_detail',
        createdAt: futureTime,
      },
    });

    const appendView = (operationId: string) =>
      commitRecommendationMaterialView({
        learnerId: realUserId,
        materialId,
        sourceOperationId: operationId,
        eventSource: 'REAL',
        apply: (tx) =>
          tx.materialView.create({
            data: { materialId, viewerUserId: realUserId, viewSource: 'material_detail' },
            select: { id: true },
          }),
      });
    const firstView = await appendView(viewOperationIds[0]!);
    const replayedView = await appendView(viewOperationIds[0]!);
    await appendView(viewOperationIds[1]!);
    assert.equal(firstView.replayed, false);
    assert.equal(replayedView.replayed, true);
    assert.deepEqual(replayedView.response, firstView.response);

    await prisma.projectBuild.create({
      data: { projectId, learnerId: realUserId, status: 'IN_PROGRESS', startedAt: new Date() },
    });
    await prisma.projectBuild.create({
      data: {
        projectId,
        learnerId: demoUserId,
        status: 'COMPLETED',
        startedAt: new Date('2026-07-26T10:00:00.000Z'),
        completedAt: new Date('2026-07-26T11:00:00.000Z'),
      },
    });
    await prisma.reservation.create({
      data: {
        materialId,
        requesterId: demoUserId,
        ownerId: realUserId,
        quantityRequested: 1,
        message: sentinel.reservationMessage,
      },
    });
    tempDirectory = await mkdtemp(join(tmpdir(), 'impactloop-lm04-'));
  });

  after(async () => {
    await prisma.recommendationEventOutbox.deleteMany({
      where: {
        deduplicationKey: {
          in: viewOperationIds.map((operationId) =>
            recommendationMaterialViewDeduplicationKey(realUserId, operationId),
          ),
        },
      },
    });
    await prisma.idempotencyRecord.deleteMany({
      where: {
        userId: realUserId,
        scope: RECOMMENDATION_VIEW_IDEMPOTENCY_SCOPE,
        key: { in: viewOperationIds },
      },
    });
    await prisma.learningProject.deleteMany({
      where: { id: { in: [projectId, futureProjectId, draftProjectId].filter(Boolean) } },
    });
    await prisma.material.deleteMany({
      where: {
        id: {
          in: [materialId, futureMaterialId, unavailableMaterialId, missingFeatureMaterialId].filter(Boolean),
        },
      },
    });
    if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
    if (locationId) await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.user.deleteMany({
      where: { id: { in: [realUserId, demoUserId, testUserId].filter(Boolean) } },
    });
    if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  test('exports authoritative product rows repeatably without mutation, PII, or reservation evidence', async () => {
    const beforeCounts = await sourceCounts();
    const first = await buildLocalMlSnapshotFromDatabase(evaluationTime);
    const betweenCounts = await sourceCounts();
    const second = await buildLocalMlSnapshotFromDatabase(evaluationTime);
    const afterCounts = await sourceCounts();
    assert.deepEqual(betweenCounts, beforeCounts);
    assert.deepEqual(afterCounts, beforeCounts);
    assert.deepEqual(second.snapshot, first.snapshot);
    assert.deepEqual(second.queryStats, first.queryStats);

    const snapshot = first.snapshot;
    const serialized = JSON.stringify(snapshot);
    for (const value of Object.values(sentinel)) assert.equal(serialized.includes(value), false);
    assert.equal(serialized.toLowerCase().includes('reservation'), false);

    const realUserKey = stableOpaqueKey('user', realUserId);
    const demoUserKey = stableOpaqueKey('user', demoUserId);
    const materialKey = stableOpaqueKey('material', materialId);
    const projectKey = stableOpaqueKey('project', projectId);
    assert.ok(snapshot.users.some((row) => row.userKey === realUserKey));
    assert.ok(snapshot.users.some((row) => row.userKey === demoUserKey));
    assert.equal(snapshot.users.some((row) => row.userKey === stableOpaqueKey('user', testUserId)), false);

    const authority = await getCanonicalRuntimeFeatureAuthority();
    const expectedMaterial = buildCanonicalMaterialRuntimeFeatures({
      authority,
      concepts: [
        { canonicalKey: 'material-family:electronics', conceptType: 'MATERIAL_FAMILY', status: 'ACTIVE' },
        { canonicalKey: 'material-form:arduino-uno', conceptType: 'MATERIAL_FORM', status: 'ACTIVE' },
      ],
      condition: 'GOOD',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: false,
    });
    const expectedProject = buildCanonicalProjectRuntimeFeatures({
      authority,
      topicConcepts: [
        { canonicalKey: 'project-topic:robotics', conceptType: 'PROJECT_TOPIC', status: 'ACTIVE' },
      ],
      componentConcepts: [
        { canonicalKey: 'component:dc-gear-motors', conceptType: 'COMPONENT', status: 'ACTIVE', isRequired: true },
      ],
      difficulty: 'BEGINNER',
    });
    assert.deepEqual(
      snapshot.materialItems.find((row) => row.materialKey === materialKey)?.featureTokens,
      expectedMaterial.features.map(([token]) => token),
    );
    assert.deepEqual(
      snapshot.projectItems.find((row) => row.projectKey === projectKey)?.featureTokens,
      expectedProject.features.map(([token]) => token),
    );

    const fixtureViews = snapshot.materialInteractions.filter(
      (row) => row.kind === 'MATERIAL_VIEW' && row.materialKey === materialKey && row.userKey === realUserKey,
    );
    assert.equal(fixtureViews.length, 2);
    assert.ok(snapshot.materialInteractions.some((row) => row.kind === 'MATERIAL_LIKE' && row.origin === 'REAL'));
    assert.ok(snapshot.projectInteractions.some((row) => row.kind === 'PROJECT_SAVE' && row.origin === 'DEMO_SEED'));
    assert.ok(snapshot.projectInteractions.some((row) => row.kind === 'PROJECT_LIKE' && row.origin === 'DEMO_SEED'));
    assert.ok(snapshot.projectInteractions.some((row) => row.kind === 'PROJECT_FOLLOW' && row.origin === 'DEMO_SEED'));
    assert.ok(snapshot.projectInteractions.some((row) => row.kind === 'PROJECT_BUILD_STARTED' && row.userKey === realUserKey));
    assert.ok(snapshot.projectInteractions.some((row) => row.kind === 'PROJECT_BUILD_COMPLETED' && row.userKey === demoUserKey && row.occurredAtUtc === '2026-07-26T11:00:00.000Z'));
    assert.ok(snapshot.metadata.exclusionTotals.MATERIAL_CREATED_AFTER_EVALUATION >= 1);
    assert.ok(snapshot.metadata.exclusionTotals.PROJECT_CREATED_AFTER_EVALUATION >= 1);
    assert.ok(snapshot.metadata.exclusionTotals.INTERACTION_AFTER_EVALUATION >= 1);
    assert.ok(snapshot.metadata.exclusionTotals.MATERIAL_STATE_INELIGIBLE >= 1);
    assert.ok(snapshot.metadata.exclusionTotals.MATERIAL_MISSING_CRITICAL_FEATURE_GROUP >= 1);
    assert.ok(snapshot.metadata.exclusionTotals.PROJECT_STATE_INELIGIBLE >= 1);
    assert.ok(snapshot.metadata.exclusionTotals.INTERACTION_ORIGIN_NOT_LOCAL_DEMO >= 1);
    assert.ok(snapshot.metadata.exclusionTotals.MATERIAL_VIEW_SOURCE_UNSUPPORTED >= 1);

    const sourceNames = [
      'users',
      'materials',
      'projects',
      'materialLikes',
      'materialViews',
      'projectSaves',
      'projectLikes',
      'projectFollows',
      'projectBuilds',
    ];
    for (const sourceName of sourceNames) {
      assert.equal(first.queryStats.counts[sourceName], 1);
      assert.ok((first.queryStats.pages[sourceName] ?? 0) >= 1);
    }
    assert.equal(first.queryStats.counts.interestRegistry, 1);
    assert.ok((first.queryStats.conceptChunks.materialConcepts ?? 0) <= Math.ceil(snapshot.metadata.counts.materialItems.sourceTotal / 200));
    assert.ok((first.queryStats.conceptChunks.projectConcepts ?? 0) <= Math.ceil(snapshot.metadata.counts.projectItems.sourceTotal / 200));
    assert.ok((first.queryStats.conceptChunks.projectComponentConcepts ?? 0) <= Math.ceil(snapshot.metadata.counts.projectItems.sourceTotal / 200));

    const outputA = join(tempDirectory, 'snapshot-a.json');
    const outputB = join(tempDirectory, 'snapshot-b.json');
    await writeSnapshotAtomically(outputA, first.snapshot);
    await writeSnapshotAtomically(outputB, second.snapshot);
    const [bytesA, bytesB] = await Promise.all([readFile(outputA), readFile(outputB)]);
    assert.deepEqual(bytesB, bytesA);
    assert.equal(
      createHash('sha256').update(bytesA).digest('hex'),
      createHash('sha256').update(bytesB).digest('hex'),
    );
  });
});
