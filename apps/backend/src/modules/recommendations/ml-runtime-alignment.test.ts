import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import test from 'node:test';

import { prisma } from '../../database/prisma.js';
import { env } from '../../config/env.js';
import { getLearnerHome, invalidateLearnerHomeCache } from '../learner-home/learner-home.service.js';
import { getMaterialById } from '../materials/materials.service.js';
import { combineNormalizedScores, normalizeScores, scorePortableLightFm, type WeightedFeature } from './ml-lightfm-scorer.js';
import { loadPortableModelArtifact } from './ml-model-artifact.js';
import { buildShortTermIntent, recentItemScore, SHORT_TERM_CONFIG } from './short-term-intent.js';
import { clearMlArtifactCacheForTests, setMlShadowObserverForTests } from './ml-shadow.service.js';

const root = process.cwd().endsWith(path.join('apps', 'backend')) ? path.resolve(process.cwd(), '../..') : process.cwd();
const categoryKey = (id: string) => createHash('sha256').update(`impactloop-category:${id}`).digest('hex');
const diagnosticKey = (id: string) => createHash('sha256').update(`impactloop-slice4c:${id}`).digest('hex').slice(0, 16);
const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

test('runtime-v2 fixed-weight live-catalog decomposition and project component effect', async () => {
  const artifact = await loadPortableModelArtifact(path.join(root, 'ml/recommendation/generated/portable-model/material-hybrid-runtime-v2.json'), 'material');
  assert.equal(artifact.feature_schema_version, 'runtime-approved-features-v2');
  assert.ok(artifact.user_features.every((feature) => feature.name.startsWith('interest:')));

  const [learners, rows, projects] = await Promise.all([
    prisma.user.findMany({ where: { roles: { some: { role: 'LEARNER' } }, learnerProfile: { isNot: null } }, select: { learnerProfile: { select: { interests: true } } }, take: 30 }),
    prisma.material.findMany({ where: { status: 'AVAILABLE', quantity: { gt: 0 }, category: { isActive: true }, taxonomyConcepts: { some: { concept: { status: 'ACTIVE' } } } }, orderBy: { createdAt: 'asc' }, take: 200, select: { id: true, categoryId: true, category: { select: { nameEn: true } }, condition: true, isFree: true, pickupAllowed: true, deliveryAllowed: true, taxonomyConcepts: { where: { concept: { status: 'ACTIVE' } }, select: { concept: { select: { canonicalKey: true } } } } } }),
    prisma.learningProject.findMany({ where: { status: 'PUBLISHED', requiredComponents: { some: { taxonomyConcepts: { some: { concept: { status: 'ACTIVE' } } } } } }, take: 29, select: { id: true, categoryId: true, taxonomyConcepts: { where: { concept: { status: 'ACTIVE' } }, select: { concept: { select: { canonicalKey: true } } } }, requiredComponents: { select: { taxonomyConcepts: { where: { concept: { status: 'ACTIVE' } }, select: { concept: { select: { canonicalKey: true } } } } } } } }),
  ]);
  assert.ok(rows.length > 10);
  const labels = new Map(rows.map((row) => [normalize(row.category.nameEn), row.categoryId]));
  const learner = learners.find((value) => value.learnerProfile?.interests.some((interest) => labels.has(normalize(interest))));
  assert.ok(learner?.learnerProfile);
  const domainA = labels.get(normalize(learner.learnerProfile.interests.find((interest) => labels.has(normalize(interest)))!))!;
  const userFeatures: WeightedFeature[] = [[`interest:${categoryKey(domainA)}`, 1]];
  const candidates = rows.map((row) => ({ candidateKey: row.id, categoryId: row.categoryId, conceptKeys: row.taxonomyConcepts.map((entry) => entry.concept.canonicalKey).sort(), features: [[`category:${categoryKey(row.categoryId)}`, 1], ...row.taxonomyConcepts.map((entry) => [`concept:${entry.concept.canonicalKey}`, 1] as WeightedFeature), [`condition:${row.condition}`, 1], [`free:${Number(row.isFree)}`, 1], [`pickup:${Number(row.pickupAllowed)}`, 1], [`delivery:${Number(row.deliveryAllowed)}`, 1]] as WeightedFeature[] }));
  const longTerm = scorePortableLightFm(artifact, userFeatures, candidates);
  const byCategory = new Map<string, typeof candidates>();
  for (const candidate of candidates) byCategory.set(candidate.categoryId, [...(byCategory.get(candidate.categoryId) ?? []), candidate]);
  const top5Categories = longTerm.scored.slice(0, 5).map((value) => candidates.find((candidate) => candidate.candidateKey === value.candidateKey)!.categoryId);
  const target = [...byCategory.entries()].filter(([key, values]) => key !== domainA && values.length >= 8).sort((left, right) => top5Categories.filter((key) => key === left[0]).length - top5Categories.filter((key) => key === right[0]).length || left[0].localeCompare(right[0]))[0];
  assert.ok(target); const [domainB, targetCandidates] = target;
  const initialB = top5Categories.filter((key) => key === domainB).length;
  assert.ok(initialB <= 1, 'target domain already dominant');
  const metadata = new Map(candidates.map((candidate) => [candidate.candidateKey, { categoryKey: categoryKey(candidate.categoryId), conceptKeys: candidate.conceptKeys, componentConceptKeys: [] as string[] }]));
  const now = '2026-07-19T12:00:00Z';
  const t1Events = targetCandidates.slice(0, 3).map((candidate, index) => ({ entityKey: candidate.candidateKey, actionType: 'view', timestampUtc: `2026-07-19T0${index + 1}:00:00Z` }));
  const t2Events = [...targetCandidates.slice(0, 8).map((candidate, index) => ({ entityKey: candidate.candidateKey, actionType: 'view', timestampUtc: `2026-07-19T${String(index + 1).padStart(2, '0')}:30:00Z` })), ...targetCandidates.slice(0, 2).map((candidate, index) => ({ entityKey: candidate.candidateKey, actionType: 'like', timestampUtc: `2026-07-19T${String(index + 9).padStart(2, '0')}:00:00Z` }))];
  const rank = (events: typeof t2Events, blend: number = SHORT_TERM_CONFIG.recentBlend) => { const recent = buildShortTermIntent(events, metadata, now); const recentScores = new Map(candidates.map((candidate) => [candidate.candidateKey, recentItemScore(metadata.get(candidate.candidateKey)!, recent.intent)])); return { recent, recentScores, combined: combineNormalizedScores(longTerm.scored, recentScores, blend) }; };
  const t1 = rank(t1Events); const t2 = rank(t2Events);
  const categoryCount = (ranking: typeof t2.combined, category: string) => ranking.slice(0, 5).filter((value) => candidates.find((candidate) => candidate.candidateKey === value.candidateKey)!.categoryId === category).length;
  const t1B = categoryCount(t1.combined, domainB); const t2B = categoryCount(t2.combined, domainB); const t2A = categoryCount(t2.combined, domainA);
  const normalizedLong = normalizeScores(longTerm.scored);
  const decomposition = targetCandidates.slice(0, 5).map((candidate) => { const raw = longTerm.scored.find((value) => value.candidateKey === candidate.candidateKey)!.score; const recent = t2.recentScores.get(candidate.candidateKey) ?? 0; const combined = t2.combined.find((value) => value.candidateKey === candidate.candidateKey)!.score; return { key: diagnosticKey(candidate.candidateKey), longTermRaw: raw, recentRaw: recent, normalizedLongTerm: normalizedLong.get(candidate.candidateKey), normalizedRecent: recent, combined, rankBefore: longTerm.scored.findIndex((value) => value.candidateKey === candidate.candidateKey) + 1, rankAfter: t2.combined.findIndex((value) => value.candidateKey === candidate.candidateKey) + 1, matchingCategory: 1, matchingConcepts: candidate.conceptKeys.length }; });

  const project = projects.find((value) => { const components = new Set(value.requiredComponents.flatMap((component) => component.taxonomyConcepts.map((entry) => entry.concept.canonicalKey))); return candidates.some((candidate) => candidate.conceptKeys.some((key) => components.has(key))); });
  let projectDriven: Record<string, unknown> = { supported: false, reason: 'NO_COMPONENT_MATERIAL_CONCEPT_OVERLAP' };
  if (project) {
    const projectComponents = [...new Set(project.requiredComponents.flatMap((component) => component.taxonomyConcepts.map((entry) => entry.concept.canonicalKey)))];
    const projectMetadata = new Map(metadata); projectMetadata.set(project.id, { categoryKey: categoryKey(project.categoryId), conceptKeys: project.taxonomyConcepts.map((entry) => entry.concept.canonicalKey), componentConceptKeys: projectComponents });
    const projectIntent = buildShortTermIntent([{ entityKey: project.id, actionType: 'project_save', timestampUtc: '2026-07-19T11:00:00Z' }], projectMetadata, now);
    const matching = candidates.filter((candidate) => candidate.conceptKeys.some((key) => projectComponents.includes(key)));
    const projectRecent = new Map(candidates.map((candidate) => [candidate.candidateKey, recentItemScore(metadata.get(candidate.candidateKey)!, projectIntent.intent)]));
    const projectCombined = combineNormalizedScores(longTerm.scored, projectRecent, .35);
    const bestMatchBefore = Math.min(...matching.map((candidate) => longTerm.scored.findIndex((value) => value.candidateKey === candidate.candidateKey) + 1));
    const bestMatchAfter = Math.min(...matching.map((candidate) => projectCombined.findIndex((value) => value.candidateKey === candidate.candidateKey) + 1));
    projectDriven = { supported: true, matchingCandidates: matching.length, bestMatchBefore, bestMatchAfter };
  }

  const sensitivity = [.35, .40, .45].map((blend) => ({ blend, domainBTop5: categoryCount(rank(t2Events, blend).combined, domainB), domainATop5: categoryCount(rank(t2Events, blend).combined, domainA) }));
  console.log(JSON.stringify({ slice4cScenario: { candidateCount: candidates.length, candidateSetStable: true, domainAKey: diagnosticKey(domainA), domainBKey: diagnosticKey(domainB), initialB, t1B, t2B, t2A, fixed35Passed: t2B > initialB && t2A >= 1, sensitivity, decomposition, projectDriven } }));
  assert.equal(t2B, initialB);
  assert.equal(sensitivity[2]!.domainATop5, 0);
  assert.equal(projectDriven.supported, false);
});

