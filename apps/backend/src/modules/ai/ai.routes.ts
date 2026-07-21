import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  archiveAiConversationHandler,
  cancelAiPendingActionHandler,
  confirmAiPendingActionHandler,
  createAiConversationHandler,
  listAiConversationMessagesHandler,
  listAiConversationsHandler,
  restoreAiConversationHandler,
  sendAiConversationMessageHandler,
  startProjectAuthoringHandler,
  generateProjectAuthoringProposalHandler,
  submitProjectAuthoringProposalReviewHandler,
  submitProjectAuthoringDiscussionHandler,
  reviseProjectAuthoringProposalHandler,
  prepareApplyReviewedAuthoringProposalHandler,
  runSequentialAuthoringActionHandler,
  discussSequentialAuthoringTurnHandler,
  getSequentialAuthoringStateHandler,
  startAuthoringSessionHandler,
  getAuthoringSessionHandler,
  runAuthoringSessionActionHandler,
  sendAuthoringSessionMessageHandler,
} from './ai.controller.js';
import {
  aiChatConversationCreateRateLimitMiddleware,
  aiChatMessageRateLimitMiddleware,
} from './ai.rate-limit.js';
import {
  conversationIdParamSchema,
  authoringProposalIdParamSchema,
  authoringReviewStateIdParamSchema,
  submitAuthoringProposalReviewSchema,
  submitAuthoringProposalDiscussionSchema,
  reviseAuthoringProposalSchema,
  sequentialAuthoringActionSchema,
  discussSequentialAuthoringTurnSchema,
  authoringTurnIdParamSchema,
  confirmAiPendingActionSchema,
  createAiConversationSchema,
  listAiConversationsQuerySchema,
  listAiMessagesQuerySchema,
  aiPendingActionIdParamSchema,
  sendAiMessageSchema,
} from './ai.validation.js';
import {
  authoringSessionActionSchema,
  authoringSessionMessageSchema,
  sessionIdParamSchema,
  startAuthoringSessionSchema,
} from './project-authoring-session.controller.js';

export const aiRouter = Router();

aiRouter.use(authMiddleware, requireRoles('LEARNER'));

aiRouter.post(
  '/conversations',
  aiChatConversationCreateRateLimitMiddleware,
  validate(createAiConversationSchema),
  asyncHandler(createAiConversationHandler),
);

aiRouter.get(
  '/conversations',
  validate(listAiConversationsQuerySchema, 'query'),
  asyncHandler(listAiConversationsHandler),
);

aiRouter.get(
  '/conversations/:conversationId/messages',
  validate(conversationIdParamSchema, 'params'),
  validate(listAiMessagesQuerySchema, 'query'),
  asyncHandler(listAiConversationMessagesHandler),
);

aiRouter.post(
  '/authoring/sessions/start',
  aiChatMessageRateLimitMiddleware,
  validate(startAuthoringSessionSchema),
  asyncHandler(startAuthoringSessionHandler),
);

aiRouter.get(
  '/authoring/sessions/:sessionId',
  validate(sessionIdParamSchema, 'params'),
  asyncHandler(getAuthoringSessionHandler),
);

aiRouter.post(
  '/authoring/sessions/:sessionId/messages',
  aiChatMessageRateLimitMiddleware,
  validate(sessionIdParamSchema, 'params'),
  validate(authoringSessionMessageSchema),
  asyncHandler(sendAuthoringSessionMessageHandler),
);

aiRouter.post(
  '/authoring/sessions/:sessionId/actions',
  aiChatMessageRateLimitMiddleware,
  validate(sessionIdParamSchema, 'params'),
  validate(authoringSessionActionSchema),
  asyncHandler(runAuthoringSessionActionHandler),
);

aiRouter.post(
  '/conversations/:conversationId/authoring/start',
  aiChatMessageRateLimitMiddleware,
  validate(conversationIdParamSchema, 'params'),
  asyncHandler(startProjectAuthoringHandler),
);

aiRouter.post(
  '/conversations/:conversationId/authoring/proposal',
  aiChatMessageRateLimitMiddleware,
  validate(conversationIdParamSchema, 'params'),
  asyncHandler(generateProjectAuthoringProposalHandler),
);

aiRouter.post(
  '/conversations/:conversationId/authoring/sequential/action',
  aiChatMessageRateLimitMiddleware,
  validate(conversationIdParamSchema, 'params'),
  validate(sequentialAuthoringActionSchema),
  asyncHandler(runSequentialAuthoringActionHandler),
);

aiRouter.get(
  '/conversations/:conversationId/authoring/sequential/state',
  validate(conversationIdParamSchema, 'params'),
  asyncHandler(getSequentialAuthoringStateHandler),
);

aiRouter.post(
  '/conversations/:conversationId/authoring/turns/:turnId/discuss',
  aiChatMessageRateLimitMiddleware,
  validate(authoringTurnIdParamSchema, 'params'),
  validate(discussSequentialAuthoringTurnSchema),
  asyncHandler(discussSequentialAuthoringTurnHandler),
);

aiRouter.post(
  '/conversations/:conversationId/authoring/proposals/:proposalId/review',
  aiChatMessageRateLimitMiddleware,
  validate(authoringProposalIdParamSchema, 'params'),
  validate(submitAuthoringProposalReviewSchema),
  asyncHandler(submitProjectAuthoringProposalReviewHandler),
);

aiRouter.post(
  '/conversations/:conversationId/authoring/proposals/:proposalId/discuss',
  aiChatMessageRateLimitMiddleware,
  validate(authoringProposalIdParamSchema, 'params'),
  validate(submitAuthoringProposalDiscussionSchema),
  asyncHandler(submitProjectAuthoringDiscussionHandler),
);

aiRouter.post(
  '/conversations/:conversationId/authoring/proposals/:proposalId/revise',
  aiChatMessageRateLimitMiddleware,
  validate(authoringProposalIdParamSchema, 'params'),
  validate(reviseAuthoringProposalSchema),
  asyncHandler(reviseProjectAuthoringProposalHandler),
);

aiRouter.post(
  '/conversations/:conversationId/authoring/reviews/:reviewStateId/apply',
  aiChatMessageRateLimitMiddleware,
  validate(authoringReviewStateIdParamSchema, 'params'),
  asyncHandler(prepareApplyReviewedAuthoringProposalHandler),
);

aiRouter.post(
  '/conversations/:conversationId/messages',
  aiChatMessageRateLimitMiddleware,
  validate(conversationIdParamSchema, 'params'),
  validate(sendAiMessageSchema),
  asyncHandler(sendAiConversationMessageHandler),
);

aiRouter.post(
  '/conversations/:conversationId/archive',
  validate(conversationIdParamSchema, 'params'),
  asyncHandler(archiveAiConversationHandler),
);

aiRouter.post(
  '/conversations/:conversationId/restore',
  validate(conversationIdParamSchema, 'params'),
  asyncHandler(restoreAiConversationHandler),
);

aiRouter.post(
  '/actions/:pendingActionId/confirm',
  validate(aiPendingActionIdParamSchema, 'params'),
  validate(confirmAiPendingActionSchema),
  asyncHandler(confirmAiPendingActionHandler),
);

aiRouter.post(
  '/actions/:pendingActionId/cancel',
  validate(aiPendingActionIdParamSchema, 'params'),
  asyncHandler(cancelAiPendingActionHandler),
);
