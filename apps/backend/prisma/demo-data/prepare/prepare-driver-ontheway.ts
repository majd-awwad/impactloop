import { prisma } from '../../../src/database/prisma.js';
import { env } from '../../../src/config/env.js';
import { canDriverMarkDeliveryFailed } from '../../../src/modules/fulfillment-failures/fulfillment-failures.eligibility.js';
import {
  getDriverDeliveryDetail,
  listActiveDriverDeliveries,
} from '../../../src/modules/driver/driver.service.js';
import { reconcileDriverAvailability } from '../../../src/modules/driver/driver-availability.js';
import { DERIVED_DELIVERY_WINDOW_DURATION_HOURS } from '../../../src/modules/deliveries/delivery-configuration.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import type { ReservationStatus } from '../../../src/generated/prisma/client.js';
import {
  formatNamedAccount,
  redact,
  resolveMajdDeliveryTrio,
} from './local-demo-accounts.js';
import {
  DRIVER_ON_THE_WAY_DEMO_KEY,
  DRIVER_ON_THE_WAY_PREFERRED_TITLES,
  hasDemoMarker,
} from './local-demo-keys.js';
import {
  belongsToOtherScenario,
  canMutateReservationForDemo,
  selectIsolatedScenarioCandidate,
  type ScenarioCandidate,
} from './prepare-delivery-isolation.js';

const PREFERRED_MATERIAL = DRIVER_ON_THE_WAY_PREFERRED_TITLES[0]!;

const withMarker = (value: string | null | undefined, key: string) => {
  if (hasDemoMarker(value, key)) {
    return value ?? key;
  }
  const base = value?.trim() ?? '';
  return base
    ? `${base} [${key}]`
    : `Local ON_THE_WAY screenshot prep [${key}]`;
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

async function snapshotDelivery(deliveryId: string) {
  const delivery = await prisma.delivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: {
      reservation: {
        select: {
          id: true,
          status: true,
          fulfillmentMethod: true,
          material: { select: { title: true } },
        },
      },
      assignedDriverProfile: {
        select: {
          status: true,
          availability: true,
          user: { select: { displayName: true } },
        },
      },
      pickupItems: { select: { wasPicked: true, quantity: true } },
      attempts: { select: { attemptNumber: true } },
      incidentReports: { select: { reasonCode: true, status: true } },
    },
  });

  return {
    deliveryRef: redact(delivery.id),
    reservationId: delivery.reservation.id,
    material: delivery.reservation.material.title,
    deliveryStatus: delivery.status,
    reservationStatus: delivery.reservation.status,
    assignedDriver: delivery.assignedDriverProfile
      ? `${delivery.assignedDriverProfile.user.displayName} (${delivery.assignedDriverProfile.status}/${delivery.assignedDriverProfile.availability})`
      : null,
    attempts: delivery.attempts.length,
    reports: delivery.incidentReports,
  };
}

async function stampOnTheWayMarker(reservationId: string) {
  const row = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    select: { message: true, deliveryNote: true },
  });
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      message: withMarker(row.message, DRIVER_ON_THE_WAY_DEMO_KEY),
      deliveryNote: withMarker(row.deliveryNote, DRIVER_ON_THE_WAY_DEMO_KEY),
    },
  });
}

