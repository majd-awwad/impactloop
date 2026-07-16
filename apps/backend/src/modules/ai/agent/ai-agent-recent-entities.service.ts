import type { AiContentBlock } from '../ai.content-blocks.js';
import { parseStoredContentBlocks } from '../ai-context-builder.js';
import { listMessagesForConversation } from '../ai.repository.js';
import { normalizeArabicVariants } from './ai-agent-filter-extractor.service.js';

export type RecentEntityRecord = {
  id: string;
  type: 'MATERIAL' | 'PROJECT' | 'BUILD' | 'COMPONENT';
  title: string;
  normalizedTitle: string;
  blockType: string;
  resultIndex: number;
  messageId: string;
  recencyOrder: number;
  parentContext?: string;
  status?: string;
};

const CONTEXT_MESSAGE_WINDOW = 24;

export const normalizeEntityTitle = (title: string): string =>
  normalizeArabicVariants(
    title
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

const pushEntity = (
  entities: RecentEntityRecord[],
  entity: Omit<RecentEntityRecord, 'normalizedTitle'>,
) => {
  entities.push({
    ...entity,
    normalizedTitle: normalizeEntityTitle(entity.title),
  });
};

export const extractRecentEntitiesFromBlock = (
  block: AiContentBlock,
  messageId: string,
  recencyOrder: number,
): RecentEntityRecord[] => {
  const entities: RecentEntityRecord[] = [];

  switch (block.type) {
    case 'material_results':
      block.items.forEach((item, index) => {
        pushEntity(entities, {
          id: item.materialId,
          type: 'MATERIAL',
          title: item.title,
          blockType: block.type,
          resultIndex: index,
          messageId,
          recencyOrder,
        });
      });
      break;
    case 'project_results':
      block.items.forEach((item, index) => {
        pushEntity(entities, {
          id: item.projectId,
          type: 'PROJECT',
          title: item.title,
          blockType: block.type,
          resultIndex: index,
          messageId,
          recencyOrder,
        });
      });
      break;
    case 'project_details':
      pushEntity(entities, {
        id: block.item.projectId,
        type: 'PROJECT',
        title: block.item.title,
        blockType: block.type,
        resultIndex: 0,
        messageId,
        recencyOrder,
      });
      break;
    case 'recommendations':
      block.items.forEach((item, index) => {
        if (item.itemType === 'PROJECT') {
          pushEntity(entities, {
            id: item.itemId,
            type: 'PROJECT',
            title: item.title,
            blockType: block.type,
            resultIndex: index,
            messageId,
            recencyOrder,
            parentContext: block.recommendationType,
          });
        } else if (item.itemType === 'MATERIAL') {
          pushEntity(entities, {
            id: item.itemId,
            type: 'MATERIAL',
            title: item.title,
            blockType: block.type,
            resultIndex: index,
            messageId,
            recencyOrder,
            parentContext: block.recommendationType,
          });
        }
      });
      break;
    case 'comparison':
      if (block.subject === 'PROJECT') {
        block.items.forEach((item, index) => {
          pushEntity(entities, {
            id: item.id,
            type: 'PROJECT',
            title: item.title,
            blockType: block.type,
            resultIndex: index,
            messageId,
            recencyOrder,
          });
        });
      } else {
        block.items.forEach((item, index) => {
          pushEntity(entities, {
            id: item.id,
            type: 'MATERIAL',
            title: item.title,
            blockType: block.type,
            resultIndex: index,
            messageId,
            recencyOrder,
          });
        });
      }
      break;
    case 'component_list':
      if (block.projectId && block.projectTitle) {
        pushEntity(entities, {
          id: block.projectId,
          type: 'PROJECT',
          title: block.projectTitle,
          blockType: block.type,
          resultIndex: 0,
          messageId,
          recencyOrder,
        });
      }
      block.items.forEach((item, index) => {
        pushEntity(entities, {
          id: item.componentId,
          type: 'COMPONENT',
          title: item.name,
          blockType: block.type,
          resultIndex: index,
          messageId,
          recencyOrder,
          parentContext: block.projectTitle ?? block.projectId,
        });
      });
      break;
    case 'build_checklist':
      pushEntity(entities, {
        id: block.projectId,
        type: 'PROJECT',
        title: block.projectId,
        blockType: block.type,
        resultIndex: 0,
        messageId,
        recencyOrder,
        parentContext: block.buildId,
      });
      block.items.forEach((item, index) => {
        pushEntity(entities, {
          id: item.componentId,
          type: 'COMPONENT',
          title: item.name,
          blockType: block.type,
          resultIndex: index,
          messageId,
          recencyOrder,
          parentContext: block.projectId,
          status: item.status,
        });
      });
      break;
    case 'material_details':
      pushEntity(entities, {
        id: block.item.materialId,
        type: 'MATERIAL',
        title: block.item.title,
        blockType: block.type,
        resultIndex: 0,
        messageId,
        recencyOrder,
      });
      break;
    case 'component_matches':
      block.groups.forEach((group, groupIndex) => {
        pushEntity(entities, {
          id: group.componentId,
          type: 'COMPONENT',
          title: group.componentName,
          blockType: block.type,
          resultIndex: groupIndex,
          messageId,
          recencyOrder,
          parentContext: block.buildId,
          status: 'MISSING',
        });
        group.materials.forEach((material, materialIndex) => {
          pushEntity(entities, {
            id: material.materialId,
            type: 'MATERIAL',
            title: material.title,
            blockType: block.type,
            resultIndex: materialIndex,
            messageId,
            recencyOrder,
            parentContext: group.componentName,
          });
        });
      });
      break;
    case 'action_confirmation':
      if (block.target.type === 'PROJECT' || block.target.type === 'MATERIAL') {
        pushEntity(entities, {
          id: block.target.id,
          type: block.target.type,
          title: block.target.title,
          blockType: block.type,
          resultIndex: 0,
          messageId,
          recencyOrder,
        });
      }
      break;
    case 'action_result':
      if (
        block.target?.type === 'PROJECT' ||
        block.target?.type === 'MATERIAL'
      ) {
        pushEntity(entities, {
          id: block.target.id,
          type: block.target.type,
          title: block.target.title,
          blockType: block.type,
          resultIndex: 0,
          messageId,
          recencyOrder,
        });
      }
      break;
    default:
      break;
  }

  return entities;
};

export const loadRecentEntitiesForConversation = async (
  conversationId: string,
): Promise<RecentEntityRecord[]> => {
  const { total } = await listMessagesForConversation({
    conversationId,
    limit: 1,
    offset: 0,
  });
  const { items } = await listMessagesForConversation({
    conversationId,
    limit: CONTEXT_MESSAGE_WINDOW,
    offset: Math.max(0, total - CONTEXT_MESSAGE_WINDOW),
  });

  const byKey = new Map<string, RecentEntityRecord>();
  let recencyOrder = 0;

  for (const message of items) {
    if (message.role !== 'ASSISTANT') {
      continue;
    }

    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (const block of blocks) {
      for (const entity of extractRecentEntitiesFromBlock(
        block,
        message.id,
        recencyOrder,
      )) {
        recencyOrder += 1;
        const key = `${entity.type}:${entity.id}`;
        byKey.set(key, entity);
      }
    }
  }

  return [...byKey.values()].sort((a, b) => b.recencyOrder - a.recencyOrder);
};
