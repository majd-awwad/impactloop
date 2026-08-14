import { Router } from 'express';

import {
  authMiddleware,
  optionalAuthMiddleware,
} from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  deleteLearningProjectReview,
  followLearningProject,
  completeProjectBuildStep,
  createAiAuthoringDraft,
  getBuildItemMaterialCandidates,
  getLearningProject,
  getMyLearningProjectSubmission,
  getMyProjectBuild,
  optimizeMyProjectBuildPlan,
  getOrCreateAuthoringConversation,
  getOrCreateBuildGuideConversation,
  likeLearningProject,
  linkBuildItemMaterial,
  linkBuildItemReservation,
  listFollowedLearningProjects,
  listLearningProjects,
  listMyLearningProjectSubmissions,
  listSavedLearningProjects,
  reviewLearningProject,
  resubmitMyLearningProjectSubmission,
  saveLearningProject,
  startProjectBuild,
  startProjectBuildAgain,
  submitLearningProject,
  submitMyLearningProjectDraft,
  unlikeLearningProject,
  unfollowLearningProject,
  unlinkBuildItemMaterial,
  removeAcquiredBuildItemAllocation,
  unsaveLearningProject,
  updateMyLearningProjectSubmission,
  updateProjectBuildItem,
} from './learning-projects.controller.js';
import {
  learningProjectIdParamSchema,
  learningProjectsQuerySchema,
  linkBuildItemMaterialSchema,
  linkBuildItemReservationSchema,
  removeAcquiredBuildItemAllocationSchema,
  projectBuildItemParamSchema,
  projectBuildStepParamSchema,
  buildGuideConversationSchema,
  createAiAuthoringDraftSchema,
  authoringConversationSchema,
  projectReviewSchema,
  myLearningProjectsQuerySchema,
  submitLearningProjectSchema,
  updateMyLearningProjectSubmissionSchema,
  updateProjectBuildItemSchema,
} from './learning-projects.validation.js';
import {
  getMyBuildLearningSession,
  getMyBuildStepLearningCheck,
  getMyBuildStepLearningCheckAiHandoff,
  getMyBuildFinalLearningCheck,
  getMyBuildFinalLearningCheckAiHandoff,
  setupMyBuildLearningSession,
  skipMyBuildLearningAssignment,
  skipMyBuildStepLearningCheck,
  skipMyBuildFinalLearningCheckAssignment,
  submitMyBuildLearningAnswer,
  submitMyBuildStepLearningCheckAnswer,
  submitMyBuildFinalLearningCheckAnswer,
  updateMyBuildLearningSession,
  updateMyBuildLearningCompletionReflection,
  reportMyBuildLearningAssignmentUnclear,
  clearMyBuildLearningAssignmentUnclear,
  viewMyBuildLearningHint,
  viewMyBuildStepLearningCheckHint,
  viewMyBuildFinalLearningCheckHint,
} from '../project-learning/project-learning.controller.js';
import {
  projectLearningAssignmentParamSchema,
  projectLearningBuildStepParamSchema,
  completionReflectionBodySchema,
  setupLearningSessionBodySchema,
  submitLearningAnswerBodySchema,
  updateLearningSessionBodySchema,
} from '../project-learning/project-learning.validation.js';
import { attachCommentRoutes } from '../comments/comments.routes.js';
import {
  projectHelpSessionAuthorRouter,
  projectHelpSessionAvailabilityRouter,
} from '../project-help-sessions/project-help-session.routes.js';

export const learningProjectsRouter = Router();

learningProjectsRouter.get(
  '/',
  optionalAuthMiddleware,
  validate(learningProjectsQuerySchema, 'query'),
  asyncHandler(listLearningProjects),
);

learningProjectsRouter.post(
  '/submit',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(submitLearningProjectSchema),
  asyncHandler(submitLearningProject),
);

learningProjectsRouter.get(
  '/me/saved',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectsQuerySchema, 'query'),
  asyncHandler(listSavedLearningProjects),
);

learningProjectsRouter.get(
  '/me/followed',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectsQuerySchema, 'query'),
  asyncHandler(listFollowedLearningProjects),
);

learningProjectsRouter.get(
  '/mine',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(myLearningProjectsQuerySchema, 'query'),
  asyncHandler(listMyLearningProjectSubmissions),
);

