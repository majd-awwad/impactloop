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
import { resolveDeliveryHandoverPayment } from '../payments/payments.handover.js';
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

const deliveryWindowTimingError = (
  reason: 'NOT_STARTED' | 'EXPIRED' | 'MISSING_WINDOW',
) => {
  if (reason === 'EXPIRED') {
    return new AppError(
      deliveryWindowPassedMessage(),
      400,
      'HANDOVER_WINDOW_EXPIRED',
    );
  }

  return new AppError(
    deliveryWindowNotStartedMessage(),
    400,
    'HANDOVER_WINDOW_NOT_STARTED',
  );
};

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
  requireAssignedDriver?: boolean;
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

  if (
    (input.requireAssignedDriver ?? true) &&
    !input.delivery.assignedDriverProfileId
  ) {
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
      throw deliveryWindowTimingError(timing.reason);
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
  payment: Awaited<ReturnType<typeof resolveDeliveryHandoverPayment>>,
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
    payment: {
      paymentMethod: payment.paymentMethod,
      cashDueAtHandover: payment.cashDueAtHandover,
      totalAmount: payment.totalAmount,
      currency: payment.currency,
    },
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

  // A failed first attempt has no current handover appointment until the
  // assigned driver schedules the retry. Do not mint a credential against the
  // superseded window while coordination is still pending.
  if (delivery.status === 'REDELIVERY_PENDING') {
    throw new AppError(
      'A new delivery window is needed before a handover QR can be issued.',
      409,
      'CONFLICT',
    );
  }

  await assertDeliveryHandoverEligibleOrThrow({
    delivery,
    learnerId,
    requireHandoverWindow: false,
    requireArrivedDropoff: false,
    requireAssignedDriver: false,
  });

  const now = new Date();
  const rawToken = createHandoverCredentialToken();
  const tokenHash = hashHandoverCredentialToken(rawToken);
  const expiresAt = resolveDeliveryHandoverCredentialExpiry(
    delivery.reservation.confirmedDeliveryWindowEnd,
    now,
  );

  if (expiresAt.getTime() <= now.getTime()) {
    throw deliveryWindowTimingError('EXPIRED');
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

  const payment = await resolveDeliveryHandoverPayment(
    delivery.id,
    driverUserId,
  );
  return mapDeliveryHandoverPreview(delivery, payment);
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
  cashReceivedConfirmed?: boolean,
) => {
  const tokenHash = resolveDeliveryHandoverTokenHashOrThrow(handoverToken);
  let result: Awaited<ReturnType<typeof completeDeliveryByHandoverToken>>;
  try {
    result = await completeDeliveryByHandoverToken(
      driverUserId,
      tokenHash,
      cashReceivedConfirmed,
    );
  } catch (error) {
    if (error instanceof AppError && error.code === 'PAYMENT_REQUIRED') {
      throw invalidHandoverCredentialError();
    }
    throw error;
  }

  if ('invalidCredential' in result && result.invalidCredential) {
    throw invalidHandoverCredentialError();
  }

  if ('expiredCredential' in result && result.expiredCredential) {
    throw invalidHandoverCredentialError();
  }

  if ('windowNotStarted' in result && result.windowNotStarted) {
    throw deliveryWindowTimingError('NOT_STARTED');
  }

  if ('windowExpired' in result && result.windowExpired) {
    throw deliveryWindowTimingError('EXPIRED');
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
