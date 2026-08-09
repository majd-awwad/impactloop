import type { ProjectBuildStatus } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import { findProjectBuild } from '../learning-projects/learning-projects.repository.js';
import {
  findOwnedStepLearningAssignment,
  learningAssignmentDetailInclude,
  type StepLearningAssignmentRecord,
} from './build-learning-session.repository.js';
import {
  skipLearningAssignment,
  submitLearningAnswerAttempt,
  viewLearningAssignmentHint,
} from './build-learning-session.service.js';
import {
  mapLearnerStepLearningCheck,
  type StepLearningCheckAiHandoffDto,
  type LearnerStepLearningCheckDto,
} from './project-learning-step-check.dto.js';
import {
  assertAdminMutationNotAllowed,
  assertRoleCanMutateLearningSession,
  type LearningAccessRole,
} from './project-learning.authorization.js';
import {
  mapLearnerLearningAnswerAttempt,
  mapLearnerLearningAssignment,
} from './project-learning.dto.js';

const MUTABLE_BUILD_STATUSES = new Set<ProjectBuildStatus>([
  'IN_PROGRESS',
  'PAUSED',
]);

const assertBuildAllowsStepCheckMutation = (buildStatus: ProjectBuildStatus) => {
  if (buildStatus === 'ARCHIVED') {
    throw new AppError(
      'Step learning check is locked for archived builds.',
      409,
      'BUILD_LEARNING_CHECK_LOCKED',
    );
  }

  if (buildStatus === 'COMPLETED') {
    throw new AppError(
      'Step learning check is read-only for completed builds.',
      409,
      'BUILD_LEARNING_CHECK_LOCKED',
    );
  }

  if (!MUTABLE_BUILD_STATUSES.has(buildStatus)) {
    throw new AppError(
      'Step learning check is not available for this build.',
      409,
      'STEP_LEARNING_CHECK_NOT_AVAILABLE',
    );
  }
};

const loadStepLearningCheckContext = async (input: {
  projectId: string;
  stepId: string;
  learnerId: string;
}) => {
  const build = await findProjectBuild(input.projectId, input.learnerId);
  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  const step = await prisma.projectStep.findFirst({
    where: {
      id: input.stepId,
      projectId: build.projectId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      stepNumber: true,
    },
  });

  if (!step) {
    throw new AppError('Project step not found.', 404, 'PROJECT_STEP_NOT_FOUND');
  }

  const stepProgress = await prisma.projectBuildStepProgress.findUnique({
    where: {
      buildId_projectStepId: {
        buildId: build.id,
        projectStepId: step.id,
      },
    },
    select: {
      completedAt: true,
    },
  });

  const isStepCompleted = stepProgress?.completedAt != null;

  const assignment = await findOwnedStepLearningAssignment({
    buildId: build.id,
    learnerId: input.learnerId,
    projectStepId: input.stepId,
  });

  return {
    build,
    step,
    isStepCompleted,
    assignment,
  };
};

const assertStepCheckAccessible = (input: {
  assignment: StepLearningAssignmentRecord | null;
  isStepCompleted: boolean;
}) => {
  if (!input.assignment) {
    throw new AppError(
      'Step learning check is not available.',
      404,
      'STEP_LEARNING_CHECK_NOT_AVAILABLE',
    );
  }

  if (input.assignment.stage !== 'STEP') {
    throw new AppError(
      'Learning assignment stage mismatch.',
      409,
      'LEARNING_ASSIGNMENT_STAGE_MISMATCH',
    );
  }

  if (input.assignment.projectStepId !== input.assignment.question.projectStepId) {
    throw new AppError(
      'Learning assignment step mismatch.',
      409,
      'LEARNING_ASSIGNMENT_STEP_MISMATCH',
    );
  }

  if (!input.isStepCompleted) {
    throw new AppError(
      'Complete this step before opening the learning check.',
      409,
      'STEP_NOT_COMPLETED',
    );
  }
};

