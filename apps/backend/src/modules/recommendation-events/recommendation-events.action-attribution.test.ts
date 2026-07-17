import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import {
  enqueueRecommendationAction,
  getRecommendationActionPlan,
  persistRecommendationExposure,
  type RecommendationActionPlan,
} from './recommendation-events.service.js';
import {
  RecommendationOutboxWorker,
} from './recommendation-events.outbox.worker.js';

const TEST_MARKER = '[test-recommendation-action-outbox]';
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
let learnerId: string;
let otherLearnerId: string;

const operation = (label: string): string => `${TEST_MARKER}-${RUN_ID}-${label}`;

const cleanupTestOutbox = async (): Promise<void> => {
  const rows = await prisma.recommendationEventOutbox.findMany({
    select: { id: true, eventKind: true, payload: true },
  });
  const ids = rows
    .filter((row) => {
      const payload = row.payload as { learnerId?: unknown; generationId?: unknown };
      return (
        row.eventKind === 'RECOMMENDATION_ACTION' ||
        payload.learnerId === learnerId ||
        payload.learnerId === otherLearnerId ||
        (typeof payload.generationId === 'string' && payload.generationId.startsWith(TEST_MARKER))
      );
    })
    .map((row) => row.id);
  if (ids.length > 0) {
    await prisma.recommendationEventOutbox.deleteMany({ where: { id: { in: ids } } });
  }
};

