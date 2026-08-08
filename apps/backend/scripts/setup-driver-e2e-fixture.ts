/**
 * DR-05 deterministic Driver E2E fixture.
 *
 * Usage (DATABASE_URL must already point at a disposable DB):
 *   npx tsx scripts/setup-driver-e2e-fixture.ts --reset
 *   npx tsx scripts/setup-driver-e2e-fixture.ts --manifest
 *   npx tsx scripts/setup-driver-e2e-fixture.ts --cleanup
 *
 * Safety:
 * - Refuses database names impactloop / postgres / production-like
 * - Local PostgreSQL only
 * - Does not modify apps/backend/.env
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { resolveNoShowReportIncidentKey } from '../src/modules/no-show-reports/no-show-report.incident-key.js';
import { hashPassword } from '../src/utils/password.js';
import {
  buildDeliveryHandoverCodeData,
} from '../src/utils/handover-codes.js';
import {
  assertDisposableDatabaseName,
  requireLocalDatabaseUrl,
  sourceDatabaseName,
} from './driver-e2e-db.js';

const MARKER = '[dr05-e2e]';
const PASSWORD = 'E2EPassword123!';
const backendRoot = fileURLToPath(new URL('../', import.meta.url));

type ScenarioIds = Record<string, string>;

const args = new Set(process.argv.slice(2));
const wantsReset = args.has('--reset') || args.has('--setup');
const wantsManifest = args.has('--manifest') || wantsReset;
const wantsCleanup = args.has('--cleanup');

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  requireLocalDatabaseUrl(url);
  const name = sourceDatabaseName(url);
  assertDisposableDatabaseName(name);
  return url;
}

function stableId(label: string) {
  return (
    'e2e' +
    createHash('sha1').update(`dr05:${label}`).digest('hex').slice(0, 22)
  );
}

function emailFor(slug: string) {
  return `e2e.${slug}@impactloop.test`;
}

async function createPrisma(url: string) {
  const pool = new Pool({ connectionString: url, max: 5 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool };
}

async function wipeOperationalData(prisma: PrismaClient) {
  // Keep migrations + taxonomy/categories from the template schema.
  const keep = new Set([
    '_prisma_migrations',
    'categories',
    'taxonomy_concepts',
    'taxonomy_edges',
    'material_types',
    'spatial_ref_sys',
  ]);
  await prisma.$executeRawUnsafe(`SET session_replication_role = replica`);
  const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename`,
  );
  for (const { tablename } of tables) {
    if (keep.has(tablename)) continue;
    await prisma.$executeRawUnsafe(`DELETE FROM "${tablename}"`);
  }
  await prisma.$executeRawUnsafe(`SET session_replication_role = DEFAULT`);
}

async function ensureCategory(prisma: PrismaClient) {
  const existing = await prisma.category.findFirst({
    where: { categoryType: { in: ['MATERIAL', 'BOTH'] }, isActive: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Template should always have categories; fail closed if not.
  throw new Error(
    'Disposable DB has no material category. Template clone may be incomplete.',
  );
}

async function createUser(
  prisma: PrismaClient,
  input: {
    slug: string;
    role: 'LEARNER' | 'SUPPLIER' | 'DRIVER' | 'ADMIN';
    displayName: string;
    accountStatus?: 'ACTIVE' | 'DISABLED' | 'SUSPENDED';
    driver?: {
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
      availability?: 'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY';
      acceptingNewJobs?: boolean;
      city?: string;
      area?: string;
    };
  },
) {
  const passwordHash = await hashPassword(PASSWORD);
  const userId = stableId(`user:${input.slug}`);
  const phone = `+97059${createHash('sha1')
    .update(input.slug)
    .digest('hex')
    .slice(0, 6)
    .replace(/[a-f]/g, (c) => String((c.charCodeAt(0) % 10)))}`;

  await prisma.user.create({
    data: {
      id: userId,
      displayName: `${MARKER} ${input.displayName}`,
      email: emailFor(input.slug),
      passwordHash,
      phone,
      accountStatus: input.accountStatus ?? 'ACTIVE',
      emailVerifiedAt: new Date(),
      activeRole: input.role === 'ADMIN' ? 'ADMIN' : input.role,
      roles: {
        create: [{ role: input.role, isPrimary: true }],
      },
      ...(input.role === 'LEARNER'
        ? {
            learnerProfile: {
              create: {
                id: stableId(`learner:${input.slug}`),
                learnerType: 'STUDENT',
                skillLevel: 'BEGINNER',
              },
            },
          }
        : {}),
      ...(input.role === 'SUPPLIER'
        ? {
            supplierProfile: {
              create: {
                id: stableId(`supplier:${input.slug}`),
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${MARKER} ${input.displayName}`,
                verificationStatus: 'VERIFIED',
              },
            },
          }
        : {}),
      ...(input.role === 'DRIVER'
        ? {
            driverProfile: {
              create: {
                id: stableId(`driver:${input.slug}`),
                displayName: `${MARKER} ${input.displayName}`,
                phone,
                city: input.driver?.city ?? 'Ramallah',
                area: input.driver?.area ?? 'Al-Tireh',
                transportationType: 'CAR',
                vehicleType: 'CAR',
                status: input.driver?.status ?? 'ACTIVE',
                availability: input.driver?.availability ?? 'AVAILABLE',
                acceptingNewJobs: input.driver?.acceptingNewJobs ?? true,
              },
            },
          }
        : {}),
    },
  });

  return userId;
}

async function createLocation(
  prisma: PrismaClient,
  input: {
    slug: string;
    city: string;
    area: string;
    latitude: number;
    longitude: number;
    locationType?: 'DELIVERY_PICKUP' | 'DELIVERY_DROPOFF';
  },
) {
  const id = stableId(`loc:${input.slug}`);
  await prisma.location.create({
    data: {
      id,
      country: 'Palestine',
      city: input.city,
      area: input.area,
      addressLine: `${MARKER} ${input.slug}`,
      latitude: input.latitude,
      longitude: input.longitude,
      visibility: 'ORDER_ONLY',
      isApproximate: false,
      locationType: input.locationType ?? 'DELIVERY_PICKUP',
    },
  });
  return id;
}

async function createMaterial(
  prisma: PrismaClient,
  input: {
    slug: string;
    ownerId: string;
    supplierProfileId: string;
    categoryId: string;
    locationId: string;
    quantity?: number;
  },
) {
  const id = stableId(`mat:${input.slug}`);
  await prisma.material.create({
    data: {
      id,
      ownerId: input.ownerId,
      supplierProfileId: input.supplierProfileId,
      categoryId: input.categoryId,
      locationId: input.locationId,
      title: `${MARKER} ${input.slug}`,
      description: `${MARKER} material ${input.slug}`,
      materialType: 'E2E material',
      quantity: input.quantity ?? 3,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'RESERVED',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: true,
    },
  });
  return id;
}

function activeWindows(offsetMinutes = 0) {
  const start = new Date(Date.now() - 20 * 60_000 + offsetMinutes * 60_000);
  const end = new Date(Date.now() + 50 * 60_000 + offsetMinutes * 60_000);
  return { start, end };
}

function expiredWindows() {
  const end = new Date(Date.now() - 40 * 60_000);
  const start = new Date(end.getTime() - 60 * 60_000);
  return { start, end };
}

async function createReservation(
  prisma: PrismaClient,
  input: {
    slug: string;
    materialId: string;
    learnerId: string;
    supplierId: string;
    status?: 'ACCEPTED' | 'AWAITING_RESOLUTION' | 'COMPLETED';
    deliveryGroupId?: string;
    windows?: 'active' | 'expired' | 'future';
    fulfillmentMethod?: 'DELIVERY' | 'PICKUP';
  },
) {
  const id = stableId(`res:${input.slug}`);
  const windows =
    input.windows === 'expired'
      ? expiredWindows()
      : input.windows === 'future'
        ? {
            start: new Date(Date.now() + 40 * 60_000),
            end: new Date(Date.now() + 100 * 60_000),
          }
        : activeWindows();

  await prisma.reservation.create({
    data: {
      id,
      materialId: input.materialId,
      requesterId: input.learnerId,
      ownerId: input.supplierId,
      quantityRequested: 1,
      fulfillmentMethod: input.fulfillmentMethod ?? 'DELIVERY',
      status: input.status ?? 'ACCEPTED',
      deliveryGroupId: input.deliveryGroupId,
      acceptedAt: new Date(),
      pickupWindowStart: windows.start,
      pickupWindowEnd: windows.end,
      supplierPickupWindowStart: windows.start,
      supplierPickupWindowEnd: windows.end,
      confirmedDeliveryWindowStart: windows.start,
      confirmedDeliveryWindowEnd: windows.end,
    },
  });
  return id;
}

async function createDelivery(
  prisma: PrismaClient,
  input: {
    slug: string;
    reservationId: string;
    pickupLocationId: string;
    dropoffLocationId: string;
    requestedByUserId: string;
    status:
      | 'WAITING_FOR_DRIVER'
      | 'DRIVER_ASSIGNED'
      | 'ARRIVED_PICKUP'
      | 'PICKED_UP'
      | 'ON_THE_WAY'
      | 'ARRIVED_DROPOFF'
      | 'DELIVERED'
      | 'FAILED_PICKUP'
      | 'FAILED_DELIVERY'
      | 'AWAITING_RESOLUTION';
    deliveryGroupId?: string;
    assignedDriverProfileId?: string | null;
    requestedAtOffsetMs?: number;
  },
) {
  const id = stableId(`del:${input.slug}`);
  const codes = await buildDeliveryHandoverCodeData(id);
  const requestedAt = new Date(
    Date.now() - (input.requestedAtOffsetMs ?? 0),
  );

  await prisma.delivery.create({
    data: {
      id,
      reservationId: input.reservationId,
      deliveryGroupId: input.deliveryGroupId,
      pickupLocationId: input.pickupLocationId,
      dropoffLocationId: input.dropoffLocationId,
      requestedByUserId: input.requestedByUserId,
      assignedDriverProfileId: input.assignedDriverProfileId ?? null,
      status: input.status,
      requestedAt,
      assignedAt: input.assignedDriverProfileId ? requestedAt : null,
      ...codes.data,
    },
  });

  await prisma.deliveryStatusHistory.create({
    data: {
      id: stableId(`dsh:${input.slug}:create`),
      deliveryId: id,
      oldStatus: null,
      newStatus: input.status,
      changedByUserId: input.requestedByUserId,
      note: `${MARKER} fixture`,
    },
  });

  return id;
}

async function createAssignment(
  prisma: PrismaClient,
  input: {
    slug: string;
    deliveryId: string;
    driverProfileId: string;
    status?: 'ACTIVE' | 'RELEASED';
    releaseReason?: string;
  },
) {
  const id = stableId(`asg:${input.slug}`);
  const released = input.status === 'RELEASED';
  await prisma.deliveryAssignment.create({
    data: {
      id,
      deliveryId: input.deliveryId,
      driverProfileId: input.driverProfileId,
      status: input.status ?? 'ACTIVE',
      acceptedAt: new Date(Date.now() - 60_000),
      releasedAt: released ? new Date() : null,
      releaseReason: input.releaseReason ?? null,
    },
  });
  return id;
}

async function createIncident(
  prisma: PrismaClient,
  input: {
    slug: string;
    reservationId: string;
    deliveryId?: string;
    reporterUserId: string;
    targetUserId?: string;
    targetRole: 'SUPPLIER' | 'LEARNER' | 'DRIVER' | 'SYSTEM';
    reasonCode:
      | 'PICKUP_FAILED'
      | 'DELIVERY_FAILED'
      | 'DRIVER_ISSUE'
      | 'NO_DRIVER_AVAILABLE';
    status?: 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'RESOLVED_NO_STRIKE';
  },
) {
  const id = stableId(`nsr:${input.slug}`);
  await prisma.noShowReport.create({
    data: {
      id,
      incidentKey: resolveNoShowReportIncidentKey({
        reservationId: input.reservationId,
        deliveryId: input.deliveryId,
        targetRole: input.targetRole,
        targetUserId: input.targetUserId,
        reasonCode: input.reasonCode,
        note: `${MARKER} ${input.slug}`,
      }),
      reservationId: input.reservationId,
      deliveryId: input.deliveryId,
      reporterUserId: input.reporterUserId,
      targetUserId: input.targetUserId,
      targetRole: input.targetRole,
      reasonCode: input.reasonCode,
      note: `${MARKER} ${input.slug}`,
      reporterReasonDetail: input.slug,
      status: input.status ?? 'PENDING_REVIEW',
    },
  });
  return id;
}

async function setupFixture(prisma: PrismaClient) {
  await wipeOperationalData(prisma);
  const categoryId = await ensureCategory(prisma);
  const ids: ScenarioIds = { categoryId };

  // Locations with PostGIS geography (trigger syncs from lat/lng).
  ids.locHebronPickup = await createLocation(prisma, {
    slug: 'hebron-pickup',
    city: 'Hebron',
    area: 'University District',
    latitude: 31.5326,
    longitude: 35.0998,
  });
  ids.locRamallahPickup = await createLocation(prisma, {
    slug: 'ramallah-pickup',
    city: 'Ramallah',
    area: 'Al-Tireh',
    latitude: 31.9038,
    longitude: 35.2034,
  });
  ids.locNablusPickup = await createLocation(prisma, {
    slug: 'nablus-pickup',
    city: 'Nablus',
    area: 'Rafidia',
    latitude: 32.2211,
    longitude: 35.2544,
  });
  ids.locDropoff = await createLocation(prisma, {
    slug: 'dropoff-common',
    city: 'Ramallah',
    area: 'City Center',
    latitude: 31.899,
    longitude: 35.204,
    locationType: 'DELIVERY_DROPOFF',
  });
  ids.locNullGeo = await createLocation(prisma, {
    slug: 'null-geo-pickup',
    city: 'Jericho',
    area: 'Center',
    latitude: 31.8667,
    longitude: 35.45,
  });
  // Force null geography presentation case: clear lat/lng after create for one waiting job.
  // Keep a separate location with coords for nearest tests.

  // Core actors
  ids.learnerId = await createUser(prisma, {
    slug: 'learner.main',
    role: 'LEARNER',
    displayName: 'Learner Main',
  });
  ids.supplierId = await createUser(prisma, {
    slug: 'supplier.main',
    role: 'SUPPLIER',
    displayName: 'Supplier Main',
  });
  ids.adminId = await createUser(prisma, {
    slug: 'admin.main',
    role: 'ADMIN',
    displayName: 'Admin Main',
  });

  const supplierProfile = await prisma.supplierProfile.findUniqueOrThrow({
    where: { userId: ids.supplierId },
    select: { id: true },
  });
  ids.supplierProfileId = supplierProfile.id;

  // Drivers
  ids.driverEligibleA = await createUser(prisma, {
    slug: 'driver.eligible.a',
    role: 'DRIVER',
    displayName: 'Eligible A',
    driver: {
      city: 'Hebron',
      area: 'University District',
      acceptingNewJobs: true,
      availability: 'AVAILABLE',
    },
  });
  ids.driverEligibleB = await createUser(prisma, {
    slug: 'driver.eligible.b',
    role: 'DRIVER',
    displayName: 'Eligible B',
    driver: {
      city: 'Ramallah',
      area: 'Al-Tireh',
      acceptingNewJobs: true,
      availability: 'AVAILABLE',
    },
  });
  ids.driverPaused = await createUser(prisma, {
    slug: 'driver.paused',
    role: 'DRIVER',
    displayName: 'Paused',
    driver: {
      acceptingNewJobs: false,
      availability: 'OFFLINE',
      city: 'Ramallah',
      area: 'Al-Tireh',
    },
  });
  ids.driverTwoActive = await createUser(prisma, {
    slug: 'driver.two.active',
    role: 'DRIVER',
    displayName: 'Two Active',
    driver: {
      acceptingNewJobs: true,
      availability: 'ON_DELIVERY',
      city: 'Nablus',
      area: 'Rafidia',
    },
  });
  ids.driverCeiling = await createUser(prisma, {
    slug: 'driver.ceiling',
    role: 'DRIVER',
    displayName: 'Ceiling Three',
    driver: {
      acceptingNewJobs: true,
      availability: 'ON_DELIVERY',
      city: 'Ramallah',
      area: 'Al-Tireh',
    },
  });
  ids.driverInactive = await createUser(prisma, {
    slug: 'driver.inactive',
    role: 'DRIVER',
    displayName: 'Inactive Profile',
    driver: { status: 'INACTIVE', acceptingNewJobs: false, availability: 'OFFLINE' },
  });
  ids.driverSuspended = await createUser(prisma, {
    slug: 'driver.suspended',
    role: 'DRIVER',
    displayName: 'Suspended Profile',
    driver: { status: 'SUSPENDED', acceptingNewJobs: false, availability: 'OFFLINE' },
  });
  ids.driverDisabledUser = await createUser(prisma, {
    slug: 'driver.disabled.user',
    role: 'DRIVER',
    displayName: 'Disabled Account',
    accountStatus: 'DISABLED',
    driver: { acceptingNewJobs: true, availability: 'AVAILABLE' },
  });

  const profileIds = await prisma.driverProfile.findMany({
    where: {
      userId: {
        in: [
          ids.driverEligibleA,
          ids.driverEligibleB,
          ids.driverPaused,
          ids.driverTwoActive,
          ids.driverCeiling,
        ],
      },
    },
    select: { id: true, userId: true },
  });
  const profileByUser = Object.fromEntries(
    profileIds.map((row) => [row.userId, row.id]),
  );
  ids.profileEligibleA = profileByUser[ids.driverEligibleA]!;
  ids.profileEligibleB = profileByUser[ids.driverEligibleB]!;
  ids.profilePaused = profileByUser[ids.driverPaused]!;
  ids.profileTwoActive = profileByUser[ids.driverTwoActive]!;
  ids.profileCeiling = profileByUser[ids.driverCeiling]!;

  // Waiting standalone deliveries (newest/nearest/radius)
  for (const [index, slug] of [
    'wait.near.hebron',
    'wait.near.ramallah',
    'wait.near.nablus',
    'wait.race.target',
    'wait.accept.standalone',
  ].entries()) {
    const pickupId =
      index === 0
        ? ids.locHebronPickup
        : index === 1
          ? ids.locRamallahPickup
          : ids.locNablusPickup;
    const mat = await createMaterial(prisma, {
      slug: `mat.${slug}`,
      ownerId: ids.supplierId,
      supplierProfileId: ids.supplierProfileId,
      categoryId,
      locationId: pickupId,
    });
    const res = await createReservation(prisma, {
      slug: `res.${slug}`,
      materialId: mat,
      learnerId: ids.learnerId,
      supplierId: ids.supplierId,
      windows: 'active',
    });
    const del = await createDelivery(prisma, {
      slug: `del.${slug}`,
      reservationId: res,
      pickupLocationId: pickupId,
      dropoffLocationId: ids.locDropoff,
      requestedByUserId: ids.learnerId,
      status: 'WAITING_FOR_DRIVER',
      requestedAtOffsetMs: (5 - index) * 60_000,
    });
    ids[`mat_${slug.replace(/\./g, '_')}`] = mat;
    ids[`res_${slug.replace(/\./g, '_')}`] = res;
    ids[`del_${slug.replace(/\./g, '_')}`] = del;
  }

  // Waiting grouped delivery (3 reservations)
  const groupId = stableId('group:waiting.triple');
  await prisma.deliveryGroup.create({
    data: {
      id: groupId,
      learnerId: ids.learnerId,
      supplierProfileId: ids.supplierProfileId,
      dropoffCity: 'Ramallah',
      deliveryFee: 10,
      deliveryZone: 'SAME_CITY',
      status: 'OPEN',
      windowStart: activeWindows().start,
      windowEnd: activeWindows().end,
    },
  });
  ids.groupWaitingTriple = groupId;

  const groupReservationIds: string[] = [];
  for (const suffix of ['a', 'b', 'c']) {
    const mat = await createMaterial(prisma, {
      slug: `group.wait.${suffix}`,
      ownerId: ids.supplierId,
      supplierProfileId: ids.supplierProfileId,
      categoryId,
      locationId: ids.locRamallahPickup,
    });
    const res = await createReservation(prisma, {
      slug: `group.wait.${suffix}`,
      materialId: mat,
      learnerId: ids.learnerId,
      supplierId: ids.supplierId,
      deliveryGroupId: groupId,
      windows: 'active',
    });
    groupReservationIds.push(res);
    ids[`res_group_wait_${suffix}`] = res;
    ids[`mat_group_wait_${suffix}`] = mat;
  }

  // Primary reservation owns the delivery row for the group.
  ids.delGroupedWaiting = await createDelivery(prisma, {
    slug: 'del.group.waiting',
    reservationId: groupReservationIds[0]!,
    pickupLocationId: ids.locRamallahPickup,
    dropoffLocationId: ids.locDropoff,
    requestedByUserId: ids.learnerId,
    status: 'WAITING_FOR_DRIVER',
    deliveryGroupId: groupId,
    requestedAtOffsetMs: 10_000,
  });

  // Link sibling reservations to the same operational delivery via group only
  // (schema: one delivery per group unique). Members share deliveryGroupId.

  // Driver with two active assignments
  for (const [i, slug] of ['two.active.1', 'two.active.2'].entries()) {
    const mat = await createMaterial(prisma, {
      slug: `mat.${slug}`,
      ownerId: ids.supplierId,
      supplierProfileId: ids.supplierProfileId,
      categoryId,
      locationId: ids.locNablusPickup,
    });
    const res = await createReservation(prisma, {
      slug: `res.${slug}`,
      materialId: mat,
      learnerId: ids.learnerId,
      supplierId: ids.supplierId,
    });
    const del = await createDelivery(prisma, {
      slug: `del.${slug}`,
      reservationId: res,
      pickupLocationId: ids.locNablusPickup,
      dropoffLocationId: ids.locDropoff,
      requestedByUserId: ids.learnerId,
      status: i === 0 ? 'PICKED_UP' : 'ON_THE_WAY',
      assignedDriverProfileId: ids.profileTwoActive,
    });
    await createAssignment(prisma, {
      slug: `asg.${slug}`,
      deliveryId: del,
      driverProfileId: ids.profileTwoActive,
    });
    ids[`del_${slug.replace(/\./g, '_')}`] = del;
  }

  // Driver at ceiling (3 active)
  for (const i of [1, 2, 3]) {
    const slug = `ceiling.${i}`;
    const mat = await createMaterial(prisma, {
      slug: `mat.${slug}`,
      ownerId: ids.supplierId,
      supplierProfileId: ids.supplierProfileId,
      categoryId,
      locationId: ids.locRamallahPickup,
    });
    const res = await createReservation(prisma, {
      slug: `res.${slug}`,
      materialId: mat,
      learnerId: ids.learnerId,
      supplierId: ids.supplierId,
    });
    const del = await createDelivery(prisma, {
      slug: `del.${slug}`,
      reservationId: res,
      pickupLocationId: ids.locRamallahPickup,
      dropoffLocationId: ids.locDropoff,
      requestedByUserId: ids.learnerId,
      status: 'DRIVER_ASSIGNED',
      assignedDriverProfileId: ids.profileCeiling,
    });
    await createAssignment(prisma, {
      slug: `asg.${slug}`,
      deliveryId: del,
      driverProfileId: ids.profileCeiling,
    });
    ids[`del_ceiling_${i}`] = del;
  }

  // Pickup-failure and delivery-failure fixtures are created dynamically in
  // driver-e2e-lifecycle tests (accept + expire windows) so Eligible A/B start
  // with zero active assignments for availability/accept matrix coverage.

  // Admin recovery / reopen fixture (assigned, pre-pickup) on paused driver.
  {
    const mat = await createMaterial(prisma, {
      slug: 'mat.admin.reopen',
      ownerId: ids.supplierId,
      supplierProfileId: ids.supplierProfileId,
      categoryId,
      locationId: ids.locHebronPickup,
    });
    const res = await createReservation(prisma, {
      slug: 'res.admin.reopen',
      materialId: mat,
      learnerId: ids.learnerId,
      supplierId: ids.supplierId,
    });
    await prisma.driverProfile.update({
      where: { id: ids.profilePaused },
      data: { availability: 'ON_DELIVERY', acceptingNewJobs: false },
    });
    const del = await createDelivery(prisma, {
      slug: 'del.admin.reopen',
      reservationId: res,
      pickupLocationId: ids.locHebronPickup,
      dropoffLocationId: ids.locDropoff,
      requestedByUserId: ids.learnerId,
      status: 'DRIVER_ASSIGNED',
      assignedDriverProfileId: ids.profilePaused,
    });
    await createAssignment(prisma, {
      slug: 'asg.admin.reopen',
      deliveryId: del,
      driverProfileId: ids.profilePaused,
    });
    ids.delAdminReopen = del;
    ids.resAdminReopen = res;
  }

  // History: completed delivery for Eligible A (also create released assignment)
  {
    const mat = await createMaterial(prisma, {
      slug: 'mat.history.completed',
      ownerId: ids.supplierId,
      supplierProfileId: ids.supplierProfileId,
      categoryId,
      locationId: ids.locHebronPickup,
    });
    const res = await createReservation(prisma, {
      slug: 'res.history.completed',
      materialId: mat,
      learnerId: ids.learnerId,
      supplierId: ids.supplierId,
      status: 'COMPLETED',
    });
    const del = await createDelivery(prisma, {
      slug: 'del.history.completed',
      reservationId: res,
      pickupLocationId: ids.locHebronPickup,
      dropoffLocationId: ids.locDropoff,
      requestedByUserId: ids.learnerId,
      status: 'DELIVERED',
      assignedDriverProfileId: null,
    });
    await createAssignment(prisma, {
      slug: 'asg.history.completed',
      deliveryId: del,
      driverProfileId: ids.profileEligibleA,
      status: 'RELEASED',
      releaseReason: 'COMPLETED',
    });
    await prisma.deliveryPickupItem.create({
      data: {
        id: stableId('dpi:history.completed'),
        deliveryId: del,
        reservationId: res,
        materialId: mat,
        materialTitle: `${MARKER} mat.history.completed`,
        quantity: 1,
        unit: 'piece',
        wasPicked: true,
      },
    });
    ids.delHistoryCompleted = del;
  }

  // History: released to pool / reassigned outcome
  {
    const mat = await createMaterial(prisma, {
      slug: 'mat.history.released',
      ownerId: ids.supplierId,
      supplierProfileId: ids.supplierProfileId,
      categoryId,
      locationId: ids.locRamallahPickup,
    });
    const res = await createReservation(prisma, {
      slug: 'res.history.released',
      materialId: mat,
      learnerId: ids.learnerId,
      supplierId: ids.supplierId,
    });
    const del = await createDelivery(prisma, {
      slug: 'del.history.released',
      reservationId: res,
      pickupLocationId: ids.locRamallahPickup,
      dropoffLocationId: ids.locDropoff,
      requestedByUserId: ids.learnerId,
      status: 'WAITING_FOR_DRIVER',
      assignedDriverProfileId: null,
    });
    await createAssignment(prisma, {
      slug: 'asg.history.released',
      deliveryId: del,
      driverProfileId: ids.profileEligibleB,
      status: 'RELEASED',
      releaseReason: 'Admin reopened delivery to driver pool',
    });
    ids.delHistoryReleased = del;
  }

  // History: moved to admin review + reporter-owned incident
  {
    const mat = await createMaterial(prisma, {
      slug: 'mat.history.admin.review',
      ownerId: ids.supplierId,
      supplierProfileId: ids.supplierProfileId,
      categoryId,
      locationId: ids.locNablusPickup,
    });
    const res = await createReservation(prisma, {
      slug: 'res.history.admin.review',
      materialId: mat,
      learnerId: ids.learnerId,
      supplierId: ids.supplierId,
      status: 'AWAITING_RESOLUTION',
    });
    const del = await createDelivery(prisma, {
      slug: 'del.history.admin.review',
      reservationId: res,
      pickupLocationId: ids.locNablusPickup,
      dropoffLocationId: ids.locDropoff,
      requestedByUserId: ids.learnerId,
      status: 'AWAITING_RESOLUTION',
      assignedDriverProfileId: null,
    });
    await createAssignment(prisma, {
      slug: 'asg.history.admin.review',
      deliveryId: del,
      driverProfileId: ids.profileEligibleA,
      status: 'RELEASED',
      releaseReason: 'MOVED_TO_ADMIN_REVIEW',
    });
    ids.incidentReporterOwned = await createIncident(prisma, {
      slug: 'incident.reporter.owned',
      reservationId: res,
      deliveryId: del,
      reporterUserId: ids.driverEligibleA,
      targetUserId: ids.supplierId,
      targetRole: 'SUPPLIER',
      reasonCode: 'PICKUP_FAILED',
    });
    ids.delHistoryAdminReview = del;
    ids.resHistoryAdminReview = res;
  }

  // Partial-pickup history evidence (carried + unpicked)
  {
    const groupIdPartial = stableId('group:history.partial');
    await prisma.deliveryGroup.create({
      data: {
        id: groupIdPartial,
        learnerId: ids.learnerId,
        supplierProfileId: ids.supplierProfileId,
        dropoffCity: 'Ramallah',
      deliveryFee: 8,
      deliveryZone: 'SAME_CITY',
      status: 'COMPLETED',
        windowStart: activeWindows().start,
        windowEnd: activeWindows().end,
      },
    });
    const matA = await createMaterial(prisma, {
      slug: 'mat.partial.carried',
      ownerId: ids.supplierId,
      supplierProfileId: ids.supplierProfileId,
      categoryId,
      locationId: ids.locRamallahPickup,
    });
    const matB = await createMaterial(prisma, {
      slug: 'mat.partial.unpicked',
      ownerId: ids.supplierId,
      supplierProfileId: ids.supplierProfileId,
      categoryId,
      locationId: ids.locRamallahPickup,
    });
    const resA = await createReservation(prisma, {
      slug: 'res.partial.carried',
      materialId: matA,
      learnerId: ids.learnerId,
      supplierId: ids.supplierId,
      deliveryGroupId: groupIdPartial,
      status: 'COMPLETED',
    });
    const resB = await createReservation(prisma, {
      slug: 'res.partial.unpicked',
      materialId: matB,
      learnerId: ids.learnerId,
      supplierId: ids.supplierId,
      deliveryGroupId: groupIdPartial,
      status: 'AWAITING_SUPPLIER_CONFIRMATION',
    });
    const del = await createDelivery(prisma, {
      slug: 'del.history.partial',
      reservationId: resA,
      pickupLocationId: ids.locRamallahPickup,
      dropoffLocationId: ids.locDropoff,
      requestedByUserId: ids.learnerId,
      status: 'DELIVERED',
      deliveryGroupId: groupIdPartial,
    });
    await createAssignment(prisma, {
      slug: 'asg.history.partial',
      deliveryId: del,
      driverProfileId: ids.profileEligibleB,
      status: 'RELEASED',
      releaseReason: 'COMPLETED',
    });
    await prisma.deliveryPickupItem.createMany({
      data: [
        {
          id: stableId('dpi:partial.carried'),
          deliveryId: del,
          reservationId: resA,
          materialId: matA,
          materialTitle: `${MARKER} mat.partial.carried`,
          quantity: 1,
          unit: 'piece',
          wasPicked: true,
        },
        {
          id: stableId('dpi:partial.unpicked'),
          deliveryId: del,
          reservationId: resB,
          materialId: matB,
          materialTitle: `${MARKER} mat.partial.unpicked`,
          quantity: 1,
          unit: 'piece',
          wasPicked: false,
          unpickedReason: 'MATERIAL_NOT_READY',
          driverNote: 'Not ready at supplier',
        },
      ],
    });
    ids.delHistoryPartial = del;
    ids.groupHistoryPartial = groupIdPartial;
  }

  // Verify geography sync for keyed pickups
  const geo = await prisma.$queryRawUnsafe<
    Array<{ id: string; has_geog: boolean }>
  >(
    `SELECT id::text AS id, (location IS NOT NULL) AS has_geog
     FROM locations
     WHERE id = ANY($1::text[])`,
    [ids.locHebronPickup, ids.locRamallahPickup, ids.locNablusPickup],
  );
  assert.ok(geo.every((row) => row.has_geog), 'PostGIS geography sync failed');

  return ids;
}

async function buildManifest(prisma: PrismaClient, ids: ScenarioIds) {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: 'e2e.' } },
    select: {
      id: true,
      email: true,
      accountStatus: true,
      activeRole: true,
      roles: { select: { role: true } },
      driverProfile: {
        select: {
          id: true,
          status: true,
          availability: true,
          acceptingNewJobs: true,
          city: true,
          area: true,
        },
      },
    },
    orderBy: { email: 'asc' },
  });

  const waiting = await prisma.delivery.count({
    where: { status: 'WAITING_FOR_DRIVER', assignedDriverProfileId: null },
  });
  const groupedWaiting = await prisma.delivery.count({
    where: {
      status: 'WAITING_FOR_DRIVER',
      deliveryGroupId: { not: null },
    },
  });
  const incidents = await prisma.noShowReport.count();
  const notifications = await prisma.notification.count();
  const pickupItems = await prisma.deliveryPickupItem.count();
  const assignments = await prisma.deliveryAssignment.groupBy({
    by: ['status'],
    _count: true,
  });

  return {
    marker: MARKER,
    password: PASSWORD,
    accounts: users.map((user) => ({
      email: user.email,
      roles: user.roles.map((role) => role.role),
      accountStatus: user.accountStatus,
      driver: user.driverProfile,
    })),
    counts: {
      waitingDeliveries: waiting,
      groupedWaitingDeliveries: groupedWaiting,
      incidents,
      notifications,
      pickupItems,
      assignments,
    },
    scenarioIds: ids,
  };
}

async function main() {
  const url = databaseUrl();
  const dbName = sourceDatabaseName(url);
  console.log(`Fixture target database: ${dbName}`);

  const { prisma, pool } = await createPrisma(url);
  try {
    if (wantsCleanup && !wantsReset) {
      await wipeOperationalData(prisma);
      console.log('Cleanup complete (operational rows wiped).');
      return;
    }

    if (!wantsReset && !wantsManifest) {
      console.log(
        'Pass --reset to load fixture, --manifest to print current state, or --cleanup to wipe.',
      );
      return;
    }

    let ids: ScenarioIds = {};
    if (wantsReset) {
      ids = await setupFixture(prisma);
      const manifestPath = join(backendRoot, '.driver-e2e-fixture-manifest.json');
      const manifest = await buildManifest(prisma, ids);
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      console.log(`Wrote ${manifestPath}`);
      console.log(JSON.stringify(manifest, null, 2));
    } else if (wantsManifest) {
      const manifest = await buildManifest(prisma, ids);
      console.log(JSON.stringify(manifest, null, 2));
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
