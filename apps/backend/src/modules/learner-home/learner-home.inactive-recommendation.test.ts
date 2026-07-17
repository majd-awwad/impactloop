import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { runWithRequestContext } from '../../observability/request-context.js';
import {
  getLearnerHome,
  getLearnerHomeSection,
  invalidateLearnerHomeCache,
} from './learner-home.service.js';

const countRecommendationRows = async (learnerId: string) =>
  Promise.all([
    prisma.recommendationGeneration.count({ where: { learnerId } }),
    prisma.recommendationRequest.count({ where: { learnerId } }),
    prisma.recommendationCandidateTrace.count({
      where: { generation: { learnerId } },
    }),
    prisma.recommendationImpression.count({ where: { learnerId } }),
    prisma.recommendationAction.count({ where: { learnerId } }),
  ]);

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
  await prisma.$disconnect();
});

test('inactive recommendation runtime preserves Learner Home shape and writes no event rows', async () => {
  const learner = await prisma.user.findFirst({
    where: { roles: { some: { role: 'LEARNER' } } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  assert.ok(learner);

  invalidateLearnerHomeCache(learner.id);
  const before = await countRecommendationRows(learner.id);
  const miss = await runWithRequestContext(
    {
      requestId: 'inactive-recommendation-miss',
      startedAt: Date.now(),
      method: 'GET',
      path: '/api/learner/home',
      userId: learner.id,
      activeRole: 'LEARNER',
    },
    () => getLearnerHome(learner.id),
  );
  const hit = await runWithRequestContext(
    {
      requestId: 'inactive-recommendation-hit',
      startedAt: Date.now(),
      method: 'GET',
      path: '/api/learner/home',
      userId: learner.id,
      activeRole: 'LEARNER',
    },
    () => getLearnerHome(learner.id),
  );
  const section = await runWithRequestContext(
    {
      requestId: 'inactive-recommendation-section',
      startedAt: Date.now(),
      method: 'GET',
      path: '/api/learner/home/sections/suggested_materials',
      userId: learner.id,
      activeRole: 'LEARNER',
    },
    () => getLearnerHomeSection(learner.id, 'suggested_materials', 4),
  );
  const after = await countRecommendationRows(learner.id);

  assert.deepEqual(after, before);
  assert.deepEqual(hit, miss);
  assert.deepEqual(Object.keys(miss), ['profileCompletion', 'sections']);
  assert.equal(hasImpressionIdentifier(miss), false);
  assert.equal(hasImpressionIdentifier(section), false);
});
