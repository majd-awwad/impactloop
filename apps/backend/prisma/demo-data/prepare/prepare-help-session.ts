import { prisma } from '../../../src/database/prisma.js';
import { env } from '../../../src/config/env.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import { createProjectHelpSessionRequest } from '../../../src/modules/project-help-sessions/project-help-session.service.js';
import { upsertAuthorHelpSessionSettings } from '../../../src/modules/project-help-sessions/project-help-session-offering.js';
import { startProjectBuildById } from '../../../src/modules/learning-projects/learning-projects.service.js';
import { PROJECT_HELP_SESSION_ACTIVE_STATUSES } from '../../../src/modules/project-help-sessions/project-help-session-status.js';
import { MAJD_LEARNER_EMAIL, redact } from './local-demo-accounts.js';

export const HELP_SESSION_PREFERRED_TITLES = [
  'Recycled Cardboard Desk Organizer',
  'Fabric Pencil Case',
  'Mini Wooden Phone Stand',
  'Mini Greenhouse Prototype',
] as const;

const PROBLEM_BY_TITLE: Record<string, string> = {
  'PVC Plant Stand':
    'The PVC joints keep slipping when I dry-fit the frame. I tried sanding the pipe ends, but the stand still wobbles and I am not sure how to lock the corners without cracking the fittings.',
  'Recycled Cardboard Desk Organizer':
    'The cardboard folds keep collapsing when I attach the pen slots. I tried double-layering the walls, but the corners still buckle and I am not sure how to reinforce them without making the organizer too bulky.',
  'Fabric Pencil Case':
    'The zipper keeps catching on the fabric seam. I tried pinning it again, but the edges still pucker and I am not sure how to sew it straight without ruining the denim panel.',
  'Mini Wooden Phone Stand':
    'The phone stand leans forward after I glue the support piece. I tried clamping it longer, but the angle still looks wrong and I am not sure how to correct it without splitting the wood.',
  'Mini Greenhouse Prototype':
    'The acrylic panels leave gaps at the corners after I cut them. I tried taping the joints, but they still shift and I am not sure how to square the frame before sealing it.',
};

const fallbackProblemDescription = (projectTitle: string) =>
  `I am stuck on a practical step in "${projectTitle}". I already tried the instructions twice, but the result still does not hold together and I need the project creator to walk me through the next move.`;

const futureDate = (minutesFromNow: number) =>
  new Date(Date.now() + minutesFromNow * 60_000);

export const shouldReuseEligibleHelpTarget = (input: {
  existingEligibleBuildId: string | null;
  existingActiveSessionId: string | null;
}) => Boolean(input.existingEligibleBuildId || input.existingActiveSessionId);

export async function prepareHelpSessionDemo() {
  assertLocalDemoDatabaseUrl(env.databaseUrl, 'help-session demo prep');

  const learner = await prisma.user.findUnique({
    where: { email: MAJD_LEARNER_EMAIL },
    select: { id: true, displayName: true, email: true },
  });
  if (!learner) {
    throw new Error(`Primary screenshot account ${MAJD_LEARNER_EMAIL} was not found.`);
  }

  const eligibleAuthorFilter = {
    createdBy: { not: learner.id },
    status: 'PUBLISHED' as const,
    hiddenAt: null,
    archivedAt: null,
    createdByUser: {
      accountStatus: 'ACTIVE' as const,
      roles: { some: { role: 'LEARNER' as const } },
    },
  };

  const existingEligibleBuild = await prisma.projectBuild.findFirst({
    where: {
      learnerId: learner.id,
      status: { in: ['IN_PROGRESS', 'PAUSED'] },
      project: eligibleAuthorFilter,
    },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          createdBy: true,
          createdByUser: { select: { displayName: true, email: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  let project =
    existingEligibleBuild?.project ??
    (await prisma.learningProject.findFirst({
      where: {
        ...eligibleAuthorFilter,
        title: { in: [...HELP_SESSION_PREFERRED_TITLES] },
      },
      select: {
        id: true,
        title: true,
        createdBy: true,
        createdByUser: { select: { displayName: true, email: true } },
      },
      orderBy: { title: 'asc' },
    }));

  if (!project) {
    project = await prisma.learningProject.findFirst({
      where: eligibleAuthorFilter,
      select: {
        id: true,
        title: true,
        createdBy: true,
        createdByUser: { select: { displayName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!project) {
    throw new Error(
      'No published non-owned project is available for Majd Learner help-session demo data.',
    );
  }

  await upsertAuthorHelpSessionSettings(project.id, project.createdBy, {
    isEnabled: true,
    allow15Minutes: true,
    allow30Minutes: true,
    weeklyLimit: 5,
  });

  let build = existingEligibleBuild
    ? { id: existingEligibleBuild.id, status: existingEligibleBuild.status }
    : await prisma.projectBuild.findFirst({
        where: {
          learnerId: learner.id,
          projectId: project.id,
          status: { in: ['IN_PROGRESS', 'PAUSED'] },
        },
        select: { id: true, status: true },
        orderBy: { updatedAt: 'desc' },
      });

  if (!build) {
    const started = await startProjectBuildById(project.id, learner.id);
    build = { id: started.id, status: started.status };
  }

  const existingSession = await prisma.projectHelpSession.findFirst({
    where: {
      buildId: build.id,
      learnerId: learner.id,
      status: { in: [...PROJECT_HELP_SESSION_ACTIVE_STATUSES] },
    },
    include: {
      project: { select: { title: true } },
      timeOptions: { orderBy: { startsAt: 'asc' } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  let session = existingSession;
  let created = false;
  if (!session) {
    const step = await prisma.projectStep.findFirst({
      where: { projectId: project.id },
      select: { id: true, title: true, stepNumber: true },
      orderBy: { stepNumber: 'asc' },
    });
    const dto = await createProjectHelpSessionRequest(learner.id, build.id, {
      problemDescription:
        PROBLEM_BY_TITLE[project.title] ?? fallbackProblemDescription(project.title),
      projectStepId: step?.id ?? null,
      durationMinutes: 30,
      learnerTimeZone: 'Asia/Hebron',
      proposedTimes: [futureDate(120), futureDate(180), futureDate(240)],
    });
    created = true;
    session = await prisma.projectHelpSession.findFirstOrThrow({
      where: { id: dto.id },
      include: {
        project: { select: { title: true } },
        timeOptions: { orderBy: { startsAt: 'asc' } },
      },
    });
  }

  const desiredProblem =
    PROBLEM_BY_TITLE[project.title] ?? fallbackProblemDescription(project.title);
  if (session.problemDescription !== desiredProblem) {
    session = await prisma.projectHelpSession.update({
      where: { id: session.id },
      data: { problemDescription: desiredProblem },
      include: {
        project: { select: { title: true } },
        timeOptions: { orderBy: { startsAt: 'asc' } },
      },
    });
  }

  console.log('\nProject Help Session demo prep complete for Majd Learner.');
  console.log(`Account: ${learner.displayName} <${learner.email}> (${redact(learner.id)})`);
  console.log(`Project: ${project.title} (${redact(project.id)})`);
  console.log(
    `Author: ${project.createdByUser.displayName} <${project.createdByUser.email}>`,
  );
  console.log(`Build: ${redact(build.id)} [${build.status}]`);
  console.log(
    `Session: ${redact(session.id)} [${session.status}] ${created ? '(created)' : '(reused)'}`,
  );

  return {
    reusedExistingBuild: Boolean(existingEligibleBuild),
    reusedExistingSession: Boolean(existingSession),
    buildId: build.id,
    sessionId: session.id,
    projectId: project.id,
  };
}
