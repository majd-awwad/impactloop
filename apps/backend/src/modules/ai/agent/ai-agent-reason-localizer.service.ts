import type { AiLocale } from '../ai.types.js';

const INTEREST_LABEL_AR: Array<{ pattern: RegExp; ar: string }> = [
  { pattern: /electronics/i, ar: 'الإلكترونيات' },
  { pattern: /arduino/i, ar: 'الأردوينو' },
  { pattern: /robotics?/i, ar: 'الروبوتات' },
  { pattern: /circuits?/i, ar: 'الدوائر' },
  { pattern: /coding|programming/i, ar: 'البرمجة' },
  { pattern: /wood/i, ar: 'النجارة' },
  { pattern: /art/i, ar: 'الفنون' },
];

const REASON_TRANSLATIONS: Array<{ pattern: RegExp; ar: string }> = [
  {
    pattern: /matches your arduino interest/i,
    ar: 'يطابق اهتمامك بالأردوينو',
  },
  {
    pattern: /matches your robotics interest/i,
    ar: 'يطابق اهتمامك بالروبوتات',
  },
  {
    pattern: /matches your electronics interest/i,
    ar: 'يطابق اهتمامك بالإلكترونيات',
  },
  {
    pattern: /matches your (.+?) interest/i,
    ar: '__INTEREST__',
  },
  {
    pattern: /related to your (.+?) interest/i,
    ar: '__RELATED_INTEREST__',
  },
  {
    pattern: /related to your saved projects?/i,
    ar: 'مرتبط بمشروع حفظته',
  },
  {
    pattern: /based on materials you liked/i,
    ar: 'استخدمت مواد مشابهة سابقًا',
  },
  {
    pattern: /similar to materials you reserved/i,
    ar: 'يشبه مواد حجزتها سابقًا',
  },
  {
    pattern: /free material near your saved location/i,
    ar: 'مادة مجانية قريبة من موقعك',
  },
  {
    pattern: /free material/i,
    ar: 'متاح مجانًا',
  },
  {
    pattern: /available near your saved location/i,
    ar: 'قريب من موقعك',
  },
  {
    pattern: /required components have available matching materials/i,
    ar: 'تتوفر بعض مكوناته حاليًا',
  },
  {
    pattern: /popular with learners/i,
    ar: 'مشروع شائع بين المتعلمين',
  },
  {
    pattern: /because you are building/i,
    ar: 'يمكنك متابعة بناء بدأته سابقًا',
  },
  {
    pattern: /saved by you/i,
    ar: 'مشروع حفظته مسبقًا',
  },
  {
    pattern: /beginner/i,
    ar: 'مناسب لمستوى مبتدئ',
  },
  {
    pattern: /short/i,
    ar: 'مدة تنفيذه قصيرة',
  },
];

const localizeInterestLabel = (label: string): string => {
  for (const entry of INTEREST_LABEL_AR) {
    if (entry.pattern.test(label)) {
      return entry.ar;
    }
  }

  return label;
};

const translateInterestReason = (reason: string, related = false): string => {
  const match = reason.match(/(?:matches|related to) your (.+?) interest/i);
  const label = match?.[1]?.trim() ?? '';
  const localized = localizeInterestLabel(label);
  return related
    ? `مرتبط باهتمامك ب${localized}`
    : `يطابق اهتمامك ب${localized}`;
};

export const localizeRecommendationReasons = (
  reasons: string[],
  locale: AiLocale,
): string[] => {
  if (locale !== 'ar') {
    return reasons;
  }

  return reasons.map((reason) => {
    for (const entry of REASON_TRANSLATIONS) {
      if (!entry.pattern.test(reason)) {
        continue;
      }

      if (entry.ar === '__INTEREST__') {
        return translateInterestReason(reason, false);
      }
      if (entry.ar === '__RELATED_INTEREST__') {
        return translateInterestReason(reason, true);
      }

      return entry.ar;
    }

    if (/[A-Za-z]/.test(reason)) {
      return 'اقتراح مخصص لك على ImpactLoop';
    }

    return reason;
  });
};
