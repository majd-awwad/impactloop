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
      assert.equal(
        await prisma.recommendationEventOutbox.count({
          where: { deduplicationKey: { contains: 'enqueue-failure' } },
        }),
        0,
      );
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
    const worker = new RecommendationOutboxWorker({
      enabled: true,
      pollIntervalMs: 5,
      batchSize: 1,
    });
    worker.start();
    const stopResult = await worker.stop();
    assert.equal(stopResult.outcome, 'completed');
    worker.markStopped();

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

describe('RP-04.1 recommendation outbox runtime config', () => {
  test('production defaults required=true when flag unset', async () => {
    const { resolveRecommendationOutboxRuntimeConfig } = await import(
      '../../config/env.js'
    );
    const resolved = resolveRecommendationOutboxRuntimeConfig({
      NODE_ENV: 'production',
    });
    assert.equal(resolved.required, true);
    assert.equal(resolved.enabled, false);
  });

  test('non-production defaults required=false when flag unset', async () => {
    const { resolveRecommendationOutboxRuntimeConfig } = await import(
      '../../config/env.js'
    );
    const resolved = resolveRecommendationOutboxRuntimeConfig({
      NODE_ENV: 'development',
    });
    assert.equal(resolved.required, false);
  });

  test('REQUIRED=true/false overrides defaults and stays independent of enabled', async () => {
    const { resolveRecommendationOutboxRuntimeConfig } = await import(
      '../../config/env.js'
    );
    assert.equal(
      resolveRecommendationOutboxRuntimeConfig({
        NODE_ENV: 'development',
        RECOMMENDATION_OUTBOX_WORKER_REQUIRED: 'true',
      }).required,
      true,
    );
    assert.equal(
      resolveRecommendationOutboxRuntimeConfig({
        NODE_ENV: 'production',
        RECOMMENDATION_OUTBOX_WORKER_REQUIRED: 'false',
      }).required,
      false,
    );
    const both = resolveRecommendationOutboxRuntimeConfig({
      NODE_ENV: 'production',
      RECOMMENDATION_OUTBOX_WORKER_ENABLED: 'true',
      RECOMMENDATION_OUTBOX_WORKER_REQUIRED: 'false',
    });
    assert.equal(both.enabled, true);
    assert.equal(both.required, false);
  });

  test('poll/batch/attempt/lease defaults and clamps are unchanged', async () => {
    const { resolveRecommendationOutboxRuntimeConfig } = await import(
      '../../config/env.js'
    );
    assert.deepEqual(
      resolveRecommendationOutboxRuntimeConfig({ NODE_ENV: 'test' }),
      {
        enabled: false,
        required: false,
        pollIntervalMs: 2_000,
        batchSize: 10,
        maxAttempts: 5,
        leaseMs: 30_000,
      },
    );
    const clamped = resolveRecommendationOutboxRuntimeConfig({
      NODE_ENV: 'test',
      RECOMMENDATION_OUTBOX_POLL_INTERVAL_MS: '10',
      RECOMMENDATION_OUTBOX_BATCH_SIZE: '999',
      RECOMMENDATION_OUTBOX_MAX_ATTEMPTS: '0',
      RECOMMENDATION_OUTBOX_LEASE_MS: '100',
    });
    assert.equal(clamped.pollIntervalMs, 250);
    assert.equal(clamped.batchSize, 100);
    assert.equal(clamped.maxAttempts, 1);
    assert.equal(clamped.leaseMs, 1_000);
  });
});

