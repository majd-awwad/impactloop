import { prisma } from '../src/database/prisma.js';
import { listSupplierReservations } from '../src/modules/supplier-reservations/supplier-reservations.service.js';

const expiredEnd = new Date(Date.now() - 2 * 60 * 60 * 1000);
const expiredStart = new Date(expiredEnd.getTime() - 2 * 60 * 60 * 1000);

const target = await prisma.reservation.findFirst({
  where: {
    status: 'ACCEPTED',
    deliveries: { some: { status: 'WAITING_FOR_DRIVER', assignedDriverProfileId: null } },
  },
  select: { id: true, ownerId: true },
});

if (!target) {
  console.log('No target reservation');
  process.exit(0);
}

await prisma.reservation.update({
  where: { id: target.id },
  data: {
    pickupWindowStart: expiredStart,
    pickupWindowEnd: expiredEnd,
    supplierPickupWindowStart: expiredStart,
    supplierPickupWindowEnd: expiredEnd,
  },
});

const listed = await listSupplierReservations(target.ownerId, { status: 'accepted' });
const row = listed.find((r) => r.id === target.id);
console.log('After expire SQL simulation:', JSON.stringify({
  id: row?.id,
  canMark: row?.canSupplierMarkDeliveryPickupExpired,
  canReportNoDriver: row?.canReportNoDriverAvailable,
  activeDelivery: row?.activeDelivery,
}, null, 2));

await prisma.$disconnect();
