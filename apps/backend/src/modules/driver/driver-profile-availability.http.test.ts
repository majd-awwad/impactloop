import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'driver-profile-http-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'driver-profile-http-refresh-secret';

const TEST_MARKER = '[test-driver-profile-http]';

type ApiJson = {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown>;
  error?: { code?: string; details?: unknown };
};

let baseUrl = '';
let server: Server | null = null;
let prisma: typeof import('../../database/prisma.js').prisma;
let signAccessToken: typeof import('../../utils/jwt.js').signAccessToken;
let hashPassword: typeof import('../../utils/password.js').hashPassword;
const createdUserIds: string[] = [];

const tokenFor = (userId: string, roles: string[]) =>
  signAccessToken({ sub: userId, roles });

async function apiFetch(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { response, json: (await response.json()) as ApiJson };
}

async function createUser(input: {
  suffix: string;
  role: 'DRIVER' | 'LEARNER';
  profileStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  acceptingNewJobs?: boolean;
}) {
  const phone = `+97056${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')}`;
  const acceptingNewJobs = input.acceptingNewJobs ?? true;
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      phone,
      passwordHash: await hashPassword('TestPassword123!'),
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      activeRole: input.role,
      roles: { create: [{ role: input.role, isPrimary: true }] },
      ...(input.role === 'DRIVER'
        ? {
            driverProfile: {
              create: {
                displayName: `${TEST_MARKER} legacy ${input.suffix}`,
                phone,
                city: 'Nablus',
                area: 'Rafidia',
                transportationType: 'MOTORCYCLE',
                vehicleType: 'MOTORCYCLE',
                status: input.profileStatus ?? 'ACTIVE',
                acceptingNewJobs,
                availability: acceptingNewJobs ? 'AVAILABLE' : 'OFFLINE',
              },
            },
          }
        : {}),
    },
    include: { driverProfile: true },
  });
  createdUserIds.push(user.id);
  return user;
}

