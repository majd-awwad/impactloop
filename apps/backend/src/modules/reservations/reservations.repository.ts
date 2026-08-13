import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  ACTIVE_HOLD_STATUSES,
  decimalToNumber,
  getMaterialQuantityState,
  isPositiveDecimal,
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
  toDecimal,
} from './reservations.quantity.js';
import { expireStalePendingReservationsForLearnerMaterial } from './reservations.pending-expiry.repository.js';
import { expireStaleMissedPickupsForMaterialIdsInTransaction } from './reservations.missed-pickup-expiry.repository.js';
import { formatReservationHistoryNote } from './reservation-status-history.js';
import {
  resolveReservationPricingForCreate,
  type ReservationQuoteInput,
} from './reservation-pricing.service.js';
import {
  setBuildItemLinkedReservationId,
  validateBuildItemForReservationLink,
} from '../learning-projects/learning-projects.build-reservation-linking.js';
import { applyBuildReservationSyncInTransaction } from '../learning-projects/learning-projects.build-reservation-sync.js';
import {
  flushPostCommitPaymentRefunds,
  handleReservationPaymentLifecycleTransition,
  type PostCommitRefundTask,
} from '../payments/payments.lifecycle.js';

const reservationInclude = {
  material: {
    select: {
      id: true,
      title: true,
      status: true,
      unit: true,
      quantity: true,
    },
  },
  requester: {
    select: {
      id: true,
      displayName: true,
    },
  },
  owner: {
    select: {
      id: true,
      displayName: true,
    },
  },
} satisfies Prisma.ReservationInclude;

// Explicit scalar select keeps list queries working when the database has not
// yet received newer pricing / delivery-group columns from schema migrations.
const learnerReservationListScalarSelect = {
  id: true,
  requesterId: true,
  ownerId: true,
  status: true,
  quantityRequested: true,
  message: true,
  fulfillmentMethod: true,
  paymentMethod: true,
  learnerPreferredPickupWindows: true,
  learnerPreferredDeliveryWindows: true,
  deliveryAddressText: true,
  safeDropoffAllowed: true,
  deliveryNote: true,
  createdAt: true,
  updatedAt: true,
  pickupWindowStart: true,
  pickupWindowEnd: true,
  supplierProposedPickupWindowStart: true,
  supplierProposedPickupWindowEnd: true,
  learnerProposedPickupWindowStart: true,
  learnerProposedPickupWindowEnd: true,
  pendingRescheduleRequestedBy: true,
  pendingRescheduleReason: true,
  pendingRescheduleNote: true,
  supplierPickupWindowStart: true,
  supplierPickupWindowEnd: true,
  confirmedDeliveryWindowStart: true,
  confirmedDeliveryWindowEnd: true,
  earliestDeliveryStart: true,
  schedulingConflictReason: true,
  supplierNote: true,
  rejectionReason: true,
  selfPickupCodeHash: true,
  // Pricing / group fields required for batched list paymentSummary.
  materialSubtotal: true,
  deliveryFee: true,
  unitPriceAtReservation: true,
  totalAmount: true,
  pricingCurrency: true,
  deliveryZone: true,
  deliveryGroupId: true,
} satisfies Prisma.ReservationSelect;

const learnerReservationListSelect = {
  ...learnerReservationListScalarSelect,
  material: {
    select: {
      id: true,
      title: true,
      materialType: true,
      customMaterialType: true,
      status: true,
      unit: true,
      deliveryAllowed: true,
      location: {
        select: {
          country: true,
          city: true,
          area: true,
          addressLine: true,
          latitude: true,
          longitude: true,
          isApproximate: true,
        },
      },
      images: {
        select: {
          imageUrl: true,
          isCover: true,
          sortOrder: true,
        },
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
        take: 1,
      },
    },
  },
  owner: {
    select: {
      id: true,
      displayName: true,
      supplierProfile: {
        select: {
          publicName: true,
          organizationProfile: {
            select: {
              organizationName: true,
            },
          },
        },
      },
    },
  },
  deliveries: {
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
      assignedDriverProfile: {
        select: {
          userId: true,
          displayName: true,
        },
      },
    },
    orderBy: { requestedAt: 'desc' },
  },
  noShowReports: {
    select: {
      id: true,
      status: true,
      targetRole: true,
      reasonCode: true,
    },
  },
} satisfies Prisma.ReservationSelect;

