import path from 'node:path';

import { env } from '../src/config/env.js';
import { prisma } from '../src/database/prisma.js';
import { getLearnerHome, invalidateLearnerHomeCache } from '../src/modules/learner-home/learner-home.service.js';
import {
  clearMlArtifactCacheForTests,
  setMlShadowObserverForTests,
  type ShadowDiagnostics,
} from '../src/modules/recommendations/ml-shadow.service.js';

const root = path.resolve(process.cwd(), '../..');
const projectArtifact = path.join(root, 'ml/recommendation/generated/portable-model/project-hybrid-runtime-v2.json');

const prior = {
  shadow: env.recommendationMlShadowEnabled,
  projectPath: env.recommendationMlProjectArtifactPath,
};
env.recommendationMlShadowEnabled = true;
env.recommendationMlProjectArtifactPath = projectArtifact;
clearMlArtifactCacheForTests();

const observations: Array<ShadowDiagnostics & { domain: 'material' | 'project' }> = [];
setMlShadowObserverForTests((value) => observations.push(value));

const learners = await prisma.user.findMany({
  where: { roles: { some: { role: 'LEARNER' } } },
  orderBy: { createdAt: 'asc' },
  take: 30,
  select: {
    id: true,
    learnerProfile: { select: { interests: true } },
    _count: { select: { materialLikes: true, materialViews: true, projectSaves: true, projectLikes: true } },
    projectSaves: { select: { projectId: true }, take: 20 },
    projectLikes: { select: { projectId: true }, take: 20 },
  },
});

const score = (learner: typeof learners[number]) =>
  learner._count.materialLikes + learner._count.materialViews + learner._count.projectSaves + learner._count.projectLikes;

const profileOnly = learners.find((learner) => (learner.learnerProfile?.interests.length ?? 0) > 0 && score(learner) === 0);
const scattered = learners.find((learner) => score(learner) > 8 && new Set([
  ...learner.projectSaves.map((row) => row.projectId),
  ...learner.projectLikes.map((row) => row.projectId),
]).size >= 4);
const coherent = learners.find((learner) => {
  const projectIds = new Set([
    ...learner.projectSaves.map((row) => row.projectId),
    ...learner.projectLikes.map((row) => row.projectId),
  ]);
  return projectIds.size >= 2 && learner._count.projectSaves + learner._count.projectLikes >= 3;
});

const cases = [
  { label: 'profile-only', learner: profileOnly },
  { label: 'coherent', learner: coherent },
  { label: 'scattered', learner: scattered ?? learners.find((learner) => score(learner) > 5) },
].filter((entry) => entry.learner);

const results: Array<Record<string, unknown>> = [];
for (const entry of cases) {
  observations.length = 0;
  invalidateLearnerHomeCache(entry.learner!.id);
  const disabled = await getLearnerHome(entry.learner!.id);
  env.recommendationMlShadowEnabled = false;
  invalidateLearnerHomeCache(entry.learner!.id);
  const deterministic = await getLearnerHome(entry.learner!.id);
  env.recommendationMlShadowEnabled = true;
  const projectDiagnostics = observations.find((value) => value.domain === 'project');
  const materialDiagnostics = observations.find((value) => value.domain === 'material');
  const suggestedProjects = disabled.sections.find((section) => section.key === 'suggested_projects')?.items.map((item) => item.project.id) ?? [];
  const deterministicProjects = deterministic.sections.find((section) => section.key === 'suggested_projects')?.items.map((item) => item.project.id) ?? [];
  results.push({
    case: entry.label,
    publicOrderingUnchanged: JSON.stringify(suggestedProjects) === JSON.stringify(deterministicProjects),
    projectReadinessStatus: projectDiagnostics?.projectReadinessStatus,
    runtimeCandidateCount: projectDiagnostics?.runtimeCandidateCount,
    artifactMappedCandidateCount: projectDiagnostics?.artifactMappedCandidateCount,
    missingArtifactCandidateCount: projectDiagnostics?.runtimeCandidatesMissingFromArtifact,
    duplicateRuntimeCandidateCount: projectDiagnostics?.duplicateRuntimeCandidateCount,
    nonFiniteScoreCount: projectDiagnostics?.nonFiniteScoreCount,
    hydrationFailureCount: projectDiagnostics?.hydratedMappingFailureCount,
    recentConfidence: projectDiagnostics?.recentConfidence,
    recentSlotsUsedTop5: projectDiagnostics?.recentSlotsUsedTop5,
    recentSlotsUsedTop10: projectDiagnostics?.recentSlotsUsedTop10,
    scorerDurationMs: projectDiagnostics?.scorerDurationMs,
    totalProjectRecommendationDurationMs: projectDiagnostics?.totalProjectRecommendationDurationMs,
    materialStatus: materialDiagnostics?.status,
    materialConfidence: materialDiagnostics?.recentConfidence,
    responseStatus: 200,
  });
}

console.log(JSON.stringify({ slice4hCValidation: results }, null, 2));

env.recommendationMlShadowEnabled = prior.shadow;
env.recommendationMlProjectArtifactPath = prior.projectPath;
clearMlArtifactCacheForTests();
setMlShadowObserverForTests(undefined);
await prisma.$disconnect();
