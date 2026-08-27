/**
 * Local mobile-demo preparation for the Driver > Available Jobs page.
 *
 * Additive and idempotent:
 * - creates three waiting jobs (near, mid-distance, and grouped/far),
 * - keeps already accepted demo jobs intact and replaces only missing pool jobs,
 * - seeds a recent driver reference point so distance and radius filters work,
 * - never runs prisma:seed and never resets existing data.
 */
import { prisma } from '../../../src/database/prisma.js';
import { env } from '../../../src/config/env.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import { createReservation } from '../../../src/modules/reservations/reservations.service.js';
import {
  ACTIVE_HOLD_STATUSES,
  getMaterialQuantityState,
} from '../../../src/modules/reservations/reservations.quantity.js';
import { acceptSupplierReservation } from '../../../src/modules/supplier-reservations/supplier-reservations.service.js';
import {
  listAvailableDeliveries,
  updateDriverAvailability,
} from '../../../src/modules/driver/driver.service.js';
import {
  formatNamedAccount,
  MAJD_DRIVER_EMAIL,
  MAJD_LEARNER_EMAIL,
  MAJD_SUPPLIER_EMAIL,
  redact,
} from './local-demo-accounts.js';
import {
  CASH_HANDOVER_PREFERRED_TITLES,
  DRIVER_AVAILABLE_JOBS_DEMO_KEY,
  DRIVER_AVAILABLE_JOBS_PREFERRED_TITLES,
  DRIVER_FIGURE_357_GROUPED_TITLES,
  DRIVER_FIGURE_357_INCIDENT_TITLES,
  DRIVER_ON_THE_WAY_PREFERRED_TITLES,
} from './local-demo-keys.js';

type JobRole = 'near' | 'mid' | 'grouped-far';

type JobScenario = {
  role: JobRole;
  itemCount: number;
  pickupHoursFromNow: number;
  requestedMinutesAgo: number;
  pickup: {
    country: string;
    city: string;
    area: string;
    addressLine: string;
    latitude: number;
    longitude: number;
  };
  dropoff: {
    country: string;
    city: string;
    area: string;
    addressLine: string;
    latitude: number;
    longitude: number;
  };
};

const DRIVER_REFERENCE = {
  latitude: 31.5326,
  longitude: 35.0998,
} as const;

const JOB_SCENARIOS: readonly JobScenario[] = [
  {
    role: 'near',
    itemCount: 1,
    pickupHoursFromNow: 36,
    requestedMinutesAgo: 4,
    pickup: {
      country: 'Palestine',
      city: 'Hebron',
      area: 'Ein Sarah',
      addressLine: 'Ein Sarah commercial district',
      latitude: 31.5352,
      longitude: 35.0912,
    },
    dropoff: {
      country: 'Palestine',
      city: 'Hebron',
      area: 'University District',
      addressLine: 'Near Hebron University main gate',
      latitude: 31.5321,
      longitude: 35.1035,
    },
  },
  {
    role: 'mid',
    itemCount: 1,
    pickupHoursFromNow: 42,
    requestedMinutesAgo: 12,
    pickup: {
      country: 'Palestine',
      city: 'Hebron',
      area: 'Ras Al-Jora',
      addressLine: 'Ras Al-Jora industrial street',
      latitude: 31.5578,
      longitude: 35.0855,
    },
    dropoff: {
      country: 'Palestine',
      city: 'Hebron',
      area: 'Al-Haras',
      addressLine: 'Al-Haras neighborhood safe drop-off point',
      latitude: 31.5208,
      longitude: 35.0914,
    },
  },
  {
    role: 'grouped-far',
    itemCount: 2,
    pickupHoursFromNow: 48,
    requestedMinutesAgo: 21,
    pickup: {
      country: 'Palestine',
      city: 'Bethlehem',
      area: 'City Center',
      addressLine: 'Bethlehem city center reuse point',
      latitude: 31.7054,
      longitude: 35.2024,
    },
    dropoff: {
      country: 'Palestine',
      city: 'Bethlehem',
      area: 'Al-Karkafa',
      addressLine: 'Al-Karkafa learner delivery point',
      latitude: 31.6998,
      longitude: 35.1972,
    },
  },
] as const;

