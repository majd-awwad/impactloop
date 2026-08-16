import type { AiScopeClassification } from '../../generated/prisma/client.js';

import { aiScopeClassifierSchema } from './ai.content-blocks.js';
import { assessDangerousRequest } from './agent/ai-agent-safety-guard.service.js';

export type ScopeGuardResult = {
  classification: AiScopeClassification;
  confidence: number;
  matchedRules: string[];
  usedClassifier: boolean;
};

const normalizeForMatch = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');

const OUT_OF_SCOPE_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: 'weather',
    pattern:
      /(weather|forecast|temperature today|how(?:'| i)s the weather|الطقس|طقس|الجو|كيف الجو|how is the weather)/u,
  },
  { id: 'news', pattern: /(news|headline|latest news|أخبار|خبر)/u },
  { id: 'sports', pattern: /(sports|match score|who won|football|soccer|مباراة|فاز)/u },
  { id: 'exchange', pattern: /(exchange rate|dollar price|currency rate|سعر الدولار|اسعار العملات|سعر دولار)/u },
  { id: 'restaurant', pattern: /(restaurant|best restaurant|مطعم|مطاعم)/u },
  { id: 'recipe', pattern: /(recipe|cook|ingredients for|وصفة|مقلوبة)/u },
  { id: 'poetry', pattern: /(poetry|poem|write me a poem|شعر|اكتبلي شعر|اكتب(?:لي)?\s+شعر)/u },
  {
    id: 'geography_history',
    pattern:
      /(فلسطين|القدس|jerusalem|palestine|غزة|gaza|what is palestine|ما هي فلسطين|اشرحلي عن القدس|explain jerusalem|tell me about jerusalem)/u,
  },
  {
    id: 'general_unrelated',
    pattern:
      /(مين فاز|who won the|what is the capital of|من هو رئيس|تاريخ الدولة|political party)/u,
  },
];

const DOMAIN_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: 'arduino', pattern: /(arduino|esp32|esp826|microcontroller|uno|nano|مايكرو|اردوينo|اردوينو)/u },
  { id: 'electronics', pattern: /(electronic|circuit|breadboard|resistor|capacitor|led|pcb|الكترون|دائرة|بريدبورد)/u },
  { id: 'robotics', pattern: /(robot|robotics|servo|motor driver|relay|روبوت|محرك|سيرفo|سيرفو)/u },
  { id: 'sensors', pattern: /(sensor|ultrasonic|temperature sensor|حساس)/u },
  { id: 'woodworking', pattern: /(wood|woodworking|plywood|saw|lumber|خشب|نجارة)/u },
  { id: 'fabric', pattern: /(fabric|textile|sewing|cotton|قماش|خياطة)/u },
  {
    id: 'art_crafts',
    pattern:
      /(شمع|شمعة|شموع|صناعة\s*الشمع|قوالب\s*الشمع|أشغال\s*يدوية|اشغال\s*يدوية|حرف\s*يدوية|صناعة\s*يدوية|candle|candles|wax|craft|crafts|handicraft|handmade\s*project)/u,
  },
  { id: 'diy', pattern: /(diy|project idea|recycling|reuse|upcycle|مشروع|اعادة استخدام|إعادة استخدام)/u },
  { id: 'tools', pattern: /(solder|soldering iron|drill|tool safety|لحام|كاوية|كاويه|ادوات|أدوات)/u },
  {
    id: 'batteries',
    pattern: /(battery|batteries|lithium|aa\b|aaa\b|power pack|بطارية|بطاريات|ليثيوم)/u,
  },
  {
    id: 'heat_tools',
    pattern: /(hot glue|glue gun|heat gun|مسدس شمع|لصق حراري|صمغ حراري)/u,
  },
  {
    id: 'sharp_tools',
    pattern: /(scissors|craft knife|utility knife|cutting tool|مقص|سكين|منشار)/u,
  },
  {
    id: 'adhesives',
    pattern: /(glue|adhesive|epoxy|super glue|غراء|لاصق|صمغ)/u,
  },
  {
    id: 'solvents',
    pattern: /(solvent|acetone|thinner|paint thinner|مذيب|اسيتون)/u,
  },
  { id: 'materials', pattern: /(material|component|alternative|substitute|مواد|بديل)/u },
  { id: 'safety', pattern: /(safety|precaution|safe|احتياط|احتياطات|سلامة|بأمان)/u },
];

const DANGEROUS_PATTERNS: Array<{ id: string; pattern: RegExp }> = [];

const LEGITIMATE_SAFETY_PATTERNS: RegExp[] = [];

const matchPatterns = (
  normalized: string,
  patterns: Array<{ id: string; pattern: RegExp }>,
) => patterns.filter(({ pattern }) => pattern.test(normalized)).map(({ id }) => id);

export const classifyScopeDeterministic = (text: string): ScopeGuardResult => {
  const normalized = normalizeForMatch(text);
  const dangerousAssessment = assessDangerousRequest(text);
  const outOfScope = matchPatterns(normalized, OUT_OF_SCOPE_PATTERNS);
  const domain = matchPatterns(normalized, DOMAIN_PATTERNS);
  const dangerous = dangerousAssessment.isDangerous
    ? dangerousAssessment.matchedRules
    : matchPatterns(normalized, DANGEROUS_PATTERNS);
  const legitimateSafety = LEGITIMATE_SAFETY_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );

  if (dangerous.length > 0 && !legitimateSafety) {
    return {
      classification: 'DANGEROUS_REQUEST',
      confidence: 0.95,
      matchedRules: dangerous,
      usedClassifier: false,
    };
  }

  if (domain.length > 0 && outOfScope.length > 0) {
    return {
      classification: 'MIXED',
      confidence: 0.9,
      matchedRules: [...domain, ...outOfScope],
      usedClassifier: false,
    };
  }

  if (outOfScope.length > 0) {
    return {
      classification: 'OUT_OF_SCOPE',
      confidence: 0.95,
      matchedRules: outOfScope,
      usedClassifier: false,
    };
  }

  if (domain.length > 0 || legitimateSafety) {
    return {
      classification: 'DOMAIN_KNOWLEDGE',
      confidence: domain.length > 0 ? 0.9 : 0.75,
      matchedRules: domain.length > 0 ? domain : ['legitimate_safety'],
      usedClassifier: false,
    };
  }

  return {
    classification: 'UNCLEAR',
    confidence: 0.4,
    matchedRules: [],
    usedClassifier: false,
  };
};

export const mergeClassifierResult = (
  deterministic: ScopeGuardResult,
  classifier: unknown,
  confidenceThreshold: number,
): ScopeGuardResult => {
  const parsed = aiScopeClassifierSchema.safeParse(classifier);
  if (!parsed.success) {
    return deterministic;
  }

  if (parsed.data.confidence < confidenceThreshold) {
    return {
      classification: 'UNCLEAR',
      confidence: parsed.data.confidence,
      matchedRules: ['classifier_low_confidence'],
      usedClassifier: true,
    };
  }

  return {
    classification: parsed.data.classification,
    confidence: parsed.data.confidence,
    matchedRules: ['classifier', parsed.data.reason],
    usedClassifier: true,
  };
};

export const shouldSkipAnswerProvider = (
  classification: AiScopeClassification,
): boolean => classification === 'OUT_OF_SCOPE';

export const shouldUseAnswerProvider = (
  classification: AiScopeClassification,
): boolean =>
  classification === 'DOMAIN_KNOWLEDGE' || classification === 'MIXED';