learningProjectsRouter.post(
  '/mine/ai-authoring-drafts',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(createAiAuthoringDraftSchema),
  asyncHandler(createAiAuthoringDraft),
);

learningProjectsRouter.get(
  '/mine/:id',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(getMyLearningProjectSubmission),
);

learningProjectsRouter.patch(
  '/mine/:id',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  validate(updateMyLearningProjectSubmissionSchema),
  asyncHandler(updateMyLearningProjectSubmission),
);

learningProjectsRouter.post(
  '/mine/:id/submit',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(submitMyLearningProjectDraft),
);

learningProjectsRouter.post(
  '/mine/:id/resubmit',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(resubmitMyLearningProjectSubmission),
);

learningProjectsRouter.post(
  '/mine/:id/authoring-conversation',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  validate(authoringConversationSchema),
  asyncHandler(getOrCreateAuthoringConversation),
);

learningProjectsRouter.use(
  '/mine/:id/help-sessions',
  projectHelpSessionAuthorRouter,
);

learningProjectsRouter.get(
  '/:id/builds/me',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(getMyProjectBuild),
);

learningProjectsRouter.post(
  '/:id/builds/me/optimize-plan',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(optimizeMyProjectBuildPlan),
);

learningProjectsRouter.post(
  '/:id/builds/me/guide-conversation',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  validate(buildGuideConversationSchema),
  asyncHandler(getOrCreateBuildGuideConversation),
);

learningProjectsRouter.post(
  '/:id/builds/me/steps/:stepId/complete',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectBuildStepParamSchema, 'params'),
  asyncHandler(completeProjectBuildStep),
);

learningProjectsRouter.get(
  '/:id/builds/me/learning-session',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(getMyBuildLearningSession),
);

learningProjectsRouter.post(
  '/:id/builds/me/learning-session/setup',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  validate(setupLearningSessionBodySchema),
  asyncHandler(setupMyBuildLearningSession),
);

learningProjectsRouter.patch(
  '/:id/builds/me/learning-session',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  validate(updateLearningSessionBodySchema),
  asyncHandler(updateMyBuildLearningSession),
);

learningProjectsRouter.post(
  '/:id/builds/me/learning-session/assignments/:assignmentId/answer',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningAssignmentParamSchema, 'params'),
  validate(submitLearningAnswerBodySchema),
  asyncHandler(submitMyBuildLearningAnswer),
);

learningProjectsRouter.post(
  '/:id/builds/me/learning-session/assignments/:assignmentId/skip',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningAssignmentParamSchema, 'params'),
  asyncHandler(skipMyBuildLearningAssignment),
);

learningProjectsRouter.post(
  '/:id/builds/me/learning-session/assignments/:assignmentId/hint',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningAssignmentParamSchema, 'params'),
  asyncHandler(viewMyBuildLearningHint),
);

learningProjectsRouter.get(
  '/:id/builds/me/learning-session/steps/:stepId/check',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningBuildStepParamSchema, 'params'),
  asyncHandler(getMyBuildStepLearningCheck),
);

learningProjectsRouter.post(
  '/:id/builds/me/learning-session/steps/:stepId/check/hint',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningBuildStepParamSchema, 'params'),
  asyncHandler(viewMyBuildStepLearningCheckHint),
);

learningProjectsRouter.post(
  '/:id/builds/me/learning-session/steps/:stepId/check/answer',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningBuildStepParamSchema, 'params'),
  validate(submitLearningAnswerBodySchema),
  asyncHandler(submitMyBuildStepLearningCheckAnswer),
);

learningProjectsRouter.post(
  '/:id/builds/me/learning-session/steps/:stepId/check/skip',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningBuildStepParamSchema, 'params'),
  asyncHandler(skipMyBuildStepLearningCheck),
);

learningProjectsRouter.get(
  '/:id/builds/me/learning-session/steps/:stepId/check/ai-handoff',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningBuildStepParamSchema, 'params'),
  asyncHandler(getMyBuildStepLearningCheckAiHandoff),
);

learningProjectsRouter.get(
  '/:id/builds/me/learning-session/final-check',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(getMyBuildFinalLearningCheck),
);

learningProjectsRouter.post(
  '/:id/builds/me/learning-session/final-check/assignments/:assignmentId/hint',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningAssignmentParamSchema, 'params'),
  asyncHandler(viewMyBuildFinalLearningCheckHint),
);

