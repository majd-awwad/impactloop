import type { Request, Response } from 'express';

import { readValidatedParams } from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';

import {
  getOwnedLearningSessionForBuild,
  skipLearningAssignmentForLearner,
  submitLearningAnswerAttempt,
  updateLearningSessionPreferences,
  viewLearningAssignmentHint,
} from './build-learning-session.service.js';
import {
  resolveLearningSetupMetadataForBuild,
  setupLearningSessionForBuild,
} from './build-learning-session-setup.service.js';
import {
  getStepLearningCheckAiHandoff,
  getStepLearningCheckForBuild,
  skipStepLearningCheck,
  submitStepLearningCheckAnswer,
  viewStepLearningCheckHint,
} from './step-learning-check.service.js';
import {
  getFinalLearningCheckAiHandoff,
  getFinalLearningCheckForBuild,
  skipFinalLearningCheckAssignment,
  submitFinalLearningCheckAnswer,
  viewFinalLearningCheckHint,
} from './final-learning-check.service.js';
import { updateLearningCompletionReflection } from './learning-completion-reflection.service.js';
import type {
  CompletionReflectionBody,
  SetupLearningSessionBody,
  SubmitLearningAnswerBody,
  UpdateLearningSessionBody,
} from './project-learning.validation.js';
import { findProjectBuild } from '../learning-projects/learning-projects.repository.js';

const resolveOwnedBuildId = async (projectId: string, learnerId: string) => {
  const build = await findProjectBuild(projectId, learnerId);
  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  return build.id;
};

const noStoreLearningHeaders = (res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
};

export const getMyBuildLearningSession = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId } = readValidatedParams<{ id: string }>(req);
  const learnerId = req.auth!.sub;
  const buildId = await resolveOwnedBuildId(projectId, learnerId);
  const session = await getOwnedLearningSessionForBuild(buildId, learnerId);
  const learningSetup = await resolveLearningSetupMetadataForBuild({
    buildId,
    learnerId,
  });

  res.json(
    successResponse('Learning session fetched successfully', {
      session,
      learningSetup,
    }),
  );
};

export const setupMyBuildLearningSession = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId } = readValidatedParams<{ id: string }>(req);
  const body = req.body as SetupLearningSessionBody;
  const learnerId = req.auth!.sub;
  const buildId = await resolveOwnedBuildId(projectId, learnerId);

  const result = await setupLearningSessionForBuild({
    buildId,
    learnerId,
    learningGoal: body.learningGoal,
    confidenceBefore: body.confidenceBefore,
  });

  res.json(
    successResponse('Learning session setup completed', {
      status: result.status,
      session: result.status === 'READY' ? result.session : null,
      learningSetup: result.setup,
    }),
  );
};

export const updateMyBuildLearningSession = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId } = readValidatedParams<{ id: string }>(req);
  const body = req.body as UpdateLearningSessionBody;
  const learnerId = req.auth!.sub;
  const buildId = await resolveOwnedBuildId(projectId, learnerId);

  const session = await updateLearningSessionPreferences({
    buildId,
    learnerId,
    learningGoal: body.learningGoal,
    confidenceBefore: body.confidenceBefore,
  });

  res.json(successResponse('Learning session updated successfully', session));
};

export const submitMyBuildLearningAnswer = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { assignmentId } = readValidatedParams<{ assignmentId: string }>(req);
  const body = req.body as SubmitLearningAnswerBody;

  const result = await submitLearningAnswerAttempt({
    assignmentId,
    learnerId: req.auth!.sub,
    role: 'LEARNER',
    selectedOptionKey: body.selectedOptionKey,
  });

  res.json(successResponse('Learning answer submitted successfully', result));
};

export const skipMyBuildLearningAssignment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { assignmentId } = readValidatedParams<{ assignmentId: string }>(req);

  const assignment = await skipLearningAssignmentForLearner({
    assignmentId,
    learnerId: req.auth!.sub,
    role: 'LEARNER',
  });

  res.json(successResponse('Learning assignment skipped successfully', assignment));
};

export const viewMyBuildLearningHint = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { assignmentId } = readValidatedParams<{ assignmentId: string }>(req);

  const assignment = await viewLearningAssignmentHint({
    assignmentId,
    learnerId: req.auth!.sub,
    role: 'LEARNER',
  });

  res.json(successResponse('Learning hint viewed successfully', assignment));
};

export const getMyBuildStepLearningCheck = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId, stepId } = readValidatedParams<{
    id: string;
    stepId: string;
  }>(req);
  noStoreLearningHeaders(res);

  const check = await getStepLearningCheckForBuild({
    projectId,
    stepId,
    learnerId: req.auth!.sub,
  });

  res.json(successResponse('Step learning check fetched successfully', { check }));
};

export const viewMyBuildStepLearningCheckHint = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId, stepId } = readValidatedParams<{
    id: string;
    stepId: string;
  }>(req);
  noStoreLearningHeaders(res);

  const check = await viewStepLearningCheckHint({
    projectId,
    stepId,
    learnerId: req.auth!.sub,
    role: 'LEARNER',
  });

  res.json(successResponse('Step learning hint viewed successfully', { check }));
};

