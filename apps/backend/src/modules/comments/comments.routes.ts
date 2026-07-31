import { Router } from 'express';

import {
  authMiddleware,
  optionalAuthMiddleware,
} from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  createCommentHandler,
  deleteCommentHandler,
  listCommentRepliesHandler,
  listCommentsHandler,
  updateCommentHandler,
} from './comments.controller.js';
import {
  commentsListQuerySchema,
  commentTargetAndIdParamSchema,
  commentTargetParamSchema,
  createCommentSchema,
  updateCommentSchema,
} from './comments.validation.js';

export const attachCommentRoutes = (router: Router): void => {
  router.get(
    '/:id/comments',
    optionalAuthMiddleware,
    validate(commentTargetParamSchema, 'params'),
    validate(commentsListQuerySchema, 'query'),
    asyncHandler(listCommentsHandler),
  );

  router.get(
    '/:id/comments/:commentId/replies',
    optionalAuthMiddleware,
    validate(commentTargetAndIdParamSchema, 'params'),
    validate(commentsListQuerySchema, 'query'),
    asyncHandler(listCommentRepliesHandler),
  );

  router.post(
    '/:id/comments',
    authMiddleware,
    validate(commentTargetParamSchema, 'params'),
    validate(createCommentSchema),
    asyncHandler(createCommentHandler),
  );

  router.patch(
    '/:id/comments/:commentId',
    authMiddleware,
    validate(commentTargetAndIdParamSchema, 'params'),
    validate(updateCommentSchema),
    asyncHandler(updateCommentHandler),
  );

  router.delete(
    '/:id/comments/:commentId',
    authMiddleware,
    validate(commentTargetAndIdParamSchema, 'params'),
    asyncHandler(deleteCommentHandler),
  );
};
