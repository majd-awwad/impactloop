import { z } from 'zod';

export const approvalsStatusSchema = z
  .enum(['PENDING', 'APPROVED', 'REJECTED'])
  .optional();

export const approvalsListQuerySchema = z.object({
  status: approvalsStatusSchema,
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ApprovalsListQuery = z.infer<typeof approvalsListQuerySchema>;

export const approvalIdParamSchema = z.object({
  id: z.string().min(1),
});

export type ApprovalIdParams = z.infer<typeof approvalIdParamSchema>;

const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;
const LEADING_OR_TRAILING_PUNCTUATION = /(^[\p{P}\p{S}])|([\p{P}\p{S}]$)/u;
const LATIN_LETTER = /\p{Script=Latin}/gu;
const ARABIC_LETTER = /\p{Script=Arabic}/gu;
const ANY_LETTER = /\p{L}/gu;
const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const TATWEEL = /\u0640/gu;
const SHARED_TECHNICAL_TOKEN = /^(?=.{2,12}$)(?=(?:.*[A-Z]){2})[A-Z0-9][A-Z0-9.+-]*$/u;
const REVIEWED_SHARED_TECHNICAL_TERMS = new Set([
  'arduino',
  'raspberry pi',
  '3d printing',
]);

export type CategoryNameLanguage = 'EN' | 'AR';

export const normalizeCategoryNameForDisplay = (value: string): string =>
  value.replace(/\s+/gu, ' ').trim();

export const isPlausibleSharedTechnicalTerm = (value: string): boolean => {
  const displayValue = normalizeCategoryNameForDisplay(value);
  return (
    SHARED_TECHNICAL_TOKEN.test(displayValue) ||
    REVIEWED_SHARED_TECHNICAL_TERMS.has(displayValue.toLocaleLowerCase('en-US'))
  );
};

export const isAllowedIdenticalSharedTechnicalName = (
  nameEn: string,
  nameAr: string,
): boolean =>
  normalizeCategoryNameForComparison(nameEn, 'EN') ===
    normalizeCategoryNameForComparison(nameAr, 'EN') &&
  isPlausibleSharedTechnicalTerm(nameEn);

export const normalizeCategoryNameForComparison = (
  value: string,
  language: CategoryNameLanguage,
): string => {
  const normalized = normalizeCategoryNameForDisplay(value.normalize('NFKC'))
    .toLocaleLowerCase('en-US');
  return language === 'AR'
    ? normalized.replace(TATWEEL, '').replace(ARABIC_DIACRITICS, '')
    : normalized;
};

const countMatches = (value: string, expression: RegExp): number =>
  [...value.matchAll(expression)].length;

const hasRepeatedWords = (value: string): boolean => {
  const words = normalizeCategoryNameForComparison(value, 'AR')
    .split(/\s+/u)
    .map((word) => word.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ''))
    .filter(Boolean);
  return words.some((word, index) => index > 0 && word === words[index - 1]);
};

const validateCategoryNameStructure = (
  value: string,
  language: CategoryNameLanguage,
  context: z.RefinementCtx,
) => {
  const comparisonValue = normalizeCategoryNameForDisplay(value);
  const fieldLabel = language === 'EN' ? 'English name' : 'Arabic name';
  if (CONTROL_OR_FORMAT.test(value)) {
    context.addIssue({
      code: 'custom',
      message: `${fieldLabel} cannot contain control characters.`,
    });
  }
  if (LEADING_OR_TRAILING_PUNCTUATION.test(comparisonValue)) {
    context.addIssue({
      code: 'custom',
      message: `${fieldLabel} cannot begin or end with punctuation.`,
    });
  }
  if (hasRepeatedWords(comparisonValue)) {
    context.addIssue({
      code: 'custom',
      message: `${fieldLabel} cannot repeat the same word consecutively.`,
    });
  }
  const wordCount = comparisonValue.split(/\s+/u).filter(Boolean).length;
  if (comparisonValue.length > 80 || wordCount > 12) {
    context.addIssue({
      code: 'custom',
      message: `${fieldLabel} looks like a description rather than a concise category name.`,
    });
  }

};

const validateCategoryNameLanguage = (
  value: string,
  language: CategoryNameLanguage,
  context: z.RefinementCtx,
  path: ['nameEn'] | ['nameAr'],
  allowSharedTechnicalTerm = false,
) => {
  const displayValue = normalizeCategoryNameForDisplay(value);
  const latinCount = countMatches(displayValue, LATIN_LETTER);
  const arabicCount = countMatches(displayValue, ARABIC_LETTER);
  const letterCount = countMatches(displayValue, ANY_LETTER);
  const otherLetterCount = Math.max(0, letterCount - latinCount - arabicCount);
  if (language === 'EN') {
    if (latinCount < 2) {
      context.addIssue({
        code: 'custom',
        path,
        message: 'English name must contain meaningful Latin-letter text.',
      });
    }
    if (arabicCount > 3 || arabicCount >= latinCount || otherLetterCount > 2) {
      context.addIssue({
        code: 'custom',
        path,
        message: 'English name contains an unreasonable mix of scripts.',
      });
    }
  } else {
    if (!allowSharedTechnicalTerm && arabicCount < 2) {
      context.addIssue({
        code: 'custom',
        path,
        message: 'Arabic name must contain meaningful Arabic-letter text.',
      });
    }
    if (
      !allowSharedTechnicalTerm &&
      (latinCount > 6 || latinCount > arabicCount || otherLetterCount > 2)
    ) {
      context.addIssue({
        code: 'custom',
        path,
        message: 'Arabic name contains an unreasonable mix of scripts.',
      });
    }
  }
};

const categoryNameSchema = (language: CategoryNameLanguage) =>
  z
    .string()
    .transform(normalizeCategoryNameForDisplay)
    .pipe(
      z
        .string()
        .min(2, `${language === 'EN' ? 'English' : 'Arabic'} name is required.`)
        .max(120)
        .superRefine((value, context) =>
          validateCategoryNameStructure(value, language, context),
        ),
    );

export const approveCategoryRequestSchema = z.preprocess(
  (value) => value ?? {},
  z.discriminatedUnion('resolution', [
    z
      .object({
        resolution: z.literal('USE_EXISTING_CATEGORY'),
        existingCategoryId: z.string().trim().min(1, 'Existing category is required'),
      })
      .strict(),
    z
      .object({
        resolution: z.literal('CREATE_NEW_CATEGORY'),
        nameEn: categoryNameSchema('EN'),
        nameAr: categoryNameSchema('AR'),
        materialFamilyConceptId: z
          .string({ error: 'Material family is required' })
          .trim()
          .min(1, 'Material family is required'),
        adminJustification: z.string().trim().min(10).max(500).optional(),
        sharedNameAcknowledged: z.boolean().optional(),
      })
      .strict()
      .superRefine((value, context) => {
        const sharedTechnicalTerm = isAllowedIdenticalSharedTechnicalName(
          value.nameEn,
          value.nameAr,
        );
        if (!sharedTechnicalTerm && value.sharedNameAcknowledged === true) {
          context.addIssue({
            code: 'custom',
            path: ['sharedNameAcknowledged'],
            message:
              'Shared-name acknowledgement is only valid for identical reviewed technical terms.',
          });
        }
        validateCategoryNameLanguage(value.nameEn, 'EN', context, ['nameEn']);
        validateCategoryNameLanguage(
          value.nameAr,
          'AR',
          context,
          ['nameAr'],
          sharedTechnicalTerm,
        );
      }),
  ]),
);

export type ApproveCategoryRequestInput = z.infer<
  typeof approveCategoryRequestSchema
>;

export const rejectCategoryRequestSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    adminNote: z.string().trim().min(3, 'Reason is required').max(1000),
    suggestedCategoryId: z.string().trim().min(1).optional(),
  }),
);

export type RejectCategoryRequestInput = z.infer<typeof rejectCategoryRequestSchema>;

export const approvePriceRequestSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    adminNote: z.string().trim().max(1000).optional(),
  }),
);

export type ApprovePriceRequestInput = z.infer<typeof approvePriceRequestSchema>;

export const rejectPriceRequestSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    adminNote: z.string().trim().min(3, 'Reason is required').max(1000),
    maxAllowedPrice: z.coerce.number().finite().positive(),
  }),
);

export type RejectPriceRequestInput = z.infer<typeof rejectPriceRequestSchema>;

