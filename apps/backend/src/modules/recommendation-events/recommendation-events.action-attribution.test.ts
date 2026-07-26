import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { runWithRecommendationEventOrigin } from './recommendation-event-origin.js';
import {
  enqueueRecommendationAction,
  enqueueRecommendationExposure,
  getRecommendationActionPlan,
  persistRecommendationExposure,
  type RecommendationActionPlan,
} from './recommendation-events.service.js';
import {
  processRecommendationOutboxRecord,
} from './recommendation-events.outbox.worker.js';

const TEST_MARKER = '[test-recommendation-action-outbox]';
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ownedOutboxIds = new Set<string>();
let learnerId: string;
let otherLearnerId: string;

const operation = (label: string): string => `${TEST_MARKER}-${RUN_ID}-${label}`;

const trackOutboxId = (id: string): void => {
  ownedOutboxIds.add(id);
};

const trackOutboxByKeys = async (keys: string[]): Promise<void> => {
  const rows = await prisma.recommendationEventOutbox.findMany({
    where: { deduplicationKey: { in: keys } },
    select: { id: true },
  });
  for (const row of rows) {
    trackOutboxId(row.id);
  }
};

const cleanupOwnedOutbox = async (): Promise<void> => {
  if (ownedOutboxIds.size === 0) {
    return;
  }
  await prisma.recommendationEventOutbox.deleteMany({
    where: { id: { in: [...ownedOutboxIds] } },
  });
  ownedOutboxIds.clear();
};

const processOwnedKeys = async (
  deduplicationKeys: string[],
  config: { maxAttempts?: number; batchSize?: number } = {},
): Promise<number> => {
  const workerConfig = {
    pollIntervalMs: 10,
    batchSize: config.batchSize ?? 10,
    maxAttempts: config.maxAttempts ?? 5,
    leaseMs: 1_000,
  };
  await trackOutboxByKeys(deduplicationKeys);
  const rows = await prisma.recommendationEventOutbox.findMany({
    where: {
      deduplicationKey: { in: deduplicationKeys },
      status: { in: ['PENDING', 'RETRY'] },
    },
  });
  rows.sort((left, right) => {
    if (left.eventKind === right.eventKind) {
      return left.createdAt.getTime() - right.createdAt.getTime();
    }
    if (left.eventKind === 'RECOMMENDATION_GENERATION') return -1;
    if (right.eventKind === 'RECOMMENDATION_GENERATION') return 1;
    if (left.eventKind === 'RECOMMENDATION_EXPOSURE') return -1;
    if (right.eventKind === 'RECOMMENDATION_EXPOSURE') return 1;
    return 0;
  });

  let processed = 0;
  for (const row of rows) {
    const lockToken = `${TEST_MARKER}:${randomUUID()}`;
    const updated = await prisma.recommendationEventOutbox.update({
      where: { id: row.id },
      data: {
        status: 'PROCESSING',
        attemptCount: { increment: 1 },
        lockedAt: new Date(),
        lockToken,
      },
    });
    await processRecommendationOutboxRecord(
      {
        id: updated.id,
        event_kind: updated.eventKind,
        schema_version: updated.schemaVersion,
        deduplication_key: updated.deduplicationKey,
        payload: updated.payload,
        status: updated.status,
        attempt_count: updated.attemptCount,
        available_at: updated.availableAt,
        locked_at: updated.lockedAt,
        lock_token: updated.lockToken,
        processed_at: updated.processedAt,
        last_error_code: updated.lastErrorCode,
        last_error_summary: updated.lastErrorSummary,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
      },
      workerConfig,
    );
    processed += 1;
  }
  return processed;
};

