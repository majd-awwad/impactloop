import { AppError } from '../../utils/app-error.js';
import { normalizeSearchText } from '../../utils/normalize-search-text.js';
import { isAiProviderOperational } from '../../config/env.js';
import {
  buildAiResultJsonForRequest,
  buildPriceRuleReviewAiInput,
  buildPriceRuleReviewSuccessMessage,
  buildUnknownMaterialPriceReviewAiInput,
  isValidAiSuggestedPrice,
  suggestPriceReferenceForReview,
} from '../../services/ai-price-suggestion.service.js';
import * as categoriesRepository from '../categories/categories.repository.js';
import * as materialTypesRepository from '../material-types/material-types.repository.js';
import {
  resolveBaseSuggestedMaxUnitPriceNis,
  resolveFinalAllowedMaxUnitPriceNis,
} from './price-rule-request-pricing.js';
import * as priceRuleRequestsRepository from './price-rule-requests.repository.js';
import type { CreatePriceRuleRequestInput } from './price-rule-requests.validation.js';
import { decimalToNumber } from '../../utils/decimal.js';

const confidenceToDecimal = (confidence: string | null): number | null => {
  switch (confidence) {
    case 'HIGH':
      return 0.9;
    case 'MEDIUM':
      return 0.7;
    case 'LOW':
      return 0.4;
    default:
      return null;
  }
};

const hasStoredAiResult = (aiResultJson: unknown): boolean =>
  aiResultJson != null && typeof aiResultJson === 'object';

const PENDING_PRICE_REVIEW_MESSAGE = 'A price review is already pending.';

const createProposedPriceRuleIfValid = async (
  materialTypeId: string,
  aiSuggestion: Awaited<ReturnType<typeof suggestPriceReferenceForReview>>,
) => {
  if (
    !aiSuggestion.unit ||
    !isValidAiSuggestedPrice({
      maxUnitPriceNis: aiSuggestion.maxUnitPriceNis,
      maxTotalPriceNis: aiSuggestion.maxTotalPriceNis,
    })
  ) {
    return null;
  }

  const existingDraft = await priceRuleRequestsRepository.findPendingAiProposedPriceRule({
    materialTypeId,
    unit: aiSuggestion.unit,
  });

  if (existingDraft) {
    return existingDraft;
  }

  return priceRuleRequestsRepository.createAiProposedPriceRule({
    materialTypeId,
    unit: aiSuggestion.unit,
    maxAllowedUnitPriceNis: aiSuggestion.maxUnitPriceNis!,
    maxAllowedTotalPriceNis: aiSuggestion.maxTotalPriceNis,
    confidence: confidenceToDecimal(aiSuggestion.confidence),
    sourceNote: aiSuggestion.reasoning,
  });
};

const applyAiSuggestionToPriceRuleRequest = async (
  requestId: string,
  aiSuggestion: Awaited<ReturnType<typeof suggestPriceReferenceForReview>>,
) => {
  const aiResultJson = buildAiResultJsonForRequest(requestId, aiSuggestion);

  await priceRuleRequestsRepository.updatePriceRuleRequestAiResult({
    id: requestId,
    aiSuggestedUnit: aiSuggestion.unit,
    aiSuggestedMaxUnitPriceNis: aiSuggestion.maxUnitPriceNis,
    aiSuggestedMaxTotalPriceNis: aiSuggestion.maxTotalPriceNis,
    aiSuggestedAliasesJson:
      aiSuggestion.aliases.length > 0 ? aiSuggestion.aliases : null,
    aiResultJson,
  });

  return aiSuggestion;
};

const handlePendingPriceRuleRequest = async (
  pendingRequest: { id: string; status: string; aiResultJson: unknown },
  runAi: () => Promise<Awaited<ReturnType<typeof suggestPriceReferenceForReview>>>,
  materialTypeId?: string,
) => {
  if (hasStoredAiResult(pendingRequest.aiResultJson)) {
    return {
      id: pendingRequest.id,
      status: pendingRequest.status,
      aiStatus: 'ALREADY_PENDING' as const,
      aiProvider: null,
      message: PENDING_PRICE_REVIEW_MESSAGE,
    };
  }

  if (isAiProviderOperational()) {
    const aiSuggestion = await runAi();
    await applyAiSuggestionToPriceRuleRequest(pendingRequest.id, aiSuggestion);
    const proposedPriceRule = materialTypeId
      ? await createProposedPriceRuleIfValid(materialTypeId, aiSuggestion)
      : null;

    return {
      id: pendingRequest.id,
      status: pendingRequest.status,
      aiStatus: aiSuggestion.status,
      aiProvider: aiSuggestion.aiProvider,
      message: buildPriceRuleReviewSuccessMessage(
        aiSuggestion.status,
        aiSuggestion.aiProvider,
      ),
      proposedPriceRule,
    };
  }

  return {
    id: pendingRequest.id,
    status: pendingRequest.status,
    aiStatus: 'ALREADY_PENDING' as const,
    aiProvider: null,
    message: PENDING_PRICE_REVIEW_MESSAGE,
  };
};

