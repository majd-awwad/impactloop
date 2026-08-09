import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { prisma } from '../../database/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { normalizeSearchText } from '../../utils/normalize-search-text.js';
import {
  isPrismaCode,
  runSerializableTransaction,
} from '../../utils/transaction-retry.js';
import { invalidateLearnerHomeCache } from '../learner-home/learner-home.service.js';
import {
  syncBuildItemFromCompletedMaterialRequest,
  type BuildMaterialRequestSyncOutcome,
} from '../learning-projects/learning-projects.build-material-request-sync.js';
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
import {
  buildLearnerMaterialRequestOpenBusinessKey,
  clearLearnerMaterialRequestOpenBusinessKey,
} from '../material-requests/material-requests.open-business-key.js';
import { getHeldQuantitiesByMaterialIds } from '../reservations/reservations.quantity.js';

import * as repository from './learner-material-requests.repository.js';
import type {
  CreateLearnerMaterialRequestInput,
  ListLearnerMaterialRequestsQuery,
  UpdateLearnerMaterialRequestInput,
} from './learner-material-requests.validation.js';

const assertRequestOpen = (row: { status: string; expiresAt: Date }) => {
  if (
    shouldLazyExpire({
      status: 'OPEN',
      expiresAt: row.expiresAt,
    })
  ) {
    throw new AppError('Request is not open', 409, 'REQUEST_NOT_OPEN');
  }
  if (row.status !== 'OPEN') {
    throw new AppError('Request is not open', 409, 'REQUEST_NOT_OPEN');
  }
};

const assertRequestEditable = (row: { status: string; expiresAt: Date }) => {
  if (
    shouldLazyExpire({
      status: 'OPEN',
      expiresAt: row.expiresAt,
    })
  ) {
    throw new AppError(
      'Request cannot be edited',
      409,
      'REQUEST_NOT_EDITABLE',
    );
  }
  if (row.status !== 'OPEN') {
    throw new AppError(
      'Request cannot be edited',
      409,
      'REQUEST_NOT_EDITABLE',
    );
  }
};

const buildHeldByMaterialId = async (
  matches: Array<{ materialId: string }>,
) => {
  const held = await getHeldQuantitiesByMaterialIds(
    matches.map((match) => match.materialId),
  );
  const heldByMaterialId = new Map<string, number>();
  for (const [materialId, quantity] of held.entries()) {
    heldByMaterialId.set(materialId, Number(quantity));
  }
  return heldByMaterialId;
};

const resolveLocationSnapshot = async (
  learnerId: string,
  input: {
    sourceSavedLocationId?: string | null;
    locationCountry?: string;
    locationCity?: string;
    locationArea?: string | null;
  },
  client: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  if (input.sourceSavedLocationId) {
    const saved = await client.userSavedLocation.findFirst({
      where: { id: input.sourceSavedLocationId, userId: learnerId },
      include: { location: true },
    });
    if (!saved) {
      throw new AppError(
        'Saved location not found',
        404,
        COMMON_ERROR_CODES.notFound,
      );
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
  client: Prisma.TransactionClient | typeof prisma = prisma,
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
    const item = await client.projectBuildItem.findUnique({
      where: { id: input.projectBuildItemId },
      include: {
        build: true,
        requiredComponent: true,
      },
    });
    if (!item || item.build.learnerId !== learnerId) {
      throw new AppError(
        'Build item not found',
        404,
        COMMON_ERROR_CODES.notFound,
      );
    }
    if (input.projectBuildId && input.projectBuildId !== item.buildId) {
      throw new AppError(
        'Build item does not match build',
        400,
        COMMON_ERROR_CODES.validationError,
      );
    }
    if (input.projectId && input.projectId !== item.build.projectId) {
      throw new AppError(
        'Build item does not match project',
        400,
        COMMON_ERROR_CODES.validationError,
      );
    }
    return {
      projectId: item.build.projectId,
      projectBuildId: item.buildId,
      projectBuildItemId: item.id,
    };
  }

  if (input.projectBuildId) {
    const build = await client.projectBuild.findFirst({
      where: { id: input.projectBuildId, learnerId },
    });
    if (!build) {
      throw new AppError(
        'Project build not found',
        404,
        COMMON_ERROR_CODES.notFound,
      );
    }
    if (input.projectId && input.projectId !== build.projectId) {
      throw new AppError(
        'Build does not match project',
        400,
        COMMON_ERROR_CODES.validationError,
      );
    }
    return {
      projectId: build.projectId,
      projectBuildId: build.id,
      projectBuildItemId: null as string | null,
    };
  }

  const project = await client.learningProject.findUnique({
    where: { id: input.projectId! },
    select: { id: true },
  });
  if (!project) {
    throw new AppError('Project not found', 404, COMMON_ERROR_CODES.notFound);
  }
  return {
    projectId: project.id,
    projectBuildId: null as string | null,
    projectBuildItemId: null as string | null,
  };
};

const assertSelectableCategory = async (
  categoryId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  const category = await client.category.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true, categoryType: true },
  });
  if (
    !category ||
    !category.isActive ||
    !isMaterialSelectableCategory(category.categoryType)
  ) {
    throw new AppError('Category not found', 404, COMMON_ERROR_CODES.notFound);
  }
  return category;
};

