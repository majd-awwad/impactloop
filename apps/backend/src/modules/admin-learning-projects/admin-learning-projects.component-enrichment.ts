import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { isMaterialSelectableCategory } from '../categories/categories.repository.js';
import {
  MAX_COMPONENT_KEYWORDS,
  MAX_KEYWORD_LENGTH,
  resolveSubmitMaterialType,
} from '../learning-projects/learning-projects.submit-components.js';

import type { UpdateAdminLearningProjectComponentInput } from './admin-learning-projects.validation.js';

const ADMIN_COMPONENT_ROLES = [
  'REQUIRED_MATERIAL',
  'OPTIONAL_MATERIAL',
  'TOOL',
  'CONSUMABLE',
  'ALTERNATIVE',
] as const;

export const isAdminComponentRole = (
  value: string,
): value is (typeof ADMIN_COMPONENT_ROLES)[number] =>
  (ADMIN_COMPONENT_ROLES as readonly string[]).includes(value);

const dedupeKeywords = (keywords: string[], componentName?: string) => {
  const normalized = new Map<string, string>();

  for (const keyword of keywords) {
    const cleaned = keyword.trim().slice(0, MAX_KEYWORD_LENGTH);
    if (cleaned.length === 0) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (!normalized.has(key)) {
      normalized.set(key, cleaned);
    }
  }

  const trimmedName = componentName?.trim();
  if (trimmedName && trimmedName.length > 0) {
    const key = trimmedName.toLowerCase();
    if (!normalized.has(key)) {
      normalized.set(key, trimmedName);
    }
  }

  return [...normalized.values()].slice(0, MAX_COMPONENT_KEYWORDS);
};

export const assertEditableProjectStatus = (status: string) => {
  if (status !== 'PENDING_REVIEW' && status !== 'CHANGES_REQUESTED') {
    throw new AppError(
      'Components can only be edited while the project is pending review or changes were requested.',
      409,
      'PROJECT_NOT_EDITABLE',
      { status },
    );
  }
};

export const assertUniqueComponentName = (
  components: { id: string; componentName: string }[],
  componentId: string,
  nextName: string,
) => {
  const normalized = nextName.trim().toLowerCase();
  if (normalized.length === 0) {
    return;
  }

  const duplicate = components.find(
    (component) =>
      component.id !== componentId &&
      component.componentName.trim().toLowerCase() === normalized,
  );

  if (duplicate) {
    throw new AppError(
      'Each component must have a unique name.',
      400,
      'DUPLICATE_COMPONENT_NAME',
    );
  }
};

export const validateComponentCategory = async (categoryId: string | null) => {
  if (!categoryId) {
    return null;
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      isActive: true,
      categoryType: true,
    },
  });

  if (!category || !category.isActive || !isMaterialSelectableCategory(category.categoryType)) {
    throw new AppError(
      'Category must be an active material category.',
      400,
      'INVALID_COMPONENT_CATEGORY',
    );
  }

  return category.id;
};

export const buildComponentUpdateData = async (
  input: UpdateAdminLearningProjectComponentInput,
  current: {
    componentName: string;
    materialType: string;
    reviewStatus: string;
  },
): Promise<Prisma.ProjectRequiredComponentUpdateInput> => {
  const data: Prisma.ProjectRequiredComponentUpdateInput = {};

  if (input.componentName !== undefined) {
    data.componentName = input.componentName.trim();
  }

  if (input.quantity !== undefined) {
    data.quantity = input.quantity;
  }

  if (input.unit !== undefined) {
    data.unit = input.unit.trim();
  }

  if (input.componentRole !== undefined) {
    if (!isAdminComponentRole(input.componentRole)) {
      throw new AppError('Invalid component role.', 400, 'INVALID_COMPONENT_ROLE');
    }
    data.componentRole = input.componentRole;
  }

  if (input.categoryId !== undefined) {
    if (input.categoryId === null || input.categoryId === '') {
      data.category = { disconnect: true };
    } else {
      const categoryId = await validateComponentCategory(input.categoryId);
      data.category = { connect: { id: categoryId! } };
    }
  }

  const nextName = input.componentName ?? current.componentName;

  if (input.materialType !== undefined) {
    data.materialType = resolveSubmitMaterialType(nextName, input.materialType);
  }

  if (input.searchKeywords !== undefined) {
    data.searchKeywords = dedupeKeywords(input.searchKeywords, nextName);
  }

  if (input.alternativeKeywords !== undefined) {
    data.alternativeKeywords = dedupeKeywords(input.alternativeKeywords);
  }

  if (input.canBeSubstituted !== undefined) {
    data.canBeSubstituted = input.canBeSubstituted;
  }

  if (input.isRequired !== undefined) {
    data.isRequired = input.isRequired;
  }

  if (input.notes !== undefined) {
    data.notes = input.notes?.trim() || null;
  }

  if (input.reviewStatus !== undefined) {
    data.reviewStatus = input.reviewStatus;
  }

  if (Object.keys(data).length > 0) {
    data.confirmedByUser = true;
    if (input.reviewStatus === undefined && current.reviewStatus !== 'ACCEPTED') {
      data.reviewStatus = 'ACCEPTED';
    }
  }

  return data;
};
