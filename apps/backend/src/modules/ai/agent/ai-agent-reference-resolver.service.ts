import type { AiContentBlock } from '../ai.content-blocks.js';
import { parseStoredContentBlocks } from '../ai-context-builder.js';
import { listMessagesForConversation } from '../ai.repository.js';
import { isActiveReservationBehaviorStatus } from '../../reservations/reservations.quantity.js';
import type { ReservationStatus } from '../../../generated/prisma/client.js';
import {
  detectComponentMaterialMatchingIntent,
  extractProjectTitleQuery,
  normalizeArabicVariants,
} from './ai-agent-filter-extractor.service.js';
import {
  buildComparisonFollowUpAnswer,
  detectComparisonCriterion,
  findLatestComparisonBlock,
} from './ai-agent-comparison-followup.service.js';
import {
  buildPlannerConversationContext,
  type PlannerConversationContext,
  type TrustedEntitySummary,
} from './ai-agent-planner-context.service.js';
import {
  loadRecentEntitiesForConversation,
  type RecentEntityRecord,
} from './ai-agent-recent-entities.service.js';
import * as learningProjectsRepository from '../../learning-projects/learning-projects.repository.js';
import {
  getLearningProjects,
  getOwnedProjectBuildByBuildId,
  listActiveProjectBuildsForLearner,
} from '../../learning-projects/learning-projects.service.js';

const REFERENCE_MESSAGE_WINDOW = 24;

const loadRecentAssistantBlocks = async (conversationId: string) => {
  const { total } = await listMessagesForConversation({
    conversationId,
    limit: 1,
    offset: 0,
  });
  const { items } = await listMessagesForConversation({
    conversationId,
    limit: REFERENCE_MESSAGE_WINDOW,
    offset: Math.max(0, total - REFERENCE_MESSAGE_WINDOW),
  });

  return items
    .filter((message) => message.role === 'ASSISTANT')
    .flatMap((message) => parseStoredContentBlocks(message.contentBlocks));
};

const findLatestChecklistBlock = (
  blocks: AiContentBlock[],
): Extract<AiContentBlock, { type: 'build_checklist' }> | null => {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type === 'build_checklist') {
      return block;
    }
  }

  return null;
};

const findLatestMaterialResultsBlock = (
  blocks: AiContentBlock[],
): Extract<AiContentBlock, { type: 'material_results' }> | null => {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type === 'material_results') {
      return block;
    }
  }

  return null;
};

const findLatestProjectResultsBlock = (
  blocks: AiContentBlock[],
): Extract<AiContentBlock, { type: 'project_results' }> | null => {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type === 'project_results') {
      return block;
    }
  }

  return null;
};

type TrustedProjectListItem = {
  projectId: string;
  title: string;
};

const findLatestProjectListItems = (
  blocks: AiContentBlock[],
): TrustedProjectListItem[] | null => {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type === 'project_results') {
      return block.items.map((item) => ({
        projectId: item.projectId,
        title: item.title,
      }));
    }
    if (block.type === 'recommendations' && block.recommendationType === 'PROJECTS') {
      return block.items
        .filter((item) => item.itemType === 'PROJECT')
        .map((item) => ({
          projectId: item.itemId,
          title: item.title,
        }));
    }
  }

  return null;
};

const findLatestComponentMatchesBlock = (
  blocks: AiContentBlock[],
): Extract<AiContentBlock, { type: 'component_matches' }> | null => {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type === 'component_matches') {
      return block;
    }
  }

  return null;
};

const getLatestResultsSubject = (
  blocks: AiContentBlock[],
): 'MATERIAL' | 'PROJECT' | null => {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type === 'material_results') {
      return 'MATERIAL';
    }
    if (block.type === 'project_results') {
      return 'PROJECT';
    }
    if (block.type === 'comparison') {
      return block.subject;
    }
    if (block.type === 'material_details') {
      return 'MATERIAL';
    }
    if (block.type === 'project_details') {
      return 'PROJECT';
    }
  }

  return null;
};

const refersToMaterials = (userMessage: string): boolean =>
  /(مادة|مواد|material|materials)/i.test(userMessage);

const refersToProjects = (userMessage: string): boolean =>
  /(مشروع|مشاريع|project|projects)/i.test(userMessage);

const wantsTwoItems = (userMessage: string): boolean =>
  /(first two|أول مادتين|اول مادتين|أول مشروعين|اول مشروعين|first 2|الاولى والثانية|الأولى والثانية)/i.test(
    userMessage,
  );

const wantsFirstAndThird = (userMessage: string): boolean =>
  /(أول وثالث|الاول والثالث|first and third|الأولى والثالثة|أول مادة وثالث|أول مشروع وثالث)/i.test(
    userMessage,
  );

const resolveComparisonCriterionReference = async (input: {
  conversationId: string;
  userMessage: string;
}): Promise<ResolvedReference | null> => {
  const criterion = detectComparisonCriterion(input.userMessage);
  if (!criterion) {
    return null;
  }

  const comparisonBlock = await findLatestComparisonBlock(input.conversationId);
  if (!comparisonBlock) {
    return null;
  }

  const answer = buildComparisonFollowUpAnswer({
    userMessage: input.userMessage,
    locale: 'ar',
    block: comparisonBlock,
  });

  if (!answer?.winnerId) {
    return null;
  }

  return {
    kind: comparisonBlock.subject === 'MATERIAL' ? 'MATERIAL' : 'PROJECT',
    ids: [answer.winnerId],
    ambiguous: false,
  };
};

type ResolvedReference = {
  kind: 'MATERIAL' | 'PROJECT' | 'BUILD' | 'COMPONENT';
  ids: string[];
  ambiguous: boolean;
};

const ORDINAL_PATTERNS: Array<{ index: number; patterns: RegExp[] }> = [
  { index: 0, patterns: [/first|أول|الاول|الأول/i] },
  { index: 1, patterns: [/second|ثاني|الثاني|الثانيه/i] },
  { index: 2, patterns: [/third|ثالث|الثالث/i] },
  { index: 3, patterns: [/fourth|رابع|الرابع/i] },
];

