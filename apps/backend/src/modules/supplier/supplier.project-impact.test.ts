import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';

import {
  linkBuildItemMaterialById,
  startProjectBuildById,
} from '../learning-projects/learning-projects.service.js';
import { createReservation } from '../reservations/reservations.service.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';
import { getSupplierProjectSupportSummary } from './supplier-project-impact.js';
import { getSupplierDashboard } from './supplier.service.js';

const TEST_MARKER = '[test-supplier-project-impact]';

type TestIds = {
  users: string[];
  categories: string[];
  materialCategories: string[];
  locations: string[];
  materials: string[];
  projects: string[];
  builds: string[];
  reservations: string[];
};

const ids: TestIds = {
  users: [],
  categories: [],
  materialCategories: [],
  locations: [],
  materials: [],
  projects: [],
  builds: [],
  reservations: [],
};

function futurePreferredWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function pickupReservationPayload(
  materialId: string,
  quantityRequested: number,
  overrides: Partial<CreateReservationInput> = {},
): CreateReservationInput {
  return {
    materialId,
    quantityRequested,
    fulfillmentMethod: 'PICKUP',
    learnerPreferredPickupWindows: [futurePreferredWindow()],
    ...overrides,
  };
}

async function createLearnerUser(suffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner ${suffix}`,
      email: `${TEST_MARKER}-learner-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: {
        create: {
          learnerType: 'STUDENT',
          skillLevel: 'BEGINNER',
        },
      },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createSupplierUser(suffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Supplier ${suffix}`,
      email: `${TEST_MARKER}-supplier-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
      supplierProfile: {
        create: {
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: `${TEST_MARKER} Supplier ${suffix}`,
          verificationStatus: 'APPROVED',
        },
      },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createMaterialCategory() {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Electronics`,
      nameAr: `${TEST_MARKER} إلكترونيات`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });
  ids.materialCategories.push(category.id);
  return category;
}

async function createProjectCategory() {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Robotics`,
      nameAr: `${TEST_MARKER} روبوتات`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
}

async function createLocation() {
  const location = await prisma.location.create({
    data: {
      country: 'PS',
      city: 'Ramallah',
      area: 'Al Bireh',
      isApproximate: true,
    },
  });
  ids.locations.push(location.id);
  return location;
}

async function createMaterial(input: {
  ownerId: string;
  categoryId: string;
  locationId: string;
  title: string;
}) {
  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: input.ownerId },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: input.ownerId,
      supplierProfileId: supplierProfile?.id,
      categoryId: input.categoryId,
      locationId: input.locationId,
      title: input.title,
      description: `${TEST_MARKER} material description`,
      materialType: 'Arduino board',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      pickupAllowed: true,
    },
  });
  ids.materials.push(material.id);
  return material;
}

async function createPublishedProject(input: {
  authorId: string;
  projectCategoryId: string;
  materialCategoryId: string;
  componentNames: string[];
}) {
  const project = await prisma.learningProject.create({
    data: {
      categoryId: input.projectCategoryId,
      createdBy: input.authorId,
      title: `${TEST_MARKER} Impact project`,
      shortDescription: `${TEST_MARKER} short`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      requiredComponents: {
        create: input.componentNames.map((componentName) => ({
          componentName,
          materialType: 'Arduino board',
          quantity: 1,
          unit: 'piece',
          componentRole: 'REQUIRED_MATERIAL',
          categoryId: input.materialCategoryId,
          searchKeywords: ['arduino'],
        })),
      },
    },
    include: {
      requiredComponents: true,
    },
  });
  ids.projects.push(project.id);
  return project;
}

async function linkAndReserveBuildItem(input: {
  learnerId: string;
  projectId: string;
  itemId: string;
  materialId: string;
  reservationStatus?: 'PENDING' | 'ACCEPTED' | 'COMPLETED';
}) {
  await linkBuildItemMaterialById(
    input.projectId,
    input.learnerId,
    input.itemId,
    input.materialId,
  );

  const reservation = await createReservation(
    input.learnerId,
    pickupReservationPayload(input.materialId, 1, {
      buildItemId: input.itemId,
    }),
  );
  ids.reservations.push(reservation.id);

  if (input.reservationStatus && input.reservationStatus !== 'PENDING') {
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: input.reservationStatus,
        completedAt:
          input.reservationStatus === 'COMPLETED' ? new Date() : null,
      },
    });
  }

  return reservation;
}

before(() => {
  process.env.NODE_ENV = 'test';
});

