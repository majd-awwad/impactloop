import type { Prisma } from '../../generated/prisma/client.js';

import { AppError } from '../../utils/app-error.js';

export const LEARNER_SUBMIT_COMPONENT_ROLES = [
  'REQUIRED_MATERIAL',
  'TOOL',
  'CONSUMABLE',
] as const;

export type LearnerSubmitComponentRole =
  (typeof LEARNER_SUBMIT_COMPONENT_ROLES)[number];

export const MAX_SUBMIT_COMPONENTS = 50;
export const MAX_COMPONENT_KEYWORDS = 5;
export const MAX_KEYWORD_LENGTH = 80;

export type SubmitComponentInput = {
  name: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  isRequired?: boolean;
  componentRole?: LearnerSubmitComponentRole;
  materialType?: string;
  categoryId?: string;
  searchKeywords?: string[];
  canBeSubstituted?: boolean;
};

export type NormalizedSubmitComponent = {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  isRequired: boolean;
  componentRole: LearnerSubmitComponentRole;
  materialType: string;
  categoryId?: string;
  searchKeywords: string[];
  canBeSubstituted: boolean;
};

const cleanText = (value: string | undefined, maxLength: number) =>
  value?.trim().slice(0, maxLength) ?? '';

const normalizeKeywordList = (
  componentName: string,
  keywords: string[] | undefined,
) => {
  const normalized = new Set<string>();
  const trimmedName = componentName.trim();
  const splitParts = (value: string) =>
    value
      .split(/[,;\n]+/)
      .map((part) => part.trim().slice(0, MAX_KEYWORD_LENGTH))
      .filter((part) => part.length > 0);

  if (trimmedName.length > 0) {
    normalized.add(trimmedName);
  }

  for (const keyword of keywords ?? []) {
    for (const cleaned of splitParts(keyword)) {
      normalized.add(cleaned);
      if (normalized.size >= MAX_COMPONENT_KEYWORDS) {
        break;
      }
    }
    if (normalized.size >= MAX_COMPONENT_KEYWORDS) {
      break;
    }
  }

  return [...normalized].slice(0, MAX_COMPONENT_KEYWORDS);
};

export const resolveSubmitMaterialType = (
  componentName: string,
  materialType?: string,
) => {
  const cleanedType = cleanText(materialType, 200);
  if (cleanedType.length > 0) {
    return cleanedType;
  }

  const cleanedName = componentName.trim();
  if (cleanedName.length > 0) {
    return cleanedName;
  }

  return 'Unspecified';
};

export const normalizeSubmitComponent = (
  input: SubmitComponentInput,
): NormalizedSubmitComponent => {
  const name = input.name.trim();
  const unit = cleanText(input.unit, 50) || 'piece';
  const notes = cleanText(input.notes, 1000);
  const componentRole = input.componentRole ?? 'REQUIRED_MATERIAL';
  const categoryId = cleanText(input.categoryId, 64);

  return {
    name,
    quantity: input.quantity ?? 1,
    unit,
    notes: notes.length > 0 ? notes : undefined,
    isRequired: input.isRequired ?? true,
    componentRole,
    materialType: resolveSubmitMaterialType(name, input.materialType),
    categoryId: categoryId.length > 0 ? categoryId : undefined,
    searchKeywords: normalizeKeywordList(name, input.searchKeywords),
    canBeSubstituted: input.canBeSubstituted ?? false,
  };
};

export const assertUniqueSubmitComponentNames = (
  components: SubmitComponentInput[],
) => {
  const seen = new Set<string>();

  for (const component of components) {
    const key = component.name.trim().toLowerCase();
    if (key.length === 0) {
      continue;
    }

    if (seen.has(key)) {
      throw new AppError(
        'Each required component must have a unique name.',
        400,
        'DUPLICATE_COMPONENT_NAME',
      );
    }

    seen.add(key);
  }
};

export const mapNormalizedComponentToCreateData = (
  component: NormalizedSubmitComponent,
): Prisma.ProjectRequiredComponentCreateWithoutProjectInput => ({
  componentName: component.name,
  materialType: component.materialType,
  quantity: component.quantity,
  unit: component.unit,
  componentRole: component.componentRole,
  isRequired: component.isRequired,
  canBeSubstituted: component.canBeSubstituted,
  category: component.categoryId
    ? { connect: { id: component.categoryId } }
    : undefined,
  searchKeywords: component.searchKeywords,
  notes: component.notes,
  providedByUser: true,
  confirmedByUser: false,
  reviewStatus: 'PENDING_REVIEW',
});
