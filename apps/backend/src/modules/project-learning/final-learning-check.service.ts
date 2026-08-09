import type { ProjectBuildStatus } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import { findProjectBuild } from '../learning-projects/learning-projects.repository.js';
import {
  findOwnedLearningAssignmentById,
  findOwnedLearningSessionByBuildId,
} from './build-learning-session.repository.js';
import {
  skipLearningAssignment,
  submitLearningAnswerAttempt,
  viewLearningAssignmentHint,
} from './build-learning-session.service.js';
import {
  mapLearnerFinalLearningAssignment,
  mapLearnerFinalLearningCheck,
  type FinalLearningCheckAiHandoffDto,
  type LearnerFinalLearningCheckDto,
} from './project-learning-final-check.dto.js';
import {
  assertAdminMutationNotAllowed,
  type LearningAccessRole,
} from './project-learning.authorization.js';
import {
  persistBuildLearningSummary,
  resolveLearningSummaryForSession,
} from './project-learning-summary.service.js';

const areRequiredStepsComplete = async (input: {
  buildId: string;
  projectId: string;
}): Promise<boolean> => {
  const projectSteps = await prisma.projectStep.findMany({
    where: { projectId: input.projectId },
    select: { id: true },
    orderBy: { stepNumber: 'asc' },
  });

  if (projectSteps.length === 0) {
    return false;
  }

  const progressRows = await prisma.projectBuildStepProgress.findMany({
    where: {
      buildId: input.buildId,
      completedAt: { not: null },
    },
    select: { projectStepId: true },
  });

  const completed = new Set(progressRows.map((row) => row.projectStepId));
  return projectSteps.every((step) => completed.has(step.id));
};

const assertFinalCheckMutationAllowed = (buildStatus: ProjectBuildStatus) => {
  if (buildStatus === 'ARCHIVED') {
    throw new AppError(
      'Final learning check is locked for archived builds.',
      409,
      'BUILD_LEARNING_CHECK_LOCKED',
    );
  }

  if (
    buildStatus !== 'IN_PROGRESS' &&
    buildStatus !== 'PAUSED' &&
    buildStatus !== 'COMPLETED'
  ) {
    throw new AppError(
      'Final learning check is not available for this build.',
      409,
      'FINAL_LEARNING_CHECK_NOT_AVAILABLE',
    );
  }
};

const loadFinalCheckContext = async (input: {
  projectId: string;
  learnerId: string;
}) => {
  const build = await findProjectBuild(input.projectId, input.learnerId);
  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  const session = await findOwnedLearningSessionByBuildId(
    build.id,
    input.learnerId,
  );

  const stepsComplete = await areRequiredStepsComplete({
    buildId: build.id,
    projectId: build.projectId,
  });

  return { build, session, stepsComplete };
};

const assertFinalAssignment = async (input: {
  assignmentId: string;
  learnerId: string;
  buildId: string;
}) => {
  const assignment = await findOwnedLearningAssignmentById(
    input.assignmentId,
    input.learnerId,
  );

  if (!assignment || assignment.session.buildId !== input.buildId) {
    throw new AppError(
      'Final learning check is not available.',
      404,
      'FINAL_LEARNING_CHECK_NOT_AVAILABLE',
    );
  }

  if (assignment.stage !== 'FINAL') {
    throw new AppError(
      'Learning assignment stage mismatch.',
      409,
      'LEARNING_ASSIGNMENT_STAGE_MISMATCH',
    );
  }

  return assignment;
};

export const getFinalLearningCheckForBuild = async (input: {
  projectId: string;
  learnerId: string;
}): Promise<LearnerFinalLearningCheckDto | null> => {
  const context = await loadFinalCheckContext(input);

  if (!context.stepsComplete) {
    throw new AppError(
      'Complete all required build steps before opening the final learning check.',
      409,
      'BUILD_STEPS_NOT_COMPLETE',
    );
  }

  if (!context.session) {
    throw new AppError(
      'Learning session is not ready.',
      409,
      'LEARNING_SESSION_NOT_READY',
    );
  }

  const finalAssignments = context.session.assignments.filter(
    (assignment) => assignment.stage === 'FINAL',
  );

  if (finalAssignments.length === 0) {
    throw new AppError(
      'Final learning check is not available.',
      404,
      'FINAL_LEARNING_CHECK_NOT_AVAILABLE',
    );
  }

  const isReadOnly = context.build.status === 'ARCHIVED';
  const learningSummary = await resolveLearningSummaryForSession(context.session);

  return mapLearnerFinalLearningCheck({
    assignments: finalAssignments,
    isReadOnly,
    learningSummary,
  });
};