describe('RP-04.1 recommendation outbox worker health lifecycle', () => {
  const firePendingSchedule = (pending: (() => void) | null): void => {
    if (!pending) {
      throw new Error('expected a pending poll schedule callback');
    }
    pending();
  };
  test('DISABLED only when enabled=false; required-disabled is not FAILED', () => {
    const disabled = new RecommendationOutboxWorker({
      enabled: false,
      required: true,
    });
    const snapshot = disabled.getHealthSnapshot(Date.now());
    assert.equal(snapshot.state, 'DISABLED');
    assert.equal(snapshot.effectiveState, 'DISABLED');
    assert.equal(snapshot.ready, false);
    assert.ok(snapshot.reasonCodes.includes('WORKER_REQUIRED_BUT_DISABLED'));
    assert.notEqual(snapshot.state, 'FAILED');
  });

  test('enabled start transitions to STARTING then HEALTHY on empty poll', async () => {
    let now = 1_000;
    let processCalls = 0;
    const worker = new RecommendationOutboxWorker({
      enabled: true,
      required: true,
      pollIntervalMs: 1_000,
      queueMetricsRefreshIntervalMs: 60_000,
      deps: {
        now: () => now,
        schedule: (_ms, cb) => {
          const handle = setTimeout(cb, 0);
          return handle;
        },
        clearSchedule: (timer) => clearTimeout(timer),
        processBatch: async () => {
          processCalls += 1;
          return 0;
        },
        refreshQueueMetrics: async () => ({
          retryBacklog: 0,
          retryBacklogCapped: false,
          deadRows: 0,
          deadRowsCapped: false,
        }),
      },
    });

    assert.notEqual(worker.getHealthSnapshot(now).state, 'DISABLED');
    worker.start();
    assert.equal(worker.getHealthSnapshot(now).state, 'STARTING');
    assert.equal(worker.getHealthSnapshot(now).ready, false);

    await new Promise((resolve) => setTimeout(resolve, 20));
    now = 1_500;
    const healthy = worker.getHealthSnapshot(now);
    assert.ok(processCalls >= 1);
    assert.equal(healthy.state, 'HEALTHY');
    assert.equal(healthy.ready, true);

    const stopResult = await worker.stop(1_000);
    assert.equal(stopResult.outcome, 'completed');
    worker.markStopped();
    assert.equal(worker.getHealthSnapshot(now).state, 'STOPPED');
  });

  test('transient failures degrade then fail; later success recovers', async () => {
    let now = 10_000;
    let mode: 'fail' | 'succeed' = 'fail';
    let failCount = 0;
    const worker = new RecommendationOutboxWorker({
      enabled: true,
      pollIntervalMs: 20,
      consecutiveFailureThreshold: 3,
      queueMetricsRefreshIntervalMs: 60_000,
      deps: {
        now: () => now,
        schedule: (_ms, cb) => setTimeout(cb, 5),
        clearSchedule: (timer) => clearTimeout(timer),
        processBatch: async () => {
          if (mode === 'fail') {
            failCount += 1;
            throw new Error('transient');
          }
          return 0;
        },
        refreshQueueMetrics: async () => ({
          retryBacklog: 0,
          retryBacklogCapped: false,
          deadRows: 0,
          deadRowsCapped: false,
        }),
      },
    });

    worker.start();
    for (let i = 0; i < 5 && failCount < 3; i += 1) {
      now += 50;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    now = 10_000 + 15_000;
    await new Promise((resolve) => setTimeout(resolve, 30));
    const failed = worker.getHealthSnapshot(now);
    assert.equal(failed.effectiveState, 'FAILED');
    assert.equal(failed.ready, false);

    mode = 'succeed';
    now += 100;
    await new Promise((resolve) => setTimeout(resolve, 40));
    const recovered = worker.getHealthSnapshot(now);
    assert.ok(
      recovered.state === 'HEALTHY' || recovered.state === 'DEGRADED',
      `expected recovery, got ${recovered.state}`,
    );
    assert.equal(recovered.ready, true);

    await worker.stop(1_000);
    worker.markStopped();
  });

  test('stale detection is pure in getHealthSnapshot without mutating stored state logs', async () => {
    let now = 50_000;
    const worker = new RecommendationOutboxWorker({
      enabled: true,
      pollIntervalMs: 1_000,
      queueMetricsRefreshIntervalMs: 60_000,
      deps: {
        now: () => now,
        schedule: (_ms, cb) => setTimeout(cb, 1),
        clearSchedule: clearTimeout,
        processBatch: async () => 0,
        refreshQueueMetrics: async () => ({
          retryBacklog: 0,
          retryBacklogCapped: false,
          deadRows: 0,
          deadRowsCapped: false,
        }),
      },
    });
    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(worker.getHealthSnapshot(now).state, 'HEALTHY');

    now += 20_000;
    const staleSnap = worker.getHealthSnapshot(now);
    assert.equal(staleSnap.stale, true);
    assert.equal(staleSnap.effectiveState, 'FAILED');
    assert.equal(staleSnap.ready, false);
    assert.equal(staleSnap.state, 'HEALTHY');

    await worker.stop(500);
    worker.markStopped();
  });

  test('metrics refresh is throttled and failure does not increment poll failures', async () => {
    let now = 100_000;
    let refreshCalls = 0;
    let processCalls = 0;
    const worker = new RecommendationOutboxWorker({
      enabled: true,
      pollIntervalMs: 20,
      queueMetricsRefreshIntervalMs: 1_000,
      deps: {
        now: () => now,
        schedule: (_ms, cb) => setTimeout(cb, 5),
        clearSchedule: clearTimeout,
        processBatch: async () => {
          processCalls += 1;
          return 0;
        },
        refreshQueueMetrics: async () => {
          refreshCalls += 1;
          if (refreshCalls === 1) {
            throw new Error('metrics unavailable');
          }
          return {
            retryBacklog: 2,
            retryBacklogCapped: false,
            deadRows: 0,
            deadRowsCapped: false,
          };
        },
      },
    });

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(refreshCalls, 1);
    const afterFail = worker.getHealthSnapshot(now);
    assert.equal(afterFail.queueMetricsStale, true);
    assert.equal(afterFail.consecutiveFailures, 0);

    now += 50;
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.ok(processCalls >= 2);
    assert.equal(refreshCalls, 1, 'refresh must stay throttled within interval');

    now += 2_000;
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.ok(refreshCalls >= 2);

    await worker.stop(500);
    worker.markStopped();
  });

  test('stop timeout reports in-flight without STOPPED; start after stop is no-op', async () => {
    let now = 200_000;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const worker = new RecommendationOutboxWorker({
      enabled: true,
      pollIntervalMs: 1_000,
      queueMetricsRefreshIntervalMs: 60_000,
      deps: {
        now: () => now,
        schedule: (ms, cb) => setTimeout(cb, ms),
        clearSchedule: clearTimeout,
        processBatch: async () => {
          await gate;
          return 0;
        },
        refreshQueueMetrics: async () => ({
          retryBacklog: 0,
          retryBacklogCapped: false,
          deadRows: 0,
          deadRowsCapped: false,
        }),
      },
    });

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const result = await worker.stop(30);
    assert.equal(result.outcome, 'timedOut');
    if (result.outcome === 'timedOut') {
      assert.equal(result.inFlightStillRunning, true);
    }
    assert.equal(worker.getHealthSnapshot(now).state, 'STOPPING');
    assert.notEqual(worker.getHealthSnapshot(now).state, 'STOPPED');

    worker.start();
    assert.equal(worker.getHealthSnapshot(now).state, 'STOPPING');

    release();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  test('failed poll stays DEGRADED after successful metrics refresh; later poll recovers', async () => {
    let now = 300_000;
    let mode: 'ok' | 'fail' = 'ok';
    let refreshCalls = 0;
    let pendingSchedule: (() => void) | null = null;
    const timers: NodeJS.Timeout[] = [];

    const worker = new RecommendationOutboxWorker({
      enabled: true,
      pollIntervalMs: 1_000,
      queueMetricsRefreshIntervalMs: 1,
      consecutiveFailureThreshold: 3,
      deps: {
        now: () => now,
        schedule: (_ms, cb) => {
          pendingSchedule = cb;
          const timer = setTimeout(() => undefined, 60_000);
          timers.push(timer);
          return timer;
        },
        clearSchedule: (timer) => clearTimeout(timer),
        processBatch: async () => {
          if (mode === 'fail') {
            throw new Error('poll boom');
          }
          return 0;
        },
        refreshQueueMetrics: async () => {
          refreshCalls += 1;
          return {
            retryBacklog: 0,
            retryBacklogCapped: false,
            deadRows: 0,
            deadRowsCapped: false,
          };
        },
      },
    });

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(worker.getHealthSnapshot(now).state, 'HEALTHY');
    assert.ok(refreshCalls >= 1);

    mode = 'fail';
    now += 10;
    firePendingSchedule(pendingSchedule);
    pendingSchedule = null;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const afterFail = worker.getHealthSnapshot(now);
    assert.equal(afterFail.state, 'DEGRADED');
    assert.equal(afterFail.consecutiveFailures, 1);
    assert.ok(refreshCalls >= 2);

    mode = 'ok';
    now += 10;
    firePendingSchedule(pendingSchedule);
    pendingSchedule = null;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const recovered = worker.getHealthSnapshot(now);
    assert.equal(recovered.consecutiveFailures, 0);
    assert.equal(recovered.state, 'HEALTHY');
    assert.equal(recovered.ready, true);

    const stopResult = await worker.stop(500);
    assert.equal(stopResult.outcome, 'completed');
    worker.markStopped();
    for (const timer of timers) {
      clearTimeout(timer);
    }
  });

  test('stop does not return completed while failure-triggered metrics refresh is active', async () => {
    let now = 400_000;
    let pollCount = 0;
    let releaseFailMetrics!: () => void;
    const failMetricsGate = new Promise<void>((resolve) => {
      releaseFailMetrics = resolve;
    });
    let failMetricsStarted = false;
    let pendingSchedule: (() => void) | null = null;
    const timers: NodeJS.Timeout[] = [];

    const worker = new RecommendationOutboxWorker({
      enabled: true,
      pollIntervalMs: 1_000,
      queueMetricsRefreshIntervalMs: 1,
      consecutiveFailureThreshold: 5,
      deps: {
        now: () => now,
        schedule: (_ms, cb) => {
          pendingSchedule = cb;
          const timer = setTimeout(() => undefined, 60_000);
          timers.push(timer);
          return timer;
        },
        clearSchedule: (timer) => clearTimeout(timer),
        processBatch: async () => {
          pollCount += 1;
          if (pollCount === 1) {
            return 0;
          }
          throw new Error('poll boom');
        },
        refreshQueueMetrics: async () => {
          if (pollCount <= 1) {
            return {
              retryBacklog: 0,
              retryBacklogCapped: false,
              deadRows: 0,
              deadRowsCapped: false,
            };
          }
          failMetricsStarted = true;
          await failMetricsGate;
          return {
            retryBacklog: 0,
            retryBacklogCapped: false,
            deadRows: 0,
            deadRowsCapped: false,
          };
        },
      },
    });

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(worker.getHealthSnapshot(now).state, 'HEALTHY');

    now += 20;
    firePendingSchedule(pendingSchedule);
    pendingSchedule = null;
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(failMetricsStarted, true);

    const stopPromise = worker.stop(5_000);
    let stopSettled: { outcome: string } | null = null;
    void stopPromise.then((result) => {
      stopSettled = result;
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(
      stopSettled,
      null,
      'stop must not complete while metrics refresh is still active',
    );
    assert.equal(worker.getHealthSnapshot(now).state, 'STOPPING');

    releaseFailMetrics();
    const result = await stopPromise;
    assert.equal(result.outcome, 'completed');
    worker.markStopped();
    assert.equal(worker.getHealthSnapshot(now).state, 'STOPPED');
    for (const timer of timers) {
      clearTimeout(timer);
    }
  });

  test('stop times out when failure-triggered metrics never settle', async () => {
    let now = 500_000;
    let pollCount = 0;
    let failMetricsStarted = false;
    let pendingSchedule: (() => void) | null = null;
    const timers: NodeJS.Timeout[] = [];

    const worker = new RecommendationOutboxWorker({
      enabled: true,
      pollIntervalMs: 1_000,
      queueMetricsRefreshIntervalMs: 1,
      consecutiveFailureThreshold: 5,
      deps: {
        now: () => now,
        schedule: (_ms, cb) => {
          pendingSchedule = cb;
          const timer = setTimeout(() => undefined, 60_000);
          timers.push(timer);
          return timer;
        },
        clearSchedule: (timer) => clearTimeout(timer),
        processBatch: async () => {
          pollCount += 1;
          if (pollCount === 1) {
            return 0;
          }
          throw new Error('poll boom');
        },
        refreshQueueMetrics: async () => {
          if (pollCount <= 1) {
            return {
              retryBacklog: 0,
              retryBacklogCapped: false,
              deadRows: 0,
              deadRowsCapped: false,
            };
          }
          failMetricsStarted = true;
          await new Promise(() => undefined);
          return {
            retryBacklog: 0,
            retryBacklogCapped: false,
            deadRows: 0,
            deadRowsCapped: false,
          };
        },
      },
    });

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(worker.getHealthSnapshot(now).state, 'HEALTHY');

    now += 20;
    firePendingSchedule(pendingSchedule);
    pendingSchedule = null;
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(failMetricsStarted, true);

    const result = await worker.stop(40);
    assert.equal(result.outcome, 'timedOut');
    if (result.outcome === 'timedOut') {
      assert.equal(result.inFlightStillRunning, true);
    }
    assert.equal(worker.getHealthSnapshot(now).state, 'STOPPING');
    assert.notEqual(worker.getHealthSnapshot(now).state, 'STOPPED');
    for (const timer of timers) {
      clearTimeout(timer);
    }
  });
});
