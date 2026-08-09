import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';
import { normalizeSearchText } from '../../utils/normalize-search-text.js';
import * as categoriesRepository from '../categories/categories.repository.js';

import * as categoryRequestsRepository from './category-requests.repository.js';
import type {
  CreateCategoryRequestInput,
  ListingDraftJson,
} from './category-requests.validation.js';

const extractDraftTitle = (listingDraftJson: unknown): string | null => {
  if (!listingDraftJson || typeof listingDraftJson !== 'object' || Array.isArray(listingDraftJson)) {
    return null;
  }

  const title = (listingDraftJson as Record<string, unknown>).title;
  return typeof title === 'string' && title.trim() ? title.trim() : null;
};

const extractDraftMaterialName = (listingDraftJson: unknown): string | null => {
  if (!listingDraftJson || typeof listingDraftJson !== 'object' || Array.isArray(listingDraftJson)) {
    return null;
  }

  const materialName = (listingDraftJson as Record<string, unknown>).materialName;
  return typeof materialName === 'string' && materialName.trim()
    ? materialName.trim()
    : null;
};

const mapListItem = (
  request: Awaited<
    ReturnType<typeof categoryRequestsRepository.listCategoryRequestsWithDrafts>
  >[number],
) => {
  const canContinue =
    request.status === 'APPROVED' && request.approvedCategoryId != null;

  return {
    id: request.id,
    requestedName: request.requestedName,
    status: request.status,
    approvedCategoryId: request.approvedCategoryId,
    approvedCategoryName: request.approvedCategory?.nameEn ?? null,
    title: extractDraftTitle(request.listingDraftJson) ?? '',
    materialName: extractDraftMaterialName(request.listingDraftJson) ?? '',
    createdAt: request.createdAt.toISOString(),
    canContinue,
  };
};

const assertCategoryRequestMaterialContext = (draft: ListingDraftJson) => {
  const materialLabel = draft.materialName.trim() || draft.title.trim();
  if (materialLabel.length < 2) {
    throw new AppError(
      'Enter the material name before requesting a new category.',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  if (draft.description.trim().length < 10) {
    throw new AppError(
      'Describe the material so admin can review the category request.',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  const reason = (draft.categoryRequestReason ?? '').trim();
  if (reason.length < 10) {
    throw new AppError(
      'Explain why existing categories do not fit.',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  if (!draft.requestedCategoryName.trim()) {
    throw new AppError(
      'Enter the requested category name.',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }
};

export const submitCategoryRequest = async (
  userId: string,
  input: CreateCategoryRequestInput,
) => {
  const requestedName = input.requestedName.trim();
  if (!requestedName) {
    throw new AppError(
      'Enter the requested category name.',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  const normalizedRequestedName = normalizeSearchText(requestedName);

  const listingDraftJson: ListingDraftJson = {
    ...input.listingDraftJson,
    requestedCategoryName: requestedName,
    categoryRequestReason: input.listingDraftJson.categoryRequestReason?.trim() ?? '',
  };

  assertCategoryRequestMaterialContext(listingDraftJson);

  const existing = await categoryRequestsRepository.findPendingCategoryRequest({
    requestedByUserId: userId,
    normalizedRequestedName,
  });

  if (existing) {
    await categoryRequestsRepository.updateCategoryRequestDraftJson({
      id: existing.id,
      listingDraftJson,
    });

    return {
      id: existing.id,
      requestedName: existing.requestedName,
      status: existing.status,
      message: 'Category request submitted. Your listing draft was saved.',
    };
  }

  const created = await categoryRequestsRepository.createCategoryRequest({
    requestedName,
    normalizedRequestedName,
    requestedByUserId: userId,
    listingDraftJson,
  });

  return {
    id: created.id,
    requestedName: created.requestedName,
    status: created.status,
    message: 'Category request submitted. Your listing draft was saved.',
  };
};

const SUGGESTED_CATEGORY_PREFIX = 'Suggested category:';

const parseSuggestedCategoryName = (moderatorNote: string | null): string | null => {
  if (!moderatorNote?.trim()) {
    return null;
  }

  const firstLine = moderatorNote.trim().split('\n')[0] ?? '';
  if (!firstLine.startsWith(SUGGESTED_CATEGORY_PREFIX)) {
    return null;
  }

  const name = firstLine.slice(SUGGESTED_CATEGORY_PREFIX.length).trim();
  if (!name || name === 'Unknown category') {
    return null;
  }

  const looksLikeCuid = name.startsWith('c') && name.length >= 18;
  return looksLikeCuid ? null : name;
};

const resolveSuggestedCategory = async (moderatorNote: string | null) => {
  const suggestedName = parseSuggestedCategoryName(moderatorNote);
  if (!suggestedName) {
    return null;
  }

  const category = await categoriesRepository.findPublicCategories({
    type: 'MATERIAL',
    rootOnly: false,
  });

  const match = category.find(
    (item) => item.nameEn.trim().toLowerCase() === suggestedName.toLowerCase(),
  );

  if (!match) {
    return null;
  }

  return {
    id: match.id,
    nameEn: match.nameEn,
    nameAr: match.nameAr,
  };
};

export const listSupplierCategoryRequests = async (userId: string) => {
  const requests =
    await categoryRequestsRepository.listCategoryRequestsWithDrafts(userId);

  return requests.map(mapListItem);
};

export const getCategoryRequestDraft = async (userId: string, id: string) => {
  const request = await categoryRequestsRepository.findCategoryRequestByIdForOwner(
    id,
    userId,
  );

  if (!request) {
    throw new AppError(
      'Category request not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  if (request.publishedMaterialId) {
    throw new AppError(
      'This listing was already completed.',
      409,
      COMMON_ERROR_CODES.conflict,
    );
  }

  const canContinue =
    request.status === 'APPROVED' && request.approvedCategoryId != null;

  const isSuggestion =
    request.status === 'APPROVED' &&
    request.approvedCategory != null &&
    normalizeSearchText(request.approvedCategory.nameEn) !==
      request.normalizedRequestedName;

  const suggestedCategory =
    request.status === 'REJECTED'
      ? await resolveSuggestedCategory(request.moderatorNote)
      : null;

  return {
    id: request.id,
    status: request.status,
    requestedName: request.requestedName,
    canContinue,
    isSuggestion,
    approvedCategoryId: request.approvedCategoryId,
    approvedCategory: request.approvedCategory
      ? {
          id: request.approvedCategory.id,
          nameEn: request.approvedCategory.nameEn,
          nameAr: request.approvedCategory.nameAr,
        }
      : null,
    suggestedCategoryId: suggestedCategory?.id ?? null,
    suggestedCategory,
    listingDraftJson: request.listingDraftJson,
  };
};
