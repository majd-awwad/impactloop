import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { Prisma } from '../../generated/prisma/client.js';

export const PAY_TEST_MARKER = '[pay01-fixture]';

export type PayTestIds = {
  users: string[];
  locations: string[];
  categories: string[];
  materials: string[];
  reservations: string[];
  groups: string[];
  orders: string[];
};

export const createPayTestIds = (): PayTestIds => ({
  users: [],
  locations: [],
  categories: [],
  materials: [],
  reservations: [],
  groups: [],
  orders: [],
});

export async function cleanupPayTest(ids: PayTestIds) {
  if (ids.orders.length || ids.reservations.length || ids.groups.length) {
    const sessionWhere = {
      OR: [
        ...(ids.reservations.length
          ? [{ reservationId: { in: ids.reservations } }]
          : []),
        ...(ids.groups.length
          ? [{ deliveryGroupId: { in: ids.groups } }]
          : []),
        ...(ids.orders.length
          ? [{ items: { some: { paymentOrderId: { in: ids.orders } } } }]
          : []),
      ],
    };

    if (sessionWhere.OR.length > 0) {
      const sessions = await prisma.paymentCheckoutSession.findMany({
        where: sessionWhere,
        select: { id: true },
      });
      const sessionIds = sessions.map((row) => row.id);
      if (sessionIds.length) {
        await prisma.paymentProviderEvent.deleteMany({
          where: {
            paymentAttempt: { checkoutSessionId: { in: sessionIds } },
          },
        });
        await prisma.paymentRefund.deleteMany({
          where: {
            paymentAttempt: { checkoutSessionId: { in: sessionIds } },
          },
        });
        await prisma.paymentAttempt.deleteMany({
          where: { checkoutSessionId: { in: sessionIds } },
        });
        await prisma.paymentCheckoutSessionItem.deleteMany({
          where: { checkoutSessionId: { in: sessionIds } },
        });
        await prisma.paymentCheckoutSession.deleteMany({
          where: { id: { in: sessionIds } },
        });
      }
    }

    await prisma.idempotencyRecord.deleteMany({
      where: {
        userId: { in: ids.users },
        scope: {
          in: ['PAYMENT_CHECKOUT', 'PAYMENT_RESERVATION_CHECKOUT'],
        },
      },
    });
  }

  if (ids.orders.length) {
    await prisma.paymentProviderEvent.deleteMany({
      where: { paymentAttempt: { paymentOrderId: { in: ids.orders } } },
    });
    await prisma.paymentRefund.deleteMany({
      where: { paymentOrderId: { in: ids.orders } },
    });
    await prisma.paymentAttempt.deleteMany({
      where: { paymentOrderId: { in: ids.orders } },
    });
    await prisma.paymentOrder.deleteMany({
      where: { id: { in: ids.orders } },
    });
  }

  if (ids.reservations.length) {
    await prisma.paymentProviderEvent.deleteMany({
      where: {
        paymentAttempt: {
          paymentOrder: { reservationId: { in: ids.reservations } },
        },
      },
    });
    await prisma.paymentRefund.deleteMany({
      where: { paymentOrder: { reservationId: { in: ids.reservations } } },
    });
    await prisma.paymentAttempt.deleteMany({
      where: { paymentOrder: { reservationId: { in: ids.reservations } } },
    });
    await prisma.paymentOrder.deleteMany({
      where: { reservationId: { in: ids.reservations } },
    });
    await prisma.deliveryStatusHistory.deleteMany({
      where: { delivery: { reservationId: { in: ids.reservations } } },
    });
    await prisma.deliveryAssignment.deleteMany({
      where: { delivery: { reservationId: { in: ids.reservations } } },
    });
    await prisma.deliveryPickupItem.deleteMany({
      where: { reservationId: { in: ids.reservations } },
    });
    await prisma.delivery.deleteMany({
      where: { reservationId: { in: ids.reservations } },
    });
    await prisma.reservationStatusHistory.deleteMany({
      where: { reservationId: { in: ids.reservations } },
    });
    await prisma.reservation.deleteMany({
      where: { id: { in: ids.reservations } },
    });
  }

  if (ids.groups.length) {
    await prisma.paymentProviderEvent.deleteMany({
      where: {
        paymentAttempt: {
          paymentOrder: { deliveryGroupId: { in: ids.groups } },
        },
      },
    });
    await prisma.paymentRefund.deleteMany({
      where: { paymentOrder: { deliveryGroupId: { in: ids.groups } } },
    });
    await prisma.paymentAttempt.deleteMany({
      where: { paymentOrder: { deliveryGroupId: { in: ids.groups } } },
    });
    await prisma.paymentOrder.deleteMany({
      where: { deliveryGroupId: { in: ids.groups } },
    });
    await prisma.delivery.deleteMany({
      where: { deliveryGroupId: { in: ids.groups } },
    });
    await prisma.deliveryGroup.deleteMany({
      where: { id: { in: ids.groups } },
    });
  }

  if (ids.materials.length) {
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
  }

  if (ids.locations.length) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  }

  if (ids.categories.length) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }

  if (ids.users.length) {
    await prisma.authToken.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.learnerProfile.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.supplierProfile.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
}

