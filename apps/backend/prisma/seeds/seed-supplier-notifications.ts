import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { normalizeSearchText } from '../../src/utils/normalize-search-text.js';

import {
  SEED_SUPPLIER_EMAIL,
} from './supplier-reservations.data.js';

export const SEED_NOTIFICATION_PREFIX = '[seed-notifications]';

const baseDraft = (input: {
  title: string;
  materialName: string;
  requestedCategoryName: string;
  categoryId?: string | null;
  quantity: number;
  unit: string;
  isFree?: boolean;
  price?: number | null;
}) => ({
  materialName: input.materialName,
  title: input.title,
  description: `${input.title} listing draft.`,
  requestedCategoryName: input.requestedCategoryName,
  categoryId: input.categoryId ?? null,
  condition: 'GOOD',
  sourceType: 'WORKSHOP_SURPLUS',
  quantity: input.quantity,
  unit: input.unit,
  isFree: input.isFree ?? false,
  price: input.price ?? null,
  currency: 'NIS',
  pickupAllowed: true,
  deliveryAllowed: false,
  pickupNotes: 'Available weekdays after 3 PM.',
  suggestedUses: 'Workshop and classroom projects.',
  imageUrls: [] as string[],
  _seedMarker: SEED_NOTIFICATION_PREFIX,
});

export async function seedSupplierNotifications(prisma: PrismaClient) {
  const supplier = await prisma.user.findUnique({
    where: { email: SEED_SUPPLIER_EMAIL },
    select: { id: true },
  });

  if (!supplier) {
    console.warn(
      `[seed] Skipping supplier notifications: ${SEED_SUPPLIER_EMAIL} not found.`,
    );
    return;
  }

  const electronics = await prisma.category.findFirst({
    where: { nameEn: 'Electronics', categoryType: 'MATERIAL' },
    select: { id: true, nameEn: true },
  });

  if (!electronics) {
    console.warn('[seed] Skipping supplier notifications: Electronics category missing.');
    return;
  }

  const existing = await prisma.categoryRequest.count({
    where: {
      requestedByUserId: supplier.id,
      OR: [
        { requestedName: { startsWith: SEED_NOTIFICATION_PREFIX } },
        { listingDraftJson: { path: ['_seedMarker'], equals: SEED_NOTIFICATION_PREFIX } },
      ],
    },
  });

  if (existing > 0 && process.env.SEED_FORCE_NOTIFICATIONS !== 'true') {
    console.log('[seed] Supplier notification samples already exist. Skipping.');
    await ensurePublishedNotificationSample(prisma, supplier.id, electronics.id);
    return;
  }

  if (process.env.SEED_FORCE_NOTIFICATIONS === 'true') {
    await prisma.categoryRequest.deleteMany({
      where: {
        requestedByUserId: supplier.id,
        OR: [
          { requestedName: { startsWith: SEED_NOTIFICATION_PREFIX } },
          { listingDraftJson: { path: ['_seedMarker'], equals: SEED_NOTIFICATION_PREFIX } },
        ],
      },
    });
    await prisma.priceRuleRequest.deleteMany({
      where: {
        requestedByUserId: supplier.id,
        OR: [
          { materialName: { startsWith: SEED_NOTIFICATION_PREFIX } },
          { listingDraftJson: { path: ['_seedMarker'], equals: SEED_NOTIFICATION_PREFIX } },
        ],
      },
    });
  }

  await prisma.categoryRequest.create({
    data: {
      requestedName: 'Electronics',
      normalizedRequestedName: normalizeSearchText('Electronics'),
      requestedByUserId: supplier.id,
      status: 'APPROVED',
      approvedCategoryId: electronics.id,
      listingDraftJson: baseDraft({
        title: 'LED components pack',
        materialName: 'LED pack',
        requestedCategoryName: 'Electronics',
        categoryId: electronics.id,
        quantity: 10,
        unit: 'piece',
        isFree: true,
      }),
    },
  });

  await prisma.categoryRequest.create({
    data: {
      requestedName: 'Arduino parts',
      normalizedRequestedName: normalizeSearchText('Arduino parts'),
      requestedByUserId: supplier.id,
      status: 'APPROVED',
      approvedCategoryId: electronics.id,
      listingDraftJson: baseDraft({
        title: 'Arduino starter bundle',
        materialName: 'Arduino Uno bundle',
        requestedCategoryName: 'Arduino parts',
        categoryId: electronics.id,
        quantity: 2,
        unit: 'piece',
        isFree: true,
      }),
    },
  });

  await prisma.categoryRequest.create({
    data: {
      requestedName: 'Robot stuff',
      normalizedRequestedName: normalizeSearchText('Robot stuff'),
      requestedByUserId: supplier.id,
      status: 'APPROVED',
      approvedCategoryId: electronics.id,
      listingDraftJson: baseDraft({
        title: 'Robot motor kit',
        materialName: 'DC motor kit',
        requestedCategoryName: 'Robot stuff',
        categoryId: electronics.id,
        quantity: 1,
        unit: 'set',
        isFree: true,
      }),
    },
  });

  await prisma.categoryRequest.create({
    data: {
      requestedName: 'Random items',
      normalizedRequestedName: normalizeSearchText('Random items'),
      requestedByUserId: supplier.id,
      status: 'REJECTED',
      moderatorNote: 'Please choose a more specific existing category.',
      listingDraftJson: baseDraft({
        title: 'Mixed workshop leftovers',
        materialName: 'Mixed items box',
        requestedCategoryName: 'Random items',
        quantity: 1,
        unit: 'box',
        isFree: true,
      }),
    },
  });

  await prisma.priceRuleRequest.create({
    data: {
      materialName: 'Arduino Uno',
      normalizedMaterialName: normalizeSearchText('Arduino Uno'),
      categoryId: electronics.id,
      unit: 'piece',
      condition: 'GOOD',
      quantity: 4,
      supplierPriceNis: 35,
      requestedByUserId: supplier.id,
      status: 'APPROVED',
      aiSuggestedMaxUnitPriceNis: 20,
      aiSuggestedUnit: 'piece',
      listingDraftJson: baseDraft({
        title: 'Arduino Uno',
        materialName: 'Arduino Uno',
        requestedCategoryName: electronics.nameEn,
        categoryId: electronics.id,
        quantity: 4,
        unit: 'piece',
        isFree: false,
        price: 35,
      }),
    },
  });

  await prisma.priceRuleRequest.create({
    data: {
      materialName: 'Epoxy resin bottle',
      normalizedMaterialName: normalizeSearchText('Epoxy resin bottle'),
      categoryId: electronics.id,
      unit: 'bottle',
      condition: 'NEW',
      quantity: 2,
      supplierPriceNis: 45,
      requestedByUserId: supplier.id,
      status: 'REJECTED',
      aiSuggestedMaxUnitPriceNis: 25,
      aiSuggestedUnit: 'bottle',
      moderatorNote: 'Unit price exceeds the approved limit.',
      listingDraftJson: baseDraft({
        title: 'Epoxy resin bottle',
        materialName: 'Epoxy resin bottle',
        requestedCategoryName: electronics.nameEn,
        categoryId: electronics.id,
        quantity: 2,
        unit: 'bottle',
        isFree: false,
        price: 45,
      }),
    },
  });

  await ensurePublishedNotificationSample(prisma, supplier.id, electronics.id);

  console.log('[seed] Supplier notification samples created.');
}

