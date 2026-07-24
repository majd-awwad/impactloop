import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { env } from '../../config/env.js';
import { loadMlShadowConcepts, loadProjectPool } from '../learner-home/learner-home.repository.js';
import { selectSuggestedProjectItems } from '../learner-home/learner-home.section-builders.js';
import type { LearnerHomeProjectItem } from '../learner-home/learner-home.types.js';
import {
  clearMlArtifactCacheForTests,
  runMlShadowComparison,
  setMlShadowInterestRegistryLoaderForTests,
} from './ml-shadow.service.js';
import { isolatedRecommendationTest } from './recommendation-test-isolation.js';
import { buildServedSuggestedProjectsItems } from './project-runtime-candidate-mapping.js';

const root = process.cwd().endsWith(path.join('apps', 'backend'))
  ? path.resolve(process.cwd(), '../..')
  : process.cwd();
const portableRoot = path.join(root, 'ml/recommendation/generated/portable-model');
const emptyInterestRegistry = async () => [];

const projectItem = (id: string, saved = false): LearnerHomeProjectItem => ({
  type: 'project',
  score: 10,
  reasons: ['Fixture'],
  project: { id, title: `Project ${id}`, shortDescription: '', category: { id: 'cat', nameEn: 'Cat', nameAr: 'Cat' }, difficulty: 'BEGINNER', estimatedDurationMinutes: 30, coverImageUrl: null, authorName: '', tags: [], ratingSummary: null, likesCount: 0, isLiked: false, isSaved: saved, followersCount: 0, isFollowing: false, createdAt: '2026-01-01T00:00:00.000Z' },
});

test('buildServedSuggestedProjectsItems prefers unsaved projects and preserves fused order', () => {
  const items = buildServedSuggestedProjectsItems({
    rankedCandidateKeys: ['saved-b', 'unsaved-a', 'unsaved-c', 'saved-d'],
    savedProjectIds: new Set(['saved-b', 'saved-d']),
    limit: 3,
    buildProjectItem: (projectId) => projectItem(projectId, projectId.startsWith('saved-')),
  });
  assert.deepEqual(items.map((item) => item.project.id), ['unsaved-a', 'unsaved-c', 'saved-b']);
});

test('buildServedSuggestedProjectsItems fails closed on duplicate fused keys', () => {
  assert.throws(() => buildServedSuggestedProjectsItems({
    rankedCandidateKeys: ['project-a', 'project-a'],
    savedProjectIds: new Set(),
    limit: 2,
    buildProjectItem: (projectId) => projectItem(projectId),
  }), /duplicate_served_project_candidate/);
});

test('buildServedSuggestedProjectsItems fails closed on hydration mismatch', () => {
  assert.throws(() => buildServedSuggestedProjectsItems({
    rankedCandidateKeys: ['missing-project'],
    savedProjectIds: new Set(),
    limit: 1,
    buildProjectItem: () => undefined,
  }), /project_hydration_failure/);
});

isolatedRecommendationTest('READY NONE and LOW serve long-term order with zero recent slots', async () => {
  const prior = {
    shadow: env.recommendationMlShadowEnabled,
    projectServing: env.recommendationMlProjectServingEnabled,
    projectPath: env.recommendationMlProjectArtifactPath,
  };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlProjectServingEnabled = true;
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid-runtime-v2.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  clearMlArtifactCacheForTests();
  try {
    const projects = await loadProjectPool(120);
    const concepts = await loadMlShadowConcepts([], projects.map((project) => project.id));
    const candidates = projects.slice(0, 6).map((project) => ({
      candidateKey: project.id,
      categoryId: project.category.id,
      categoryLabel: project.category.nameEn,
      difficulty: project.difficulty,
      conceptKeys: concepts.projectConcepts.get(project.id) ?? [],
      componentConceptKeys: concepts.projectComponentConcepts.get(project.id) ?? [],
    }));
    const response = { sections: [{ key: 'suggested_projects', items: candidates.map((value) => value.candidateKey) }] };
    const profileOnly = await runMlShadowComparison({
      response,
      domain: 'project',
      interests: [],
      candidates,
      activeCandidateKeys: candidates.map((value) => value.candidateKey),
      currentTopKeys: candidates.map((value) => value.candidateKey),
      recentEvents: [],
      evaluationTimestamp: '2026-07-19T12:00:00Z',
    });
    assert.equal(profileOnly.diagnostics.projectReadinessStatus, 'READY');
    assert.equal(profileOnly.diagnostics.recentConfidence, 'NONE');
    assert.equal(profileOnly.diagnostics.recentSlotsUsedTop5, 0);
    assert.equal(profileOnly.rankedCandidateKeys, undefined);
    assert.equal(
      profileOnly.diagnostics.servingSuppressedReason,
      'CANONICAL_USER_FEATURES_SHADOW_ONLY',
    );

    const scattered = await runMlShadowComparison({
      response,
      domain: 'project',
      interests: [],
      candidates,
      activeCandidateKeys: candidates.map((value) => value.candidateKey),
      currentTopKeys: candidates.map((value) => value.candidateKey),
      recentEvents: candidates.flatMap((value, index) => [
        { entityKey: value.candidateKey, actionType: 'view', timestampUtc: `2026-07-19T0${index}:00:00Z` },
      ]),
      evaluationTimestamp: '2026-07-19T12:00:00Z',
    });
    assert.ok(['NONE', 'LOW'].includes(String(scattered.diagnostics.recentConfidence)));
    assert.equal(scattered.diagnostics.recentSlotsUsedTop5, 0);
    assert.equal(scattered.rankedCandidateKeys, undefined);
  } finally {
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlProjectServingEnabled = prior.projectServing;
    env.recommendationMlProjectArtifactPath = prior.projectPath;
    clearMlArtifactCacheForTests();
  }
});

