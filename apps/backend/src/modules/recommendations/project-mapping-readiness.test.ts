import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { prisma } from '../../database/prisma.js';
import { env } from '../../config/env.js';
import { loadMlShadowConcepts, loadProjectPool } from '../learner-home/learner-home.repository.js';
import { loadPortableModelArtifact } from './ml-model-artifact.js';
import {
  clearMlArtifactCacheForTests,
  runMlShadowComparison,
  setMlShadowInterestRegistryLoaderForTests,
} from './ml-shadow.service.js';
import {
  countArtifactMappedCandidates,
  projectItemFeatureNames,
  selectRequiredComponentConceptKeys,
} from './project-runtime-candidate-mapping.js';
import { isolatedRecommendationTest } from './recommendation-test-isolation.js';

const root = process.cwd().endsWith(path.join('apps', 'backend'))
  ? path.resolve(process.cwd(), '../..')
  : process.cwd();
const portableRoot = path.join(root, 'ml/recommendation/generated/portable-model');
const projectKey = (id: string) => createHash('sha256').update(`impactloop-project:${id}`).digest('hex');
const emptyInterestRegistry = async () => [];

test('required-only component concepts match catalog export eligibility', () => {
  const keys = selectRequiredComponentConceptKeys([
    {
      isRequired: true,
      taxonomyConcepts: [{ concept: { canonicalKey: 'component:fabric-scraps' } }],
    },
    {
      isRequired: false,
      taxonomyConcepts: [{ concept: { canonicalKey: 'component:denim-offcuts' } }],
    },
  ]);
  assert.deepEqual(keys, ['component:fabric-scraps']);
});

test('realistic artifact/runtime keys map exactly for catalog snapshot projects', async () => {
  const catalog = JSON.parse(
    await readFile(path.join(root, 'ml/recommendation/generated/catalog-snapshot/projects.json'), 'utf8'),
  ) as { rows: Array<{ category_key: string; difficulty: string; concept_keys: string[]; component_concept_keys: string[] }> };
  const artifact = await loadPortableModelArtifact(path.join(portableRoot, 'project-hybrid-runtime-v2.json'), 'project');
  const artifactNames = new Set(artifact.item_features.map((feature) => feature.name));
  for (const row of catalog.rows) {
    const featureNames = [
      `category:${row.category_key}`,
      ...row.concept_keys.map((value) => `concept:${value}`),
      `difficulty:${row.difficulty}`,
      ...row.component_concept_keys.map((value) => `component:${value}`),
    ];
    assert.ok(featureNames.every((name) => artifactNames.has(name)), `missing catalog feature mapping for ${row.difficulty}`);
  }
});

test('optional component concepts never enter required runtime mapping', () => {
  const names = projectItemFeatureNames({
    categoryId: 'category-a',
    difficulty: 'BEGINNER',
    conceptKeys: ['concept:textiles'],
    componentConceptKeys: selectRequiredComponentConceptKeys([
      { isRequired: false, taxonomyConcepts: [{ concept: { canonicalKey: 'component:denim-offcuts' } }] },
      { isRequired: true, taxonomyConcepts: [{ concept: { canonicalKey: 'component:fabric-scraps' } }] },
    ]),
  });
  assert.ok(names.includes('component:component:fabric-scraps'));
  assert.ok(!names.includes('component:component:denim-offcuts'));
});

isolatedRecommendationTest('missing eligible runtime mappings preserve NOT_READY', async () => {
  const prior = {
    shadow: env.recommendationMlShadowEnabled,
    path: env.recommendationMlProjectArtifactPath,
  };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid-runtime-v2.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  clearMlArtifactCacheForTests();
  try {
    const response = { unchanged: true };
    const result = await runMlShadowComparison({
      response,
      domain: 'project',
      interests: [],
      candidates: [{
        candidateKey: 'project-missing-feature',
        categoryId: 'unknown-category',
        categoryLabel: 'Unknown',
        difficulty: 'BEGINNER',
        componentConceptKeys: ['component:denim-offcuts'],
      }],
      activeCandidateKeys: ['project-missing-feature'],
      currentTopKeys: ['project-missing-feature'],
      recentEvents: [],
      evaluationTimestamp: '2026-07-19T00:00:00Z',
    });
    assert.strictEqual(result.response, response);
    assert.equal(result.diagnostics.projectReadinessStatus, 'NOT_READY');
    assert.equal(result.diagnostics.runtimeCandidatesMissingFromArtifact, 1);
    assert.equal(result.diagnostics.recentFusionDurationMs, 0);
  } finally {
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlProjectArtifactPath = prior.path;
    clearMlArtifactCacheForTests();
  }
});

