import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { normalizeSearchText } from '../../utils/normalize-search-text.js';
import {
  runIdempotentOperation,
  validateIdempotencyKey,
} from '../../services/idempotency.service.js';
import { isMaterialSelectableCategory } from '../categories/categories.repository.js';
import { mapLearnerRequest } from '../material-requests/material-requests.dto.js';
import {
  computeExpiresAt,
  MAX_OPEN_LEARNER_MATERIAL_REQUESTS,
  shouldLazyExpire,
} from '../material-requests/material-requests.lifecycle.js';
import { refreshUnavailableSuggestedMatches } from '../material-requests/material-requests.match-availability.js';

import * as repository from './learner-material-requests.repository.js';
import type {
  CreateLearnerMaterialRequestInput,
  ListLearnerMaterialRequestsQuery,
  UpdateLearnerMaterialRequestInput,
} from './learner-material-requests.validation.js';

const ensureNotExpired = async <
  T extends {
    id: string;
    status: string;
    expiresAt: Date;
  },
>(
  request: T,
) => {
  if (
    shouldLazyExpire({
      status: request.status as 'OPEN',
      expiresAt: request.expiresAt,
    })
  ) {
    return repository.updateRequest(request.id, {
      status: 'EXPIRED',
    });
  }
  return request;
};

const resolveLocationSnapshot = async (
  learnerId: string,
  input: {
    sourceSavedLocationId?: string | null;
    locationCountry?: string;
    locationCity?: string;
    locationArea?: string | null;
  },
) => {
  if (input.sourceSavedLocationId) {
    const saved = await prisma.userSavedLocation.findFirst({
      where: { id: input.sourceSavedLocationId, userId: learnerId },
      include: { location: true },
    });
    if (!saved) {
      throw new AppError('Saved location not found', 404, 'NOT_FOUND');
    }
    return {
      locationCountry: saved.location.country,
      locationCity: saved.location.city,
      locationArea: saved.location.area,
      sourceSavedLocationId: saved.id,
    };
  }

  return {
    locationCountry: input.locationCountry?.trim() || 'Palestine',
    locationCity: input.locationCity!.trim(),
    locationArea: input.locationArea ?? null,
    sourceSavedLocationId: null as string | null,
  };
};

const resolveProjectOrigin = async (
  learnerId: string,
  input: {
    projectId?: string | null;
    projectBuildId?: string | null;
    projectBuildItemId?: string | null;
  },
) => {
  if (
    !input.projectId &&
    !input.projectBuildId &&
    !input.projectBuildItemId
  ) {
    return {
      projectId: null as string | null,
      projectBuildId: null as string | null,
      projectBuildItemId: null as string | null,
    };
  }

  if (input.projectBuildItemId) {
    const item = await prisma.projectBuildItem.findUnique({
      where: { id: input.projectBuildItemId },
      include: {
        build: true,
        requiredComponent: true,
      },
    });
    if (!item || item.build.learnerId !== learnerId) {
      throw new AppError('Build item not found', 404, 'NOT_FOUND');
    }
    if (input.projectBuildId && input.projectBuildId !== item.buildId) {
      throw new AppError('Build item does not match build', 400, 'VALIDATION_ERROR');
    }
    if (input.projectId && input.projectId !== item.build.projectId) {
      throw new AppError(
        'Build item does not match project',
        400,
        'VALIDATION_ERROR',
      );
    }
    return {
      projectId: item.build.projectId,
      projectBuildId: item.buildId,
      projectBuildItemId: item.id,
    };
  }

  if (input.projectBuildId) {
    const build = await prisma.projectBuild.findFirst({
      where: { id: input.projectBuildId, learnerId },
    });
    if (!build) {
      throw new AppError('Project build not found', 404, 'NOT_FOUND');
    }
    if (input.projectId && input.projectId !== build.projectId) {
      throw new AppError('Build does not match project', 400, 'VALIDATION_ERROR');
    }
    return {
      projectId: build.projectId,
      projectBuildId: build.id,
      projectBuildItemId: null as string | null,
    };
  }

  const project = await prisma.learningProject.findUnique({
    where: { id: input.projectId! },
    select: { id: true },
  });
  if (!project) {
    throw new AppError('Project not found', 404, 'NOT_FOUND');
  }
  return {
    projectId: project.id,
    projectBuildId: null as string | null,
    projectBuildItemId: null as string | null,
  };
};

