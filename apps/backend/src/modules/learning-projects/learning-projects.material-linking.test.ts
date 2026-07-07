import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import {
  getBuildItemMaterialCandidatesById,
  getMyProjectBuildById,
  linkBuildItemMaterialById,
  startProjectBuildById,
  unlinkBuildItemMaterialById,
} from '../learning-projects/learning-projects.service.js';
import { resolveBuildItemReadiness } from '../learning-projects/learning-projects.build-material-linking.js';

const TEST_MARKER = '[test-learning-project-material-linking]';

type TestIds = {
  users: string[];
  categories: string[];
  materialCategories: string[];
  locations: string[];
  materials: string[];
  projects: string[];
  builds: string[];
};

const ids: TestIds = {
  users: [],
  categories: [],
  materialCategories: [],
  locations: [],
  materials: [],
  projects: [],
  builds: [],
};

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
  status?: 'AVAILABLE' | 'UNAVAILABLE' | 'REUSED';
  isFree?: boolean;
  price?: number | null;
  materialType?: string;
  condition?: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'USED' | 'NEEDS_REPAIR';
  createdAt?: Date;
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
      materialType: input.materialType ?? 'Arduino board',
      quantity: 1,
      unit: 'piece',
      condition: input.condition ?? 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: input.status ?? 'AVAILABLE',
      isFree: input.isFree ?? true,
      price: input.isFree === false ? input.price ?? 25 : input.price ?? null,
      createdAt: input.createdAt,
    },
  });
  ids.materials.push(material.id);
  return material;
}

async function createLearnerSavedLocation(input: {
  learnerId: string;
  locationId: string;
}) {
  await prisma.userSavedLocation.create({
    data: {
      userId: input.learnerId,
      locationId: input.locationId,
      label: 'Home',
      isDefault: true,
    },
  });
}

async function createPublishedProject(input: {
  authorId: string;
  projectCategoryId: string;
  materialCategoryId: string;
  componentName: string;
  componentRole?: 'REQUIRED_MATERIAL' | 'TOOL';
}) {
  const project = await prisma.learningProject.create({
    data: {
      categoryId: input.projectCategoryId,
      createdBy: input.authorId,
      title: `${TEST_MARKER} Linking project`,
      shortDescription: `${TEST_MARKER} short`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      requiredComponents: {
        create: [
          {
            componentName: input.componentName,
            materialType: 'Arduino board',
            quantity: 1,
            unit: 'piece',
            componentRole: input.componentRole ?? 'REQUIRED_MATERIAL',
            categoryId: input.materialCategoryId,
            searchKeywords: ['arduino', 'microcontroller'],
          },
        ],
      },
    },
    include: {
      requiredComponents: true,
    },
  });
  ids.projects.push(project.id);
  return project;
}

before(() => {
  process.env.NODE_ENV = 'test';
});