const mapStepCheck = (
  assignment: StepLearningAssignmentRecord,
  stepId: string,
  buildStatus: ProjectBuildStatus,
): LearnerStepLearningCheckDto =>
  mapLearnerStepLearningCheck(assignment, {
    stepId,
    isReadOnly: buildStatus === 'COMPLETED' || buildStatus === 'ARCHIVED',
  });

export const getStepLearningCheckForBuild = async (input: {
  projectId: string;
  stepId: string;
  learnerId: string;
}): Promise<LearnerStepLearningCheckDto | null> => {
  const context = await loadStepLearningCheckContext(input);

  if (!context.assignment) {
    return null;
  }

  if (!context.isStepCompleted) {
    throw new AppError(
      'Complete this step before opening the learning check.',
      409,
      'STEP_NOT_COMPLETED',
    );
  }

  if (context.assignment.stage !== 'STEP') {
    throw new AppError(
      'Learning assignment stage mismatch.',
      409,
      'LEARNING_ASSIGNMENT_STAGE_MISMATCH',
    );
  }

  if (context.assignment.projectStepId !== input.stepId) {
    throw new AppError(
      'Learning assignment step mismatch.',
      409,
      'LEARNING_ASSIGNMENT_STEP_MISMATCH',
    );
  }

  return mapStepCheck(
    context.assignment,
    input.stepId,
    context.build.status,
  );
};

export const viewStepLearningCheckHint = async (input: {
  projectId: string;
  stepId: string;
  learnerId: string;
  role: LearningAccessRole;
}) => {
  assertAdminMutationNotAllowed(input.role);

  const context = await loadStepLearningCheckContext(input);
  assertBuildAllowsStepCheckMutation(context.build.status);
  assertStepCheckAccessible({
    assignment: context.assignment,
    isStepCompleted: context.isStepCompleted,
  });

  const assignment = await viewLearningAssignmentHint({
    assignmentId: context.assignment!.id,
    learnerId: input.learnerId,
    role: input.role,
  });

  const refreshed = await findOwnedStepLearningAssignment({
    buildId: context.build.id,
    learnerId: input.learnerId,
    projectStepId: input.stepId,
  });

  if (!refreshed) {
    throw new AppError(
      'Step learning check is not available.',
      404,
      'STEP_LEARNING_CHECK_NOT_AVAILABLE',
    );
  }

  return mapLearnerStepLearningCheck(refreshed, {
    stepId: input.stepId,
    isReadOnly: false,
  });
};

export const submitStepLearningCheckAnswer = async (input: {
  projectId: string;
  stepId: string;
  learnerId: string;
  role: LearningAccessRole;
  selectedOptionKey: string;
}) => {
  assertAdminMutationNotAllowed(input.role);

  const context = await loadStepLearningCheckContext(input);
  assertBuildAllowsStepCheckMutation(context.build.status);
  assertStepCheckAccessible({
    assignment: context.assignment,
    isStepCompleted: context.isStepCompleted,
  });

  const assignment = context.assignment!;
  assertRoleCanMutateLearningSession({
    role: input.role,
    learnerId: input.learnerId,
    sessionLearnerId: assignment.session.build.learnerId,
  });

  const hasCorrect = assignment.answerAttempts.some((attempt) => attempt.isCorrect);
  if (hasCorrect) {
    const latestCorrect = assignment.answerAttempts.find((item) => item.isCorrect)!;
    return {
      attempt: mapLearnerLearningAnswerAttempt(latestCorrect),
      check: mapStepCheck(assignment, input.stepId, context.build.status),
    };
  }

  const result = await submitLearningAnswerAttempt({
    assignmentId: assignment.id,
    learnerId: input.learnerId,
    role: input.role,
    selectedOptionKey: input.selectedOptionKey,
    allowAfterSkip: assignment.stage === 'STEP',
  });

  const refreshed = await findOwnedStepLearningAssignment({
    buildId: context.build.id,
    learnerId: input.learnerId,
    projectStepId: input.stepId,
  });

  if (!refreshed) {
    throw new AppError(
      'Step learning check is not available.',
      404,
      'STEP_LEARNING_CHECK_NOT_AVAILABLE',
    );
  }

  return {
    attempt: result.attempt,
    check: mapStepCheck(refreshed, input.stepId, context.build.status),
  };
};