const REFERENCE_STOPWORDS = new Set(
  [
    'project',
    'مشروع',
    'المشروع',
    'material',
    'مادة',
    'المواد',
    'مواد',
    'ال',
    'the',
    'this',
    'that',
    'هاي',
    'هذا',
    'هذه',
    'اللي',
    'الي',
    'شو',
    'ما',
    'مكونات',
    'components',
    'required',
    'مطلوب',
    'مطلوبة',
    'بده',
    'محتاج',
    'لازم',
    'عرضته',
    'السابق',
    'فوق',
    'recent',
  ].map((term) => term.toLowerCase()),
);

const normalizeReferenceText = (value: string): string =>
  normalizeArabicVariants(
    value
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

const expandReferenceAliases = (text: string): string =>
  normalizeReferenceText(text)
    .replace(/\bobstacle\s+bot\b/g, 'obstacle robot')
    .replace(/\bobstacle\s+avoidance\b/g, 'obstacle avoidance robot')
    .replace(/\bbot\b/g, 'robot')
    .replace(/\bbots\b/g, 'robot')
    .replace(/بوت/g, 'robot')
    .replace(/روبوت/g, 'robot')
    .replace(/عوائق/g, 'obstacle')
    .replace(/بتجنب/g, 'avoidance')
    .replace(/تجنب/g, 'avoidance')
    .replace(/الـ/g, ' ')
    .replace(/\bال(?=[a-z])/gi, ' ');

const tokenizeReference = (value: string): string[] => {
  const expanded = expandReferenceAliases(value);

  return expanded
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !REFERENCE_STOPWORDS.has(token));
};

export type EntityMatchResult = {
  entity: TrustedEntitySummary;
  score: number;
};

export const scoreEntityTitleMatch = (mention: string, title: string): number => {
  const mentionTokens = tokenizeReference(mention);
  const titleTokens = tokenizeReference(title);

  if (mentionTokens.length === 0 || titleTokens.length === 0) {
    return 0;
  }

  let matched = 0;
  for (const mentionToken of mentionTokens) {
    const hit = titleTokens.some(
      (titleToken) =>
        titleToken.includes(mentionToken) || mentionToken.includes(titleToken),
    );
    if (hit) {
      matched += 1;
    }
  }

  return matched / mentionTokens.length;
};

const toTrustedProject = (entity: RecentEntityRecord): TrustedEntitySummary => ({
  type: 'PROJECT',
  id: entity.id,
  title: entity.title,
  resultIndex: entity.resultIndex,
  parentContext: entity.parentContext,
  blockType: entity.blockType,
  messageId: entity.messageId,
  recencyOrder: entity.recencyOrder,
});

const scoreProjectCandidates = (
  mention: string,
  candidates: RecentEntityRecord[],
): Array<{ entity: TrustedEntitySummary; score: number }> =>
  candidates
    .map((entity) => ({
      entity: toTrustedProject(entity),
      score:
        scoreEntityTitleMatch(mention, entity.title) +
        (entity.recencyOrder != null ? entity.recencyOrder * 0.0001 : 0),
    }))
    .sort((a, b) => b.score - a.score);

const pickBestProjectMatch = (
  scored: Array<{ entity: TrustedEntitySummary; score: number }>,
): EntityMatchResult | null => {
  if (scored.length === 0) {
    return null;
  }

  if (scored.length === 1 && scored[0]!.score >= 0.45) {
    return scored[0]!;
  }

  if (scored.length >= 2) {
    const [first, second] = scored;
    if (
      first!.score >= 0.45 &&
      second!.score >= 0.45 &&
      first!.score - second!.score < 0.15
    ) {
      return null;
    }

    if (first!.score - second!.score >= 0.15) {
      return first!;
    }
  }

  if (scored[0] && scored[0].score >= 0.7) {
    return scored[0];
  }

  return null;
};

const extractMentionCandidates = (userMessage: string): string[] => {
  const candidates = [
    userMessage.match(/(?:obstacle|الـ?\s*obstacle).{0,30}(?:bot|robot|روبوت|بوت)/i)?.[0],
    userMessage.match(/obstacle\s+robot/i)?.[0],
    userMessage.match(/obstacle\s+bot/i)?.[0],
    userMessage.match(/مشروع\s+(.+?)(?:\?|$)/i)?.[1],
    userMessage.match(/(?:الروبوت|robot).{0,40}(?:obstacle|عوائق)/i)?.[0],
    userMessage.match(/obstacle\s+robot/i)?.[0],
    userMessage.match(/(.+?)\s+(?:شو|ما)\s+(?:مكونات|components|بده|بتحتاج|لازم|محتاج)/i)?.[1],
    userMessage.match(/(?:شو|ما)\s+(?:بده|محتاج|مكوناته).{0,40}(obstacle|robot|روبوت|بوت).*/i)?.[0],
    userMessage,
  ].filter((value): value is string => Boolean(value?.trim()));

  return [...new Set(candidates.map((value) => value.trim()))];
};

const GROUNDED_PROJECT_CONTEXT_BLOCK_TYPES = new Set([
  'project_results',
  'component_list',
  'project_details',
]);

const hasContextualProjectReference = (userMessage: string): boolean =>
  /(عرضته|السابق|اللي\s+عرضته|الي\s+عرضته|اللي\s+فوق|فوق|هذا\s+المشروع|هذا\s+الروبوت|the\s+one|recent)/i.test(
    userMessage,
  ) ||
  /(?:^|[\s،,.!?])?(?:إله|له|لها)(?:$|[\s،,.!?؟])?/u.test(userMessage) ||
  /(?:this project|the project)/i.test(userMessage) ||
  /(obstacle|robot|روبوت|بوت|عوائق)/i.test(userMessage);

const resolveSingleContextualProjectFromCandidates = (
  projectCandidates: RecentEntityRecord[],
): EntityMatchResult | null => {
  const grounded = projectCandidates.filter((candidate) =>
    GROUNDED_PROJECT_CONTEXT_BLOCK_TYPES.has(candidate.blockType),
  );
  if (grounded.length === 0) {
    return null;
  }

  const latestOrder = Math.max(...grounded.map((candidate) => candidate.recencyOrder));
  const latestGrounded = [
    ...new Map(
      grounded
        .filter((candidate) => candidate.recencyOrder === latestOrder)
        .map((project) => [project.id, project]),
    ).values(),
  ];

  if (latestGrounded.length === 1) {
    return { entity: toTrustedProject(latestGrounded[0]!), score: 0.85 };
  }

  return null;
};

