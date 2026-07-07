import { listAvailableDeliveries } from '../apps/backend/src/modules/driver/driver.service.js';
import { prisma } from '../apps/backend/src/database/prisma.js';

async function main() {
  const driver = await prisma.user.findFirst({
    where: { email: 'israaproject850@gmail.com' },
    select: { id: true },
  });

  if (!driver) {
    console.log('Driver not found');
    return;
  }

  const open = await listAvailableDeliveries(driver.id);
  console.log('Open filter jobs:', open.deliveries.length);
  for (const job of open.deliveries) {
    console.log(`  ${job.id} ${job.materialTitle} ${job.pickupLocation?.city}`);
  }

  const nablusFiltered = await listAvailableDeliveries(driver.id, {
    city: 'nablus',
    area: 'rafidia',
  });
  console.log('Nablus/Rafidia filtered jobs:', nablusFiltered.deliveries.length);

  const notifs = await prisma.notification.count({
    where: {
      userId: driver.id,
      notificationType: 'DRIVER_DELIVERY_AVAILABLE',
      isRead: false,
    },
  });
  console.log('Unread job notifications:', notifs);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const notifsAfter = await prisma.notification.count({
    where: {
      userId: driver.id,
      notificationType: 'DRIVER_DELIVERY_AVAILABLE',
    },
  });
  console.log('Job notifications after ensure:', notifsAfter);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
