import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import {
  loadInProgressBuilds,
  loadLearnerBehaviorContext,
  loadLearnerHomeProjectContext,
  loadProjectCandidates,
  loadSavedProjectsForLearner,
} from './learner-home.repository.js';

const normalizeBuild = (
  build: Awaited<ReturnType<typeof loadInProgressBuilds>>[number],
) => ({
  id: build.id,
  projectId: build.projectId,
  status: build.status,
  startedAt: build.startedAt.toISOString(),
  completedAt: build.completedAt?.toISOString() ?? null,
  updatedAt: build.updatedAt.toISOString(),
  project: {
    id: build.project.id,
    title: build.project.title,
    shortDescription: build.project.shortDescription,
    coverImageUrl: build.project.coverImageUrl,
  },
  items: build.items.map((item) => ({
    id: item.id,
    requiredComponentId: item.requiredComponentId,
    status: item.status,
    linkedReservation: item.linkedReservation
      ? { status: item.linkedReservation.status }
      : null,
    requiredComponent: {
      id: item.requiredComponent.id,
      componentName: item.requiredComponent.componentName,
      materialType: item.requiredComponent.materialType,
      quantity: item.requiredComponent.quantity.toString(),
      unit: item.requiredComponent.unit,
    },
  })),
});

describe('learner-home project-read consolidation', () => {
  test('matches the existing project loaders for the seeded learner', async (t) => {
    const user = await prisma.user.findFirst({
      where: { email: 'majd@learner.com' },
      select: { id: true },
    });

    if (!user) {
      t.skip('seeded learner majd@learner.com is unavailable');
      return;
    }

    const [consolidated, behavior, candidates, saved, builds] =
      await Promise.all([
        loadLearnerHomeProjectContext(user.id, 4),
        loadLearnerBehaviorContext(user.id),
        loadProjectCandidates(user.id),
        loadSavedProjectsForLearner(user.id, 4),
        loadInProgressBuilds(user.id, 3),
      ]);

    assert.deepEqual(consolidated.behavior, behavior);
    assert.deepEqual(consolidated.projects, candidates);
    assert.deepEqual(consolidated.savedProjects, saved);
    assert.deepEqual(
      consolidated.inProgressBuilds.slice(0, 3).map(normalizeBuild),
      builds.map(normalizeBuild),
    );
    assert.equal(consolidated.hasSavedProjects, saved.length > 0);
  });
});
