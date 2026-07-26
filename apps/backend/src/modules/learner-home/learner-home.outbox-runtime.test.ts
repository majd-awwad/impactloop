import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { runWithRecommendationEventOrigin } from '../recommendation-events/recommendation-event-origin.js';
import { runWithRequestContext } from '../../observability/request-context.js';
import {
  getLearnerHome,
  invalidateLearnerHomeCache,
} from './learner-home.service.js';

const TEST_PREFIX = `learner-home-outbox-${Date.now()}`;
let testLearnerId: string | undefined;

const hasImpressionIdentifier = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some(hasImpressionIdentifier);
  }
  if (!value || typeof value !== 'object') {
    return false;
  }
  return Object.entries(value).some(
    ([key, nested]) =>
      key === 'recommendationImpressionId' || hasImpressionIdentifier(nested),
  );
};

after(async () => {
  const rows = await prisma.recommendationEventOutbox.findMany({
    select: { id: true, payload: true },
  });
  const ownRows = rows.filter((row) => {
    const payload = row.payload as { correlationId?: unknown; learnerId?: unknown };
    return (
      (typeof payload.correlationId === 'string' &&
        payload.correlationId.startsWith(TEST_PREFIX)) ||
      (testLearnerId !== undefined && payload.learnerId === testLearnerId)
    );
  });
  await prisma.recommendationEventOutbox.deleteMany({
    where: { id: { in: ownRows.map((row) => row.id) } },
  });
  await prisma.$disconnect();
});

test('Learner Home enqueues bounded outbox exposures without synchronous domain writes', async () => {
  const learner = await prisma.user.findFirst({
    where: { roles: { some: { role: 'LEARNER' } } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  assert.ok(learner);
  testLearnerId = learner.id;

  const domainBefore = {
    generations: await prisma.recommendationGeneration.count({ where: { learnerId: learner.id } }),
    impressions: await prisma.recommendationImpression.count({ where: { learnerId: learner.id } }),
  };

  invalidateLearnerHomeCache(learner.id);
  const miss = await runWithRecommendationEventOrigin('TEST', () =>
    runWithRequestContext(
      {
        requestId: `${TEST_PREFIX}-miss`,
        startedAt: Date.now(),
        method: 'GET',
        path: '/api/learner/home',
        userId: learner.id,
        activeRole: 'LEARNER',
      },
      () => getLearnerHome(learner.id),
    ),
  );
  const hit = await runWithRecommendationEventOrigin('TEST', () =>
    runWithRequestContext(
      {
        requestId: `${TEST_PREFIX}-hit`,
        startedAt: Date.now(),
        method: 'GET',
        path: '/api/learner/home',
        userId: learner.id,
        activeRole: 'LEARNER',
      },
      () => getLearnerHome(learner.id),
    ),
  );
  const cachedResponse = await runWithRecommendationEventOrigin('TEST', () =>
    getLearnerHome(learner.id),
  );

  assert.deepEqual(Object.keys(miss), ['profileCompletion', 'sections']);
  assert.equal(hasImpressionIdentifier(miss), true);
  assert.equal(hasImpressionIdentifier(hit), true);
  assert.equal(hasImpressionIdentifier(cachedResponse), false);

  const ownRows = await prisma.recommendationEventOutbox.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 60_000) } },
    select: { eventKind: true, payload: true },
  });
  const exposures = ownRows.filter((row) => {
    const payload = row.payload as { correlationId?: unknown };
    return (
      row.eventKind === 'RECOMMENDATION_EXPOSURE' &&
      typeof payload.correlationId === 'string' &&
      payload.correlationId.startsWith(TEST_PREFIX)
    );
  });
  const generations = ownRows.filter((row) => {
    const payload = row.payload as { learnerId?: unknown };
    return row.eventKind === 'RECOMMENDATION_GENERATION' && payload.learnerId === learner.id;
  });
  assert.equal(exposures.length, 2);
  assert.equal(generations.length, 1);
  for (const row of [...exposures, ...generations]) {
    assert.equal((row.payload as { eventSource?: string }).eventSource, 'TEST');
  }
  assert.equal(await prisma.recommendationGeneration.count({ where: { learnerId: learner.id } }), domainBefore.generations);
  assert.equal(await prisma.recommendationImpression.count({ where: { learnerId: learner.id } }), domainBefore.impressions);

  const payloads = exposures.map((row) => row.payload as { impressions?: Array<{ impressionId: string }> });
  assert.notEqual(payloads[0]?.impressions?.[0]?.impressionId, payloads[1]?.impressions?.[0]?.impressionId);
});