const createLearner = async (label: string): Promise<string> => {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${label}`,
      email: `${TEST_MARKER}-${label}-${Date.now()}@impactloop.test`,
      passwordHash: 'test-only-hash',
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      recommendationEvidenceEligibility: 'EXCLUDED_TEST',
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: { create: { learnerType: 'STUDENT' } },
    },
    select: { id: true },
  });
  return user.id;
};

const seedImpression = async (entityType: 'MATERIAL' | 'PROJECT', entityId: string) => {
  const result = await runWithRecommendationEventOrigin('TEST', () =>
    persistRecommendationExposure({
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
    }),
  );
  return [...result.values()][0]!;
};

const enqueueAction = async (
  plan: RecommendationActionPlan,
  impressionId?: string,
  actionLearnerId = learnerId,
) => {
  const result = await enqueueRecommendationAction({
    learnerId: actionLearnerId,
    plan,
    headers: impressionId
      ? { 'x-recommendation-impression-id': impressionId }
      : {},
    eventSource: 'TEST',
  });
  await trackOutboxByKeys([`action:${plan.actionType}:${plan.sourceOperationId}`]);
  return result;
};

describe('recommendation action outbox attribution', () => {
  before(async () => {
    learnerId = await createLearner('primary');
    otherLearnerId = await createLearner('other');
  });

  after(async () => {
    await cleanupOwnedOutbox();
    await prisma.user.deleteMany({ where: { id: { in: [learnerId, otherLearnerId] } } });
    await prisma.$disconnect();
  });

  test('cleanup leaves unrelated claimable outbox rows untouched', async () => {
    const foreign = await prisma.recommendationEventOutbox.create({
      data: {
        eventKind: 'RECOMMENDATION_ACTION',
        schemaVersion: 'recommendation-action-outbox-v1',
        deduplicationKey: `foreign-action-unrelated-${RUN_ID}`,
        payload: { marker: 'foreign-pending-regression' },
      },
    });
    try {
      await enqueueAction({
        actionType: 'MATERIAL_VIEW',
        entityType: 'MATERIAL',
        entityId: 'cleanup-probe',
        sourceOperationId: operation('cleanup-probe'),
      });
      await cleanupOwnedOutbox();
      const surviving = await prisma.recommendationEventOutbox.findUniqueOrThrow({
        where: { id: foreign.id },
        select: { status: true, deduplicationKey: true },
      });
      assert.equal(surviving.status, 'PENDING');
      assert.equal(surviving.deduplicationKey, `foreign-action-unrelated-${RUN_ID}`);
    } finally {
      await prisma.recommendationEventOutbox
        .delete({ where: { id: foreign.id } })
        .catch(() => undefined);
    }
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
    const key = `action:MATERIAL_VIEW:${operation('view-operation-2')}`;
    await enqueueAction(
      {
        actionType: 'MATERIAL_VIEW',
        entityType: 'MATERIAL',
        entityId: 'action-material-2',
        sourceOperationId: operation('view-operation-2'),
      },
      impressionId,
    );
    assert.equal(await processOwnedKeys([key]), 1);
    const action = await prisma.recommendationAction.findFirstOrThrow({
      where: { learnerId, entityId: 'action-material-2' },
    });
    assert.equal(action.attributionType, 'DIRECT');

    await prisma.recommendationEventOutbox.updateMany({
      where: { deduplicationKey: key },
      data: { status: 'PENDING', availableAt: new Date(0), processedAt: null },
    });
    assert.equal(await processOwnedKeys([key]), 1);
    assert.equal(
      await prisma.recommendationAction.count({ where: { id: action.id } }),
      1,
    );
  });

  test('assisted attribution selects the latest matching impression', async () => {
    const first = await seedImpression('PROJECT', 'action-project-1');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await seedImpression('PROJECT', 'action-project-1');
    const key = `action:PROJECT_SAVE:${operation('save-operation-1')}`;
    await enqueueAction({
      actionType: 'PROJECT_SAVE',
      entityType: 'PROJECT',
      entityId: 'action-project-1',
      sourceOperationId: operation('save-operation-1'),
    });
    assert.equal(await processOwnedKeys([key]), 1);
    const action = await prisma.recommendationAction.findFirstOrThrow({
      where: { learnerId, entityId: 'action-project-1' },
    });
    assert.equal(action.attributionType, 'ASSISTED');
    assert.equal(action.impressionId, second);
    assert.notEqual(first, second);
  });

  test('foreign learner and entity mismatch are processed without an action row', async () => {
    const impressionId = await seedImpression('MATERIAL', 'action-material-3');
    const key = `action:MATERIAL_LIKE:${operation('foreign-operation-3')}`;
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
    assert.equal(await processOwnedKeys([key]), 1);
    assert.equal(
      await prisma.recommendationAction.count({ where: { sourceOperationId: operation('foreign-operation-3') } }),
      0,
    );
    assert.equal(
      await prisma.recommendationEventOutbox.count({
        where: { deduplicationKey: key, status: 'PROCESSED' },
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
    const key = `action:MATERIAL_VIEW:${operation('expired-operation-1')}`;
    await enqueueAction(
      {
        actionType: 'MATERIAL_VIEW',
        entityType: 'MATERIAL',
        entityId: 'action-expired-1',
        sourceOperationId: operation('expired-operation-1'),
      },
      impressionId,
    );
    assert.equal(await processOwnedKeys([key]), 1);
    assert.equal(
      await prisma.recommendationAction.count({ where: { sourceOperationId: operation('expired-operation-1') } }),
      0,
    );

    const originalTransaction = prisma.$transaction.bind(prisma);
    Object.defineProperty(prisma, '$transaction', {
      configurable: true,
      value: async () => {
        throw new Error('test action enqueue failure');
      },
    });
    try {
      await assert.doesNotReject(() => enqueueAction({
        actionType: 'MATERIAL_LIKE',
        entityType: 'MATERIAL',
        entityId: 'action-expired-1',
        sourceOperationId: operation('failure-operation-1'),
      }));
    } finally {
      Object.defineProperty(prisma, '$transaction', {
        configurable: true,
        value: originalTransaction,
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
    const likeKey = `action:MATERIAL_LIKE:${operation('malformed-hint-1')}`;
    const badKey = `action:PROJECT_LIKE:${operation('unsupported-entity-1')}`;
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
    assert.equal(await processOwnedKeys([likeKey, badKey]), 2);
    const assisted = await prisma.recommendationAction.findFirstOrThrow({
      where: { sourceOperationId: operation('malformed-hint-1') },
    });
    assert.equal(assisted.impressionId, impressionId);
    assert.equal(assisted.attributionType, 'ASSISTED');
    assert.equal(
      await prisma.recommendationEventOutbox.count({
        where: { deduplicationKey: badKey, status: 'DEAD' },
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
      eventSource: 'TEST' as const,
    };
    const exposure = await enqueueRecommendationExposure({
      generation,
      cacheState: 'MISS',
      includeGeneration: true,
      items: [{ entityType: 'MATERIAL', entityId: 'action-race-1', sectionKey: 'test', position: 1, score: 1, reasons: ['Popular'] }],
    });
    const exposureRow = await prisma.recommendationEventOutbox.findFirstOrThrow({
      where: {
        eventKind: 'RECOMMENDATION_EXPOSURE',
        payload: { path: ['exposureId'], equals: exposure.exposureId },
      },
      select: { id: true, deduplicationKey: true },
    });
    trackOutboxId(exposureRow.id);
    await trackOutboxByKeys([`generation:${generation.generationKey}`]);
    const actionKey = `action:MATERIAL_LIKE:${operation('race-operation-1')}`;
    await enqueueAction(
      { actionType: 'MATERIAL_LIKE', entityType: 'MATERIAL', entityId: 'action-race-1', sourceOperationId: operation('race-operation-1') },
      [...exposure.impressionIds.values()][0],
    );

    assert.equal(
      await processOwnedKeys([
        `generation:${generation.generationKey}`,
        actionKey,
      ]),
      2,
    );
    const retry = await prisma.recommendationEventOutbox.findUniqueOrThrow({
      where: { deduplicationKey: actionKey },
    });
    assert.equal(retry.status, 'RETRY');
    assert.equal(retry.lastErrorCode, 'impression_not_ready');
    assert.equal(await prisma.recommendationAction.count({ where: { sourceOperationId: operation('race-operation-1') } }), 0);

    await prisma.recommendationEventOutbox.updateMany({
      where: {
        deduplicationKey: {
          in: [exposureRow.deduplicationKey, actionKey],
        },
      },
      data: {
        availableAt: new Date(0),
        status: 'PENDING',
        processedAt: null,
        lockToken: null,
        lockedAt: null,
      },
    });
    assert.equal(
      await processOwnedKeys([exposureRow.deduplicationKey, actionKey]),
      2,
    );
    assert.equal(await prisma.recommendationAction.count({ where: { sourceOperationId: operation('race-operation-1') } }), 1);
  });
});
