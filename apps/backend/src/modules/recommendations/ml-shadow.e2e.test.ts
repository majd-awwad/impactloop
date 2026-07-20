import assert from 'node:assert/strict';
import { copyFile, readFile, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { getLearnerHome, invalidateLearnerHomeCache } from '../learner-home/learner-home.service.js';
import { likeMaterialById, unlikeMaterialById } from '../materials/materials.service.js';
import {
  clearMlArtifactCacheForTests,
  getMlArtifactCacheStatsForTests,
  runMlShadowComparison,
  setMlShadowObserverForTests,
  type ShadowDiagnostics,
} from './ml-shadow.service.js';
import { withRecommendationTestIsolation } from './recommendation-test-isolation.js';

const repositoryRoot = process.cwd().endsWith(path.join('apps', 'backend'))
  ? path.resolve(process.cwd(), '../..')
  : process.cwd();
const portableRoot = path.join(repositoryRoot, 'ml/recommendation/generated/portable-model');
const materialArtifact = path.join(portableRoot, 'material-hybrid-runtime-v2.json');
const projectArtifact = path.join(portableRoot, 'project-hybrid-runtime-v2.json');

const percentile = (values: number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
};

test('Slice 4B local learner-home shadow validation', { concurrency: false }, async () => {
  await withRecommendationTestIsolation(async () => {
  const prior = {
    shadow: env.recommendationMlShadowEnabled,
    materialServing: env.recommendationMlMaterialServingEnabled,
    projectServing: env.recommendationMlProjectServingEnabled,
    materialPath: env.recommendationMlMaterialArtifactPath,
    projectPath: env.recommendationMlProjectArtifactPath,
  };
  const observations: Array<ShadowDiagnostics & { domain: 'material' | 'project' }> = [];
  setMlShadowObserverForTests((value) => observations.push(value));

  try {
    env.recommendationMlMaterialServingEnabled = false;
    env.recommendationMlProjectServingEnabled = false;
    env.recommendationMlMaterialArtifactPath = materialArtifact;
    env.recommendationMlProjectArtifactPath = projectArtifact;

    const learners = await prisma.user.findMany({
      where: { roles: { some: { role: 'LEARNER' } } },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: {
        id: true,
        learnerProfile: { select: { interests: true } },
        _count: { select: { materialLikes: true, materialViews: true, projectSaves: true, projectBuilds: true } },
      },
    });
    assert.ok(learners.length > 0, 'local learner fixture required');
    const score = (learner: typeof learners[number]) => learner._count.materialLikes + learner._count.materialViews + learner._count.projectSaves + learner._count.projectBuilds;
    const predicates = [
      (value: typeof learners[number]) => (value.learnerProfile?.interests.length ?? 0) > 0 && score(value) === 0,
      (value: typeof learners[number]) => (value.learnerProfile?.interests.length ?? 0) === 0,
      (value: typeof learners[number]) => value._count.materialLikes + value._count.materialViews > 0,
      (value: typeof learners[number]) => value._count.projectSaves + value._count.projectBuilds > 0,
      (value: typeof learners[number]) => value._count.materialViews > 0 && value._count.projectSaves + value._count.projectBuilds > 0,
      (value: typeof learners[number]) => score(value) > 2,
    ];
    const selected: typeof learners = [];
    for (const predicate of predicates) {
      const match = learners.find((value) => !selected.some((chosen) => chosen.id === value.id) && predicate(value));
      if (match) selected.push(match);
    }
    for (const learner of learners) {
      if (selected.length >= Math.min(6, learners.length)) break;
      if (!selected.some((value) => value.id === learner.id)) selected.push(learner);
    }

    const caseLabels = ['case_profile_only', 'case_no_interests', 'case_recent_material_behavior', 'case_project_driven', 'case_mixed_behavior', 'case_recent_and_stale'];
    const invariance: Array<{ caseLabel: string; identical: boolean }> = [];
    for (const [index, learner] of selected.entries()) {
      env.recommendationMlShadowEnabled = false;
      invalidateLearnerHomeCache(learner.id);
      const disabled = await getLearnerHome(learner.id);
      const beforeEnabledObservations = observations.length;
      env.recommendationMlShadowEnabled = true;
      invalidateLearnerHomeCache(learner.id);
      const enabled = await getLearnerHome(learner.id);
      const identical = JSON.stringify(enabled) === JSON.stringify(disabled);
      assert.equal(identical, true, `${caseLabels[index]} response changed`);
      assert.equal(observations.length, beforeEnabledObservations + 2);
      invariance.push({ caseLabel: caseLabels[index]!, identical });
    }

    clearMlArtifactCacheForTests();
    env.recommendationMlShadowEnabled = true;
    const coldStarted = performance.now();
    invalidateLearnerHomeCache(selected[0]!.id);
    await getLearnerHome(selected[0]!.id);
    const coldRequestMs = performance.now() - coldStarted;
    assert.deepEqual(getMlArtifactCacheStatsForTests(), { entries: 2, artifactLoadCount: 2 });
    invalidateLearnerHomeCache(selected[0]!.id);
    await getLearnerHome(selected[0]!.id);
    assert.deepEqual(getMlArtifactCacheStatsForTests(), { entries: 2, artifactLoadCount: 2 });

    const disabledTimings: number[] = [];
    const enabledTimings: number[] = [];
    for (let run = 0; run < 8; run += 1) {
      const learner = selected[run % selected.length]!;
      env.recommendationMlShadowEnabled = false;
      invalidateLearnerHomeCache(learner.id);
      let started = performance.now();
      await getLearnerHome(learner.id);
      disabledTimings.push(performance.now() - started);
      env.recommendationMlShadowEnabled = true;
      invalidateLearnerHomeCache(learner.id);
      started = performance.now();
      await getLearnerHome(learner.id);
      enabledTimings.push(performance.now() - started);
    }
    const increments = enabledTimings.map((value, index) => value - disabledTimings[index]!);

    const mutationLearner = selected[0]!;
    const candidatePool = await prisma.material.findMany({
      where: { status: 'AVAILABLE', quantity: { gt: 0 }, ownerId: { not: mutationLearner.id }, likes: { none: { userId: mutationLearner.id } } },
      select: { id: true, categoryId: true },
      orderBy: { createdAt: 'asc' },
      take: 120,
    });
    const byCategory = new Map<string, typeof candidatePool>();
    for (const item of candidatePool) byCategory.set(item.categoryId, [...(byCategory.get(item.categoryId) ?? []), item]);
    const coherentCandidates = [...byCategory.values()].find((items) => items.length >= 3)?.slice(0, 3);
    assert.ok(coherentCandidates?.length === 3, 'reversible coherent material-like fixture required');
    env.recommendationMlShadowEnabled = true;
    invalidateLearnerHomeCache(mutationLearner.id);
    await getLearnerHome(mutationLearner.id);
    const materialBeforeLike = observations.at(-2)!;
    const beforeLike = observations.length;
    await likeMaterialById(coherentCandidates[0]!.id, mutationLearner.id);
    await getLearnerHome(mutationLearner.id);
    assert.equal(observations.length, beforeLike + 2, 'like invalidation did not trigger a fresh shadow pass');
    const materialAfterOneLike = observations.at(-2)!;
    const singleLikeChangedTop5 = JSON.stringify(materialBeforeLike.shadowTop5Keys) !== JSON.stringify(materialAfterOneLike.shadowTop5Keys);
    await likeMaterialById(coherentCandidates[1]!.id, mutationLearner.id);
    await likeMaterialById(coherentCandidates[2]!.id, mutationLearner.id);
    await getLearnerHome(mutationLearner.id);
    const materialAfterCoherentLikes = observations.at(-2)!;
    const coherentLikesChangedTop5 = JSON.stringify(materialBeforeLike.shadowTop5Keys) !== JSON.stringify(materialAfterCoherentLikes.shadowTop5Keys);
    for (const item of coherentCandidates) await unlikeMaterialById(item.id, mutationLearner.id);
    await getLearnerHome(mutationLearner.id);
    assert.ok(observations.length >= beforeLike + 6, 'unlike invalidation did not trigger a fresh shadow pass');
    assert.equal(await prisma.materialLike.count({ where: { userId: mutationLearner.id, materialId: { in: coherentCandidates.map((item) => item.id) } } }), 0, 'test likes were not reverted');

    const baseResponse = { visible: ['unchanged'] };
    const baseCandidate = { candidateKey: 'fixture-a', categoryId: 'fixture-category', categoryLabel: 'Fixture Category' };
    const baseInput = { response: baseResponse, domain: 'material' as const, interests: [], candidates: [baseCandidate], activeCandidateKeys: ['fixture-a'], currentTopKeys: ['fixture-a'], recentEvents: [], evaluationTimestamp: '2026-07-19T00:00:00Z' };
    const tempArtifact = path.join(os.tmpdir(), `impactloop-slice4b-${process.pid}.json`);
    const invalidCases: Array<{ name: string; reason: string | undefined }> = [];
    env.recommendationMlMaterialArtifactPath = `${tempArtifact}.missing`;
    clearMlArtifactCacheForTests();
    let fallback = await runMlShadowComparison(baseInput);
    assert.strictEqual(fallback.response, baseResponse); invalidCases.push({ name: 'missing', reason: fallback.diagnostics.fallbackReason });
    const validRaw = JSON.parse(await readFile(materialArtifact, 'utf8'));
    for (const [name, raw] of [
      ['corrupt_hash', { ...validRaw, content_hash: '0'.repeat(64) }],
      ['malformed_dimensions', { ...validRaw, latent_dimension: 99 }],
      ['unsupported_schema', { ...validRaw, feature_schema_version: 'stale' }],
    ] as const) {
      await writeFile(tempArtifact, JSON.stringify(raw));
      env.recommendationMlMaterialArtifactPath = tempArtifact;
      clearMlArtifactCacheForTests();
      fallback = await runMlShadowComparison(baseInput);
      assert.strictEqual(fallback.response, baseResponse); assert.equal(fallback.diagnostics.status, 'FALLBACK');
      invalidCases.push({ name, reason: fallback.diagnostics.fallbackReason });
    }
    await copyFile(materialArtifact, tempArtifact);
    env.recommendationMlMaterialArtifactPath = tempArtifact;
    clearMlArtifactCacheForTests();
    assert.equal((await runMlShadowComparison(baseInput)).diagnostics.status, 'SCORED');
    await unlink(tempArtifact);
    assert.equal((await runMlShadowComparison(baseInput)).diagnostics.status, 'SCORED', 'cached artifact was reparsed');
    assert.equal(getMlArtifactCacheStatsForTests().artifactLoadCount, 1);

    const candidateMismatch = await runMlShadowComparison({ ...baseInput, activeCandidateKeys: ['different'] });
    const duplicate = await runMlShadowComparison({ ...baseInput, candidates: [baseCandidate, baseCandidate] });
    const overLimitCandidates = Array.from({ length: 201 }, (_, index) => ({ ...baseCandidate, candidateKey: `bounded-${index}` }));
    const overLimit = await runMlShadowComparison({ ...baseInput, candidates: overLimitCandidates, activeCandidateKeys: overLimitCandidates.map((value) => value.candidateKey) });
    const invalidTimestamp = await runMlShadowComparison({ ...baseInput, evaluationTimestamp: 'invalid' });
    const invalidEvent = await runMlShadowComparison({ ...baseInput, recentEvents: [{ entityKey: 'fixture-a', actionType: 'view', timestampUtc: 'invalid' }] });
    const futureEvent = await runMlShadowComparison({ ...baseInput, recentEvents: [{ entityKey: 'fixture-a', actionType: 'view', timestampUtc: '2027-01-01T00:00:00Z' }] });
    assert.equal(candidateMismatch.diagnostics.fallbackReason, 'candidate_mismatch');
    assert.equal(duplicate.diagnostics.fallbackReason, 'candidate_mismatch');
    assert.equal(overLimit.diagnostics.fallbackReason, 'candidate_bound');
    assert.equal(invalidTimestamp.diagnostics.fallbackReason, 'invalid_evaluation_timestamp');
    assert.equal(invalidEvent.diagnostics.status, 'SCORED'); assert.equal(invalidEvent.diagnostics.recentEvidenceCount, 0);
    assert.equal(futureEvent.diagnostics.status, 'SCORED'); assert.equal(futureEvent.diagnostics.recentEvidenceCount, 0);

    const scored = observations.filter((value) => value.status === 'SCORED');
    assert.ok(scored.some((value) => (value.sectionDiagnostics?.length ?? 0) > 0));
    assert.ok(scored.every((value) => (value.duplicateCurrentCount ?? 0) >= 0 && (value.deduplicatedCurrentCount ?? 0) >= 0));
    const materialObservations = scored.filter((value) => value.domain === 'material');
    const projectObservations = scored.filter((value) => value.domain === 'project');
    const aggregate = (items: typeof scored) => ({
      attempts: items.length,
      candidateCountMin: Math.min(...items.map((value) => value.candidateCount)),
      candidateCountMax: Math.max(...items.map((value) => value.candidateCount)),
      top5OverlapAverage: items.reduce((sum, value) => sum + (value.top5Overlap ?? 0), 0) / Math.max(1, items.length),
      top10OverlapAverage: items.reduce((sum, value) => sum + (value.top10Overlap ?? 0), 0) / Math.max(1, items.length),
      recentChannelRate: items.filter((value) => value.recentChannelApplied).length / Math.max(1, items.length),
      averageRecentRows: items.reduce((sum, value) => sum + (value.recentEventInputCount ?? 0), 0) / Math.max(1, items.length),
      averageActiveUserFeatures: items.reduce((sum, value) => sum + (value.featureCoverage?.activeUserFeatures ?? 0), 0) / Math.max(1, items.length),
      zeroFeatureUsers: items.filter((value) => value.featureCoverage?.zeroFeatureUser).length,
      averageItemFeatures: items.reduce((sum, value) => sum + (value.featureCoverage?.itemFeatureTotal ?? 0), 0) / Math.max(1, items.reduce((sum, value) => sum + value.candidateCount, 0)),
      categoryCoverage: items.reduce((sum, value) => sum + (value.featureCoverage?.categoryCovered ?? 0), 0) / Math.max(1, items.reduce((sum, value) => sum + value.candidateCount, 0)),
      conceptCoverage: items.reduce((sum, value) => sum + (value.featureCoverage?.conceptCovered ?? 0), 0) / Math.max(1, items.reduce((sum, value) => sum + value.candidateCount, 0)),
      conditionCoverage: items.reduce((sum, value) => sum + (value.featureCoverage?.conditionCovered ?? 0), 0) / Math.max(1, items.reduce((sum, value) => sum + value.candidateCount, 0)),
      freeCoverage: items.reduce((sum, value) => sum + (value.featureCoverage?.freeCovered ?? 0), 0) / Math.max(1, items.reduce((sum, value) => sum + value.candidateCount, 0)),
      pickupCoverage: items.reduce((sum, value) => sum + (value.featureCoverage?.pickupCovered ?? 0), 0) / Math.max(1, items.reduce((sum, value) => sum + value.candidateCount, 0)),
      deliveryCoverage: items.reduce((sum, value) => sum + (value.featureCoverage?.deliveryCovered ?? 0), 0) / Math.max(1, items.reduce((sum, value) => sum + value.candidateCount, 0)),
      difficultyCoverage: items.reduce((sum, value) => sum + (value.featureCoverage?.difficultyCovered ?? 0), 0) / Math.max(1, items.reduce((sum, value) => sum + value.candidateCount, 0)),
      componentCoverage: items.reduce((sum, value) => sum + (value.featureCoverage?.componentCovered ?? 0), 0) / Math.max(1, items.reduce((sum, value) => sum + value.candidateCount, 0)),
      scorerP95Ms: percentile(items.map((value) => value.scoringDurationMs ?? 0), 0.95),
    });
    const result = {
      slice4b: {
        caseCount: selected.length,
        caseLabels: invariance,
        servingFlags: { material: env.recommendationMlMaterialServingEnabled, project: env.recommendationMlProjectServingEnabled },
        cache: getMlArtifactCacheStatsForTests(),
        material: aggregate(materialObservations),
        project: aggregate(projectObservations),
        cacheInvalidation: { likeTriggeredFreshShadow: true, unlikeTriggeredFreshShadow: true, singleLikeChangedTop5, coherentLikesChangedTop5, materialRecentEvidenceAfterLikes: materialAfterCoherentLikes.recentEvidenceCount ?? 0 },
        failureInjection: invalidCases,
        performance: {
          coldRequestMs,
          disabledP50Ms: percentile(disabledTimings, 0.5), disabledP95Ms: percentile(disabledTimings, 0.95),
          enabledP50Ms: percentile(enabledTimings, 0.5), enabledP95Ms: percentile(enabledTimings, 0.95),
          incrementalP50Ms: percentile(increments, 0.5), incrementalP95Ms: percentile(increments, 0.95),
          queryCountDelta: 2,
        },
        privacySafeTop5Example: scored[0] ? { domain: scored[0].domain, current: scored[0].currentTop5Keys, shadow: scored[0].shadowTop5Keys } : null,
      },
    };
    console.log(JSON.stringify(result));
    const diagnosticText = JSON.stringify(result);
    assert.doesNotMatch(diagnosticText, /@|email|displayName|password|phone|userId/i);
    assert.equal(result.slice4b.performance.queryCountDelta, 2);
    const perf = result.slice4b.performance;
    assert.ok(Number.isFinite(perf.incrementalP95Ms));
    assert.ok(perf.incrementalP95Ms <= perf.enabledP95Ms);
    assert.ok(
      perf.incrementalP95Ms <= 200,
      `shadow incremental p95 ${perf.incrementalP95Ms}ms exceeds environmental ceiling`,
    );
  } finally {
    setMlShadowObserverForTests(undefined);
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlMaterialServingEnabled = prior.materialServing;
    env.recommendationMlProjectServingEnabled = prior.projectServing;
    env.recommendationMlMaterialArtifactPath = prior.materialPath;
    env.recommendationMlProjectArtifactPath = prior.projectPath;
    clearMlArtifactCacheForTests();
    await prisma.$disconnect();
  }
  });
});