export const resolveEntityFromContext = (input: {
  context: PlannerConversationContext;
  type: TrustedEntitySummary['type'];
  mention?: string;
  referenceType?: string;
  resultIndex?: number | null;
}): EntityMatchResult | null => {
  const candidates = input.context.entities.filter(
    (entity) => entity.type === input.type,
  );

  if (candidates.length === 0) {
    return null;
  }

  if (
    input.referenceType === 'RESULT_INDEX' &&
    input.resultIndex != null &&
    input.resultIndex >= 0
  ) {
    const byIndex = candidates.find(
      (entity) => entity.resultIndex === input.resultIndex,
    );
    if (byIndex) {
      return { entity: byIndex, score: 1 };
    }
  }

  if (input.referenceType === 'PRONOUN' || input.referenceType === 'RECENT_RESULT') {
    const recent = [...candidates].sort(
      (a, b) => (b.recencyOrder ?? 0) - (a.recencyOrder ?? 0),
    )[0];
    if (recent) {
      return { entity: recent, score: 0.9 };
    }
  }

  if (input.mention && input.mention.trim().length >= 2) {
    const scored = candidates
      .map((entity) => ({
        entity,
        score: scoreEntityTitleMatch(input.mention!, entity.title),
      }))
      .sort((a, b) => b.score - a.score);

    return pickBestProjectMatch(scored);
  }

  return null;
};

export const resolveProjectFromRecentEntities = (input: {
  userMessage: string;
  explicitQuery?: string;
  recentProjects: RecentEntityRecord[];
}): EntityMatchResult | null => {
  const projectCandidates = [...input.recentProjects].sort(
    (a, b) => b.recencyOrder - a.recencyOrder,
  );

  if (projectCandidates.length === 0) {
    return null;
  }

  const mentionCandidates = [
    input.explicitQuery,
    ...extractMentionCandidates(input.userMessage),
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const mention of mentionCandidates) {
    const scored = scoreProjectCandidates(mention, projectCandidates);
    const best = pickBestProjectMatch(scored);
    if (best) {
      return best;
    }
  }

  if (hasContextualProjectReference(input.userMessage)) {
    const obstacleCue = /(obstacle|bot|robot|روبوت|بوت|العوائق|avoidance)/i.test(
      input.userMessage,
    );
    if (obstacleCue) {
      const obstacleScored = scoreProjectCandidates(
        'obstacle robot',
        projectCandidates,
      );
      const obstacleMatch = pickBestProjectMatch(obstacleScored);
      if (obstacleMatch) {
        return obstacleMatch;
      }

      const strongObstacleMatches = obstacleScored.filter(
        (entry) => entry.score >= 0.45,
      );
      if (strongObstacleMatches.length >= 2) {
        return null;
      }
    } else {
      const contextual = resolveSingleContextualProjectFromCandidates(projectCandidates);
      if (contextual) {
        return contextual;
      }
    }
  }

  for (const ordinal of ORDINAL_PATTERNS) {
    if (ordinal.patterns.some((pattern) => pattern.test(input.userMessage))) {
      const ordered = [...projectCandidates].sort(
        (a, b) => a.recencyOrder - b.recencyOrder,
      );
      const target = ordered[ordinal.index];
      if (target) {
        return { entity: toTrustedProject(target), score: 0.95 };
      }
    }
  }

  return null;
};

export const resolveProjectFromMessage = async (input: {
  conversationId: string;
  userMessage: string;
  explicitQuery?: string;
}): Promise<EntityMatchResult | null> => {
  const recentEntities = await loadRecentEntitiesForConversation(input.conversationId);
  const projectCandidates = recentEntities.filter(
    (entity) => entity.type === 'PROJECT',
  );

  const resolved = resolveProjectFromRecentEntities({
    userMessage: input.userMessage,
    explicitQuery: input.explicitQuery,
    recentProjects: projectCandidates,
  });
  if (resolved) {
    return resolved;
  }

  if (projectCandidates.length === 0) {
    const context = await buildPlannerConversationContext(input.conversationId);
    return resolveEntityFromContext({
      context,
      type: 'PROJECT',
      mention: input.explicitQuery,
      referenceType: hasContextualProjectReference(input.userMessage)
        ? 'RECENT_RESULT'
        : 'EXPLICIT_NAME',
    });
  }

  if (hasContextualProjectReference(input.userMessage)) {
    return resolveSingleContextualProjectFromCandidates(projectCandidates);
  }

  return null;
};

