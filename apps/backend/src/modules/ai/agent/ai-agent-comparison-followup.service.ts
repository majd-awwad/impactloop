import type { AiContentBlock } from '../ai.content-blocks.js';
import { parseStoredContentBlocks } from '../ai-context-builder.js';
import { listMessagesForConversation } from '../ai.repository.js';
import type { AiLocale } from '../ai.types.js';
import { detectComparisonFollowUpIntent } from './ai-agent-filter-extractor.service.js';

export const findLatestComparisonBlock = async (
  conversationId: string,
): Promise<Extract<AiContentBlock, { type: 'comparison' }> | null> => {
  const { total } = await listMessagesForConversation({
    conversationId,
    limit: 1,
    offset: 0,
  });
  const { items } = await listMessagesForConversation({
    conversationId,
    limit: 24,
    offset: Math.max(0, total - 24),
  });

  for (let messageIndex = items.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = items[messageIndex];
    if (message.role !== 'ASSISTANT') {
      continue;
    }

    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (let blockIndex = blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = blocks[blockIndex];
      if (block.type === 'comparison') {
        return block;
      }
    }
  }

  return null;
};

const parsePriceValue = (priceLabel: string): number => {
  const normalized = priceLabel.trim().toLowerCase();
  if (normalized === 'free' || normalized === 'مجاني') {
    return 0;
  }

  const digits = priceLabel.replace(/[^\d.]/g, '');
  const parsed = Number.parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const parseDistanceKm = (facts: string[]): number | null => {
  const distanceFact = facts.find((fact) => /distance/i.test(fact));
  if (!distanceFact || /n\/a|غير متوفر/i.test(distanceFact)) {
    return null;
  }

  const match = distanceFact.match(/([\d.]+)\s*km/i);
  return match ? Number.parseFloat(match[1]!) : null;
};

const parseDifficultyRank = (facts: string[]): number => {
  const difficultyFact = facts.find((fact) => /difficulty/i.test(fact)) ?? '';
  const normalized = difficultyFact.toLowerCase();
  if (normalized.includes('beginner') || normalized.includes('مبتدئ')) {
    return 1;
  }
  if (normalized.includes('intermediate') || normalized.includes('متوسط')) {
    return 2;
  }
  if (normalized.includes('advanced') || normalized.includes('متقدم')) {
    return 3;
  }
  return 99;
};

const parseEstimatedMinutes = (facts: string[]): number => {
  const timeFact = facts.find((fact) => /estimated time/i.test(fact)) ?? '';
  const minuteMatch = timeFact.match(/(\d+)\s*(?:min|mins|minutes|دقيقة|دقائق)/i);
  if (minuteMatch) {
    return Number.parseInt(minuteMatch[1]!, 10);
  }
  const hourMatch = timeFact.match(/(\d+)\s*(?:h|hour|hours|ساعة|ساعات)/i);
  if (hourMatch) {
    return Number.parseInt(hourMatch[1]!, 10) * 60;
  }
  if (/(?:ساعتان|ساعتين|two\s+hours?)/i.test(timeFact)) {
    return 120;
  }
  if (/(?:ساعة واحدة|one\s+hour)/i.test(timeFact)) {
    return 60;
  }
  return Number.POSITIVE_INFINITY;
};

const parseStepCount = (facts: string[]): number => {
  const stepFact = facts.find((fact) => /steps/i.test(fact)) ?? '';
  const match = stepFact.match(/steps:\s*(\d+)/i);
  return match ? Number.parseInt(match[1]!, 10) : 0;
};

const parseComponentCount = (facts: string[]): number => {
  const componentFact = facts.find((fact) => /components/i.test(fact)) ?? '';
  const match = componentFact.match(/components:\s*(\d+)/i);
  return match ? Number.parseInt(match[1]!, 10) : 0;
};

export type ComparisonCriterion =
  | 'cheaper'
  | 'closer'
  | 'easier'
  | 'shorter'
  | 'beginner'
  | 'moreComponents'
  | 'fewerComponents'
  | 'fewerSteps';

export const detectComparisonCriterion = (
  userMessage: string,
): ComparisonCriterion | null => {
  if (/(أرخص|ارخص|cheaper|lower price|أقل سعر)/i.test(userMessage)) {
    return 'cheaper';
  }
  if (/(أقرب|اقرب|closer|nearest|near)/i.test(userMessage)) {
    return 'closer';
  }
  if (
    /(أسهل|اسهل|easier|easiest|مبتدئ|beginner|أنسب للمبتدئ|انسب للمبتدئ)/i.test(
      userMessage,
    )
  ) {
    return /(مبتدئ|beginner|أنسب|انسب)/i.test(userMessage) ? 'beginner' : 'easier';
  }
  if (
    /(أقل وقت|وقته أقل|وقت أقل|مدته أقل|مدة أقل|shorter|less time|أسرع|أسرع تنفيذ|which one takes less time|takes less time|which one is shorter|وقت أقصر|وقت اقصر|بوقت أقصر|مين بخلص أسرع)/i.test(
      userMessage,
    )
  ) {
    return 'shorter';
  }
  if (/(أقل مكونات|مكونات أقل|fewer components|less components)/i.test(userMessage)) {
    return 'fewerComponents';
  }
  if (/(أقل خطوات|خطوات أقل|fewer steps|less steps)/i.test(userMessage)) {
    return 'fewerSteps';
  }
  if (/(مكوناته متوفرة|أكثر مكونات|more components|components available)/i.test(userMessage)) {
    return 'moreComponents';
  }
  return null;
};

const pickWinnerIndex = (
  block: Extract<AiContentBlock, { type: 'comparison' }>,
  criterion: ComparisonCriterion,
): number | null => {
  if (block.items.length < 2) {
    return null;
  }

  if (block.subject === 'MATERIAL') {
    if (criterion === 'cheaper') {
      let bestIndex = 0;
      let bestPrice = parsePriceValue(block.items[0]!.facts[0] ?? '');
      for (let index = 1; index < block.items.length; index += 1) {
        const price = parsePriceValue(block.items[index]!.facts[0] ?? '');
        if (price < bestPrice) {
          bestPrice = price;
          bestIndex = index;
        }
      }
      return bestIndex;
    }

    if (criterion === 'closer') {
      const distances = block.items.map((item) => parseDistanceKm(item.facts));
      if (distances.every((distance) => distance == null)) {
        return null;
      }

      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < distances.length; index += 1) {
        const distance = distances[index];
        if (distance != null && distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
      return Number.isFinite(bestDistance) ? bestIndex : null;
    }

    return null;
  }

  if (criterion === 'easier' || criterion === 'beginner') {
    let bestIndex = 0;
    let bestRank = parseDifficultyRank(block.items[0]!.facts);
    for (let index = 1; index < block.items.length; index += 1) {
      const rank = parseDifficultyRank(block.items[index]!.facts);
      if (rank < bestRank) {
        bestRank = rank;
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  if (criterion === 'shorter') {
    let bestIndex = 0;
    let bestMinutes = parseEstimatedMinutes(block.items[0]!.facts);
    for (let index = 1; index < block.items.length; index += 1) {
      const minutes = parseEstimatedMinutes(block.items[index]!.facts);
      if (minutes < bestMinutes) {
        bestMinutes = minutes;
        bestIndex = index;
      }
    }
    return Number.isFinite(bestMinutes) ? bestIndex : null;
  }

  if (criterion === 'moreComponents') {
    let bestIndex = 0;
    let bestCount = parseComponentCount(block.items[0]!.facts);
    for (let index = 1; index < block.items.length; index += 1) {
      const count = parseComponentCount(block.items[index]!.facts);
      if (count > bestCount) {
        bestCount = count;
        bestIndex = index;
      }
    }
    return bestCount > 0 ? bestIndex : null;
  }

  if (criterion === 'fewerComponents') {
    let bestIndex = 0;
    let bestCount = parseComponentCount(block.items[0]!.facts);
    for (let index = 1; index < block.items.length; index += 1) {
      const count = parseComponentCount(block.items[index]!.facts);
      if (count < bestCount) {
        bestCount = count;
        bestIndex = index;
      }
    }
    return bestCount > 0 ? bestIndex : null;
  }

  if (criterion === 'fewerSteps') {
    let bestIndex = 0;
    let bestSteps = parseStepCount(block.items[0]!.facts);
    for (let index = 1; index < block.items.length; index += 1) {
      const steps = parseStepCount(block.items[index]!.facts);
      if (steps < bestSteps) {
        bestSteps = steps;
        bestIndex = index;
      }
    }
    return bestSteps > 0 ? bestIndex : null;
  }

  return null;
};

export const buildComparisonFollowUpAnswer = (input: {
  userMessage: string;
  locale: AiLocale;
  block: Extract<AiContentBlock, { type: 'comparison' }>;
}): { text: string; winnerId: string; winnerTitle: string } | null => {
  const criterion = detectComparisonCriterion(input.userMessage);
  if (!criterion) {
    return null;
  }

  const winnerIndex = pickWinnerIndex(input.block, criterion);
  if (winnerIndex == null) {
    if (criterion === 'closer' && input.block.subject === 'MATERIAL') {
      return {
        text:
          input.locale === 'ar'
            ? 'المقارنة الحالية لا تحتوي على مسافة موثوقة لكل مادة، لذلك لا أستطيع تحديد الأقرب بدقة.'
            : 'The current comparison does not include trusted distance data for each material, so I cannot determine which is closer.',
        winnerId: '',
        winnerTitle: '',
      };
    }
    return null;
  }

  const winner = input.block.items[winnerIndex]!;
  const intro =
    input.locale === 'ar'
      ? criterion === 'cheaper'
        ? `بناءً على المقارنة السابقة، الأرخص هو ${winner.title}.`
        : criterion === 'closer'
          ? `بناءً على المقارنة السابقة، الأقرب هو ${winner.title}.`
          : criterion === 'shorter'
            ? `بناءً على المقارنة السابقة، الأقل وقتًا هو ${winner.title}.`
            : criterion === 'moreComponents'
              ? `بناءً على المقارنة السابقة، الأكثر مكونات هو ${winner.title}.`
              : criterion === 'fewerComponents'
                ? `بناءً على المقارنة السابقة، الأقل مكونات هو ${winner.title}.`
                : criterion === 'fewerSteps'
                  ? `بناءً على المقارنة السابقة، الأقل خطوات هو ${winner.title}.`
                  : criterion === 'beginner'
                ? `بناءً على المقارنة السابقة، الأنسب للمبتدئ هو ${winner.title}.`
                : `بناءً على المقارنة السابقة، الأسهل هو ${winner.title}.`
      : criterion === 'cheaper'
        ? `Based on the previous comparison, the cheaper option is ${winner.title}.`
        : criterion === 'closer'
          ? `Based on the previous comparison, the closer option is ${winner.title}.`
          : criterion === 'shorter'
            ? `Based on the previous comparison, the shorter option is ${winner.title}.`
            : criterion === 'moreComponents'
              ? `Based on the previous comparison, the project with more components is ${winner.title}.`
              : criterion === 'fewerComponents'
                ? `Based on the previous comparison, the project with fewer components is ${winner.title}.`
                : criterion === 'fewerSteps'
                  ? `Based on the previous comparison, the project with fewer steps is ${winner.title}.`
                  : criterion === 'beginner'
                ? `Based on the previous comparison, the best beginner option is ${winner.title}.`
                : `Based on the previous comparison, the easier option is ${winner.title}.`;

  return {
    text: intro,
    winnerId: winner.id,
    winnerTitle: winner.title,
  };
};

export const canAnswerComparisonFollowUp = async (input: {
  conversationId: string;
  userMessage: string;
}): Promise<boolean> => {
  if (!detectComparisonFollowUpIntent(input.userMessage)) {
    return false;
  }

  const block = await findLatestComparisonBlock(input.conversationId);
  return block != null;
};
