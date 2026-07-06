import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { hashPassword } from '../../src/utils/password.js';

import {
  buildPickupWindow,
  countSeedReservations,
  reservationSeedMessage,
  reservationSeedMessagePrefix,
  SEED_LEARNERS,
  SEED_MATERIALS,
  SEED_PASSWORD,
  SEED_RESERVATIONS,
  SEED_RESERVATION_PREFIX,
  SEED_SUPPLIER_EMAIL,
  type SeedContext,
} from './supplier-reservations.data.js';

const shouldForceReseed = (): boolean =>
  process.env.SEED_FORCE_RESERVATIONS === 'true';

async function ensureSeedSupplier(prisma: PrismaClient) {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  let user = await prisma.user.findUnique({
    where: { email: SEED_SUPPLIER_EMAIL },
    include: { supplierProfile: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        displayName: 'Seed Supplier',
        email: SEED_SUPPLIER_EMAIL,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: {
          create: [{ role: 'SUPPLIER', isPrimary: true }],
        },
        supplierProfile: {
          create: {
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: 'Seed Supplier Workshop',
            description: 'Seed account for supplier portal reservation testing.',
            verificationStatus: 'VERIFIED',
          },
        },
      },
      include: { supplierProfile: true },
    });
  }

  if (!user.supplierProfile) {
    const profile = await prisma.supplierProfile.create({
      data: {
        userId: user.id,
        supplierType: 'INDIVIDUAL_SUPPLIER',
        publicName: 'Seed Supplier Workshop',
        description: 'Seed account for supplier portal reservation testing.',
        verificationStatus: 'VERIFIED',
      },
    });
    user = { ...user, supplierProfile: profile };
  }

  return user;
}

async function ensureSeedLearners(prisma: PrismaClient) {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const learnerIds = new Map<string, string>();

  for (const learner of SEED_LEARNERS) {
    let user = await prisma.user.findUnique({
      where: { email: learner.email },
      select: { id: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          displayName: learner.displayName,
          email: learner.email,
          passwordHash,
          accountStatus: 'ACTIVE',
          emailVerifiedAt: new Date(),
          roles: {
            create: [{ role: 'LEARNER', isPrimary: true }],
          },
          learnerProfile: {
            create: {
              learnerType: 'STUDENT',
              bio: 'Seed learner account for reservation testing.',
            },
          },
        },
        select: { id: true },
      });
    }

    learnerIds.set(learner.email, user.id);
  }

  return learnerIds;
}

async function ensureSeedLocation(
  prisma: PrismaClient,
  supplierUserId: string,
  supplierProfileId: string,
) {
  const existingProfile = await prisma.supplierProfile.findUnique({
    where: { id: supplierProfileId },
    select: { defaultPickupLocationId: true },
  });

  if (existingProfile?.defaultPickupLocationId) {
    return existingProfile.defaultPickupLocationId;
  }

  const location = await prisma.location.create({
    data: {
      country: 'Palestine',
      city: 'Ramallah',
      area: 'Al-Bireh',
      addressLine: 'Seed pickup location',
      latitude: 31.9038,
      longitude: 35.2034,
      locationType: 'PICKUP',
      visibility: 'PRIVATE',
      isApproximate: true,
    },
    select: { id: true },
  });

  await prisma.supplierProfile.update({
    where: { id: supplierProfileId },
    data: { defaultPickupLocationId: location.id },
  });

  return location.id;
}