const FORBIDDEN_TITLES = new Set<string>([
  ...CASH_HANDOVER_PREFERRED_TITLES,
  ...DRIVER_ON_THE_WAY_PREFERRED_TITLES,
  ...DRIVER_FIGURE_357_GROUPED_TITLES,
  ...DRIVER_FIGURE_357_INCIDENT_TITLES,
]);

const roleMarker = (role: JobRole) =>
  `${DRIVER_AVAILABLE_JOBS_DEMO_KEY}:${role}`;

const buildScheduling = (hoursFromNow: number) => {
  const pickupStart = new Date(Date.now() + hoursFromNow * 3_600_000);
  const pickupEnd = new Date(pickupStart.getTime() + 2 * 3_600_000);
  const deliveryStart = new Date(pickupEnd.getTime() + 60 * 60_000);
  const deliveryEnd = new Date(deliveryStart.getTime() + 3 * 3_600_000);
  return {
    pickupStart,
    pickupEnd,
    deliveryStart,
    deliveryEnd,
  };
};

const resolveAccounts = async () => {
  const [driver, learner, supplier] = await Promise.all([
    prisma.user.findUnique({
      where: { email: MAJD_DRIVER_EMAIL },
      select: {
        id: true,
        displayName: true,
        email: true,
        accountStatus: true,
        roles: { select: { role: true, isPrimary: true } },
        driverProfile: {
          select: { id: true, status: true, acceptingNewJobs: true },
        },
      },
    }),
    prisma.user.findUnique({
      where: { email: MAJD_LEARNER_EMAIL },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
        accountStatus: true,
      },
    }),
    prisma.user.findUnique({
      where: { email: MAJD_SUPPLIER_EMAIL },
      select: { id: true, email: true, displayName: true, accountStatus: true },
    }),
  ]);

  if (
    !driver ||
    driver.accountStatus !== 'ACTIVE' ||
    !driver.roles.some((row) => row.role === 'DRIVER') ||
    !driver.driverProfile ||
    driver.driverProfile.status !== 'ACTIVE'
  ) {
    throw new Error(`${MAJD_DRIVER_EMAIL} is not an active driver account.`);
  }
  if (
    !learner ||
    learner.accountStatus !== 'ACTIVE' ||
    !learner.emailVerifiedAt
  ) {
    throw new Error(`${MAJD_LEARNER_EMAIL} is not an active verified learner.`);
  }
  if (!supplier || supplier.accountStatus !== 'ACTIVE') {
    throw new Error(`${MAJD_SUPPLIER_EMAIL} is not an active supplier.`);
  }

  return { driver, learner, supplier };
};

const selectMaterials = async (input: {
  supplierUserId: string;
  learnerId: string;
  count: number;
}) => {
  const rows = await prisma.material.findMany({
    where: {
      ownerId: input.supplierUserId,
      status: 'AVAILABLE',
      deliveryAllowed: true,
      title: { notIn: [...FORBIDDEN_TITLES] },
    },
    select: {
      id: true,
      title: true,
      reservations: {
        where: {
          requesterId: input.learnerId,
          status: { in: [...ACTIVE_HOLD_STATUSES] },
        },
        select: { id: true },
      },
    },
    orderBy: { title: 'asc' },
  });

  const usable = [];
  for (const row of rows) {
    if (row.reservations.length > 0) continue;
    const quantity = await getMaterialQuantityState(prisma, row.id);
    if (!quantity || quantity.availableQuantity.lt(1)) continue;
    usable.push(row);
  }

  const selected: typeof usable = [];
  for (const title of DRIVER_AVAILABLE_JOBS_PREFERRED_TITLES) {
    const match = usable.find((row) => row.title === title);
    if (match && !selected.some((row) => row.id === match.id)) {
      selected.push(match);
    }
    if (selected.length >= input.count) break;
  }
  for (const row of usable) {
    if (selected.length >= input.count) break;
    if (!selected.some((item) => item.id === row.id)) selected.push(row);
  }

  if (selected.length < input.count) {
    throw new Error(
      `Need ${input.count} unused delivery materials for Available Jobs; found ${selected.length}.`,
    );
  }
  return selected.slice(0, input.count);
};