export const resolveConversationReferences = async (input: {
  conversationId: string;
  userMessage: string;
}): Promise<ResolvedReference | null> => {
  const assistantBlocks = await loadRecentAssistantBlocks(input.conversationId);
  const recentEntities = await loadRecentEntitiesForConversation(input.conversationId);
  const recentMaterials = recentEntities
    .filter((entity) => entity.type === 'MATERIAL')
    .sort((a, b) => a.recencyOrder - b.recencyOrder);
  const recentProjects = recentEntities
    .filter((entity) => entity.type === 'PROJECT')
    .sort((a, b) => a.recencyOrder - b.recencyOrder);

  const text = input.userMessage.toLowerCase();
  const latestResultsSubject = getLatestResultsSubject(assistantBlocks);
  const latestMaterialBlock = findLatestMaterialResultsBlock(assistantBlocks);
  const latestProjectBlock = findLatestProjectResultsBlock(assistantBlocks);
  const latestProjectList = findLatestProjectListItems(assistantBlocks);

  const comparisonReference = await resolveComparisonCriterionReference({
    conversationId: input.conversationId,
    userMessage: input.userMessage,
  });
  if (comparisonReference) {
    return comparisonReference;
  }

  if (wantsFirstAndThird(input.userMessage)) {
    const wantsMaterialPair =
      refersToMaterials(input.userMessage) ||
      (!refersToProjects(input.userMessage) && latestResultsSubject === 'MATERIAL');
    const wantsProjectPair =
      refersToProjects(input.userMessage) ||
      (!refersToMaterials(input.userMessage) && latestResultsSubject === 'PROJECT');

    if (
      (wantsMaterialPair || (!wantsProjectPair && latestResultsSubject === 'MATERIAL')) &&
      latestMaterialBlock &&
      latestMaterialBlock.items.length >= 3
    ) {
      return {
        kind: 'MATERIAL',
        ids: [
          latestMaterialBlock.items[0]!.materialId,
          latestMaterialBlock.items[2]!.materialId,
        ],
        ambiguous: false,
      };
    }

    const projectItems = latestProjectList ?? latestProjectBlock?.items.map((item) => ({
      projectId: item.projectId,
      title: item.title,
    }));
    if (
      (wantsProjectPair || (!wantsMaterialPair && latestResultsSubject === 'PROJECT')) &&
      projectItems &&
      projectItems.length >= 3
    ) {
      return {
        kind: 'PROJECT',
        ids: [projectItems[0]!.projectId, projectItems[2]!.projectId],
        ambiguous: false,
      };
    }
  }

  if (wantsTwoItems(input.userMessage)) {
    const wantsMaterialPair =
      refersToMaterials(input.userMessage) ||
      /(مادتين|مواد|materials)/i.test(input.userMessage);
    const wantsProjectPair =
      refersToProjects(input.userMessage) ||
      /(مشروعين|مشاريع|projects)/i.test(input.userMessage);

    if (
      (wantsMaterialPair || (!wantsProjectPair && latestResultsSubject === 'MATERIAL')) &&
      latestMaterialBlock &&
      latestMaterialBlock.items.length >= 2
    ) {
      return {
        kind: 'MATERIAL',
        ids: latestMaterialBlock.items.slice(0, 2).map((item) => item.materialId),
        ambiguous: false,
      };
    }

    if (
      (wantsProjectPair || (!wantsMaterialPair && latestResultsSubject === 'PROJECT')) &&
      (latestProjectList?.length ?? latestProjectBlock?.items.length ?? 0) >= 2
    ) {
      const items =
        latestProjectList ??
        latestProjectBlock!.items.map((item) => ({
          projectId: item.projectId,
          title: item.title,
        }));
      return {
        kind: 'PROJECT',
        ids: items.slice(0, 2).map((item) => item.projectId),
        ambiguous: false,
      };
    }
  }

  const ordinalMatch = ORDINAL_PATTERNS.find((ordinal) =>
    ordinal.patterns.some((pattern) => pattern.test(text)),
  );

  if (ordinalMatch) {
    const materialOrdinal =
      refersToMaterials(input.userMessage) ||
      (!refersToProjects(input.userMessage) && latestResultsSubject === 'MATERIAL');
    const projectOrdinal =
      refersToProjects(input.userMessage) ||
      (!refersToMaterials(input.userMessage) && latestResultsSubject === 'PROJECT');

    if (materialOrdinal && latestMaterialBlock) {
      const target = latestMaterialBlock.items[ordinalMatch.index];
      if (!target) {
        return { kind: 'MATERIAL', ids: [], ambiguous: true };
      }
      return {
        kind: 'MATERIAL',
        ids: [target.materialId],
        ambiguous: false,
      };
    }

    if (projectOrdinal) {
      const projectItems =
        latestProjectList ??
        latestProjectBlock?.items.map((item) => ({
          projectId: item.projectId,
          title: item.title,
        }));
      if (projectItems) {
        const target = projectItems[ordinalMatch.index];
        if (target) {
          return {
            kind: 'PROJECT',
            ids: [target.projectId],
            ambiguous: false,
          };
        }
      }

      const target = recentProjects[ordinalMatch.index];
      if (!target) {
        return { kind: 'PROJECT', ids: [], ambiguous: true };
      }
      return { kind: 'PROJECT', ids: [target.id], ambiguous: false };
    }

    if (latestMaterialBlock) {
      const target = latestMaterialBlock.items[ordinalMatch.index];
      if (target) {
        return {
          kind: 'MATERIAL',
          ids: [target.materialId],
          ambiguous: false,
        };
      }
    }
  }

  if (/(this material|هاي المادة|هالمواد|هالمادة)/i.test(text)) {
    const latest = recentMaterials[recentMaterials.length - 1];
    if (!latest) {
      return null;
    }
    return { kind: 'MATERIAL', ids: [latest.id], ambiguous: false };
  }

  if (/(this project|هذا المشروع|هالمشروع)/i.test(text)) {
    const latest = recentProjects[recentProjects.length - 1];
    if (!latest) {
      return null;
    }
    return { kind: 'PROJECT', ids: [latest.id], ambiguous: false };
  }

  if (
    !detectComponentMaterialMatchingIntent(input.userMessage) &&
    /(missing component|المكون الناقص)/i.test(text)
  ) {
    const checklist = findLatestChecklistBlock(assistantBlocks);
    if (checklist) {
      const missing = checklist.items.find(
        (item) => item.status === 'MISSING' || item.status === 'AVAILABLE',
      );
      if (missing) {
        return { kind: 'COMPONENT', ids: [missing.componentId], ambiguous: false };
      }
    }
  }

  if (refersToMaterials(input.userMessage) && !refersToProjects(input.userMessage)) {
    const materialFromBlock = latestMaterialBlock?.items[0];
    if (materialFromBlock && /(احكيلي|اخبرني|tell me|حكيلي|تفاصيل|details)/i.test(text)) {
      return {
        kind: 'MATERIAL',
        ids: [materialFromBlock.materialId],
        ambiguous: false,
      };
    }
  }

  const projectMatch = await resolveProjectFromMessage({
    conversationId: input.conversationId,
    userMessage: input.userMessage,
  });
  if (projectMatch) {
    return {
      kind: 'PROJECT',
      ids: [projectMatch.entity.id],
      ambiguous: false,
    };
  }

  if (refersToMaterials(input.userMessage)) {
    const latest = recentMaterials[recentMaterials.length - 1];
    if (latest) {
      return { kind: 'MATERIAL', ids: [latest.id], ambiguous: false };
    }
  }

  return null;
};