before(async () => {
  ({ prisma } = await import('../../database/prisma.js'));
  ({ signAccessToken } = await import('../../utils/jwt.js'));
  ({ hashPassword } = await import('../../utils/password.js'));
  const { app } = await import('../../app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server!.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('Driver profile and availability HTTP contract', () => {
  test('GET profile returns the active Driver operational contract only', async () => {
    const driver = await createUser({ suffix: 'get-active', role: 'DRIVER' });
    const result = await apiFetch('/api/driver/profile', {
      token: tokenFor(driver.id, ['DRIVER']),
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.json.success, true);
    assert.equal(result.json.data?.status, 'ACTIVE');
    assert.equal(result.json.data?.availability, 'AVAILABLE');
    assert.equal(result.json.data?.acceptingNewJobs, true);
    assert.equal(result.json.data?.city, 'Nablus');
    assert.equal(result.json.data?.transportationType, 'MOTORCYCLE');

    for (const forbidden of [
      'displayName',
      'phone',
      'addressLine',
      'availabilityNote',
      'vehicleType',
    ]) {
      assert.equal(forbidden in (result.json.data ?? {}), false, forbidden);
    }
  });

  test('GET profile explains INACTIVE and SUSPENDED DriverProfile states', async () => {
    for (const profileStatus of ['INACTIVE', 'SUSPENDED'] as const) {
      const driver = await createUser({
        suffix: `get-${profileStatus.toLowerCase()}`,
        role: 'DRIVER',
        profileStatus,
        acceptingNewJobs: false,
      });
      const result = await apiFetch('/api/driver/profile', {
        token: tokenFor(driver.id, ['DRIVER']),
      });
      assert.equal(result.response.status, 200);
      assert.equal(result.json.data?.status, profileStatus);
      assert.equal(result.json.data?.acceptingNewJobs, false);
    }
  });

  test('GET profile rejects non-Driver roles', async () => {
    const learner = await createUser({ suffix: 'learner', role: 'LEARNER' });
    const result = await apiFetch('/api/driver/profile', {
      token: tokenFor(learner.id, ['LEARNER']),
    });
    assert.equal(result.response.status, 403);
    assert.equal(result.json.error?.code, 'FORBIDDEN');
  });

  test('PATCH profile normalizes allowed fields and synchronizes transportation mirror', async () => {
    const driver = await createUser({ suffix: 'patch-profile', role: 'DRIVER' });
    const result = await apiFetch('/api/driver/profile', {
      method: 'PATCH',
      token: tokenFor(driver.id, ['DRIVER']),
      body: {
        city: '  Hebron  ',
        area: '  Ein Sara  ',
        transportationType: 'BICYCLE',
        vehicleLabel: '  Blue cargo bicycle  ',
        vehiclePlate: '   ',
        capacityNotes: '  Small boxed materials only  ',
      },
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.json.data?.city, 'Hebron');
    assert.equal(result.json.data?.area, 'Ein Sara');
    assert.equal(result.json.data?.vehicleLabel, 'Blue cargo bicycle');
    assert.equal(result.json.data?.vehiclePlate, null);
    assert.equal(result.json.data?.capacityNotes, 'Small boxed materials only');

    const stored = await prisma.driverProfile.findUniqueOrThrow({
      where: { userId: driver.id },
      select: { transportationType: true, vehicleType: true },
    });
    assert.equal(stored.transportationType, 'BICYCLE');
    assert.equal(stored.vehicleType, 'BICYCLE');
  });

  test('PATCH profile rejects status, raw availability, identity, legacy, and unknown fields', async () => {
    const driver = await createUser({ suffix: 'patch-forbidden', role: 'DRIVER' });
    const token = tokenFor(driver.id, ['DRIVER']);
    const forbiddenBodies = [
      { status: 'SUSPENDED' },
      { availability: 'AVAILABLE' },
      { displayName: 'Changed here' },
      { phone: '+970599999999' },
      { addressLine: 'Private address' },
      { availabilityNote: 'Weekdays' },
      { vehicleType: 'CAR' },
      { city: 'Nablus', unexpected: true },
    ];

    for (const body of forbiddenBodies) {
      const result = await apiFetch('/api/driver/profile', {
        method: 'PATCH',
        token,
        body,
      });
      assert.equal(result.response.status, 400, JSON.stringify(body));
      assert.equal(result.json.error?.code, 'VALIDATION_ERROR');
    }
  });

  test('PATCH availability accepts only acceptingNewJobs', async () => {
    const driver = await createUser({ suffix: 'patch-availability', role: 'DRIVER' });
    const token = tokenFor(driver.id, ['DRIVER']);
    const updated = await apiFetch('/api/driver/profile/availability', {
      method: 'PATCH',
      token,
      body: { acceptingNewJobs: false },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.json.data?.acceptingNewJobs, false);
    assert.equal(updated.json.data?.availability, 'OFFLINE');

    for (const body of [
      { availability: 'OFFLINE' },
      { acceptingNewJobs: false, status: 'INACTIVE' },
      { acceptingNewJobs: 'false' },
      {},
    ]) {
      const result = await apiFetch('/api/driver/profile/availability', {
        method: 'PATCH',
        token,
        body,
      });
      assert.equal(result.response.status, 400, JSON.stringify(body));
      assert.equal(result.json.error?.code, 'VALIDATION_ERROR');
    }
  });

  test('inactive Driver cannot mutate profile or preference', async () => {
    const driver = await createUser({
      suffix: 'inactive-mutation',
      role: 'DRIVER',
      profileStatus: 'INACTIVE',
      acceptingNewJobs: false,
    });
    const token = tokenFor(driver.id, ['DRIVER']);

    const profile = await apiFetch('/api/driver/profile', {
      method: 'PATCH',
      token,
      body: { city: 'Hebron' },
    });
    const preference = await apiFetch('/api/driver/profile/availability', {
      method: 'PATCH',
      token,
      body: { acceptingNewJobs: true },
    });
    assert.equal(profile.response.status, 403);
    assert.equal(preference.response.status, 403);
  });

  test('accept route returns DRIVER_NOT_ACCEPTING_NEW_JOBS', async () => {
    const driver = await createUser({
      suffix: 'accept-offline',
      role: 'DRIVER',
      acceptingNewJobs: false,
    });
    const result = await apiFetch('/api/driver/deliveries/missing-delivery/accept', {
      method: 'POST',
      token: tokenFor(driver.id, ['DRIVER']),
    });
    assert.equal(result.response.status, 409);
    assert.equal(result.json.error?.code, 'DRIVER_NOT_ACCEPTING_NEW_JOBS');
  });
});
