import { prisma } from '../src/database/prisma.js';
import { getLearnerHome, getLearnerHomeSection } from '../src/modules/learner-home/learner-home.service.js';
import { createLearnerHomeProfiler } from '../src/modules/learner-home/learner-home.scoring-debug.js';
import * as learnerHomeRepository from '../src/modules/learner-home/learner-home.repository.js';
import { buildBehaviorAffinityProfile } from '../src/modules/learner-home/learner-home.affinity.js';
import { normalizeInterests } from '../src/modules/learner-home/learner-home.scoring.js';
import { HOME_MATERIAL_POOL_CAP } from '../src/modules/learner-home/learner-home.repository.js';
import { setLoggerLevelForTests } from '../src/observability/logger.js';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'debug';
setLoggerLevelForTests(process.env.LOG_LEVEL);

const email = process.argv[2] ?? 'majd@learner.com';

const user = await prisma.user.findFirst({
  where: { email },
  select: { id: true, email: true },
});

if (!user) {
  console.error(`No user found for ${email}`);
  process.exit(1);
}

const profileContext = async () => {
  const profiler = createLearnerHomeProfiler('benchmark');
  const [
    rawInterests,
    savedLocation,
    hasSavedProjects,
    behavior,
    projects,
  ] = await Promise.all([
    profiler.time('loadLearnerInterests', () =>
      learnerHomeRepository.loadLearnerInterests(user.id),
    ),
    profiler.time('loadDefaultSavedLocation', () =>
      learnerHomeRepository.loadDefaultSavedLocation(user.id),
    ),
    profiler.time('hasSavedProjects', () =>
      learnerHomeRepository.hasSavedProjects(user.id),
    ),
    profiler.time('loadLearnerBehaviorContext', () =>
      learnerHomeRepository.loadLearnerBehaviorContext(user.id),
    ),
    profiler.time('loadProjectCandidates', () =>
      learnerHomeRepository.loadProjectCandidates(user.id),
    ),
  ]);
  const interests = normalizeInterests(rawInterests);
  const savedComponents = behavior.savedProjectComponents ?? [];
  void hasSavedProjects;
  void projects;
  profiler.mark('buildBehaviorAffinityProfile', () => {
    buildBehaviorAffinityProfile(behavior);
  });
  await profiler.time('loadMaterialCandidates', () =>
    learnerHomeRepository.loadMaterialCandidatesForLearner({
      interests,
      savedComponents,
      behavior,
      savedLocation,
      poolCap: HOME_MATERIAL_POOL_CAP,
    }),
  );
  await profiler.time('loadProjectCandidates', () =>
    learnerHomeRepository.loadProjectCandidates(user.id),
  );
  profiler.report({ userId: user.id, scope: 'benchmark-context' });
};

await profileContext();

const homeStart = performance.now();
await getLearnerHome(user.id);
const homeMs = Math.round(performance.now() - homeStart);

const sectionStart = performance.now();
await getLearnerHomeSection(user.id, 'suggested_materials', 20);
const sectionMs = Math.round(performance.now() - sectionStart);

console.log(
  JSON.stringify(
    {
      email: user.email,
      userId: user.id,
      getLearnerHomeMs: homeMs,
      getLearnerHomeSectionMs: sectionMs,
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