const findWaitingJob = async (scenario: JobScenario) => {
  const reservations = await prisma.reservation.findMany({
    where: {
      fulfillmentMethod: 'DELIVERY',
      OR: [
        { message: { contains: roleMarker(scenario.role) } },
        { deliveryNote: { contains: roleMarker(scenario.role) } },
      ],
      deliveryGroupId: { not: null },
    },
    select: {
      deliveryGroup: {
        select: {
          id: true,
          reservations: { select: { id: true, status: true } },
          delivery: {
            select: {
              id: true,
              status: true,
              assignedDriverProfileId: true,
              pickupLocationId: true,
              dropoffLocationId: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  for (const row of reservations) {
    const group = row.deliveryGroup;
    const delivery = group?.delivery;
    if (
      group &&
      delivery?.status === 'WAITING_FOR_DRIVER' &&
      delivery.assignedDriverProfileId == null &&
      group.reservations.length === scenario.itemCount &&
      group.reservations.every((item) => item.status === 'ACCEPTED')
    ) {
      return { group, delivery };
    }
  }
  return null;
};

const shapeJobForRecording = async (input: {
  scenario: JobScenario;
  groupId: string;
  deliveryId: string;
  pickupLocationId: string;
  dropoffLocationId: string;
}) => {
  const schedule = buildScheduling(input.scenario.pickupHoursFromNow);
  const requestedAt = new Date(
    Date.now() - input.scenario.requestedMinutesAgo * 60_000,
  );

  await prisma.$transaction([
    prisma.location.update({
      where: { id: input.pickupLocationId },
      data: { ...input.scenario.pickup, isApproximate: true },
    }),
    prisma.location.update({
      where: { id: input.dropoffLocationId },
      data: { ...input.scenario.dropoff, isApproximate: true },
    }),
    prisma.deliveryGroup.update({
      where: { id: input.groupId },
      data: {
        dropoffCity: input.scenario.dropoff.city,
        dropoffArea: input.scenario.dropoff.area,
        deliveryAddressText: input.scenario.dropoff.addressLine,
        windowStart: schedule.deliveryStart,
        windowEnd: schedule.deliveryEnd,
      },
    }),
    prisma.reservation.updateMany({
      where: { deliveryGroupId: input.groupId },
      data: {
        supplierPickupWindowStart: schedule.pickupStart,
        supplierPickupWindowEnd: schedule.pickupEnd,
        pickupWindowStart: schedule.pickupStart,
        pickupWindowEnd: schedule.pickupEnd,
        learnerPreferredDeliveryWindows: [
          {
            start: schedule.deliveryStart.toISOString(),
            end: schedule.deliveryEnd.toISOString(),
          },
        ],
        deliveryAddressText: input.scenario.dropoff.addressLine,
        dropoffCity: input.scenario.dropoff.city,
        dropoffArea: input.scenario.dropoff.area,
      },
    }),
    prisma.delivery.update({
      where: { id: input.deliveryId },
      data: { requestedAt },
    }),
  ]);

  return schedule;
};

const createWaitingJob = async (input: {
  scenario: JobScenario;
  learnerId: string;
  supplierUserId: string;
}) => {
  const materials = await selectMaterials({
    supplierUserId: input.supplierUserId,
    learnerId: input.learnerId,
    count: input.scenario.itemCount,
  });
  const schedule = buildScheduling(input.scenario.pickupHoursFromNow);
  const marker = roleMarker(input.scenario.role);
  const createdReservations = [];
  let deliveryGroupId: string | undefined;

  for (let index = 0; index < materials.length; index += 1) {
    const created = await createReservation(input.learnerId, {
      materialId: materials[index]!.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      paymentMethod: 'CASH',
      learnerPreferredDeliveryWindows: [
        {
          start: schedule.deliveryStart.toISOString(),
          end: schedule.deliveryEnd.toISOString(),
        },
      ],
      deliveryAddressText: input.scenario.dropoff.addressLine,
      dropoffCity: input.scenario.dropoff.city,
      dropoffArea: input.scenario.dropoff.area,
      safeDropoffAllowed: false,
      message: `Driver Available Jobs mobile demo (${input.scenario.role}) [${marker}]`,
      deliveryNote: `Recording fixture [${marker}]`,
      ...(deliveryGroupId
        ? { combineWithDeliveryGroupId: deliveryGroupId }
        : {}),
    });
    deliveryGroupId ??= created.deliveryGroupId ?? undefined;
    createdReservations.push(created);
  }

  if (!deliveryGroupId) {
    throw new Error(`Available Jobs ${input.scenario.role} group was not created.`);
  }

  for (const reservation of createdReservations) {
    await acceptSupplierReservation(input.supplierUserId, reservation.id, {
      pickupWindowStart: schedule.pickupStart.toISOString(),
      pickupWindowEnd: schedule.pickupEnd.toISOString(),
      selectedPreferredWindowIndex: 0,
      supplierNote: `Driver jobs recording fixture [${marker}]`,
    });
  }

  const delivery = await prisma.delivery.findUniqueOrThrow({
    where: { deliveryGroupId },
    select: {
      id: true,
      status: true,
      pickupLocationId: true,
      dropoffLocationId: true,
    },
  });
  if (delivery.status !== 'WAITING_FOR_DRIVER') {
    throw new Error(
      `Available Jobs ${input.scenario.role} was created as ${delivery.status}.`,
    );
  }

  return {
    action: 'create' as const,
    groupId: deliveryGroupId,
    delivery,
    materialTitles: materials.map((row) => row.title),
  };
};

const ensureWaitingJob = async (input: {
  scenario: JobScenario;
  learnerId: string;
  supplierUserId: string;
}) => {
  const existing = await findWaitingJob(input.scenario);
  const result = existing
    ? {
        action: 'reuse' as const,
        groupId: existing.group.id,
        delivery: existing.delivery,
        materialTitles: await prisma.reservation
          .findMany({
            where: { deliveryGroupId: existing.group.id },
            select: { material: { select: { title: true } } },
            orderBy: { createdAt: 'asc' },
          })
          .then((rows) => rows.map((row) => row.material.title)),
      }
    : await createWaitingJob(input);

  await shapeJobForRecording({
    scenario: input.scenario,
    groupId: result.groupId,
    deliveryId: result.delivery.id,
    pickupLocationId: result.delivery.pickupLocationId,
    dropoffLocationId: result.delivery.dropoffLocationId,
  });

  return result;
};

const seedDriverReferencePoint = async (input: {
  driverProfileId: string;
  anchorDeliveryId: string;
}) => {
  const recent = await prisma.deliveryLocationPing.findFirst({
    where: {
      driverProfileId: input.driverProfileId,
      capturedAt: { gte: new Date(Date.now() - 60 * 60_000) },
      latitude: DRIVER_REFERENCE.latitude,
      longitude: DRIVER_REFERENCE.longitude,
    },
    orderBy: { capturedAt: 'desc' },
  });
  if (recent) return { action: 'reuse' as const, capturedAt: recent.capturedAt };

  const ping = await prisma.deliveryLocationPing.create({
    data: {
      deliveryId: input.anchorDeliveryId,
      driverProfileId: input.driverProfileId,
      latitude: DRIVER_REFERENCE.latitude,
      longitude: DRIVER_REFERENCE.longitude,
      accuracyMeters: 12,
      capturedAt: new Date(),
    },
  });
  return { action: 'create' as const, capturedAt: ping.capturedAt };
};

export async function prepareDriverAvailableJobsDemo() {
  assertLocalDemoDatabaseUrl(env.databaseUrl, 'driver available-jobs demo prep');
  const { driver, learner, supplier } = await resolveAccounts();

  console.log('\nDriver Available Jobs mobile-demo prep');
  console.log(
    '  ' +
      formatNamedAccount({
        ...driver,
        roles: driver.roles.map((row) =>
          row.isPrimary ? `${row.role}*` : row.role,
        ),
      }),
  );

  await updateDriverAvailability(driver.id, { acceptingNewJobs: true });

  const jobs = [];
  for (const scenario of JOB_SCENARIOS) {
    jobs.push(
      await ensureWaitingJob({
        scenario,
        learnerId: learner.id,
        supplierUserId: supplier.id,
      }),
    );
  }

  const reference = await seedDriverReferencePoint({
    driverProfileId: driver.driverProfile.id,
    anchorDeliveryId: jobs[0]!.delivery.id,
  });
  const all = await listAvailableDeliveries(driver.id, {
    limit: 20,
    sortBy: 'nearest',
  });
  const withinTen = await listAvailableDeliveries(driver.id, {
    limit: 20,
    sortBy: 'nearest',
    maxDistanceKm: 10,
  });
  const demoIds = new Set(jobs.map((row) => row.delivery.id));
  const visibleDemoJobs = all.deliveries.filter((row) => demoIds.has(row.id));
  const nearbyDemoJobs = withinTen.deliveries.filter((row) =>
    demoIds.has(row.id),
  );
  const grouped = visibleDemoJobs.find((row) => row.itemCount >= 2);

  if (
    visibleDemoJobs.length !== JOB_SCENARIOS.length ||
    nearbyDemoJobs.length !== 2 ||
    !grouped ||
    visibleDemoJobs.some((row) => row.distanceKm == null)
  ) {
    throw new Error(
      'Available Jobs demo is not recording-ready: ' +
        JSON.stringify({
          visibleDemoJobs: visibleDemoJobs.length,
          nearbyDemoJobs: nearbyDemoJobs.length,
          groupedItemCount: grouped?.itemCount ?? 0,
          distances: visibleDemoJobs.map((row) => row.distanceKm),
        }),
    );
  }

  console.log('\n=== DRIVER AVAILABLE JOBS READY ===');
  console.log(
    JSON.stringify(
      {
        marker: DRIVER_AVAILABLE_JOBS_DEMO_KEY,
        driver: {
          email: driver.email,
          displayName: driver.displayName,
          acceptingNewJobs: true,
          referenceLocation: DRIVER_REFERENCE,
          referenceAction: reference.action,
        },
        jobs: jobs.map((row, index) => ({
          role: JOB_SCENARIOS[index]!.role,
          action: row.action,
          deliveryId: redact(row.delivery.id),
          items: row.materialTitles,
          pickup: `${JOB_SCENARIOS[index]!.pickup.area}, ${JOB_SCENARIOS[index]!.pickup.city}`,
          distanceKm:
            visibleDemoJobs.find((job) => job.id === row.delivery.id)
              ?.distanceKm ?? null,
        })),
        verification: {
          visibleDemoJobs: visibleDemoJobs.length,
          withinTenKm: nearbyDemoJobs.length,
          groupedItems: grouped.itemCount,
          totalAvailableCount: all.totalAvailableCount,
        },
        page: '/driver/jobs',
        rerun: 'npm run demo:prepare:driver-jobs -w apps/backend',
      },
      null,
      2,
    ),
  );

  return {
    driverUserId: driver.id,
    deliveryIds: jobs.map((row) => row.delivery.id),
    screenshotReady: true as const,
  };
}