const submitKnownMaterialPriceRuleRequest = async (
  userId: string,
  input: CreatePriceRuleRequestInput,
) => {
  const materialTypeId = input.materialTypeId!.trim();
  const materialType = await materialTypesRepository.findMaterialTypeById(
    materialTypeId,
  );

  if (!materialType || !materialType.isActive) {
    throw new AppError('Material reference not found', 404, 'NOT_FOUND');
  }

  const activeRule = await materialTypesRepository.findActivePriceRuleForMaterialType(
    materialTypeId,
    input.unit ?? undefined,
  );

  if (activeRule) {
    return {
      id: activeRule.id,
      status: 'ACTIVE_RULE_EXISTS',
      activePriceRule: materialTypesRepository.mapPriceRuleDto(activeRule),
      aiStatus: 'SKIPPED' as const,
      aiProvider: null,
      message: 'An active price reference already exists for this material.',
    };
  }

  const pendingRequest =
    await priceRuleRequestsRepository.findPendingKnownPriceRuleRequest({
      materialTypeId,
      requestedByUserId: userId,
    });

  const runAi = () =>
    suggestPriceReferenceForReview(
      buildPriceRuleReviewAiInput({
        materialTypeNameEn: materialType.nameEn,
        categoryNameEn: materialType.category.nameEn,
        materialTypeId,
        condition: input.condition ?? null,
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        supplierPriceNis: input.supplierPriceNis ?? null,
      }),
    );

  if (pendingRequest) {
    if (input.listingDraftJson) {
      await priceRuleRequestsRepository.updatePriceRuleRequestDraftJson({
        id: pendingRequest.id,
        listingDraftJson: input.listingDraftJson,
      });
    }

    return handlePendingPriceRuleRequest(
      pendingRequest,
      runAi,
      materialTypeId,
    );
  }

  const aiSuggestion = await runAi();
  const created = await priceRuleRequestsRepository.createKnownPriceRuleRequest({
    materialTypeId,
    requestedByUserId: userId,
    listingDraftJson: input.listingDraftJson ?? null,
  });

  await applyAiSuggestionToPriceRuleRequest(created.id, aiSuggestion);
  const proposedPriceRule = await createProposedPriceRuleIfValid(
    materialTypeId,
    aiSuggestion,
  );

  return {
    id: created.id,
    status: created.status,
    aiStatus: aiSuggestion.status,
    aiProvider: aiSuggestion.aiProvider,
    message: buildPriceRuleReviewSuccessMessage(
      aiSuggestion.status,
      aiSuggestion.aiProvider,
    ),
    proposedPriceRule,
  };
};

