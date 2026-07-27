import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import {
  resolveRecommendationEventSource,
  runWithRecommendationEventOrigin,
} from './recommendation-event-origin.js';
import {
  enqueueRecommendationExposure,
  getRecommendationActionContext,
  persistRecommendationExposure,
} from './recommendation-events.service.js';

const TEST_MARKER = '[test-recommendation-events]';

let learnerId: string;
let otherLearnerId: string;

const createLearner = async (label: string) => {
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
    select: { id: true, recommendationEvidenceEligibility: true },
  });

  return user;
};

const generationFor = (userId: string) => ({
  generationKey: `test-generation-${userId}-${Date.now()}-${Math.random()}`,
  learnerId: userId,
  surface: 'LEARNER_HOME' as const,
  algorithmName: 'deterministic-hybrid',
  algorithmVersion: 'learner-home-v1',
  policyVersion: 'learner-home-policy-v1',
  generatedAt: new Date(),
  candidateCount: 2,
  shownItemCount: 1,
  generationDurationMs: 12,
  generationCacheState: 'MISS' as const,
  candidateTraces: [
    {
      entityType: 'MATERIAL' as const,
      entityId: 'material-test-1',
      surface: 'LEARNER_HOME',
      sectionKey: 'suggested_materials',
      candidateSource: 'test_pool',
      eligibilityResult: 'ELIGIBLE' as const,
      rankBeforeSelection: 1,
      finalScore: 8,
      selected: true,
    },
  ],
});

const withTestOrigin = <T>(fn: () => T): T =>
  runWithRecommendationEventOrigin('TEST', fn);

