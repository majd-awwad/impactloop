import type { AiLocale } from './ai.types.js';
import {
  ACKNOWLEDGEMENT_COPY,
  CAPABILITIES_COPY,
  GOODBYE_COPY,
  GREETING_COPY,
  THANKS_COPY,
} from './ai.policy.js';
import { classifyScopeDeterministic } from './ai-scope-guard.js';

export type ConversationalIntent =
  | 'GREETING'
  | 'THANKS'
  | 'GOODBYE'
  | 'CAPABILITIES'
  | 'ACKNOWLEDGEMENT'
  | 'NONE';

const normalizeForMatch = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s?؟]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const matchesAny = (normalized: string, patterns: RegExp[]) =>
  patterns.some((pattern) => pattern.test(normalized));

const GREETING_PATTERNS = [
  /^(hi|hello|hey|hiya|yo|sup|howdy)$/u,
  /^(مرحبا|مرحبًا|أهلين|اهلين|السلام عليكم|سلام|هاي|هلا)$/u,
];

const THANKS_PATTERNS = [
  /^(thanks|thank you|thx|ty)$/u,
  /^(شكرا|شكراً|يسلمو|ممنون|متشكر|شكرا لك)$/u,
];

const GOODBYE_PATTERNS = [
  /^(bye|goodbye|see you|see ya|later)$/u,
  /^(مع السلامة|باي|الله معك|مع السلامه)$/u,
];

const ACKNOWLEDGEMENT_PATTERNS = [
  /^(okay|ok|yes|yep|understood|got it|sure|alright)$/u,
  /^(تمام|أوك|اوك|فهمت|حاضر|ماشي|طيب)$/u,
];

const CAPABILITIES_PATTERNS = [
  /\bwhat can you (?:do|help(?: with)?)\b/u,
  /\bwhat topics can you(?: answer| help with)?\b/u,
  /\bwhat (?:do you|can you) (?:answer|help with|support)\b/u,
  /\bwhat are you (?:able|allowed) to (?:do|answer)\b/u,
  /\bwhich topics\b/u,
  /\bexample questions?\b/u,
  /شو بتقدر تساعدني/u,
  /شو المواضيع(?: اللي)?(?: بتجاوب| تقدر)/u,
  /ما المواضيع(?: التي)?(?: تجيب| تساعد)/u,
  /كيف تساعدني/u,
  /شو بتقدر تعمل/u,
  /what topics do you answer/u,
];

export const detectResponseLocale = (
  text: string,
  fallback: AiLocale,
): AiLocale => {
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;

  if (arabicCount > latinCount) {
    return 'ar';
  }

  if (latinCount > arabicCount) {
    return 'en';
  }

  return fallback;
};

export const detectConversationalIntent = (text: string): ConversationalIntent => {
  const normalized = normalizeForMatch(text);
  if (!normalized) {
    return 'NONE';
  }

  const scope = classifyScopeDeterministic(text);
  if (
    scope.classification === 'OUT_OF_SCOPE' ||
    scope.classification === 'DANGEROUS_REQUEST' ||
    scope.classification === 'MIXED'
  ) {
    return 'NONE';
  }

  if (scope.classification === 'DOMAIN_KNOWLEDGE') {
    return 'NONE';
  }

  if (matchesAny(normalized, CAPABILITIES_PATTERNS)) {
    return 'CAPABILITIES';
  }

  if (matchesAny(normalized, GREETING_PATTERNS)) {
    return 'GREETING';
  }

  if (matchesAny(normalized, THANKS_PATTERNS)) {
    return 'THANKS';
  }

  if (matchesAny(normalized, GOODBYE_PATTERNS)) {
    return 'GOODBYE';
  }

  if (matchesAny(normalized, ACKNOWLEDGEMENT_PATTERNS)) {
    return 'ACKNOWLEDGEMENT';
  }

  return 'NONE';
};

export const buildConversationalResponseText = (
  intent: Exclude<ConversationalIntent, 'NONE'>,
  locale: AiLocale,
): string => {
  switch (intent) {
    case 'GREETING':
      return GREETING_COPY[locale];
    case 'THANKS':
      return THANKS_COPY[locale];
    case 'GOODBYE':
      return GOODBYE_COPY[locale];
    case 'CAPABILITIES':
      return CAPABILITIES_COPY[locale];
    case 'ACKNOWLEDGEMENT':
      return ACKNOWLEDGEMENT_COPY[locale];
  }
};
