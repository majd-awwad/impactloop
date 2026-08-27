import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { decimalToNumber } from '../../utils/decimal.js';
import { createNotificationIfMissing } from '../notifications/notifications.repository.js';
import {
  deriveMaterialComponentMatchReasonCodes,
  primaryMaterialComponentMatchReasonCode,
  scoreMaterialComponentRelevance,
  type BuildCandidateComponentInput,
  type BuildCandidateMaterialInput,
  type MaterialComponentMatchReasonCode,
} from '../learning-projects/learning-projects.build-candidate-ranking.js';
import { mapSupplierRequest } from '../material-requests/material-requests.dto.js';
import type { RequestRow } from '../material-requests/material-requests.dto.js';
import {
  isWeakMatchScore,
  shouldLazyExpire,
} from '../material-requests/material-requests.lifecycle.js';
import {
  computeAvailableQuantity,
  getHeldQuantitiesByMaterialIds,
  getMaterialQuantityState,
} from '../reservations/reservations.quantity.js';

import * as repository from './supplier-material-requests.repository.js';
import type { SupplierCandidateMaterialRow } from './supplier-material-requests.repository.js';
import type {
  ListSupplierMaterialRequestsQuery,
  SuggestMaterialForRequestInput,
} from './supplier-material-requests.validation.js';

type SupplierRequestRow = NonNullable<
  Awaited<ReturnType<typeof repository.findRequestByIdForSupplier>>
>;

const ensureNotOwnRequest = <T extends { learnerId: string }>(
  row: T | null,
  supplierUserId: string,
): T => {
  if (!row || row.learnerId === supplierUserId) {
    throw new AppError('Material request not found', 404, 'NOT_FOUND');
  }
  return row;
};

const assertOpenRequestForSupplier = (row: SupplierRequestRow) => {
  if (shouldLazyExpire(row)) {
    throw new AppError('Material request is not open', 409, 'REQUEST_NOT_OPEN');
  }
  if (row.status !== 'OPEN') {
    throw new AppError('Material request is not open', 409, 'REQUEST_NOT_OPEN');
  }
};

const REQUEST_KEYWORD_STOP_TOKENS = new Set([
  'board',
  'boards',
  'component',
  'components',
  'item',
  'items',
  'kit',
  'kits',
  'material',
  'materials',
  'module',
  'modules',
  'part',
  'parts',
  'sensor',
  'sensors',
]);

const tokenizeRequestText = (value: string): string[] =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 || /\d/.test(token));

const requestSearchKeywords = (request: {
  requestedItemName: string;
  description?: string | null;
}): string[] => {
  const nameTerms = tokenizeRequestText(request.requestedItemName).filter(
    (token) => !REQUEST_KEYWORD_STOP_TOKENS.has(token),
  );
  // Model identifiers in the description (for example HC-SR04 or ESP32)
  // are useful identity evidence; ordinary prose is intentionally excluded.
  const descriptionModelTerms = tokenizeRequestText(
    request.description ?? '',
  ).filter((token) => /\d/.test(token));

  return [...new Set([...nameTerms, ...descriptionModelTerms])];
};

export const buildRequestRankingComponent = (request: {
  categoryId: string;
  requestedItemName: string;
  description?: string | null;
}): BuildCandidateComponentInput => ({
  categoryId: request.categoryId,
  componentName: request.requestedItemName,
  materialType: '',
  searchKeywords: requestSearchKeywords(request),
  alternativeKeywords: [],
  searchTerms: [request.requestedItemName],
});

const buildMaterialRankingInput = (
  material: SupplierCandidateMaterialRow,
): BuildCandidateMaterialInput => ({
  id: material.id,
  title: material.title,
  description: material.description,
  materialType: material.materialType,
  condition: material.condition,
  isFree: material.isFree,
  price: decimalToNumber(material.price),
  pickupAllowed: material.pickupAllowed,
  deliveryAllowed: material.deliveryAllowed,
  createdAt: material.createdAt,
  categoryId: material.categoryId,
  city: material.location?.city ?? '',
  area: material.location?.area ?? null,
  tags: material.tags.map((entry) => entry.tag),
  supplierVerified: false,
  ownerCompletedHandovers: 0,
});

const scoreMaterialAgainstRequest = (
  materialInput: BuildCandidateMaterialInput,
  componentInput: BuildCandidateComponentInput,
): {
  relevance: number;
  matchReasonCode: MaterialComponentMatchReasonCode | null;
} => {
  const relevance = scoreMaterialComponentRelevance(
    materialInput,
    componentInput,
  );
  const codes = deriveMaterialComponentMatchReasonCodes({
    material: materialInput,
    component: componentInput,
    relevance,
  });
  return { relevance, matchReasonCode: primaryMaterialComponentMatchReasonCode(codes) };
};

