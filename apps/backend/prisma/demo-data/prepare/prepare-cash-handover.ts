import { prisma } from '../../../src/database/prisma.js';
import { env } from '../../../src/config/env.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import {
  createReservation,
  getMyReservationById,
} from '../../../src/modules/reservations/reservations.service.js';
import { acceptSupplierReservation } from '../../../src/modules/supplier-reservations/supplier-reservations.service.js';
import {
  acceptDelivery,
  listActiveDriverDeliveries,
} from '../../../src/modules/driver/driver.service.js';
import { resolveDeliveryHandoverPayment } from '../../../src/modules/payments/payments.handover.js';
import {
  countActiveDriverDeliveries,
  reconcileDriverAvailability,
} from '../../../src/modules/driver/driver-availability.js';
import {
  DERIVED_DELIVERY_WINDOW_DURATION_HOURS,
  MAX_ACTIVE_DRIVER_DELIVERIES,
} from '../../../src/modules/deliveries/delivery-configuration.js';
import { ACTIVE_HOLD_STATUSES } from '../../../src/modules/reservations/reservations.quantity.js';
import {
  formatNamedAccount,
  redact,
  resolveMajdDeliveryTrio,
} from './local-demo-accounts.js';
import {
  CASH_HANDOVER_DEMO_KEY,
  CASH_HANDOVER_PREFERRED_TITLES,
  hasDemoMarker,
} from './local-demo-keys.js';
import {
  selectIsolatedScenarioCandidate,
  type ScenarioCandidate,
} from './prepare-delivery-isolation.js';

const withMarker = (value: string | null | undefined, key: string) => {
  if (hasDemoMarker(value, key)) {
    return value ?? key;
  }
  const base = value?.trim() ?? '';
  return base ? `${base} [${key}]` : `Local CASH handover screenshot prep [${key}]`;
};

async function loadScenarioCandidates(input: {
  learnerId: string;
  supplierUserId: string;
}): Promise<ScenarioCandidate[]> {
  const rows = await prisma.reservation.findMany({
    where: {
      requesterId: input.learnerId,
      ownerId: input.supplierUserId,
      fulfillmentMethod: 'DELIVERY',
    },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      message: true,
      deliveryNote: true,
      material: { select: { title: true } },
      deliveries: {
        select: { id: true },
        orderBy: { requestedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return rows.map((row) => ({
    reservationId: row.id,
    deliveryId: row.deliveries[0]?.id ?? null,
    materialTitle: row.material.title,
    reservationStatus: row.status,
    paymentMethod: row.paymentMethod,
    message: row.message,
    deliveryNote: row.deliveryNote,
  }));
}

async function snapshotPaymentScenario(reservationId: string) {
  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: {
      material: { select: { title: true, isFree: true, price: true, currency: true } },
      materialPaymentOrders: { orderBy: { cycleNumber: 'desc' } },
      deliveryGroup: {
        select: {
          paymentMethod: true,
          deliveryFee: true,
          currency: true,
          status: true,
          deliveryFeePaymentOrders: { orderBy: { cycleNumber: 'desc' } },
        },
      },
      deliveries: {
        orderBy: { requestedAt: 'desc' },
        take: 1,
        include: {
          assignedDriverProfile: {
            select: { user: { select: { displayName: true } } },
          },
          pickupItems: { select: { wasPicked: true } },
          attempts: { select: { attemptNumber: true } },
        },
      },
    },
  });
  const delivery = reservation.deliveries[0] ?? null;
  const materialOrders = reservation.materialPaymentOrders.map((order) => ({
    purpose: order.purpose,
    method: order.paymentMethod,
    status: order.status,
    amount: order.amount.toString(),
    currency: order.currency,
    paidAt: order.paidAt?.toISOString() ?? null,
  }));
  const feeOrders =
    reservation.deliveryGroup?.deliveryFeePaymentOrders.map((order) => ({
      purpose: order.purpose,
      method: order.paymentMethod,
      status: order.status,
      amount: order.amount.toString(),
      currency: order.currency,
      paidAt: order.paidAt?.toISOString() ?? null,
    })) ?? [];

  return {
    reservationId: reservation.id,
    material: reservation.material.title,
    freeListing: reservation.material.isFree,
    catalogPrice: reservation.material.price?.toString() ?? null,
    quantity: reservation.quantityRequested.toString(),
    reservationStatus: reservation.status,
    reservationPaymentMethod: reservation.paymentMethod,
    groupPaymentMethod: reservation.deliveryGroup?.paymentMethod ?? null,
    groupStatus: reservation.deliveryGroup?.status ?? null,
    paymentOrders: [...materialOrders, ...feeOrders],
    deliveryStatus: delivery?.status ?? null,
    assignedDriver: delivery?.assignedDriverProfile?.user.displayName ?? null,
    pickupItemsPicked: delivery?.pickupItems.filter((item) => item.wasPicked).length ?? 0,
    attempts: delivery?.attempts.length ?? 0,
  };
}

async function stampCashMarker(reservationId: string) {
  const row = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    select: { message: true, deliveryNote: true },
  });
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      message: withMarker(row.message, CASH_HANDOVER_DEMO_KEY),
      deliveryNote: withMarker(row.deliveryNote, CASH_HANDOVER_DEMO_KEY),
    },
  });
}

