import { AppError } from '../../utils/app-error.js';
import { normalizeSearchText } from '../../utils/normalize-search-text.js';

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

export const submitCategoryRequest = async (
  userId: string,
  input: CreateCategoryRequestInput,
) => {
  const requestedName = input.requestedName.trim();
  const normalizedRequestedName = normalizeSearchText(requestedName);

  const listingDraftJson: ListingDraftJson = {
    ...input.listingDraftJson,
    requestedCategoryName: requestedName,
  };

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
    throw new AppError('Category request not found', 404, 'NOT_FOUND');
  }

  if (request.publishedMaterialId) {
    throw new AppError(
      'This listing was already completed.',
      409,
      'CONFLICT',
    );
  }

  const canContinue =
    request.status === 'APPROVED' && request.approvedCategoryId != null;

  const isSuggestion =
    request.status === 'APPROVED' &&
    request.approvedCategory != null &&
    normalizeSearchText(request.approvedCategory.nameEn) !==
      request.normalizedRequestedName;

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
    listingDraftJson: request.listingDraftJson,
  };
};