test('authenticated new material view invalidates only its learner and deduplicated repeats do not', async () => {
  const prior = { shadow: env.recommendationMlShadowEnabled, material: env.recommendationMlMaterialArtifactPath, project: env.recommendationMlProjectArtifactPath };
  const observations: unknown[] = []; const startedAt = new Date(); const cleanupMaterialIds: string[] = [];
  setMlShadowObserverForTests((value) => observations.push(value));
  try {
    env.recommendationMlShadowEnabled = true;
    env.recommendationMlMaterialArtifactPath = path.join(root, 'ml/recommendation/generated/portable-model/material-hybrid-runtime-v2.json');
    env.recommendationMlProjectArtifactPath = path.join(root, 'ml/recommendation/generated/portable-model/project-hybrid-runtime-v2.json');
    clearMlArtifactCacheForTests();
    const users = await prisma.user.findMany({ where: { roles: { some: { role: 'LEARNER' } } }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: 2 });
    assert.equal(users.length, 2); const [learner, unrelated] = users;
    const materials = await prisma.material.findMany({ where: { status: 'AVAILABLE', views: { none: { viewerUserId: learner!.id } } }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: 2 });
    assert.equal(materials.length, 2);
    cleanupMaterialIds.push(...materials.map((material) => material.id));
    invalidateLearnerHomeCache(learner!.id); invalidateLearnerHomeCache(unrelated!.id);
    await getLearnerHome(learner!.id); await getLearnerHome(unrelated!.id);
    const before = observations.length;
    await getMaterialById(materials[0]!.id, { sub: learner!.id, roles: ['LEARNER'] });
    await getLearnerHome(learner!.id);
    assert.equal(observations.length, before + 2, 'new authenticated view did not invalidate');
    const afterNewView = observations.length;
    await getMaterialById(materials[0]!.id, { sub: learner!.id, roles: ['LEARNER'] });
    await getLearnerHome(learner!.id);
    assert.equal(observations.length, afterNewView, 'deduplicated view invalidated cache');
    await getMaterialById(materials[1]!.id);
    await getLearnerHome(learner!.id); await getLearnerHome(unrelated!.id);
    assert.equal(observations.length, afterNewView, 'anonymous view or unrelated cache was invalidated');
    await assert.rejects(() => getMaterialById('slice4c-missing-material', { sub: learner!.id, roles: ['LEARNER'] }));
    await getLearnerHome(learner!.id); assert.equal(observations.length, afterNewView, 'failed view invalidated cache');
  } finally {
    const created = await prisma.materialView.groupBy({ by: ['materialId'], where: { createdAt: { gte: startedAt }, materialId: { in: cleanupMaterialIds } }, _count: { _all: true } });
    await prisma.$transaction(async (tx) => {
      await tx.materialView.deleteMany({ where: { createdAt: { gte: startedAt }, materialId: { in: cleanupMaterialIds } } });
      for (const row of created) await tx.material.update({ where: { id: row.materialId }, data: { viewsCount: { decrement: row._count._all } } });
    });
    assert.equal(await prisma.materialView.count({ where: { createdAt: { gte: startedAt }, materialId: { in: cleanupMaterialIds } } }), 0);
    setMlShadowObserverForTests(undefined); clearMlArtifactCacheForTests();
    env.recommendationMlShadowEnabled = prior.shadow; env.recommendationMlMaterialArtifactPath = prior.material; env.recommendationMlProjectArtifactPath = prior.project;
    await prisma.$disconnect();
  }
});