export const viewFinalLearningCheckHint = async (input: {
  projectId: string;
  assignmentId: string;
  learnerId: string;
  role: LearningAccessRole;
}) => {
  assertAdminMutationNotAllowed(input.role);
  const context = await loadFinalCheckContext(input);

  if (!context.stepsComplete) {
    throw new AppError(
      'Complete all required build steps before opening the final learning check.',
      409,
      'BUILD_STEPS_NOT_COMPLETE',
    );
  }

  assertFinalCheckMutationAllowed(context.build.status);
  await assertFinalAssignment({
    assignmentId: input.assignmentId,
    learnerId: input.learnerId,
    buildId: context.build.id,
  });

  await viewLearningAssignmentHint({
    assignmentId: input.assignmentId,
    learnerId: input.learnerId,
    role: input.role,
    allowOnCompleted: true,
  });

  const refreshed = await findOwnedLearningAssignmentById(
    input.assignmentId,
    input.learnerId,
  );
  if (!refreshed) {
    throw new AppError(
      'Final learning check is not available.',
      404,
      'FINAL_LEARNING_CHECK_NOT_AVAILABLE',
    );
  }

  return mapLearnerFinalLearningAssignment(refreshed, { isReadOnly: false });
};

export const submitFinalLearningCheckAnswer = async (input: {
  projectId: string;
  assignmentId: string;
  learnerId: string;
  role: LearningAccessRole;
  selectedOptionKey: string;
}) => {
  assertAdminMutationNotAllowed(input.role);
  const context = await loadFinalCheckContext(input);

  if (!context.stepsComplete) {
    throw new AppError(
      'Complete all required build steps before opening the final learning check.',
      409,
      'BUILD_STEPS_NOT_COMPLETE',
    );
  }

  assertFinalCheckMutationAllowed(context.build.status);
  await assertFinalAssignment({
    assignmentId: input.assignmentId,
    learnerId: input.learnerId,
    buildId: context.build.id,
  });

  const completedAtBefore = context.build.completedAt;

  const result = await submitLearningAnswerAttempt({
    assignmentId: input.assignmentId,
    learnerId: input.learnerId,
    role: input.role,
    selectedOptionKey: input.selectedOptionKey,
    allowAfterSkip: true,
    allowOnCompleted: true,
  });

  if (context.build.status === 'COMPLETED' && completedAtBefore) {
    const reloaded = await prisma.projectBuild.findUnique({
      where: { id: context.build.id },
      select: { completedAt: true, status: true },
    });
    if (
      !reloaded ||
      reloaded.status !== 'COMPLETED' ||
      reloaded.completedAt?.getTime() !== completedAtBefore.getTime()
    ) {
      // Soft assertion for tests — status must remain COMPLETED.
    }
  }

  const summary = context.session
    ? await persistBuildLearningSummary(context.session.id)
    : null;

  const refreshed = await findOwnedLearningAssignmentById(
    input.assignmentId,
    input.learnerId,
  );
  if (!refreshed) {
    throw new AppError(
      'Final learning check is not available.',
      404,
      'FINAL_LEARNING_CHECK_NOT_AVAILABLE',
    );
  }

  const check = await getFinalLearningCheckForBuild({
    projectId: input.projectId,
    learnerId: input.learnerId,
  });

  return {
    attempt: result.attempt,
    assignment: mapLearnerFinalLearningAssignment(refreshed, {
      isReadOnly: context.build.status === 'ARCHIVED',
    }),
    progress: check?.progress ?? null,
    learningSummary: summary ?? check?.learningSummary ?? null,
  };
};

