/**
 * Graduation/report screenshot prep for Figure 3.57:
 * Driver profile/availability, grouped completed history, and incident history.
 *
 * Additive and idempotent. Uses production reservation/delivery/failure services.
 * Never runs prisma:seed. Does not mutate CASH handover or ON_THE_WAY demos.
 */
import { prisma } from '../../../src/database/prisma.js';
import { env } from '../../../src/config/env.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import { deriveHandoverCode } from '../../../src/utils/handover-codes.js';
import { createReservation } from '../../../src/modules/reservations/reservations.service.js';
import {
  ACTIVE_HOLD_STATUSES,
  getMaterialQuantityState,
} from '../../../src/modules/reservations/reservations.quantity.js';
import { acceptSupplierReservation } from '../../../src/modules/supplier-reservations/supplier-reservations.service.js';
import {
  acceptDelivery,
  updateDriverAvailability,
  updateDriverDeliveryStatus,
} from '../../../src/modules/driver/driver.service.js';
import {
  listDriverDeliveryHistory,
  listDriverIncidents,
} from '../../../src/modules/driver/driver-history.service.js';
import { reconcileDriverAvailability } from '../../../src/modules/driver/driver-availability.js';
import { markDriverDeliveryFailed } from '../../../src/modules/fulfillment-failures/fulfillment-failures.service.js';
import { confirmSupplierDeliveryReturn } from '../../../src/modules/delivery-returns/delivery-returns.service.js';
import { rejectAdminNoShowReport } from '../../../src/modules/admin-no-show-reports/admin-no-show-reports.service.js';
import {
  ADMIN_EMAIL,
  formatNamedAccount,
  MAJD_DRIVER_EMAIL,
  MAJD_LEARNER_EMAIL,
  MAJD_SUPPLIER_EMAIL,
  redact,
} from './local-demo-accounts.js';
import {
  CASH_HANDOVER_DEMO_KEY,
  CASH_HANDOVER_PREFERRED_TITLES,
  DRIVER_FIGURE_357_GROUPED_DEMO_KEY,
  DRIVER_FIGURE_357_GROUPED_TITLES,
  DRIVER_FIGURE_357_INCIDENT_DEMO_KEY,
  DRIVER_FIGURE_357_INCIDENT_TITLES,
  DRIVER_ON_THE_WAY_DEMO_KEY,
  DRIVER_ON_THE_WAY_PREFERRED_TITLES,
  hasDemoMarker,
} from './local-demo-keys.js';

const FORBIDDEN_TITLES = new Set<string>([
  ...CASH_HANDOVER_PREFERRED_TITLES,
  ...DRIVER_ON_THE_WAY_PREFERRED_TITLES,
]);

const DROPOFF = {
  address: 'University District learner dropoff, near Hebron University',
  city: 'Hebron',
  area: 'University District',
} as const;

const withMarker = (value: string | null | undefined, key: string) => {
  if (hasDemoMarker(value, key)) {
    return value ?? key;
  }
  const base = value?.trim() ?? '';
  return base ? `${base} [${key}]` : key;
};

export const isForbiddenDriverFigure357Material = (title: string): boolean =>
  FORBIDDEN_TITLES.has(title);

export const buildFeasibleDeliveryScheduling = (hoursFromNowPickup = 36) => {
  const supplierPickupStart = new Date(
    Date.now() + hoursFromNowPickup * 3_600_000,
  );
  const supplierPickupEnd = new Date(
    supplierPickupStart.getTime() + 2 * 3_600_000,
  );
  const earliestDelivery = new Date(
    supplierPickupStart.getTime() + 60 * 60_000,
  );
  const learnerDeliveryStart = new Date(
    earliestDelivery.getTime() - 30 * 60_000,
  );
  const learnerDeliveryEnd = new Date(
    earliestDelivery.getTime() + 3 * 3_600_000,
  );
  return {
    supplierPickup: {
      start: supplierPickupStart.toISOString(),
      end: supplierPickupEnd.toISOString(),
    },
    learnerDelivery: {
      start: learnerDeliveryStart.toISOString(),
      end: learnerDeliveryEnd.toISOString(),
    },
  };
};

export const activeHandoverWindow = () => {
  const start = new Date(Date.now() - 15 * 60_000);
  const end = new Date(Date.now() + 45 * 60_000);
  return { start, end };
};

