import type {
  AiConversationStatus,
  AiMessageRole,
  AiMessageStatus,
  AiScopeClassification,
} from '../../generated/prisma/client.js';

import type { AiContentBlock } from './ai.content-blocks.js';

export type AiLocale = 'en' | 'ar';

export type AiTurnMeta = {
  provider: string;
  model: string | null;
  policyVersion: string;
  scopeClassification: AiScopeClassification;
  latencyMs: number | null;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
  };
};

export type AiAssistantConversationMode = 'LEARNER_ASSISTANT' | 'GENERAL_LEARNING';

export type AiTurnResponse = {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string | null;
  mode: AiAssistantConversationMode;
  locale: AiLocale;
  contentBlocks: AiContentBlock[];
  meta: AiTurnMeta;
};

export type AiConversationSummary = {
  id: string;
  mode: AiAssistantConversationMode;
  locale: string;
  title: string | null;
  status: AiConversationStatus;
  lastMessageAt: string | null;
  preview: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiMessageDto = {
  id: string;
  role: AiMessageRole;
  status: AiMessageStatus;
  contentText: string | null;
  contentBlocks: AiContentBlock[] | null;
  scopeClassification: AiScopeClassification | null;
  locale: string;
  provider: string | null;
  model: string | null;
  policyVersion: string | null;
  errorCode: string | null;
  createdAt: string;
};

export type BoundedHistoryMessage = {
  role: 'user' | 'assistant';
  text: string;
};
