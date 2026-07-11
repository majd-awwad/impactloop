import type { PrismaClient } from '../../src/generated/prisma/client.js';

import { SEED_SUPPLIER_EMAIL } from './supplier-reservations.data.js';
import {
  myMaterialsSeedMarker,
  MY_MATERIALS_SEED_PREFIX,
  SUPPLIER_MY_MATERIALS_SEED,
  type SupplierMyMaterialSeedSpec,
} from './supplier-my-materials.data.js';

const DEFAULT_ELECTRONICS_IMAGE =
  'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=1200&q=80';

const shouldForceReseed = (): boolean =>
  process.env.SEED_FORCE_SUPPLIER_MATERIALS === 'true';

const locationKey = (location: SupplierMyMaterialSeedSpec['location']): string =>
  `${location.country}|${location.city}|${location.area}`;

async function ensureLocation(
  prisma: PrismaClient,
  location: SupplierMyMaterialSeedSpec['location'],
) {
  const existing = await prisma.location.findFirst({
    where: {
      country: location.country,
      city: location.city,
      area: location.area,
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.location.create({
    data: {
      country: location.country,
      city: location.city,
      area: location.area,
      visibility: 'PUBLIC_APPROXIMATE',
      isApproximate: true,
    },
    select: { id: true },
  });

  return created.id;
}

async function syncMaterialImages(
  prisma: PrismaClient,
  materialId: string,
  imageUrls: string[],
) {
  await prisma.materialImage.deleteMany({ where: { materialId } });

  if (imageUrls.length === 0) {
    return;
  }

  await prisma.materialImage.createMany({
    data: imageUrls.map((imageUrl, index) => ({
      materialId,
      imageUrl,
      sortOrder: index,
      isCover: index === 0,
    })),
  });
}

async function removeMyMaterialsSeed(prisma: PrismaClient, ownerId: string) {
  const seededMaterials = await prisma.material.findMany({
    where: {
      ownerId,
      description: { startsWith: MY_MATERIALS_SEED_PREFIX },
    },
    select: { id: true },
  });

  if (seededMaterials.length === 0) {
    return 0;
  }

  await prisma.material.deleteMany({
    where: { id: { in: seededMaterials.map((material) => material.id) } },
  });

  return seededMaterials.length;
}

async function resolveCategoryIdByName(
  prisma: PrismaClient,
  categoryNameEn: string,
) {
  const category = await prisma.category.findFirst({
    where: { nameEn: categoryNameEn },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!category) {
    throw new Error(
      `Category "${categoryNameEn}" not found. Run main seed first.`,
    );
  }

  return category.id;
}

async function upsertMyMaterial(
  prisma: PrismaClient,
  ownerId: string,
  supplierProfileId: string,
  locationId: string,
  spec: SupplierMyMaterialSeedSpec,
) {
  const categoryId = await resolveCategoryIdByName(prisma, spec.categoryNameEn);
  const marker = myMaterialsSeedMarker(spec.key);
  const description = `${marker}\n${spec.summary}`;

  const existing = await prisma.material.findFirst({
    where: {
      ownerId,
      description: { startsWith: marker },
    },
    select: { id: true },
  });

  const data = {
    ownerId,
    supplierProfileId,
    categoryId,
    locationId,
    title: spec.title,
    description,
    materialType: spec.materialType,
    quantity: spec.quantity,
    unit: spec.unit,
    condition: spec.condition,
    sourceType: 'WORKSHOP_SURPLUS' as const,
    status: spec.status,
    isFree: spec.isFree,
    price: spec.price,
    currency: 'NIS',
    pickupAllowed: spec.pickupAllowed,
    deliveryAllowed: spec.deliveryAllowed,
    viewsCount: spec.viewsCount,
    reusedAt: spec.status === 'REUSED' ? new Date() : null,
  };

  const material = existing
    ? await prisma.material.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.material.create({ data });

  await syncMaterialImages(prisma, material.id, spec.imageUrls);

  if (spec.tags?.length) {
    await prisma.materialTag.deleteMany({ where: { materialId: material.id } });
    await prisma.materialTag.createMany({
      data: spec.tags.map((tag) => ({ materialId: material.id, tag })),
    });
  }

  return material.title;
}

async function ensureMissingMaterialImages(
  prisma: PrismaClient,
  ownerId: string,
) {
  const materialsWithoutImages = await prisma.material.findMany({
    where: {
      ownerId,
      images: { none: {} },
    },
    select: { id: true },
  });

  if (materialsWithoutImages.length === 0) {
    return 0;
  }

  await prisma.materialImage.createMany({
    data: materialsWithoutImages.map((material) => ({
      materialId: material.id,
      imageUrl: DEFAULT_ELECTRONICS_IMAGE,
      sortOrder: 0,
      isCover: true,
    })),
  });

  return materialsWithoutImages.length;
}

export async function seedSupplierMaterials(prisma: PrismaClient) {
  const supplier = await prisma.user.findUnique({
    where: { email: SEED_SUPPLIER_EMAIL },
    include: { supplierProfile: true },
  });

  if (!supplier?.supplierProfile) {
    console.log(
      'Supplier materials seed skipped: seed supplier account not found.',
    );
    return {
      skipped: true,
      reason: 'missing_seed_supplier',
      materialsSeeded: [] as string[],
      supplierEmail: SEED_SUPPLIER_EMAIL,
    };
  }

  if (shouldForceReseed()) {
    const removedCount = await removeMyMaterialsSeed(prisma, supplier.id);
    if (removedCount > 0) {
      console.log(
        `Removed ${removedCount} existing my-materials seed listings.`,
      );
    }
  }

  const locationIds = new Map<string, string>();
  const materialsSeeded: string[] = [];
  const categoryCounts = new Map<string, number>();

  for (const spec of SUPPLIER_MY_MATERIALS_SEED) {
    const locationCacheKey = locationKey(spec.location);
    let locationId = locationIds.get(locationCacheKey);

    if (!locationId) {
      locationId = await ensureLocation(prisma, spec.location);
      locationIds.set(locationCacheKey, locationId);
    }

    const title = await upsertMyMaterial(
      prisma,
      supplier.id,
      supplier.supplierProfile.id,
      locationId,
      spec,
    );

    materialsSeeded.push(title);
    categoryCounts.set(
      spec.categoryNameEn,
      (categoryCounts.get(spec.categoryNameEn) ?? 0) + 1,
    );
  }

  const imagesAdded = await ensureMissingMaterialImages(prisma, supplier.id);
  if (imagesAdded > 0) {
    console.log(`Added default images to ${imagesAdded} materials.`);
  }

  console.log('Supplier materials seed complete.');
  console.log(`  Supplier login: ${SEED_SUPPLIER_EMAIL}`);
  console.log(`  My materials seeded: ${materialsSeeded.length}`);
  console.log('  Materials per category:');
  for (const [categoryName, count] of [...categoryCounts.entries()].sort()) {
    console.log(`    - ${categoryName}: ${count}`);
  }

  return {
    skipped: false,
    materialsSeeded,
    supplierEmail: SEED_SUPPLIER_EMAIL,
    forceApplied: shouldForceReseed(),
    categoryCounts: Object.fromEntries(categoryCounts),
  };
}

/** @deprecated Use seedSupplierMaterials */
export const seedSupplierMyMaterials = seedSupplierMaterials;
