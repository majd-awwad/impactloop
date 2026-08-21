import type { Request, Response } from 'express';

import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { readValidatedParams, readValidatedQuery } from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';
import { findOwnedBuildById } from '../learning-projects/project-build-lifecycle.js';
import { updateLearningCompletionReflection } from '../project-learning/learning-completion-reflection.service.js';
import type { CompletionReflectionBody } from '../project-learning/project-learning.validation.js';

import {
  archiveLearnerBuild,
  getLearnerBuildDetail,
  getLearnerBuildsList,
  getLearnerPortfolio,
  pauseLearnerBuild,
  resumeLearnerBuild,
} from './learner-builds.service.js';
import type { ListLearnerBuildsQuery } from './learner-builds.validation.js';
import {
  addProjectBuildCompletionPhoto,
  deleteProjectBuildCompletionPhoto,
  getProjectBuildCompletionPhotoForDownload,
  getProjectBuildCompletionStory,
  upsertProjectBuildCompletionStory,
} from '../learning-projects/project-build-completion-story.js';
import type { UpdateProjectBuildNotebookInput } from './learner-build-notebook.validation.js';
import {
  getProjectBuildNotebook,
  upsertProjectBuildNotebook,
} from './project-build-notebook.js';

export const listLearnerBuildsHandler = async (req: Request, res: Response) => {
  const query = readValidatedQuery<ListLearnerBuildsQuery>(req);
  const result = await getLearnerBuildsList({
    learnerId: req.auth!.sub,
    status: query.status,
    page: query.page,
    limit: query.limit,
  });

  res.json(successResponse('Learner builds fetched successfully', result));
};

export const getLearnerPortfolioHandler = async (req: Request, res: Response) => {
  const query = readValidatedQuery<ListLearnerBuildsQuery>(req);
  const result = await getLearnerPortfolio({
    learnerId: req.auth!.sub,
    page: query.page,
    limit: query.limit,
  });

  res.json(successResponse('Learner portfolio fetched successfully', result));
};

export const getLearnerBuildHandler = async (req: Request, res: Response) => {
  const { buildId } = readValidatedParams<{ buildId: string }>(req);
  const build = await getLearnerBuildDetail(buildId, req.auth!.sub);

  if (!build) {
    res.status(404).json({
      success: false,
      message: 'Project build not found.',
      error: { code: 'BUILD_NOT_FOUND', requestId: 'unknown' },
    });
    return;
  }

  res.json(successResponse('Project build fetched successfully', build));
};

export const pauseLearnerBuildHandler = async (req: Request, res: Response) => {
  const { buildId } = readValidatedParams<{ buildId: string }>(req);
  const build = await pauseLearnerBuild(buildId, req.auth!.sub);
  res.json(successResponse('Build paused successfully', build));
};

export const resumeLearnerBuildHandler = async (req: Request, res: Response) => {
  const { buildId } = readValidatedParams<{ buildId: string }>(req);
  const build = await resumeLearnerBuild(buildId, req.auth!.sub);
  res.json(successResponse('Build resumed successfully', build));
};

export const archiveLearnerBuildHandler = async (req: Request, res: Response) => {
  const { buildId } = readValidatedParams<{ buildId: string }>(req);
  const build = await archiveLearnerBuild(buildId, req.auth!.sub);
  res.json(successResponse('Build archived successfully', build));
};

export const getCompletionStoryHandler = async (req: Request, res: Response) => {
  const { buildId } = readValidatedParams<{ buildId: string }>(req);
  const story = await getProjectBuildCompletionStory(buildId, req.auth!.sub);

  res.json(successResponse('Completion story fetched successfully', { story }));
};

export const updateCompletionStoryHandler = async (req: Request, res: Response) => {
  const { buildId } = readValidatedParams<{ buildId: string }>(req);
  const story = await upsertProjectBuildCompletionStory(
    buildId,
    req.auth!.sub,
    req.body,
  );

  res.json(successResponse('Completion story updated successfully', { story }));
};

export const updateLearnerBuildCompletionReflectionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { buildId } = readValidatedParams<{ buildId: string }>(req);
  const build = await findOwnedBuildById(buildId, req.auth!.sub);
  if (!build) {
    res.status(404).json({
      success: false,
      message: 'Project build not found.',
      error: { code: 'BUILD_NOT_FOUND', requestId: 'unknown' },
    });
    return;
  }

  const body = req.body as CompletionReflectionBody;
  const result = await updateLearningCompletionReflection({
    projectId: build.projectId,
    buildId: build.id,
    learnerId: req.auth!.sub,
    goalOutcome: body.goalOutcome,
    confidenceAfter: body.confidenceAfter,
    finalReflection: body.finalReflection,
  });

  res.json(
    successResponse('Learning completion reflection updated successfully', result),
  );
};

export const uploadCompletionPhotoHandler = async (req: Request, res: Response) => {
  const { buildId } = readValidatedParams<{ buildId: string }>(req);
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: 'Select an image to upload.',
      error: {
        code: COMMON_ERROR_CODES.validationError,
        requestId: 'unknown',
      },
    });
    return;
  }

  const photo = await addProjectBuildCompletionPhoto(
    buildId,
    req.auth!.sub,
    req.file,
    req.body.caption,
  );

  res.status(201).json(
    successResponse('Completion photo uploaded successfully', { photo }),
  );
};

export const deleteCompletionPhotoHandler = async (req: Request, res: Response) => {
  const { buildId, photoId } = readValidatedParams<{
    buildId: string;
    photoId: string;
  }>(req);
  await deleteProjectBuildCompletionPhoto(buildId, req.auth!.sub, photoId);

  res.status(204).send();
};

export const downloadCompletionPhotoHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { buildId, photoId } = readValidatedParams<{
    buildId: string;
    photoId: string;
  }>(req);

  const { image, contentDisposition } =
    await getProjectBuildCompletionPhotoForDownload(
      buildId,
      req.auth!.sub,
      photoId,
    );

  res.setHeader('Content-Type', image.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', contentDisposition);
  res.sendFile(image.absolutePath);
};

export const getProjectBuildNotebookHandler = async (req: Request, res: Response) => {
  const { buildId } = readValidatedParams<{ buildId: string }>(req);
  const notebook = await getProjectBuildNotebook(buildId, req.auth!.sub);

  res.json(successResponse('Project notebook fetched successfully', notebook));
};

export const updateProjectBuildNotebookHandler = async (
  req: Request,
  res: Response,
) => {
  const { buildId } = readValidatedParams<{ buildId: string }>(req);
  const body = req.body as UpdateProjectBuildNotebookInput;
  const notebook = await upsertProjectBuildNotebook(
    buildId,
    req.auth!.sub,
    body.content,
  );

  res.json(successResponse('Project notebook saved successfully', notebook));
};
