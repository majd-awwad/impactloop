import path from 'node:path';

import { env } from '../src/config/env.js';
import { prisma } from '../src/database/prisma.js';
import {
  getLearnerHome,
  getLearnerHomeSection,
  invalidateLearnerHomeCache,
} from '../src/modules/learner-home/learner-home.service.js';
import {
  clearMlArtifactCacheForTests,
  setMlShadowObserverForTests,
  type ShadowDiagnostics,
} from '../src/modules/recommendations/ml-shadow.service.js';

const root = path.resolve(process.cwd(), '../..');
const projectArtifact = path.join(root, 'ml/recommendation/generated/portable-model/project-hybrid-runtime-v2.json');

const prior = {
  shadow: env.recommendationMlShadowEnabled,
  materialServing: env.recommendationMlMaterialServingEnabled,
  projectServing: env.recommendationMlProjectServingEnabled,
  materialPath: env.recommendationMlMaterialArtifactPath,
  projectPath: env.recommendationMlProjectArtifactPath,
};
env.recommendationMlShadowEnabled = true;
env.recommendationMlMaterialServingEnabled = false;
env.recommendationMlProjectServingEnabled = true;
env.recommendationMlProjectArtifactPath = projectArtifact;
clearMlArtifactCacheForTests();

const observations: Array<ShadowDiagnostics & { domain: 'material' | 'project' }> = [];
setMlShadowObserverForTests((value) => observations.push(value));

const learners = await prisma.user.findMany({
  where: { roles: { some: { role: 'LEARNER' } } },
  orderBy: { createdAt: 'asc' },
  take: 20,
  select: {
    id: true,
    learnerProfile: { select: { interests: true } },
    _count: { select: { materialLikes: true, materialViews: true, projectSaves: true, projectLikes: true } },
  },
});

const score = (learner: typeof learners[number]) =>
  learner._count.materialLikes + learner._count.materialViews + learner._count.projectSaves + learner._count.projectLikes;

const profileOnly = learners.find((learner) => (learner.learnerProfile?.interests.length ?? 0) > 0 && score(learner) === 0);
const activeLearner = learners.find((learner) => score(learner) > 2) ?? learners[0];

const results: Array<Record<string, unknown>> = [];

for (const [label, learner] of [['profile-only', profileOnly], ['active', activeLearner]] as const) {
  if (!learner) continue;
  observations.length = 0;
  invalidateLearnerHomeCache(learner.id);
  env.recommendationMlProjectServingEnabled = false;
  const deterministic = await getLearnerHome(learner.id);
  const deterministicProjects = deterministic.sections.find((section) => section.key === 'suggested_projects')?.items.map((item) => item.type === 'project' ? item.project.id : '') ?? [];
  env.recommendationMlProjectServingEnabled = true;
  invalidateLearnerHomeCache(learner.id);
  observations.length = 0;
  const served = await getLearnerHome(learner.id);
  const servedProjects = served.sections.find((section) => section.key === 'suggested_projects')?.items.map((item) => item.type === 'project' ? item.project.id : '') ?? [];
  const section = await getLearnerHomeSection(learner.id, 'suggested_projects', 4);
  const sectionProjects = section.items.filter((item) => item.type === 'project').map((item) => item.project.id);
  const projectDiagnostics = observations.find((value) => value.domain === 'project');
  results.push({
    case: label,
    projectReadinessStatus: projectDiagnostics?.projectReadinessStatus,
    recentConfidence: projectDiagnostics?.recentConfidence,
    rankedCandidateCount: projectDiagnostics?.rankedCandidateKeys?.length ?? projectDiagnostics?.runtimeCandidateCount,
    recentSlotsUsedTop5: projectDiagnostics?.recentSlotsUsedTop5,
    scorerDurationMs: projectDiagnostics?.scorerDurationMs,
    totalProjectRecommendationDurationMs: projectDiagnostics?.totalProjectRecommendationDurationMs,
    homeSectionConsistent: JSON.stringify(servedProjects.slice(0, 4)) === JSON.stringify(sectionProjects),
    materialSectionsUnchanged: JSON.stringify(
      served.sections.filter((value) => value.key !== 'suggested_projects').map((value) => value.key),
    ) === JSON.stringify(
      deterministic.sections.filter((value) => value.key !== 'suggested_projects').map((value) => value.key),
    ),
    suggestedProjectsChanged: JSON.stringify(deterministicProjects) !== JSON.stringify(servedProjects),
  });
}

console.log(JSON.stringify({ slice4iValidation: results }, null, 2));

env.recommendationMlShadowEnabled = prior.shadow;
env.recommendationMlMaterialServingEnabled = prior.materialServing;
env.recommendationMlProjectServingEnabled = prior.projectServing;
env.recommendationMlMaterialArtifactPath = prior.materialPath;
env.recommendationMlProjectArtifactPath = prior.projectPath;
clearMlArtifactCacheForTests();
setMlShadowObserverForTests(undefined);
await prisma.$disconnect();
