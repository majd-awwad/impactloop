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
} from './ai.controller.js';
import {
  aiChatConversationCreateRateLimitMiddleware,
  aiChatMessageRateLimitMiddleware,
} from './ai.rate-limit.js';
import {
  conversationIdParamSchema,
  confirmAiPendingActionSchema,
  createAiConversationSchema,
  listAiConversationsQuerySchema,
  listAiMessagesQuerySchema,
  aiPendingActionIdParamSchema,
  sendAiMessageSchema,
} from './ai.validation.js';

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