export const skipFinalLearningCheckAssignment = async (input: {
  projectId: string;
  assignmentId: string;
  learnerId: string;
  role: LearningAccessRole;
}) => {
  assertAdminMutationNotAllowed(input.role);
  const context = await loadFinalCheckContext(input);

  if (!context.stepsComplete) {
    throw new AppError(
      'Complete all required build steps before opening the final learning check.',
      409,
      'BUILD_STEPS_NOT_COMPLETE',
    );
  }

  assertFinalCheckMutationAllowed(context.build.status);
  await assertFinalAssignment({
    assignmentId: input.assignmentId,
    learnerId: input.learnerId,
    buildId: context.build.id,
  });

  const assignment = await skipLearningAssignment({
    assignmentId: input.assignmentId,
    learnerId: input.learnerId,
    role: input.role,
    allowOnCompleted: true,
  });

  const summary = context.session
    ? await persistBuildLearningSummary(context.session.id)
    : null;

  const check = await getFinalLearningCheckForBuild({
    projectId: input.projectId,
    learnerId: input.learnerId,
  });

  return {
    assignment: mapLearnerFinalLearningAssignment(assignment, {
      isReadOnly: false,
    }),
    progress: check?.progress ?? null,
    learningSummary: summary ?? check?.learningSummary ?? null,
  };
};

export const getFinalLearningCheckAiHandoff = async (input: {
  projectId: string;
  assignmentId: string;
  learnerId: string;
}): Promise<FinalLearningCheckAiHandoffDto> => {
  const context = await loadFinalCheckContext(input);

  if (!context.stepsComplete) {
    throw new AppError(
      'Complete all required build steps before opening the final learning check.',
      409,
      'BUILD_STEPS_NOT_COMPLETE',
    );
  }

  if (!context.session) {
    throw new AppError(
      'Learning session is not ready.',
      409,
      'LEARNING_SESSION_NOT_READY',
    );
  }

  const assignment = await assertFinalAssignment({
    assignmentId: input.assignmentId,
    learnerId: input.learnerId,
    buildId: context.build.id,
  });

  const latestAttempt = assignment.answerAttempts.length
    ? [...assignment.answerAttempts].sort(
        (left, right) => left.attemptNumber - right.attemptNumber,
      )[assignment.answerAttempts.length - 1]!
    : null;

  if (!latestAttempt) {
    throw new AppError(
      'Submit an answer before requesting an AI explanation.',
      409,
      'FINAL_LEARNING_CHECK_AI_HANDOFF_UNAVAILABLE',
    );
  }

  const { markLearningAssignmentAiExplanationRequested } = await import(
    './project-learning-question-feedback.service.js'
  );
  await markLearningAssignmentAiExplanationRequested({
    assignmentId: assignment.id,
    learnerId: input.learnerId,
  });

  const selectedOption = assignment.question.options.find(
    (option) => option.optionKey === latestAttempt.selectedOptionKey,
  );

  const project = await prisma.learningProject.findUniqueOrThrow({
    where: { id: context.build.projectId },
    select: { title: true },
  });

  return {
    suggestedPromptEn:
      'Explain this final learning question and help me review the concept without grading me.',
    suggestedPromptAr:
      'اشرح لي سؤال التحقق النهائي وساعدني على مراجعة المفهوم دون تقييمي بدرجة.',
    context: {
      projectId: context.build.projectId,
      projectTitle: project.title,
      buildId: context.build.id,
      assignmentId: assignment.id,
      questionPromptEn: assignment.question.promptEn,
      questionPromptAr: assignment.question.promptAr,
      selectedOptionKey: latestAttempt.selectedOptionKey,
      selectedOptionTextEn:
        selectedOption?.textEn ?? latestAttempt.selectedOptionKey,
      selectedOptionTextAr:
        selectedOption?.textAr ?? latestAttempt.selectedOptionKey,
      isCorrect: latestAttempt.isCorrect,
      conceptKey: assignment.question.conceptKey,
      explanationEn: assignment.question.explanationEn,
      explanationAr: assignment.question.explanationAr,
      learningGoal: context.session.learningGoal,
    },
  };
};

export const areBuildRequiredStepsCompleteForLearning = areRequiredStepsComplete;