export async function createPayUser(
  ids: PayTestIds,
  input: {
    role: 'LEARNER' | 'SUPPLIER' | 'ADMIN';
    emailSuffix: string;
  },
) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${PAY_TEST_MARKER} ${input.emailSuffix}`,
      email: `${PAY_TEST_MARKER}-${input.emailSuffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ role: input.role, isPrimary: true }],
      },
      ...(input.role === 'LEARNER'
        ? {
            learnerProfile: {
              create: {
                learnerType: 'STUDENT',
                skillLevel: 'BEGINNER',
              },
            },
          }
        : input.role === 'SUPPLIER'
          ? {
              supplierProfile: {
                create: {
                  supplierType: 'INDIVIDUAL_SUPPLIER',
                  publicName: `${PAY_TEST_MARKER} supplier`,
                  verificationStatus: 'VERIFIED',
                },
              },
            }
          : {}),
    },
    select: { id: true },
  });

  ids.users.push(user.id);
  return user;
}

export async function createPayReservationFixture(
  ids: PayTestIds,
  input: {
    learnerId: string;
    supplierId: string;
    materialSubtotal: number;
    pricingCurrency?: string;
    fulfillmentMethod?: 'PICKUP' | 'DELIVERY';
    deliveryFee?: number;
    deliveryGroupId?: string;
    deliveryAddressText?: string;
    dropoffCity?: string;
    deliveryZone?: 'SAME_CITY' | 'WEST_BANK' | 'JERUSALEM' | 'INSIDE_48' | 'UNKNOWN';
    confirmedDeliveryWindowStart?: Date;
    confirmedDeliveryWindowEnd?: Date;
    pickupWindowStart?: Date;
    pickupWindowEnd?: Date;
    paymentMethod?: 'CARD' | 'CASH';
  },
) {
  const category = await prisma.category.create({
    data: {
      nameEn: `${PAY_TEST_MARKER} category ${Date.now()}`,
      nameAr: `${PAY_TEST_MARKER} فئة`,
      categoryType: 'MATERIAL',
      isActive: true,
    },
    select: { id: true },
  });
  ids.categories.push(category.id);

  const location = await prisma.location.create({
    data: {
      country: 'Palestine',
      city: 'Nablus',
      area: PAY_TEST_MARKER,
      visibility: 'PUBLIC_APPROXIMATE',
      isApproximate: true,
    },
    select: { id: true },
  });
  ids.locations.push(location.id);

  const supplierProfile = await prisma.supplierProfile.findUniqueOrThrow({
    where: { userId: input.supplierId },
    select: { id: true },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: input.supplierId,
      supplierProfileId: supplierProfile.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${PAY_TEST_MARKER} material`,
      description: 'pay01',
      materialType: 'Test',
      quantity: 10,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: input.materialSubtotal === 0,
      price: input.materialSubtotal === 0 ? null : input.materialSubtotal,
    },
    select: { id: true },
  });
  ids.materials.push(material.id);

  const method = input.fulfillmentMethod ?? 'PICKUP';
  const deliveryFee = input.deliveryFee ?? 0;
  const windowStart =
    input.confirmedDeliveryWindowStart ??
    (method === 'DELIVERY' ? new Date(Date.now() + 24 * 3_600_000) : undefined);
  const windowEnd =
    input.confirmedDeliveryWindowEnd ??
    (windowStart
      ? new Date(windowStart.getTime() + 2 * 3_600_000)
      : undefined);

  const pickupStart =
    input.pickupWindowStart ??
    (method === 'PICKUP' ? new Date(Date.now() - 30 * 60_000) : undefined);
  const pickupEnd =
    input.pickupWindowEnd ??
    (pickupStart
      ? new Date(pickupStart.getTime() + 4 * 3_600_000)
      : undefined);

  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: input.learnerId,
      ownerId: input.supplierId,
      quantityRequested: new Prisma.Decimal(1),
      fulfillmentMethod: method,
      paymentMethod: input.paymentMethod ?? 'CARD',
      status: 'ACCEPTED',
      materialSubtotal: new Prisma.Decimal(input.materialSubtotal),
      deliveryFee: new Prisma.Decimal(deliveryFee),
      totalAmount: new Prisma.Decimal(input.materialSubtotal + deliveryFee),
      pricingCurrency: input.pricingCurrency ?? 'NIS',
      unitPriceAtReservation: new Prisma.Decimal(input.materialSubtotal),
      acceptedAt: new Date(),
      deliveryGroupId: input.deliveryGroupId,
      deliveryAddressText:
        input.deliveryAddressText ??
        (method === 'DELIVERY' ? 'Test street 1' : undefined),
      dropoffCity:
        input.dropoffCity ?? (method === 'DELIVERY' ? 'Ramallah' : undefined),
      deliveryZone:
        input.deliveryZone ?? (method === 'DELIVERY' ? 'SAME_CITY' : undefined),
      confirmedDeliveryWindowStart: windowStart,
      confirmedDeliveryWindowEnd: windowEnd,
      pickupWindowStart: pickupStart,
      pickupWindowEnd: pickupEnd,
    },
    select: { id: true, deliveryGroupId: true },
  });
  ids.reservations.push(reservation.id);
  return reservation;
}

export async function createPayDeliveryGroupFixture(
  ids: PayTestIds,
  input: {
    learnerId: string;
    supplierId: string;
    deliveryFee: number;
    currency?: string;
    paymentMethod?: 'CARD' | 'CASH';
  },
) {
  const supplierProfile = await prisma.supplierProfile.findUniqueOrThrow({
    where: { userId: input.supplierId },
    select: { id: true },
  });

  const windowStart = new Date(Date.now() + 24 * 3_600_000);
  const windowEnd = new Date(windowStart.getTime() + 2 * 3_600_000);

  const group = await prisma.deliveryGroup.create({
    data: {
      learnerId: input.learnerId,
      supplierProfileId: supplierProfile.id,
      dropoffCity: 'Ramallah',
      deliveryFee: new Prisma.Decimal(input.deliveryFee),
      currency: input.currency ?? 'NIS',
      paymentMethod: input.paymentMethod ?? 'CARD',
      deliveryZone: 'SAME_CITY',
      status: 'OPEN',
      windowStart,
      windowEnd,
    },
    select: { id: true },
  });
  ids.groups.push(group.id);
  return group;
}

export async function trackOrder(ids: PayTestIds, orderId: string) {
  if (!ids.orders.includes(orderId)) {
    ids.orders.push(orderId);
  }
}