async function createMinimumDemoDelivery(input: {
  driverUserId: string;
  driverProfileId: string;
  learnerId: string;
  supplierUserId: string;
}) {
  const material = await prisma.material.findFirst({
    where: {
      ownerId: input.supplierUserId,
      title: PREFERRED_MATERIAL,
      deliveryAllowed: true,
    },
    select: { id: true, title: true, unit: true, condition: true },
  });
  if (!material) {
    throw new Error(`Preferred ON_THE_WAY material "${PREFERRED_MATERIAL}" was not found.`);
  }

  const source = await prisma.delivery.findFirst({
    where: {
      reservation: {
        requesterId: input.learnerId,
        ownerId: input.supplierUserId,
        fulfillmentMethod: 'DELIVERY',
        status: { notIn: ['COMPLETED'] },
      },
    },
    include: {
      reservation: {
        select: {
          id: true,
          message: true,
          deliveryNote: true,
          quantityRequested: true,
          deliveryAddressText: true,
          dropoffCity: true,
          dropoffArea: true,
          unitPriceAtReservation: true,
          materialSubtotal: true,
          deliveryFee: true,
          totalAmount: true,
          pricingCurrency: true,
          deliveryZone: true,
          materialId: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!source) {
    throw new Error(
      'No existing delivery/reservation between these three accounts to clone locations from.',
    );
  }

  const sourceCandidate: ScenarioCandidate = {
    reservationId: source.reservation.id,
    deliveryId: source.id,
    materialTitle: material.title,
    reservationStatus: 'ACCEPTED',
    message: source.reservation.message,
    deliveryNote: source.reservation.deliveryNote,
  };
  if (belongsToOtherScenario(sourceCandidate, 'driver-on-the-way')) {
    // Still clone geo fields, never the other scenario's reservation/delivery ids.
  }

  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.create({
      data: {
        materialId: material.id,
        requesterId: input.learnerId,
        ownerId: input.supplierUserId,
        quantityRequested: source.reservation.quantityRequested,
        fulfillmentMethod: 'DELIVERY',
        status: 'ACCEPTED',
        acceptedAt: now,
        message: withMarker(
          'Local demo ON_THE_WAY screenshot reservation',
          DRIVER_ON_THE_WAY_DEMO_KEY,
        ),
        deliveryNote: withMarker(null, DRIVER_ON_THE_WAY_DEMO_KEY),
        supplierPickupWindowStart: new Date(now.getTime() - 2 * 60 * 60_000),
        supplierPickupWindowEnd: new Date(now.getTime() + 2 * 60 * 60_000),
        confirmedDeliveryWindowStart: new Date(now.getTime() - 15 * 60_000),
        confirmedDeliveryWindowEnd: new Date(
          now.getTime() + DERIVED_DELIVERY_WINDOW_DURATION_HOURS * 60 * 60_000,
        ),
        deliveryAddressText: source.reservation.deliveryAddressText,
        dropoffCity: source.reservation.dropoffCity,
        dropoffArea: source.reservation.dropoffArea,
        unitPriceAtReservation: source.reservation.unitPriceAtReservation,
        materialSubtotal: source.reservation.materialSubtotal,
        deliveryFee: source.reservation.deliveryFee,
        totalAmount: source.reservation.totalAmount,
        pricingCurrency: source.reservation.pricingCurrency,
        deliveryZone: source.reservation.deliveryZone,
      },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: null,
        newStatus: 'ACCEPTED',
        changedBy: input.learnerId,
        note: 'Local demo prep: created ACCEPTED ON_THE_WAY reservation',
      },
    });

    const delivery = await tx.delivery.create({
      data: {
        reservationId: reservation.id,
        pickupLocationId: source.pickupLocationId,
        dropoffLocationId: source.dropoffLocationId,
        assignedDriverProfileId: input.driverProfileId,
        requestedByUserId: input.learnerId,
        status: 'PICKED_UP',
        requestedAt: now,
        assignedAt: now,
        arrivedPickupAt: now,
        pickedUpAt: now,
        scheduleOccurrence: 1,
      },
    });

    await tx.deliveryAssignment.create({
      data: {
        deliveryId: delivery.id,
        driverProfileId: input.driverProfileId,
        assignedByUserId: input.driverUserId,
        status: 'ACTIVE',
        acceptedAt: now,
      },
    });

    await tx.deliveryPickupItem.create({
      data: {
        deliveryId: delivery.id,
        reservationId: reservation.id,
        materialId: material.id,
        materialTitle: material.title,
        quantity: source.reservation.quantityRequested,
        unit: material.unit,
        condition: material.condition,
        wasPicked: true,
        recordedAt: now,
      },
    });

    return { deliveryId: delivery.id, reservationId: reservation.id };
  });

  console.log(
    `Created isolated ON_THE_WAY demo delivery ${redact(created.deliveryId)} on ${material.title}.`,
  );
  return created;
}

async function prepareOnTheWay(input: {
  deliveryId: string;
  driverUserId: string;
  driverProfileId: string;
  learnerId: string;
  supplierUserId: string;
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
        assignments: true,
        attempts: true,
      },
    });

    if (!canMutateReservationForDemo(delivery.reservation.status)) {
      throw new Error(
        `Refusing to mutate reservation status ${delivery.reservation.status} for ON_THE_WAY demo.`,
      );
    }
    if (delivery.attempts.length > 0) {
      throw new Error('Target already has delivery attempts; refusing to consume retry.');
    }

    const reservation = delivery.reservation;
    if (reservation.requesterId !== input.learnerId) {
      throw new Error('Target reservation is not Majd Learner.');
    }
    if (reservation.ownerId !== input.supplierUserId) {
      throw new Error('Target reservation is not Majd Tech Reuse Workshop.');
    }

    const previousReservationStatus = reservation.status;
    if (previousReservationStatus !== 'ACCEPTED') {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: 'ACCEPTED',
          fulfillmentMethod: 'DELIVERY',
          acceptedAt: reservation.acceptedAt ?? now,
          cancelledAt: null,
          completedAt: null,
          rejectedAt: null,
          confirmedDeliveryWindowStart: windowStart,
          confirmedDeliveryWindowEnd: windowEnd,
          earliestDeliveryStart: null,
          schedulingConflictReason: null,
        },
      });
      await tx.reservationStatusHistory.create({
        data: {
          reservationId: reservation.id,
          statusGroup: 'RESERVATION',
          oldStatus: previousReservationStatus,
          newStatus: 'ACCEPTED',
          changedBy: input.driverUserId,
          note: 'Local demo prep: reservation compatible with active delivery',
        },
      });
    } else {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          fulfillmentMethod: 'DELIVERY',
          acceptedAt: reservation.acceptedAt ?? now,
          cancelledAt: null,
          completedAt: null,
          rejectedAt: null,
          confirmedDeliveryWindowStart: windowStart,
          confirmedDeliveryWindowEnd: windowEnd,
          earliestDeliveryStart: null,
          schedulingConflictReason: null,
        },
      });
    }

    await tx.deliveryAssignment.updateMany({
      where: {
        deliveryId: delivery.id,
        status: 'ACTIVE',
        driverProfileId: { not: input.driverProfileId },
      },
      data: {
        status: 'RELEASED',
        releasedAt: now,
        releaseReason: 'Local demo prep: assign Majd Driver',
      },
    });

    const demoAssignments = delivery.assignments.filter(
      (row) => row.driverProfileId === input.driverProfileId,
    );
    const activeDemo = demoAssignments.find((row) => row.status === 'ACTIVE');
    if (activeDemo) {
      await tx.deliveryAssignment.update({
        where: { id: activeDemo.id },
        data: { releasedAt: null, releaseReason: null },
      });
    } else if (demoAssignments[0]) {
      await tx.deliveryAssignment.update({
        where: { id: demoAssignments[0].id },
        data: {
          status: 'ACTIVE',
          releasedAt: null,
          releaseReason: null,
          acceptedAt: now,
        },
      });
    } else {
      await tx.deliveryAssignment.create({
        data: {
          deliveryId: delivery.id,
          driverProfileId: input.driverProfileId,
          assignedByUserId: input.driverUserId,
          status: 'ACTIVE',
          acceptedAt: now,
        },
      });
    }

    const picked = delivery.pickupItems.find(
      (item) => item.reservationId === reservation.id && item.wasPicked,
    );
    if (!picked) {
      await tx.deliveryPickupItem.upsert({
        where: {
          deliveryId_reservationId: {
            deliveryId: delivery.id,
            reservationId: reservation.id,
          },
        },
        update: { wasPicked: true, recordedAt: now, unpickedReason: null },
        create: {
          deliveryId: delivery.id,
          reservationId: reservation.id,
          materialId: reservation.material.id,
          materialTitle: reservation.material.title,
          quantity: reservation.quantityRequested,
          unit: reservation.material.unit,
          condition: reservation.material.condition,
          wasPicked: true,
          recordedAt: now,
        },
      });
    }

    const previousDeliveryStatus = delivery.status;
    await tx.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'ON_THE_WAY',
        assignedDriverProfileId: input.driverProfileId,
        assignedAt: delivery.assignedAt ?? now,
        arrivedPickupAt: delivery.arrivedPickupAt ?? now,
        pickedUpAt: delivery.pickedUpAt ?? now,
        onTheWayAt: now,
        arrivedDropoffAt: null,
        deliveredAt: null,
        cancelledAt: null,
        failedAt: null,
        failureReason: null,
        returnRequiredAt: null,
        returnReason: null,
        returnedToSupplierAt: null,
        returnConfirmedByUserId: null,
        returnCustodyDriverProfileId: null,
        resolutionOutcome: null,
        administrativelyResolvedAt: null,
        administrativelyResolvedByUserId: null,
        scheduleOccurrence: Math.max(delivery.scheduleOccurrence, 1),
      },
    });

    if (previousDeliveryStatus !== 'ON_THE_WAY') {
      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: delivery.id,
          oldStatus: previousDeliveryStatus,
          newStatus: 'ON_THE_WAY',
          changedByUserId: input.driverUserId,
          note: 'Local demo prep: set ON_THE_WAY for screenshot path',
        },
      });
    }

    if (delivery.deliveryGroupId) {
      await tx.deliveryGroup.update({
        where: { id: delivery.deliveryGroupId },
        data: {
          status: 'ASSIGNED',
          assignedDriverProfileId: input.driverProfileId,
          windowStart,
          windowEnd,
        },
      });
    }

    await reconcileDriverAvailability(tx, input.driverProfileId);
  });

  const snapshot = await snapshotDelivery(input.deliveryId);
  const reservation = await prisma.reservation.findFirstOrThrow({
    where: { deliveries: { some: { id: input.deliveryId } } },
    select: { status: true, confirmedDeliveryWindowEnd: true },
  });

  return {
    snapshot,
    reservationStatus: reservation.status as ReservationStatus,
    windowEnd: reservation.confirmedDeliveryWindowEnd,
  };
}