const PUBLISHED_SAMPLE_NAME = 'Published listing';

async function ensurePublishedNotificationSample(
  prisma: PrismaClient,
  supplierUserId: string,
  electronicsCategoryId: string,
) {
  const existing = await prisma.categoryRequest.findFirst({
    where: {
      requestedByUserId: supplierUserId,
      requestedName: PUBLISHED_SAMPLE_NAME,
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  const publishedMaterial = await prisma.material.findFirst({
    where: { ownerId: supplierUserId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!publishedMaterial) {
    console.warn(
      '[seed] Skipping published notification sample: no supplier material found.',
    );
    return;
  }

  await prisma.categoryRequest.create({
    data: {
      requestedName: PUBLISHED_SAMPLE_NAME,
      normalizedRequestedName: normalizeSearchText(PUBLISHED_SAMPLE_NAME),
      requestedByUserId: supplierUserId,
      status: 'APPROVED',
      approvedCategoryId: electronicsCategoryId,
      publishedMaterialId: publishedMaterial.id,
      publishedAt: new Date(),
      listingDraftJson: baseDraft({
        title: 'Already published sample',
        materialName: 'Published LED kit',
        requestedCategoryName: 'Electronics',
        categoryId: electronicsCategoryId,
        quantity: 1,
        unit: 'set',
        isFree: true,
      }),
    },
  });
}
