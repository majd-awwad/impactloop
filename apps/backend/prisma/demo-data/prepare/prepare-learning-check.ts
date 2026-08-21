/**
 * Graduation/report screenshot prep for Learning Check.
 *
 * Additive and idempotent. Reuses Majd Learner's existing Simple LED Circuit
 * build when present. Never deletes the build or runs prisma:seed.
 */
import { prisma } from '../../../src/database/prisma.js';
import { env } from '../../../src/config/env.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import {
  createProjectBuildAttempt,
  startOrReturnProjectBuild,
} from '../../../src/modules/learning-projects/project-build-lifecycle.js';
import { setupLearningSessionForBuild } from '../../../src/modules/project-learning/build-learning-session-setup.service.js';
import { MAJD_LEARNER_EMAIL, redact } from './local-demo-accounts.js';

export const LEARNING_CHECK_DEMO_PROJECT_TITLE = 'Simple LED Circuit';
export const LEARNING_CHECK_DEMO_STEP_TITLE = 'Place the LED';

export type LearningCheckDemoSnapshot = {
  hasActiveBuild: boolean;
  sessionReady: boolean;
  startCount: number;
  hasPlaceTheLedStepAssignment: boolean;
  finalCount: number;
  buildCompleted: boolean;
};

export const isLearningCheckDemoReady = (
  snapshot: LearningCheckDemoSnapshot,
): boolean =>
  snapshot.hasActiveBuild &&
  snapshot.sessionReady &&
  snapshot.startCount >= 1 &&
  snapshot.hasPlaceTheLedStepAssignment &&
  snapshot.finalCount >= 1 &&
  !snapshot.buildCompleted;

export const shouldReuseLearningCheckBuild = (existingBuildId: string | null) =>
  Boolean(existingBuildId);

export type LearningCheckDemoBuildAction =
  | 'reuse-active'
  | 'start-first'
  | 'start-again';

export const resolveLearningCheckDemoBuildAction = (input: {
  activeBuildId: string | null;
  hasExistingBuild: boolean;
}): LearningCheckDemoBuildAction => {
  if (input.activeBuildId) {
    return 'reuse-active';
  }
  if (input.hasExistingBuild) {
    return 'start-again';
  }
  return 'start-first';
};

const countByStage = (
  assignments: Array<{ stage: string; projectStepId?: string | null }>,
  stage: string,
) => assignments.filter((assignment) => assignment.stage === stage).length;

export async function prepareLearningCheckDemo() {
  assertLocalDemoDatabaseUrl(env.databaseUrl, 'learning-check demo prep');

  const learner = await prisma.user.findUnique({
    where: { email: MAJD_LEARNER_EMAIL },
    select: { id: true, displayName: true, email: true },
  });
  if (!learner) {
    throw new Error(`Primary screenshot account ${MAJD_LEARNER_EMAIL} was not found.`);
  }

  const project = await prisma.learningProject.findFirst({
    where: {
      title: LEARNING_CHECK_DEMO_PROJECT_TITLE,
      status: 'PUBLISHED',
      hiddenAt: null,
      archivedAt: null,
    },
    select: {
      id: true,
      title: true,
      steps: {
        orderBy: { stepNumber: 'asc' },
        select: { id: true, title: true, stepNumber: true },
      },
    },
  });
  if (!project) {
    throw new Error(
      `Published project "${LEARNING_CHECK_DEMO_PROJECT_TITLE}" was not found.`,
    );
  }

  const placeTheLedStep = project.steps.find(
    (step) => step.title === LEARNING_CHECK_DEMO_STEP_TITLE,
  );
  if (!placeTheLedStep) {
    throw new Error(
      `Project "${LEARNING_CHECK_DEMO_PROJECT_TITLE}" is missing step "${LEARNING_CHECK_DEMO_STEP_TITLE}".`,
    );
  }

  const existingBuild = await prisma.projectBuild.findFirst({
    where: {
      learnerId: learner.id,
      projectId: project.id,
      status: { in: ['IN_PROGRESS', 'PAUSED'] },
    },
    select: { id: true, status: true },
    orderBy: { updatedAt: 'desc' },
  });
  const anyExistingBuild = existingBuild
    ? true
    : Boolean(
        await prisma.projectBuild.findFirst({
          where: { learnerId: learner.id, projectId: project.id },
          select: { id: true },
        }),
      );

  const buildAction = resolveLearningCheckDemoBuildAction({
    activeBuildId: existingBuild?.id ?? null,
    hasExistingBuild: anyExistingBuild,
  });

  let build: { id: string; status: string };
  if (buildAction === 'reuse-active' && existingBuild) {
    build = existingBuild;
  } else if (buildAction === 'start-again') {
    const created = await createProjectBuildAttempt(project.id, learner.id);
    if (!created) {
      throw new Error(
        `Could not start a new "${LEARNING_CHECK_DEMO_PROJECT_TITLE}" build attempt.`,
      );
    }
    build = { id: created.id, status: created.status };
  } else {
    const created = await startOrReturnProjectBuild(project.id, learner.id);
    build = { id: created.id, status: created.status };
  }

  const setup = await setupLearningSessionForBuild({
    buildId: build.id,
    learnerId: learner.id,
  });

  if (setup.status !== 'READY') {
    throw new Error(
      `Learning session setup for "${LEARNING_CHECK_DEMO_PROJECT_TITLE}" is ${setup.status}` +
        `${setup.setup.reasonCode ? ` (${setup.setup.reasonCode})` : ''}.`,
    );
  }

  const session = setup.session;
  const startCount = countByStage(session.assignments, 'START');
  const finalCount = countByStage(session.assignments, 'FINAL');
  const placeTheLedAssignment = session.assignments.find(
    (assignment) =>
      assignment.stage === 'STEP' &&
      assignment.projectStepId === placeTheLedStep.id,
  );

  const snapshot: LearningCheckDemoSnapshot = {
    hasActiveBuild: true,
    sessionReady: true,
    startCount,
    hasPlaceTheLedStepAssignment: Boolean(placeTheLedAssignment),
    finalCount,
    buildCompleted: build.status === 'COMPLETED',
  };

  if (!isLearningCheckDemoReady(snapshot)) {
    throw new Error(
      'Learning Check demo state is incomplete after setup ' +
        `(start=${startCount}, placeTheLed=${snapshot.hasPlaceTheLedStepAssignment}, final=${finalCount}).`,
    );
  }

  console.log('\nLearning Check demo prep complete for Majd Learner.');
  console.log(
    `Account: ${learner.displayName} <${learner.email}> (${redact(learner.id)})`,
  );
  console.log(`Project: ${project.title} (${redact(project.id)})`);
  console.log(`Build: ${redact(build.id)} [${build.status}]`);
  console.log(
    `Session: ${redact(session.id)} [READY] ${
      buildAction === 'reuse-active'
        ? '(reused build)'
        : buildAction === 'start-again'
          ? '(new attempt after completed/archived build)'
          : '(created build)'
    }`,
  );
  console.log(
    `Assignments: START=${startCount} STEP=${countByStage(session.assignments, 'STEP')} FINAL=${finalCount}`,
  );
  console.log(
    `Place the LED STEP assignment: ${redact(placeTheLedAssignment!.id)}`,
  );

  return {
    reusedExistingBuild: buildAction === 'reuse-active',
    startedAgain: buildAction === 'start-again',
    buildId: build.id,
    sessionId: session.id,
    projectId: project.id,
    placeTheLedStepId: placeTheLedStep.id,
    startCount,
    finalCount,
  };
}
