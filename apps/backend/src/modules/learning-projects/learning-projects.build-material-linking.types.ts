import type { Prisma } from '../../generated/prisma/client.js';

export const linkedMaterialSelect = {
  id: true,
  title: true,
  condition: true,
  status: true,
  isFree: true,
  price: true,
  currency: true,
  pickupAllowed: true,
  deliveryAllowed: true,
  ownerId: true,
  materialType: true,
  unit: true,
  category: {
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
    },
  },
  location: {
    select: {
      city: true,
      area: true,
    },
  },
  images: {
    orderBy: [{ isCover: 'desc' as const }, { sortOrder: 'asc' as const }],
    take: 1,
    select: {
      imageUrl: true,
      isCover: true,
    },
  },
  supplierProfile: {
    select: {
      publicName: true,
      supplierType: true,
      verificationStatus: true,
      user: {
        select: {
          displayName: true,
        },
      },
    },
  },
  owner: {
    select: {
      displayName: true,
    },
  },
} satisfies Prisma.MaterialSelect;

export const linkedReservationSelect = {
  id: true,
  status: true,
  materialId: true,
  quantityRequested: true,
} satisfies Prisma.ReservationSelect;

export type LinkedMaterialRecord = Prisma.MaterialGetPayload<{
  select: typeof linkedMaterialSelect;
}>;

export type LinkedReservationRecord = Prisma.ReservationGetPayload<{
  select: typeof linkedReservationSelect;
}>;
