import type { AiLocale } from '../ai.types.js';

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const LEGITIMATE_SAFETY_PATTERNS: RegExp[] = [
  /(safety precaution|safe way|how to safely|احتياطات|بأمان|سلامة|بشكل آمن)/u,
];

const DANGEROUS_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: 'bypass_protection',
    pattern:
      /(bypass|remove|disable|الغ(?:ي|اء)|ازل|أزل).{0,40}(protection|fuse|breaker|ground|earthing|حماية|قاطع)/u,
  },
  {
    id: 'unsafe_mains_en',
    pattern:
      /(connect|wire|plug|attach).{0,40}(direct(?:ly)?|without).{0,40}(mains|220|230|240|home electricity|wall outlet)/u,
  },
  {
    id: 'unsafe_mains_ar_connect',
    pattern: /(اوصل|أوصل|وصل|شبك|أشبك).{0,50}(كهربا|كهرباء|البيت|المنزل|220|230|240|mains|الفيش|فيشة)/u,
  },
  {
    id: 'unsafe_mains_ar_direct',
    pattern: /(اوصل|أوصل|وصل|شبك|أشبك).{0,40}(مباشرة|مباشر|directly|without protection)/u,
  },
  {
    id: 'household_electricity',
    pattern:
      /(كهربا\s*البيت|كهرباء\s*المنزل|كهرباء\s*البيت|كهربا\s*المنزل|home\s+electricity|house\s+electricity|household\s+electricity|wall\s+outlet|فيشة\s*الحيط|power\s+outlet)/u,
  },
  {
    id: 'direct_mains_load',
    pattern:
      /(تشغيل|اشغل|أشغل|شغل|تشغيلي).{0,40}(موتور|motor|led|لامبة|محرك).{0,40}(كهربا|كهرباء|mains|220|البيت|المنزل|direct)/u,
  },
  {
    id: 'wires_to_mains',
    pattern: /(سلك|سلكين|أسلاك|wire|wires).{0,40}(كهربا|كهرباء|mains|220|البيت|المنزل|outlet)/u,
  },
  {
    id: 'mains_voltage',
    pattern: /(220|230|240).{0,30}(volt|فولت|موتور|motor|direct|مباشرة)/u,
  },
];

export type DangerousRequestAssessment = {
  isDangerous: boolean;
  matchedRules: string[];
};

export const assessDangerousRequest = (text: string): DangerousRequestAssessment => {
  const normalized = normalize(text);
  const legitimateSafety = LEGITIMATE_SAFETY_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );

  if (legitimateSafety) {
    return { isDangerous: false, matchedRules: [] };
  }

  const matchedRules = DANGEROUS_PATTERNS.filter(({ pattern }) =>
    pattern.test(normalized),
  ).map(({ id }) => id);

  const hasDirectMainsCue =
    /(مباشرة|مباشر|directly|without protection|بدون حماية)/u.test(normalized) &&
    /(كهربا|كهرباء|mains|220|البيت|المنزل|outlet|فيش)/u.test(normalized);

  const hasWiringCue =
    /(اوصل|أوصل|وصل|شبك|wire|plug|connect)/u.test(normalized) &&
    /(كهربا|كهرباء|mains|220|البيت|المنزل|outlet|فيش|سلك|household|home electricity)/u.test(
      normalized,
    );

  if (matchedRules.length > 0 || hasDirectMainsCue || hasWiringCue) {
    return {
      isDangerous: true,
      matchedRules:
        matchedRules.length > 0
          ? matchedRules
          : hasDirectMainsCue
            ? ['direct_mains_composite']
            : ['wiring_mains_composite'],
    };
  }

  return { isDangerous: false, matchedRules: [] };
};

export const DANGEROUS_SAFETY_COPY = {
  en: [
    'I cannot help with wiring directly to household mains electricity. That can cause electric shock, fire, or serious injury.',
    'Use an appropriate low-voltage power supply or motor driver matched to your component ratings, and ask a qualified person for help when needed.',
  ].join('\n'),
  ar: [
    'لا أستطيع المساعدة في توصيل دوائر مباشرة بكهرباء المنزل. هذا قد يسبب صعقًا كهربائيًا أو حريقًا أو إصابة خطيرة.',
    'استخدم مصدر تغذية منخفض الجهد أو درايفر محرك مناسب لتصنيف المكوّن، واطلب مساعدة شخص مؤهل عند الحاجة.',
  ].join('\n'),
} as const satisfies Record<AiLocale, string>;
