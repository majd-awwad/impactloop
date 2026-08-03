import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { listEligibleDriverUserIds } from '../notifications/driver-notification-events.service.js';

const MARKER = '[test-dr04-notify-eligibility]';

describe('DR-04 set-based new-job eligibility', () => {
  const createdUserIds: string[] = [];

  before(async () => {
    const prior = await prisma.user.findMany({
      where: { email: { contains: MARKER } },
      select: { id: true },
    });
    if (prior.length) {
      await prisma.user.deleteMany({
        where: { id: { in: prior.map((row) => row.id) } },
      });
    }
  });

  after(async () => {
    if (createdUserIds.length) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  const createDriver = async (input: {
    suffix: string;
    acceptingNewJobs?: boolean;
    profileStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    accountStatus?: 'ACTIVE' | 'SUSPENDED';
  }) => {
    const passwordHash = await hashPassword('TestPassword123!');
    const user = await prisma.user.create({
      data: {
        displayName: `${MARKER} ${input.suffix}`,
        email: `${MARKER}-${input.suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
        passwordHash,
        phone: `+97059${Math.floor(Math.random() * 1_000_000)
          .toString()
          .padStart(6, '0')}`,
        accountStatus: input.accountStatus ?? 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'DRIVER', isPrimary: true }] },
        driverProfile: {
          create: {
            displayName: `${MARKER} ${input.suffix}`,
            phone: `+97058${Math.floor(Math.random() * 1_000_000)
              .toString()
              .padStart(6, '0')}`,
            city: 'Nablus',
            area: 'Center',
            transportationType: 'CAR',
            vehicleType: 'CAR',
            status: input.profileStatus ?? 'ACTIVE',
            availability: 'AVAILABLE',
            acceptingNewJobs: input.acceptingNewJobs ?? true,
          },
        },
      },
      select: { id: true },
    });
    createdUserIds.push(user.id);
    return user;
  };

  test('recipient set excludes paused, inactive, and suspended drivers', async () => {
    const eligible = await createDriver({ suffix: 'eligible' });
    const paused = await createDriver({
      suffix: 'paused',
      acceptingNewJobs: false,
    });
    const inactive = await createDriver({
      suffix: 'inactive-profile',
      profileStatus: 'INACTIVE',
    });
    const suspended = await createDriver({
      suffix: 'suspended-user',
      accountStatus: 'SUSPENDED',
    });

    const recipients = new Set(await listEligibleDriverUserIds());

    assert.equal(recipients.has(eligible.id), true);
    assert.equal(recipients.has(paused.id), false);
    assert.equal(recipients.has(inactive.id), false);
    assert.equal(recipients.has(suspended.id), false);
  });

  test('eligibility implementation is set-based (no per-driver count loop)', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(
      new URL(
        '../notifications/driver-notification-events.service.ts',
        import.meta.url,
      ),
      'utf8',
    );

    assert.match(source, /LEFT JOIN/);
    assert.match(source, /COALESCE\(active\.active_count, 0\)/);
    assert.equal(source.includes('for (const profile of profiles)'), false);
    assert.equal(
      source.includes('prisma.delivery.count({'),
      false,
    );

    const first = new Set(await listEligibleDriverUserIds());
    const second = new Set(await listEligibleDriverUserIds());
    assert.deepEqual([...first].sort(), [...second].sort());
  });
});
