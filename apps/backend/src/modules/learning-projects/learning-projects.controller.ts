import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';
import { validateIdempotencyKey } from '../../services/idempotency.service.js';

import {
  deleteLearningProjectReviewById,
  followLearningProjectById,
  getBuildItemMaterialCandidatesById,
  getFollowedLearningProjects,
  getLearningProjectById,
  getLearningProjects,
  getMyLearningProjectSubmissionById,
  getMyLearningProjectSubmissions,
  completeProjectBuildStepById,
  getOrCreateBuildGuideConversationByProjectId,
  createAiAuthoringDraftForLearner,
  getOrCreateAuthoringConversationForDraft,
  getMyProjectBuildById,
  getSavedLearningProjects,
  likeLearningProjectById,
  linkBuildItemMaterialById,
  linkBuildItemReservationById,
  reviewLearningProjectById,
  resubmitMyLearningProjectSubmissionById,
  saveLearningProjectById,
  startProjectBuildById,
  submitLearningProjectForReview,
  submitMyLearningProjectDraftById,
  unlikeLearningProjectById,
  unfollowLearningProjectById,
  unlinkBuildItemMaterialById,
  removeAcquiredMaterialFromBuildItemById,
  unsaveLearningProjectById,
  updateMyLearningProjectSubmissionById,
  updateProjectBuildItemById,
} from './learning-projects.service.js';
import type {
  CreateAiAuthoringDraftInput,
  LearningProjectsQuery,
  MyLearningProjectsQuery,
  ProjectReviewInput,
  SubmitLearningProjectInput,
  UpdateMyLearningProjectSubmissionInput,
  UpdateProjectBuildItemInput,
} from './learning-projects.validation.js';
import {
  authoringConversationSchema,
  buildGuideConversationSchema,
  createAiAuthoringDraftSchema,
} from './learning-projects.validation.js';

export const listLearningProjects = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projects = await getLearningProjects(
    readValidatedQuery<LearningProjectsQuery>(req),
    req.auth,
  );

  res.json(successResponse('Learning projects fetched successfully', projects));
};

export const listSavedLearningProjects = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projects = await getSavedLearningProjects(
    readValidatedQuery<LearningProjectsQuery>(req),
    req.auth!,
  );

  res.json(
    successResponse('Saved learning projects fetched successfully', projects),
  );
};

export const listFollowedLearningProjects = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projects = await getFollowedLearningProjects(
    readValidatedQuery<LearningProjectsQuery>(req),
    req.auth!,
  );

  res.json(
    successResponse('Followed learning projects fetched successfully', projects),
  );
};

export const listMyLearningProjectSubmissions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projects = await getMyLearningProjectSubmissions(
    readValidatedQuery<MyLearningProjectsQuery>(req),
    req.auth!.sub,
  );

  res.json(
    successResponse('Learning project submissions fetched successfully', projects),
  );
};

export const getMyLearningProjectSubmission = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const project = await getMyLearningProjectSubmissionById(id, req.auth!.sub);

  res.json(
    successResponse('Learning project submission fetched successfully', project),
  );
};

export const updateMyLearningProjectSubmission = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const project = await updateMyLearningProjectSubmissionById(
    id,
    req.auth!.sub,
    req.body as UpdateMyLearningProjectSubmissionInput,
  );

  res.json(
    successResponse('Learning project submission updated successfully', project),
  );
};

export const resubmitMyLearningProjectSubmission = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const project = await resubmitMyLearningProjectSubmissionById(
    id,
    req.auth!.sub,
  );

  res.json(
    successResponse('Learning project submission resubmitted successfully', project),
  );
};

export const submitMyLearningProjectDraft = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const idempotencyKey = validateIdempotencyKey(req.get('Idempotency-Key'));
  const result = await submitMyLearningProjectDraftById(
    id,
    req.auth!.sub,
    idempotencyKey,
  );

  res.json(
    successResponse('Project submitted for review.', result.response),
  );
};

export const getLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const project = await getLearningProjectById(id, req.auth);

  res.json(successResponse('Learning project fetched successfully', project));
};

export const getMyProjectBuild = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const build = await getMyProjectBuildById(id, req.auth!.sub);

  res.json(successResponse('Project build fetched successfully', build));
};

export const completeProjectBuildStep = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id, stepId } = readValidatedParams<{ id: string; stepId: string }>(
    req,
  );
  const build = await completeProjectBuildStepById(id, req.auth!.sub, stepId);

  res.json(successResponse('Build step completed successfully', build));
};

export const getOrCreateBuildGuideConversation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const body = buildGuideConversationSchema.parse(req.body ?? {});
  const payload = await getOrCreateBuildGuideConversationByProjectId(
    id,
    req.auth!.sub,
    body.locale ?? 'en',
  );

  res.json(successResponse('Build guide conversation ready', payload));
};