learningProjectsRouter.post(
  '/:id/builds/me/learning-session/final-check/assignments/:assignmentId/answer',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningAssignmentParamSchema, 'params'),
  validate(submitLearningAnswerBodySchema),
  asyncHandler(submitMyBuildFinalLearningCheckAnswer),
);

learningProjectsRouter.post(
  '/:id/builds/me/learning-session/final-check/assignments/:assignmentId/skip',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningAssignmentParamSchema, 'params'),
  asyncHandler(skipMyBuildFinalLearningCheckAssignment),
);

learningProjectsRouter.get(
  '/:id/builds/me/learning-session/final-check/assignments/:assignmentId/ai-handoff',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningAssignmentParamSchema, 'params'),
  asyncHandler(getMyBuildFinalLearningCheckAiHandoff),
);

learningProjectsRouter.patch(
  '/:id/builds/me/learning-session/completion-reflection',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  validate(completionReflectionBodySchema),
  asyncHandler(updateMyBuildLearningCompletionReflection),
);

learningProjectsRouter.post(
  '/:id/builds/me/learning-session/assignments/:assignmentId/report-unclear',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningAssignmentParamSchema, 'params'),
  asyncHandler(reportMyBuildLearningAssignmentUnclear),
);

learningProjectsRouter.delete(
  '/:id/builds/me/learning-session/assignments/:assignmentId/report-unclear',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectLearningAssignmentParamSchema, 'params'),
  asyncHandler(clearMyBuildLearningAssignmentUnclear),
);

learningProjectsRouter.post(
  '/:id/builds/start',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(startProjectBuild),
);

learningProjectsRouter.post(
  '/:id/builds/again',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(startProjectBuildAgain),
);

learningProjectsRouter.patch(
  '/:id/builds/me/items/:itemId',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectBuildItemParamSchema, 'params'),
  validate(updateProjectBuildItemSchema),
  asyncHandler(updateProjectBuildItem),
);

learningProjectsRouter.get(
  '/:id/builds/me/items/:itemId/material-candidates',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectBuildItemParamSchema, 'params'),
  asyncHandler(getBuildItemMaterialCandidates),
);

learningProjectsRouter.post(
  '/:id/builds/me/items/:itemId/link-material',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectBuildItemParamSchema, 'params'),
  validate(linkBuildItemMaterialSchema),
  asyncHandler(linkBuildItemMaterial),
);

learningProjectsRouter.delete(
  '/:id/builds/me/items/:itemId/link-material',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectBuildItemParamSchema, 'params'),
  asyncHandler(unlinkBuildItemMaterial),
);

learningProjectsRouter.post(
  '/:id/builds/me/items/:itemId/remove-acquired-allocation',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectBuildItemParamSchema, 'params'),
  validate(removeAcquiredBuildItemAllocationSchema),
  asyncHandler(removeAcquiredBuildItemAllocation),
);

learningProjectsRouter.post(
  '/:id/builds/me/items/:itemId/link-reservation',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(projectBuildItemParamSchema, 'params'),
  validate(linkBuildItemReservationSchema),
  asyncHandler(linkBuildItemReservation),
);

learningProjectsRouter.post(
  '/:id/like',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(likeLearningProject),
);

learningProjectsRouter.delete(
  '/:id/like',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(unlikeLearningProject),
);

learningProjectsRouter.post(
  '/:id/save',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(saveLearningProject),
);

learningProjectsRouter.delete(
  '/:id/save',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(unsaveLearningProject),
);

learningProjectsRouter.post(
  '/:id/follow',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(followLearningProject),
);

learningProjectsRouter.delete(
  '/:id/follow',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(unfollowLearningProject),
);

learningProjectsRouter.put(
  '/:id/review',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  validate(projectReviewSchema),
  asyncHandler(reviewLearningProject),
);

learningProjectsRouter.delete(
  '/:id/review',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(deleteLearningProjectReview),
);

attachCommentRoutes(learningProjectsRouter);

learningProjectsRouter.use(
  '/:id/help-sessions',
  projectHelpSessionAvailabilityRouter,
);

learningProjectsRouter.get(
  '/:id',
  optionalAuthMiddleware,
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(getLearningProject),
);