export const createLearnerMaterialRequest = async (
  learnerId: string,
  input: CreateLearnerMaterialRequestInput,
  tx?: Prisma.TransactionClient,
) => {
  const persist = async (client: Prisma.TransactionClient) => {
    await repository.lockLearnerForMaterialRequestCreate(learnerId, client);
    await assertSelectableCategory(input.categoryId, client);
    const openCount = await repository.countOpenRequestsForLearner(
      learnerId,
      client,
    );
    if (openCount >= MAX_OPEN_LEARNER_MATERIAL_REQUESTS) {
      throw new AppError(
        'Too many open material requests',
        409,
        'ACTIVE_REQUEST_LIMIT',
      );
    }

    const normalized = normalizeSearchText(input.requestedItemName);
    const openBusinessKey = buildLearnerMaterialRequestOpenBusinessKey(
      learnerId,
      input.categoryId,
      normalized,
    );
    const duplicate = await repository.findDuplicateOpenRequest(
      {
        learnerId,
        categoryId: input.categoryId,
        normalizedRequestedItemName: normalized,
      },
      client,
    );
    if (duplicate) {
      throw new AppError(
        'An open request already exists for this item and category',
        409,
        'DUPLICATE_OPEN_REQUEST',
      );
    }

    const location = await resolveLocationSnapshot(learnerId, input, client);
    const origin = await resolveProjectOrigin(learnerId, input, client);
    const createdAt = new Date();
    const expiresAt = computeExpiresAt(createdAt, input.neededBy ?? null);

    const created = await repository.createRequest(
      {
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
        openBusinessKey,
        neededBy: input.neededBy ?? null,
        expiresAt,
      },
      client,
    );

    return mapLearnerRequest(created);
  };

  try {
    if (tx) {
      return await persist(tx);
    }

    return await runSerializableTransaction((serializableTx) =>
      persist(serializableTx),
    );
  } catch (error) {
    if (isPrismaCode(error, 'P2002')) {
      throw new AppError(
        'An open request already exists for this item and category',
        409,
        'DUPLICATE_OPEN_REQUEST',
      );
    }
    throw error;
  }
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
    handler: (tx) => createLearnerMaterialRequest(learnerId, input, tx),
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

  const items = rows.map((row) =>
    mapLearnerRequest(row, { includeMatches: false }),
  );

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
    throw new AppError(
      'Material request not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  const heldByMaterialId = await buildHeldByMaterialId(row.matches ?? []);
  return mapLearnerRequest(row, { heldByMaterialId });
};

export const updateLearnerMaterialRequest = async (
  learnerId: string,
  requestId: string,
  input: UpdateLearnerMaterialRequestInput,
) => {
  const row = await repository.findRequestByIdForLearner(requestId, learnerId);
  if (!row) {
    throw new AppError(
      'Material request not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }
  assertRequestEditable(row);

  const hasMatches = (row._count?.matches ?? row.matches?.length ?? 0) > 0;
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
      locationCountry: input.locationCountry ?? row.locationCountry,
      locationCity: input.locationCity ?? row.locationCity,
      locationArea:
        input.locationArea !== undefined
          ? input.locationArea
          : row.locationArea,
    });
  }

  const neededBy =
    input.neededBy !== undefined ? input.neededBy : row.neededBy;
  const expiresAt =
    input.neededBy !== undefined || locationUpdate
      ? computeExpiresAt(row.createdAt, neededBy)
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
    ...(input.requestedItemName || input.categoryId
      ? {
          openBusinessKey: buildLearnerMaterialRequestOpenBusinessKey(
            learnerId,
            input.categoryId ?? row.categoryId,
            input.requestedItemName
              ? normalizeSearchText(input.requestedItemName)
              : row.normalizedRequestedItemName,
          ),
        }
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
    throw new AppError(
      'Material request not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }
  assertRequestOpen(row);
  const updated = await repository.updateRequest(requestId, {
    status: 'CANCELLED',
    cancelledAt: new Date(),
    ...clearLearnerMaterialRequestOpenBusinessKey,
  });
  return mapLearnerRequest(updated);
};

export const fulfillLearnerMaterialRequest = async (
  learnerId: string,
  requestId: string,
) => {
  const row = await repository.findRequestByIdForLearner(requestId, learnerId);
  if (!row) {
    throw new AppError(
      'Material request not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }
  assertRequestOpen(row);
  const updated = await repository.updateRequest(requestId, {
    status: 'FULFILLED',
    fulfilledAt: new Date(),
    ...clearLearnerMaterialRequestOpenBusinessKey,
  });
  return mapLearnerRequest(updated);
};

export const duplicateLearnerMaterialRequest = async (
  learnerId: string,
  requestId: string,
) => {
  const row = await repository.findRequestByIdForLearner(requestId, learnerId);
  if (!row) {
    throw new AppError(
      'Material request not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
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
    throw new AppError(
      'Suggestion not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }
  if (match.status !== 'SUGGESTED') {
    throw new AppError('Suggestion cannot be dismissed', 409, 'REQUEST_NOT_EDITABLE');
  }
  await repository.updateMatchStatus(matchId, 'DISMISSED');
  return getLearnerMaterialRequest(learnerId, match.materialRequestId);
};

export type FulfillFromCompletedReservationResult = {
  id: string;
  learnerId: string;
  requestedItemName: string;
  status: string;
  transitionedToFulfilled: boolean;
  buildSyncOutcome: BuildMaterialRequestSyncOutcome;
};

const loadValidMatchForCompletedReservation = async (
  reservationId: string,
) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      requesterId: true,
      materialId: true,
    },
  });

  if (!reservation || reservation.status !== 'COMPLETED') {
    return null;
  }

  const matches = await prisma.learnerMaterialRequestMatch.findMany({
    where: { reservationId },
    include: { materialRequest: true },
  });

  const validMatches = matches.filter(
    (match) =>
      match.reservationId === reservation.id &&
      match.materialId === reservation.materialId,
  );

  if (validMatches.length !== 1) {
    return null;
  }

  return {
    match: validMatches[0]!,
    reservation,
  };
};

export const fulfillRequestFromCompletedReservation = async (
  reservationId: string,
): Promise<FulfillFromCompletedReservationResult | null> => {
  const loaded = await loadValidMatchForCompletedReservation(reservationId);
  if (!loaded) {
    return null;
  }

  const outcome = await runSerializableTransaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        status: true,
        requesterId: true,
        materialId: true,
      },
    });

    if (!reservation || reservation.status !== 'COMPLETED') {
      return null;
    }

    const matches = await tx.learnerMaterialRequestMatch.findMany({
      where: { reservationId },
      include: { materialRequest: true },
    });

    const validMatches = matches.filter(
      (match) =>
        match.reservationId === reservation.id &&
        match.materialId === reservation.materialId,
    );

    if (validMatches.length !== 1) {
      return null;
    }

    const match = validMatches[0]!;
    const materialRequest = match.materialRequest;

    if (reservation.requesterId !== materialRequest.learnerId) {
      return null;
    }

    if (
      materialRequest.status !== 'OPEN' &&
      materialRequest.status !== 'FULFILLED'
    ) {
      return null;
    }

    let transitionedToFulfilled = false;
    let requestRow = materialRequest;

    if (materialRequest.status === 'OPEN') {
      if (
        shouldLazyExpire({
          status: 'OPEN',
          expiresAt: materialRequest.expiresAt,
        })
      ) {
        await tx.learnerMaterialRequest.update({
          where: { id: materialRequest.id },
          data: {
            status: 'EXPIRED',
            ...clearLearnerMaterialRequestOpenBusinessKey,
          },
        });
        return null;
      }

      requestRow = await tx.learnerMaterialRequest.update({
        where: { id: materialRequest.id },
        data: {
          status: 'FULFILLED',
          fulfilledAt: new Date(),
          ...clearLearnerMaterialRequestOpenBusinessKey,
        },
      });
      transitionedToFulfilled = true;
    }

    const buildSyncOutcome = await syncBuildItemFromCompletedMaterialRequest(
      tx,
      {
        materialRequest: {
          id: requestRow.id,
          learnerId: requestRow.learnerId,
          projectBuildId: requestRow.projectBuildId,
          projectBuildItemId: requestRow.projectBuildItemId,
        },
        match: {
          materialRequestId: match.materialRequestId,
          materialId: match.materialId,
          reservationId: match.reservationId,
        },
        reservation,
      },
    );

    return {
      id: requestRow.id,
      learnerId: requestRow.learnerId,
      requestedItemName: requestRow.requestedItemName,
      status: requestRow.status,
      transitionedToFulfilled,
      buildSyncOutcome,
    };
  });

  if (!outcome) {
    return null;
  }

  if (outcome.buildSyncOutcome === 'synced') {
    invalidateLearnerHomeCache(outcome.learnerId);
  }

  return outcome;
};
