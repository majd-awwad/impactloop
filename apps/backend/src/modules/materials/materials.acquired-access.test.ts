import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import { getMaterialById } from './materials.service.js';
import { linkBuildItemMaterialById, startProjectBuildById } from '../learning-projects/learning-projects.service.js';

const TEST_MARKER = '[test-material-acquired-access]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  projects: [] as string[],
  reservations: [] as string[],
};

async function createLearnerUser(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner ${suffix}`,
      email: `${TEST_MARKER}-learner-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: {
        create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
      },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createSupplierUser(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Supplier ${suffix}`,
      email: `${TEST_MARKER}-supplier-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`,
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

async function createMaterial(ownerId: string, status: 'AVAILABLE' | 'REUSED' = 'AVAILABLE') {
  const materialCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Mat ${Date.now()}`,
      nameAr: `${TEST_MARKER} مادة`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });
  ids.materialCategories.push(materialCategory.id);

  const location = await prisma.location.create({
    data: {
      country: 'PS',
      city: 'Ramallah',
      area: 'Al Bireh',
      isApproximate: true,
    },
  });
  ids.locations.push(location.id);

  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: ownerId },
  });

  const material = await prisma.material.create({
    data: {
      ownerId,
      supplierProfileId: supplierProfile?.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} acquired material`,
      description: `${TEST_MARKER} historical description`,
      materialType: 'Wheels',
      quantity: status === 'AVAILABLE' ? 1 : 0,
      unit: 'pieces',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status,
      isFree: true,
      pickupAllowed: true,
    },
  });
  ids.materials.push(material.id);
  return material;
}

async function createProject(authorId: string) {
  const projectCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Project ${Date.now()}`,
      nameAr: `${TEST_MARKER} مشروع`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(projectCategory.id);

  const materialCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Shared ${Date.now()}`,
      nameAr: `${TEST_MARKER} مشترك`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });
  ids.materialCategories.push(materialCategory.id);

  const project = await prisma.learningProject.create({
    data: {
      categoryId: projectCategory.id,
      createdBy: authorId,
      title: `${TEST_MARKER} project`,
      shortDescription: `${TEST_MARKER} short`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      requiredComponents: {
        create: [
          {
            categoryId: materialCategory.id,
            componentName: 'Wheels',
            materialType: 'Wheels',
            quantity: 1,
            unit: 'pieces',
            componentRole: 'REQUIRED_MATERIAL',
            isRequired: true,
            canBeSubstituted: false,
          },
        ],
      },
      steps: {
        create: [{ stepNumber: 1, title: 'Step 1', description: 'Build step' }],
      },
    },
    include: { requiredComponents: true },
  });
  ids.projects.push(project.id);
  return project;
}

describe('materials acquired access', () => {
  before(() => {
    process.env.NODE_ENV = 'test';
  });

  after(async () => {
    // startProjectBuildById → resolveLearningSetupAfterBuildStart creates
    // project_learning_packs / project_learning_questions that Restrict-reference
    // project_steps. Those must be removed before learningProject (cascade→steps).
    const cleanupErrors: Error[] = [];
    const runCleanup = async (label: string, action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (error) {
        cleanupErrors.push(
          error instanceof Error
            ? new Error(`${label}: ${error.message}`)
            : new Error(`${label}: ${String(error)}`),
        );
      }
    };

    if (ids.projects.length > 0) {
      await runCleanup('unlink build items', () =>
        prisma.projectBuildItem.updateMany({
          where: { build: { projectId: { in: ids.projects } } },
          data: { linkedMaterialId: null, linkedReservationId: null },
        }),
      );
    }

    if (ids.materials.length > 0) {
      await runCleanup('clear material reuse pointer', () =>
        prisma.material.updateMany({
          where: {
            id: { in: ids.materials },
            reusedByReservationId: { not: null },
          },
          data: { reusedByReservationId: null },
        }),
      );
    }

    if (ids.reservations.length > 0) {
      await runCleanup('reservations', () =>
        prisma.reservation.deleteMany({ where: { id: { in: ids.reservations } } }),
      );
    }

    if (ids.projects.length > 0) {
      await runCleanup('learning sessions by project', () =>
        prisma.projectBuildLearningSession.deleteMany({
          where: { build: { projectId: { in: ids.projects } } },
        }),
      );
      await runCleanup('project builds', () =>
        prisma.projectBuild.deleteMany({
          where: { projectId: { in: ids.projects } },
        }),
      );
      // Questions Restrict on project_step_id — delete before pack/project cascade.
      await runCleanup('learning questions by project pack', () =>
        prisma.projectLearningQuestion.deleteMany({
          where: { pack: { projectId: { in: ids.projects } } },
        }),
      );
      await runCleanup('learning packs', () =>
        prisma.projectLearningPack.deleteMany({
          where: { projectId: { in: ids.projects } },
        }),
      );
      await runCleanup('learning projects', () =>
        prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } }),
      );
    }

    if (ids.materials.length > 0) {
      await runCleanup('materials', () =>
        prisma.material.deleteMany({ where: { id: { in: ids.materials } } }),
      );
    }
    if (ids.locations.length > 0) {
      await runCleanup('locations', () =>
        prisma.location.deleteMany({ where: { id: { in: ids.locations } } }),
      );
    }
    if (ids.materialCategories.length > 0 || ids.categories.length > 0) {
      await runCleanup('categories', () =>
        prisma.category.deleteMany({
          where: { id: { in: [...ids.materialCategories, ...ids.categories] } },
        }),
      );
    }
    if (ids.users.length > 0) {
      await runCleanup('users', () =>
        prisma.user.deleteMany({ where: { id: { in: ids.users } } }),
      );
    }

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        cleanupErrors,
        `acquired-access cleanup failed (${cleanupErrors.length} step(s))`,
      );
    }
  });

  test('acquired learner can view non-public material linked from build item', async () => {
    const author = await createLearnerUser('author');
    const supplier = await createSupplierUser('supplier');
    const learner = await createLearnerUser('learner');
    const otherLearner = await createLearnerUser('other');
    const material = await createMaterial(supplier.id, 'AVAILABLE');
    const project = await createProject(author.id);

    const build = await startProjectBuildById(project.id, learner.id);
    const itemId = build!.items[0]!.id;
    await linkBuildItemMaterialById(project.id, learner.id, itemId, material.id);

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: learner.id,
        ownerId: supplier.id,
        quantityRequested: 1,
        status: 'COMPLETED',
        fulfillmentMethod: 'PICKUP',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);

    await prisma.projectBuildItem.update({
      where: { id: itemId },
      data: {
        linkedReservationId: reservation.id,
        linkedMaterialId: material.id,
      },
    });

    await prisma.material.update({
      where: { id: material.id },
      data: { quantity: 0, status: 'REUSED' },
    });

    await prisma.projectBuildItem.update({
      where: { id: itemId },
      data: {
        linkedMaterialId: null,
        linkedReservationId: null,
      },
    });

    const detail = await getMaterialById(material.id, {
      sub: learner.id,
      roles: ['LEARNER'],
    });

    assert.equal((detail as { isAcquiredView?: boolean }).isAcquiredView, true);
    assert.equal((detail as { acquiredQuantity?: number }).acquiredQuantity, 1);
    assert.equal((detail as { canReserve?: boolean }).canReserve, false);
    assert.equal(
      (detail as { reserveBlockReason?: string }).reserveBlockReason,
      'ACQUIRED',
    );
    assert.equal(detail.title, material.title);
    assert.equal(
      (detail as { supplier?: { email?: string } }).supplier?.email,
      undefined,
    );

    await assert.rejects(
      () =>
        getMaterialById(material.id, {
          sub: otherLearner.id,
          roles: ['LEARNER'],
        }),
      (error: AppError) => error.statusCode === 404,
    );

    await assert.rejects(
      () => getMaterialById(material.id),
      (error: AppError) => error.statusCode === 404,
    );
  });

  test('public available material details remain unchanged for guests', async () => {
    const supplier = await createSupplierUser('public-supplier');
    const materialCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Public ${Date.now()}`,
        nameAr: `${TEST_MARKER} عام`,
        categoryType: 'BOTH',
        isActive: true,
      },
    });
    ids.materialCategories.push(materialCategory.id);

    const location = await prisma.location.create({
      data: {
        country: 'PS',
        city: 'Ramallah',
        area: 'Al Bireh',
        isApproximate: true,
      },
    });
    ids.locations.push(location.id);

    const supplierProfile = await prisma.supplierProfile.findUnique({
      where: { userId: supplier.id },
    });

    const material = await prisma.material.create({
      data: {
        ownerId: supplier.id,
        supplierProfileId: supplierProfile?.id,
        categoryId: materialCategory.id,
        locationId: location.id,
        title: `${TEST_MARKER} public material`,
        description: 'Public listing',
        materialType: 'Wheels',
        quantity: 3,
        unit: 'pieces',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: true,
        pickupAllowed: true,
      },
    });
    ids.materials.push(material.id);

    const detail = await getMaterialById(material.id);
    assert.equal(detail.id, material.id);
    assert.equal((detail as { isAcquiredView?: boolean }).isAcquiredView, undefined);
    assert.equal(detail.availableQuantity, 3);
  });
});
