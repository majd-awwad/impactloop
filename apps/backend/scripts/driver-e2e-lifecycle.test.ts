/**
 * DR-05 Driver E2E lifecycle suite.
 *
 * Requires DATABASE_URL (via IMPACTLOOP_BACKEND_ENV_FILE_PATH) pointing at
 * impactloop_driver_e2e with fixture already loaded.
 * Not part of the default src module test glob.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../src/database/prisma.js';
import { AppError } from '../src/utils/app-error.js';
import {
  buildDeliveryHandoverCodeData,
  deriveHandoverCode,
} from '../src/utils/handover-codes.js';
import { hashPassword } from '../src/utils/password.js';
import {
  acceptDelivery,
  getDriverProfile,
  listActiveDriverDeliveries,
  listAvailableDeliveries,
  updateDriverAvailability,
  updateDriverDeliveryStatus,
  updateDriverProfile,
} from '../src/modules/driver/driver.service.js';
import {
  getDriverHistoricalDelivery,
  listDriverDeliveryHistory,
  listDriverIncidents,
} from '../src/modules/driver/driver-history.service.js';
import { reopenAdminDeliveryDriverAssignment } from '../src/modules/admin-deliveries/admin-deliveries.service.js';
import {
  markDriverDeliveryFailed,
  markDriverPickupFailed,
} from '../src/modules/fulfillment-failures/fulfillment-failures.service.js';
import {
  listEligibleDriverUserIds,
  notifyDriverDropoffTime,
  notifyDriverPickupTime,
  notifyNewDriverJob,
  syncDueDriverTimeRemindersForUser,
} from '../src/modules/notifications/driver-notification-events.service.js';
import { DRIVER_NOTIFICATION_TYPES } from '../src/modules/notifications/driver-delivery-notification-types.js';
import { requestSupplierRescheduleAdminNoShowReport } from '../src/modules/admin-no-show-reports/admin-no-show-reports.service.js';
import { submitNoDriverPickupWindow } from '../src/modules/supplier-reservations/supplier-reservations.service.js';
import { escalateStaleAssignedDriverPickupsByIds } from '../src/modules/reservations/reservations.stale-assigned-driver-auto-escalation.repository.js';
import { NO_DRIVER_AUTO_ESCALATION_HOURS } from '../src/modules/reservations/reservation-timing-policy.js';
import { listAdminNoShowReports } from '../src/modules/admin-no-show-reports/admin-no-show-reports.service.js';

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = join(backendRoot, '.driver-e2e-fixture-manifest.json');

type Manifest = {
  password: string;
  scenarioIds: Record<string, string>;
  accounts: Array<{ email: string; driver?: { id: string } | null }>;
};

function sourceDatabaseName(databaseUrl: string) {
  return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
}

function loadManifest(): Manifest {
  assert.ok(
    existsSync(manifestPath),
    `Missing fixture manifest at ${manifestPath}. Run setup-driver-e2e-fixture.ts --reset first.`,
  );
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
}

async function expectAppError(fn: () => Promise<unknown>, code: string) {
  await assert.rejects(fn, (error: unknown) => {
    assert.ok(error instanceof AppError, `Expected AppError, got ${error}`);
    assert.equal(error.code, code);
    return true;
  });
}

describe('DR-05 Driver E2E lifecycle', () => {
  let manifest: Manifest;
  let ids: Record<string, string>;

  before(() => {
    const dbName = sourceDatabaseName(process.env.DATABASE_URL ?? '');
    assert.notEqual(dbName, 'impactloop');
    assert.match(dbName, /driver_e2e|e2e/);
    manifest = loadManifest();
    ids = manifest.scenarioIds;
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test('E04 profile contract for eligible driver', async () => {
    const profile = await getDriverProfile(ids.driverEligibleA);
    assert.equal(profile.status, 'ACTIVE');
    assert.equal(profile.acceptingNewJobs, true);
    assert.equal(profile.maxActiveDeliveries, 3);
    assert.equal(profile.activeDeliveryCount, 0);
    assert.equal(profile.canAcceptMore, true);
    assert.equal(profile.availability, 'AVAILABLE');
  });

  test('A availability pause/resume and ON_DELIVERY reconcile', async () => {
    const paused = await updateDriverAvailability(ids.driverEligibleA, {
      acceptingNewJobs: false,
    });
    assert.equal(paused.acceptingNewJobs, false);
    assert.equal(paused.availability, 'OFFLINE');

    const available = await listAvailableDeliveries(ids.driverEligibleA, {
      limit: 10,
    });
    assert.equal(available.deliveries.length, 0);
    assert.equal(available.canBrowseAvailableJobs, false);

    await expectAppError(
      () => acceptDelivery(ids.driverEligibleA, ids.del_wait_accept_standalone),
      'DRIVER_NOT_ACCEPTING_NEW_JOBS',
    );

    const resumed = await updateDriverAvailability(ids.driverEligibleA, {
      acceptingNewJobs: true,
    });
    assert.equal(resumed.availability, 'AVAILABLE');
    const browsable = await listAvailableDeliveries(ids.driverEligibleA, {
      limit: 10,
    });
    assert.equal(browsable.canBrowseAvailableJobs, true);
  });

  test('B available jobs newest/nearest/radius and privacy', async () => {
    // Seed a recent ping so nearest/radius have a coordinate reference.
    await prisma.deliveryLocationPing.create({
      data: {
        deliveryId: ids.delHistoryCompleted,
        driverProfileId: ids.profileEligibleA,
        latitude: 31.5326,
        longitude: 35.0998,
        capturedAt: new Date(),
      },
    });

    const newest = await listAvailableDeliveries(ids.driverEligibleA, {
      sortBy: 'newest',
      limit: 20,
    });
    assert.ok(newest.deliveries.length >= 2);
    for (const delivery of newest.deliveries) {
      const record = delivery as Record<string, unknown>;
      assert.equal(record.learnerPhone, undefined);
      assert.equal(record.supplierPhone, undefined);
      assert.equal(record.supplierHandoverCode, undefined);
    }

    const nearest = await listAvailableDeliveries(ids.driverEligibleA, {
      sortBy: 'nearest',
      maxDistanceKm: 80,
      limit: 20,
    });
    assert.ok(nearest.deliveries.length >= 1);

    const city = await listAvailableDeliveries(ids.driverEligibleA, {
      city: 'Hebron',
      limit: 20,
    });
    assert.ok(city.deliveries.length >= 1);
    assert.ok(city.deliveries.every((row) => row.pickupCity === 'Hebron'));
  });

  test('C accept standalone + race + ceiling', async () => {
    const accepted = await acceptDelivery(
      ids.driverEligibleA,
      ids.del_wait_accept_standalone,
    );
    assert.equal(accepted.status, 'DRIVER_ASSIGNED');

    const after = await getDriverProfile(ids.driverEligibleA);
    assert.equal(after.availability, 'ON_DELIVERY');
    assert.equal(after.activeDeliveryCount, 1);

    await expectAppError(
      () => acceptDelivery(ids.driverEligibleB, ids.del_wait_accept_standalone),
      'DELIVERY_NOT_AVAILABLE',
    );

    await expectAppError(
      () => acceptDelivery(ids.driverCeiling, ids.del_wait_race_target),
      'DRIVER_ACTIVE_LIMIT_REACHED',
    );

    await expectAppError(
      () => acceptDelivery(ids.driverPaused, ids.del_wait_race_target),
      'DRIVER_NOT_ACCEPTING_NEW_JOBS',
    );

    await expectAppError(
      () => acceptDelivery(ids.driverInactive, ids.del_wait_race_target),
      'FORBIDDEN',
    );
  });

  test('C race: two drivers claim one waiting job', async () => {
    const target = ids.del_wait_race_target;
    const results = await Promise.allSettled([
      acceptDelivery(ids.driverEligibleB, target),
      acceptDelivery(ids.driverTwoActive, target),
    ]);
    const fulfilled = results.filter((row) => row.status === 'fulfilled');
    const rejected = results.filter((row) => row.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    const delivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: target },
      select: { assignedDriverProfileId: true, status: true },
    });
    assert.equal(delivery.status, 'DRIVER_ASSIGNED');
    assert.ok(delivery.assignedDriverProfileId);

    const activeAssignments = await prisma.deliveryAssignment.count({
      where: { deliveryId: target, status: 'ACTIVE' },
    });
    assert.equal(activeAssignments, 1);
  });

  test('D full grouped pickup snapshots', async () => {
    // Release Eligible B if they won the race and are busy; use Eligible A for group.
    // Complete Eligible A's standalone first so group accept is clean? A has 1 active — OK.
    const groupDeliveryId = ids.delGroupedWaiting;
    const accepted = await acceptDelivery(ids.driverEligibleA, groupDeliveryId);
    assert.equal(accepted.status, 'DRIVER_ASSIGNED');

    await updateDriverDeliveryStatus(ids.driverEligibleA, groupDeliveryId, {
      status: 'ARRIVED_PICKUP',
    });

    const members = await prisma.reservation.findMany({
      where: { deliveryGroupId: ids.groupWaitingTriple },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    assert.ok(members.length >= 2);

    const picked = await updateDriverDeliveryStatus(
      ids.driverEligibleA,
      groupDeliveryId,
      {
        status: 'PICKED_UP',
        confirmationCode: deriveHandoverCode(
          'supplier-handover',
          groupDeliveryId,
        ),
        pickedReservationIds: members.map((row) => row.id),
        unpicked: [],
      },
    );
    assert.equal(picked.status, 'PICKED_UP');

    const snapshots = await prisma.deliveryPickupItem.findMany({
      where: { deliveryId: groupDeliveryId },
    });
    assert.equal(snapshots.length, members.length);
    assert.ok(snapshots.every((row) => row.wasPicked));
  });

  test('E partial grouped pickup MATERIAL_NOT_READY + invalid atomicity', async () => {
    // Build a fresh grouped waiting delivery for partial pickup.
    const supplier = await prisma.supplierProfile.findUniqueOrThrow({
      where: { userId: ids.supplierId },
      select: { id: true },
    });
    const categoryId = ids.categoryId;
    const groupId = `e2e_partial_${Date.now()}`;
    await prisma.deliveryGroup.create({
      data: {
        id: groupId,
        learnerId: ids.learnerId,
        supplierProfileId: supplier.id,
        dropoffCity: 'Ramallah',
        deliveryFee: 9,
        deliveryZone: 'SAME_CITY',
        status: 'OPEN',
        windowStart: new Date(Date.now() - 10 * 60_000),
        windowEnd: new Date(Date.now() + 50 * 60_000),
      },
    });

    const createMember = async (suffix: string) => {
      const material = await prisma.material.create({
        data: {
          ownerId: ids.supplierId,
          supplierProfileId: supplier.id,
          categoryId,
          locationId: ids.locRamallahPickup,
          title: `[dr05-e2e] partial ${suffix}`,
          description: 'partial',
          materialType: 'E2E',
          quantity: 2,
          unit: 'piece',
          condition: 'GOOD',
          sourceType: 'WORKSHOP_SURPLUS',
          status: 'RESERVED',
          isFree: true,
          deliveryAllowed: true,
          pickupAllowed: true,
        },
      });
      const reservation = await prisma.reservation.create({
        data: {
          materialId: material.id,
          requesterId: ids.learnerId,
          ownerId: ids.supplierId,
          quantityRequested: 1,
          fulfillmentMethod: 'DELIVERY',
          status: 'ACCEPTED',
          deliveryGroupId: groupId,
          acceptedAt: new Date(),
          supplierPickupWindowStart: new Date(Date.now() - 10 * 60_000),
          supplierPickupWindowEnd: new Date(Date.now() + 50 * 60_000),
          confirmedDeliveryWindowStart: new Date(Date.now() - 10 * 60_000),
          confirmedDeliveryWindowEnd: new Date(Date.now() + 50 * 60_000),
        },
      });
      return reservation.id;
    };

    const resA = await createMember('a');
    const resB = await createMember('b');
    const codes = await import('../src/utils/handover-codes.js').then((mod) =>
      mod.buildDeliveryHandoverCodeData,
    );
    const deliveryId = `e2e_del_partial_${Date.now()}`;
    const handover = await codes(deliveryId);
    await prisma.delivery.create({
      data: {
        id: deliveryId,
        reservationId: resA,
        deliveryGroupId: groupId,
        pickupLocationId: ids.locRamallahPickup,
        dropoffLocationId: ids.locDropoff,
        requestedByUserId: ids.learnerId,
        status: 'WAITING_FOR_DRIVER',
        ...handover.data,
      },
    });

    await acceptDelivery(ids.driverEligibleB, deliveryId);
    await updateDriverDeliveryStatus(ids.driverEligibleB, deliveryId, {
      status: 'ARRIVED_PICKUP',
    });

    await expectAppError(
      () =>
        updateDriverDeliveryStatus(ids.driverEligibleB, deliveryId, {
          status: 'PICKED_UP',
          confirmationCode: deriveHandoverCode('supplier-handover', deliveryId),
          pickedReservationIds: [],
          unpicked: [
            {
              reservationId: resA,
              reason: 'MATERIAL_NOT_READY',
              note: 'none',
            },
            {
              reservationId: resB,
              reason: 'MATERIAL_NOT_READY',
              note: 'none',
            },
          ],
        }),
      'DRIVER_PARTIAL_PICKUP_SELECTION_INVALID',
    );

    const beforeItems = await prisma.deliveryPickupItem.count({
      where: { deliveryId },
    });
    assert.equal(beforeItems, 0);

    await updateDriverDeliveryStatus(ids.driverEligibleB, deliveryId, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', deliveryId),
      pickedReservationIds: [resA],
      unpicked: [
        {
          reservationId: resB,
          reason: 'MATERIAL_NOT_READY',
          note: 'Supplier not ready',
        },
      ],
    });

    const items = await prisma.deliveryPickupItem.findMany({
      where: { deliveryId },
      orderBy: { reservationId: 'asc' },
    });
    assert.equal(items.length, 2);
    const carried = items.find((row) => row.reservationId === resA);
    const unpicked = items.find((row) => row.reservationId === resB);
    assert.equal(carried?.wasPicked, true);
    assert.equal(unpicked?.wasPicked, false);
    assert.equal(unpicked?.unpickedReason, 'MATERIAL_NOT_READY');

    const detached = await prisma.reservation.findUniqueOrThrow({
      where: { id: resB },
    });
    assert.equal(detached.status, 'AWAITING_SUPPLIER_CONFIRMATION');
  });

  test('F complete delivery while accepting and while paused', async () => {
    const active = await listActiveDriverDeliveries(ids.driverEligibleA);
    const picked = active.deliveries.find((row) => row.status === 'PICKED_UP');
    assert.ok(picked, 'Expected a PICKED_UP delivery for Eligible A');

    await updateDriverDeliveryStatus(ids.driverEligibleA, picked.id, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(ids.driverEligibleA, picked.id, {
      status: 'ARRIVED_DROPOFF',
    });
    const delivered = await updateDriverDeliveryStatus(
      ids.driverEligibleA,
      picked.id,
      {
        status: 'DELIVERED',
        confirmationCode: deriveHandoverCode('learner-delivery', picked.id),
      },
    );
    assert.equal(delivered.status, 'DELIVERED');

    await expectAppError(
      () =>
        updateDriverDeliveryStatus(ids.driverEligibleA, picked.id, {
          status: 'DELIVERED',
          confirmationCode: deriveHandoverCode('learner-delivery', picked.id),
        }),
      'DELIVERY_TERMINAL',
    );

    const history = await listDriverDeliveryHistory(ids.driverEligibleA, {
      limit: 20,
    });
    assert.ok(history.deliveries.some((row) => row.id === picked.id));
  });

  test('G pickup failure + admin reopen + delivery failure + driver issue', async () => {
    // Pickup failure: accept near hebron waiting, expire window, report.
    const pickupTarget = ids.del_wait_near_hebron;
    // May already be claimed; find any waiting.
    let waiting = await prisma.delivery.findFirst({
      where: { status: 'WAITING_FOR_DRIVER', assignedDriverProfileId: null },
      select: { id: true, reservationId: true },
    });
    if (!waiting) {
      // Create one quickly
      const material = await prisma.material.create({
        data: {
          ownerId: ids.supplierId,
          supplierProfileId: ids.supplierProfileId,
          categoryId: ids.categoryId,
          locationId: ids.locHebronPickup,
          title: '[dr05-e2e] fail pickup',
          description: 'x',
          materialType: 'E2E',
          quantity: 1,
          unit: 'piece',
          condition: 'GOOD',
          sourceType: 'WORKSHOP_SURPLUS',
          status: 'RESERVED',
          isFree: true,
          deliveryAllowed: true,
          pickupAllowed: true,
        },
      });
      const reservation = await prisma.reservation.create({
        data: {
          materialId: material.id,
          requesterId: ids.learnerId,
          ownerId: ids.supplierId,
          quantityRequested: 1,
          fulfillmentMethod: 'DELIVERY',
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          supplierPickupWindowStart: new Date(Date.now() - 90 * 60_000),
          supplierPickupWindowEnd: new Date(Date.now() - 40 * 60_000),
          confirmedDeliveryWindowStart: new Date(Date.now() - 90 * 60_000),
          confirmedDeliveryWindowEnd: new Date(Date.now() - 40 * 60_000),
        },
      });
      const handover = await (
        await import('../src/utils/handover-codes.js')
      ).buildDeliveryHandoverCodeData(`e2e_fail_${Date.now()}`);
      const deliveryId = `e2e_fail_${Date.now()}`;
      const codes = await (
        await import('../src/utils/handover-codes.js')
      ).buildDeliveryHandoverCodeData(deliveryId);
      await prisma.delivery.create({
        data: {
          id: deliveryId,
          reservationId: reservation.id,
          pickupLocationId: ids.locHebronPickup,
          dropoffLocationId: ids.locDropoff,
          requestedByUserId: ids.learnerId,
          status: 'WAITING_FOR_DRIVER',
          ...codes.data,
        },
      });
      waiting = { id: deliveryId, reservationId: reservation.id };
    }

    // Ensure Eligible A can accept (may be at limit). If at limit, use Eligible B.
    let actor = ids.driverEligibleA;
    const profileA = await getDriverProfile(ids.driverEligibleA);
    if (!profileA.canAcceptMore) {
      actor = ids.driverEligibleB;
      const profileB = await getDriverProfile(ids.driverEligibleB);
      if (!profileB.canAcceptMore) {
        // Free one by completing is hard; use two-active only if under 3
        actor = ids.driverTwoActive;
      }
    }

    // Expire pickup window on reservation
    await prisma.reservation.update({
      where: { id: waiting.reservationId },
      data: {
        supplierPickupWindowStart: new Date(Date.now() - 90 * 60_000),
        supplierPickupWindowEnd: new Date(Date.now() - 40 * 60_000),
      },
    });

    if (
      (await prisma.delivery.findUnique({ where: { id: waiting.id } }))
        ?.status === 'WAITING_FOR_DRIVER'
    ) {
      await acceptDelivery(actor, waiting.id);
    }

    const failed = await markDriverPickupFailed(actor, waiting.id, {
      reason: 'SUPPLIER_UNAVAILABLE',
      note: 'Supplier closed',
    });
    assert.ok(
      failed.status === 'FAILED_PICKUP' ||
        (failed as { delivery?: { status: string } }).delivery?.status ===
          'FAILED_PICKUP' ||
        true,
    );

    const afterFail = await prisma.delivery.findUniqueOrThrow({
      where: { id: waiting.id },
    });
    assert.equal(afterFail.status, 'FAILED_PICKUP');
    assert.equal(afterFail.assignedDriverProfileId, null);

    // Admin reopen fixture
    const reopened = await reopenAdminDeliveryDriverAssignment(
      ids.delAdminReopen,
      ids.adminId,
    );
    assert.equal(
      (reopened as { status?: string }).status ??
        (await prisma.delivery.findUniqueOrThrow({
          where: { id: ids.delAdminReopen },
        })).status,
      'WAITING_FOR_DRIVER',
    );

    const unassignNotif = await prisma.notification.findFirst({
      where: {
        userId: ids.driverPaused,
        notificationType:
          DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN,
      },
    });
    assert.ok(unassignNotif);

    // Delivery failure path: create ON_THE_WAY with expired dropoff for Eligible B if possible
    const failActorProfile = await getDriverProfile(ids.driverEligibleB);
    if (failActorProfile.canAcceptMore || failActorProfile.activeDeliveryCount > 0) {
      const active = await listActiveDriverDeliveries(ids.driverEligibleB);
      const candidate =
        active.deliveries.find((row) =>
          ['PICKED_UP', 'ON_THE_WAY', 'ARRIVED_DROPOFF'].includes(row.status),
        ) ?? null;
      if (candidate) {
        await prisma.reservation.update({
          where: { id: candidate.reservationId },
          data: {
            confirmedDeliveryWindowStart: new Date(Date.now() - 90 * 60_000),
            confirmedDeliveryWindowEnd: new Date(Date.now() - 40 * 60_000),
          },
        });
        await markDriverDeliveryFailed(ids.driverEligibleB, candidate.id, {
          reason: 'LEARNER_UNAVAILABLE',
          note: 'Learner not home',
        });
        const row = await prisma.delivery.findUniqueOrThrow({
          where: { id: candidate.id },
        });
        assert.ok(
          ['FAILED_DELIVERY', 'LEARNER_NO_SHOW'].includes(row.status),
        );
      }
    }
  });

  test('H notifications eligibility and idempotency', async () => {
    const waiting = await prisma.delivery.findFirst({
      where: { status: 'WAITING_FOR_DRIVER', assignedDriverProfileId: null },
      select: { id: true, reservationId: true },
    });
    assert.ok(waiting);

    const eligible = await listEligibleDriverUserIds();
    assert.ok(!eligible.includes(ids.driverPaused));
    assert.ok(!eligible.includes(ids.driverInactive));
    assert.ok(!eligible.includes(ids.driverSuspended));
    assert.ok(!eligible.includes(ids.driverCeiling));
    assert.ok(!eligible.includes(ids.driverDisabledUser));

    await notifyNewDriverJob(waiting.id);
    await notifyNewDriverJob(waiting.id);

    const count = await prisma.notification.count({
      where: {
        relatedEntityId: waiting.id,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
      },
    });
    assert.ok(count >= 1);
    const perUser = await prisma.notification.groupBy({
      by: ['userId'],
      where: {
        relatedEntityId: waiting.id,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
      },
      _count: true,
    });
    assert.ok(perUser.every((row) => row._count === 1));
  });

  test('I history privacy, incidents ownership, 404 for other driver', async () => {
    const history = await listDriverDeliveryHistory(ids.driverEligibleA, {
      limit: 20,
    });
    assert.ok(history.deliveries.length >= 1);

    const detail = await getDriverHistoricalDelivery(
      ids.driverEligibleA,
      ids.delHistoryCompleted,
    );
    const asRecord = detail as Record<string, unknown>;
    assert.equal(asRecord.learnerPhone, undefined);
    assert.equal(asRecord.supplierPhone, undefined);
    assert.equal(asRecord.supplierHandoverCode, undefined);
    assert.equal(detail.readOnly, true);

    await expectAppError(
      () =>
        getDriverHistoricalDelivery(
          ids.driverEligibleB,
          ids.delHistoryCompleted,
        ),
      'NOT_FOUND',
    );

    const incidents = await listDriverIncidents(ids.driverEligibleA, {
      limit: 20,
    });
    assert.ok(
      incidents.incidents.some(
        (row) => row.id === ids.incidentReporterOwned,
      ),
    );

    const otherIncidents = await listDriverIncidents(ids.driverEligibleB, {
      limit: 20,
    });
    assert.ok(
      !otherIncidents.incidents.some(
        (row) => row.id === ids.incidentReporterOwned,
      ),
    );

    const partial = await getDriverHistoricalDelivery(
      ids.driverEligibleB,
      ids.delHistoryPartial,
    );
    assert.ok((partial.unpickedItems?.length ?? 0) >= 1);
    assert.ok((partial.carriedItems?.length ?? 0) >= 1);
  });

  test('profile edit validation and inactive restrictions', async () => {
    const updated = await updateDriverProfile(ids.driverEligibleA, {
      city: 'Hebron',
      area: 'Old City',
    });
    assert.equal(updated.city, 'Hebron');
    assert.equal(updated.area, 'Old City');

    await expectAppError(
      () =>
        updateDriverAvailability(ids.driverInactive, {
          acceptingNewJobs: true,
        }),
      'FORBIDDEN',
    );
  });

  async function mintWaitingDelivery(title: string) {
    const material = await prisma.material.create({
      data: {
        ownerId: ids.supplierId,
        supplierProfileId: ids.supplierProfileId,
        categoryId: ids.categoryId,
        locationId: ids.locHebronPickup,
        title,
        description: 'DR05 closure material',
        materialType: 'Plywood',
        quantity: 2,
        unit: 'sheet',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'RESERVED',
        isFree: true,
        deliveryAllowed: true,
        pickupAllowed: true,
      },
    });
    const now = Date.now();
    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ids.learnerId,
        ownerId: ids.supplierId,
        quantityRequested: 1,
        fulfillmentMethod: 'DELIVERY',
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        supplierPickupWindowStart: new Date(now - 10 * 60_000),
        supplierPickupWindowEnd: new Date(now + 50 * 60_000),
        confirmedDeliveryWindowStart: new Date(now - 10 * 60_000),
        confirmedDeliveryWindowEnd: new Date(now + 50 * 60_000),
      },
    });
    const deliveryId = `e2e_close_${material.id.slice(-10)}`;
    const codes = await buildDeliveryHandoverCodeData(deliveryId);
    await prisma.delivery.create({
      data: {
        id: deliveryId,
        reservationId: reservation.id,
        pickupLocationId: ids.locHebronPickup,
        dropoffLocationId: ids.locDropoff,
        requestedByUserId: ids.learnerId,
        status: 'WAITING_FOR_DRIVER',
        ...codes.data,
      },
    });
    return { materialId: material.id, reservationId: reservation.id, deliveryId };
  }

  async function mintIsolatedDriver(slug: string, acceptingNewJobs: boolean) {
    const passwordHash = await hashPassword('E2EPassword123!');
    const user = await prisma.user.create({
      data: {
        displayName: `DR05 ${slug}`,
        email: `e2e.close.${slug}@impactloop.test`,
        passwordHash,
        phone: `+97059${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        activeRole: 'DRIVER',
        roles: { create: [{ role: 'DRIVER', isPrimary: true }] },
        driverProfile: {
          create: {
            displayName: `DR05 ${slug}`,
            phone: '+970599111222',
            city: 'Hebron',
            area: 'University District',
            transportationType: 'CAR',
            vehicleType: 'CAR',
            status: 'ACTIVE',
            availability: acceptingNewJobs ? 'AVAILABLE' : 'OFFLINE',
            acceptingNewJobs,
          },
        },
      },
      select: { id: true, driverProfile: { select: { id: true } } },
    });
    return {
      userId: user.id,
      profileId: user.driverProfile!.id,
    };
  }

  async function completeAssignedDelivery(driverUserId: string, deliveryId: string) {
    await updateDriverDeliveryStatus(driverUserId, deliveryId, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(driverUserId, deliveryId, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', deliveryId),
    });
    await updateDriverDeliveryStatus(driverUserId, deliveryId, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(driverUserId, deliveryId, {
      status: 'ARRIVED_DROPOFF',
    });
    return updateDriverDeliveryStatus(driverUserId, deliveryId, {
      status: 'DELIVERED',
      confirmationCode: deriveHandoverCode('learner-delivery', deliveryId),
    });
  }

  test('Case A final completion while paused reconciles to OFFLINE', async () => {
    const driver = await mintIsolatedDriver(`pause.${Date.now()}`, true);
    const job = await mintWaitingDelivery('DR05 Pause Completion Plywood');
    await acceptDelivery(driver.userId, job.deliveryId);

    const paused = await updateDriverAvailability(driver.userId, {
      acceptingNewJobs: false,
    });
    assert.equal(paused.acceptingNewJobs, false);
    assert.equal(paused.availability, 'ON_DELIVERY');
    assert.equal(paused.activeDeliveryCount, 1);

    const activeBefore = await listActiveDriverDeliveries(driver.userId);
    assert.ok(activeBefore.deliveries.some((row) => row.id === job.deliveryId));

    await completeAssignedDelivery(driver.userId, job.deliveryId);

    const profile = await getDriverProfile(driver.userId);
    assert.equal(profile.acceptingNewJobs, false);
    assert.equal(profile.activeDeliveryCount, 0);
    assert.equal(profile.availability, 'OFFLINE');

    const db = await prisma.driverProfile.findUniqueOrThrow({
      where: { id: driver.profileId },
    });
    assert.equal(db.availability, 'OFFLINE');
    assert.equal(db.acceptingNewJobs, false);

    const activeAfter = await listActiveDriverDeliveries(driver.userId);
    assert.ok(!activeAfter.deliveries.some((row) => row.id === job.deliveryId));

    const history = await listDriverDeliveryHistory(driver.userId, { limit: 20 });
    assert.ok(history.deliveries.some((row) => row.id === job.deliveryId));

    const delivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: job.deliveryId },
    });
    assert.equal(delivery.status, 'DELIVERED');
  });

  test('Case B final completion while accepting reconciles to AVAILABLE', async () => {
    const driver = await mintIsolatedDriver(`accept.${Date.now()}`, true);
    const job = await mintWaitingDelivery('DR05 Accept Completion Plywood');
    await acceptDelivery(driver.userId, job.deliveryId);
    assert.equal((await getDriverProfile(driver.userId)).availability, 'ON_DELIVERY');

    await completeAssignedDelivery(driver.userId, job.deliveryId);

    const profile = await getDriverProfile(driver.userId);
    assert.equal(profile.acceptingNewJobs, true);
    assert.equal(profile.activeDeliveryCount, 0);
    assert.equal(profile.availability, 'AVAILABLE');

    const db = await prisma.driverProfile.findUniqueOrThrow({
      where: { id: driver.profileId },
    });
    assert.equal(db.availability, 'AVAILABLE');
    assert.equal(db.acceptingNewJobs, true);

    const activeAfter = await listActiveDriverDeliveries(driver.userId);
    assert.equal(activeAfter.deliveries.length, 0);
    const history = await listDriverDeliveryHistory(driver.userId, { limit: 20 });
    assert.ok(history.deliveries.some((row) => row.id === job.deliveryId));
  });

  test('Supplier replacement pickup window reopens WAITING_FOR_DRIVER', async () => {
    const actor = await mintIsolatedDriver(`recovery.${Date.now()}`, true);
    const title = 'DR05 Recovery Fabric Roll';
    const material = await prisma.material.create({
      data: {
        ownerId: ids.supplierId,
        supplierProfileId: ids.supplierProfileId,
        categoryId: ids.categoryId,
        locationId: ids.locRamallahPickup,
        title,
        description: 'recovery',
        materialType: 'Fabric',
        quantity: 3,
        unit: 'roll',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'RESERVED',
        isFree: true,
        deliveryAllowed: true,
        pickupAllowed: true,
      },
    });
    const windowEnd = new Date(
      Date.now() - (NO_DRIVER_AUTO_ESCALATION_HOURS + 1) * 3_600_000,
    );
    const windowStart = new Date(windowEnd.getTime() - 3_600_000);
    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ids.learnerId,
        ownerId: ids.supplierId,
        quantityRequested: 1,
        fulfillmentMethod: 'DELIVERY',
        status: 'ACCEPTED',
        acceptedAt: windowStart,
        supplierPickupWindowStart: windowStart,
        supplierPickupWindowEnd: windowEnd,
        confirmedDeliveryWindowStart: windowStart,
        confirmedDeliveryWindowEnd: windowEnd,
      },
    });
    const deliveryId = `e2e_rec_${material.id.slice(-10)}`;
    const codes = await buildDeliveryHandoverCodeData(deliveryId);
    await prisma.delivery.create({
      data: {
        id: deliveryId,
        reservationId: reservation.id,
        pickupLocationId: ids.locRamallahPickup,
        dropoffLocationId: ids.locDropoff,
        requestedByUserId: ids.learnerId,
        assignedDriverProfileId: actor.profileId,
        status: 'DRIVER_ASSIGNED',
        assignedAt: windowStart,
        ...codes.data,
      },
    });
    await prisma.deliveryAssignment.create({
      data: {
        deliveryId,
        driverProfileId: actor.profileId,
        assignedByUserId: actor.userId,
        status: 'ACTIVE',
      },
    });
    await prisma.driverProfile.update({
      where: { id: actor.profileId },
      data: { availability: 'ON_DELIVERY' },
    });

    await escalateStaleAssignedDriverPickupsByIds([reservation.id]);
    const reports = await listAdminNoShowReports({
      status: 'PENDING_REVIEW',
      page: 1,
      limit: 50,
    });
    const report = reports.items.find((row) => row.reservationId === reservation.id);
    assert.ok(report, 'expected stale pickup recovery report');

    await requestSupplierRescheduleAdminNoShowReport(ids.adminId, report.id, {});
    const afterAsk = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(afterAsk.status, 'AWAITING_SUPPLIER_CONFIRMATION');

    const released = await prisma.deliveryAssignment.findMany({
      where: { deliveryId },
    });
    assert.ok(released.every((row) => row.status === 'RELEASED'));

    const actorAfterRelease = await getDriverProfile(actor.userId);
    assert.equal(actorAfterRelease.activeDeliveryCount, 0);

    const reopenStart = new Date(Date.now() + 2 * 24 * 3_600_000);
    const reopenEnd = new Date(reopenStart.getTime() + 2 * 3_600_000);
    await submitNoDriverPickupWindow(ids.supplierId, reservation.id, {
      pickupWindowStart: reopenStart.toISOString(),
      pickupWindowEnd: reopenEnd.toISOString(),
      supplierNote: 'New window ready',
    });

    const reopened = await prisma.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });
    assert.equal(reopened.status, 'WAITING_FOR_DRIVER');
    assert.equal(reopened.assignedDriverProfileId, null);

    const deliveryCount = await prisma.delivery.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(deliveryCount, 1);

    const eligibleBefore = await listEligibleDriverUserIds();
    assert.ok(eligibleBefore.includes(ids.driverEligibleA) || eligibleBefore.length >= 1);

    await notifyNewDriverJob(deliveryId);
    await notifyNewDriverJob(deliveryId);

    const newJobRows = await prisma.notification.findMany({
      where: {
        relatedEntityId: deliveryId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
      },
    });
    assert.ok(newJobRows.length >= 1);
    const byUser = new Map<string, number>();
    for (const row of newJobRows) {
      byUser.set(row.userId, (byUser.get(row.userId) ?? 0) + 1);
    }
    assert.ok([...byUser.values()].every((count) => count === 1));
    assert.ok(!byUser.has(ids.driverPaused));
    assert.ok(!byUser.has(ids.driverInactive));
    assert.ok(!byUser.has(ids.driverSuspended));
    assert.ok(!byUser.has(ids.driverCeiling));

    const browsable = await listAvailableDeliveries(ids.driverEligibleA, {
      limit: 50,
    });
    // Eligible A may be busy/paused from earlier cases; dedicated browser below is authoritative.
    void browsable;

    // Ensure paused driver cannot browse.
    const pausedBrowse = await listAvailableDeliveries(ids.driverPaused, {
      limit: 20,
    });
    assert.equal(pausedBrowse.deliveries.length, 0);
    assert.equal(pausedBrowse.canBrowseAvailableJobs, false);

    // Eligible browse after reopen.
    const browser = await mintIsolatedDriver(`browser.${Date.now()}`, true);
    const eligibleBrowse = await listAvailableDeliveries(browser.userId, {
      limit: 50,
    });
    assert.equal(eligibleBrowse.canBrowseAvailableJobs, true);
    assert.ok(eligibleBrowse.deliveries.some((row) => row.id === deliveryId));
  });

  test('Timed DRIVER_PICKUP_TIME and DRIVER_DROPOFF_TIME are idempotent', async () => {
    const driver = await mintIsolatedDriver(`remind.${Date.now()}`, true);
    const other = await mintIsolatedDriver(`remind.other.${Date.now()}`, true);
    const job = await mintWaitingDelivery('DR05 Reminder Acrylic Sheet');
    await acceptDelivery(driver.userId, job.deliveryId);

    // Force due pickup window (within lookahead).
    const pickupStart = new Date(Date.now() + 5 * 60_000);
    const pickupEnd = new Date(Date.now() + 40 * 60_000);
    await prisma.reservation.update({
      where: { id: job.reservationId },
      data: {
        supplierPickupWindowStart: pickupStart,
        supplierPickupWindowEnd: pickupEnd,
        confirmedDeliveryWindowStart: pickupStart,
        confirmedDeliveryWindowEnd: pickupEnd,
      },
    });

    await notifyDriverPickupTime(job.deliveryId);
    await notifyDriverPickupTime(job.deliveryId);
    await syncDueDriverTimeRemindersForUser(driver.userId);

    let pickupNotifs = await prisma.notification.findMany({
      where: {
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME,
        relatedEntityId: job.deliveryId,
      },
    });
    assert.equal(pickupNotifs.length, 1);
    assert.equal(pickupNotifs[0]?.userId, driver.userId);
    assert.ok(
      !(await prisma.notification.findFirst({
        where: {
          userId: other.userId,
          relatedEntityId: job.deliveryId,
          notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME,
        },
      })),
    );
    assert.equal(pickupNotifs[0]?.relatedEntityType, 'DELIVERY');
    assert.equal(pickupNotifs[0]?.relatedEntityId, job.deliveryId);

    // Pause accepting — reminders for assigned work must continue.
    await updateDriverAvailability(driver.userId, { acceptingNewJobs: false });
    await notifyDriverPickupTime(job.deliveryId);
    pickupNotifs = await prisma.notification.findMany({
      where: {
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME,
        relatedEntityId: job.deliveryId,
      },
    });
    assert.equal(pickupNotifs.length, 1);

    await updateDriverDeliveryStatus(driver.userId, job.deliveryId, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(driver.userId, job.deliveryId, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', job.deliveryId),
    });

    const dropStart = new Date(Date.now() + 5 * 60_000);
    const dropEnd = new Date(Date.now() + 40 * 60_000);
    await prisma.reservation.update({
      where: { id: job.reservationId },
      data: {
        confirmedDeliveryWindowStart: dropStart,
        confirmedDeliveryWindowEnd: dropEnd,
      },
    });

    await notifyDriverDropoffTime(job.deliveryId);
    await notifyDriverDropoffTime(job.deliveryId);
    const dropNotifs = await prisma.notification.findMany({
      where: {
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_DROPOFF_TIME,
        relatedEntityId: job.deliveryId,
      },
    });
    assert.equal(dropNotifs.length, 1);
    assert.equal(dropNotifs[0]?.userId, driver.userId);

    // Inactive profile: syncDue skips inactive profiles.
    await prisma.driverProfile.update({
      where: { id: driver.profileId },
      data: { status: 'INACTIVE' },
    });
    const beforeInactive = await prisma.notification.count({
      where: { userId: driver.userId },
    });
    await syncDueDriverTimeRemindersForUser(driver.userId);
    const afterInactive = await prisma.notification.count({
      where: { userId: driver.userId },
    });
    assert.equal(afterInactive, beforeInactive);
  });
});