const learnerCancelInclude = {
  material: {
    select: {
      id: true,
      title: true,
      status: true,
      unit: true,
      quantity: true,
    },
  },
} satisfies Prisma.ReservationInclude;

export type LearnerReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

export type LearnerReservationListRecord = Prisma.ReservationGetPayload<{
  select: typeof learnerReservationListSelect;
}>;

export type LearnerCancelledReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof learnerCancelInclude;
}>;

const loadLearnerReservationRecord = async (
  reservationId: string,
): Promise<LearnerReservationRecord> => {
  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
  });

  const material = await prisma.material.findUniqueOrThrow({
    where: { id: reservation.materialId },
    select: {
      id: true,
      title: true,
      status: true,
      unit: true,
      quantity: true,
    },
  });

  const requester = await prisma.user.findUniqueOrThrow({
    where: { id: reservation.requesterId },
    select: {
      id: true,
      displayName: true,
    },
  });

  const owner = await prisma.user.findUniqueOrThrow({
    where: { id: reservation.ownerId },
    select: {
      id: true,
      displayName: true,
    },
  });

  return {
    ...reservation,
    material,
    requester,
    owner,
  };
};

const loadLearnerCancelledReservationRecord = async (
  reservationId: string,
): Promise<LearnerCancelledReservationRecord> => {
  return prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: learnerCancelInclude,
  });
};

export const findLearnerReservations = async (requesterId: string) => {
  return prisma.reservation.findMany({
    where: { requesterId },
    select: learnerReservationListSelect,
    orderBy: { createdAt: 'desc' },
  });
};

export const findLearnerReservationById = async (
  requesterId: string,
  reservationId: string,
) => {
  return prisma.reservation.findFirst({
    where: {
      id: reservationId,
      requesterId,
    },
    select: learnerReservationListSelect,
  });
};