async function assignDriverDirectly(input: {
  deliveryId: string;
  driverUserId: string;
  driverProfileId: string;
}) {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.delivery.update({
      where: { id: input.deliveryId },
      data: {
        status: 'DRIVER_ASSIGNED',
        assignedDriverProfileId: input.driverProfileId,
        assignedAt: now,
      },
    });
    await tx.deliveryAssignment.create({
      data: {
        deliveryId: input.deliveryId,
        driverProfileId: input.driverProfileId,
        assignedByUserId: input.driverUserId,
        status: 'ACTIVE',
        acceptedAt: now,
      },
    });
    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: input.deliveryId,
        oldStatus: 'WAITING_FOR_DRIVER',
        newStatus: 'DRIVER_ASSIGNED',
        changedByUserId: input.driverUserId,
        note: 'Local CASH demo prep: assigned Majd Driver',
      },
    });
    const delivery = await tx.delivery.findUniqueOrThrow({
      where: { id: input.deliveryId },
      select: { deliveryGroupId: true },
    });
    if (delivery.deliveryGroupId) {
      await tx.deliveryGroup.update({
        where: { id: delivery.deliveryGroupId },
        data: {
          status: 'ASSIGNED',
          assignedDriverProfileId: input.driverProfileId,
        },
      });
    }
    await reconcileDriverAvailability(tx, input.driverProfileId);
  });
}

async function prepareArrivedDropoff(input: {
  deliveryId: string;
  driverUserId: string;
  driverProfileId: string;
}) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60_000);
  const windowEnd = new Date(
    now.getTime() + DERIVED_DELIVERY_WINDOW_DURATION_HOURS * 60 * 60_000,
  );

  await prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.findUniqueOrThrow({
      where: { id: input.deliveryId },
      include: {
        reservation: {
          include: {
            material: {
              select: { id: true, title: true, unit: true, condition: true },
            },
          },
        },
        pickupItems: true,
        attempts: true,
      },
    });

    if (delivery.reservation.status === 'COMPLETED') {
      throw new Error('Refusing to mutate a COMPLETED reservation for CASH handover demo.');
    }
    if (delivery.attempts.length > 0) {
      throw new Error('Target already has delivery attempts.');
    }
    if (delivery.reservation.paymentMethod !== 'CASH') {
      throw new Error('Reservation is not CASH.');
    }

    await tx.reservation.update({
      where: { id: delivery.reservation.id },
      data: {
        status: 'ACCEPTED',
        paymentMethod: 'CASH',
        confirmedDeliveryWindowStart: windowStart,
        confirmedDeliveryWindowEnd: windowEnd,
        earliestDeliveryStart: null,
        schedulingConflictReason: null,
      },
    });

    if (delivery.deliveryGroupId) {
      await tx.deliveryGroup.update({
        where: { id: delivery.deliveryGroupId },
        data: {
          status: 'ASSIGNED',
          paymentMethod: 'CASH',
          assignedDriverProfileId: input.driverProfileId,
          windowStart,
          windowEnd,
        },
      });
    }

    const picked = delivery.pickupItems.find(
      (item) => item.reservationId === delivery.reservation.id && item.wasPicked,
    );
    if (!picked) {
      await tx.deliveryPickupItem.upsert({
        where: {
          deliveryId_reservationId: {
            deliveryId: delivery.id,
            reservationId: delivery.reservation.id,
          },
        },
        update: { wasPicked: true, recordedAt: now, unpickedReason: null },
        create: {
          deliveryId: delivery.id,
          reservationId: delivery.reservation.id,
          materialId: delivery.reservation.material.id,
          materialTitle: delivery.reservation.material.title,
          quantity: delivery.reservation.quantityRequested,
          unit: delivery.reservation.material.unit,
          condition: delivery.reservation.material.condition,
          wasPicked: true,
          recordedAt: now,
        },
      });
    }

    const previous = delivery.status;
    await tx.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'ARRIVED_DROPOFF',
        assignedDriverProfileId: input.driverProfileId,
        assignedAt: delivery.assignedAt ?? now,
        arrivedPickupAt: delivery.arrivedPickupAt ?? now,
        pickedUpAt: delivery.pickedUpAt ?? now,
        onTheWayAt: delivery.onTheWayAt ?? now,
        arrivedDropoffAt: now,
        deliveredAt: null,
        cancelledAt: null,
        failedAt: null,
        failureReason: null,
        returnRequiredAt: null,
        resolutionOutcome: null,
        scheduleOccurrence: Math.max(delivery.scheduleOccurrence, 1),
      },
    });

    if (previous !== 'ARRIVED_DROPOFF') {
      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: delivery.id,
          oldStatus: previous,
          newStatus: 'ARRIVED_DROPOFF',
          changedByUserId: input.driverUserId,
          note: 'Local CASH demo prep: ready for learner handover screenshot',
        },
      });
    }

    await reconcileDriverAvailability(tx, input.driverProfileId);
  });
}

