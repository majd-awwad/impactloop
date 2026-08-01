import { AppError } from '../../utils/app-error.js';

export const DESCRIPTION_MAX_LENGTH = 10000;
export const AUTHORING_IDEA_MIN_LENGTH = 10;
export const AUTHORING_IDEA_MAX_LENGTH = DESCRIPTION_MAX_LENGTH;

export const AUTHORING_DRAFT_PLACEHOLDER_TITLE_EN = 'Untitled draft';
export const AUTHORING_DRAFT_PLACEHOLDER_TITLE_AR = 'مسودة بدون عنوان';
export const AUTHORING_DRAFT_PLACEHOLDER_SHORT_EN = 'Draft in progress';
export const AUTHORING_DRAFT_PLACEHOLDER_SHORT_AR = 'مسودة قيد الإعداد';
export const AUTHORING_DRAFT_PLACEHOLDER_DESCRIPTION_EN =
  'The project description will be created during guided authoring.';
export const AUTHORING_DRAFT_PLACEHOLDER_DESCRIPTION_AR =
  'سيتم إنشاء وصف المشروع أثناء التأليف الموجّه.';

export const isAuthoringDraftPlaceholderTitle = (value: string) =>
  value === AUTHORING_DRAFT_PLACEHOLDER_TITLE_EN ||
  value === AUTHORING_DRAFT_PLACEHOLDER_TITLE_AR;

export const isAuthoringDraftPlaceholderShortDescription = (value: string) =>
  value === AUTHORING_DRAFT_PLACEHOLDER_SHORT_EN ||
  value === AUTHORING_DRAFT_PLACEHOLDER_SHORT_AR;

export const isAuthoringDraftPlaceholderDescription = (value: string) =>
  value === AUTHORING_DRAFT_PLACEHOLDER_DESCRIPTION_EN ||
  value === AUTHORING_DRAFT_PLACEHOLDER_DESCRIPTION_AR;

const resolveAuthoringDraftPlaceholderLocale = (ideaText: string): 'en' | 'ar' =>
  /[\u0600-\u06FF]/u.test(ideaText) ? 'ar' : 'en';

export const neutralAuthoringDraftFields = (locale: 'en' | 'ar') => ({
  title:
    locale === 'ar'
      ? AUTHORING_DRAFT_PLACEHOLDER_TITLE_AR
      : AUTHORING_DRAFT_PLACEHOLDER_TITLE_EN,
  shortDescription:
    locale === 'ar'
      ? AUTHORING_DRAFT_PLACEHOLDER_SHORT_AR
      : AUTHORING_DRAFT_PLACEHOLDER_SHORT_EN,
  description:
    locale === 'ar'
      ? AUTHORING_DRAFT_PLACEHOLDER_DESCRIPTION_AR
      : AUTHORING_DRAFT_PLACEHOLDER_DESCRIPTION_EN,
});

export const deriveAuthoringDraftFields = (ideaText: string) => {
  const trimmedIdea = ideaText.trim().slice(0, DESCRIPTION_MAX_LENGTH);

  if (trimmedIdea.length < AUTHORING_IDEA_MIN_LENGTH) {
    throw new AppError(
      'Project idea must be at least 10 characters after trimming.',
      400,
      'INVALID_AUTHORING_IDEA',
    );
  }

  return neutralAuthoringDraftFields(resolveAuthoringDraftPlaceholderLocale(trimmedIdea));
};