after(async () => {
  if (ids.reservations.length > 0) {
    await prisma.reservation.deleteMany({
      where: { id: { in: ids.reservations } },
    });
  }

  if (ids.builds.length > 0) {
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  }

  if (ids.projects.length > 0) {
    await prisma.projectBuild.deleteMany({
      where: { projectId: { in: ids.projects } },
    });
    await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
  }

  if (ids.materials.length > 0) {
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
  }

  if (ids.locations.length > 0) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  }

  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }

  if (ids.materialCategories.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: ids.materialCategories } },
    });
  }

  if (ids.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('supplier project impact summary', () => {
  test('completed linked reservation counts supplier project support', async () => {
    const learner = await createLearnerUser('impact-learner');
    const supplier = await createSupplierUser('impact-supplier');
    const materialCategory = await createMaterialCategory();
    const projectCategory = await createProjectCategory();
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Board`,
    });
    const project = await createPublishedProject({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
      componentNames: ['Motor'],
    });
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    const itemId = build.items[0]!.id;

    await linkAndReserveBuildItem({
      learnerId: learner.id,
      projectId: project.id,
      itemId,
      materialId: material.id,
      reservationStatus: 'COMPLETED',
    });

    const summary = await getSupplierProjectSupportSummary(supplier.id);

    assert.equal(summary.projectsSupported, 1);
    assert.equal(summary.projectComponentsSupported, 1);
    assert.equal(summary.learnerBuildsHelped, 1);
    assert.equal(summary.completedLinkedReservations, 1);
    assert.equal(summary.latestSupportedProjects.length, 1);
    assert.equal(summary.latestSupportedProjects[0]?.projectId, project.id);
    assert.equal(summary.latestSupportedProjects[0]?.title, project.title);
    assert.ok(summary.latestSupportedProjects[0]?.completedAt);
  });

  test('PENDING and ACCEPTED linked reservations do not count', async () => {
    const learner = await createLearnerUser('pending-learner');
    const supplier = await createSupplierUser('pending-supplier');
    const materialCategory = await createMaterialCategory();
    const projectCategory = await createProjectCategory();
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Pending board`,
    });
    const project = await createPublishedProject({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
      componentNames: ['Motor A', 'Motor B'],
    });
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    await linkAndReserveBuildItem({
      learnerId: learner.id,
      projectId: project.id,
      itemId: build.items[0]!.id,
      materialId: material.id,
      reservationStatus: 'PENDING',
    });

    const materialB = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Accepted board`,
    });

    await linkAndReserveBuildItem({
      learnerId: learner.id,
      projectId: project.id,
      itemId: build.items[1]!.id,
      materialId: materialB.id,
      reservationStatus: 'ACCEPTED',
    });

    const summary = await getSupplierProjectSupportSummary(supplier.id);

    assert.equal(summary.projectsSupported, 0);
    assert.equal(summary.projectComponentsSupported, 0);
    assert.equal(summary.completedLinkedReservations, 0);
  });

  test('completed unlinked reservation does not count as project support', async () => {
    const learner = await createLearnerUser('unlinked-learner');
    const supplier = await createSupplierUser('unlinked-supplier');
    const materialCategory = await createMaterialCategory();
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Unlinked board`,
    });

    const reservation = await createReservation(
      learner.id,
      pickupReservationPayload(material.id, 1),
    );
    ids.reservations.push(reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    const summary = await getSupplierProjectSupportSummary(supplier.id);

    assert.equal(summary.projectsSupported, 0);
    assert.equal(summary.projectComponentsSupported, 0);
    assert.equal(summary.completedLinkedReservations, 0);
  });

  test('multiple components in same project count once for projectsSupported', async () => {
    const learner = await createLearnerUser('multi-learner');
    const supplier = await createSupplierUser('multi-supplier');
    const materialCategory = await createMaterialCategory();
    const projectCategory = await createProjectCategory();
    const location = await createLocation();
    const materialA = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Multi A`,
    });
    const materialB = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Multi B`,
    });
    const project = await createPublishedProject({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
      componentNames: ['Motor A', 'Motor B'],
    });
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    await linkAndReserveBuildItem({
      learnerId: learner.id,
      projectId: project.id,
      itemId: build.items[0]!.id,
      materialId: materialA.id,
      reservationStatus: 'COMPLETED',
    });

    await linkAndReserveBuildItem({
      learnerId: learner.id,
      projectId: project.id,
      itemId: build.items[1]!.id,
      materialId: materialB.id,
      reservationStatus: 'COMPLETED',
    });

    const summary = await getSupplierProjectSupportSummary(supplier.id);

    assert.equal(summary.projectsSupported, 1);
    assert.equal(summary.projectComponentsSupported, 2);
    assert.equal(summary.learnerBuildsHelped, 1);
    assert.equal(summary.completedLinkedReservations, 2);
  });

  test('supplier only sees their own project support', async () => {
    const learner = await createLearnerUser('scope-learner');
    const supplierA = await createSupplierUser('scope-a');
    const supplierB = await createSupplierUser('scope-b');
    const materialCategory = await createMaterialCategory();
    const projectCategory = await createProjectCategory();
    const location = await createLocation();
    const materialB = await createMaterial({
      ownerId: supplierB.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Supplier B board`,
    });
    const project = await createPublishedProject({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
      componentNames: ['Motor'],
    });
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    await linkAndReserveBuildItem({
      learnerId: learner.id,
      projectId: project.id,
      itemId: build.items[0]!.id,
      materialId: materialB.id,
      reservationStatus: 'COMPLETED',
    });

    const summaryA = await getSupplierProjectSupportSummary(supplierA.id);
    const summaryB = await getSupplierProjectSupportSummary(supplierB.id);

    assert.equal(summaryA.projectsSupported, 0);
    assert.equal(summaryB.projectsSupported, 1);

    const dashboard = await getSupplierDashboard(supplierB.id);
    assert.equal(dashboard.projectSupport.projectsSupported, 1);
    assert.equal(dashboard.projectSupport.projectComponentsSupported, 1);
  });
});
