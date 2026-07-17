import assert from 'node:assert/strict';
import { after, afterEach, before, describe, test } from 'node:test';

import {
  Prisma,
  RecommendationOutboxEventKind,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { env } from '../../config/env.js';
import {
  enqueueRecommendationExposure,
  type RecommendationGenerationMetadata,
} from './recommendation-events.service.js';
import {
  claimRecommendationOutboxBatch,
  processRecommendationOutboxRecord,
  RecommendationOutboxWorker,
  recommendationOutboxWorkerDefaults,
  recoverStaleRecommendationOutbox,
} from './recommendation-events.outbox.worker.js';

const TEST_MARKER = '[test-recommendation-outbox]';
let learnerId: string;

const generationFor = (generationKey: string): RecommendationGenerationMetadata => ({
  generationKey,
  learnerId,
  surface: 'LEARNER_HOME',
  algorithmName: 'deterministic-hybrid',
  algorithmVersion: 'learner-home-v1',
  policyVersion: 'learner-home-policy-v1',
  generatedAt: new Date(),
  candidateCount: 1,
  shownItemCount: 1,
  generationDurationMs: 11,
  generationCacheState: 'MISS',
  candidateTraces: [
    {
      entityType: 'MATERIAL',
      entityId: 'outbox-material-1',
      surface: 'LEARNER_HOME',
      sectionKey: 'suggested_materials',
      candidateSource: 'test_pool',
      eligibilityResult: 'ELIGIBLE',
      rankBeforeSelection: 1,
      finalScore: 3,
      scoreComponents: { relevance: 3, ignored: 'bounded' },
      selected: true,
    },
  ],
});

const enqueueGeneration = async (generationKey: string, correlationId: string) =>
  enqueueRecommendationExposure({
    generation: generationFor(generationKey),
    cacheState: 'MISS',
    correlationId,
    includeGeneration: true,
    items: [
      {
        entityType: 'MATERIAL',
        entityId: 'outbox-material-1',
        sectionKey: 'suggested_materials',
        position: 1,
        score: 3,
        reasons: ['Matches your interests'],
      },
    ],
  });

const createRawOutboxRow = async (input: {
  eventKind: RecommendationOutboxEventKind;
  schemaVersion: string;
  deduplicationKey: string;
  payload: unknown;
}) =>
  prisma.recommendationEventOutbox.create({
    data: {
      eventKind: input.eventKind,
      schemaVersion: input.schemaVersion,
      deduplicationKey: input.deduplicationKey,
      payload: input.payload as Prisma.InputJsonValue,
    },
  });

describe('recommendation outbox worker', () => {
  before(async () => {
    const user = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} learner`,
        email: `${TEST_MARKER}-${Date.now()}@impactloop.test`,
        passwordHash: 'test-only-hash',
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
        learnerProfile: { create: { learnerType: 'STUDENT' } },
      },
      select: { id: true },
    });
    learnerId = user.id;
  });

  afterEach(async () => {
    const rows = await prisma.recommendationEventOutbox.findMany({
      select: { id: true, payload: true },
    });
    const ids = rows
      .filter((row) => (row.payload as { learnerId?: unknown }).learnerId === learnerId)
      .map((row) => row.id);
    if (ids.length > 0) {
      await prisma.recommendationEventOutbox.deleteMany({ where: { id: { in: ids } } });
    }
  });

  after(async () => {
    const rows = await prisma.recommendationEventOutbox.findMany({
      select: { id: true, payload: true },
    });
    const ids = rows
      .filter((row) => {
        const payload = row.payload as { learnerId?: unknown };
        return payload.learnerId === learnerId;
      })
      .map((row) => row.id);
    if (ids.length > 0) {
      await prisma.recommendationEventOutbox.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.user.delete({ where: { id: learnerId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test('enqueues one generation and exposure without synchronous domain rows', async () => {
    const generationKey = `outbox-generation-${Date.now()}-one`;
    const result = await enqueueGeneration(generationKey, 'outbox-correlation-one');

    assert.equal(result.enqueued, true);
    assert.equal(result.impressionIds.size, 1);
    assert.equal(
      await prisma.recommendationEventOutbox.count({
        where: { deduplicationKey: { in: [`generation:${generationKey}`] } },
      }),
      1,
    );
    assert.equal(
      await prisma.recommendationGeneration.count({ where: { learnerId } }),
      0,
    );
    assert.equal(
      await prisma.recommendationImpression.count({ where: { learnerId } }),
      0,
    );
    await prisma.recommendationEventOutbox.deleteMany({
      where: {
        deduplicationKey: {
          in: [`generation:${generationKey}`, `exposure:${result.exposureId}`],
        },
      },
    });
  });

  test('enqueue failure is non-fatal and returns no impression IDs', async () => {
    const originalCreateMany = prisma.recommendationEventOutbox.createMany;
    Object.defineProperty(prisma.recommendationEventOutbox, 'createMany', {
      configurable: true,
      value: async () => {
        throw new Error('test enqueue failure');
      },
    });
    try {
      const result = await enqueueGeneration(
        `outbox-generation-${Date.now()}-enqueue-failure`,
        'outbox-correlation-enqueue-failure',
      );
      assert.equal(result.enqueued, false);
      assert.equal(result.impressionIds.size, 0);
      assert.equal(await prisma.recommendationEventOutbox.count(), 0);
      assert.equal(await prisma.recommendationGeneration.count({ where: { learnerId } }), 0);
      assert.equal(await prisma.recommendationImpression.count({ where: { learnerId } }), 0);
    } finally {
      Object.defineProperty(prisma.recommendationEventOutbox, 'createMany', {
        configurable: true,
        value: originalCreateMany,
      });
    }
  });

  test('worker materializes generation and exposure idempotently', async () => {
    const generationKey = `outbox-generation-${Date.now()}-two`;
    const result = await enqueueGeneration(generationKey, 'outbox-correlation-two');
    const worker = new RecommendationOutboxWorker({
      pollIntervalMs: 10,
      batchSize: 10,
      maxAttempts: 3,
      leaseMs: 1_000,
    });

    assert.equal(await worker.processOnce(), 2);
    assert.equal(
      await prisma.recommendationGeneration.count({ where: { generationKey } }),
      1,
    );
    assert.equal(
      await prisma.recommendationRequest.count({
        where: { learnerId, correlationId: 'outbox-correlation-two' },
      }),
      1,
    );
    assert.equal(
      await prisma.recommendationImpression.count({
        where: { learnerId, request: { correlationId: 'outbox-correlation-two' } },
      }),
      1,
    );

    const request = await prisma.recommendationRequest.findFirstOrThrow({
      where: { learnerId, correlationId: 'outbox-correlation-two' },
      select: { id: true },
    });
    await prisma.recommendationEventOutbox.updateMany({
      where: { deduplicationKey: `exposure:${result.exposureId}` },
      data: {
        status: 'PENDING',
        availableAt: new Date(0),
        processedAt: null,
      },
    });
    assert.equal(await worker.processOnce(), 1);
    assert.equal(
      await prisma.recommendationRequest.count({ where: { id: request.id } }),
      1,
    );
    assert.equal(
      await prisma.recommendationImpression.count({ where: { requestId: request.id } }),
      1,
    );
  });

  test('claims are bounded and do not overlap across workers', async () => {
    const rows = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        enqueueGeneration(
          `outbox-generation-${Date.now()}-claim-${index}`,
          `outbox-correlation-claim-${index}`,
        ),
      ),
    );
    void rows;

    const [first, second] = await Promise.all([
      claimRecommendationOutboxBatch({
        workerId: 'worker-a',
        batchSize: 2,
        leaseMs: 1_000,
      }),
      claimRecommendationOutboxBatch({
        workerId: 'worker-b',
        batchSize: 2,
        leaseMs: 1_000,
      }),
    ]);
    assert.equal(first.length, 2);
    assert.equal(second.length, 2);
    assert.equal(
      new Set([...first, ...second].map((row) => row.id)).size,
      4,
    );
  });

  test('future events are skipped and active leases are not stolen', async () => {
    const futureGeneration = `outbox-generation-${Date.now()}-future`;
    await enqueueGeneration(futureGeneration, 'outbox-correlation-future');
    await prisma.recommendationEventOutbox.updateMany({
      where: { deduplicationKey: `generation:${futureGeneration}` },
      data: { availableAt: new Date(Date.now() + 60_000) },
    });
    assert.equal(
      (await claimRecommendationOutboxBatch({
        workerId: 'worker-future',
        batchSize: 10,
        leaseMs: 1_000,
      })).some((row) => row.deduplication_key === `generation:${futureGeneration}`),
      false,
    );

    const activeGeneration = `outbox-generation-${Date.now()}-active`;
    await enqueueGeneration(activeGeneration, 'outbox-correlation-active');
    await prisma.recommendationEventOutbox.updateMany({
      where: { deduplicationKey: `generation:${activeGeneration}` },
      data: {
        status: 'PROCESSING',
        lockedAt: new Date(),
        lockToken: 'active-worker-token',
      },
    });
    assert.equal(
      (await claimRecommendationOutboxBatch({
        workerId: 'worker-active',
        batchSize: 10,
        leaseMs: 1_000,
      })).some((row) => row.deduplication_key === `generation:${activeGeneration}`),
      false,
    );
  });

  test('successful processing marks the event processed', async () => {
    const generationKey = `outbox-generation-${Date.now()}-processed`;
    await enqueueGeneration(generationKey, 'outbox-correlation-processed');
    const worker = new RecommendationOutboxWorker({ batchSize: 10, maxAttempts: 3 });
    assert.equal(await worker.processOnce(), 2);
    const rows = await prisma.recommendationEventOutbox.findMany({
      where: { deduplicationKey: { in: [`generation:${generationKey}`] } },
      select: { status: true, processedAt: true },
    });
    assert.equal(rows[0]?.status, 'PROCESSED');
    assert.ok(rows[0]?.processedAt);
  });

  test('retry increments attempts and uses bounded backoff before dead lettering', async () => {
    const generation = generationFor(`missing-generation-${Date.now()}`);
    const result = await enqueueRecommendationExposure({
      generation,
      cacheState: 'HIT',
      correlationId: 'outbox-correlation-retry',
      includeGeneration: false,
      items: [
        {
          entityType: 'MATERIAL',
          entityId: 'outbox-material-1',
          sectionKey: 'suggested_materials',
          position: 1,
          score: 3,
          reasons: ['Matches your interests'],
        },
      ],
    });
    const worker = new RecommendationOutboxWorker({ batchSize: 10, maxAttempts: 2 });
    assert.equal(await worker.processOnce(), 1);
    const retry = await prisma.recommendationEventOutbox.findUniqueOrThrow({
      where: { deduplicationKey: `exposure:${result.exposureId}` },
      select: { status: true, attemptCount: true, availableAt: true, lastErrorCode: true },
    });
    assert.equal(retry.status, 'RETRY');
    assert.equal(retry.attemptCount, 1);
    assert.equal(retry.lastErrorCode, 'generation_pending');
    assert.ok(retry.availableAt.getTime() > Date.now());

    await prisma.recommendationEventOutbox.update({
      where: { deduplicationKey: `exposure:${result.exposureId}` },
      data: { availableAt: new Date(0) },
    });
    assert.equal(await worker.processOnce(), 1);
    const dead = await prisma.recommendationEventOutbox.findUniqueOrThrow({
      where: { deduplicationKey: `exposure:${result.exposureId}` },
      select: { status: true, attemptCount: true },
    });
    assert.equal(dead.status, 'DEAD');
    assert.equal(dead.attemptCount, 2);
  });

  test('unsupported schema and invalid payloads do not materialize', async () => {
    const unsupportedKey = `outbox-unsupported-${Date.now()}`;
    const invalidKey = `outbox-invalid-${Date.now()}`;
    await createRawOutboxRow({
      eventKind: RecommendationOutboxEventKind.RECOMMENDATION_GENERATION,
      schemaVersion: 'unsupported-v99',
      deduplicationKey: unsupportedKey,
      payload: { learnerId },
    });
    await createRawOutboxRow({
      eventKind: RecommendationOutboxEventKind.RECOMMENDATION_GENERATION,
      schemaVersion: 'recommendation-generation-outbox-v1',
      deduplicationKey: invalidKey,
      payload: { learnerId, schemaVersion: 'recommendation-generation-outbox-v1', candidateTraces: [] },
    });
    const worker = new RecommendationOutboxWorker({ batchSize: 10, maxAttempts: 3 });
    assert.equal(await worker.processOnce(), 2);
    const rows = await prisma.recommendationEventOutbox.findMany({
      where: { deduplicationKey: { in: [unsupportedKey, invalidKey] } },
      select: { status: true, lastErrorCode: true },
      orderBy: { deduplicationKey: 'asc' },
    });
    assert.deepEqual(rows.map((row) => row.status), ['DEAD', 'DEAD']);
    assert.equal(await prisma.recommendationGeneration.count({ where: { generationKey: invalidKey } }), 0);
  });

  test('one bad event does not stop the worker loop and materialization remains bulk-shaped', async () => {
    const generationKey = `outbox-generation-${Date.now()}-bad-neighbor`;
    const badKey = `outbox-bad-neighbor-${Date.now()}`;
    const result = await enqueueGeneration(generationKey, 'outbox-correlation-bad-neighbor');
    await createRawOutboxRow({
      eventKind: RecommendationOutboxEventKind.RECOMMENDATION_EXPOSURE,
      schemaVersion: 'unsupported-v99',
      deduplicationKey: badKey,
      payload: { learnerId },
    });
    const worker = new RecommendationOutboxWorker({ batchSize: 10, maxAttempts: 3 });
    assert.equal(await worker.processOnce(), 3);
    assert.equal(
      await prisma.recommendationEventOutbox.count({ where: { deduplicationKey: badKey, status: 'DEAD' } }),
      1,
    );
    assert.equal(await prisma.recommendationGeneration.count({ where: { generationKey } }), 1);
    assert.equal(
      await prisma.recommendationRequest.count({ where: { id: result.exposureId } }),
      1,
    );
    assert.equal(
      await prisma.recommendationCandidateTrace.count({ where: { generationId: generationKey } }),
      1,
    );
    assert.equal(
      await prisma.recommendationImpression.count({ where: { requestId: result.exposureId } }),
      1,
    );
  });

  test('graceful shutdown prevents new claims and disabled defaults do not poll', async () => {
    const worker = new RecommendationOutboxWorker({ pollIntervalMs: 5, batchSize: 1 });
    worker.start();
    await worker.stop();

    const generationKey = `outbox-generation-${Date.now()}-stopped`;
    await enqueueGeneration(generationKey, 'outbox-correlation-stopped');
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(
      await prisma.recommendationEventOutbox.count({
        where: { deduplicationKey: `generation:${generationKey}`, status: 'PENDING' },
      }),
      1,
    );
    assert.equal(env.recommendationOutboxWorkerEnabled, false);
    assert.deepEqual(recommendationOutboxWorkerDefaults, {
      pollIntervalMs: 2_000,
      batchSize: 10,
      maxAttempts: 5,
      leaseMs: 30_000,
    });
  });

  test('stale processing leases are recoverable', async () => {
    const generationKey = `outbox-generation-${Date.now()}-stale`;
    await enqueueGeneration(generationKey, 'outbox-correlation-stale');
    await prisma.recommendationEventOutbox.updateMany({
      where: { deduplicationKey: `generation:${generationKey}` },
      data: {
        status: 'PROCESSING',
        lockedAt: new Date(Date.now() - 10_000),
        lockToken: 'stale-worker-token',
      },
    });

    assert.equal(await recoverStaleRecommendationOutbox(1_000), 1);
    const row = await prisma.recommendationEventOutbox.findUniqueOrThrow({
      where: { deduplicationKey: `generation:${generationKey}` },
      select: { status: true, lockToken: true },
    });
    assert.equal(row.status, 'RETRY');
    assert.equal(row.lockToken, null);
  });
});
