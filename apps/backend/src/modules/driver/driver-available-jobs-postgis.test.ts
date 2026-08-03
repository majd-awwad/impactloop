import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import {
  countAvailableDeliveries,
  fetchAvailableJobPageNearest,
  fetchAvailableJobPageNewest,
  loadAvailableListDeliveriesByIds,
  paginateHydratedAvailableJobs,
  verifyAvailableJobsCursorAnchor,
} from './driver-available-jobs.query.js';

const MARKER = '[test-dr04-postgis]';

describe('DR-04 PostGIS available jobs', () => {
  const createdLocationIds: string[] = [];
  const createdDeliveryIds: string[] = [];
  let requesterId = '';
  let materialId = '';
  let ownerId = '';

  before(async () => {
    const postgis = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'postgis'
    `;
    assert.equal(postgis.length, 1, 'PostGIS must be enabled for DR-04 tests');

    const user = await prisma.user.findFirst({
      where: { accountStatus: 'ACTIVE' },
      select: { id: true },
    });
    const material = await prisma.material.findFirst({
      select: { id: true, ownerId: true },
    });
    assert.ok(user && material, 'Seed data required');
    requesterId = user.id;
    materialId = material.id;
    ownerId = material.ownerId;
  });

  after(async () => {
    const deliveries = createdDeliveryIds.length
      ? await prisma.delivery.findMany({
          where: { id: { in: createdDeliveryIds } },
          select: { id: true, reservationId: true },
        })
      : await prisma.delivery.findMany({
          where: { pickupLocation: { area: MARKER } },
          select: { id: true, reservationId: true },
        });
    const deliveryIds = deliveries.map((row) => row.id);
    const reservationIds = [...new Set(deliveries.map((row) => row.reservationId))];

    if (deliveryIds.length) {
      await prisma.deliveryLocationPing.deleteMany({
        where: { deliveryId: { in: deliveryIds } },
      });
      await prisma.deliveryStatusHistory.deleteMany({
        where: { deliveryId: { in: deliveryIds } },
      });
      await prisma.deliveryAssignment.deleteMany({
        where: { deliveryId: { in: deliveryIds } },
      });
      await prisma.delivery.deleteMany({ where: { id: { in: deliveryIds } } });
    }
    if (reservationIds.length) {
      await prisma.reservationStatusHistory.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await prisma.reservation.deleteMany({
        where: { id: { in: reservationIds } },
      });
    }
    await prisma.location.deleteMany({ where: { area: MARKER } });
    await prisma.$disconnect();
  });

  const createPickup = async (input: {
    city: string;
    latitude?: number | null;
    longitude?: number | null;
  }) => {
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: input.city,
        area: MARKER,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        visibility: 'ORDER_ONLY',
        isApproximate: input.latitude == null,
        locationType: 'DELIVERY_PICKUP',
      },
    });
    createdLocationIds.push(location.id);
    return location;
  };

  const createWaitingDelivery = async (pickupLocationId: string) => {
    const dropoff = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Ramallah',
        area: MARKER,
        latitude: 31.9,
        longitude: 35.2,
        visibility: 'PRIVATE',
        isApproximate: false,
        locationType: 'DELIVERY_DROPOFF',
      },
    });
    createdLocationIds.push(dropoff.id);

    const reservation = await prisma.reservation.create({
      data: {
        materialId,
        ownerId,
        requesterId,
        quantityRequested: 1,
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
      },
    });

    const delivery = await prisma.delivery.create({
      data: {
        reservationId: reservation.id,
        pickupLocationId,
        dropoffLocationId: dropoff.id,
        requestedByUserId: requesterId,
        status: 'WAITING_FOR_DRIVER',
      },
    });
    createdDeliveryIds.push(delivery.id);
    return delivery;
  };

  test('location geography syncs from latitude/longitude via trigger', async () => {
    const location = await createPickup({
      city: 'Nablus',
      latitude: 32.221,
      longitude: 35.261,
    });

    const rows = await prisma.$queryRaw<Array<{ has_geo: boolean; matches: boolean }>>`
      SELECT
        ("location" IS NOT NULL) AS has_geo,
        ST_DWithin(
          "location",
          ST_SetSRID(ST_MakePoint(35.261, 32.221), 4326)::geography,
          0.01,
          false
        ) AS matches
      FROM "locations"
      WHERE "id" = ${location.id}
    `;
    assert.equal(rows[0]?.has_geo, true);
    assert.equal(rows[0]?.matches, true);

    await prisma.location.update({
      where: { id: location.id },
      data: { latitude: 32.23, longitude: 35.27 },
    });

    const updated = await prisma.$queryRaw<Array<{ matches: boolean }>>`
      SELECT ST_DWithin(
        "location",
        ST_SetSRID(ST_MakePoint(35.27, 32.23), 4326)::geography,
        0.01,
        false
      ) AS matches
      FROM "locations"
      WHERE "id" = ${location.id}
    `;
    assert.equal(updated[0]?.matches, true);
  });

  test('ST_DWithin radius membership and KNN nearest ordering', async () => {
    const near = await createPickup({
      city: 'Nablus',
      latitude: 32.221,
      longitude: 35.261,
    });
    const far = await createPickup({
      city: 'Nablus',
      latitude: 32.5,
      longitude: 35.5,
    });
    const nearDelivery = await createWaitingDelivery(near.id);
    const farDelivery = await createWaitingDelivery(far.id);

    const reference = { latitude: 32.22, longitude: 35.26 };
    const radiusPage = await fetchAvailableJobPageNearest({
      filters: { city: 'Nablus', area: MARKER, maxDistanceKm: 5 },
      reference,
      cursor: null,
      limit: 20,
    });
    const radiusIds = radiusPage.map((row) => row.id);
    assert.ok(radiusIds.includes(nearDelivery.id));
    assert.equal(radiusIds.includes(farDelivery.id), false);

    const globalPage = await fetchAvailableJobPageNearest({
      filters: { city: 'Nablus', area: MARKER },
      reference,
      cursor: null,
      limit: 20,
    });
    const globalIds = globalPage.map((row) => row.id);
    assert.ok(globalIds.includes(nearDelivery.id));
    assert.ok(globalIds.includes(farDelivery.id));
    assert.ok(
      globalIds.indexOf(nearDelivery.id) < globalIds.indexOf(farDelivery.id),
    );
  });

  test('hydration excludes deliveries claimed between page select and load', async () => {
    const pickup = await createPickup({
      city: 'Tulkarm',
      latitude: 32.31,
      longitude: 35.03,
    });
    const delivery = await createWaitingDelivery(pickup.id);

    const page = await fetchAvailableJobPageNewest({
      filters: { city: 'Tulkarm', area: MARKER },
      cursor: null,
      limit: 20,
    });
    assert.ok(page.some((row) => row.id === delivery.id));

    const driver = await prisma.driverProfile.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    assert.ok(driver);

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'DRIVER_ASSIGNED',
        assignedDriverProfileId: driver.id,
      },
    });

    const hydrated = await loadAvailableListDeliveriesByIds(
      page.map((row) => row.id),
    );
    assert.equal(
      hydrated.some((row) => row.id === delivery.id),
      false,
      'Assigned delivery must not survive hydration',
    );
  });

  test('aggregate counts use one query and nearby equals total without radius', async () => {
    const pickup = await createPickup({
      city: 'Qalqilya',
      latitude: 32.19,
      longitude: 34.98,
    });
    await createWaitingDelivery(pickup.id);

    let queryRawCalls = 0;
    const original = prisma.$queryRaw.bind(prisma);
    (prisma as { $queryRaw: typeof prisma.$queryRaw }).$queryRaw = ((
      ...args: Parameters<typeof prisma.$queryRaw>
    ) => {
      queryRawCalls += 1;
      return original(...args);
    }) as typeof prisma.$queryRaw;

    try {
      const withoutRadius = await countAvailableDeliveries(
        { city: 'Qalqilya', area: MARKER },
        { latitude: 32.19, longitude: 34.98 },
      );
      assert.equal(withoutRadius.nearbyAvailableCount, withoutRadius.totalAvailableCount);
      assert.equal(queryRawCalls, 1);

      queryRawCalls = 0;
      const withRadius = await countAvailableDeliveries(
        { city: 'Qalqilya', area: MARKER, maxDistanceKm: 50 },
        { latitude: 32.19, longitude: 34.98 },
      );
      assert.ok(withRadius.totalAvailableCount >= 1);
      assert.ok(withRadius.nearbyAvailableCount >= 1);
      assert.ok(withRadius.nearbyAvailableCount <= withRadius.totalAvailableCount);
      assert.equal(queryRawCalls, 1);
    } finally {
      (prisma as { $queryRaw: typeof prisma.$queryRaw }).$queryRaw = original;
    }
  });

  test('nearest later page continues without duplicates on stable data', async () => {
    const stamp = new Date();
    for (let i = 0; i < 3; i += 1) {
      const pickup = await createPickup({
        city: 'Salfit',
        latitude: 32.085 + i * 0.001,
        longitude: 35.18 + i * 0.001,
      });
      const delivery = await createWaitingDelivery(pickup.id);
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { requestedAt: stamp },
      });
    }

    const reference = { latitude: 32.085, longitude: 35.18 };
    const page1 = await fetchAvailableJobPageNearest({
      filters: { city: 'Salfit', area: MARKER },
      reference,
      cursor: null,
      limit: 2,
    });
    assert.equal(page1.length, 3);
    const slice = page1.slice(0, 2);
    const last = slice[1]!;
    const page2 = await fetchAvailableJobPageNearest({
      filters: { city: 'Salfit', area: MARKER },
      reference,
      cursor: {
        v: 2,
        sortBy: 'nearest',
        city: 'Salfit',
        area: MARKER,
        maxDistanceKm: null,
        requestedAt: last.requestedAt.toISOString(),
        distanceMeters: last.distanceMeters,
        distanceKm: last.distanceKm,
        id: last.id,
        refLat: reference.latitude,
        refLng: reference.longitude,
      },
      limit: 2,
    });

    const ids = [...slice.map((row) => row.id), ...page2.map((row) => row.id)];
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(page2.length >= 1);

    const anchorOk = await verifyAvailableJobsCursorAnchor({
      cursor: {
        v: 2,
        sortBy: 'nearest',
        city: 'Salfit',
        area: MARKER,
        maxDistanceKm: null,
        requestedAt: last.requestedAt.toISOString(),
        distanceMeters: last.distanceMeters,
        distanceKm: last.distanceKm,
        id: last.id,
        refLat: reference.latitude,
        refLng: reference.longitude,
      },
      filters: { city: 'Salfit', area: MARKER },
      reference,
      sortBy: 'nearest',
    });
    assert.equal(anchorOk, true);
  });

  test('exact distance ties break by requestedAt then id using KNN meters', async () => {
    const stamp = new Date();
    const pickup = await createPickup({
      city: 'Tubas',
      latitude: 32.32,
      longitude: 35.37,
    });
    const older = await createWaitingDelivery(pickup.id);
    const newer = await createWaitingDelivery(pickup.id);
    await prisma.delivery.update({
      where: { id: older.id },
      data: { requestedAt: new Date(stamp.getTime() - 60_000) },
    });
    await prisma.delivery.update({
      where: { id: newer.id },
      data: { requestedAt: stamp },
    });

    const reference = { latitude: 32.32, longitude: 35.37 };
    const page = await fetchAvailableJobPageNearest({
      filters: { city: 'Tubas', area: MARKER },
      reference,
      cursor: null,
      limit: 10,
    });
    const ids = page.map((row) => row.id);
    assert.ok(ids.indexOf(newer.id) < ids.indexOf(older.id));
    assert.equal(page.find((row) => row.id === newer.id)?.distanceMeters, 0);
    assert.equal(page.find((row) => row.id === older.id)?.distanceMeters, 0);
  });

  test('same point, near-equal, antimeridian, and high-latitude KNN pages', async () => {
    const sameA = await createPickup({
      city: 'Jericho',
      latitude: 31.855,
      longitude: 35.461,
    });
    const sameB = await createPickup({
      city: 'Jericho',
      latitude: 31.855,
      longitude: 35.461,
    });
    const nearEqual = await createPickup({
      city: 'Jericho',
      latitude: 31.8551,
      longitude: 35.4611,
    });
    const anti = await createPickup({
      city: 'Jericho',
      latitude: 0,
      longitude: 179.8,
    });
    const highLat = await createPickup({
      city: 'Jericho',
      latitude: 78.2,
      longitude: 15.6,
    });

    const dSameA = await createWaitingDelivery(sameA.id);
    const dSameB = await createWaitingDelivery(sameB.id);
    const dNear = await createWaitingDelivery(nearEqual.id);
    const dAnti = await createWaitingDelivery(anti.id);
    const dHigh = await createWaitingDelivery(highLat.id);

    const reference = { latitude: 31.855, longitude: 35.461 };
    const page = await fetchAvailableJobPageNearest({
      filters: { city: 'Jericho', area: MARKER },
      reference,
      cursor: null,
      limit: 20,
    });
    const ids = page.map((row) => row.id);
    assert.ok(ids.includes(dSameA.id));
    assert.ok(ids.includes(dSameB.id));
    assert.ok(ids.includes(dNear.id));
    assert.ok(ids.includes(dAnti.id));
    assert.ok(ids.includes(dHigh.id));
    assert.equal(new Set(ids).size, ids.length);

    const antiPage = await fetchAvailableJobPageNearest({
      filters: { city: 'Jericho', area: MARKER },
      reference: { latitude: 0, longitude: -179.8 },
      cursor: null,
      limit: 5,
    });
    assert.ok(antiPage.some((row) => row.id === dAnti.id));

    const highPage = await fetchAvailableJobPageNearest({
      filters: { city: 'Jericho', area: MARKER },
      reference: { latitude: 78.2, longitude: 15.6 },
      cursor: null,
      limit: 5,
    });
    assert.ok(highPage.some((row) => row.id === dHigh.id));
    assert.equal(highPage.find((row) => row.id === dHigh.id)?.distanceMeters, 0);
  });

  test('hydration-safe page drops claimed last row from nextCursor path', async () => {
    const city = 'Bethlehem';
    const created = [];
    for (let i = 0; i < 3; i += 1) {
      const pickup = await createPickup({
        city,
        latitude: 31.7 + i * 0.01,
        longitude: 35.2 + i * 0.01,
      });
      created.push(await createWaitingDelivery(pickup.id));
    }

    const pageRows = await fetchAvailableJobPageNewest({
      filters: { city, area: MARKER },
      cursor: null,
      limit: 2,
    });
    assert.equal(pageRows.length, 3);

    const driver = await prisma.driverProfile.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    assert.ok(driver);
    const claimed = pageRows[1]!;
    await prisma.delivery.update({
      where: { id: claimed.id },
      data: {
        status: 'DRIVER_ASSIGNED',
        assignedDriverProfileId: driver.id,
      },
    });

    const hydrated = await loadAvailableListDeliveriesByIds(
      pageRows.map((row) => row.id),
    );
    const { page, hasMore, needsRetry } = paginateHydratedAvailableJobs(
      pageRows,
      hydrated,
      2,
    );

    assert.equal(needsRetry, false);
    assert.equal(hasMore, true);
    assert.equal(
      page.some((item) => item.row.id === claimed.id),
      false,
    );
    assert.equal(
      page.every((item) => item.delivery.status === 'WAITING_FOR_DRIVER'),
      true,
    );
    assert.notEqual(page.at(-1)?.row.id, claimed.id);
    assert.ok(created.length === 3);
  });
});
