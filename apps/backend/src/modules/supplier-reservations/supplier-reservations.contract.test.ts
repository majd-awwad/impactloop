import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';

import { app } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { signAccessToken } from '../../utils/jwt.js';
import {
  getSupplierReservationDetail,
  listSupplierReservationsPage,
} from './supplier-reservations.service.js';
import { listSupplierReservationsQuerySchema } from './supplier-reservations.validation.js';

const MARKER = '[test-supplier-contract]';

type Fixture = {
  supplierId: string;
  otherSupplierId: string;
  learnerId: string;
  driverProfileId: string;
  supplierProfileId: string;
  locationId: string;
  primaryMaterialId: string;
  secondaryMaterialId: string;
  ids: Record<string, string>;
  serverUrl: string;
  closeServer: () => Promise<void>;
};

let fixture: Fixture;

const now = () => new Date();
const at = (minutesFromNow: number) =>
  new Date(now().getTime() + minutesFromNow * 60_000);

const query = (input: Record<string, unknown> = {}) =>
  listSupplierReservationsQuerySchema.parse(input);

const createUser = async (input: {
  suffix: string;
  role: 'SUPPLIER' | 'LEARNER' | 'DRIVER';
}) => {
  const timestamp = `${Date.now()}-${input.suffix}`;
  return prisma.user.create({
    data: {
      displayName: `${MARKER} ${input.suffix}`,
      email: `${MARKER}-${timestamp}@impactloop.test`,
      passwordHash: 'not-used-by-contract-test',
      accountStatus: 'ACTIVE',
      emailVerifiedAt: now(),
      roles: { create: [{ role: input.role, isPrimary: true }] },
      ...(input.role === 'SUPPLIER'
        ? {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${MARKER} ${input.suffix}`,
                verificationStatus: 'VERIFIED',
              },
            },
          }
        : {}),
      ...(input.role === 'LEARNER'
        ? { learnerProfile: { create: { learnerType: 'STUDENT' } } }
        : {}),
      ...(input.role === 'DRIVER'
        ? {
            driverProfile: {
              create: {
                displayName: `${MARKER} ${input.suffix}`,
                phone: `+97059${Date.now().toString().slice(-7)}`,
                city: 'Ramallah',
                area: MARKER,
                transportationType: 'BICYCLE',
              },
            },
          }
        : {}),
    },
    include: { supplierProfile: true, driverProfile: true },
  });
};

const createReservation = async (
  key: string,
  input: {
    status: Parameters<typeof prisma.reservation.create>[0]['data']['status'];
    fulfillmentMethod?: 'PICKUP' | 'DELIVERY';
    materialId?: string;
    createdAtOffset?: number;
    pickupWindowStart?: Date;
    pickupWindowEnd?: Date;
    supplierPickupWindowStart?: Date;
    supplierPickupWindowEnd?: Date;
    learnerProposal?: boolean;
    recovery?: boolean;
    deliveryAddressText?: string;
  },
) => {
  const reservation = await prisma.reservation.create({
    data: {
      materialId: input.materialId ?? fixture.primaryMaterialId,
      requesterId: fixture.learnerId,
      ownerId: fixture.supplierId,
      quantityRequested: 1,
      message: `${MARKER} original learner request ${key}`,
      fulfillmentMethod: input.fulfillmentMethod ?? 'PICKUP',
      status: input.status,
      pickupWindowStart: input.pickupWindowStart,
      pickupWindowEnd: input.pickupWindowEnd,
      supplierPickupWindowStart: input.supplierPickupWindowStart,
      supplierPickupWindowEnd: input.supplierPickupWindowEnd,
      learnerProposedPickupWindowStart: input.learnerProposal ? at(120) : null,
      learnerProposedPickupWindowEnd: input.learnerProposal ? at(180) : null,
      pendingRescheduleRequestedBy: input.learnerProposal ? 'LEARNER' : input.recovery ? 'SUPPLIER' : null,
      pendingRescheduleReason: input.learnerProposal
        ? 'LEARNER_NEEDS_LATER_TIME'
        : input.recovery
          ? 'NO_DRIVER_ADMIN_REQUEST'
          : null,
      pendingRescheduleNote: input.recovery ? 'Admin requested a replacement pickup window.' : null,
      deliveryAddressText: input.deliveryAddressText ?? null,
      createdAt: at(input.createdAtOffset ?? 0),
    },
  });
  fixture.ids[key] = reservation.id;
  return reservation;
};

const createDelivery = async (
  reservationId: string,
  status: Parameters<typeof prisma.delivery.create>[0]['data']['status'],
  input: { assigned?: boolean; groupId?: string } = {},
) =>
  prisma.delivery.create({
    data: {
      reservationId,
      deliveryGroupId: input.groupId,
      pickupLocationId: fixture.locationId,
      dropoffLocationId: fixture.locationId,
      requestedByUserId: fixture.learnerId,
      status,
      assignedDriverProfileId: input.assigned ? fixture.driverProfileId : null,
      assignedAt: input.assigned ? now() : null,
      pickedUpAt: status === 'PICKED_UP' ? now() : null,
    },
  });

const http = async (path: string, token?: string) => {
  const response = await fetch(`${fixture.serverUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { response, body: await response.json() as Record<string, unknown> };
};

const summaryTotal = (summary: Record<string, number>) =>
  summary.needsSupplierResponse +
  summary.waitingForLearner +
  summary.fulfillmentInProgress +
  summary.adminReview +
  summary.completed +
  summary.closed;

describe('supplier reservations persisted contract', () => {
  before(async () => {
    const [category, location] = await Promise.all([
      prisma.category.findFirst({ select: { id: true } }),
      prisma.location.findFirst({ select: { id: true } }),
    ]);
    assert.ok(category && location, 'Expected seeded category and location.');

    const [supplier, otherSupplier, learner, driver] = await Promise.all([
      createUser({ suffix: 'supplier', role: 'SUPPLIER' }),
      createUser({ suffix: 'other-supplier', role: 'SUPPLIER' }),
      createUser({ suffix: 'learner', role: 'LEARNER' }),
      createUser({ suffix: 'driver', role: 'DRIVER' }),
    ]);
    assert.ok(supplier.supplierProfile && driver.driverProfile);

    const [primaryMaterial, secondaryMaterial] = await Promise.all([
      prisma.material.create({
        data: {
          ownerId: supplier.id,
          supplierProfileId: supplier.supplierProfile.id,
          categoryId: category.id,
          locationId: location.id,
          title: `${MARKER} primary material`,
          description: 'Supplier contract fixture',
          materialType: 'Fixture',
          quantity: 100,
          unit: 'piece',
          condition: 'GOOD',
          sourceType: 'WORKSHOP_SURPLUS',
          status: 'AVAILABLE',
          pickupAllowed: true,
          deliveryAllowed: true,
        },
      }),
      prisma.material.create({
        data: {
          ownerId: supplier.id,
          supplierProfileId: supplier.supplierProfile.id,
          categoryId: category.id,
          locationId: location.id,
          title: `${MARKER} secondary material`,
          description: 'Supplier contract fixture',
          materialType: 'Fixture',
          quantity: 100,
          unit: 'piece',
          condition: 'GOOD',
          sourceType: 'WORKSHOP_SURPLUS',
          status: 'AVAILABLE',
          pickupAllowed: true,
          deliveryAllowed: true,
        },
      }),
    ]);

    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    fixture = {
      supplierId: supplier.id,
      otherSupplierId: otherSupplier.id,
      learnerId: learner.id,
      driverProfileId: driver.driverProfile.id,
      supplierProfileId: supplier.supplierProfile.id,
      locationId: location.id,
      primaryMaterialId: primaryMaterial.id,
      secondaryMaterialId: secondaryMaterial.id,
      ids: {},
      serverUrl: `http://127.0.0.1:${address.port}`,
      closeServer: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    };

    await createReservation('pending', { status: 'PENDING', createdAtOffset: -21 });
    await createReservation('awaitingLearner', { status: 'AWAITING_LEARNER_CONFIRMATION', createdAtOffset: -20 });
    await createReservation('awaitingSupplierLearner', { status: 'AWAITING_SUPPLIER_CONFIRMATION', learnerProposal: true, createdAtOffset: -19 });
    await createReservation('acceptedBefore', { status: 'ACCEPTED', pickupWindowStart: at(90), pickupWindowEnd: at(150), createdAtOffset: -18 });
    await createReservation('acceptedDuring', { status: 'ACCEPTED', pickupWindowStart: at(-5), pickupWindowEnd: at(20), createdAtOffset: -17 });
    await createReservation('acceptedOverdue', { status: 'ACCEPTED', pickupWindowStart: at(-180), pickupWindowEnd: at(-60), createdAtOffset: -16 });
    const waitingDriver = await createReservation('deliveryWaiting', { status: 'ACCEPTED', fulfillmentMethod: 'DELIVERY', supplierPickupWindowStart: at(90), supplierPickupWindowEnd: at(150), createdAtOffset: -15 });
    await createDelivery(waitingDriver.id, 'WAITING_FOR_DRIVER');
    const assignedDriver = await createReservation('deliveryAssigned', { status: 'ACCEPTED', fulfillmentMethod: 'DELIVERY', supplierPickupWindowStart: at(90), supplierPickupWindowEnd: at(150), createdAtOffset: -14 });
    await createDelivery(assignedDriver.id, 'DRIVER_ASSIGNED', { assigned: true });
    const inTransit = await createReservation('deliveryInTransit', { status: 'ACCEPTED', fulfillmentMethod: 'DELIVERY', supplierPickupWindowStart: at(-20), supplierPickupWindowEnd: at(90), createdAtOffset: -13 });
    await createDelivery(inTransit.id, 'PICKED_UP', { assigned: true });
    const noDriver = await createReservation('noDriverEscalation', { status: 'ACCEPTED', fulfillmentMethod: 'DELIVERY', supplierPickupWindowStart: at(-150), supplierPickupWindowEnd: at(-60), createdAtOffset: -12 });
    await createDelivery(noDriver.id, 'WAITING_FOR_DRIVER');
    const driverNoShow = await createReservation('driverNoShowEscalation', { status: 'ACCEPTED', fulfillmentMethod: 'DELIVERY', supplierPickupWindowStart: at(-150), supplierPickupWindowEnd: at(-60), createdAtOffset: -11 });
    await createDelivery(driverNoShow.id, 'DRIVER_ASSIGNED', { assigned: true });
    const recovery = await createReservation('awaitingSupplierRecovery', { status: 'AWAITING_SUPPLIER_CONFIRMATION', fulfillmentMethod: 'DELIVERY', recovery: true, supplierPickupWindowStart: at(90), supplierPickupWindowEnd: at(150), createdAtOffset: -10 });
    await createDelivery(recovery.id, 'AWAITING_RESOLUTION');
    const resolving = await createReservation('awaitingResolution', { status: 'AWAITING_RESOLUTION', fulfillmentMethod: 'DELIVERY', createdAtOffset: -9 });
    const resolvingDelivery = await createDelivery(resolving.id, 'AWAITING_RESOLUTION');
    await prisma.noShowReport.create({
      data: {
        reservationId: resolving.id,
        deliveryId: resolvingDelivery.id,
        reporterUserId: learner.id,
        targetRole: 'SYSTEM',
        reasonCode: 'NO_DRIVER_AVAILABLE',
        note: 'Persisted recovery incident.',
      },
    });
    for (const [key, status] of [
      ['rejected', 'REJECTED'], ['cancelled', 'CANCELLED'], ['completed', 'COMPLETED'],
      ['expired', 'EXPIRED'], ['noShow', 'NO_SHOW'], ['fulfillmentFailed', 'FULFILLMENT_FAILED'],
    ] as const) {
      await createReservation(key, { status, materialId: secondaryMaterial.id, createdAtOffset: -8 });
    }

    const group = await prisma.deliveryGroup.create({
      data: {
        learnerId: learner.id,
        supplierProfileId: supplier.supplierProfile.id,
        dropoffCity: 'Ramallah',
        deliveryFee: 0,
        deliveryZone: 'SAME_CITY',
        status: 'ASSIGNED',
        windowStart: at(120),
        windowEnd: at(180),
      },
    });
    const groupPrimary = await createReservation('groupPrimary', { status: 'ACCEPTED', fulfillmentMethod: 'DELIVERY', createdAtOffset: -7 });
    const groupSecondary = await createReservation('groupSecondary', { status: 'ACCEPTED', fulfillmentMethod: 'DELIVERY', createdAtOffset: -6 });
    await prisma.reservation.updateMany({ where: { id: { in: [groupPrimary.id, groupSecondary.id] } }, data: { deliveryGroupId: group.id } });
    await createDelivery(groupPrimary.id, 'DRIVER_ASSIGNED', { assigned: true, groupId: group.id });
    await prisma.reservationMessage.createMany({
      data: [
        { reservationId: groupPrimary.id, senderUserId: learner.id, body: `${MARKER} original learner request groupPrimary`, createdAt: at(-2) },
        { reservationId: groupPrimary.id, senderUserId: supplier.id, body: 'Supplier follow-up message', createdAt: at(-1) },
      ],
    });
    await prisma.reservationStatusHistory.createMany({
      data: Array.from({ length: 52 }, (_, index) => ({
        reservationId: groupPrimary.id,
        oldStatus: 'PENDING',
        newStatus: 'ACCEPTED',
        note: `history ${index}`,
        changedBy: supplier.id,
        createdAt: at(-index),
      })),
    });
  });

  after(async () => {
    await fixture.closeServer();
    const reservationIds = Object.values(fixture.ids);
    await prisma.noShowReport.deleteMany({ where: { reservationId: { in: reservationIds } } });
    await prisma.reservationMessage.deleteMany({ where: { reservationId: { in: reservationIds } } });
    await prisma.reservationStatusHistory.deleteMany({ where: { reservationId: { in: reservationIds } } });
    await prisma.delivery.deleteMany({ where: { reservationId: { in: reservationIds } } });
    await prisma.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    await prisma.deliveryGroup.deleteMany({ where: { supplierProfileId: fixture.supplierProfileId } });
    await prisma.material.deleteMany({ where: { id: { in: [fixture.primaryMaterialId, fixture.secondaryMaterialId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [fixture.supplierId, fixture.otherSupplierId, fixture.learnerId] } } });
    const driver = await prisma.driverProfile.findUnique({ where: { id: fixture.driverProfileId }, select: { userId: true } });
    if (driver) await prisma.user.delete({ where: { id: driver.userId } });
  });

  test('persists every raw status and maps the canonical contract', async () => {
    const result = await listSupplierReservationsPage(fixture.supplierId, query({ limit: 100 }));
    const byId = new Map(result.items.map((item) => [item.id, item]));
    const expected = [
      ['pending', 'PENDING', 'INITIAL_DECISION', 'SUPPLIER_ACTION_REQUIRED', 'SUPPLIER', 'NEEDS_SUPPLIER_RESPONSE'],
      ['awaitingLearner', 'AWAITING_LEARNER_CONFIRMATION', 'SCHEDULING', 'WAITING_FOR_LEARNER', 'LEARNER', 'WAITING_FOR_LEARNER'],
      ['awaitingSupplierLearner', 'AWAITING_SUPPLIER_CONFIRMATION', 'SCHEDULING', 'SUPPLIER_ACTION_REQUIRED', 'SUPPLIER', 'NEEDS_SUPPLIER_RESPONSE'],
      ['awaitingResolution', 'AWAITING_RESOLUTION', 'RECOVERY', 'ADMIN_REVIEW_REQUIRED', 'ADMIN', 'ADMIN_REVIEW'],
      ['rejected', 'REJECTED', 'CLOSED', 'TERMINAL', 'NONE', 'CLOSED'],
      ['cancelled', 'CANCELLED', 'CLOSED', 'TERMINAL', 'NONE', 'CLOSED'],
      ['completed', 'COMPLETED', 'COMPLETED', 'TERMINAL', 'NONE', 'COMPLETED'],
      ['expired', 'EXPIRED', 'CLOSED', 'TERMINAL', 'NONE', 'CLOSED'],
      ['noShow', 'NO_SHOW', 'CLOSED', 'TERMINAL', 'NONE', 'CLOSED'],
      ['fulfillmentFailed', 'FULFILLMENT_FAILED', 'CLOSED', 'TERMINAL', 'NONE', 'CLOSED'],
    ] as const;
    for (const [key, status, phase, attention, actor, bucket] of expected) {
      const item = byId.get(fixture.ids[key]);
      assert.ok(item, `Expected persisted ${status} item.`);
      assert.equal(item.status, status);
      assert.equal(item.workflowPhase, phase);
      assert.equal(item.attentionState, attention);
      assert.equal(item.nextActor, actor);
      assert.equal(item.summaryBucket, bucket);
      assert.ok(Array.isArray(item.availableActions));
    }
    assert.deepEqual(byId.get(fixture.ids.pending)?.availableActions, ['ACCEPT', 'DECLINE', 'SEND_MESSAGE']);
  });

  test('handles pickup, delivery, learner-reschedule, and recovery variants distinctly', async () => {
    const result = await listSupplierReservationsPage(fixture.supplierId, query({ limit: 100 }));
    const byId = new Map(result.items.map((item) => [item.id, item]));
    const learnerProposal = byId.get(fixture.ids.awaitingSupplierLearner)!;
    const recovery = byId.get(fixture.ids.awaitingSupplierRecovery)!;
    assert.equal(learnerProposal.pendingReschedule?.requestedBy, 'LEARNER');
    assert.ok(learnerProposal.availableActions.includes('ACCEPT_LEARNER_RESCHEDULE'));
    assert.ok(learnerProposal.availableActions.includes('PROPOSE_RESCHEDULE'));
    assert.equal(recovery.pendingReschedule?.reason, 'NO_DRIVER_ADMIN_REQUEST');
    assert.equal(recovery.scheduleSummary.recoveryContext?.initiatedBy, 'ADMIN');
    assert.ok(recovery.availableActions.includes('SUBMIT_RECOVERY_PICKUP_WINDOW'));
    assert.equal(recovery.availableActions.includes('ACCEPT_LEARNER_RESCHEDULE'), false);
    assert.equal(recovery.availableActions.includes('PROPOSE_RESCHEDULE'), false);
    for (const key of ['acceptedBefore', 'acceptedDuring', 'acceptedOverdue']) {
      const item = byId.get(fixture.ids[key])!;
      assert.equal(item.status, 'ACCEPTED');
      assert.equal(item.workflowPhase, 'SELF_PICKUP');
      assert.equal(item.attentionState, 'SUPPLIER_ACTION_REQUIRED');
      assert.equal(item.nextActor, 'SUPPLIER');
      assert.equal(item.summaryBucket, 'NEEDS_SUPPLIER_RESPONSE');
    }
    assert.ok(byId.get(fixture.ids.acceptedDuring)?.availableActions.includes('COMPLETE_SELF_PICKUP'));
    assert.ok(byId.get(fixture.ids.acceptedOverdue)?.availableActions.includes('MARK_LEARNER_NO_SHOW'));
    for (const key of ['deliveryWaiting', 'deliveryAssigned', 'deliveryInTransit']) {
      const item = byId.get(fixture.ids[key])!;
      assert.equal(item.status, 'ACCEPTED');
      assert.equal(item.workflowPhase, 'DELIVERY');
      assert.equal(item.nextActor, 'DRIVER');
      assert.equal(item.attentionState, 'FULFILLMENT_IN_PROGRESS');
      assert.equal(item.summaryBucket, 'FULFILLMENT_IN_PROGRESS');
      assert.ok(item.deliverySummary);
    }
    assert.ok(byId.get(fixture.ids.noDriverEscalation)?.availableActions.includes('REPORT_NO_DRIVER'));
    assert.ok(byId.get(fixture.ids.driverNoShowEscalation)?.availableActions.includes('REPORT_DRIVER_NO_SHOW'));
  });

  test('reconciles every summary filter and paginates stably', async () => {
    const unfiltered = await listSupplierReservationsPage(fixture.supplierId, query({ limit: 3 }));
    assert.equal(summaryTotal(unfiltered.summary), unfiltered.pagination.total);
    assert.equal(unfiltered.pagination.totalPages, Math.ceil(unfiltered.pagination.total / 3));
    const firstIds = unfiltered.items.map((item) => item.id);
    const repeated = await listSupplierReservationsPage(fixture.supplierId, query({ limit: 3 }));
    assert.deepEqual(repeated.items.map((item) => item.id), firstIds);
    const empty = await listSupplierReservationsPage(fixture.supplierId, query({ page: 999, limit: 3 }));
    assert.deepEqual(empty.items, []);
    assert.equal(empty.pagination.total, unfiltered.pagination.total);

    const filters = [
      { status: 'ACCEPTED' },
      { attentionState: 'SUPPLIER_ACTION_REQUIRED' },
      { fulfillmentMethod: 'DELIVERY' },
      { historyScope: 'TERMINAL' },
      { search: 'secondary material' },
      { materialId: fixture.secondaryMaterialId },
      { dateFrom: at(-60).toISOString(), dateTo: at(60).toISOString() },
      { fulfillmentMethod: 'DELIVERY', attentionState: 'FULFILLMENT_IN_PROGRESS' },
    ];
    for (const filter of filters) {
      const response = await listSupplierReservationsPage(fixture.supplierId, query(filter));
      assert.equal(summaryTotal(response.summary), response.pagination.total);
    }
    assert.equal(listSupplierReservationsQuerySchema.safeParse({ limit: 101 }).success, false);
  });

  test('serves the backward-compatible HTTP list and owner-scoped detail contract', async () => {
    const supplierToken = signAccessToken({ sub: fixture.supplierId, roles: ['SUPPLIER'] });
    const otherSupplierToken = signAccessToken({ sub: fixture.otherSupplierId, roles: ['SUPPLIER'] });
    const learnerToken = signAccessToken({ sub: fixture.learnerId, roles: ['LEARNER'] });
    const list = await http('/api/supplier/reservations?limit=2&status=ACCEPTED', supplierToken);
    assert.equal(list.response.status, 200);
    const listData = list.body.data as Record<string, unknown>;
    assert.ok(Array.isArray(listData.items));
    assert.deepEqual(listData.reservations, listData.items);
    assert.ok(listData.pagination && listData.summary);
    assert.equal((listData.reservations as unknown[]).length, 2);

    const reservationId = fixture.ids.groupPrimary;
    const ownerDetail = await http(`/api/supplier/reservations/${reservationId}`, supplierToken);
    assert.equal(ownerDetail.response.status, 200);
    const detail = ownerDetail.body.data as Record<string, any>;
    assert.equal(detail.identity.reservationId, reservationId);
    assert.deepEqual(detail.canonicalState.availableActions, detail.availableActions);
    assert.equal(detail.group.grouped, true);
    assert.equal(detail.group.itemCount, 2);
    assert.equal(detail.messages.items.length, 2);
    assert.equal(detail.messages.truncated, false);
    assert.equal(detail.history.length, 50);
    assert.equal(detail.messageSummary.latestSenderRole, 'SUPPLIER');
    assert.equal(detail.request.originalLearnerNote, `${MARKER} original learner request groupPrimary`);
    assert.equal(detail.schedule.confirmedPickupWindow.start, null);
    assert.ok(detail.delivery);

    assert.equal((await http(`/api/supplier/reservations/${reservationId}`, otherSupplierToken)).response.status, 404);
    assert.equal((await http(`/api/supplier/reservations/${reservationId}`, learnerToken)).response.status, 403);
    assert.equal((await http(`/api/supplier/reservations/${reservationId}`)).response.status, 401);
    assert.equal((await http('/api/supplier/reservations/missing-reservation', supplierToken)).response.status, 404);

    const single = await getSupplierReservationDetail(fixture.supplierId, fixture.ids.deliveryWaiting);
    assert.equal(single.groupSummary, null);
    assert.equal(single.groupedDelivery, false);
  });
});
