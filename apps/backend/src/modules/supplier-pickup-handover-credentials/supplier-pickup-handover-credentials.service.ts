import type { DeliveryStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  evaluateHandoverWindow,
  supplierPickupWindowNotStartedMessage,
  supplierPickupWindowPassedMessage,
} from '../../utils/handover-timing.js';
import { ACTIVE_DELIVERY_STATUSES } from '../deliveries/deliveries.service.js';
import { isTerminalDeliveryStatus } from '../deliveries/delivery-status.policy.js';
import { invalidHandoverCredentialError } from '../handover-credentials/handover-credentials.service.js';
import {
  createHandoverCredentialToken,
  formatSupplierPickupHandoverQrPayload,
  hashHandoverCredentialToken,
  normalizeSupplierPickupHandoverCredentialToken,
  resolveSupplierPickupHandoverCredentialExpiry,
} from '../handover-credentials/handover-credentials.token.js';
import { completePickupByHandoverToken } from '../driver/driver.service.js';

const PICKUP_COMPLETED_DELIVERY_STATUSES = [
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'DELIVERED',
] as const satisfies readonly DeliveryStatus[];

const deliveryVerificationSelect = {
  id: true,
  status: true,
  reservationId: true,
  deliveryGroupId: true,
  assignedDriverProfileId: true,
  supplierPickupHandoverTokenHash: true,
  supplierPickupHandoverTokenExpiresAt: true,
  supplierPickupHandoverTokenUsedAt: true,
  reservation: {
    select: {
      id: true,
      ownerId: true,
      status: true,
      fulfillmentMethod: true,
      quantityRequested: true,
      supplierPickupWindowStart: true,
      supplierPickupWindowEnd: true,
      material: {
        select: {
          id: true,
          title: true,
          unit: true,
        },
      },
      owner: {
        select: {
          displayName: true,
          supplierProfile: {
            select: {
              publicName: true,
              organizationProfile: {
                select: { organizationName: true },
              },
            },
          },
        },
      },
    },
  },
  pickupLocation: {
    select: {
      city: true,
      area: true,
    },
  },
} as const;

const resolveSupplierDisplayName = (
  owner: {
    displayName: string;
    supplierProfile: {
      publicName: string | null;
      organizationProfile: { organizationName: string } | null;
    } | null;
  },
) =>
  owner.supplierProfile?.organizationProfile?.organizationName ??
  owner.supplierProfile?.publicName ??
  owner.displayName;

