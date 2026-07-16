import { prisma } from '../src/database/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { saveLearningProjectById } from '../src/modules/learning-projects/learning-projects.service.js';
import {
  linkBuildItemMaterialById,
  startProjectBuildById,
  updateProjectBuildItemById,
} from '../src/modules/learning-projects/learning-projects.service.js';

export const FIXTURE_MARKER = 'AI_PHASE2_E2E';
export const FIXTURE_EMAIL_LEARNER_A = 'ai-phase2-e2e-learner-a@impactloop.test';
export const FIXTURE_EMAIL_LEARNER_B = 'ai-phase2-e2e-learner-b@impactloop.test';
export const FIXTURE_EMAIL_SUPPLIER = 'ai-phase2-e2e-supplier@impactloop.test';

export type Phase2E2EFixture = {
  learnerAId: string;
  learnerBId: string;
  supplierId: string;
  materialCategoryId: string;
  projectCategoryId: string;
  learnerLocationId: string;
  freeNearbyMaterialId: string;
  paidUnder20MaterialId: string;
  paidAbove20MaterialId: string;
  reservedMaterialId: string;
  unavailableMaterialId: string;
  compatibleMaterialId: string;
  incompatibleMaterialId: string;
  reservableMaterialId: string;
  robotCarProjectId: string;
  buildId: string;
  ownedBuildItemId: string;
  missingBuildItemId: string;
  savedProjectId: string;
  createdUserIds: string[];
  createdLocationIds: string[];
  createdMaterialIds: string[];
  createdProjectIds: string[];
  createdBuildIds: string[];
  createdCategoryIds: string[];
};

const title = (suffix: string) => `${FIXTURE_MARKER} ${suffix}`;

const futurePickupWindow = (hoursFromNow = 72) => {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  return { start, end };
};

async function upsertLearner(email: string, label: string, withCoordinates: boolean) {
  const passwordHash = await hashPassword('Phase2E2ePassword!');

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        displayName: `${FIXTURE_MARKER} ${label}`,
        email,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
        learnerProfile: {
          create: {
            learnerType: 'STUDENT',
            skillLevel: 'BEGINNER',
            interests: ['arduino', 'robotics', 'electronics'],
          },
        },
      },
    });
  } else {
    await prisma.learnerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        learnerType: 'STUDENT',
        skillLevel: 'BEGINNER',
        interests: ['arduino', 'robotics', 'electronics'],
      },
      update: {
        interests: ['arduino', 'robotics', 'electronics'],
      },
    });
  }

  if (withCoordinates) {
    const existingSaved = await prisma.userSavedLocation.findFirst({
      where: { userId: user.id, label: `${FIXTURE_MARKER} Home` },
      include: { location: true },
    });

    let locationId = existingSaved?.locationId;
    if (!locationId) {
      const location = await prisma.location.create({
        data: {
          country: 'PS',
          city: 'Nablus',
          area: 'Rafidia',
          latitude: 32.2211,
          longitude: 35.2544,
          visibility: 'PRIVATE',
          isApproximate: true,
        },
      });
      locationId = location.id;
      await prisma.userSavedLocation.create({
        data: {
          userId: user.id,
          locationId,
          label: `${FIXTURE_MARKER} Home`,
          isDefault: true,
        },
      });
    } else {
      await prisma.$executeRaw`
        UPDATE locations
        SET latitude = ${32.2211}, longitude = ${35.2544},
            city = 'Nablus', area = 'Rafidia'
        WHERE id = ${locationId}
      `;
    }
  }

  return user;
}

