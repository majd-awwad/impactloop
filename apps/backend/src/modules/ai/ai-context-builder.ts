import type { AiMessage } from '../../generated/prisma/client.js';

import type { AiContentBlock } from './ai.content-blocks.js';
import { aiContentBlocksSchema } from './ai.content-blocks.js';
import type { BoundedHistoryMessage } from './ai.types.js';

export const buildBoundedConversationHistory = (
  messages: AiMessage[],
  maxMessages: number,
): BoundedHistoryMessage[] => {
  const recent = messages.slice(-maxMessages);

  return recent
    .map((message) => {
      if (message.role === 'USER') {
        return message.contentText
          ? ({ role: 'user' as const, text: message.contentText })
          : null;
      }

      const blocks = parseStoredContentBlocks(message.contentBlocks);
      const text = blocks
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n\n')
        .trim();

      return text ? ({ role: 'assistant' as const, text }) : null;
    })
    .filter((entry): entry is BoundedHistoryMessage => entry !== null);
};

export const parseStoredContentBlocks = (
  value: unknown,
): AiContentBlock[] => {
  const parsed = aiContentBlocksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

export const deriveConversationTitle = (firstUserMessage: string): string => {
  const trimmed = firstUserMessage.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 60) {
    return trimmed;
  }

  return `${trimmed.slice(0, 57)}...`;
};

export const deriveConversationPreview = (
  blocks: AiContentBlock[],
): string | null => {
  const text = blocks.find((block) => block.type === 'text')?.text?.trim();
  if (!text) {
    return null;
  }

  return text.length <= 120 ? text : `${text.slice(0, 117)}...`;
};
