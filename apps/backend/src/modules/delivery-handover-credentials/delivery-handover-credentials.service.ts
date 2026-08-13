import type { DeliveryStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  deliveryWindowNotStartedMessage,
  deliveryWindowPassedMessage,
  evaluateHandoverWindow,
} from '../../utils/handover-timing.js';
import { ACTIVE_DELIVERY_STATUSES } from '../deliveries/deliveries.service.js';
import { isTerminalDeliveryStatus } from '../deliveries/delivery-status.policy.js';
import { assertDeliveryGroupPaymentReadyOrThrow } from '../payments/payments.readiness.js';
import { invalidHandoverCredentialError } from '../handover-credentials/handover-credentials.service.js';
import {
  createHandoverCredentialToken,
  formatDeliveryHandoverQrPayload,
  hashHandoverCredentialToken,
  normalizeDeliveryHandoverCredentialToken,
  resolveDeliveryHandoverCredentialExpiry,
} from '../handover-credentials/handover-credentials.token.js';
import { completeDeliveryByHandoverToken } from '../driver/driver.service.js';

const deliveryVerificationSelect = {
  id: true,
  status: true,
  requestedByUserId: true,
  assignedDriverProfileId: true,
  deliveryGroupId: true,
  learnerDeliveryHandoverTokenHash: true,
  learnerDeliveryHandoverTokenExpiresAt: true,
  learnerDeliveryHandoverTokenUsedAt: true,
  reservation: {
    select: {
      id: true,
      confirmedDeliveryWindowStart: true,
      confirmedDeliveryWindowEnd: true,
      quantityRequested: true,
      material: {
        select: {
          id: true,
          title: true,
          unit: true,
        },
      },
      requester: {
        select: {
          displayName: true,
        },
      },
    },
  },
  deliveryGroup: {
    select: {
      id: true,
      reservations: {
        select: {
          id: true,
          quantityRequested: true,
          material: {
            select: {
              id: true,
              title: true,
              unit: true,
            },
          },
        },
      },
    },
  },
  dropoffLocation: {
    select: {
      city: true,
      area: true,
    },
  },
} as const;

const assertDeliveryHandoverEligibleOrThrow = async (input: {
  delivery: {
    id: string;
    status: DeliveryStatus;
    requestedByUserId: string;
    assignedDriverProfileId: string | null;
    learnerDeliveryHandoverTokenUsedAt: Date | null;
    reservation: {
      confirmedDeliveryWindowStart: Date | null;
      confirmedDeliveryWindowEnd: Date | null;
    };
  };
  learnerId?: string;
  assignedDriverProfileId?: string;
  requireHandoverWindow: boolean;
  requireArrivedDropoff: boolean;
}) => {
  if (
    input.learnerId != null &&
    input.delivery.requestedByUserId !== input.learnerId
  ) {
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  }

  if (isTerminalDeliveryStatus(input.delivery.status)) {
    throw invalidHandoverCredentialError();
  }

  if (
    !(ACTIVE_DELIVERY_STATUSES as readonly DeliveryStatus[]).includes(
      input.delivery.status,
    )
  ) {
    throw invalidHandoverCredentialError();
  }

  if (!input.delivery.assignedDriverProfileId) {
    throw invalidHandoverCredentialError();
  }

  if (
    input.assignedDriverProfileId != null &&
    input.delivery.assignedDriverProfileId !== input.assignedDriverProfileId
  ) {
    throw invalidHandoverCredentialError();
  }

  if (input.delivery.learnerDeliveryHandoverTokenUsedAt) {
    throw invalidHandoverCredentialError();
  }

  if (input.requireArrivedDropoff && input.delivery.status !== 'ARRIVED_DROPOFF') {
    throw invalidHandoverCredentialError();
  }

  if (input.requireHandoverWindow) {
    const timing = evaluateHandoverWindow(
      new Date(),
      input.delivery.reservation.confirmedDeliveryWindowStart,
      input.delivery.reservation.confirmedDeliveryWindowEnd,
    );
    if (!timing.ok) {
      if (timing.reason === 'NOT_STARTED') {
        throw new AppError(
          deliveryWindowNotStartedMessage(),
          400,
          'VALIDATION_ERROR',
        );
      }
      throw new AppError(deliveryWindowPassedMessage(), 400, 'VALIDATION_ERROR');
    }
  }
};

const mapDeliveryHandoverPreview = (
  delivery: NonNullable<
    Awaited<
      ReturnType<
        typeof prisma.delivery.findFirst<{ select: typeof deliveryVerificationSelect }>
      >
    >
  >,
) => {
  const items =
    delivery.deliveryGroup?.reservations.length &&
    delivery.deliveryGroup.reservations.length > 0
      ? delivery.deliveryGroup.reservations.map((reservation) => ({
          reservationId: reservation.id,
          material: {
            id: reservation.material.id,
            title: reservation.material.title,
          },
          quantity: Number(reservation.quantityRequested),
          unit: reservation.material.unit,
        }))
      : [
          {
            reservationId: delivery.reservation.id,
            material: {
              id: delivery.reservation.material.id,
              title: delivery.reservation.material.title,
            },
            quantity: Number(delivery.reservation.quantityRequested),
            unit: delivery.reservation.material.unit,
          },
        ];

  return {
    deliveryId: delivery.id,
    deliveryGroupId: delivery.deliveryGroupId,
    learner: {
      displayName: delivery.reservation.requester.displayName,
    },
    destination: {
      city: delivery.dropoffLocation.city,
      area: delivery.dropoffLocation.area,
    },
    items,
    expiresAt:
      delivery.learnerDeliveryHandoverTokenExpiresAt?.toISOString() ?? null,
  };
};

