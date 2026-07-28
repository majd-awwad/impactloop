import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  createComment,
  deleteOwnComment,
  listCommentReplies,
  listRootComments,
  moderateComment,
  updateComment,
  type CommentTargetKind,
} from './comments.service.js';
import type {
  CommentsListQuery,
  CreateCommentInput,
  UpdateCommentInput,
} from './comments.validation.js';

const targetKindFromPath = (req: Request): CommentTargetKind => {
  if (req.baseUrl.includes('learning-projects')) {
    return 'learningProject';
  }

  return 'material';
};

export const listCommentsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const query = readValidatedQuery<CommentsListQuery>(req);
  const result = await listRootComments(
    targetKindFromPath(req),
    id,
    query,
    req.auth,
  );

  res.json(successResponse('Comments fetched successfully', result));
};

export const listCommentRepliesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id, commentId } = readValidatedParams<{
    id: string;
    commentId: string;
  }>(req);
  const query = readValidatedQuery<CommentsListQuery>(req);
  const result = await listCommentReplies(
    targetKindFromPath(req),
    id,
    commentId,
    query,
    req.auth,
  );

  res.json(successResponse('Comment replies fetched successfully', result));
};

export const createCommentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const comment = await createComment(
    targetKindFromPath(req),
    id,
    req.body as CreateCommentInput,
    req.auth,
  );

  res.status(201).json(successResponse('Comment created successfully', comment));
};

export const updateCommentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id, commentId } = readValidatedParams<{
    id: string;
    commentId: string;
  }>(req);
  const comment = await updateComment(
    targetKindFromPath(req),
    id,
    commentId,
    req.body as UpdateCommentInput,
    req.auth,
  );

  res.json(successResponse('Comment updated successfully', comment));
};

export const deleteCommentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id, commentId } = readValidatedParams<{
    id: string;
    commentId: string;
  }>(req);
  const comment = await deleteOwnComment(
    targetKindFromPath(req),
    id,
    commentId,
    req.auth,
  );

  res.json(successResponse('Comment deleted successfully', comment));
};

export const moderateCommentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const comment = await moderateComment(id, req.auth);

  res.json(successResponse('Comment removed successfully', comment));
};