const createLearner = async (label: string): Promise<string> => {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${label}`,
      email: `${TEST_MARKER}-${label}-${Date.now()}@impactloop.test`,
      passwordHash: 'test-only-hash',
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: { create: { learnerType: 'STUDENT' } },
    },
    select: { id: true },
  });
  return user.id;
};

const seedImpression = async (entityType: 'MATERIAL' | 'PROJECT', entityId: string) => {
  const result = await persistRecommendationExposure({
    generation: {
      generationKey: `${TEST_MARKER}-${Date.now()}-${Math.random()}`,
      learnerId,
      surface: 'LEARNER_HOME',
      algorithmName: 'deterministic-hybrid',
      algorithmVersion: 'learner-home-v1',
      policyVersion: 'learner-home-policy-v1',
      generatedAt: new Date(),
      candidateCount: 1,
      shownItemCount: 1,
      generationDurationMs: 1,
      generationCacheState: 'HIT',
      candidateTraces: [],
    },
    cacheState: 'HIT',
    items: [
      {
        entityType,
        entityId,
        sectionKey: 'test_section',
        position: 1,
        score: 1,
        reasons: ['Matches your interests'],
      },
    ],
  });
  return [...result.values()][0]!;
};

const enqueueAction = async (
  plan: RecommendationActionPlan,
  impressionId?: string,
  actionLearnerId = learnerId,
) =>
  enqueueRecommendationAction({
    learnerId: actionLearnerId,
    plan,
    headers: impressionId
      ? { 'x-recommendation-impression-id': impressionId }
      : {},
    eventSource: 'TEST',
  });

describe('recommendation action outbox attribution', () => {
  before(async () => {
    learnerId = await createLearner('primary');
    otherLearnerId = await createLearner('other');
    await cleanupTestOutbox();
  });

  after(async () => {
    await cleanupTestOutbox();
    await prisma.user.deleteMany({ where: { id: { in: [learnerId, otherLearnerId] } } });
    await prisma.$disconnect();
  });

  test('enqueue is bulk-shaped and does not synchronously write actions', async () => {
    const impressionId = await seedImpression('MATERIAL', 'action-material-1');
    const result = await enqueueAction(
      {
        actionType: 'MATERIAL_LIKE',
        entityType: 'MATERIAL',
        entityId: 'action-material-1',
        sourceOperationId: operation('like-operation-1'),
      },
      impressionId,
    );
    assert.equal(result, true);
    assert.equal(await prisma.recommendationAction.count({ where: { learnerId } }), 0);
    const row = await prisma.recommendationEventOutbox.findFirstOrThrow({
      where: { deduplicationKey: `action:MATERIAL_LIKE:${operation('like-operation-1')}` },
    });
    assert.equal(row.eventKind, 'RECOMMENDATION_ACTION');
    assert.equal((row.payload as { impressionId: string }).impressionId, impressionId);
  });

  test('worker records direct attribution and remains idempotent', async () => {
    const impressionId = await seedImpression('MATERIAL', 'action-material-2');
    await enqueueAction(
      {
        actionType: 'MATERIAL_VIEW',
        entityType: 'MATERIAL',
        entityId: 'action-material-2',
        sourceOperationId: operation('view-operation-2'),
      },
      impressionId,
    );
    const worker = new RecommendationOutboxWorker({ batchSize: 10 });
    assert.ok((await worker.processOnce()) >= 1);
    const action = await prisma.recommendationAction.findFirstOrThrow({
      where: { learnerId, entityId: 'action-material-2' },
    });
    assert.equal(action.attributionType, 'DIRECT');

    await prisma.recommendationEventOutbox.updateMany({
      where: { deduplicationKey: `action:MATERIAL_VIEW:${operation('view-operation-2')}` },
      data: { status: 'PENDING', availableAt: new Date(0), processedAt: null },
    });
    assert.equal(await worker.processOnce(), 1);
    assert.equal(
      await prisma.recommendationAction.count({ where: { id: action.id } }),
      1,
    );
  });

  test('assisted attribution selects the latest matching impression', async () => {
    const first = await seedImpression('PROJECT', 'action-project-1');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await seedImpression('PROJECT', 'action-project-1');
    await enqueueAction({
      actionType: 'PROJECT_SAVE',
      entityType: 'PROJECT',
      entityId: 'action-project-1',
      sourceOperationId: operation('save-operation-1'),
    });
    const worker = new RecommendationOutboxWorker({ batchSize: 10 });
    assert.equal(await worker.processOnce(), 1);
    const action = await prisma.recommendationAction.findFirstOrThrow({
      where: { learnerId, entityId: 'action-project-1' },
    });
    assert.equal(action.attributionType, 'ASSISTED');
    assert.equal(action.impressionId, second);
    assert.notEqual(first, second);
  });

  test('foreign learner and entity mismatch are processed without an action row', async () => {
    const impressionId = await seedImpression('MATERIAL', 'action-material-3');
    await enqueueAction(
      {
        actionType: 'MATERIAL_LIKE',
        entityType: 'MATERIAL',
        entityId: 'action-material-3',
        sourceOperationId: operation('foreign-operation-3'),
      },
      impressionId,
      otherLearnerId,
    );
    const worker = new RecommendationOutboxWorker({ batchSize: 10 });
    assert.equal(await worker.processOnce(), 1);
    assert.equal(
      await prisma.recommendationAction.count({ where: { sourceOperationId: operation('foreign-operation-3') } }),
      0,
    );
    assert.equal(
      await prisma.recommendationEventOutbox.count({
        where: { deduplicationKey: `action:MATERIAL_LIKE:${operation('foreign-operation-3')}`, status: 'PROCESSED' },
      }),
      1,
    );
  });

  test('expired impressions are not attributed and enqueue failures are non-fatal', async () => {
    const impressionId = await seedImpression('MATERIAL', 'action-expired-1');
    await prisma.recommendationImpression.update({
      where: { id: impressionId },
      data: { shownAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    await enqueueAction(
      {
        actionType: 'MATERIAL_VIEW',
        entityType: 'MATERIAL',
        entityId: 'action-expired-1',
        sourceOperationId: operation('expired-operation-1'),
      },
      impressionId,
    );
    const worker = new RecommendationOutboxWorker({ batchSize: 10 });
    assert.ok((await worker.processOnce()) >= 1);
    assert.equal(
      await prisma.recommendationAction.count({ where: { sourceOperationId: operation('expired-operation-1') } }),
      0,
    );

    const originalCreateMany = prisma.recommendationEventOutbox.createMany;
    Object.defineProperty(prisma.recommendationEventOutbox, 'createMany', {
      configurable: true,
      value: async () => { throw new Error('test action enqueue failure'); },
    });
    try {
      await assert.doesNotReject(() => enqueueAction({
        actionType: 'MATERIAL_LIKE',
        entityType: 'MATERIAL',
        entityId: 'action-expired-1',
        sourceOperationId: operation('failure-operation-1'),
      }));
    } finally {
      Object.defineProperty(prisma.recommendationEventOutbox, 'createMany', {
        configurable: true,
        value: originalCreateMany,
      });
    }
  });

  test('the response-boundary plan covers supported routes and excludes project views', () => {
    const request = (method: string, path: string, params: Record<string, string>) => ({
      method,
      path,
      params,
      headers: { 'idempotency-key': operation('route-plan') },
      auth: { sub: learnerId, roles: ['LEARNER'] },
    });
    const materialPlan = getRecommendationActionPlan(
      request('POST', '/api/materials/material-1/like', { id: 'material-1' }) as never,
      { success: true, data: { likesCount: 1 } },
    );
    assert.equal(materialPlan?.actionType, 'MATERIAL_LIKE');
    const mountedMaterialPlan = getRecommendationActionPlan(
      {
        ...request('POST', '/material-1/like', { id: 'material-1' }),
        baseUrl: '/api/materials',
      } as never,
      { success: true, data: { likesCount: 1 } },
    );
    assert.equal(mountedMaterialPlan?.actionType, 'MATERIAL_LIKE');
    const buildPlan = getRecommendationActionPlan(
      request('PATCH', '/api/learning-projects/project-1/builds/me/items/item-1', { id: 'project-1', itemId: 'item-1' }) as never,
      { success: true, data: { id: 'build-1', updatedAt: new Date().toISOString() } },
    );
    assert.equal(buildPlan?.actionType, 'PROJECT_BUILD_PROGRESS_UPDATED');
    assert.equal(
      getRecommendationActionPlan(
        request('GET', '/api/learning-projects/project-1', { id: 'project-1' }) as never,
        { success: true, data: { id: 'project-1' } },
      ),
      null,
    );
  });

  test('failed, unauthenticated, and non-learner responses produce no action plan', () => {
    const learnerRequest = {
      method: 'POST',
      path: '/api/materials/material-1/like',
      params: { id: 'material-1' },
      headers: { 'idempotency-key': operation('failed-request') },
      auth: { sub: learnerId, roles: ['LEARNER'] },
    };
    assert.equal(
      getRecommendationActionPlan(learnerRequest as never, { success: false, data: null }),
      null,
    );
    assert.equal(
      getRecommendationActionPlan({ ...learnerRequest, auth: undefined } as never, { success: true, data: {} }),
      null,
    );
    assert.equal(
      getRecommendationActionPlan({ ...learnerRequest, auth: { sub: learnerId, roles: ['SUPPLIER'] } } as never, { success: true, data: {} }),
      null,
    );
  });

  test('malformed hints fall back to assisted attribution and unsupported entity actions are dead', async () => {
    const impressionId = await seedImpression('MATERIAL', 'action-security-1');
    await enqueueAction(
      {
        actionType: 'MATERIAL_LIKE',
        entityType: 'MATERIAL',
        entityId: 'action-security-1',
        sourceOperationId: operation('malformed-hint-1'),
      },
      'malformed-impression-id',
    );
    await enqueueAction({
      actionType: 'PROJECT_LIKE',
      entityType: 'MATERIAL',
      entityId: 'action-security-1',
      sourceOperationId: operation('unsupported-entity-1'),
    });
    const worker = new RecommendationOutboxWorker({ batchSize: 10 });
    assert.equal(await worker.processOnce(), 2);
    const assisted = await prisma.recommendationAction.findFirstOrThrow({
      where: { sourceOperationId: operation('malformed-hint-1') },
    });
    assert.equal(assisted.impressionId, impressionId);
    assert.equal(assisted.attributionType, 'ASSISTED');
    assert.equal(
      await prisma.recommendationEventOutbox.count({
        where: { deduplicationKey: `action:PROJECT_LIKE:${operation('unsupported-entity-1')}`, status: 'DEAD' },
      }),
      1,
    );
  });

  test('action retries when its matching exposure is still pending', async () => {
    const generation = {
      generationKey: `${TEST_MARKER}-race-${Date.now()}`,
      learnerId,
      surface: 'LEARNER_HOME' as const,
      algorithmName: 'deterministic-hybrid',
      algorithmVersion: 'learner-home-v1',
      policyVersion: 'learner-home-policy-v1',
      generatedAt: new Date(),
      candidateCount: 1,
      shownItemCount: 1,
      generationDurationMs: 1,
      generationCacheState: 'MISS' as const,
      candidateTraces: [],
    };
    const exposure = await import('./recommendation-events.service.js').then(({ enqueueRecommendationExposure }) =>
      enqueueRecommendationExposure({
        generation,
        cacheState: 'MISS',
        includeGeneration: true,
        items: [{ entityType: 'MATERIAL', entityId: 'action-race-1', sectionKey: 'test', position: 1, score: 1, reasons: ['Popular'] }],
      }));
    await enqueueAction(
      { actionType: 'MATERIAL_LIKE', entityType: 'MATERIAL', entityId: 'action-race-1', sourceOperationId: operation('race-operation-1') },
      [...exposure.impressionIds.values()][0],
    );
    await prisma.recommendationEventOutbox.updateMany({
      where: { deduplicationKey: `exposure:${exposure.exposureId}` },
      data: { availableAt: new Date(Date.now() + 60_000) },
    });
    const worker = new RecommendationOutboxWorker({ batchSize: 10, maxAttempts: 3 });
    assert.ok((await worker.processOnce()) >= 2);
    const retry = await prisma.recommendationEventOutbox.findUniqueOrThrow({
      where: { deduplicationKey: `action:MATERIAL_LIKE:${operation('race-operation-1')}` },
    });
    assert.equal(retry.status, 'RETRY');
    assert.equal(retry.lastErrorCode, 'impression_not_ready');
    assert.equal(await prisma.recommendationAction.count({ where: { sourceOperationId: operation('race-operation-1') } }), 0);

    await prisma.recommendationEventOutbox.updateMany({
      where: { deduplicationKey: { in: [`exposure:${exposure.exposureId}`, `action:MATERIAL_LIKE:${operation('race-operation-1')}`] } },
      data: { availableAt: new Date(0) },
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if ((await prisma.recommendationAction.count({ where: { sourceOperationId: operation('race-operation-1') } })) === 1) break;
      await worker.processOnce();
      await prisma.recommendationEventOutbox.updateMany({
        where: { deduplicationKey: `action:MATERIAL_LIKE:${operation('race-operation-1')}` },
        data: { availableAt: new Date(0) },
      });
    }
    assert.equal(await prisma.recommendationAction.count({ where: { sourceOperationId: operation('race-operation-1') } }), 1);
  });
});