export type DriverFigure357Readiness = {
  driverAvailablePreference: boolean;
  groupedCompletedVisible: boolean;
  groupedItemCount: number;
  groupedOperationalDeliveries: number;
  incidentVisible: boolean;
  cashScenarioUntouched: boolean;
  onTheWayScenarioUntouched: boolean;
};

export const isDriverFigure357Ready = (
  snapshot: DriverFigure357Readiness,
): boolean =>
  snapshot.driverAvailablePreference &&
  snapshot.groupedCompletedVisible &&
  snapshot.groupedItemCount >= 2 &&
  snapshot.groupedOperationalDeliveries === 1 &&
  snapshot.incidentVisible &&
  snapshot.cashScenarioUntouched &&
  snapshot.onTheWayScenarioUntouched;

const stampReservationMarker = async (
  reservationId: string,
  key: string,
) => {
  const row = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    select: { message: true, deliveryNote: true },
  });
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      message: withMarker(row.message, key),
      deliveryNote: withMarker(row.deliveryNote, key),
    },
  });
};

const findMarkedReservations = async (key: string) =>
  prisma.reservation.findMany({
    where: {
      fulfillmentMethod: 'DELIVERY',
      OR: [
        { message: { contains: key } },
        { deliveryNote: { contains: key } },
      ],
    },
    select: {
      id: true,
      status: true,
      deliveryGroupId: true,
      message: true,
      deliveryNote: true,
      material: { select: { title: true } },
      requester: { select: { displayName: true, email: true } },
      deliveries: {
        select: {
          id: true,
          status: true,
          deliveryGroupId: true,
          assignedDriverProfileId: true,
        },
        orderBy: { requestedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

const resolveMajdDriver = async () => {
  const user = await prisma.user.findUnique({
    where: { email: MAJD_DRIVER_EMAIL },
    select: {
      id: true,
      displayName: true,
      email: true,
      accountStatus: true,
      roles: { select: { role: true, isPrimary: true } },
      driverProfile: {
        select: {
          id: true,
          status: true,
          availability: true,
          acceptingNewJobs: true,
          phone: true,
          displayName: true,
        },
      },
    },
  });
  if (!user) {
    throw new Error(`Driver account ${MAJD_DRIVER_EMAIL} was not found.`);
  }
  if (user.accountStatus !== 'ACTIVE') {
    throw new Error(`${MAJD_DRIVER_EMAIL} is not ACTIVE.`);
  }
  if (!user.roles.some((role) => role.role === 'DRIVER')) {
    throw new Error(`${MAJD_DRIVER_EMAIL} is missing the DRIVER role.`);
  }
  if (!user.driverProfile || user.driverProfile.status !== 'ACTIVE') {
    throw new Error(`${MAJD_DRIVER_EMAIL} has no ACTIVE driver profile.`);
  }
  return {
    ...user,
    driverProfile: user.driverProfile,
  };
};

const resolveLearner = async () => {
  const learner = await prisma.user.findUnique({
    where: { email: MAJD_LEARNER_EMAIL },
    select: {
      id: true,
      email: true,
      displayName: true,
      emailVerifiedAt: true,
      accountStatus: true,
    },
  });
  if (!learner?.emailVerifiedAt || learner.accountStatus !== 'ACTIVE') {
    throw new Error(
      `Primary learner ${MAJD_LEARNER_EMAIL} is missing or not email-verified.`,
    );
  }
  return learner;
};

const resolveSupplier = async () => {
  const supplier = await prisma.user.findUnique({
    where: { email: MAJD_SUPPLIER_EMAIL },
    select: { id: true, email: true, displayName: true, accountStatus: true },
  });
  if (!supplier || supplier.accountStatus !== 'ACTIVE') {
    throw new Error(`Supplier ${MAJD_SUPPLIER_EMAIL} was not found.`);
  }
  return supplier;
};

const resolveAdmin = async () => {
  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true },
  });
  if (!admin) {
    throw new Error(`Admin ${ADMIN_EMAIL} was not found.`);
  }
  return admin;
};

const selectMaterials = async (input: {
  supplierUserId: string;
  learnerId: string;
  preferredTitles: readonly string[];
  count: number;
}) => {
  const materials = await prisma.material.findMany({
    where: {
      ownerId: input.supplierUserId,
      deliveryAllowed: true,
      status: 'AVAILABLE',
      title: { notIn: [...FORBIDDEN_TITLES] },
    },
    select: {
      id: true,
      title: true,
      isFree: true,
      quantity: true,
      reservations: {
        where: {
          requesterId: input.learnerId,
          status: { in: [...ACTIVE_HOLD_STATUSES] },
        },
        select: { id: true },
      },
    },
    orderBy: [{ isFree: 'desc' }, { title: 'asc' }],
  });

  const usable = [];
  for (const material of materials) {
    if (material.reservations.length > 0) continue;
    const quantity = await getMaterialQuantityState(prisma, material.id);
    if (!quantity || quantity.availableQuantity.lt(1)) continue;
    usable.push(material);
  }

  const selected: typeof usable = [];
  for (const title of input.preferredTitles) {
    const match = usable.find((row) => row.title === title);
    if (match && !selected.some((row) => row.id === match.id)) {
      selected.push(match);
    }
    if (selected.length >= input.count) break;
  }

  for (const row of usable) {
    if (selected.length >= input.count) break;
    if (!selected.some((item) => item.id === row.id)) {
      selected.push(row);
    }
  }

  if (selected.length < input.count) {
    throw new Error(
      `Need ${input.count} isolated delivery materials for Figure 3.57; found ${selected.length}.`,
    );
  }
  return selected.slice(0, input.count);
};

const deliveryReservationInput = (
  materialId: string,
  scheduling: ReturnType<typeof buildFeasibleDeliveryScheduling>,
  key: string,
  overrides: { combineWithDeliveryGroupId?: string; message?: string } = {},
) => ({
  materialId,
  quantityRequested: 1,
  fulfillmentMethod: 'DELIVERY' as const,
  paymentMethod: 'CASH' as const,
  learnerPreferredDeliveryWindows: [scheduling.learnerDelivery],
  deliveryAddressText: DROPOFF.address,
  dropoffCity: DROPOFF.city,
  dropoffArea: DROPOFF.area,
  safeDropoffAllowed: false,
  deliveryNote: withMarker(null, key),
  message: withMarker(
    overrides.message ?? 'Local Figure 3.57 driver operations demo',
    key,
  ),
  ...(overrides.combineWithDeliveryGroupId
    ? { combineWithDeliveryGroupId: overrides.combineWithDeliveryGroupId }
    : {}),
});

const acceptDeliveryReservation = async (
  supplierUserId: string,
  reservationId: string,
  scheduling: ReturnType<typeof buildFeasibleDeliveryScheduling>,
) => {
  await acceptSupplierReservation(supplierUserId, reservationId, {
    pickupWindowStart: scheduling.supplierPickup.start,
    pickupWindowEnd: scheduling.supplierPickup.end,
    selectedPreferredWindowIndex: 0,
  });
};

const progressAssignedDeliveryTo = async (input: {
  driverUserId: string;
  deliveryId: string;
  reservationIds: string[];
  target: 'ARRIVED_DROPOFF' | 'DELIVERED';
}) => {
  const transitions = [
    'DRIVER_ASSIGNED',
    'ARRIVED_PICKUP',
    'PICKED_UP',
    'ON_THE_WAY',
    'ARRIVED_DROPOFF',
    'DELIVERED',
  ] as const;

  let current = await prisma.delivery.findUniqueOrThrow({
    where: { id: input.deliveryId },
    select: { status: true },
  });

  if (current.status === 'WAITING_FOR_DRIVER') {
    await acceptDelivery(input.driverUserId, input.deliveryId);
    current = await prisma.delivery.findUniqueOrThrow({
      where: { id: input.deliveryId },
      select: { status: true },
    });
  }

  const startIndex = transitions.indexOf(
    current.status as (typeof transitions)[number],
  );
  const targetIndex = transitions.indexOf(input.target);
  if (startIndex < 0 || targetIndex < 0 || targetIndex < startIndex) {
    throw new Error(
      `Cannot progress delivery ${redact(input.deliveryId)} from ${current.status} to ${input.target}.`,
    );
  }

  for (const status of transitions.slice(startIndex + 1, targetIndex + 1)) {
    if (status === 'PICKED_UP') {
      const window = activeHandoverWindow();
      await prisma.reservation.updateMany({
        where: { id: { in: input.reservationIds } },
        data: {
          supplierPickupWindowStart: window.start,
          supplierPickupWindowEnd: window.end,
          pickupWindowStart: window.start,
          pickupWindowEnd: window.end,
        },
      });
    }

    if (status === 'ON_THE_WAY' || status === 'DELIVERED') {
      const window = activeHandoverWindow();
      await prisma.reservation.updateMany({
        where: { id: { in: input.reservationIds } },
        data: {
          confirmedDeliveryWindowStart: window.start,
          confirmedDeliveryWindowEnd: window.end,
        },
      });
      if (current.status === 'REDELIVERY_SCHEDULED' || status === 'ON_THE_WAY') {
        // keep going
      }
    }

    const payload: {
      status: typeof status;
      confirmationCode?: string;
      cashReceivedConfirmed?: boolean;
    } = { status };

    if (status === 'PICKED_UP') {
      payload.confirmationCode = deriveHandoverCode(
        'supplier-handover',
        input.deliveryId,
      );
    }
    if (status === 'DELIVERED') {
      payload.confirmationCode = deriveHandoverCode(
        'learner-delivery',
        input.deliveryId,
      );
      payload.cashReceivedConfirmed = true;
    }

    await updateDriverDeliveryStatus(
      input.driverUserId,
      input.deliveryId,
      payload,
    );
    current = { status };
  }
};

const ensureGroupedCompletedJob = async (input: {
  driverUserId: string;
  driverProfileId: string;
  learnerId: string;
  supplierUserId: string;
}) => {
  const marked = await findMarkedReservations(
    DRIVER_FIGURE_357_GROUPED_DEMO_KEY,
  );
  const existingGroupId = marked.find((row) => row.deliveryGroupId)
    ?.deliveryGroupId;
  if (existingGroupId) {
    const group = await prisma.deliveryGroup.findUnique({
      where: { id: existingGroupId },
      select: {
        id: true,
        status: true,
        reservations: {
          select: {
            id: true,
            status: true,
            material: { select: { title: true } },
            requester: { select: { displayName: true } },
          },
        },
        delivery: {
          select: { id: true, status: true },
        },
      },
    });
    const delivery = group?.delivery;
    if (
      group &&
      group.reservations.length >= 2 &&
      delivery &&
      delivery.status === 'DELIVERED' &&
      group.reservations.every((row) => row.status === 'COMPLETED')
    ) {
      for (const reservation of group.reservations) {
        await stampReservationMarker(
          reservation.id,
          DRIVER_FIGURE_357_GROUPED_DEMO_KEY,
        );
      }
      return {
        action: 'reuse' as const,
        groupId: group.id,
        deliveryId: delivery.id,
        deliveryStatus: delivery.status,
        materials: group.reservations.map((row) => row.material.title),
        learnerName: group.reservations[0]!.requester.displayName,
        reservationCount: group.reservations.length,
        operationalDeliveryCount: 1,
      };
    }
  }

  const materials = await selectMaterials({
    supplierUserId: input.supplierUserId,
    learnerId: input.learnerId,
    preferredTitles: DRIVER_FIGURE_357_GROUPED_TITLES,
    count: 2,
  });
  const scheduling = buildFeasibleDeliveryScheduling(40);

  const first = await createReservation(
    input.learnerId,
    deliveryReservationInput(
      materials[0]!.id,
      scheduling,
      DRIVER_FIGURE_357_GROUPED_DEMO_KEY,
      { message: 'Figure 3.57 grouped delivery item 1' },
    ),
  );
  if (!first.deliveryGroupId) {
    throw new Error('First grouped reservation did not create a DeliveryGroup.');
  }
  const second = await createReservation(
    input.learnerId,
    deliveryReservationInput(
      materials[1]!.id,
      scheduling,
      DRIVER_FIGURE_357_GROUPED_DEMO_KEY,
      {
        combineWithDeliveryGroupId: first.deliveryGroupId,
        message: 'Figure 3.57 grouped delivery item 2',
      },
    ),
  );
  if (second.deliveryGroupId !== first.deliveryGroupId) {
    throw new Error('Grouped reservations did not share one DeliveryGroup.');
  }

  await acceptDeliveryReservation(
    input.supplierUserId,
    first.id,
    scheduling,
  );
  await acceptDeliveryReservation(
    input.supplierUserId,
    second.id,
    scheduling,
  );

  const delivery = await prisma.delivery.findFirstOrThrow({
    where: { deliveryGroupId: first.deliveryGroupId },
    select: { id: true },
  });

  const deliveryCount = await prisma.delivery.count({
    where: { deliveryGroupId: first.deliveryGroupId },
  });
  if (deliveryCount !== 1) {
    throw new Error(
      `Expected one operational Delivery for the group; found ${deliveryCount}.`,
    );
  }

  await progressAssignedDeliveryTo({
    driverUserId: input.driverUserId,
    deliveryId: delivery.id,
    reservationIds: [first.id, second.id],
    target: 'DELIVERED',
  });

  await stampReservationMarker(first.id, DRIVER_FIGURE_357_GROUPED_DEMO_KEY);
  await stampReservationMarker(second.id, DRIVER_FIGURE_357_GROUPED_DEMO_KEY);

  const completed = await prisma.delivery.findUniqueOrThrow({
    where: { id: delivery.id },
    select: {
      id: true,
      status: true,
      deliveryGroup: {
        select: {
          id: true,
          reservations: {
            select: {
              material: { select: { title: true } },
              requester: { select: { displayName: true } },
            },
          },
        },
      },
    },
  });

  return {
    action: 'create' as const,
    groupId: completed.deliveryGroup!.id,
    deliveryId: completed.id,
    deliveryStatus: completed.status,
    materials: completed.deliveryGroup!.reservations.map(
      (row) => row.material.title,
    ),
    learnerName:
      completed.deliveryGroup!.reservations[0]?.requester.displayName ??
      'Majd Learner',
    reservationCount: completed.deliveryGroup!.reservations.length,
    operationalDeliveryCount: 1,
  };
};

const ensureIncidentHistory = async (input: {
  driverUserId: string;
  driverProfileId: string;
  learnerId: string;
  supplierUserId: string;
  adminUserId: string;
}) => {
  const marked = await findMarkedReservations(
    DRIVER_FIGURE_357_INCIDENT_DEMO_KEY,
  );
  const existing = marked[0];
  if (existing) {
    const deliveryId = existing.deliveries[0]?.id;
    const report = deliveryId
      ? await prisma.noShowReport.findFirst({
          where: {
            reporterUserId: input.driverUserId,
            OR: [
              { deliveryId },
              { reservationId: existing.id },
            ],
          },
          select: {
            id: true,
            reasonCode: true,
            status: true,
            recoveryAction: true,
            deliveryId: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : await prisma.noShowReport.findFirst({
          where: {
            reporterUserId: input.driverUserId,
            reservationId: existing.id,
          },
          select: {
            id: true,
            reasonCode: true,
            status: true,
            recoveryAction: true,
            deliveryId: true,
          },
          orderBy: { createdAt: 'desc' },
        });

    const delivery = deliveryId
      ? await prisma.delivery.findUnique({
          where: { id: deliveryId },
          select: { id: true, status: true, assignedDriverProfileId: true },
        })
      : null;

    if (
      report &&
      delivery &&
      !['DRIVER_ASSIGNED', 'ARRIVED_PICKUP', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVED_DROPOFF', 'REDELIVERY_PENDING', 'REDELIVERY_SCHEDULED', 'RETURN_TO_SUPPLIER_REQUIRED'].includes(
        delivery.status,
      )
    ) {
      await stampReservationMarker(
        existing.id,
        DRIVER_FIGURE_357_INCIDENT_DEMO_KEY,
      );
      return {
        action: 'reuse' as const,
        reservationId: existing.id,
        deliveryId: delivery.id,
        deliveryStatus: delivery.status,
        materialTitle: existing.material.title,
        learnerName: existing.requester.displayName,
        incidentId: report.id,
        reasonCode: report.reasonCode,
        reviewStatus: report.status,
        recoveryAction: report.recoveryAction,
      };
    }
  }

  const [material] = await selectMaterials({
    supplierUserId: input.supplierUserId,
    learnerId: input.learnerId,
    preferredTitles: DRIVER_FIGURE_357_INCIDENT_TITLES,
    count: 1,
  });
  const scheduling = buildFeasibleDeliveryScheduling(48);
  const reservation = await createReservation(
    input.learnerId,
    deliveryReservationInput(
      material!.id,
      scheduling,
      DRIVER_FIGURE_357_INCIDENT_DEMO_KEY,
      { message: 'Figure 3.57 incident history delivery' },
    ),
  );
  await acceptDeliveryReservation(
    input.supplierUserId,
    reservation.id,
    scheduling,
  );

  const delivery = await prisma.delivery.findFirstOrThrow({
    where: { reservationId: reservation.id },
    select: { id: true },
  });

  await progressAssignedDeliveryTo({
    driverUserId: input.driverUserId,
    deliveryId: delivery.id,
    reservationIds: [reservation.id],
    target: 'ARRIVED_DROPOFF',
  });

  const retryStart = new Date(Date.now() + 60 * 60_000);
  const retryEnd = new Date(retryStart.getTime() + 60 * 60_000);
  await markDriverDeliveryFailed(input.driverUserId, delivery.id, {
    reason: 'LEARNER_UNREACHABLE',
    learnerContactAttempted: true,
    note: 'Learner unreachable at drop-off. Scheduling a retry window.',
    retryWindowStart: retryStart.toISOString(),
    retryWindowEnd: retryEnd.toISOString(),
  });

  await updateDriverDeliveryStatus(input.driverUserId, delivery.id, {
    status: 'ON_THE_WAY',
  });
  const retryWindow = activeHandoverWindow();
  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      confirmedDeliveryWindowStart: retryWindow.start,
      confirmedDeliveryWindowEnd: retryWindow.end,
    },
  });
  await updateDriverDeliveryStatus(input.driverUserId, delivery.id, {
    status: 'ARRIVED_DROPOFF',
  });

  await markDriverDeliveryFailed(input.driverUserId, delivery.id, {
    reason: 'LEARNER_UNREACHABLE',
    learnerContactAttempted: true,
    note: 'Final attempt: learner still unreachable.',
  });

  await confirmSupplierDeliveryReturn(input.supplierUserId, delivery.id);

  const report = await prisma.noShowReport.findFirstOrThrow({
    where: {
      reporterUserId: input.driverUserId,
      OR: [{ deliveryId: delivery.id }, { reservationId: reservation.id }],
    },
    select: { id: true, reasonCode: true, status: true, recoveryAction: true },
    orderBy: { createdAt: 'desc' },
  });

  await rejectAdminNoShowReport(
    input.adminUserId,
    report.id,
    'Local demo resolution: learner unreachable after retry; hold released without strike.',
  );

  await stampReservationMarker(
    reservation.id,
    DRIVER_FIGURE_357_INCIDENT_DEMO_KEY,
  );

  const finalDelivery = await prisma.delivery.findUniqueOrThrow({
    where: { id: delivery.id },
    select: { id: true, status: true, assignedDriverProfileId: true },
  });
  const finalReport = await prisma.noShowReport.findUniqueOrThrow({
    where: { id: report.id },
    select: {
      id: true,
      reasonCode: true,
      status: true,
      recoveryAction: true,
    },
  });

  return {
    action: 'create' as const,
    reservationId: reservation.id,
    deliveryId: finalDelivery.id,
    deliveryStatus: finalDelivery.status,
    materialTitle: material!.title,
    learnerName: 'Majd Learner',
    incidentId: finalReport.id,
    reasonCode: finalReport.reasonCode,
    reviewStatus: finalReport.status,
    recoveryAction: finalReport.recoveryAction,
  };
};

const countMarkerReservations = async (key: string) =>
  prisma.reservation.count({
    where: {
      OR: [
        { message: { contains: key } },
        { deliveryNote: { contains: key } },
      ],
    },
  });

export async function prepareDriverOperationsDemo() {
  assertLocalDemoDatabaseUrl(env.databaseUrl, 'driver-operations demo prep');

  const driver = await resolveMajdDriver();
  const learner = await resolveLearner();
  const supplier = await resolveSupplier();
  const admin = await resolveAdmin();

  console.log('\nDriver operations demo prep (Figure 3.57)');
  console.log(
    '  ' +
      formatNamedAccount({
        ...driver,
        roles: driver.roles.map((role) =>
          role.isPrimary ? `${role.role}*` : role.role,
        ),
      }),
  );
  console.log(
    `  Driver profile: ${driver.driverProfile.displayName} | phone=${driver.driverProfile.phone} | status=${driver.driverProfile.status}`,
  );

  const beforeCash = await countMarkerReservations(CASH_HANDOVER_DEMO_KEY);
  const beforeOnTheWay = await countMarkerReservations(
    DRIVER_ON_THE_WAY_DEMO_KEY,
  );

  await updateDriverAvailability(driver.id, { acceptingNewJobs: true });

  const grouped = await ensureGroupedCompletedJob({
    driverUserId: driver.id,
    driverProfileId: driver.driverProfile.id,
    learnerId: learner.id,
    supplierUserId: supplier.id,
  });

  const incident = await ensureIncidentHistory({
    driverUserId: driver.id,
    driverProfileId: driver.driverProfile.id,
    learnerId: learner.id,
    supplierUserId: supplier.id,
    adminUserId: admin.id,
  });

  await prisma.$transaction(async (tx) => {
    await reconcileDriverAvailability(tx, driver.driverProfile.id);
  });
  const profile = await updateDriverAvailability(driver.id, {
    acceptingNewJobs: true,
  });

  const history = await listDriverDeliveryHistory(driver.id, { limit: 20 });
  const historyItem = history.deliveries.find(
    (row) => row.id === grouped.deliveryId,
  );
  const incidents = await listDriverIncidents(driver.id, { limit: 20 });
  const incidentItem = incidents.incidents.find(
    (row) => row.id === incident.incidentId,
  );

  const afterCash = await countMarkerReservations(CASH_HANDOVER_DEMO_KEY);
  const afterOnTheWay = await countMarkerReservations(
    DRIVER_ON_THE_WAY_DEMO_KEY,
  );

  const operationalDeliveryCount = await prisma.delivery.count({
    where: { deliveryGroupId: grouped.groupId },
  });

  const snapshot: DriverFigure357Readiness = {
    driverAvailablePreference: profile.acceptingNewJobs === true,
    groupedCompletedVisible:
      Boolean(historyItem) &&
      historyItem!.status === 'DELIVERED' &&
      historyItem!.groupedDelivery === true,
    groupedItemCount: historyItem?.itemCount ?? grouped.reservationCount,
    groupedOperationalDeliveries: operationalDeliveryCount,
    incidentVisible: Boolean(incidentItem),
    cashScenarioUntouched: beforeCash === afterCash && afterCash >= 1,
    onTheWayScenarioUntouched:
      beforeOnTheWay === afterOnTheWay && afterOnTheWay >= 1,
  };

  if (!isDriverFigure357Ready(snapshot)) {
    throw new Error(
      'Figure 3.57 demo is not screenshot-ready after preparation: ' +
        JSON.stringify(snapshot),
    );
  }

  console.log('\n=== FIGURE 3.57 READY ===');
  console.log(
    JSON.stringify(
      {
        markerGrouped: DRIVER_FIGURE_357_GROUPED_DEMO_KEY,
        markerIncident: DRIVER_FIGURE_357_INCIDENT_DEMO_KEY,
        driver: {
          email: driver.email,
          displayName: driver.displayName,
          acceptingNewJobs: profile.acceptingNewJobs,
          availability: profile.availability,
          phone: driver.driverProfile.phone,
        },
        grouped: {
          action: grouped.action,
          groupId: redact(grouped.groupId),
          deliveryId: redact(grouped.deliveryId),
          status: grouped.deliveryStatus,
          materials: grouped.materials,
          learnerName: grouped.learnerName,
          reservationCount: grouped.reservationCount,
          operationalDeliveryCount,
          historyItemCount: historyItem?.itemCount,
        },
        incident: {
          action: incident.action,
          deliveryId: redact(incident.deliveryId),
          deliveryStatus: incident.deliveryStatus,
          materialTitle: incident.materialTitle,
          reasonCode: incident.reasonCode,
          reviewStatus: incident.reviewStatus,
          recoveryAction: incident.recoveryAction,
        },
        isolation: {
          cashHandoverReservations: afterCash,
          driverOnTheWayReservations: afterOnTheWay,
        },
        screenshotReady: true,
        pages: {
          profile: '/driver/profile',
          history: '/driver/history',
          historyDetail: `/driver/history/${grouped.deliveryId}`,
          incidents: '/driver/incidents',
        },
        rerun: 'npm run demo:prepare:driver-operations -w apps/backend',
      },
      null,
      2,
    ),
  );

  return {
    driverUserId: driver.id,
    groupedDeliveryId: grouped.deliveryId,
    incidentDeliveryId: incident.deliveryId,
    screenshotReady: true as const,
  };
}