export const submitMyBuildStepLearningCheckAnswer = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId, stepId } = readValidatedParams<{
    id: string;
    stepId: string;
  }>(req);
  const body = req.body as SubmitLearningAnswerBody;
  noStoreLearningHeaders(res);

  const result = await submitStepLearningCheckAnswer({
    projectId,
    stepId,
    learnerId: req.auth!.sub,
    role: 'LEARNER',
    selectedOptionKey: body.selectedOptionKey,
  });

  res.json(successResponse('Step learning answer submitted successfully', result));
};

export const skipMyBuildStepLearningCheck = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId, stepId } = readValidatedParams<{
    id: string;
    stepId: string;
  }>(req);
  noStoreLearningHeaders(res);

  const check = await skipStepLearningCheck({
    projectId,
    stepId,
    learnerId: req.auth!.sub,
    role: 'LEARNER',
  });

  res.json(successResponse('Step learning check skipped successfully', { check }));
};

export const getMyBuildStepLearningCheckAiHandoff = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId, stepId } = readValidatedParams<{
    id: string;
    stepId: string;
  }>(req);
  noStoreLearningHeaders(res);

  const handoff = await getStepLearningCheckAiHandoff({
    projectId,
    stepId,
    learnerId: req.auth!.sub,
    locale: typeof req.query.locale === 'string' ? req.query.locale : null,
  });

  res.json(successResponse('Step learning AI handoff prepared successfully', handoff));
};

export const getMyBuildFinalLearningCheck = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId } = readValidatedParams<{ id: string }>(req);
  noStoreLearningHeaders(res);

  const check = await getFinalLearningCheckForBuild({
    projectId,
    learnerId: req.auth!.sub,
  });

  res.json(successResponse('Final learning check fetched successfully', { check }));
};

export const viewMyBuildFinalLearningCheckHint = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId, assignmentId } = readValidatedParams<{
    id: string;
    assignmentId: string;
  }>(req);
  noStoreLearningHeaders(res);

  const assignment = await viewFinalLearningCheckHint({
    projectId,
    assignmentId,
    learnerId: req.auth!.sub,
    role: 'LEARNER',
  });

  res.json(
    successResponse('Final learning hint viewed successfully', { assignment }),
  );
};

export const submitMyBuildFinalLearningCheckAnswer = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId, assignmentId } = readValidatedParams<{
    id: string;
    assignmentId: string;
  }>(req);
  const body = req.body as SubmitLearningAnswerBody;
  noStoreLearningHeaders(res);

  const result = await submitFinalLearningCheckAnswer({
    projectId,
    assignmentId,
    learnerId: req.auth!.sub,
    role: 'LEARNER',
    selectedOptionKey: body.selectedOptionKey,
  });

  res.json(successResponse('Final learning answer submitted successfully', result));
};

export const skipMyBuildFinalLearningCheckAssignment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId, assignmentId } = readValidatedParams<{
    id: string;
    assignmentId: string;
  }>(req);
  noStoreLearningHeaders(res);

  const result = await skipFinalLearningCheckAssignment({
    projectId,
    assignmentId,
    learnerId: req.auth!.sub,
    role: 'LEARNER',
  });

  res.json(successResponse('Final learning assignment skipped successfully', result));
};

export const getMyBuildFinalLearningCheckAiHandoff = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId, assignmentId } = readValidatedParams<{
    id: string;
    assignmentId: string;
  }>(req);
  noStoreLearningHeaders(res);

  const handoff = await getFinalLearningCheckAiHandoff({
    projectId,
    assignmentId,
    learnerId: req.auth!.sub,
  });

  res.json(
    successResponse('Final learning AI handoff prepared successfully', handoff),
  );
};

export const updateMyBuildLearningCompletionReflection = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: projectId } = readValidatedParams<{ id: string }>(req);
  const body = req.body as CompletionReflectionBody;
  noStoreLearningHeaders(res);

  const result = await updateLearningCompletionReflection({
    projectId,
    learnerId: req.auth!.sub,
    goalOutcome: body.goalOutcome,
    confidenceAfter: body.confidenceAfter,
    finalReflection: body.finalReflection,
  });

  res.json(
    successResponse('Learning completion reflection updated successfully', result),
  );
};

export const reportMyBuildLearningAssignmentUnclear = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { assignmentId } = readValidatedParams<{ assignmentId: string }>(req);
  noStoreLearningHeaders(res);

  const { reportLearningAssignmentUnclear } = await import(
    './project-learning-question-feedback.service.js'
  );
  const result = await reportLearningAssignmentUnclear({
    assignmentId,
    learnerId: req.auth!.sub,
    role: 'LEARNER',
  });

  res.json(successResponse('Unclear question reported successfully', result));
};

export const clearMyBuildLearningAssignmentUnclear = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { assignmentId } = readValidatedParams<{ assignmentId: string }>(req);
  noStoreLearningHeaders(res);

  const { clearLearningAssignmentUnclearReport } = await import(
    './project-learning-question-feedback.service.js'
  );
  const result = await clearLearningAssignmentUnclearReport({
    assignmentId,
    learnerId: req.auth!.sub,
    role: 'LEARNER',
  });

  res.json(successResponse('Unclear question report cleared successfully', result));
};