export const skipStepLearningCheck = async (input: {
  projectId: string;
  stepId: string;
  learnerId: string;
  role: LearningAccessRole;
}) => {
  assertAdminMutationNotAllowed(input.role);

  const context = await loadStepLearningCheckContext(input);
  assertBuildAllowsStepCheckMutation(context.build.status);
  assertStepCheckAccessible({
    assignment: context.assignment,
    isStepCompleted: context.isStepCompleted,
  });

  const assignment = await skipLearningAssignment({
    assignmentId: context.assignment!.id,
    learnerId: input.learnerId,
    role: input.role,
  });

  return mapLearnerStepLearningCheck(assignment, {
    stepId: input.stepId,
    isReadOnly: false,
  });
};

export const getStepLearningCheckAiHandoff = async (input: {
  projectId: string;
  stepId: string;
  learnerId: string;
  locale?: string | null;
}): Promise<StepLearningCheckAiHandoffDto> => {
  const context = await loadStepLearningCheckContext(input);
  assertStepCheckAccessible({
    assignment: context.assignment,
    isStepCompleted: context.isStepCompleted,
  });

  const assignment = context.assignment!;
  const latestAttempt = assignment.answerAttempts.length
    ? assignment.answerAttempts[assignment.answerAttempts.length - 1]!
    : null;

  if (!latestAttempt) {
    throw new AppError(
      'Submit an answer before requesting an AI explanation.',
      409,
      'STEP_LEARNING_CHECK_AI_HANDOFF_UNAVAILABLE',
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

  const suggestedPromptEn =
    'Explain why my answer to this step check was incorrect and help me understand the concept without changing my build progress.';
  const suggestedPromptAr =
    'اشرح لي لماذا كانت إجابتي في تحقق هذه الخطوة غير صحيحة، وساعدني على فهم المفهوم دون التأثير على تقدم المشروع.';

  return {
    suggestedPromptEn,
    suggestedPromptAr,
    context: {
      projectId: context.build.projectId,
      projectTitle: project.title,
      buildId: context.build.id,
      stepId: context.step.id,
      stepTitle: context.step.title,
      stepDescription: context.step.description,
      questionPromptEn: assignment.question.promptEn,
      questionPromptAr: assignment.question.promptAr,
      selectedOptionKey: latestAttempt.selectedOptionKey,
      selectedOptionTextEn: selectedOption?.textEn ?? latestAttempt.selectedOptionKey,
      selectedOptionTextAr: selectedOption?.textAr ?? latestAttempt.selectedOptionKey,
      isCorrect: latestAttempt.isCorrect,
      conceptKey: assignment.question.conceptKey,
      explanationEn: assignment.question.explanationEn,
      explanationAr: assignment.question.explanationAr,
    },
  };
};

export const getStepLearningChecksForSession = async (input: {
  buildId: string;
  learnerId: string;
  buildStatus: ProjectBuildStatus;
  completedStepIds: string[];
}) => {
  const session = await prisma.projectBuildLearningSession.findFirst({
    where: {
      buildId: input.buildId,
      build: { learnerId: input.learnerId },
    },
    include: {
      assignments: {
        where: { stage: 'STEP' },
        include: learningAssignmentDetailInclude,
      },
    },
  });

  if (!session) {
    return [];
  }

  const completedStepIds = new Set(input.completedStepIds);
  return session.assignments
    .filter(
      (assignment) =>
        assignment.projectStepId != null &&
        completedStepIds.has(assignment.projectStepId),
    )
    .map((assignment) =>
      mapLearnerStepLearningCheck(assignment, {
        stepId: assignment.projectStepId!,
        isReadOnly:
          input.buildStatus === 'COMPLETED' || input.buildStatus === 'ARCHIVED',
      }),
    );
};

export const mapLearnerLearningAssignmentForStep = mapLearnerLearningAssignment;