async function ensureSeedCategory(prisma: PrismaClient) {
  const category = await prisma.category.findFirst({
    where: { categoryType: 'MATERIAL' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!category) {
    throw new Error(
      'No MATERIAL category found. Run taxonomy seed first (prisma db seed).',
    );
  }

  return category.id;
}

async function replaceSeedMaterialImage(
  prisma: PrismaClient,
  materialId: string,
  imageUrl: string,
) {
  await prisma.materialImage.deleteMany({
    where: { materialId },
  });

  await prisma.materialImage.create({
    data: {
      materialId,
      imageUrl,
      sortOrder: 0,
      isCover: true,
    },
  });
}

async function ensureSeedMaterials(
  prisma: PrismaClient,
  context: Pick<SeedContext, 'supplierUserId' | 'supplierProfileId' | 'categoryId' | 'locationId'>,
) {
  const materialIds = new Map<string, string>();

  for (const material of SEED_MATERIALS) {
    const marker = `${SEED_RESERVATION_PREFIX} material:${material.key}`;
    const existing = await prisma.material.findFirst({
      where: {
        ownerId: context.supplierUserId,
        description: marker,
      },
      select: { id: true },
    });

    if (existing) {
      await replaceSeedMaterialImage(prisma, existing.id, material.imageUrl);
      materialIds.set(material.key, existing.id);
      continue;
    }

    const created = await prisma.material.create({
      data: {
        ownerId: context.supplierUserId,
        supplierProfileId: context.supplierProfileId,
        categoryId: context.categoryId,
        title: material.title,
        description: marker,
        materialType: material.materialType,
        quantity: material.quantity,
        unit: material.unit,
        condition: material.condition,
        sourceType: material.sourceType,
        status: 'AVAILABLE',
        isFree: true,
        locationId: context.locationId,
        pickupAllowed: true,
        deliveryAllowed: false,
        pickupNotes: 'Seed material for reservation testing.',
      },
      select: { id: true },
    });

    await replaceSeedMaterialImage(prisma, created.id, material.imageUrl);
    materialIds.set(material.key, created.id);
  }

  return materialIds;
}

async function createSeedReservations(
  prisma: PrismaClient,
  context: SeedContext,
) {
  for (const spec of SEED_RESERVATIONS) {
    const messagePrefix = reservationSeedMessagePrefix(spec.key);
    const existing = await prisma.reservation.findFirst({
      where: { message: { startsWith: messagePrefix } },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    const materialId = context.materialIds.get(spec.materialKey);
    const requesterId = context.learnerIds.get(spec.learnerEmail);

    if (!materialId || !requesterId) {
      console.warn(`Skipping reservation ${spec.key}: missing material or learner.`);
      continue;
    }

    const pickupWindow = spec.pickupWindow
      ? buildPickupWindow(spec.pickupWindow)
      : null;

    const now = new Date();
    const acceptedAt =
      spec.status === 'ACCEPTED' || spec.status === 'COMPLETED' ? now : null;
    const rejectedAt = spec.status === 'REJECTED' ? now : null;
    const completedAt =
      spec.status === 'COMPLETED'
        ? (() => {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() + (spec.completedOffsetDays ?? -1));
            date.setHours(14, 0, 0, 0);
            return date;
          })()
        : null;

    await prisma.reservation.create({
      data: {
        materialId,
        requesterId,
        ownerId: context.supplierUserId,
        quantityRequested: spec.quantityRequested,
        message: reservationSeedMessage(spec.key, spec.learnerMessage),
        status: spec.status,
        pickupWindowStart: pickupWindow?.start ?? null,
        pickupWindowEnd: pickupWindow?.end ?? null,
        supplierNote: spec.supplierNote ?? null,
        rejectionReason: spec.rejectionReason ?? null,
        acceptedAt,
        rejectedAt,
        completedAt,
      },
    });
  }
}

export async function seedSupplierReservations(prisma: PrismaClient) {
  const existingCount = await countSeedReservations(prisma);

  if (existingCount > 0 && !shouldForceReseed()) {
    console.log(
      `Skipping reservation seed (${existingCount} seed reservations already exist). Set SEED_FORCE_RESERVATIONS=true to recreate.`,
    );
    return {
      skipped: true,
      existingCount,
      supplierEmail: SEED_SUPPLIER_EMAIL,
    };
  }

  if (existingCount > 0 && shouldForceReseed()) {
    await prisma.reservation.deleteMany({
      where: { message: { startsWith: SEED_RESERVATION_PREFIX } },
    });
    console.log(`Removed ${existingCount} existing seed reservations.`);
  }

  const supplier = await ensureSeedSupplier(prisma);
  const supplierProfileId = supplier.supplierProfile!.id;
  const learnerIds = await ensureSeedLearners(prisma);
  const categoryId = await ensureSeedCategory(prisma);
  const locationId = await ensureSeedLocation(
    prisma,
    supplier.id,
    supplierProfileId,
  );
  const materialIds = await ensureSeedMaterials(prisma, {
    supplierUserId: supplier.id,
    supplierProfileId,
    categoryId,
    locationId,
  });

  await createSeedReservations(prisma, {
    supplierUserId: supplier.id,
    supplierProfileId,
    categoryId,
    locationId,
    learnerIds,
    materialIds,
  });

  const createdCount = await countSeedReservations(prisma);

  console.log('Supplier reservation seed complete.');
  console.log(`  Supplier login: ${SEED_SUPPLIER_EMAIL} / ${SEED_PASSWORD}`);
  console.log(`  Seed reservations: ${createdCount}`);
  console.log('  Tabs to verify:');
  console.log('    Incoming Requests → Pending / Accepted / Declined / Completed');
  console.log('    Pickup Schedule → Today / Upcoming / Completed / All');

  return {
    skipped: false,
    existingCount: createdCount,
    supplierEmail: SEED_SUPPLIER_EMAIL,
  };
}
