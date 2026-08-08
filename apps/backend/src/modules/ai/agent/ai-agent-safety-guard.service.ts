import type { AiLocale } from '../ai.types.js';
import {
  assessPhysicalHazards,
  LEGITIMATE_SAFETY_PATTERNS,
} from '../safety/ai-hazard-detector.js';
import type { PhysicalHazardCategory } from '../safety/ai-hazard-taxonomy.js';

export type DangerousRequestAssessment = {
  isDangerous: boolean;
  matchedRules: string[];
  detectedHazardCategories: PhysicalHazardCategory[];
};

export const assessDangerousRequest = (text: string): DangerousRequestAssessment => {
  const assessment = assessPhysicalHazards(text);

  return {
    isDangerous: assessment.shouldBlock,
    matchedRules: assessment.blockReasons,
    detectedHazardCategories: assessment.categories,
  };
};

export const isLegitimateSafetyQuestion = (text: string): boolean => {
  const normalized = text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return LEGITIMATE_SAFETY_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const DANGEROUS_SAFETY_COPY = {
  en: [
    'I cannot help with that request because it could cause electric shock, fire, explosion, or serious injury.',
    'Use appropriate low-voltage supplies, keep tool guards and battery protections in place, work in a ventilated area, and ask a qualified person for help when needed.',
  ].join('\n'),
  ar: [
    'لا أستطيع المساعدة في هذا الطلب لأنه قد يسبب صعقًا كهربائيًا أو حريقًا أو انفجارًا أو إصابة خطيرة.',
    'استخدم مصادر تغذية منخفضة الجهد المناسبة، وأبقِ حمايات الأدوات والبطاريات مفعّلة، واعمل في مكان مهوى، واطلب مساعدة شخص مؤهل عند الحاجة.',
  ].join('\n'),
} as const satisfies Record<AiLocale, string>;