async function upsertSupplier() {
  const passwordHash = await hashPassword('Phase2E2ePassword!');
  let user = await prisma.user.findUnique({ where: { email: FIXTURE_EMAIL_SUPPLIER } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        displayName: `${FIXTURE_MARKER} Supplier`,
        email: FIXTURE_EMAIL_SUPPLIER,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
        supplierProfile: {
          create: {
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: `${FIXTURE_MARKER} Public Supplier`,
            verificationStatus: 'APPROVED',
          },
        },
      },
    });
  } else {
    await prisma.supplierProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        supplierType: 'INDIVIDUAL_SUPPLIER',
        publicName: `${FIXTURE_MARKER} Public Supplier`,
        verificationStatus: 'APPROVED',
      },
      update: {
        publicName: `${FIXTURE_MARKER} Public Supplier`,
        verificationStatus: 'APPROVED',
      },
    });
  }
  return user;
}

async function cleanupFixtureData() {
  const fixtureUsers = await prisma.user.findMany({
    where: {
      email: {
        in: [FIXTURE_EMAIL_LEARNER_A, FIXTURE_EMAIL_LEARNER_B, FIXTURE_EMAIL_SUPPLIER],
      },
    },
    select: { id: true },
  });
  const userIds = fixtureUsers.map((user) => user.id);
  if (userIds.length === 0) {
    return;
  }

  const materials = await prisma.material.findMany({
    where: { title: { startsWith: FIXTURE_MARKER } },
    select: { id: true },
  });
  const materialIds = materials.map((material) => material.id);

  const projects = await prisma.learningProject.findMany({
    where: { title: { startsWith: FIXTURE_MARKER } },
    select: { id: true },
  });
  const projectIds = projects.map((project) => project.id);

  if (materialIds.length > 0) {
    await prisma.reservation.deleteMany({ where: { materialId: { in: materialIds } } });
    await prisma.materialLike.deleteMany({ where: { materialId: { in: materialIds } } });
    await prisma.material.deleteMany({ where: { id: { in: materialIds } } });
  }

  if (projectIds.length > 0) {
    await prisma.projectBuild.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.projectSave.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.learningProject.deleteMany({ where: { id: { in: projectIds } } });
  }

  await prisma.aiConversation.deleteMany({ where: { userId: { in: userIds } } });

  const categories = await prisma.category.findMany({
    where: { nameEn: { startsWith: FIXTURE_MARKER } },
    select: { id: true },
  });
  if (categories.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: categories.map((category) => category.id) } },
    });
  }
}

async function createMaterial(input: {
  supplierId: string;
  categoryId: string;
  locationId: string;
  suffix: string;
  status: 'AVAILABLE' | 'RESERVED' | 'UNAVAILABLE';
  isFree: boolean;
  price?: number;
  materialType: string;
  quantity?: number;
  latitude?: number;
  longitude?: number;
}) {
  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: input.supplierId },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: input.supplierId,
      supplierProfileId: supplierProfile?.id,
      categoryId: input.categoryId,
      locationId: input.locationId,
      title: title(input.suffix),
      description: `${FIXTURE_MARKER} deterministic E2E material`,
      materialType: input.materialType,
      quantity: input.quantity ?? 5,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: input.status,
      isFree: input.isFree,
      price: input.isFree ? null : input.price ?? 15,
      currency: 'NIS',
      pickupAllowed: true,
      deliveryAllowed: false,
    },
  });

  if (input.latitude != null && input.longitude != null) {
    await prisma.$executeRaw`
      UPDATE locations
      SET latitude = ${input.latitude}, longitude = ${input.longitude}
      WHERE id = ${input.locationId}
    `;
  }

  return material;
}