const assertSelectableCategory = async (categoryId: string) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true, categoryType: true },
  });
  if (
    !category ||
    !category.isActive ||
    !isMaterialSelectableCategory(category.categoryType)
  ) {
    throw new AppError('Category not found', 404, 'NOT_FOUND');
  }
  return category;
};

export const createLearnerMaterialRequest = async (
  learnerId: string,
  input: CreateLearnerMaterialRequestInput,
) => {
  await assertSelectableCategory(input.categoryId);
  const openCount = await repository.countOpenRequestsForLearner(learnerId);
  if (openCount >= MAX_OPEN_LEARNER_MATERIAL_REQUESTS) {
    throw new AppError(
      'Too many open material requests',
      409,
      'ACTIVE_REQUEST_LIMIT',
    );
  }

  const normalized = normalizeSearchText(input.requestedItemName);
  const duplicate = await repository.findDuplicateOpenRequest({
    learnerId,
    categoryId: input.categoryId,
    normalizedRequestedItemName: normalized,
  });
  if (duplicate) {
    throw new AppError(
      'An open request already exists for this item and category',
      409,
      'DUPLICATE_OPEN_REQUEST',
    );
  }

  const location = await resolveLocationSnapshot(learnerId, input);
  const origin = await resolveProjectOrigin(learnerId, input);
  const createdAt = new Date();
  const expiresAt = computeExpiresAt(createdAt, input.neededBy ?? null);

  const created = await repository.createRequest({
    learner: { connect: { id: learnerId } },
    category: { connect: { id: input.categoryId } },
    requestedItemName: input.requestedItemName.trim(),
    normalizedRequestedItemName: normalized,
    description: input.description ?? null,
    quantity: input.quantity,
    unit: input.unit.trim(),
    alternativesAllowed: input.alternativesAllowed,
    locationCountry: location.locationCountry,
    locationCity: location.locationCity,
    locationArea: location.locationArea,
    ...(location.sourceSavedLocationId
      ? {
          sourceSavedLocation: {
            connect: { id: location.sourceSavedLocationId },
          },
        }
      : {}),
    ...(origin.projectId
      ? { project: { connect: { id: origin.projectId } } }
      : {}),
    ...(origin.projectBuildId
      ? { projectBuild: { connect: { id: origin.projectBuildId } } }
      : {}),
    ...(origin.projectBuildItemId
      ? { projectBuildItem: { connect: { id: origin.projectBuildItemId } } }
      : {}),
    status: 'OPEN',
    neededBy: input.neededBy ?? null,
    expiresAt,
  });

  return mapLearnerRequest(created);
};

export const createLearnerMaterialRequestIdempotent = async (
  learnerId: string,
  input: CreateLearnerMaterialRequestInput,
  idempotencyKey: string,
) => {
  const key = validateIdempotencyKey(idempotencyKey);
  return runIdempotentOperation({
    userId: learnerId,
    scope: 'LEARNER_CREATE_MATERIAL_REQUEST',
    key,
    payload: input,
    resourceType: 'LearnerMaterialRequest',
    getResourceId: (result) => (result as { id: string }).id,
    handler: async () => createLearnerMaterialRequest(learnerId, input),
  });
};

export const listLearnerMaterialRequests = async (
  learnerId: string,
  query: ListLearnerMaterialRequestsQuery,
) => {
  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await repository.listRequestsForLearner({
    learnerId,
    status: query.status,
    skip,
    take: query.limit,
  });

  const items = [];
  for (const row of rows) {
    const ensured = await ensureNotExpired(row);
    const fresh =
      ensured.id === row.id && ensured.status === row.status
        ? row
        : ((await repository.findRequestByIdForLearner(row.id, learnerId)) ??
          row);
    items.push(mapLearnerRequest(fresh, { includeMatches: false }));
  }

  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
};