export type BuildGuideMaterialActionIntent = {
  action: 'LINK' | 'UNLINK' | 'RESERVE' | 'NONE';
  ordinal: number | null;
  referenceText: string | null;
  confidence: number;
  source: 'deterministic' | 'fuzzy';
};

const BUILD_GUIDE_RESULT_NOUNS = [
  'مادة',
  'مواد',
  'وحدة',
  'واحدة',
  'خيار',
  'نتيجة',
  'عنصر',
  'material',
  'materials',
  'unit',
  'option',
  'result',
  'one',
];

const BUILD_GUIDE_LINK_VERBS = ['اربط', 'ربط', 'link'];
const BUILD_GUIDE_SELECT_VERBS = [
  'اختار',
  'اختر',
  'استخدم',
  'خد',
  'خلينا نستخدم',
  'choose',
  'use',
  'pick',
];

const messageIncludesNormalizedToken = (
  message: string,
  tokens: string[],
): boolean => {
  const normalized = normalizeBuildReferenceText(message);
  return tokens.some((token) => {
    const normalizedToken = normalizeBuildReferenceText(token);
    return normalizedToken.length >= 2 && normalized.includes(normalizedToken);
  });
};

export const resolveBuildGuideMaterialOrdinal = (userMessage: string): number => {
  for (const ordinal of ORDINAL_PATTERNS) {
    if (ordinal.patterns.some((pattern) => pattern.test(userMessage))) {
      return ordinal.index;
    }
  }

  if (/(رقم\s*واحد|option\s*one|option\s*1)\b/i.test(userMessage)) {
    return 0;
  }
  if (/(رقم\s*اثنين|option\s*two|option\s*2)\b/i.test(userMessage)) {
    return 1;
  }
  if (/(رقم\s*ثلاثة|option\s*three|option\s*3)\b/i.test(userMessage)) {
    return 2;
  }
  if (/\bfirst\b/i.test(userMessage)) {
    return 0;
  }
  if (/\bsecond\b/i.test(userMessage)) {
    return 1;
  }
  if (/\bthird\b/i.test(userMessage)) {
    return 2;
  }

  return 0;
};

const tryFuzzyBuildGuideLinkIntent = (
  userMessage: string,
): BuildGuideMaterialActionIntent | null => {
  const collapsed = normalizeBuildReferenceText(userMessage).replace(/\s+/g, '');
  const fuzzyLink =
    collapsed.includes('اربط') ||
    collapsed.includes('ربط') ||
    /\blink(the)?(first|1|one)/i.test(collapsed);
  const fuzzySelect =
    /(اختار|اختر|استخدم|خد|choose|use|pick)/i.test(userMessage) &&
    /(اول|أول|first|1)/i.test(userMessage);

  if (!fuzzyLink && !fuzzySelect) {
    return null;
  }

  return {
    action: 'LINK',
    ordinal: resolveBuildGuideMaterialOrdinal(userMessage),
    referenceText: null,
    confidence: 0.72,
    source: 'fuzzy',
  };
};

const detectBuildGuideUnlinkIntent = (text: string): boolean =>
  /(فك الربط|فك ربط|الغ.? الربط|شيل المادة المربوطة|افصل المادة عن المكون|unlink it|remove the linked material)/i.test(
    text,
  ) ||
  (/(فك الربط|فك ربط|unlink)/i.test(text) &&
    /(مكون|component|مادة|material)/i.test(text)) ||
  (/\bunlink\b/i.test(text) && /\b(material|component)\b/i.test(text));

export const parseBuildGuideMaterialActionIntent = (
  userMessage: string,
): BuildGuideMaterialActionIntent | null => {
  const text = userMessage.toLowerCase();
  if (detectBuildGuideUnlinkIntent(text)) {
    return {
      action: 'UNLINK',
      ordinal: null,
      referenceText: null,
      confidence: 0.95,
      source: 'deterministic',
    };
  }

  if (/(احجز|reserve|book)/i.test(text)) {
    return {
      action: 'RESERVE',
      ordinal: null,
      referenceText: null,
      confidence: 0.95,
      source: 'deterministic',
    };
  }

  const hasLinkVerb =
    messageIncludesNormalizedToken(userMessage, BUILD_GUIDE_LINK_VERBS) ||
    /\blink\b/i.test(userMessage);
  const hasSelectVerb = messageIncludesNormalizedToken(
    userMessage,
    BUILD_GUIDE_SELECT_VERBS,
  );
  const hasResultNoun = messageIncludesNormalizedToken(
    userMessage,
    BUILD_GUIDE_RESULT_NOUNS,
  );
  const hasOrdinalCue =
    ORDINAL_PATTERNS.some((ordinal) =>
      ordinal.patterns.some((pattern) => pattern.test(userMessage)),
    ) ||
    /\b(first|second|third|one)\b/i.test(userMessage) ||
    /(رقم\s*(واحد|اثنين|ثلاثة)|option\s*(one|two|three|1|2|3))/i.test(
      userMessage,
    );
  const linksViaPronoun =
    /(واربطها|واربطه|and link|then link|link it|link them)/i.test(userMessage);
  const suitableThenLink = /(مناسبة|مناسب|suitable).*(اربط|link|ربط)/i.test(
    userMessage,
  );

  if (
    hasLinkVerb ||
    linksViaPronoun ||
    suitableThenLink ||
    (hasSelectVerb && (hasOrdinalCue || hasResultNoun))
  ) {
    return {
      action: 'LINK',
      ordinal: resolveBuildGuideMaterialOrdinal(userMessage),
      referenceText: null,
      confidence: 0.95,
      source: 'deterministic',
    };
  }

  return tryFuzzyBuildGuideLinkIntent(userMessage);
};

export const detectBuildGuideLinkAction = (userMessage: string): boolean =>
  parseBuildGuideMaterialActionIntent(userMessage)?.action === 'LINK';

export const resolveBuildItemIdForLinkedMaterial = async (input: {
  trustedProjectBuildId: string;
  materialId: string;
  authenticatedUserId: string;
}): Promise<string | null> => {
  const build = await getOwnedProjectBuildByBuildId(
    input.trustedProjectBuildId,
    input.authenticatedUserId,
  );
  if (!build) {
    return null;
  }

  return (
    build.items.find((item) => item.linkedMaterial?.id === input.materialId)?.id ??
    null
  );
};

