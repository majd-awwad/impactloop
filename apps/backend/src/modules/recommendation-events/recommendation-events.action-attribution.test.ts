import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { signAccessToken } from '../../utils/jwt.js';
import { likeMaterialById, unlikeMaterialById } from '../materials/materials.service.js';
import {
  followLearningProjectById,
  likeLearningProjectById,
  saveLearningProjectById,
  unfollowLearningProjectById,
  unlikeLearningProjectById,
  unsaveLearningProjectById,
} from '../learning-projects/learning-projects.service.js';
import { runWithRecommendationEventOrigin } from './recommendation-event-origin.js';
import { reduceRecommendationToggleState } from './recommendation-action-state.js';
import {
  commitRecommendationToggleTransition,
  enqueueRecommendationAction,
  enqueueRecommendationExposure,
  getRecommendationActionPlan,
  persistRecommendationExposure,
  recommendationToggleDeduplicationKey,
  RECOMMENDATION_TOGGLE_IDEMPOTENCY_SCOPE,
  runWithRecommendationToggleRequestContext,
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

  test('the response-boundary plan no longer emits toggles and still covers builds', () => {
    const request = (method: string, path: string, params: Record<string, string>) => ({
      method,
      path,
      params,
      headers: { 'idempotency-key': operation('route-plan') },
      auth: { sub: learnerId, roles: ['LEARNER'] },
    });
    assert.equal(
      getRecommendationActionPlan(
        request('POST', '/api/materials/material-1/like', { id: 'material-1' }) as never,
        { success: true, data: { likesCount: 1 } },
      ),
      null,
    );
    assert.equal(
      getRecommendationActionPlan(
        request('DELETE', '/api/learning-projects/project-1/save', { id: 'project-1' }) as never,
        { success: true, data: { isSaved: false } },
      ),
      null,
    );
    const buildPlan = getRecommendationActionPlan(
      request('PATCH', '/api/learning-projects/project-1/builds/me/items/item-1', { id: 'project-1', itemId: 'item-1' }) as never,
      { success: true, data: { id: 'build-1', updatedAt: new Date().toISOString() } },
    );
    assert.equal(buildPlan?.actionType, 'PROJECT_BUILD_PROGRESS_UPDATED');
    assert.equal(
      getRecommendationActionPlan(
        request('GET', '/api/materials/material-1', { id: 'material-1' }) as never,
        { success: true, data: { id: 'material-1' } },
      )?.actionType,
      'MATERIAL_VIEW',
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

  describe('RP-04.3A stateful recommendation toggle transitions', () => {
  const PG_CONCURRENT_QUERY_WARNING =
    'Calling client.query() when the client is already executing a query is deprecated';
  let materialId = '';
  let projectId = '';
  let supplierId = '';
  let serverUrl = '';
  let closeServer: (() => Promise<void>) | undefined;
  const ownedToggleKeys: string[] = [];

  const trackToggleKey = (key: string): void => {
    ownedToggleKeys.push(key);
  };

  const withOrigin = <T>(fn: () => Promise<T>): Promise<T> =>
    runWithRecommendationEventOrigin('TEST', fn);

  before(async () => {
    const materialCategory = await prisma.category.findFirst({
      where: {
        isActive: true,
        categoryType: { in: ['MATERIAL', 'BOTH'] },
      },
      select: { id: true },
    });
    const projectCategory = await prisma.category.findFirst({
      where: {
        isActive: true,
        categoryType: { in: ['PROJECT', 'BOTH'] },
      },
      select: { id: true },
    });
    const location = await prisma.location.findFirst({ select: { id: true } });
    assert.ok(materialCategory, 'expected an active material category');
    assert.ok(projectCategory, 'expected an active project category');
    assert.ok(location, 'expected a location');

    const supplier = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} toggle-supplier`,
        email: `${TEST_MARKER}-toggle-supplier-${Date.now()}@impactloop.test`,
        passwordHash: 'test-only-hash',
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        recommendationEvidenceEligibility: 'EXCLUDED_TEST',
        roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
      },
      select: { id: true },
    });
    supplierId = supplier.id;

    const material = await prisma.material.create({
      data: {
        ownerId: supplierId,
        categoryId: materialCategory.id,
        locationId: location.id,
        title: `${TEST_MARKER} toggle material`,
        description: 'toggle contract material',
        materialType: 'Toggle test material',
        quantity: 1,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: true,
        pickupAllowed: true,
        deliveryAllowed: false,
      },
      select: { id: true },
    });
    materialId = material.id;

    const project = await prisma.learningProject.create({
      data: {
        createdBy: learnerId,
        categoryId: projectCategory.id,
        title: `${TEST_MARKER} toggle project`,
        shortDescription: 'toggle contract project',
        description: 'toggle contract project description',
        difficulty: 'BEGINNER',
        status: 'PUBLISHED',
        submittedAt: new Date(),
      },
      select: { id: true },
    });
    projectId = project.id;

    const { createApp } = await import('../../app.js');
    const app = createApp({ recommendationEventOrigin: 'TEST' });
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${address.port}`;
    closeServer = () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
  });

  after(async () => {
    if (ownedToggleKeys.length > 0) {
      await prisma.idempotencyRecord.deleteMany({
        where: {
          userId: learnerId,
          scope: RECOMMENDATION_TOGGLE_IDEMPOTENCY_SCOPE,
          key: { in: ownedToggleKeys },
        },
      });
      await prisma.recommendationEventOutbox.deleteMany({
        where: {
          deduplicationKey: {
            in: ownedToggleKeys.map((key) =>
              recommendationToggleDeduplicationKey(learnerId, key),
            ),
          },
        },
      });
    }
    if (materialId) {
      await prisma.materialLike.deleteMany({ where: { materialId } });
      await prisma.material.deleteMany({ where: { id: materialId } });
    }
    if (projectId) {
      await prisma.projectLike.deleteMany({ where: { projectId } });
      await prisma.projectSave.deleteMany({ where: { projectId } });
      await prisma.projectFollow.deleteMany({ where: { projectId } });
      await prisma.learningProject.deleteMany({ where: { id: projectId } });
    }
    if (supplierId) {
      await prisma.idempotencyRecord.deleteMany({
        where: {
          userId: supplierId,
          scope: RECOMMENDATION_TOGGLE_IDEMPOTENCY_SCOPE,
        },
      });
      await prisma.user.deleteMany({ where: { id: supplierId } });
    }
    await closeServer?.();
  });

  const outboxCountFor = async (key: string) =>
    prisma.recommendationEventOutbox.count({
      where: {
        deduplicationKey: recommendationToggleDeduplicationKey(learnerId, key),
      },
    });

  const commitMaterialLike = (key: string) => {
    trackToggleKey(key);
    return withOrigin(() =>
      commitRecommendationToggleTransition({
        learnerId,
        actionType: 'MATERIAL_LIKE',
        entityType: 'MATERIAL',
        entityId: materialId,
        sourceOperationId: key,
        apply: (tx) =>
          tx.materialLike
            .createMany({
              data: [{ materialId, userId: learnerId }],
              skipDuplicates: true,
            })
            .then((result) => result.count > 0),
        buildResponse: async (tx, active) => ({
          materialId,
          likesCount: await tx.materialLike.count({ where: { materialId } }),
          isLiked: active,
        }),
      }),
    );
  };

  const commitMaterialUnlike = (key: string) => {
    trackToggleKey(key);
    return withOrigin(() =>
      commitRecommendationToggleTransition({
        learnerId,
        actionType: 'MATERIAL_UNLIKE',
        entityType: 'MATERIAL',
        entityId: materialId,
        sourceOperationId: key,
        apply: (tx) =>
          tx.materialLike
            .deleteMany({ where: { materialId, userId: learnerId } })
            .then((result) => result.count > 0),
        buildResponse: async (tx, active) => ({
          materialId,
          likesCount: await tx.materialLike.count({ where: { materialId } }),
          isLiked: active,
        }),
      }),
    );
  };

  test('material like and unlike emit one transition each and reconstruct state', async () => {
    const likeKey = operation('toggle-material-like');
    const unlikeKey = operation('toggle-material-unlike');
    const like = await commitMaterialLike(likeKey);
    assert.equal(like.transitioned, true);
    assert.equal(like.response.isLiked, true);
    assert.equal(await outboxCountFor(likeKey), 1);
    assert.equal(
      await prisma.materialLike.count({
        where: { materialId, userId: learnerId },
      }),
      1,
    );

    const unlike = await commitMaterialUnlike(unlikeKey);
    assert.equal(unlike.transitioned, true);
    assert.equal(unlike.response.isLiked, false);
    assert.equal(await outboxCountFor(unlikeKey), 1);
    assert.equal(
      await prisma.materialLike.count({
        where: { materialId, userId: learnerId },
      }),
      0,
    );

    const likePayload = await prisma.recommendationEventOutbox.findUniqueOrThrow({
      where: {
        deduplicationKey: recommendationToggleDeduplicationKey(learnerId, likeKey),
      },
    });
    const unlikePayload = await prisma.recommendationEventOutbox.findUniqueOrThrow({
      where: {
        deduplicationKey: recommendationToggleDeduplicationKey(
          learnerId,
          unlikeKey,
        ),
      },
    });
    assert.equal((likePayload.payload as { actionType: string }).actionType, 'MATERIAL_LIKE');
    assert.equal((likePayload.payload as { eventSource: string }).eventSource, 'TEST');
    assert.equal((unlikePayload.payload as { actionType: string }).actionType, 'MATERIAL_UNLIKE');
    assert.equal((unlikePayload.payload as { eventSource: string }).eventSource, 'TEST');

    const reconstructed = reduceRecommendationToggleState(
      {
        learnerId,
        entityType: 'MATERIAL',
        entityId: materialId,
        family: 'LIKE',
      },
      [
        {
          actionType: 'MATERIAL_LIKE',
          learnerId,
          entityType: 'MATERIAL',
          entityId: materialId,
          sourceOperationId: likeKey,
          eventSource: 'TEST',
        },
        {
          actionType: 'MATERIAL_UNLIKE',
          learnerId,
          entityType: 'MATERIAL',
          entityId: materialId,
          sourceOperationId: unlikeKey,
          eventSource: 'TEST',
        },
      ],
    );
    assert.equal(reconstructed.state, 'inactive');
  });

  test('duplicate active and inactive material requests emit no second transition', async () => {
    const likeKey = operation('toggle-material-dup-like');
    const unlikeKey = operation('toggle-material-dup-unlike');
    const firstLike = await commitMaterialLike(likeKey);
    assert.equal(firstLike.transitioned, true);
    const secondLikeKey = operation('toggle-material-dup-like-2');
    const secondLike = await commitMaterialLike(secondLikeKey);
    assert.equal(secondLike.transitioned, false);
    assert.equal(await outboxCountFor(secondLikeKey), 0);

    const firstUnlike = await commitMaterialUnlike(unlikeKey);
    assert.equal(firstUnlike.transitioned, true);
    const secondUnlikeKey = operation('toggle-material-dup-unlike-2');
    const secondUnlike = await commitMaterialUnlike(secondUnlikeKey);
    assert.equal(secondUnlike.transitioned, false);
    assert.equal(await outboxCountFor(secondUnlikeKey), 0);
  });

  test('exact replay after later unlike returns prior result without reactivation', async () => {
    const likeKey = operation('toggle-material-replay-like');
    const unlikeKey = operation('toggle-material-replay-unlike');
    const first = await commitMaterialLike(likeKey);
    assert.equal(first.transitioned, true);
    await commitMaterialUnlike(unlikeKey);
    assert.equal(
      await prisma.materialLike.count({
        where: { materialId, userId: learnerId },
      }),
      0,
    );

    const replay = await commitMaterialLike(likeKey);
    assert.equal(replay.replayed, true);
    assert.equal(replay.transitioned, false);
    assert.equal(replay.response.isLiked, true);
    assert.equal(
      await prisma.materialLike.count({
        where: { materialId, userId: learnerId },
      }),
      0,
    );
    assert.equal(await outboxCountFor(likeKey), 1);
  });

  test('conflicting reuse of the same operation key fails closed before mutation', async () => {
    const key = operation('toggle-material-conflict');
    await commitMaterialLike(key);
    await assert.rejects(
      () => commitMaterialUnlike(key),
      (error: unknown) =>
        error instanceof AppError && error.code === 'IDEMPOTENCY_KEY_REUSED',
    );
    assert.equal(
      await prisma.materialLike.count({
        where: { materialId, userId: learnerId },
      }),
      1,
    );
    assert.equal(await outboxCountFor(key), 1);
    await commitMaterialUnlike(operation('toggle-material-conflict-cleanup'));
  });

  test('unauthorized toggle HTTP attempt emits no relation claim outbox or action', async () => {
    const unauthKey = operation('toggle-http-unauth');
    const forbiddenKey = operation('toggle-http-forbidden');
    trackToggleKey(unauthKey);
    trackToggleKey(forbiddenKey);

    const beforeLikes = await prisma.materialLike.count({
      where: { materialId },
    });
    const beforeActions = await prisma.recommendationAction.count({
      where: { entityType: 'MATERIAL', entityId: materialId },
    });

    const unauthenticated = await fetch(
      `${serverUrl}/api/materials/${materialId}/like`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': unauthKey },
      },
    );
    assert.equal(unauthenticated.status, 401);

    const supplierToken = signAccessToken({
      sub: supplierId,
      roles: ['SUPPLIER'],
    });
    const forbidden = await fetch(
      `${serverUrl}/api/materials/${materialId}/like`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supplierToken}`,
          'Idempotency-Key': forbiddenKey,
        },
      },
    );
    assert.equal(forbidden.status, 403);

    assert.equal(
      await prisma.materialLike.count({ where: { materialId } }),
      beforeLikes,
    );
    assert.equal(
      await prisma.idempotencyRecord.count({
        where: {
          scope: RECOMMENDATION_TOGGLE_IDEMPOTENCY_SCOPE,
          key: { in: [unauthKey, forbiddenKey] },
        },
      }),
      0,
    );
    assert.equal(
      await prisma.recommendationEventOutbox.count({
        where: {
          deduplicationKey: {
            in: [
              recommendationToggleDeduplicationKey(learnerId, unauthKey),
              recommendationToggleDeduplicationKey(learnerId, forbiddenKey),
              recommendationToggleDeduplicationKey(supplierId, unauthKey),
              recommendationToggleDeduplicationKey(supplierId, forbiddenKey),
            ],
          },
        },
      }),
      0,
    );
    assert.equal(
      await prisma.recommendationAction.count({
        where: { entityType: 'MATERIAL', entityId: materialId },
      }),
      beforeActions,
    );
  });

  test('post-mutation failure rolls back claim domain and outbox', async () => {
    const key = operation('toggle-material-rollback');
    trackToggleKey(key);
    assert.equal(
      await prisma.materialLike.count({
        where: { materialId, userId: learnerId },
      }),
      0,
    );

    await assert.rejects(() =>
      withOrigin(() =>
        commitRecommendationToggleTransition({
          learnerId,
          actionType: 'MATERIAL_LIKE',
          entityType: 'MATERIAL',
          entityId: materialId,
          sourceOperationId: key,
          apply: async (tx) => {
            const result = await tx.materialLike.createMany({
              data: [{ materialId, userId: learnerId }],
              skipDuplicates: true,
            });
            assert.equal(result.count, 1);
            return true;
          },
          buildResponse: async () => {
            throw new Error('forced post-mutation toggle failure');
          },
        }),
      ),
    );

    assert.equal(
      await prisma.materialLike.count({
        where: { materialId, userId: learnerId },
      }),
      0,
    );
    assert.equal(
      await prisma.idempotencyRecord.count({
        where: {
          userId: learnerId,
          scope: RECOMMENDATION_TOGGLE_IDEMPOTENCY_SCOPE,
          key,
        },
      }),
      0,
    );
    assert.equal(await outboxCountFor(key), 0);
    assert.equal(
      await prisma.recommendationAction.count({
        where: { sourceOperationId: key },
      }),
      0,
    );
  });

  test('project save like and follow families emit transitions and suppress no-ops', async () => {
    const cases = [
      {
        family: 'SAVE' as const,
        activate: 'PROJECT_SAVE' as const,
        deactivate: 'PROJECT_UNSAVE' as const,
        activateKey: operation('toggle-project-save'),
        deactivateKey: operation('toggle-project-unsave'),
        activateDupKey: operation('toggle-project-save-dup'),
        serviceActivate: () => saveLearningProjectById(projectId, learnerId),
        serviceDeactivate: () => unsaveLearningProjectById(projectId, learnerId),
        readActive: async () =>
          (await prisma.projectSave.count({
            where: { projectId, userId: learnerId },
          })) === 1,
      },
      {
        family: 'LIKE' as const,
        activate: 'PROJECT_LIKE' as const,
        deactivate: 'PROJECT_UNLIKE' as const,
        activateKey: operation('toggle-project-like'),
        deactivateKey: operation('toggle-project-unlike'),
        activateDupKey: operation('toggle-project-like-dup'),
        serviceActivate: () => likeLearningProjectById(projectId, learnerId),
        serviceDeactivate: () => unlikeLearningProjectById(projectId, learnerId),
        readActive: async () =>
          (await prisma.projectLike.count({
            where: { projectId, userId: learnerId },
          })) === 1,
      },
      {
        family: 'FOLLOW' as const,
        activate: 'PROJECT_FOLLOW' as const,
        deactivate: 'PROJECT_UNFOLLOW' as const,
        activateKey: operation('toggle-project-follow'),
        deactivateKey: operation('toggle-project-unfollow'),
        activateDupKey: operation('toggle-project-follow-dup'),
        serviceActivate: () => followLearningProjectById(projectId, learnerId),
        serviceDeactivate: () => unfollowLearningProjectById(projectId, learnerId),
        readActive: async () =>
          (await prisma.projectFollow.count({
            where: { projectId, userId: learnerId },
          })) === 1,
      },
    ];

    for (const entry of cases) {
      trackToggleKey(entry.activateKey);
      trackToggleKey(entry.deactivateKey);
      trackToggleKey(entry.activateDupKey);

      await withOrigin(() =>
        runWithRecommendationToggleRequestContext(
          { headers: { 'idempotency-key': entry.activateKey } },
          () => entry.serviceActivate(),
        ),
      );
      assert.equal(await entry.readActive(), true);
      assert.equal(await outboxCountFor(entry.activateKey), 1);

      await withOrigin(() =>
        runWithRecommendationToggleRequestContext(
          { headers: { 'idempotency-key': entry.activateDupKey } },
          () => entry.serviceActivate(),
        ),
      );
      assert.equal(await outboxCountFor(entry.activateDupKey), 0);

      await withOrigin(() =>
        runWithRecommendationToggleRequestContext(
          { headers: { 'idempotency-key': entry.deactivateKey } },
          () => entry.serviceDeactivate(),
        ),
      );
      assert.equal(await entry.readActive(), false);
      assert.equal(await outboxCountFor(entry.deactivateKey), 1);

      const activateRow = await prisma.recommendationEventOutbox.findUniqueOrThrow({
        where: {
          deduplicationKey: recommendationToggleDeduplicationKey(
            learnerId,
            entry.activateKey,
          ),
        },
      });
      assert.equal(
        (activateRow.payload as { actionType: string }).actionType,
        entry.activate,
      );
      assert.equal((activateRow.payload as { eventSource: string }).eventSource, 'TEST');
    }
  });

  test('outbox retry preserves toggle direction and origin', async () => {
    const key = operation('toggle-material-retry');
    await commitMaterialLike(key);
    const dedupe = recommendationToggleDeduplicationKey(learnerId, key);
    await trackOutboxByKeys([dedupe]);
    const before = await prisma.recommendationEventOutbox.findUniqueOrThrow({
      where: { deduplicationKey: dedupe },
    });
    const payload = before.payload as {
      actionType: string;
      eventSource: string;
    };
    assert.equal(payload.actionType, 'MATERIAL_LIKE');
    assert.equal(payload.eventSource, 'TEST');

    await prisma.recommendationEventOutbox.update({
      where: { id: before.id },
      data: {
        status: 'PENDING',
        availableAt: new Date(0),
        processedAt: null,
        lockToken: null,
        lockedAt: null,
      },
    });
    assert.equal(await processOwnedKeys([dedupe]), 1);
    const after = await prisma.recommendationEventOutbox.findUniqueOrThrow({
      where: { deduplicationKey: dedupe },
    });
    assert.deepEqual(after.payload, before.payload);
    await commitMaterialUnlike(operation('toggle-material-retry-cleanup'));
  });

  test('historical recommendation action rows are not rewritten by toggle commits', async () => {
    const impressionId = await seedImpression('MATERIAL', materialId);
    const historicalId = randomUUID();
    await prisma.recommendationAction.create({
      data: {
        id: historicalId,
        impressionId,
        learnerId,
        entityType: 'MATERIAL',
        entityId: materialId,
        actionType: 'MATERIAL_LIKE',
        attributionType: 'ASSISTED',
        sourceOperationId: operation('historical-action'),
        eventSource: 'LEGACY_UNCLASSIFIED',
      },
    });
    const before = await prisma.recommendationAction.findUniqueOrThrow({
      where: { id: historicalId },
    });
    await commitMaterialLike(operation('toggle-after-historical'));
    const after = await prisma.recommendationAction.findUniqueOrThrow({
      where: { id: historicalId },
    });
    assert.equal(after.eventSource, 'LEGACY_UNCLASSIFIED');
    assert.equal(after.actionType, before.actionType);
    assert.equal(after.sourceOperationId, before.sourceOperationId);
    await prisma.recommendationAction.delete({ where: { id: historicalId } });
    await commitMaterialUnlike(operation('toggle-after-historical-cleanup'));
  });

  test('concurrent duplicate active requests do not emit a second positive event', async () => {
    const warnings: string[] = [];
    const onWarning = (warning: Error) => {
      warnings.push(warning.message);
    };
    process.on('warning', onWarning);
    try {
      await prisma.materialLike.deleteMany({
        where: { materialId, userId: learnerId },
      });
      const keyA = operation('toggle-material-concurrent-a');
      const keyB = operation('toggle-material-concurrent-b');
      const [first, second] = await Promise.all([
        commitMaterialLike(keyA),
        commitMaterialLike(keyB),
      ]);
      assert.equal(first.transitioned || second.transitioned, true);
      assert.equal(
        Number(first.transitioned) + Number(second.transitioned),
        1,
      );
      assert.equal(
        await prisma.materialLike.count({
          where: { materialId, userId: learnerId },
        }),
        1,
      );
      assert.equal(
        (await outboxCountFor(keyA)) + (await outboxCountFor(keyB)),
        1,
      );
      assert.equal(
        warnings.some((message) => message.includes(PG_CONCURRENT_QUERY_WARNING)),
        false,
      );
      await commitMaterialUnlike(operation('toggle-material-concurrent-cleanup'));
    } finally {
      process.off('warning', onWarning);
    }
  });

  test('service material like path uses toggle ALS and does not plan via middleware mapper', async () => {
    const key = operation('toggle-service-material-like');
    trackToggleKey(key);
    await withOrigin(() =>
      runWithRecommendationToggleRequestContext(
        { headers: { 'idempotency-key': key } },
        () => likeMaterialById(materialId, learnerId),
      ),
    );
    assert.equal(await outboxCountFor(key), 1);
    await withOrigin(() =>
      runWithRecommendationToggleRequestContext(
        { headers: { 'idempotency-key': operation('toggle-service-material-unlike') } },
        () => unlikeMaterialById(materialId, learnerId),
      ),
    );
    trackToggleKey(operation('toggle-service-material-unlike'));
  });
  });
});