export const getLearnerMaterialRequest = async (
  learnerId: string,
  requestId: string,
) => {
  const row = await repository.findRequestByIdForLearner(requestId, learnerId);
  if (!row) {
    throw new AppError('Material request not found', 404, 'NOT_FOUND');
  }
  const ensured = await ensureNotExpired(row);
  let fresh =
    ensured.status !== row.status
      ? await repository.findRequestByIdForLearner(requestId, learnerId)
      : row;
  if (!fresh) {
    throw new AppError('Material request not found', 404, 'NOT_FOUND');
  }

  const marked = await refreshUnavailableSuggestedMatches({
    matches: fresh.matches,
    learnerId: fresh.learnerId,
    requestedItemName: fresh.requestedItemName,
  });
  if (marked.length > 0) {
    fresh =
      (await repository.findRequestByIdForLearner(requestId, learnerId)) ??
      fresh;
  }

  return mapLearnerRequest(fresh);
};

export const updateLearnerMaterialRequest = async (
  learnerId: string,
  requestId: string,
  input: UpdateLearnerMaterialRequestInput,
) => {
  const row = await repository.findRequestByIdForLearner(requestId, learnerId);
  if (!row) {
    throw new AppError('Material request not found', 404, 'NOT_FOUND');
  }
  const current = await ensureNotExpired(row);
  if (current.status !== 'OPEN') {
    throw new AppError(
      'Request cannot be edited',
      409,
      'REQUEST_NOT_EDITABLE',
    );
  }

  const hasMatches = (current._count?.matches ?? current.matches?.length ?? 0) > 0;
  if (hasMatches) {
    if (
      input.requestedItemName != null ||
      input.categoryId != null ||
      input.quantity != null ||
      input.unit != null
    ) {
      throw new AppError(
        'Core request fields are locked after suggestions exist',
        409,
        'REQUEST_NOT_EDITABLE',
      );
    }
  }

  if (input.categoryId) {
    await assertSelectableCategory(input.categoryId);
  }

  let locationUpdate: Awaited<ReturnType<typeof resolveLocationSnapshot>> | null =
    null;
  if (
    input.sourceSavedLocationId !== undefined ||
    input.locationCity != null ||
    input.locationCountry != null ||
    input.locationArea !== undefined
  ) {
    locationUpdate = await resolveLocationSnapshot(learnerId, {
      sourceSavedLocationId: input.sourceSavedLocationId,
      locationCountry: input.locationCountry ?? current.locationCountry,
      locationCity: input.locationCity ?? current.locationCity,
      locationArea:
        input.locationArea !== undefined
          ? input.locationArea
          : current.locationArea,
    });
  }

  const neededBy =
    input.neededBy !== undefined ? input.neededBy : current.neededBy;
  const expiresAt =
    input.neededBy !== undefined || locationUpdate
      ? computeExpiresAt(current.createdAt, neededBy)
      : undefined;

  const updated = await repository.updateRequest(requestId, {
    ...(input.requestedItemName
      ? {
          requestedItemName: input.requestedItemName.trim(),
          normalizedRequestedItemName: normalizeSearchText(
            input.requestedItemName,
          ),
        }
      : {}),
    ...(input.categoryId
      ? { category: { connect: { id: input.categoryId } } }
      : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.quantity != null ? { quantity: input.quantity } : {}),
    ...(input.unit ? { unit: input.unit.trim() } : {}),
    ...(input.alternativesAllowed != null
      ? { alternativesAllowed: input.alternativesAllowed }
      : {}),
    ...(locationUpdate
      ? {
          locationCountry: locationUpdate.locationCountry,
          locationCity: locationUpdate.locationCity,
          locationArea: locationUpdate.locationArea,
          sourceSavedLocation: locationUpdate.sourceSavedLocationId
            ? { connect: { id: locationUpdate.sourceSavedLocationId } }
            : { disconnect: true },
        }
      : {}),
    ...(input.neededBy !== undefined ? { neededBy } : {}),
    ...(expiresAt ? { expiresAt } : {}),
  });

  return mapLearnerRequest(updated);
};