const assertSelectableCategory = async (categoryId: string) => {
  const category = await categoriesRepository.findCategoryById(categoryId);
  if (
    !category ||
    !categoriesRepository.isMaterialSelectableCategory(category.categoryType)
  ) {
    throw new AppError(
      'Selected category is not available. Please refresh categories and choose again.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (!category.isActive) {
    throw new AppError(
      'Selected category is not available. Please refresh categories and choose again.',
      400,
      'VALIDATION_ERROR',
    );
  }

  return category;
};

const submitUnknownMaterialPriceRuleRequest = async (
  userId: string,
  input: CreatePriceRuleRequestInput,
) => {
  const materialName = input.materialName!.trim();
  const categoryId = input.categoryId!.trim();
  const unit = input.unit!.trim();
  const normalizedMaterialName = normalizeSearchText(materialName);

  const category = await assertSelectableCategory(categoryId);

  if (categoriesRepository.isOtherCategory(category.nameEn)) {
    throw new AppError(
      'Choose a reviewed category or submit a category request before price review.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const pendingRequest =
    await priceRuleRequestsRepository.findPendingUnknownPriceRuleRequest({
      normalizedMaterialName,
      categoryId,
      unit,
      requestedByUserId: userId,
    });

  const runAi = () =>
    suggestPriceReferenceForReview(
      buildUnknownMaterialPriceReviewAiInput({
        materialName,
        categoryName: category.nameEn,
        normalizedMaterialName,
        categoryId,
        userId,
        condition: input.condition ?? null,
        quantity: input.quantity ?? null,
        unit,
        supplierPriceNis: input.supplierPriceNis ?? null,
      }),
    );

  if (pendingRequest) {
    if (input.listingDraftJson) {
      await priceRuleRequestsRepository.updatePriceRuleRequestDraftJson({
        id: pendingRequest.id,
        listingDraftJson: input.listingDraftJson,
      });
    }

    return handlePendingPriceRuleRequest(pendingRequest, runAi);
  }

  const aiSuggestion = await runAi();
  const created = await priceRuleRequestsRepository.createUnknownPriceRuleRequest({
    materialName,
    normalizedMaterialName,
    categoryId,
    unit,
    condition: input.condition ?? null,
    quantity: input.quantity ?? null,
    supplierPriceNis: input.supplierPriceNis ?? null,
    requestedByUserId: userId,
    listingDraftJson: input.listingDraftJson ?? null,
  });

  await applyAiSuggestionToPriceRuleRequest(created.id, aiSuggestion);

  return {
    id: created.id,
    status: created.status,
    aiStatus: aiSuggestion.status,
    aiProvider: aiSuggestion.aiProvider,
    message: buildPriceRuleReviewSuccessMessage(
      aiSuggestion.status,
      aiSuggestion.aiProvider,
    ),
  };
};

export const submitPriceRuleRequest = async (
  userId: string,
  input: CreatePriceRuleRequestInput,
) => {
  const categoryId = input.categoryId?.trim();
  if (!categoryId) {
    throw new AppError(
      'Please select a valid category before submitting price review.',
      400,
      'VALIDATION_ERROR',
    );
  }

  await assertSelectableCategory(categoryId);

  if (input.materialTypeId?.trim()) {
    return submitKnownMaterialPriceRuleRequest(userId, input);
  }

  return submitUnknownMaterialPriceRuleRequest(userId, input);
};

const extractDraftTitle = (listingDraftJson: unknown): string => {
  if (
    !listingDraftJson ||
    typeof listingDraftJson !== 'object' ||
    Array.isArray(listingDraftJson)
  ) {
    return '';
  }

  const title = (listingDraftJson as Record<string, unknown>).title;
  return typeof title === 'string' ? title.trim() : '';
};

const resolveMaxAllowedUnitPrice = (
  request: Parameters<typeof resolveBaseSuggestedMaxUnitPriceNis>[0] & {
    condition?: import('../../generated/prisma/client.js').MaterialCondition | null;
    listingDraftJson?: unknown;
  },
) => {
  const condition =
    request.condition ??
    (typeof request.listingDraftJson === 'object' &&
    request.listingDraftJson != null &&
    !Array.isArray(request.listingDraftJson)
      ? (request.listingDraftJson as Record<string, unknown>).condition
      : null);

  if (
    typeof condition === 'string' &&
    (condition === 'NEW' ||
      condition === 'LIKE_NEW' ||
      condition === 'GOOD' ||
      condition === 'USED' ||
      condition === 'NEEDS_REPAIR')
  ) {
    return resolveFinalAllowedMaxUnitPriceNis(request, condition);
  }

  return resolveFinalAllowedMaxUnitPriceNis(request, null);
};

export const listSupplierPriceRuleRequests = async (userId: string) => {
  const requests =
    await priceRuleRequestsRepository.listPriceRuleRequestsForSupplier(userId);

  return requests.map((request) => {
    const baseMaxAllowedUnitPriceNis = resolveBaseSuggestedMaxUnitPriceNis(request);
    const maxAllowedUnitPriceNis = resolveMaxAllowedUnitPrice(request);

    return {
      id: request.id,
      status: request.status,
      materialName:
        request.materialName ??
        request.materialType?.nameEn ??
        extractDraftTitle(request.listingDraftJson),
      unit: request.unit ?? request.materialType?.defaultUnit ?? null,
      quantity: request.quantity != null ? Number(request.quantity) : null,
      supplierPriceNis:
        request.supplierPriceNis != null
          ? Number(request.supplierPriceNis)
          : null,
      baseMaxAllowedUnitPriceNis,
      maxAllowedUnitPriceNis,
      moderatorNote: request.moderatorNote,
      categoryName: request.category?.nameEn ?? null,
      title: extractDraftTitle(request.listingDraftJson),
      hasDraft: request.listingDraftJson != null,
      createdAt: request.createdAt.toISOString(),
    };
  });
};

export const getPriceRuleRequestDraft = async (userId: string, id: string) => {
  const request = await priceRuleRequestsRepository.findPriceRuleRequestByIdForOwner(
    id,
    userId,
  );

  if (!request) {
    throw new AppError('Price rule request not found', 404, 'NOT_FOUND');
  }

  if (request.publishedMaterialId) {
    throw new AppError(
      'This listing was already completed.',
      409,
      'CONFLICT',
    );
  }

  const baseMaxAllowedUnitPriceNis = resolveBaseSuggestedMaxUnitPriceNis(request);
  const maxAllowedUnitPriceNis = resolveMaxAllowedUnitPrice(request);

  return {
    id: request.id,
    status: request.status,
    baseMaxAllowedUnitPriceNis,
    maxAllowedUnitPriceNis,
    unit: request.unit ?? request.materialType?.defaultUnit ?? null,
    category: request.category
      ? {
          id: request.category.id,
          nameEn: request.category.nameEn,
          nameAr: request.category.nameAr,
        }
      : null,
    listingDraftJson: request.listingDraftJson,
  };
};