export const resolveLinkActionTargets = async (input: {
  conversationId: string;
  userMessage: string;
}): Promise<{ materialId: string; componentId: string } | null> => {
  const assistantBlocks = await loadRecentAssistantBlocks(input.conversationId);
  const latestMatches = findLatestComponentMatchesBlock(assistantBlocks);
  const latestMaterialBlock = findLatestMaterialResultsBlock(assistantBlocks);
  const checklist = findLatestChecklistBlock(assistantBlocks);

  let materialId: string | null = null;
  let componentId: string | null = null;
  const materialIndex = resolveBuildGuideMaterialOrdinal(input.userMessage);
  const normalizedMessage = input.userMessage.toLowerCase();

  const matchComponentGroupFromMessage = (
    groups: NonNullable<typeof latestMatches>['groups'],
  ) => {
    for (const group of groups) {
      const componentName = group.componentName.toLowerCase();
      if (componentName.length >= 2 && normalizedMessage.includes(componentName)) {
        return group;
      }
    }

    const forComponentMatch = input.userMessage.match(
      /(?:بال|لل|for|to)\s*([^\s؟?.!,]+)/i,
    );
    const token = forComponentMatch?.[1]?.toLowerCase().trim();
    if (!token || token.length < 2) {
      return null;
    }

    return (
      groups.find((group) => {
        const componentName = group.componentName.toLowerCase();
        return componentName.includes(token) || token.includes(componentName);
      }) ?? null
    );
  };

  if (latestMatches) {
    const explicitGroup = matchComponentGroupFromMessage(latestMatches.groups);
    if (explicitGroup) {
      componentId = explicitGroup.componentId;
      materialId =
        explicitGroup.materials[materialIndex]?.materialId ??
        (materialIndex === 0 ? explicitGroup.materials[0]?.materialId : null) ??
        null;
    } else {
      const flatMaterials: Array<{ materialId: string; componentId: string }> = [];
      for (const group of latestMatches.groups) {
        for (const material of group.materials) {
          if (material.materialId) {
            flatMaterials.push({
              materialId: material.materialId,
              componentId: group.componentId,
            });
          }
        }
      }

      const selected = flatMaterials[materialIndex] ?? flatMaterials[0] ?? null;
      if (selected) {
        materialId = selected.materialId;
        componentId = selected.componentId;
      }
    }
  }

  if (!materialId && latestMaterialBlock) {
    materialId =
      latestMaterialBlock.items[materialIndex]?.materialId ??
      (materialIndex === 0 ? latestMaterialBlock.items[0]?.materialId : null) ??
      null;
  }

  if (!componentId) {
    const missingItem =
      checklist?.items.find(
        (item) => item.status === 'MISSING' || item.status === 'AVAILABLE',
      ) ?? null;
    componentId = missingItem?.componentId ?? null;
  }

  if (!materialId || !componentId) {
    return null;
  }

  return {
    materialId,
    componentId,
  };
};

export const resolveOwnedBuildForProjectTitle = async (input: {
  titleQuery: string;
  userId: string;
}): Promise<{ buildId: string; projectId: string } | null> => {
  const normalized = input.titleQuery.trim();
  if (normalized.length < 3) {
    return null;
  }

  const viewer = { sub: input.userId, roles: ['LEARNER'] as string[] };
  const projects = await getLearningProjects(
    { page: 1, limit: 8, q: normalized },
    viewer,
  );

  const exact =
    projects.items.find(
      (project) => project.title.toLowerCase() === normalized.toLowerCase(),
    ) ??
    (projects.items.length === 1 ? projects.items[0] : null);

  if (!exact) {
    return null;
  }

  const build = await learningProjectsRepository.findProjectBuild(exact.id, input.userId);
  if (!build) {
    return null;
  }

  return { buildId: build.id, projectId: build.projectId };
};

export const resolveBuildIdForUserMessage = async (input: {
  conversationId: string;
  userMessage: string;
  userId: string;
}): Promise<{ buildId: string; projectId: string } | null> => {
  const explicitTitle = extractProjectTitleQuery(input.userMessage);
  if (explicitTitle) {
    const owned = await resolveOwnedBuildForProjectTitle({
      titleQuery: explicitTitle,
      userId: input.userId,
    });
    if (owned) {
      return owned;
    }
  }

  const fromChat = await resolveLatestBuildId(input.conversationId);
  if (fromChat) {
    const build = await getOwnedProjectBuildByBuildId(fromChat, input.userId);
    if (build) {
      return { buildId: build.id, projectId: build.projectId };
    }
  }

  const projectMatch = await resolveProjectFromMessage({
    conversationId: input.conversationId,
    userMessage: input.userMessage,
    explicitQuery: extractProjectTitleQuery(input.userMessage),
  });

  if (projectMatch) {
    const build = await learningProjectsRepository.findProjectBuild(
      projectMatch.entity.id,
      input.userId,
    );
    if (build) {
      return { buildId: build.id, projectId: build.projectId };
    }
    return null;
  }

  const titleQuery = extractProjectTitleQuery(input.userMessage);
  if (titleQuery) {
    const viewer = { sub: input.userId, roles: ['LEARNER'] as string[] };
    const projects = await getLearningProjects(
      { page: 1, limit: 5, q: titleQuery },
      viewer,
    );
    const exact =
      projects.items.find(
        (project) =>
          project.title.toLowerCase() === titleQuery.toLowerCase(),
      ) ?? projects.items[0];

    if (exact) {
      const build = await learningProjectsRepository.findProjectBuild(
        exact.id,
        input.userId,
      );
      if (build) {
        return { buildId: build.id, projectId: build.projectId };
      }
    }
  }

  const activeBuilds = await listActiveProjectBuildsForLearner(input.userId);
  if (activeBuilds.length === 1) {
    return {
      buildId: activeBuilds[0]!.id,
      projectId: activeBuilds[0]!.projectId,
    };
  }

  return null;
};