export const issueDeliveryHandoverCredential = async (
  learnerId: string,
  deliveryId: string,
) => {
  const delivery = await prisma.delivery.findFirst({
    where: {
      id: deliveryId,
      requestedByUserId: learnerId,
    },
    select: {
      id: true,
      status: true,
      requestedByUserId: true,
      assignedDriverProfileId: true,
      learnerDeliveryHandoverTokenUsedAt: true,
      reservation: {
        select: {
          confirmedDeliveryWindowStart: true,
          confirmedDeliveryWindowEnd: true,
        },
      },
    },
  });

  if (!delivery) {
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  }

  if (delivery.status === 'DELIVERED' || delivery.learnerDeliveryHandoverTokenUsedAt) {
    throw new AppError(
      'Delivery handover has already been completed.',
      409,
      'CONFLICT',
    );
  }

  await assertDeliveryHandoverEligibleOrThrow({
    delivery,
    learnerId,
    requireHandoverWindow: false,
    requireArrivedDropoff: false,
  });

  const now = new Date();
  const rawToken = createHandoverCredentialToken();
  const tokenHash = hashHandoverCredentialToken(rawToken);
  const expiresAt = resolveDeliveryHandoverCredentialExpiry(
    delivery.reservation.confirmedDeliveryWindowEnd,
    now,
  );

  if (expiresAt.getTime() <= now.getTime()) {
    throw new AppError(deliveryWindowPassedMessage(), 400, 'VALIDATION_ERROR');
  }

  await prisma.delivery.update({
    where: { id: delivery.id },
    data: {
      learnerDeliveryHandoverTokenHash: tokenHash,
      learnerDeliveryHandoverTokenIssuedAt: now,
      learnerDeliveryHandoverTokenExpiresAt: expiresAt,
      learnerDeliveryHandoverTokenUsedAt: null,
    },
  });

  return {
    deliveryId: delivery.id,
    handoverToken: rawToken,
    qrPayload: formatDeliveryHandoverQrPayload(rawToken),
    expiresAt: expiresAt.toISOString(),
  };
};

export const verifyDeliveryHandoverCredential = async (
  driverUserId: string,
  handoverToken: string,
) => {
  const opaque = normalizeDeliveryHandoverCredentialToken(handoverToken);
  if (!opaque) {
    throw invalidHandoverCredentialError();
  }

  const tokenHash = hashHandoverCredentialToken(opaque);
  const delivery = await prisma.delivery.findFirst({
    where: { learnerDeliveryHandoverTokenHash: tokenHash },
    select: deliveryVerificationSelect,
  });

  if (!delivery) {
    throw invalidHandoverCredentialError();
  }

  const profile = await prisma.driverProfile.findFirst({
    where: {
      userId: driverUserId,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  if (!profile || delivery.assignedDriverProfileId !== profile.id) {
    throw invalidHandoverCredentialError();
  }

  if (delivery.learnerDeliveryHandoverTokenUsedAt) {
    throw invalidHandoverCredentialError();
  }

  const now = new Date();
  if (
    delivery.learnerDeliveryHandoverTokenExpiresAt &&
    delivery.learnerDeliveryHandoverTokenExpiresAt.getTime() <= now.getTime()
  ) {
    throw invalidHandoverCredentialError();
  }

  await assertDeliveryHandoverEligibleOrThrow({
    delivery,
    assignedDriverProfileId: profile.id,
    requireHandoverWindow: true,
    requireArrivedDropoff: true,
  });

  if (delivery.deliveryGroupId) {
    try {
      await assertDeliveryGroupPaymentReadyOrThrow(delivery.deliveryGroupId);
    } catch (error) {
      if (error instanceof AppError && error.code === 'DELIVERY_PAYMENT_NOT_READY') {
        throw invalidHandoverCredentialError();
      }
      throw error;
    }
  }

  return mapDeliveryHandoverPreview(delivery);
};

export const resolveDeliveryHandoverTokenHashOrThrow = (
  handoverToken: string,
): string => {
  const opaque = normalizeDeliveryHandoverCredentialToken(handoverToken);
  if (!opaque) {
    throw invalidHandoverCredentialError();
  }

  return hashHandoverCredentialToken(opaque);
};

export const confirmDeliveryHandoverCredential = async (
  driverUserId: string,
  handoverToken: string,
) => {
  const tokenHash = resolveDeliveryHandoverTokenHashOrThrow(handoverToken);
  const result = await completeDeliveryByHandoverToken(driverUserId, tokenHash);

  if ('invalidCredential' in result && result.invalidCredential) {
    throw invalidHandoverCredentialError();
  }

  if ('expiredCredential' in result && result.expiredCredential) {
    throw invalidHandoverCredentialError();
  }

  if ('windowNotStarted' in result && result.windowNotStarted) {
    throw new AppError(deliveryWindowNotStartedMessage(), 400, 'VALIDATION_ERROR');
  }

  if ('windowExpired' in result && result.windowExpired) {
    throw new AppError(deliveryWindowPassedMessage(), 400, 'VALIDATION_ERROR');
  }

  if ('paymentNotReady' in result && result.paymentNotReady) {
    throw invalidHandoverCredentialError();
  }

  if ('conflict' in result && result.conflict) {
    if (result.delivery.status === 'DELIVERED') {
      return result.delivery;
    }
    throw invalidHandoverCredentialError();
  }

  if ('delivery' in result) {
    return result.delivery;
  }

  throw invalidHandoverCredentialError();
};