export async function prepareCashHandoverDemo() {
  assertLocalDemoDatabaseUrl(env.databaseUrl, 'local CASH handover demo prep');

  const resolved = await resolveMajdDeliveryTrio();
  if (!resolved.ok) {
    console.log(`\nSTOPPED: ${resolved.reason}`);
    throw new Error(`CASH handover demo account resolution failed: ${resolved.reason}`);
  }

  const { driver, learner, supplierUser, driverProfile } = resolved.trio;
  console.log('=== ACCOUNT RESOLUTION ===');
  console.log('  ' + formatNamedAccount(driver));
  console.log('  ' + formatNamedAccount(learner));
  console.log('  ' + formatNamedAccount({ ...supplierUser, roles: ['SUPPLIER'] }));

  if (!learner.emailVerifiedAt) {
    throw new Error('Majd Learner is not email-verified; createReservation would fail.');
  }

  const candidates = await loadScenarioCandidates({
    learnerId: learner.id,
    supplierUserId: supplierUser.id,
  });
  const { selected } = selectIsolatedScenarioCandidate({
    kind: 'cash-handover',
    candidates,
  });

  let reservationId = selected?.reservationId ?? null;
  let deliveryId = selected?.deliveryId ?? null;
  let created = false;

  if (selected) {
    console.log(
      `\nReusing CASH scenario ${redact(selected.reservationId)} / ${selected.materialTitle}`,
    );
  } else {
    const blockingStatuses = [...ACTIVE_HOLD_STATUSES, 'AWAITING_RESOLUTION'] as const;
    const materials = await prisma.material.findMany({
      where: {
        ownerId: supplierUser.id,
        isFree: false,
        deliveryAllowed: true,
        price: { gt: 0 },
        title: { in: [...CASH_HANDOVER_PREFERRED_TITLES] },
      },
      select: {
        id: true,
        title: true,
        price: true,
        currency: true,
        status: true,
        reservations: {
          where: {
            requesterId: learner.id,
            status: { in: [...blockingStatuses] },
          },
          select: { id: true, status: true },
        },
      },
      orderBy: { title: 'asc' },
    });

    const usable = materials.filter((row) => row.reservations.length === 0);
    const material = CASH_HANDOVER_PREFERRED_TITLES.map((title) =>
      usable.find((row) => row.title === title),
    ).find((row) => row != null);
    if (!material) {
      throw new Error(
        'No isolated paid CASH-handover material is free of an open Majd Learner hold.',
      );
    }

    console.log(
      `\nCreating CASH reservation on ${material.title} | ${material.price?.toString() ?? '?'} ${material.currency ?? 'NIS'}`,
    );

    const createdReservation = await createReservation(learner.id, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      paymentMethod: 'CASH',
      deliveryAddressText: 'University District dropoff, near Hebron University main gate',
      dropoffCity: 'Hebron',
      dropoffArea: 'University District',
      safeDropoffAllowed: false,
      deliveryNote: withMarker(null, CASH_HANDOVER_DEMO_KEY),
      message: withMarker(
        'Local demo CASH handover screenshot reservation',
        CASH_HANDOVER_DEMO_KEY,
      ),
    });
    reservationId = createdReservation.id;
    created = true;
  }

  if (!reservationId) {
    throw new Error('CASH handover demo did not resolve a reservation.');
  }

  await stampCashMarker(reservationId);

  const current = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    select: {
      status: true,
      paymentMethod: true,
      deliveries: {
        select: { id: true, status: true },
        orderBy: { requestedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (current.status === 'COMPLETED') {
    throw new Error('Selected CASH scenario reservation is COMPLETED; refusing to mutate it.');
  }

  if (current.status === 'PENDING') {
    const pickupStart = new Date(Date.now() + 45 * 60_000);
    const pickupEnd = new Date(pickupStart.getTime() + 3 * 60 * 60_000);
    await acceptSupplierReservation(supplierUser.id, reservationId, {
      pickupWindowStart: pickupStart.toISOString(),
      pickupWindowEnd: pickupEnd.toISOString(),
      supplierNote: 'Local CASH handover screenshot prep',
    });
  }

  const afterAccept = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    select: {
      status: true,
      paymentMethod: true,
      deliveries: {
        select: { id: true, status: true },
        orderBy: { requestedAt: 'desc' },
        take: 1,
      },
    },
  });
  if (afterAccept.paymentMethod !== 'CASH') {
    throw new Error(`Reservation paymentMethod is ${afterAccept.paymentMethod}, expected CASH.`);
  }
  deliveryId = afterAccept.deliveries[0]?.id ?? deliveryId;
  if (!deliveryId) {
    throw new Error('Acceptance did not create an operational delivery (payment may have deferred it).');
  }

  const activeCount = await countActiveDriverDeliveries(prisma, driverProfile.id);
  if (activeCount >= MAX_ACTIVE_DRIVER_DELIVERIES) {
    const assigned = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: { assignedDriverProfileId: true },
    });
    if (assigned?.assignedDriverProfileId !== driverProfile.id) {
      throw new Error(
        `Majd Driver already has ${activeCount} active deliveries; cannot assign another.`,
      );
    }
  }

  try {
    if (!driverProfile.acceptingNewJobs) {
      await prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: { acceptingNewJobs: true },
      });
    }
    const delivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
      select: { assignedDriverProfileId: true, status: true },
    });
    if (delivery.assignedDriverProfileId !== driverProfile.id) {
      await acceptDelivery(driver.id, deliveryId);
    }
  } catch (error) {
    console.log(
      `acceptDelivery did not succeed (${error instanceof Error ? error.message : error}); assigning directly.`,
    );
    await assignDriverDirectly({
      deliveryId,
      driverUserId: driver.id,
      driverProfileId: driverProfile.id,
    });
  }

  await prepareArrivedDropoff({
    deliveryId,
    driverUserId: driver.id,
    driverProfileId: driverProfile.id,
  });

  const after = await snapshotPaymentScenario(reservationId);
  console.log('\n=== AFTER ===');
  console.log(JSON.stringify(after, null, 2));

  const [resolvedPayment, listed, learnerView] = await Promise.all([
    resolveDeliveryHandoverPayment(deliveryId, driver.id),
    listActiveDriverDeliveries(driver.id),
    getMyReservationById(learner.id, reservationId),
  ]);
  const listedDelivery = listed.deliveries.find((row) => row.id === deliveryId);

  if (resolvedPayment.paymentMethod !== 'CASH' || resolvedPayment.cashDueAtHandover !== true) {
    throw new Error(
      `Resolver did not return CASH due at handover: ${JSON.stringify(resolvedPayment)}`,
    );
  }
  if (after.paymentOrders.some((order) => order.status === 'PAID')) {
    throw new Error('PaymentOrder was marked PAID; refusing to consume the screenshot path.');
  }
  if (listedDelivery?.status !== 'ARRIVED_DROPOFF') {
    throw new Error(`Driver list status is ${listedDelivery?.status}, expected ARRIVED_DROPOFF.`);
  }

  console.log('\nREADY for screenshots. Do not complete handover yet.');
  console.log(`learnerPaymentSummary: ${JSON.stringify(learnerView.paymentSummary ?? null)}`);

  return {
    created,
    reservationId,
    deliveryId,
    materialTitle: after.material,
    deliveryStatus: after.deliveryStatus,
  };
}
