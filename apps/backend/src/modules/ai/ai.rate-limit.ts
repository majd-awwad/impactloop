import { env } from '../../config/env.js';
import {
  createRateLimitMiddleware,
  type RateLimitPolicy,
} from '../../middlewares/rate-limit.middleware.js';

export const AI_CHAT_MESSAGE_RATE_LIMIT: RateLimitPolicy = {
  name: 'ai-chat-message',
  windowMs: env.aiChatRateLimitWindowMs,
  max: env.aiChatRateLimitPerUser,
};

export const AI_CHAT_CONVERSATION_CREATE_RATE_LIMIT: RateLimitPolicy = {
  name: 'ai-chat-conversation-create',
  windowMs: env.aiChatRateLimitWindowMs,
  max: env.aiChatMaxConversationsPerHour,
};

export const aiChatMessageRateLimitMiddleware = createRateLimitMiddleware({
  policy: AI_CHAT_MESSAGE_RATE_LIMIT,
  keyGenerator: (req) => req.auth?.sub ?? null,
});

export const aiChatConversationCreateRateLimitMiddleware =
  createRateLimitMiddleware({
    policy: AI_CHAT_CONVERSATION_CREATE_RATE_LIMIT,
    keyGenerator: (req) => req.auth?.sub ?? null,
  });

export const assertMessageLength = (text: string) => {
  if (text.length > env.aiChatMaxMessageLength) {
    return false;
  }

  return true;
};