const assertSupplierPickupHandoverEligibleOrThrow = (input: {
  reservation: {
    status: string;
    fulfillmentMethod: string;
  };
  delivery: {
    status: DeliveryStatus;
    assignedDriverProfileId: string | null;
    supplierPickupHandoverTokenUsedAt: Date | null;
    reservation: {
      supplierPickupWindowStart: Date | null;
      supplierPickupWindowEnd: Date | null;
    };
  };
  ownerId?: string;
  assignedDriverProfileId?: string;
  requireHandoverWindow: boolean;
  requireArrivedPickup: boolean;
}) => {
  if (
    input.reservation.status !== 'ACCEPTED' ||
    input.reservation.fulfillmentMethod !== 'DELIVERY'
  ) {
    throw invalidHandoverCredentialError();
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

  if (input.delivery.supplierPickupHandoverTokenUsedAt) {
    throw invalidHandoverCredentialError();
  }

  if (input.requireArrivedPickup && input.delivery.status !== 'ARRIVED_PICKUP') {
    throw invalidHandoverCredentialError();
  }

  if (input.requireHandoverWindow) {
    const timing = evaluateHandoverWindow(
      new Date(),
      input.delivery.reservation.supplierPickupWindowStart,
      input.delivery.reservation.supplierPickupWindowEnd,
    );
    if (!timing.ok) {
      if (timing.reason === 'NOT_STARTED') {
        throw new AppError(
          supplierPickupWindowNotStartedMessage(),
          400,
          'VALIDATION_ERROR',
        );
      }
      throw new AppError(
        supplierPickupWindowPassedMessage(),
        400,
        'VALIDATION_ERROR',
      );
    }
  }
};

const mapSupplierPickupHandoverPreview = (
  delivery: NonNullable<
    Awaited<
      ReturnType<
        typeof prisma.delivery.findFirst<{ select: typeof deliveryVerificationSelect }>
      >
    >
  >,
) => ({
  deliveryId: delivery.id,
  reservationId: delivery.reservationId,
  supplier: {
    displayName: resolveSupplierDisplayName(delivery.reservation.owner),
  },
  pickupLocation: {
    city: delivery.pickupLocation.city,
    area: delivery.pickupLocation.area,
  },
  items: [
    {
      reservationId: delivery.reservation.id,
      material: {
        id: delivery.reservation.material.id,
        title: delivery.reservation.material.title,
      },
      quantity: Number(delivery.reservation.quantityRequested),
      unit: delivery.reservation.material.unit,
    },
  ],
  expiresAt:
    delivery.supplierPickupHandoverTokenExpiresAt?.toISOString() ?? null,
});

export const issueSupplierPickupHandoverCredential = async (
  ownerId: string,
  reservationId: string,
) => {
  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      ownerId,
    },
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      supplierPickupWindowEnd: true,
    },
  });

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  const delivery = await prisma.delivery.findFirst({
    where: {
      reservationId: reservation.id,
      status: { in: [...ACTIVE_DELIVERY_STATUSES] },
    },
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
      supplierPickupHandoverTokenUsedAt: true,
      reservation: {
        select: {
          supplierPickupWindowStart: true,
          supplierPickupWindowEnd: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!delivery) {
    throw invalidHandoverCredentialError();
  }

  if (
    (PICKUP_COMPLETED_DELIVERY_STATUSES as readonly DeliveryStatus[]).includes(
      delivery.status,
    ) ||
    delivery.supplierPickupHandoverTokenUsedAt
  ) {
    throw new AppError(
      'Supplier pickup handover has already been completed.',
      409,
      'CONFLICT',
    );
  }

  assertSupplierPickupHandoverEligibleOrThrow({
    reservation,
    delivery,
    requireHandoverWindow: false,
    requireArrivedPickup: false,
  });

  const now = new Date();
  const rawToken = createHandoverCredentialToken();
  const tokenHash = hashHandoverCredentialToken(rawToken);
  const expiresAt = resolveSupplierPickupHandoverCredentialExpiry(
    reservation.supplierPickupWindowEnd,
    now,
  );

  if (expiresAt.getTime() <= now.getTime()) {
    throw new AppError(
      supplierPickupWindowPassedMessage(),
      400,
      'VALIDATION_ERROR',
    );
  }

  await prisma.delivery.update({
    where: { id: delivery.id },
    data: {
      supplierPickupHandoverTokenHash: tokenHash,
      supplierPickupHandoverTokenIssuedAt: now,
      supplierPickupHandoverTokenExpiresAt: expiresAt,
      supplierPickupHandoverTokenUsedAt: null,
    },
  });

  return {
    reservationId: reservation.id,
    deliveryId: delivery.id,
    handoverToken: rawToken,
    qrPayload: formatSupplierPickupHandoverQrPayload(rawToken),
    expiresAt: expiresAt.toISOString(),
  };
};

export const verifySupplierPickupHandoverCredential = async (
  driverUserId: string,
  handoverToken: string,
) => {
  const opaque = normalizeSupplierPickupHandoverCredentialToken(handoverToken);
  if (!opaque) {
    throw invalidHandoverCredentialError();
  }

  const tokenHash = hashHandoverCredentialToken(opaque);
  const delivery = await prisma.delivery.findFirst({
    where: { supplierPickupHandoverTokenHash: tokenHash },
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

  if (delivery.supplierPickupHandoverTokenUsedAt) {
    throw invalidHandoverCredentialError();
  }

  const now = new Date();
  if (
    delivery.supplierPickupHandoverTokenExpiresAt &&
    delivery.supplierPickupHandoverTokenExpiresAt.getTime() <= now.getTime()
  ) {
    throw invalidHandoverCredentialError();
  }

  assertSupplierPickupHandoverEligibleOrThrow({
    reservation: delivery.reservation,
    delivery,
    assignedDriverProfileId: profile.id,
    requireHandoverWindow: true,
    requireArrivedPickup: true,
  });

  return mapSupplierPickupHandoverPreview(delivery);
};

export const resolveSupplierPickupHandoverTokenHashOrThrow = (
  handoverToken: string,
): string => {
  const opaque = normalizeSupplierPickupHandoverCredentialToken(handoverToken);
  if (!opaque) {
    throw invalidHandoverCredentialError();
  }

  return hashHandoverCredentialToken(opaque);
};

export const confirmSupplierPickupHandoverCredential = async (
  driverUserId: string,
  handoverToken: string,
) => {
  const tokenHash = resolveSupplierPickupHandoverTokenHashOrThrow(handoverToken);
  const result = await completePickupByHandoverToken(driverUserId, tokenHash);

  if ('invalidCredential' in result && result.invalidCredential) {
    throw invalidHandoverCredentialError();
  }

  if ('expiredCredential' in result && result.expiredCredential) {
    throw invalidHandoverCredentialError();
  }

  if ('windowNotStarted' in result && result.windowNotStarted) {
    throw new AppError(
      supplierPickupWindowNotStartedMessage(),
      400,
      'VALIDATION_ERROR',
    );
  }

  if ('windowExpired' in result && result.windowExpired) {
    throw new AppError(
      supplierPickupWindowPassedMessage(),
      400,
      'VALIDATION_ERROR',
    );
  }

  if ('conflict' in result && result.conflict) {
    if (result.delivery.status === 'PICKED_UP') {
      return result.delivery;
    }
    throw invalidHandoverCredentialError();
  }

  if ('delivery' in result) {
    return result.delivery;
  }

  throw invalidHandoverCredentialError();
};
