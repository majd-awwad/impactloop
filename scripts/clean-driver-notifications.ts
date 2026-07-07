/**
 * DEV ONLY — deletes notification rows for driver users.
 *
 * Usage (from apps/backend):
 *   npm run clean-driver-notifications
 *   npm run clean-driver-notifications -- --email israaproject850@gmail.com
 *   npm run clean-driver-notifications -- --all-drivers
 *
 * Only deletes from the notifications table. Never deletes users/deliveries/etc.
 */

import { prisma } from '../apps/backend/src/database/prisma.js';
import { env } from '../apps/backend/src/config/env.js';
import { DRIVER_DELIVERY_NOTIFICATION_TYPES } from '../apps/backend/src/modules/notifications/driver-delivery-notification-types.js';

const assertDevOnly = () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run clean-driver-notifications in production.');
    process.exit(1);
  }

  const databaseUrl = env.databaseUrl.toLowerCase();
  const looksLocal =
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1') ||
    databaseUrl.includes('0.0.0.0');

  if (!looksLocal) {
    console.error(
      'Refusing to run: DATABASE_URL does not look like a local dev database.',
    );
    process.exit(1);
  }
};

const parseArg = (name: string) => {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1]?.trim();
};

async function main() {
  assertDevOnly();

  const allDrivers = process.argv.includes('--all-drivers');
  const email = parseArg('--email') ?? 'israaproject850@gmail.com';

  let userIds: string[] = [];

  if (allDrivers) {
    userIds = (
      await prisma.userRoleAssignment.findMany({
        where: { role: 'DRIVER' },
        select: { userId: true },
      })
    ).map((row) => row.userId);
    console.log(`Target: all driver users (${userIds.length})`);
  } else {
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      console.error(`No user found for email: ${email}`);
      process.exit(1);
    }

    userIds = [user.id];
    console.log(`Target driver: ${user.email}`);
  }

  const before = await prisma.notification.count({
    where: { userId: { in: userIds } },
  });

  const jobAvailableBefore = await prisma.notification.count({
    where: {
      userId: { in: userIds },
      OR: [
        {
          notificationType:
            DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DELIVERY_AVAILABLE,
        },
        { title: 'New delivery job available' },
      ],
    },
  });
  console.log(`Job-available / bad-title rows before: ${jobAvailableBefore}`);

  const deleted = await prisma.notification.deleteMany({
    where: { userId: { in: userIds } },
  });

  const after = await prisma.notification.count({
    where: { userId: { in: userIds } },
  });

  console.log(`Notifications before cleanup: ${before}`);
  console.log(`Deleted: ${deleted.count}`);
  console.log(`Notifications after cleanup: ${after}`);
}

main()
  .catch((error) => {
    console.error('clean-driver-notifications failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