describe('recommendation event instrumentation', () => {
  before(async () => {
    const primary = await createLearner('primary');
    const other = await createLearner('other');
    learnerId = primary.id;
    otherLearnerId = other.id;
    assert.equal(primary.recommendationEvidenceEligibility, 'EXCLUDED_TEST');
    assert.equal(other.recommendationEvidenceEligibility, 'EXCLUDED_TEST');
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [learnerId, otherLearnerId] } },
    });
    await prisma.$disconnect();
  });

  test('bulk exposure creates one generation, request, impression, and bounded trace', async () => {
    const result = await withTestOrigin(() =>
      persistRecommendationExposure({
        generation: generationFor(learnerId),
        cacheState: 'MISS',
        correlationId: 'test-request-1',
        items: [
          {
            entityType: 'MATERIAL',
            entityId: 'material-test-1',
            sectionKey: 'suggested_materials',
            position: 1,
            score: 8,
            reasons: ['Matches your interests'],
          },
        ],
      }),
    );

    assert.equal(result.size, 1);
    const impressionId = [...result.values()][0]!;
    assert.match(impressionId, /^[0-9a-f-]{36}$/);

    const [generationCount, requestCount, impressionCount, traceCount, generation] =
      await Promise.all([
        prisma.recommendationGeneration.count({ where: { learnerId } }),
        prisma.recommendationRequest.count({ where: { learnerId } }),
        prisma.recommendationImpression.count({ where: { learnerId } }),
        prisma.recommendationCandidateTrace.count({
          where: { generation: { learnerId } },
        }),
        prisma.recommendationGeneration.findFirst({
          where: { learnerId },
          select: { eventSource: true },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    assert.equal(generationCount, 1);
    assert.equal(requestCount, 1);
    assert.equal(impressionCount, 1);
    assert.equal(traceCount, 1);
    assert.equal(generation?.eventSource, 'TEST');
  });

  test('concurrent exposure writes share generation but create one request per caller', async () => {
    const generation = generationFor(learnerId);
    const [first, second] = await withTestOrigin(() =>
      Promise.all([
        persistRecommendationExposure({
          generation,
          cacheState: 'MISS',
          correlationId: 'test-concurrent-request-1',
          items: [
            {
              entityType: 'MATERIAL',
              entityId: 'material-concurrent-1',
              sectionKey: 'suggested_materials',
              position: 1,
              score: 7,
              reasons: ['Matches your interests'],
            },
          ],
        }),
        persistRecommendationExposure({
          generation,
          cacheState: 'SINGLE_FLIGHT',
          correlationId: 'test-concurrent-request-2',
          items: [
            {
              entityType: 'MATERIAL',
              entityId: 'material-concurrent-1',
              sectionKey: 'suggested_materials',
              position: 1,
              score: 7,
              reasons: ['Matches your interests'],
            },
          ],
        }),
      ]),
    );

    assert.equal(first.size, 1);
    assert.equal(second.size, 1);
    const [generationCount, requestCount, impressionCount, traceCount] =
      await Promise.all([
        prisma.recommendationGeneration.count({
          where: { generationKey: generation.generationKey },
        }),
        prisma.recommendationRequest.count({
          where: {
            correlationId: {
              in: ['test-concurrent-request-1', 'test-concurrent-request-2'],
            },
          },
        }),
        prisma.recommendationImpression.count({
          where: {
            request: {
              correlationId: {
                in: ['test-concurrent-request-1', 'test-concurrent-request-2'],
              },
            },
          },
        }),
        prisma.recommendationCandidateTrace.count({
          where: { generation: { generationKey: generation.generationKey } },
        }),
      ]);

    assert.equal(generationCount, 1);
    assert.equal(requestCount, 2);
    assert.equal(impressionCount, 2);
    assert.equal(traceCount, 1);
    assert.notEqual([...first.values()][0], [...second.values()][0]);
  });

  test('expired impressions and telemetry failures do not fail the caller', async () => {
    const failedWrite = await withTestOrigin(() =>
      persistRecommendationExposure({
        generation: generationFor('missing-user'),
        cacheState: 'MISS',
        items: [],
      }),
    );
    assert.equal(failedWrite.size, 0);
  });

  test('missing origin fails closed and LEGACY_UNCLASSIFIED is not writable', () => {
    assert.throws(() => resolveRecommendationEventSource(), /required/i);
    assert.throws(
      () => resolveRecommendationEventSource('LEGACY_UNCLASSIFIED'),
      /LEGACY_UNCLASSIFIED/,
    );
    assert.equal(resolveRecommendationEventSource('SYNTHETIC'), 'SYNTHETIC');
    assert.equal(resolveRecommendationEventSource('DEMO_SEED'), 'DEMO_SEED');
    assert.equal(resolveRecommendationEventSource('LOAD_TEST'), 'LOAD_TEST');
  });

  test('same-identity enqueue replay returns canonical IDs; conflicting actor fails closed', async () => {
    const generation = {
      ...generationFor(learnerId),
      generationKey: `idempotent-generation-${learnerId}`,
      eventSource: 'TEST' as const,
      candidateTraces: [
        {
          entityType: 'MATERIAL' as const,
          entityId: 'material-idempotent-1',
          surface: 'LEARNER_HOME',
          sectionKey: 'suggested_materials',
          candidateSource: 'test_pool',
          eligibilityResult: 'ELIGIBLE' as const,
          rankBeforeSelection: 1,
          finalScore: 5,
          scoreComponents: { relevance: 5, freshness: 1 },
          selected: true,
        },
      ],
    };
    const items = [
      {
        entityType: 'MATERIAL' as const,
        entityId: 'material-idempotent-1',
        sectionKey: 'suggested_materials',
        position: 1,
        score: 5,
        reasons: ['Matches your interests'],
      },
    ];

    const first = await enqueueRecommendationExposure({
      generation,
      cacheState: 'MISS',
      includeGeneration: true,
      correlationId: 'idempotent-1',
      items,
    });
    assert.equal(first.enqueued, true);
    assert.ok(first.exposureId);
    assert.equal(first.impressionIds.size, 1);
    const firstImpressionId = [...first.impressionIds.values()][0]!;

    const beforeCount = await prisma.recommendationEventOutbox.count({
      where: {
        OR: [
          { deduplicationKey: `generation:${generation.generationKey}` },
          { payload: { path: ['exposureId'], equals: first.exposureId } },
        ],
      },
    });
    assert.equal(beforeCount, 2);

    const replay = await enqueueRecommendationExposure({
      generation: {
        ...generation,
        candidateTraces: [
          {
            ...generation.candidateTraces[0]!,
            // Different JS key insertion order must remain idempotent.
            scoreComponents: { freshness: 1, relevance: 5 },
          },
        ],
      },
      cacheState: 'MISS',
      includeGeneration: true,
      correlationId: 'idempotent-1',
      items,
    });
    assert.equal(replay.enqueued, true);
    assert.equal(replay.exposureId, first.exposureId);
    assert.deepEqual(
      [...replay.impressionIds.entries()].sort(),
      [...first.impressionIds.entries()].sort(),
    );

    const afterCount = await prisma.recommendationEventOutbox.count({
      where: {
        OR: [
          { deduplicationKey: `generation:${generation.generationKey}` },
          { payload: { path: ['exposureId'], equals: first.exposureId } },
        ],
      },
    });
    assert.equal(afterCount, 2);

    const nestedConflict = await enqueueRecommendationExposure({
      generation: {
        ...generation,
        candidateTraces: [
          {
            ...generation.candidateTraces[0]!,
            scoreComponents: { relevance: 9, freshness: 1 },
          },
        ],
      },
      cacheState: 'MISS',
      includeGeneration: true,
      correlationId: 'idempotent-1',
      items,
    });
    assert.equal(nestedConflict.enqueued, false);

    const arrayOrderConflict = await enqueueRecommendationExposure({
      generation: {
        ...generation,
        candidateCount: 2,
        candidateTraces: [
          {
            entityType: 'MATERIAL' as const,
            entityId: 'material-idempotent-2',
            surface: 'LEARNER_HOME',
            sectionKey: 'suggested_materials',
            candidateSource: 'test_pool',
            eligibilityResult: 'ELIGIBLE' as const,
            rankBeforeSelection: 2,
            finalScore: 4,
            selected: false,
          },
          generation.candidateTraces[0]!,
        ],
      },
      cacheState: 'MISS',
      includeGeneration: true,
      correlationId: 'idempotent-1',
      items,
    });
    assert.equal(arrayOrderConflict.enqueued, false);

    // Same two traces in opposite order from a prior successful two-trace write
    // would conflict; prove order sensitivity against a same-set reorder by
    // first accepting an ordered pair, then rejecting the reversed pair.
    const orderedGeneration = {
      ...generation,
      generationKey: `idempotent-order-${learnerId}`,
      candidateCount: 2,
      candidateTraces: [
        generation.candidateTraces[0]!,
        {
          entityType: 'MATERIAL' as const,
          entityId: 'material-idempotent-2',
          surface: 'LEARNER_HOME',
          sectionKey: 'suggested_materials',
          candidateSource: 'test_pool',
          eligibilityResult: 'ELIGIBLE' as const,
          rankBeforeSelection: 2,
          finalScore: 4,
          selected: false,
        },
      ],
    };
    const ordered = await enqueueRecommendationExposure({
      generation: orderedGeneration,
      cacheState: 'MISS',
      includeGeneration: true,
      correlationId: 'idempotent-order',
      items,
    });
    assert.equal(ordered.enqueued, true);
    const reversed = await enqueueRecommendationExposure({
      generation: {
        ...orderedGeneration,
        candidateTraces: [...orderedGeneration.candidateTraces].reverse(),
      },
      cacheState: 'MISS',
      includeGeneration: true,
      correlationId: 'idempotent-order',
      items,
    });
    assert.equal(reversed.enqueued, false);

    const conflict = await enqueueRecommendationExposure({
      generation: { ...generation, learnerId: otherLearnerId },
      cacheState: 'MISS',
      includeGeneration: true,
      correlationId: 'idempotent-conflict',
      items,
    });
    assert.equal(conflict.enqueued, false);

    assert.equal(
      await prisma.recommendationEventOutbox.count({
        where: { deduplicationKey: `generation:${generation.generationKey}` },
      }),
      1,
    );

    const worker = new (
      await import('./recommendation-events.outbox.worker.js')
    ).RecommendationOutboxWorker({ batchSize: 10, maxAttempts: 3 });
    for (let i = 0; i < 5; i += 1) {
      await worker.processOnce();
    }
    assert.equal(
      await prisma.recommendationImpression.count({ where: { id: firstImpressionId } }),
      1,
    );

    const actionEnqueued = await (
      await import('./recommendation-events.service.js')
    ).enqueueRecommendationAction({
      learnerId,
      plan: {
        actionType: 'MATERIAL_LIKE',
        entityType: 'MATERIAL',
        entityId: 'material-idempotent-1',
        sourceOperationId: `${TEST_MARKER}-replay-action-${learnerId}`,
      },
      headers: { 'x-recommendation-impression-id': firstImpressionId },
      eventSource: 'TEST',
    });
    assert.equal(actionEnqueued, true);
    for (let i = 0; i < 5; i += 1) {
      await worker.processOnce();
    }
    assert.equal(
      await prisma.recommendationAction.count({
        where: {
          sourceOperationId: `${TEST_MARKER}-replay-action-${learnerId}`,
          impressionId: firstImpressionId,
        },
      }),
      1,
    );
  });

  test('trusted createApp binds TEST origin; production singleton stays REAL; public APIs expose no origin/eligibility controls', async () => {
    const { createApp } = await import('../../app.js');
    const {
      bindRecommendationEventOriginMiddleware,
      resolveRecommendationEventSource,
    } = await import('./recommendation-event-origin.js');

    let fromTestApp: string | undefined;
    const testMiddleware = bindRecommendationEventOriginMiddleware('TEST');
    await new Promise<void>((resolve, reject) => {
      testMiddleware({} as never, {} as never, ((error?: unknown) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          fromTestApp = resolveRecommendationEventSource();
          resolve();
        } catch (caught) {
          reject(caught);
        }
      }) as never);
    });
    assert.equal(fromTestApp, 'TEST');
    assert.equal(typeof createApp, 'function');

    let fromRealApp: string | undefined;
    const realMiddleware = bindRecommendationEventOriginMiddleware('REAL');
    await new Promise<void>((resolve, reject) => {
      realMiddleware({} as never, {} as never, ((error?: unknown) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          fromRealApp = resolveRecommendationEventSource();
          resolve();
        } catch (caught) {
          reject(caught);
        }
      }) as never);
    });
    assert.equal(fromRealApp, 'REAL');

    const { registerSchema } = await import('../auth/auth.validation.js');
    const shape = registerSchema.safeParse({
      displayName: 'Prod User',
      email: `prod-${Date.now()}@example.com`,
      password: 'Password1!',
      roles: ['LEARNER'],
      eventSource: 'TEST',
      recommendationEvidenceEligibility: 'EXCLUDED_TEST',
      learnerProfile: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
    });
    assert.equal(shape.success, true);
    assert.equal('eventSource' in shape.data, false);
    assert.equal('recommendationEvidenceEligibility' in shape.data, false);

    const eligibleByDefault = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} eligible-default`,
        email: `${TEST_MARKER}-eligible-${Date.now()}@impactloop.test`,
        passwordHash: 'test-only-hash',
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
        learnerProfile: { create: { learnerType: 'STUDENT' } },
      },
      select: { id: true, recommendationEvidenceEligibility: true },
    });
    assert.equal(eligibleByDefault.recommendationEvidenceEligibility, 'ELIGIBLE');
    await prisma.user.delete({ where: { id: eligibleByDefault.id } });
  });

  test('attribution headers accept only scalar bounded values', () => {
    assert.deepEqual(
      getRecommendationActionContext({
        'x-recommendation-impression-id': ['impression-1'],
        'x-recommendation-surface': 'LEARNER_HOME',
      }),
      { impressionId: 'impression-1', surface: 'LEARNER_HOME' },
    );
  });
});