export async function prepareDriverOnTheWayDemo() {
  assertLocalDemoDatabaseUrl(env.databaseUrl, 'local driver ON_THE_WAY demo prep');

  const resolved = await resolveMajdDeliveryTrio();
  if (!resolved.ok) {
    console.log(`\nSTOPPED: ${resolved.reason}`);
    throw new Error(`ON_THE_WAY demo account resolution failed: ${resolved.reason}`);
  }

  const { driver, learner, supplierUser, driverProfile } = resolved.trio;
  console.log('=== ACCOUNT RESOLUTION ===');
  console.log('  ' + formatNamedAccount(driver));
  console.log('  ' + formatNamedAccount(learner));
  console.log('  ' + formatNamedAccount({ ...supplierUser, roles: ['SUPPLIER'] }));

  const candidates = await loadScenarioCandidates({
    learnerId: learner.id,
    supplierUserId: supplierUser.id,
  });
  const { selected, skipped } = selectIsolatedScenarioCandidate({
    kind: 'driver-on-the-way',
    candidates,
  });
  if (skipped.length > 0) {
    console.log(
      `Skipped ${skipped.length} reservation(s) as COMPLETED, other-scenario, or forbidden material.`,
    );
  }

  let deliveryId: string;
  let reservationId: string;
  let created = false;

  if (selected?.deliveryId) {
    deliveryId = selected.deliveryId;
    reservationId = selected.reservationId;
    console.log(
      `\nReusing ON_THE_WAY scenario ${redact(selected.reservationId)} / ${selected.materialTitle}`,
    );
  } else {
    const createdPair = await createMinimumDemoDelivery({
      driverUserId: driver.id,
      driverProfileId: driverProfile.id,
      learnerId: learner.id,
      supplierUserId: supplierUser.id,
    });
    deliveryId = createdPair.deliveryId;
    reservationId = createdPair.reservationId;
    created = true;
  }

  await stampOnTheWayMarker(reservationId);

  const prepared = await prepareOnTheWay({
    deliveryId,
    driverUserId: driver.id,
    driverProfileId: driverProfile.id,
    learnerId: learner.id,
    supplierUserId: supplierUser.id,
  });

  console.log('\n=== AFTER ===');
  console.log(JSON.stringify(prepared.snapshot, null, 2));

  const [active, detail] = await Promise.all([
    listActiveDriverDeliveries(driver.id),
    getDriverDeliveryDetail(driver.id, deliveryId),
  ]);
  const listed = active.deliveries.find((row) => row.id === deliveryId);
  const eligibility = canDriverMarkDeliveryFailed({
    reservationStatus: prepared.reservationStatus,
    deliveryStatus: 'ARRIVED_DROPOFF',
    confirmedDeliveryWindowEnd: prepared.windowEnd,
  });

  if (
    !listed ||
    listed.status !== 'ON_THE_WAY' ||
    !detail.isActive ||
    detail.delivery.status !== 'ON_THE_WAY'
  ) {
    throw new Error('Prepared delivery did not appear as active ON_THE_WAY for Majd Driver.');
  }
  if (!eligibility) {
    throw new Error('ARRIVED_DROPOFF would not be eligible for delivery-failed.');
  }
  if (prepared.snapshot.attempts !== 0) {
    throw new Error('Retry attempt already exists; screenshot path would skip first attempt.');
  }

  console.log('\nREADY. Open the driver app and continue with وصول إلى موقع التسليم.');

  return {
    created,
    reservationId,
    deliveryId,
    materialTitle: prepared.snapshot.material,
    deliveryStatus: prepared.snapshot.deliveryStatus,
  };
}