export const cancelLearnerMaterialRequest = async (
  learnerId: string,
  requestId: string,
) => {
  const row = await repository.findRequestByIdForLearner(requestId, learnerId);
  if (!row) {
    throw new AppError('Material request not found', 404, 'NOT_FOUND');
  }
  const current = await ensureNotExpired(row);
  if (current.status !== 'OPEN') {
    throw new AppError('Request is not open', 409, 'REQUEST_NOT_OPEN');
  }
  const updated = await repository.updateRequest(requestId, {
    status: 'CANCELLED',
    cancelledAt: new Date(),
  });
  return mapLearnerRequest(updated);
};

export const fulfillLearnerMaterialRequest = async (
  learnerId: string,
  requestId: string,
) => {
  const row = await repository.findRequestByIdForLearner(requestId, learnerId);
  if (!row) {
    throw new AppError('Material request not found', 404, 'NOT_FOUND');
  }
  const current = await ensureNotExpired(row);
  if (current.status !== 'OPEN') {
    throw new AppError('Request is not open', 409, 'REQUEST_NOT_OPEN');
  }
  const updated = await repository.updateRequest(requestId, {
    status: 'FULFILLED',
    fulfilledAt: new Date(),
  });
  return mapLearnerRequest(updated);
};

export const duplicateLearnerMaterialRequest = async (
  learnerId: string,
  requestId: string,
) => {
  const row = await repository.findRequestByIdForLearner(requestId, learnerId);
  if (!row) {
    throw new AppError('Material request not found', 404, 'NOT_FOUND');
  }
  if (row.status !== 'EXPIRED' && row.status !== 'CANCELLED') {
    throw new AppError(
      'Only expired or cancelled requests can be duplicated',
      409,
      'REQUEST_NOT_EDITABLE',
    );
  }

  return createLearnerMaterialRequest(learnerId, {
    requestedItemName: row.requestedItemName,
    categoryId: row.categoryId,
    description: row.description,
    quantity: Number(row.quantity),
    unit: row.unit,
    alternativesAllowed: row.alternativesAllowed,
    sourceSavedLocationId: row.sourceSavedLocationId,
    locationCountry: row.locationCountry,
    locationCity: row.locationCity,
    locationArea: row.locationArea,
    neededBy: null,
    projectId: row.projectId,
    projectBuildId: row.projectBuildId,
    projectBuildItemId: row.projectBuildItemId,
  });
};

export const dismissLearnerMaterialRequestMatch = async (
  learnerId: string,
  matchId: string,
) => {
  const match = await repository.findMatchById(matchId);
  if (!match || match.materialRequest.learnerId !== learnerId) {
    throw new AppError('Suggestion not found', 404, 'NOT_FOUND');
  }
  if (match.status !== 'SUGGESTED') {
    throw new AppError('Suggestion cannot be dismissed', 409, 'REQUEST_NOT_EDITABLE');
  }
  await repository.updateMatchStatus(matchId, 'DISMISSED');
  return getLearnerMaterialRequest(learnerId, match.materialRequestId);
};

export const fulfillRequestFromCompletedReservation = async (
  reservationId: string,
) => {
  const match = await prisma.learnerMaterialRequestMatch.findFirst({
    where: { reservationId },
    include: { materialRequest: true },
  });
  if (!match || match.materialRequest.status !== 'OPEN') {
    return null;
  }
  if (shouldLazyExpire(match.materialRequest)) {
    await repository.updateRequest(match.materialRequestId, {
      status: 'EXPIRED',
    });
    return null;
  }
  return repository.updateRequest(match.materialRequestId, {
    status: 'FULFILLED',
    fulfilledAt: new Date(),
  });
};