export const resolveLatestBuildId = async (
  conversationId: string,
): Promise<string | null> => {
  const assistantBlocks = await loadRecentAssistantBlocks(conversationId);

  for (let index = assistantBlocks.length - 1; index >= 0; index -= 1) {
    const block = assistantBlocks[index];
    if (block.type === 'build_checklist') {
      return block.buildId;
    }
  }

  for (let index = assistantBlocks.length - 1; index >= 0; index -= 1) {
    const block = assistantBlocks[index];
    if (block.type === 'component_matches' && block.buildId) {
      return block.buildId;
    }
  }

  for (let index = assistantBlocks.length - 1; index >= 0; index -= 1) {
    const block = assistantBlocks[index];
    if (block.type === 'project_results') {
      for (let itemIndex = block.items.length - 1; itemIndex >= 0; itemIndex -= 1) {
        const item = block.items[itemIndex];
        if (item.activeBuildId) {
          return item.activeBuildId;
        }
      }
    }
  }

  return null;
};

type OwnedBuild = NonNullable<Awaited<ReturnType<typeof getOwnedProjectBuildByBuildId>>>;
type OwnedBuildItem = OwnedBuild['items'][number];

export type BuildGuideLinkedTarget = {
  projectId: string;
  projectTitle: string;
  buildId: string;
  buildItemId: string;
  componentId: string;
  componentName: string;
  materialId: string;
  materialTitle: string;
};

export type BuildGuideUnlinkResolution =
  | { kind: 'resolved'; target: BuildGuideLinkedTarget }
  | {
      kind: 'ambiguous';
      items: Array<{ componentName: string; materialTitle: string }>;
    }
  | { kind: 'not_found' };

export type BuildGuideReservationResolution =
  | { kind: 'resolved'; target: BuildGuideLinkedTarget }
  | {
      kind: 'active_reservation';
      target: BuildGuideLinkedTarget;
      reservationStatus: string;
      reservationStatusLabel: string;
    }
  | {
      kind: 'ambiguous';
      items: Array<{ componentName: string; materialTitle: string }>;
    }
  | { kind: 'not_eligible'; reason: 'material_unavailable' | 'link_removed' }
  | { kind: 'not_found' };

const normalizeBuildReferenceText = (value: string): string =>
  normalizeArabicVariants(
    value
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

const findLinkedBuildItems = (build: OwnedBuild) =>
  build.items.filter((item) => item.linkedMaterial?.id);

const toBuildGuideLinkedTarget = (
  build: OwnedBuild,
  item: OwnedBuildItem,
): BuildGuideLinkedTarget => ({
  projectId: build.projectId,
  projectTitle: build.project.title,
  buildId: build.id,
  buildItemId: item.id,
  componentId: item.requiredComponentId,
  componentName: item.component.componentName,
  materialId: item.linkedMaterial!.id,
  materialTitle: item.linkedMaterial!.title,
});

const itemMatchesMessageReference = (
  item: OwnedBuildItem,
  userMessage: string,
): boolean => {
  const normalizedMessage = normalizeBuildReferenceText(userMessage);
  const candidates = [
    item.component.componentName,
    item.component.materialType,
    item.linkedMaterial?.title,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => normalizeBuildReferenceText(value))
    .filter((value) => value.length >= 2);

  return candidates.some((candidate) => normalizedMessage.includes(candidate));
};

const findLatestSuccessfulLinkActionResult = (
  blocks: AiContentBlock[],
  trustedBuildId: string,
): Extract<AiContentBlock, { type: 'action_result' }> | null => {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (
      block.type === 'action_result' &&
      block.actionType === 'LINK_MATERIAL_TO_BUILD_COMPONENT' &&
      block.status === 'EXECUTED' &&
      block.target?.type === 'COMPONENT' &&
      block.navigation?.route === 'project_build' &&
      block.navigation.id === trustedBuildId
    ) {
      return block;
    }
  }

  return null;
};

const hydrateLinkedTargetFromLinkResult = (
  build: OwnedBuild,
  linkResult: Extract<AiContentBlock, { type: 'action_result' }>,
): BuildGuideLinkedTarget | null => {
  const buildItemId =
    linkResult.target?.type === 'COMPONENT' ? linkResult.target.id : null;
  if (!buildItemId) {
    return null;
  }

  const item = build.items.find((entry) => entry.id === buildItemId);
  if (!item?.linkedMaterial?.id) {
    return null;
  }

  return toBuildGuideLinkedTarget(build, item);
};

const findComponentItemByMessage = (
  build: OwnedBuild,
  userMessage: string,
): OwnedBuildItem | null => {
  const normalizedMessage = normalizeBuildReferenceText(userMessage);

  for (const item of build.items) {
    const names = [item.component.componentName, item.component.materialType]
      .map((value) => normalizeBuildReferenceText(value))
      .filter((value) => value.length >= 2);

    if (names.some((name) => normalizedMessage.includes(name))) {
      return item;
    }
  }

  return null;
};

const hasActiveReservationHold = (item: OwnedBuildItem): boolean => {
  if (!item.linkedReservation) {
    return false;
  }

  return isActiveReservationBehaviorStatus(
    item.linkedReservation.status as ReservationStatus,
  );
};

const isEligibleLinkedReservationItem = (item: OwnedBuildItem): boolean => {
  if (!item.linkedMaterial?.id) {
    return false;
  }

  if (item.linkedReservation?.status === 'COMPLETED') {
    return false;
  }

  if (hasActiveReservationHold(item)) {
    return false;
  }

  return item.linkedMaterial.status === 'AVAILABLE';
};

