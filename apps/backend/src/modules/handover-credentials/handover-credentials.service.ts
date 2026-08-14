import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  evaluateHandoverWindow,
  pickupWindowNotStartedMessage,
  pickupWindowPassedMessage,
} from '../../utils/handover-timing.js';
import {
  assertPickupPaymentSatisfiedOrThrow,
  evaluatePickupPaymentReadiness,
} from '../payments/payments.readiness.js';
import { resolvePickupHandoverPayment } from '../payments/payments.handover.js';
import { isElectronicPaymentEnforced } from '../payments/payments.policy.js';
import { expireStaleMissedPickupsByIds } from '../reservations/reservations.missed-pickup-expiry.repository.js';
import { supplierCanCompleteReservation } from '../supplier-reservations/supplier-reservations.repository.js';

import {
  createHandoverCredentialToken,
  formatHandoverQrPayload,
  hashHandoverCredentialToken,
  normalizeHandoverCredentialToken,
  resolveHandoverCredentialExpiry,
} from './handover-credentials.token.js';

export const invalidHandoverCredentialError = () =>
  new AppError(
    'Handover credential is invalid or no longer usable.',
    400,
    'HANDOVER_CREDENTIAL_INVALID',
  );

const verificationSelect = {
  id: true,
  ownerId: true,
  requesterId: true,
  status: true,
  fulfillmentMethod: true,
  quantityRequested: true,
  pickupWindowStart: true,
  pickupWindowEnd: true,
  handoverTokenHash: true,
  handoverTokenExpiresAt: true,
  handoverTokenUsedAt: true,
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
  _count: {
    select: {
      deliveries: true,
    },
  },
} as const;

export const assertSelfPickupHandoverEligibleOrThrow = async (input: {
  reservation: {
    id: string;
    status: string;
    fulfillmentMethod: string;
    pickupWindowStart: Date | null;
    pickupWindowEnd: Date | null;
    _count: { deliveries: number };
  };
  requireHandoverWindow: boolean;
  txClient?: Parameters<typeof assertPickupPaymentSatisfiedOrThrow>[1];
}) => {
  if (
    !supplierCanCompleteReservation({
      status: input.reservation.status as 'ACCEPTED',
      fulfillmentMethod: input.reservation.fulfillmentMethod as 'PICKUP',
      hasDelivery: input.reservation._count.deliveries > 0,
    })
  ) {
    throw new AppError(
      'Reservation is not eligible for self-pickup handover.',
      409,
      'CONFLICT',
    );
  }

  if (input.requireHandoverWindow) {
    const timing = evaluateHandoverWindow(
      new Date(),
      input.reservation.pickupWindowStart,
      input.reservation.pickupWindowEnd,
    );
    if (!timing.ok) {
      if (timing.reason === 'NOT_STARTED') {
        throw new AppError(
          pickupWindowNotStartedMessage(),
          400,
          'VALIDATION_ERROR',
        );
      }
      throw new AppError(pickupWindowPassedMessage(), 400, 'VALIDATION_ERROR');
    }
  }

  await assertPickupPaymentSatisfiedOrThrow(
    input.reservation.id,
    input.txClient,
  );
};

export const issueHandoverCredential = async (
  learnerId: string,
  reservationId: string,
) => {
  await expireStaleMissedPickupsByIds([reservationId]);

  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      requesterId: learnerId,
    },
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
      handoverTokenUsedAt: true,
      _count: { select: { deliveries: true } },
    },
  });

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (reservation.status === 'COMPLETED' || reservation.handoverTokenUsedAt) {
    throw new AppError(
      'Reservation handover has already been completed.',
      409,
      'CONFLICT',
    );
  }

  await assertSelfPickupHandoverEligibleOrThrow({
    reservation,
    requireHandoverWindow: true,
  });

  if (isElectronicPaymentEnforced()) {
    const readiness = await evaluatePickupPaymentReadiness(reservation.id);
    if (!readiness.fulfillmentReady) {
      throw new AppError(
        'Payment is required before a handover credential can be issued.',
        409,
        'PAYMENT_REQUIRED',
        { reservationId: reservation.id, paymentStatus: readiness.status },
      );
    }
  }

  const now = new Date();
  const rawToken = createHandoverCredentialToken();
  const tokenHash = hashHandoverCredentialToken(rawToken);
  const expiresAt = resolveHandoverCredentialExpiry(
    reservation.pickupWindowEnd,
    now,
  );

  if (expiresAt.getTime() <= now.getTime()) {
    throw new AppError(pickupWindowPassedMessage(), 400, 'VALIDATION_ERROR');
  }

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      handoverTokenHash: tokenHash,
      handoverTokenIssuedAt: now,
      handoverTokenExpiresAt: expiresAt,
      handoverTokenUsedAt: null,
    },
  });

  return {
    reservationId: reservation.id,
    handoverToken: rawToken,
    qrPayload: formatHandoverQrPayload(rawToken),
    expiresAt: expiresAt.toISOString(),
  };
};

export const verifyHandoverCredential = async (
  ownerId: string,
  handoverToken: string,
) => {
  const opaque = normalizeHandoverCredentialToken(handoverToken);
  if (!opaque) {
    throw invalidHandoverCredentialError();
  }

  const tokenHash = hashHandoverCredentialToken(opaque);
  const reservation = await prisma.reservation.findFirst({
    where: { handoverTokenHash: tokenHash },
    select: verificationSelect,
  });

  if (!reservation || reservation.ownerId !== ownerId) {
    throw invalidHandoverCredentialError();
  }

  if (reservation.handoverTokenUsedAt) {
    throw invalidHandoverCredentialError();
  }

  const now = new Date();
  if (
    reservation.handoverTokenExpiresAt &&
    reservation.handoverTokenExpiresAt.getTime() <= now.getTime()
  ) {
    throw invalidHandoverCredentialError();
  }

  await expireStaleMissedPickupsByIds([reservation.id], ownerId);

  const fresh = await prisma.reservation.findFirst({
    where: { id: reservation.id, ownerId },
    select: verificationSelect,
  });

  if (!fresh) {
    throw invalidHandoverCredentialError();
  }

  try {
    await assertSelfPickupHandoverEligibleOrThrow({
      reservation: fresh,
      requireHandoverWindow: true,
    });
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === 'PAYMENT_REQUIRED' ||
        error.code === 'REFUND_IN_PROGRESS' ||
        error.code === 'PAYMENT_ORDER_CANCELLED' ||
        error.code === 'PAYMENT_ORDER_MISSING')
    ) {
      throw error;
    }
    if (error instanceof AppError && error.code === 'CONFLICT') {
      throw invalidHandoverCredentialError();
    }
    throw error;
  }

  const payment = await resolvePickupHandoverPayment(fresh.id, ownerId);
  return {
    reservationId: fresh.id,
    material: {
      id: fresh.material.id,
      title: fresh.material.title,
    },
    quantity: Number(fresh.quantityRequested),
    unit: fresh.material.unit,
    learner: {
      displayName: fresh.requester.displayName,
    },
    expiresAt: fresh.handoverTokenExpiresAt?.toISOString() ?? null,
    payment: {
      paymentMethod: payment.paymentMethod,
      cashDueAtHandover: payment.cashDueAtHandover,
      totalAmount: payment.totalAmount,
      currency: payment.currency,
    },
  };
};

export const resolveHandoverTokenHashOrThrow = (
  handoverToken: string,
): string => {
  const opaque = normalizeHandoverCredentialToken(handoverToken);
  if (!opaque) {
    throw invalidHandoverCredentialError();
  }

  return hashHandoverCredentialToken(opaque);
};