export async function setupPhase2E2EFixture(): Promise<Phase2E2EFixture> {
  await cleanupFixtureData();

  const learnerA = await upsertLearner(FIXTURE_EMAIL_LEARNER_A, 'Learner A', true);
  const learnerB = await upsertLearner(FIXTURE_EMAIL_LEARNER_B, 'Learner B', true);
  const supplier = await upsertSupplier();

  const learnerSaved = await prisma.userSavedLocation.findFirst({
    where: { userId: learnerA.id, isDefault: true },
  });
  if (!learnerSaved) {
    throw new Error('Fixture learner A saved location missing');
  }

  const { getCategories } = await import('../src/modules/categories/categories.service.js');
  const discoveryCategories = await getCategories({
    type: 'MATERIAL',
    rootOnly: true,
    discoveryOnly: true,
  });
  const materialCategory =
    discoveryCategories.find((category) =>
      category.nameEn.toLowerCase().includes('electronics'),
    ) ??
    (await prisma.category.create({
      data: {
        nameEn: title('Electronics'),
        nameAr: 'إلكترونيات E2E',
        categoryType: 'BOTH',
        isActive: true,
      },
    }));

  const projectCategory = await prisma.category.create({
    data: {
      nameEn: title('Robotics'),
      nameAr: 'روبوتات E2E',
      categoryType: 'PROJECT',
      isActive: true,
    },
  });

  const nearLocation = await prisma.location.create({
    data: {
      country: 'PS',
      city: 'Nablus',
      area: 'Rafidia',
      latitude: 32.2212,
      longitude: 35.2545,
      visibility: 'PUBLIC',
      isApproximate: false,
    },
  });

  const farLocation = await prisma.location.create({
    data: {
      country: 'PS',
      city: 'Ramallah',
      area: 'Al-Bireh',
      latitude: 31.9038,
      longitude: 35.2034,
      visibility: 'PUBLIC',
      isApproximate: false,
    },
  });

  const freeNearby = await createMaterial({
    supplierId: supplier.id,
    categoryId: materialCategory.id,
    locationId: nearLocation.id,
    suffix: 'free nearby LED',
    status: 'AVAILABLE',
    isFree: true,
    materialType: 'LED',
    latitude: 32.2212,
    longitude: 35.2545,
  });

  const paidUnder20 = await createMaterial({
    supplierId: supplier.id,
    categoryId: materialCategory.id,
    locationId: nearLocation.id,
    suffix: 'paid under 20 resistor',
    status: 'AVAILABLE',
    isFree: false,
    price: 15,
    materialType: 'Resistor',
    latitude: 32.2213,
    longitude: 35.2546,
  });

  const paidAbove20 = await createMaterial({
    supplierId: supplier.id,
    categoryId: materialCategory.id,
    locationId: nearLocation.id,
    suffix: 'paid above 20 motor',
    status: 'AVAILABLE',
    isFree: false,
    price: 35,
    materialType: 'DC motor',
    latitude: 32.2214,
    longitude: 35.2547,
  });

  const reserved = await createMaterial({
    supplierId: supplier.id,
    categoryId: materialCategory.id,
    locationId: nearLocation.id,
    suffix: 'reserved sensor',
    status: 'RESERVED',
    isFree: true,
    materialType: 'Sensor',
  });

  const unavailable = await createMaterial({
    supplierId: supplier.id,
    categoryId: materialCategory.id,
    locationId: nearLocation.id,
    suffix: 'unavailable board',
    status: 'UNAVAILABLE',
    isFree: true,
    materialType: 'Arduino board',
  });

  const compatible = await createMaterial({
    supplierId: supplier.id,
    categoryId: materialCategory.id,
    locationId: nearLocation.id,
    suffix: 'compatible LED pack',
    status: 'AVAILABLE',
    isFree: true,
    materialType: 'LED',
    quantity: 10,
  });

  const ownedMotorMaterial = await createMaterial({
    supplierId: supplier.id,
    categoryId: materialCategory.id,
    locationId: nearLocation.id,
    suffix: 'owned motor material',
    status: 'AVAILABLE',
    isFree: true,
    materialType: 'DC motor',
    quantity: 2,
  });

  const incompatible = await createMaterial({
    supplierId: supplier.id,
    categoryId: materialCategory.id,
    locationId: farLocation.id,
    suffix: 'incompatible plywood',
    status: 'AVAILABLE',
    isFree: true,
    materialType: 'Plywood panel',
  });

  const reservable = await createMaterial({
    supplierId: supplier.id,
    categoryId: materialCategory.id,
    locationId: nearLocation.id,
    suffix: 'reservable breadboard',
    status: 'AVAILABLE',
    isFree: true,
    materialType: 'Breadboard',
    quantity: 8,
    latitude: 32.2215,
    longitude: 35.2548,
  });

  const arduinoStarter = await prisma.learningProject.create({
    data: {
      categoryId: projectCategory.id,
      createdBy: learnerA.id,
      title: title('Arduino Starter'),
      shortDescription: `${FIXTURE_MARKER} saved starter project`,
      description: `${FIXTURE_MARKER} saved project for learner context`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      tags: { create: [{ tag: 'arduino' }] },
    },
  });

  const robotCar = await prisma.learningProject.create({
    data: {
      categoryId: projectCategory.id,
      createdBy: learnerA.id,
      title: title('Robot Car'),
      shortDescription: `${FIXTURE_MARKER} robotics starter`,
      description: `${FIXTURE_MARKER} Robot Car project with motor and LED`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      tags: { create: [{ tag: 'arduino' }, { tag: 'robotics' }] },
      requiredComponents: {
        create: [
          {
            componentName: 'DC Motor',
            materialType: 'DC motor',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: materialCategory.id,
            searchKeywords: ['motor', 'dc'],
          },
          {
            componentName: 'LED',
            materialType: 'LED',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: materialCategory.id,
            searchKeywords: ['led'],
          },
        ],
      },
    },
    include: { requiredComponents: true },
  });

  await saveLearningProjectById(arduinoStarter.id, learnerA.id);
  await saveLearningProjectById(robotCar.id, learnerA.id);

  const build = await startProjectBuildById(robotCar.id, learnerA.id);
  const motorItem = build.items.find((item) =>
    item.component?.componentName?.includes('Motor'),
  );
  const ledItem = build.items.find((item) => item.component?.componentName === 'LED');
  if (!motorItem || !ledItem) {
    throw new Error('Fixture build items missing');
  }

  await linkBuildItemMaterialById(
    robotCar.id,
    learnerA.id,
    motorItem.id,
    ownedMotorMaterial.id,
  );
  await updateProjectBuildItemById(robotCar.id, learnerA.id, motorItem.id, {
    status: 'ALREADY_OWNED',
    learnerNote: null,
  });
  await updateProjectBuildItemById(robotCar.id, learnerA.id, ledItem.id, {
    status: 'MISSING',
    learnerNote: null,
  });

  const pickup = futurePickupWindow();
  await prisma.supplierProfile.update({
    where: { userId: supplier.id },
    data: {
      defaultPickupLocationId: nearLocation.id,
    },
  });

  return {
    learnerAId: learnerA.id,
    learnerBId: learnerB.id,
    supplierId: supplier.id,
    materialCategoryId: materialCategory.id,
    projectCategoryId: projectCategory.id,
    learnerLocationId: learnerSaved.locationId,
    freeNearbyMaterialId: freeNearby.id,
    paidUnder20MaterialId: paidUnder20.id,
    paidAbove20MaterialId: paidAbove20.id,
    reservedMaterialId: reserved.id,
    unavailableMaterialId: unavailable.id,
    compatibleMaterialId: compatible.id,
    incompatibleMaterialId: incompatible.id,
    reservableMaterialId: reservable.id,
    robotCarProjectId: robotCar.id,
    buildId: build.id,
    ownedBuildItemId: motorItem.id,
    missingBuildItemId: ledItem.id,
    savedProjectId: arduinoStarter.id,
    createdUserIds: [learnerA.id, learnerB.id, supplier.id],
    createdLocationIds: [nearLocation.id, farLocation.id],
    createdMaterialIds: [
      freeNearby.id,
      paidUnder20.id,
      paidAbove20.id,
      reserved.id,
      unavailable.id,
      compatible.id,
      ownedMotorMaterial.id,
      incompatible.id,
      reservable.id,
    ],
    createdProjectIds: [arduinoStarter.id, robotCar.id],
    createdBuildIds: [build.id],
    createdCategoryIds: [projectCategory.id],
  };
}

export async function teardownPhase2E2EFixture() {
  await cleanupFixtureData();
}