const resolveMaterialFromComponentMatches = (
  blocks: AiContentBlock[],
  trustedBuildId: string,
  userMessage: string,
  build: OwnedBuild,
): OwnedBuildItem | null => {
  const matches = findLatestComponentMatchesBlock(blocks);
  if (!matches || matches.buildId !== trustedBuildId) {
    return null;
  }

  const ordinalMatch = ORDINAL_PATTERNS.find((ordinal) =>
    ordinal.patterns.some((pattern) => pattern.test(userMessage)),
  );
  const materialIndex = ordinalMatch?.index ?? 0;
  const normalizedMessage = userMessage.toLowerCase();

  for (const group of matches.groups) {
    const componentName = group.componentName.toLowerCase();
    const explicitComponent =
      componentName.length >= 2 && normalizedMessage.includes(componentName);
    const selectedMaterial =
      group.materials[materialIndex]?.materialId ?? group.materials[0]?.materialId;
    if (!selectedMaterial) {
      continue;
    }

    if (explicitComponent || matches.groups.length === 1) {
      const item = build.items.find(
        (entry) =>
          entry.requiredComponentId === group.componentId &&
          entry.linkedMaterial?.id === selectedMaterial,
      );
      if (item) {
        return item;
      }
    }
  }

  return null;
};

const buildAmbiguousLinkedItems = (
  items: OwnedBuildItem[],
): Array<{ componentName: string; materialTitle: string }> =>
  items
    .filter((item) => item.linkedMaterial?.id)
    .map((item) => ({
      componentName: item.component.componentName,
      materialTitle: item.linkedMaterial!.title,
    }));

const finalizeReservationTarget = (
  build: OwnedBuild,
  item: OwnedBuildItem,
): BuildGuideReservationResolution => {
  if (!item.linkedMaterial?.id) {
    return { kind: 'not_eligible', reason: 'link_removed' };
  }

  if (hasActiveReservationHold(item)) {
    return {
      kind: 'active_reservation',
      target: toBuildGuideLinkedTarget(build, item),
      reservationStatus: item.linkedReservation!.status,
      reservationStatusLabel: item.linkedReservation!.statusLabel,
    };
  }

  if (item.linkedMaterial.status !== 'AVAILABLE') {
    return { kind: 'not_eligible', reason: 'material_unavailable' };
  }

  return { kind: 'resolved', target: toBuildGuideLinkedTarget(build, item) };
};

export const resolveBuildGuideUnlinkTarget = async (input: {
  conversationId: string;
  userMessage: string;
  trustedProjectBuildId: string;
  authenticatedUserId: string;
}): Promise<BuildGuideUnlinkResolution> => {
  const build = await getOwnedProjectBuildByBuildId(
    input.trustedProjectBuildId,
    input.authenticatedUserId,
  );
  if (!build) {
    return { kind: 'not_found' };
  }

  const blocks = await loadRecentAssistantBlocks(input.conversationId);
  const linkedItems = findLinkedBuildItems(build);

  const explicitMatches = linkedItems.filter((item) =>
    itemMatchesMessageReference(item, input.userMessage),
  );
  if (explicitMatches.length === 1) {
    return {
      kind: 'resolved',
      target: toBuildGuideLinkedTarget(build, explicitMatches[0]!),
    };
  }
  if (explicitMatches.length > 1) {
    return { kind: 'ambiguous', items: buildAmbiguousLinkedItems(explicitMatches) };
  }

  const linkResult = findLatestSuccessfulLinkActionResult(
    blocks,
    input.trustedProjectBuildId,
  );
  if (linkResult) {
    const target = hydrateLinkedTargetFromLinkResult(build, linkResult);
    if (target) {
      return { kind: 'resolved', target };
    }
  }

  if (linkedItems.length === 1) {
    return {
      kind: 'resolved',
      target: toBuildGuideLinkedTarget(build, linkedItems[0]!),
    };
  }

  if (linkedItems.length > 1) {
    return { kind: 'ambiguous', items: buildAmbiguousLinkedItems(linkedItems) };
  }

  return { kind: 'not_found' };
};

export const resolveBuildGuideReservationTarget = async (input: {
  conversationId: string;
  userMessage: string;
  trustedProjectBuildId: string;
  authenticatedUserId: string;
}): Promise<BuildGuideReservationResolution> => {
  const build = await getOwnedProjectBuildByBuildId(
    input.trustedProjectBuildId,
    input.authenticatedUserId,
  );
  if (!build) {
    return { kind: 'not_found' };
  }

  const blocks = await loadRecentAssistantBlocks(input.conversationId);
  const linkedItems = findLinkedBuildItems(build);
  const linkResult = findLatestSuccessfulLinkActionResult(
    blocks,
    input.trustedProjectBuildId,
  );

  const explicitMatches = linkedItems.filter((item) =>
    itemMatchesMessageReference(item, input.userMessage),
  );
  if (explicitMatches.length === 1) {
    return finalizeReservationTarget(build, explicitMatches[0]!);
  }
  if (explicitMatches.length > 1) {
    return { kind: 'ambiguous', items: buildAmbiguousLinkedItems(explicitMatches) };
  }

  if (linkResult) {
    const target = hydrateLinkedTargetFromLinkResult(build, linkResult);
    if (target) {
      const item = build.items.find((entry) => entry.id === target.buildItemId);
      if (item) {
        return finalizeReservationTarget(build, item);
      }
    }
  }

  const componentItem = findComponentItemByMessage(build, input.userMessage);
  if (componentItem?.linkedMaterial?.id) {
    return finalizeReservationTarget(build, componentItem);
  }

  const eligibleItems = linkedItems.filter(isEligibleLinkedReservationItem);
  if (eligibleItems.length === 1) {
    return finalizeReservationTarget(build, eligibleItems[0]!);
  }

  if (!linkResult) {
    const matchesItem = resolveMaterialFromComponentMatches(
      blocks,
      input.trustedProjectBuildId,
      input.userMessage,
      build,
    );
    if (matchesItem) {
      return finalizeReservationTarget(build, matchesItem);
    }
  }

  if (linkedItems.length === 1 && hasActiveReservationHold(linkedItems[0]!)) {
    const item = linkedItems[0]!;
    return {
      kind: 'active_reservation',
      target: toBuildGuideLinkedTarget(build, item),
      reservationStatus: item.linkedReservation!.status,
      reservationStatusLabel: item.linkedReservation!.statusLabel,
    };
  }

  if (eligibleItems.length > 1 || linkedItems.length > 1) {
    return {
      kind: 'ambiguous',
      items: buildAmbiguousLinkedItems(
        eligibleItems.length > 0 ? eligibleItems : linkedItems,
      ),
    };
  }

  return { kind: 'not_found' };
};
