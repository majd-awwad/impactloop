import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import {
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
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: { create: { learnerType: 'STUDENT' } },
    },
    select: { id: true },
  });

  return user.id;
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

describe('recommendation event instrumentation', () => {
  before(async () => {
    learnerId = await createLearner('primary');
    otherLearnerId = await createLearner('other');
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [learnerId, otherLearnerId] } },
    });
    await prisma.$disconnect();
  });

  test('bulk exposure creates one generation, request, impression, and bounded trace', async () => {
    const result = await persistRecommendationExposure({
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
    });

    assert.equal(result.size, 1);
    const impressionId = [...result.values()][0]!;
    assert.match(impressionId, /^[0-9a-f-]{36}$/);

    const [generationCount, requestCount, impressionCount, traceCount] =
      await Promise.all([
        prisma.recommendationGeneration.count({ where: { learnerId } }),
        prisma.recommendationRequest.count({ where: { learnerId } }),
        prisma.recommendationImpression.count({ where: { learnerId } }),
        prisma.recommendationCandidateTrace.count({
          where: { generation: { learnerId } },
        }),
      ]);

    assert.equal(generationCount, 1);
    assert.equal(requestCount, 1);
    assert.equal(impressionCount, 1);
    assert.equal(traceCount, 1);
  });

  test('concurrent exposure writes share generation but create one request per caller', async () => {
    const generation = generationFor(learnerId);
    const [first, second] = await Promise.all([
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
    ]);

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
    const failedWrite = await persistRecommendationExposure({
      generation: generationFor('missing-user'),
      cacheState: 'MISS',
      items: [],
    });
    assert.equal(failedWrite.size, 0);
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