export const startProjectBuild = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const build = await startProjectBuildById(id, req.auth!.sub);

  res.json(successResponse('Project build ready', build));
};

export const updateProjectBuildItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id, itemId } = readValidatedParams<{ id: string; itemId: string }>(
    req,
  );
  const build = await updateProjectBuildItemById(
    id,
    req.auth!.sub,
    itemId,
    req.body as UpdateProjectBuildItemInput,
  );

  res.json(successResponse('Project build item updated successfully', build));
};

export const getBuildItemMaterialCandidates = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id, itemId } = readValidatedParams<{ id: string; itemId: string }>(
    req,
  );
  const result = await getBuildItemMaterialCandidatesById(
    id,
    req.auth!.sub,
    itemId,
  );

  res.json(
    successResponse('Material candidates fetched successfully', result),
  );
};

export const linkBuildItemMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id, itemId } = readValidatedParams<{ id: string; itemId: string }>(
    req,
  );
  const { materialId } = req.body as { materialId: string };
  const build = await linkBuildItemMaterialById(
    id,
    req.auth!.sub,
    itemId,
    materialId,
  );

  res.json(successResponse('Material linked successfully', build));
};

export const unlinkBuildItemMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id, itemId } = readValidatedParams<{ id: string; itemId: string }>(
    req,
  );
  const build = await unlinkBuildItemMaterialById(id, req.auth!.sub, itemId);

  res.json(successResponse('Material unlinked successfully', build));
};

export const removeAcquiredBuildItemAllocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id, itemId } = readValidatedParams<{ id: string; itemId: string }>(
    req,
  );
  const { materialId, reservationId } = req.body as {
    materialId: string;
    reservationId: string;
  };
  const result = await removeAcquiredMaterialFromBuildItemById(
    id,
    req.auth!.sub,
    itemId,
    { materialId, reservationId },
  );

  res.json(
    successResponse('Acquired material allocation removed', {
      outcome: result.outcome,
      build: result.build,
    }),
  );
};

export const linkBuildItemReservation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id, itemId } = readValidatedParams<{ id: string; itemId: string }>(
    req,
  );
  const { reservationId } = req.body as { reservationId: string };
  const build = await linkBuildItemReservationById(
    id,
    req.auth!.sub,
    itemId,
    reservationId,
  );

  res.json(successResponse('Reservation linked successfully', build));
};

export const likeLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await likeLearningProjectById(id, req.auth!.sub);

  res.json(successResponse('Learning project liked successfully', result));
};

export const unlikeLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await unlikeLearningProjectById(id, req.auth!.sub);

  res.json(successResponse('Learning project unliked successfully', result));
};

export const saveLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await saveLearningProjectById(id, req.auth!.sub);

  res.json(successResponse('Learning project saved successfully', result));
};

export const unsaveLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await unsaveLearningProjectById(id, req.auth!.sub);

  res.json(successResponse('Learning project unsaved successfully', result));
};

export const followLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await followLearningProjectById(id, req.auth!.sub);

  res.json(successResponse('Learning project followed successfully', result));
};

export const unfollowLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await unfollowLearningProjectById(id, req.auth!.sub);

  res.json(successResponse('Learning project unfollowed successfully', result));
};

export const reviewLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await reviewLearningProjectById(
    id,
    req.auth!.sub,
    req.body as ProjectReviewInput,
  );

  res.json(successResponse('Learning project review saved successfully', result));
};

export const deleteLearningProjectReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await deleteLearningProjectReviewById(id, req.auth!.sub);

  res.json(successResponse('Learning project review deleted successfully', result));
};

export const submitLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const body = req.body as SubmitLearningProjectInput;
  const userId = req.auth!.sub;
  const idempotencyKey = validateIdempotencyKey(req.get('Idempotency-Key'));
  const result = await submitLearningProjectForReview(
    userId,
    body,
    idempotencyKey,
  );
  res
    .status(result.replayed ? 200 : 201)
    .json(successResponse(result.response.message, result.response));
};

export const createAiAuthoringDraft = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const body = req.body as CreateAiAuthoringDraftInput;
  const idempotencyKey = validateIdempotencyKey(req.get('Idempotency-Key'));
  const result = await createAiAuthoringDraftForLearner(
    req.auth!.sub,
    body,
    idempotencyKey,
  );

  res
    .status(result.replayed ? 200 : 201)
    .json(
      successResponse('AI authoring draft created successfully.', result.response),
    );
};

export const getOrCreateAuthoringConversation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const body = req.body as { locale?: 'en' | 'ar' };
  const data = await getOrCreateAuthoringConversationForDraft(
    id,
    req.auth!.sub,
    body.locale ?? 'en',
  );

  res.json(successResponse('Authoring conversation ready.', data));
};
