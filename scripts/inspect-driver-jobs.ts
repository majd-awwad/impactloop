import { prisma } from '../apps/backend/src/database/prisma.js';

async function main() {
  const byStatus = await prisma.delivery.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const waiting = await prisma.delivery.findMany({
    where: {
      status: 'WAITING_FOR_DRIVER',
      assignedDriverProfileId: null,
    },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      pickupLocation: {
        select: {
          city: true,
          area: true,
          latitude: true,
          longitude: true,
        },
      },
      dropoffLocation: {
        select: { city: true, area: true },
      },
    },
    orderBy: { requestedAt: 'desc' },
    take: 20,
  });

  const driver = await prisma.user.findFirst({
    where: { email: 'israaproject850@gmail.com' },
    select: {
      id: true,
      email: true,
      driverProfile: {
        select: {
          id: true,
          city: true,
          area: true,
          availability: true,
          status: true,
        },
      },
    },
  });

  let activeCount = 0;
  if (driver?.driverProfile) {
    activeCount = await prisma.delivery.count({
      where: {
        assignedDriverProfileId: driver.driverProfile.id,
        status: {
          in: [
            'DRIVER_ASSIGNED',
            'ARRIVED_PICKUP',
            'PICKED_UP',
            'ON_THE_WAY',
            'ARRIVED_DROPOFF',
          ],
        },
      },
    });
  }

  console.log('Delivery counts by status:');
  for (const row of byStatus) {
    console.log(`  ${row.status}: ${row._count._all}`);
  }

  console.log(`\nWAITING_FOR_DRIVER unassigned: ${waiting.length}`);
  for (const d of waiting) {
    console.log(
      `  ${d.id} pickup=${d.pickupLocation.city}/${d.pickupLocation.area} coords=${d.pickupLocation.latitude != null}`,
    );
  }

  console.log('\nDriver:', driver?.email);
  console.log('Profile:', driver?.driverProfile);
  console.log('Active deliveries:', activeCount);

  const jobNotifs = await prisma.notification.count({
    where: {
      notificationType: 'DRIVER_DELIVERY_AVAILABLE',
      ...(driver ? { userId: driver.id } : {}),
    },
  });
  console.log('Driver job notifications:', jobNotifs);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