isolatedRecommendationTest('READY MEDIUM and HIGH respect frozen recent slot caps in served ranking', async () => {
  const prior = {
    shadow: env.recommendationMlShadowEnabled,
    projectServing: env.recommendationMlProjectServingEnabled,
    projectPath: env.recommendationMlProjectArtifactPath,
  };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlProjectServingEnabled = true;
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid-runtime-v2.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  clearMlArtifactCacheForTests();
  try {
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      candidateKey: `shadow-project-${index}`,
      categoryId: `category-${index % 2}`,
      categoryLabel: `Category ${index % 2}`,
      difficulty: 'BEGINNER',
      conceptKeys: index < 4 ? ['robotics-core'] : ['textiles-core'],
      componentConceptKeys: [`component-${index % 3}`],
    }));
    const response = { sections: [{ key: 'suggested_projects', items: candidates.map((value) => value.candidateKey) }] };
    const coherentEvents = [
      { entityKey: 'shadow-project-0', actionType: 'project_save', timestampUtc: '2026-07-19T10:00:00Z' },
      { entityKey: 'shadow-project-1', actionType: 'like', timestampUtc: '2026-07-19T10:05:00Z' },
      { entityKey: 'shadow-project-0', actionType: 'like', timestampUtc: '2026-07-19T10:10:00Z' },
      { entityKey: 'shadow-project-1', actionType: 'project_save', timestampUtc: '2026-07-19T10:15:00Z' },
    ];
    const coherent = await runMlShadowComparison({
      response,
      domain: 'project',
      interests: [],
      candidates,
      activeCandidateKeys: candidates.map((value) => value.candidateKey),
      currentTopKeys: candidates.map((value) => value.candidateKey),
      recentEvents: coherentEvents,
      evaluationTimestamp: '2026-07-19T12:00:00Z',
    });
    if (coherent.diagnostics.projectReadinessStatus === 'READY') {
      assert.ok(['MEDIUM', 'HIGH'].includes(String(coherent.diagnostics.recentConfidence)));
      assert.ok((coherent.diagnostics.recentSlotsUsedTop5 ?? 0) <= 2);
      assert.ok((coherent.diagnostics.recentSlotsUsedTop10 ?? 0) <= 3);
    } else {
      assert.equal(coherent.rankedCandidateKeys, undefined);
    }
  } finally {
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlProjectServingEnabled = prior.projectServing;
    env.recommendationMlProjectArtifactPath = prior.projectPath;
    clearMlArtifactCacheForTests();
  }
});

test('selectSuggestedProjectItems contract remains unchanged for served builder output', () => {
  const unsaved = [projectItem('u1'), projectItem('u2')];
  const saved = [projectItem('s1', true)];
  assert.deepEqual(selectSuggestedProjectItems(unsaved, saved, 2).map((item) => item.project.id), ['u1', 'u2']);
  assert.deepEqual(selectSuggestedProjectItems([projectItem('u1')], saved, 2).map((item) => item.project.id), ['u1', 's1']);
});