after(async () => {
  if (ids.builds.length > 0) {
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  }

  if (ids.projects.length > 0) {
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
    await prisma.userSavedLocation.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('learning project build material linking', () => {
  test('resolveBuildItemReadiness excludes linked material and RESERVED status', () => {
    assert.equal(
      resolveBuildItemReadiness({
        status: 'RESERVED',
        linkedMaterial: {
          id: 'mat-1',
          title: 'Board',
          condition: 'GOOD',
          status: 'AVAILABLE',
          isFree: true,
          price: null,
          currency: 'NIS',
          pickupAllowed: true,
          deliveryAllowed: false,
          ownerId: 'owner',
          materialType: 'Arduino',
          category: { id: 'cat', nameEn: 'Electronics', nameAr: 'Electronics' },
          location: { city: 'Ramallah', area: null },
          images: [],
          supplierProfile: null,
          owner: { displayName: 'Supplier' },
        },
      }).isReadyForBuild,
      false,
    );

    assert.equal(
      resolveBuildItemReadiness({
        status: 'MISSING',
        linkedReservation: {
          id: 'res-1',
          status: 'COMPLETED',
          materialId: 'mat-1',
        },
      }).isReadyForBuild,
      true,
    );
  });

  test('learner can list candidates, link, persist, and unlink material', async () => {
    const learner = await createLearnerUser('primary');
    const supplier = await createSupplierUser('primary');
    const materialCategory = await createMaterialCategory();
    const projectCategory = await createProjectCategory();
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Arduino Uno`,
    });
    const project = await createPublishedProject({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Arduino Uno board',
    });

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    const itemId = build.items[0]!.id;

    const candidates = await getBuildItemMaterialCandidatesById(
      project.id,
      learner.id,
      itemId,
    );

    assert.ok(candidates.items.length >= 1);
    assert.ok(
      candidates.items.some((candidate) => candidate.id === material.id),
    );
    assert.ok(candidates.items[0]!.matchHints.length >= 1);

    const linkedBuild = await linkBuildItemMaterialById(
      project.id,
      learner.id,
      itemId,
      material.id,
    );
    const linkedItem = linkedBuild.items.find((item) => item.id === itemId);
    assert.equal(linkedItem?.linkedMaterial?.id, material.id);
    assert.equal(linkedItem?.isReadyForBuild, false);
    assert.match(
      linkedItem?.readinessLabel ?? '',
      /reserve or acquire|not ready/i,
    );
    assert.equal(linkedBuild.progress.ready, 0);

    const persisted = await getMyProjectBuildById(project.id, learner.id);
    assert.equal(
      persisted?.items.find((item) => item.id === itemId)?.linkedMaterial?.id,
      material.id,
    );

    const relinkedBuild = await linkBuildItemMaterialById(
      project.id,
      learner.id,
      itemId,
      material.id,
    );
    assert.equal(
      relinkedBuild.items.find((item) => item.id === itemId)?.linkedMaterial?.id,
      material.id,
    );

    const unlinkedBuild = await unlinkBuildItemMaterialById(
      project.id,
      learner.id,
      itemId,
    );
    assert.equal(
      unlinkedBuild.items.find((item) => item.id === itemId)?.linkedMaterial,
      null,
    );
  });

  test('rejects linking own material and unavailable material', async () => {
    const learner = await createLearnerUser('guard');
    const supplier = await createSupplierUser('guard');
    const materialCategory = await createMaterialCategory();
    const projectCategory = await createProjectCategory();
    const location = await createLocation();

    const unavailable = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} unavailable`,
      status: 'UNAVAILABLE',
    });

    const ownListing = await createMaterial({
      ownerId: learner.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} own listing`,
    });

    const project = await createPublishedProject({
      authorId: supplier.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Sensor module',
    });

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    const itemId = build.items[0]!.id;

    await assert.rejects(
      () =>
        linkBuildItemMaterialById(
          project.id,
          learner.id,
          itemId,
          unavailable.id,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'MATERIAL_NOT_AVAILABLE');
        return true;
      },
    );

    await assert.rejects(
      () =>
        linkBuildItemMaterialById(
          project.id,
          learner.id,
          itemId,
          ownListing.id,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'OWN_MATERIAL');
        return true;
      },
    );
  });

  test('rejects unlink when active linked reservation exists', async () => {
    const learner = await createLearnerUser('reservation');
    const supplier = await createSupplierUser('reservation');
    const materialCategory = await createMaterialCategory();
    const projectCategory = await createProjectCategory();
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} reserved material`,
    });
    const project = await createPublishedProject({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Motor',
    });

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    const itemId = build.items[0]!.id;

    await linkBuildItemMaterialById(
      project.id,
      learner.id,
      itemId,
      material.id,
    );

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: learner.id,
        ownerId: supplier.id,
        quantityRequested: 1,
        status: 'ACCEPTED',
      },
    });

    await prisma.projectBuildItem.update({
      where: { id: itemId },
      data: { linkedReservationId: reservation.id },
    });

    await assert.rejects(
      () => unlinkBuildItemMaterialById(project.id, learner.id, itemId),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'ACTIVE_LINKED_RESERVATION');
        return true;
      },
    );
  });

  test('ranks free same-city exact match above newer paid exact match', async () => {
    const learner = await createLearnerUser('rank-free');
    const supplier = await createSupplierUser('rank-free');
    const materialCategory = await createMaterialCategory();
    const projectCategory = await createProjectCategory();
    const location = await createLocation();
    await createLearnerSavedLocation({
      learnerId: learner.id,
      locationId: location.id,
    });

    const freeMaterial = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Arduino Uno board`,
      isFree: true,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    const paidMaterial = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Arduino Uno board`,
      isFree: false,
      price: 40,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    const project = await createPublishedProject({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Arduino Uno board',
    });

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    const itemId = build.items[0]!.id;

    const candidates = await getBuildItemMaterialCandidatesById(
      project.id,
      learner.id,
      itemId,
    );

    assert.ok(candidates.items.length >= 2);
    assert.equal(candidates.items[0]!.id, freeMaterial.id);
    assert.ok(candidates.items.some((item) => item.id === paidMaterial.id));
    assert.ok(candidates.items[0]!.matchHints.includes('Free'));
    assert.ok(candidates.items[0]!.matchHints.includes('Same city'));
  });

  test('ranks exact paid match above weak free mismatch', async () => {
    const learner = await createLearnerUser('rank-paid');
    const supplier = await createSupplierUser('rank-paid');
    const materialCategory = await createMaterialCategory();
    const projectCategory = await createProjectCategory();
    const location = await createLocation();
    await createLearnerSavedLocation({
      learnerId: learner.id,
      locationId: location.id,
    });

    const exactPaid = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Arduino Uno board`,
      isFree: false,
      price: 35,
    });
    const weakFree = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} plastic storage box`,
      materialType: 'Container',
      isFree: true,
    });

    const project = await createPublishedProject({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Arduino Uno board',
    });

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    const itemId = build.items[0]!.id;

    const candidates = await getBuildItemMaterialCandidatesById(
      project.id,
      learner.id,
      itemId,
    );

    assert.equal(candidates.items[0]!.id, exactPaid.id);
    assert.ok(candidates.items.some((item) => item.id === weakFree.id));
  });

  test('TOOL components return empty candidates', async () => {
    const learner = await createLearnerUser('tool');
    const materialCategory = await createMaterialCategory();
    const projectCategory = await createProjectCategory();
    const project = await createPublishedProject({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Soldering iron',
      componentRole: 'TOOL',
    });

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    const itemId = build.items[0]!.id;

    const candidates = await getBuildItemMaterialCandidatesById(
      project.id,
      learner.id,
      itemId,
    );

    assert.equal(candidates.items.length, 0);
  });

  test('excludes own listings and unavailable materials from candidates', async () => {
    const learner = await createLearnerUser('exclude');
    const supplier = await createSupplierUser('exclude');
    const materialCategory = await createMaterialCategory();
    const projectCategory = await createProjectCategory();
    const location = await createLocation();

    const available = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Arduino Uno board available`,
    });
    const ownListing = await createMaterial({
      ownerId: learner.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Arduino Uno board own`,
    });
    const unavailable = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Arduino Uno board unavailable`,
      status: 'UNAVAILABLE',
    });

    const project = await createPublishedProject({
      authorId: supplier.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Arduino Uno board',
    });

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    const itemId = build.items[0]!.id;

    const candidates = await getBuildItemMaterialCandidatesById(
      project.id,
      learner.id,
      itemId,
    );

    assert.ok(candidates.items.length >= 1);
    assert.equal(candidates.items[0]!.id, available.id);
    assert.ok(
      candidates.items.every(
        (item) => item.id !== ownListing.id && item.id !== unavailable.id,
      ),
    );
  });
});