export const findActiveLearnerReservationForMaterial = async (
  requesterId: string,
  materialId: string,
) => {
  return prisma.reservation.findFirst({
    where: {
      requesterId,
      materialId,
      status: { in: [...ACTIVE_HOLD_STATUSES] },
    },
    select: learnerReservationListSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
};

export const createLearnerReservation = async (input: {
  requesterId: string;
  materialId: string;
  quantityRequested: number;
  message?: string;
  fulfillmentMethod: 'PICKUP' | 'DELIVERY';
  paymentMethod: 'CARD' | 'CASH';
  learnerPreferredPickupWindows?: { start: string; end: string }[];
  learnerPreferredDeliveryWindows?: { start: string; end: string }[];
  deliveryAddressText?: string;
  dropoffCity?: string;
  dropoffArea?: string;
  safeDropoffAllowed?: boolean;
  deliveryNote?: string;
  buildItemId?: string;
  combineWithDeliveryGroupId?: string;
}) => {
  const result = await runSerializableTransaction(async (tx) => {
    const materialRecord = await tx.material.findUnique({
      where: { id: input.materialId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        pickupAllowed: true,
        deliveryAllowed: true,
        isFree: true,
        price: true,
        currency: true,
        supplierProfileId: true,
        locationId: true,
        unit: true,
      },
    });

    if (!materialRecord) {
      return { outcome: 'NOT_FOUND' as const };
    }

    const materialLocation = await tx.location.findUnique({
      where: { id: materialRecord.locationId },
      select: {
        city: true,
      },
    });

    if (!materialLocation) {
      return { outcome: 'NOT_FOUND' as const };
    }

    const material = {
      ...materialRecord,
      location: materialLocation,
    };

    if (material.ownerId === input.requesterId) {
      return { outcome: 'SELF_RESERVATION' as const };
    }

    if (material.status === 'UNAVAILABLE' || material.status === 'REUSED') {
      return { outcome: 'UNAVAILABLE' as const };
    }

    if (input.fulfillmentMethod === 'PICKUP' && !material.pickupAllowed) {
      return { outcome: 'PICKUP_NOT_ALLOWED' as const };
    }

    if (input.fulfillmentMethod === 'DELIVERY' && !material.deliveryAllowed) {
      return { outcome: 'DELIVERY_NOT_ALLOWED' as const };
    }

    const quantityState = await getMaterialQuantityState(tx, material.id);

    if (!quantityState) {
      return { outcome: 'NOT_FOUND' as const };
    }

    const requestedQuantity = toDecimal(input.quantityRequested);

    if (!isPositiveDecimal(requestedQuantity)) {
      return {
        outcome: 'INVALID_QUANTITY' as const,
        availableQuantity: decimalToNumber(quantityState.availableQuantity),
      };
    }

    if (requestedQuantity.gt(quantityState.availableQuantity)) {
      return {
        outcome: 'INVALID_QUANTITY' as const,
        availableQuantity: decimalToNumber(quantityState.availableQuantity),
      };
    }

    const expiredPendingReservationIds = await expireStalePendingReservationsForLearnerMaterial(
      tx,
      {
        requesterId: input.requesterId,
        materialId: material.id,
      },
    );

    const missedPickupExpiry =
      await expireStaleMissedPickupsForMaterialIdsInTransaction(
        tx,
        [material.id],
        input.requesterId,
      );
    const expiredMissedPickupReservationIds = missedPickupExpiry.expiredIds;

    const availabilityChanged =
      expiredPendingReservationIds.length > 0 ||
      expiredMissedPickupReservationIds.length > 0;
    const withAvailabilityChange = <T extends object>(result: T) => ({
      ...result,
      availabilityChanged,
      postCommitRefunds: missedPickupExpiry.postCommitRefunds,
      postCommitResolutions: missedPickupExpiry.postCommitResolutions,
    });

    const openLearnerReservationCount = await tx.reservation.count({
      where: {
        materialId: material.id,
        requesterId: input.requesterId,
        status: { in: [...ACTIVE_HOLD_STATUSES] },
      },
    });

    if (openLearnerReservationCount > 0) {
      return withAvailabilityChange({
        outcome: 'OPEN_RESERVATION_EXISTS' as const,
      });
    }

    let linkedBuildItemId: string | null = null;

    if (input.buildItemId) {
      const buildItemValidation = await validateBuildItemForReservationLink(tx, {
        learnerId: input.requesterId,
        buildItemId: input.buildItemId,
        materialId: material.id,
        quantityRequested: requestedQuantity,
        materialUnit: material.unit,
      });

      if (!buildItemValidation.ok) {
        return withAvailabilityChange({
          outcome: buildItemValidation.code,
        });
      }

      linkedBuildItemId = buildItemValidation.buildItemId;
    }

    const pricingInput: ReservationQuoteInput = {
      learnerId: input.requesterId,
      materialId: material.id,
      quantity: input.quantityRequested,
      fulfillmentMethod: input.fulfillmentMethod,
      paymentMethod: input.paymentMethod,
      dropoffCity: input.dropoffCity,
      dropoffArea: input.dropoffArea,
      learnerPreferredDeliveryWindows: input.learnerPreferredDeliveryWindows,
      combineWithDeliveryGroupId: input.combineWithDeliveryGroupId,
    };

    const pricingResult = await resolveReservationPricingForCreate(
      tx,
      {
        id: material.id,
        isFree: material.isFree,
        price: material.price,
        currency: material.currency,
        pickupCity: material.location.city,
        supplierProfileId: material.supplierProfileId,
        deliveryAllowed: material.deliveryAllowed,
        pickupAllowed: material.pickupAllowed,
        status: material.status,
      },
      decimalToNumber(quantityState.availableQuantity),
      pricingInput,
    );

    if (!pricingResult.ok) {
      return withAvailabilityChange({
        outcome: pricingResult.code as
          | 'INVALID_QUANTITY'
          | 'VALIDATION_ERROR'
          | 'DELIVERY_PRICING_ERROR'
          | 'GROUP_NOT_AVAILABLE',
        message: pricingResult.message,
        availableQuantity:
          pricingResult.code === 'INVALID_QUANTITY'
            ? decimalToNumber(quantityState.availableQuantity)
            : undefined,
      });
    }

    const { snapshot, groupAction } = pricingResult;

    let deliveryGroupId = snapshot.deliveryGroupId;

    if (groupAction.type === 'CREATE') {
      const supplierProfileId = material.supplierProfileId;
      if (!supplierProfileId) {
        return withAvailabilityChange({
          outcome: 'DELIVERY_PRICING_ERROR' as const,
          message: 'Delivery fee could not be calculated for this location.',
        });
      }

      const createdGroup = await tx.deliveryGroup.create({
        data: {
          learnerId: input.requesterId,
          supplierProfileId,
          dropoffCity: snapshot.dropoffCity!,
          dropoffArea: snapshot.dropoffArea,
          deliveryAddressText: input.deliveryAddressText?.trim() ?? null,
          deliveryFee: groupAction.deliveryFee,
          currency: snapshot.pricingCurrency,
          paymentMethod: input.paymentMethod,
          deliveryZone: groupAction.zone as 'SAME_CITY' | 'WEST_BANK' | 'JERUSALEM' | 'INSIDE_48',
          status: 'OPEN',
          windowStart: groupAction.window.start,
          windowEnd: groupAction.window.end,
        },
      });

      deliveryGroupId = createdGroup.id;
      snapshot.deliveryGroupId = createdGroup.id;
    } else if (groupAction.type === 'JOIN') {
      await tx.deliveryGroup.update({
        where: { id: groupAction.groupId },
        data: {
          windowStart: groupAction.sharedWindow.start,
          windowEnd: groupAction.sharedWindow.end,
        },
      });
    }

    const message = input.message?.trim() || null;
    const deliveryNote = input.deliveryNote?.trim() || null;

    const createdReservation = await tx.reservation.create({
      data: {
        materialId: material.id,
        requesterId: input.requesterId,
        ownerId: material.ownerId,
        quantityRequested: requestedQuantity,
        message,
        fulfillmentMethod: input.fulfillmentMethod,
        paymentMethod: input.paymentMethod,
        learnerPreferredPickupWindows:
          input.fulfillmentMethod === 'PICKUP'
            ? (input.learnerPreferredPickupWindows ?? Prisma.JsonNull)
            : Prisma.JsonNull,
        learnerPreferredDeliveryWindows:
          input.fulfillmentMethod === 'DELIVERY'
            ? (input.learnerPreferredDeliveryWindows ?? Prisma.JsonNull)
            : Prisma.JsonNull,
        deliveryAddressText:
          input.fulfillmentMethod === 'DELIVERY'
            ? input.deliveryAddressText?.trim() ?? null
            : null,
        safeDropoffAllowed:
          input.fulfillmentMethod === 'DELIVERY'
            ? input.safeDropoffAllowed ?? null
            : null,
        deliveryNote:
          input.fulfillmentMethod === 'DELIVERY' ? deliveryNote : null,
        unitPriceAtReservation: snapshot.unitPriceAtReservation,
        materialSubtotal: snapshot.materialSubtotal,
        deliveryFee: snapshot.deliveryFee,
        totalAmount: snapshot.totalAmount,
        pricingCurrency: snapshot.pricingCurrency,
        deliveryZone: snapshot.deliveryZone as
          | 'SAME_CITY'
          | 'WEST_BANK'
          | 'JERUSALEM'
          | 'INSIDE_48'
          | null,
        dropoffCity: snapshot.dropoffCity,
        dropoffArea: snapshot.dropoffArea,
        deliveryGroupId,
        status: 'PENDING',
      },
      select: { id: true },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: createdReservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: null,
        newStatus: 'PENDING',
        changedBy: input.requesterId,
        note: formatReservationHistoryNote('REQUESTED_BY_LEARNER'),
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, material.id);

    if (linkedBuildItemId) {
      await setBuildItemLinkedReservationId(
        tx,
        linkedBuildItemId,
        createdReservation.id,
      );
    }

    return withAvailabilityChange({
      outcome: 'CREATED' as const,
      reservationId: createdReservation.id,
    });
  });

  if (
    'postCommitRefunds' in result &&
    Array.isArray(result.postCommitRefunds)
  ) {
    const resolutions =
      'postCommitResolutions' in result &&
      Array.isArray(result.postCommitResolutions)
        ? (result.postCommitResolutions as import('../payments/payments.lifecycle.js').PostCommitResolutionTask[])
        : 'postCommitResolution' in result
          ? (result.postCommitResolution as
              | import('../payments/payments.lifecycle.js').PostCommitResolutionTask
              | null
              | undefined)
          : null;
    await flushPostCommitPaymentRefunds(result.postCommitRefunds, resolutions);
  }

  if (result.outcome !== 'CREATED') {
    return result;
  }

  const reservation = await loadLearnerReservationRecord(result.reservationId);

  return {
    ...result,
    reservation,
  };
};

export const cancelLearnerReservation = async (input: {
  requesterId: string;
  reservationId: string;
}) => {
  const result = await runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        requesterId: input.requesterId,
      },
    });

    if (!existing) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (
      existing.status !== 'PENDING' &&
      existing.status !== 'AWAITING_LEARNER_CONFIRMATION'
    ) {
      return { outcome: 'INVALID_STATUS' as const, status: existing.status };
    }

    const deliveryCount = await tx.delivery.count({
      where: { reservationId: existing.id },
    });

    if (deliveryCount > 0) {
      return { outcome: 'DELIVERY_EXISTS' as const };
    }

    const now = new Date();

    await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
      },
      select: { id: true },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: existing.id,
        statusGroup: 'RESERVATION',
        oldStatus: existing.status,
        newStatus: 'CANCELLED',
        changedBy: input.requesterId,
        note: formatReservationHistoryNote('CANCELLED_BY_LEARNER'),
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    await applyBuildReservationSyncInTransaction(tx, existing.id);

    const payment = await handleReservationPaymentLifecycleTransition(tx, {
      reservationId: existing.id,
      newStatus: 'CANCELLED',
      actorUserId: input.requesterId,
      reason: 'Cancelled by learner',
    });

    return {
      outcome: 'CANCELLED' as const,
      reservationId: existing.id,
      postCommitRefunds: payment.postCommitRefunds,
      postCommitResolution: payment.postCommitResolution ?? null,
    };
  });

  if (result.outcome !== 'CANCELLED') {
    return result;
  }

  await flushPostCommitPaymentRefunds(
    result.postCommitRefunds,
    result.postCommitResolution,
  );

  const reservation = await loadLearnerCancelledReservationRecord(
    result.reservationId,
  );

  return {
    outcome: 'CANCELLED' as const,
    reservation,
  };
};

export const findMaterialForReservationQuote = async (materialId: string) => {
  return prisma.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      pickupAllowed: true,
      deliveryAllowed: true,
      isFree: true,
      price: true,
      currency: true,
      supplierProfileId: true,
      location: {
        select: {
          city: true,
        },
      },
    },
  });
};