export const listSupplierMaterialRequests = async (
  supplierUserId: string,
  query: ListSupplierMaterialRequestsQuery,
) => {
  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await repository.listRequestsForSupplierFeed({
    supplierUserId,
    categoryId: query.categoryId,
    city: query.city,
    area: query.area,
    alternativesAllowed: query.alternativesAllowed,
    unansweredByMe: query.unansweredByMe,
    neededByBefore: query.neededByBefore,
    skip,
    take: query.limit,
  });

  return {
    items: rows.map((row) =>
      mapSupplierRequest(row as unknown as RequestRow, { supplierUserId, includeOwnMatches: false }),
    ),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
};

export const getSupplierMaterialRequest = async (
  supplierUserId: string,
  requestId: string,
) => {
  const row = ensureNotOwnRequest(
    await repository.findRequestByIdForSupplier(requestId, supplierUserId),
    supplierUserId,
  );

  return mapSupplierRequest(row as unknown as RequestRow, { supplierUserId, includeOwnMatches: true });
};

const requireOpenRequestForSupplier = async (
  supplierUserId: string,
  requestId: string,
): Promise<SupplierRequestRow> => {
  const row = ensureNotOwnRequest(
    await repository.findRequestByIdForSupplier(requestId, supplierUserId),
    supplierUserId,
  );
  assertOpenRequestForSupplier(row);
  return row;
};

export const getSupplierCandidateMaterialsForRequest = async (
  supplierUserId: string,
  requestId: string,
  limit: number,
) => {
  const request = await requireOpenRequestForSupplier(supplierUserId, requestId);

  const alreadyMatchedMaterialIds = new Set(
    request.matches.map((match) => match.materialId),
  );

  const materials = (
    await repository.findOwnedMaterialsForCandidates(supplierUserId)
  ).filter((material) => !alreadyMatchedMaterialIds.has(material.id));

  if (materials.length === 0) {
    return { requestId: request.id, items: [] };
  }

  const heldByMaterial = await getHeldQuantitiesByMaterialIds(
    materials.map((material) => material.id),
  );
  const componentInput = buildRequestRankingComponent(request);

  const items = materials
    .map((material) => {
      const availableQuantity = computeAvailableQuantity(
        material.quantity,
        heldByMaterial.get(material.id) ?? 0,
      );
      if (availableQuantity.lte(0)) {
        return null;
      }

      const materialInput = buildMaterialRankingInput(material);
      const { relevance, matchReasonCode } = scoreMaterialAgainstRequest(
        materialInput,
        componentInput,
      );
      if (relevance <= 0 || !matchReasonCode) {
        return null;
      }

      const isWeakMatch = isWeakMatchScore({
        rankingScore: relevance,
      });

      return {
        materialId: material.id,
        title: material.title,
        unit: material.unit,
        condition: material.condition,
        isFree: material.isFree,
        price: decimalToNumber(material.price),
        availableQuantity: decimalToNumber(availableQuantity),
        pickupAllowed: material.pickupAllowed,
        deliveryAllowed: material.deliveryAllowed,
        matchReasonCode,
        rankingScore: relevance,
        isWeakMatch,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort(
      (left, right) =>
        right.rankingScore - left.rankingScore ||
        left.materialId.localeCompare(right.materialId),
    )
    .slice(0, limit);

  return { requestId: request.id, items };
};

export const suggestMaterialForRequest = async (
  supplierUserId: string,
  requestId: string,
  input: SuggestMaterialForRequestInput,
) => {
  const request = await requireOpenRequestForSupplier(supplierUserId, requestId);

  const existingMatch = await repository.findMatchByRequestAndMaterial(
    request.id,
    input.materialId,
  );
  if (existingMatch) {
    const fresh = await repository.findRequestByIdForSupplier(
      request.id,
      supplierUserId,
    );
    return mapSupplierRequest(fresh! as unknown as RequestRow, {
      supplierUserId,
      includeOwnMatches: true,
    });
  }

  const material = await repository.findOwnedMaterialForSuggestion(
    supplierUserId,
    input.materialId,
  );
  if (!material) {
    const owned = await prisma.material.findFirst({
      where: { id: input.materialId, ownerId: supplierUserId },
      select: { id: true },
    });
    if (owned) {
      throw new AppError(
        'Material is not eligible to suggest',
        409,
        'MATERIAL_NOT_ELIGIBLE',
      );
    }
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  const quantityState = await getMaterialQuantityState(prisma, material.id);
  if (!quantityState || quantityState.availableQuantity.lte(0)) {
    throw new AppError(
      'Material is not eligible to suggest',
      409,
      'MATERIAL_NOT_ELIGIBLE',
    );
  }

  const materialInput = buildMaterialRankingInput(material);
  const componentInput = buildRequestRankingComponent(request);
  const { relevance, matchReasonCode } = scoreMaterialAgainstRequest(
    materialInput,
    componentInput,
  );

  const isWeakMatch = isWeakMatchScore({
    rankingScore: relevance,
  });

  if (isWeakMatch && !input.confirmWeakMatch) {
    throw new AppError(
      'This material is a weak match for the request. Confirm to suggest anyway.',
      409,
      'WEAK_MATCH_CONFIRMATION_REQUIRED',
      { rankingScore: relevance, matchReasonCode },
    );
  }

  const match = await repository.createMatch({
    materialRequest: { connect: { id: request.id } },
    material: { connect: { id: material.id } },
    supplierUser: { connect: { id: supplierUserId } },
    status: 'SUGGESTED',
    matchReasonCode,
    rankingScore: relevance,
  });

  await createNotificationIfMissing({
    userId: request.learnerId,
    notificationType: 'MATERIAL_REQUEST_SUGGESTION',
    title: 'New material suggestion',
    body: `A supplier suggested a material for your request "${request.requestedItemName}".`,
    relatedEntityType: 'MATERIAL_REQUEST',
    relatedEntityId: request.id,
    eventKey: `mr:suggest:${match.id}`,
    entityType: 'MATERIAL_REQUEST',
    entityId: request.id,
    actionType: 'OPEN_ENTITY',
    metadata: { requestedItemName: request.requestedItemName },
  });

  const fresh = await repository.findRequestByIdForSupplier(
    request.id,
    supplierUserId,
  );
  return mapSupplierRequest(fresh! as unknown as RequestRow, { supplierUserId, includeOwnMatches: true });
};