isolatedRecommendationTest('duplicate runtime keys preserve NOT_READY', async () => {
  const prior = {
    shadow: env.recommendationMlShadowEnabled,
    path: env.recommendationMlProjectArtifactPath,
  };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  clearMlArtifactCacheForTests();
  try {
    const duplicate = { candidateKey: 'project-dup', categoryId: 'fixture-category', categoryLabel: 'Fixture', difficulty: 'BEGINNER' };
    const result = await runMlShadowComparison({
      response: { unchanged: true },
      domain: 'project',
      interests: [],
      candidates: [duplicate, duplicate],
      activeCandidateKeys: ['project-dup'],
      currentTopKeys: ['project-dup'],
      recentEvents: [],
      evaluationTimestamp: '2026-07-19T00:00:00Z',
    });
    assert.equal(result.diagnostics.projectReadinessStatus, 'NOT_READY');
    assert.equal(result.diagnostics.duplicateRuntimeCandidateCount, 1);
  } finally {
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlProjectArtifactPath = prior.path;
    clearMlArtifactCacheForTests();
  }
});

test('non-finite scores preserve NOT_READY', () => {
  const counts = countArtifactMappedCandidates([], new Set());
  assert.equal(counts.artifactMappedCandidateCount, 0);
});

test('live PostgreSQL runtime projects map completely to runtime-v2 artifact', async () => {
  const projects = await loadProjectPool(120);
  const concepts = await loadMlShadowConcepts([], projects.map((project) => project.id));
  const artifact = await loadPortableModelArtifact(path.join(portableRoot, 'project-hybrid-runtime-v2.json'), 'project');
  const artifactNames = new Set(artifact.item_features.map((feature) => feature.name));
  const candidates = projects.map((project) => ({
    categoryId: project.category.id,
    difficulty: project.difficulty,
    conceptKeys: concepts.projectConcepts.get(project.id) ?? [],
    componentConceptKeys: concepts.projectComponentConcepts.get(project.id) ?? [],
  }));
  const counts = countArtifactMappedCandidates(candidates, artifactNames);
  assert.equal(projects.length, 29);
  assert.equal(counts.missingArtifactCandidateCount, 0);
  assert.equal(counts.artifactMappedCandidateCount, 29);
});

isolatedRecommendationTest('READY executes recent intent and fusion and exposes fused ranking when serving is enabled', async () => {
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
    const candidates = projects.slice(0, 8).map((project) => ({
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
    assert.strictEqual(profileOnly.response, response);
    assert.equal(profileOnly.diagnostics.projectReadinessStatus, 'NOT_READY');
    assert.equal(profileOnly.diagnostics.featureReadiness?.status, 'NOT_READY');
    assert.ok(
      profileOnly.diagnostics.featureReadiness?.reasons.includes(
        'ARTIFACT_CONTRACT_VERSION_MISSING',
      ),
    );
    assert.equal(profileOnly.diagnostics.recentConfidence, 'NONE');
    assert.equal(profileOnly.diagnostics.recentSlotsUsedTop5, 0);
    assert.equal(profileOnly.rankedCandidateKeys, undefined);
    assert.equal(
      profileOnly.diagnostics.servingSuppressedReason,
      'CANONICAL_USER_FEATURES_SHADOW_ONLY',
    );

    const coherent = await runMlShadowComparison({
      response,
      domain: 'project',
      interests: [],
      candidates,
      activeCandidateKeys: candidates.map((value) => value.candidateKey),
      currentTopKeys: candidates.map((value) => value.candidateKey),
      recentEvents: [
        { entityKey: candidates[0]!.candidateKey, actionType: 'project_save', timestampUtc: '2026-07-19T10:00:00Z' },
        { entityKey: candidates[1]!.candidateKey, actionType: 'like', timestampUtc: '2026-07-19T10:05:00Z' },
        { entityKey: candidates[0]!.candidateKey, actionType: 'like', timestampUtc: '2026-07-19T10:10:00Z' },
        { entityKey: candidates[1]!.candidateKey, actionType: 'project_save', timestampUtc: '2026-07-19T10:15:00Z' },
      ],
      evaluationTimestamp: '2026-07-19T12:00:00Z',
    });
    // Mapping integrity healthy → recent/fusion still run; feature readiness stays NOT_READY.
    assert.equal(coherent.diagnostics.projectReadinessStatus, 'NOT_READY');
    assert.equal(coherent.diagnostics.featureReadiness?.status, 'NOT_READY');
    assert.equal(coherent.diagnostics.featureReadiness?.coverageStatus, 'NOT_READY');
    assert.ok(['MEDIUM', 'HIGH'].includes(String(coherent.diagnostics.recentConfidence)));
    assert.ok((coherent.diagnostics.recentFusionDurationMs ?? 0) > 0);
    assert.equal(coherent.rankedCandidateKeys, undefined);
    assert.strictEqual(coherent.response, response);
  } finally {
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlProjectServingEnabled = prior.projectServing;
    env.recommendationMlProjectArtifactPath = prior.projectPath;
    clearMlArtifactCacheForTests();
    await prisma.$disconnect();
  }
});

test('catalog projects outside learner-home runtime universe are not hydrated by shadow', async () => {
  const catalog = JSON.parse(
    await readFile(path.join(root, 'ml/recommendation/generated/catalog-snapshot/projects.json'), 'utf8'),
  ) as { rows: Array<{ project_key: string }> };
  const projects = await loadProjectPool(120);
  const runtimeKeys = new Set(projects.map((project) => projectKey(project.id)));
  const outside = catalog.rows.filter((row) => !runtimeKeys.has(row.project_key));
  assert.equal(outside.length, 0);
});
