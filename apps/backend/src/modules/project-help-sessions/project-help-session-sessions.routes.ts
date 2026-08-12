import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { privateNoStoreMiddleware } from '../../middlewares/cache-control.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  authorAcceptProjectHelpSessionOptionHandler,
  authorCancelProjectHelpSessionHandler,
  authorCompleteProjectHelpSessionHandler,
  authorDeclineProjectHelpSessionHandler,
  authorProposeProjectHelpSessionAlternativeHandler,
  authorRetryProjectHelpSessionZoomHandler,
  authorJoinProjectHelpSessionZoomHandler,
  authorReportProjectHelpSessionNoShowHandler,
  createProjectHelpSessionRequestHandler,
  getAuthorProjectHelpSessionHandler,
  getLearnerProjectHelpSessionHandler,
  learnerAcceptProjectHelpSessionAlternativeHandler,
  learnerCancelProjectHelpSessionHandler,
  learnerEnsureProjectHelpSessionNotebookPageHandler,
  learnerJoinProjectHelpSessionZoomHandler,
  learnerReportProjectHelpSessionNoShowHandler,
  learnerRejectProjectHelpSessionAlternativeHandler,
  listAuthorProjectHelpSessionsHandler,
  listLearnerProjectHelpSessionsHandler,
  listLearnerHelpSessionProjectOptionsHandler,
} from './project-help-session.controller.js';
import {
  acceptProjectHelpSessionOptionSchema,
  cancelProjectHelpSessionSchema,
  createProjectHelpSessionRequestSchema,
  declineProjectHelpSessionSchema,
  listAuthorProjectHelpSessionsQuerySchema,
  listLearnerProjectHelpSessionsQuerySchema,
  learnerHelpSessionProjectOptionsQuerySchema,
  projectHelpSessionBuildIdParamSchema,
  projectHelpSessionIdParamSchema,
  proposeProjectHelpSessionAlternativeSchema,
} from './project-help-session.validation.js';

export const projectHelpSessionsRouter = Router();

projectHelpSessionsRouter.get(
  '/learner/project-options',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerHelpSessionProjectOptionsQuerySchema, 'query'),
  asyncHandler(listLearnerHelpSessionProjectOptionsHandler),
);

projectHelpSessionsRouter.post(
  '/learner/builds/:buildId/request',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionBuildIdParamSchema, 'params'),
  validate(createProjectHelpSessionRequestSchema),
  asyncHandler(createProjectHelpSessionRequestHandler),
);

projectHelpSessionsRouter.get(
  '/learner',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(listLearnerProjectHelpSessionsQuerySchema, 'query'),
  asyncHandler(listLearnerProjectHelpSessionsHandler),
);

projectHelpSessionsRouter.get(
  '/learner/:sessionId',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  asyncHandler(getLearnerProjectHelpSessionHandler),
);

projectHelpSessionsRouter.post(
  '/learner/:sessionId/alternative/accept',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  asyncHandler(learnerAcceptProjectHelpSessionAlternativeHandler),
);

projectHelpSessionsRouter.post(
  '/learner/:sessionId/alternative/reject',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  asyncHandler(learnerRejectProjectHelpSessionAlternativeHandler),
);

projectHelpSessionsRouter.post(
  '/learner/:sessionId/cancel',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  validate(cancelProjectHelpSessionSchema),
  asyncHandler(learnerCancelProjectHelpSessionHandler),
);

projectHelpSessionsRouter.post(
  '/learner/:sessionId/notebook-notes',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  asyncHandler(learnerEnsureProjectHelpSessionNotebookPageHandler),
);

projectHelpSessionsRouter.post(
  '/learner/:sessionId/zoom/join',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  asyncHandler(learnerJoinProjectHelpSessionZoomHandler),
);

projectHelpSessionsRouter.post(
  '/learner/:sessionId/no-show',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  asyncHandler(learnerReportProjectHelpSessionNoShowHandler),
);

projectHelpSessionsRouter.get(
  '/author',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(listAuthorProjectHelpSessionsQuerySchema, 'query'),
  asyncHandler(listAuthorProjectHelpSessionsHandler),
);

projectHelpSessionsRouter.get(
  '/author/:sessionId',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  asyncHandler(getAuthorProjectHelpSessionHandler),
);

projectHelpSessionsRouter.post(
  '/author/:sessionId/accept',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  validate(acceptProjectHelpSessionOptionSchema),
  asyncHandler(authorAcceptProjectHelpSessionOptionHandler),
);

projectHelpSessionsRouter.post(
  '/author/:sessionId/propose-alternative',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  validate(proposeProjectHelpSessionAlternativeSchema),
  asyncHandler(authorProposeProjectHelpSessionAlternativeHandler),
);

projectHelpSessionsRouter.post(
  '/author/:sessionId/decline',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  validate(declineProjectHelpSessionSchema),
  asyncHandler(authorDeclineProjectHelpSessionHandler),
);

projectHelpSessionsRouter.post(
  '/author/:sessionId/cancel',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  validate(cancelProjectHelpSessionSchema),
  asyncHandler(authorCancelProjectHelpSessionHandler),
);

projectHelpSessionsRouter.post(
  '/author/:sessionId/complete',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  asyncHandler(authorCompleteProjectHelpSessionHandler),
);

projectHelpSessionsRouter.post(
  '/author/:sessionId/zoom/retry',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  asyncHandler(authorRetryProjectHelpSessionZoomHandler),
);

projectHelpSessionsRouter.post(
  '/author/:sessionId/zoom/join',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  asyncHandler(authorJoinProjectHelpSessionZoomHandler),
);

projectHelpSessionsRouter.post(
  '/author/:sessionId/no-show',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectHelpSessionIdParamSchema, 'params'),
  asyncHandler(authorReportProjectHelpSessionNoShowHandler),
);
