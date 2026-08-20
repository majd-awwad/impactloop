import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';

import { buildAdminImpactAnalytics } from './admin-impact.service.js';

const TEST_MARKER = '[test-admin-impact]';

type CreatedIds = {
  users: string[];
  materials: string[];
  reservations: string[];
  projects: string[];
  builds: string[];
  electronicsCategoryId?: string;
  woodCategoryId?: string;
  projectCategoryId?: string;
  locationId?: string;
};

const ids: CreatedIds = {
  users: [],
  materials: [],
  reservations: [],
  projects: [],
  builds: [],
};

async function createCategory(nameEn: string, nameAr: string, type: 'MATERIAL' | 'PROJECT') {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} ${nameEn}`,
      nameAr: `${TEST_MARKER} ${nameAr}`,
      categoryType: type,
      isActive: true,
    },
  });
  return category;
}

async function createUser(input: {
  role: 'LEARNER' | 'SUPPLIER';
  emailSuffix: string;
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.role} ${input.emailSuffix}`,
      email: `${TEST_MARKER}-${input.role}-${input.emailSuffix}-${Date.now()}-${Math.random().toString(16).slice(2)}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ role: input.role, isPrimary: true }],
      },
      ...(input.role === 'SUPPLIER'
        ? {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} Supplier ${input.emailSuffix}`,
                verificationStatus: 'VERIFIED',
              },
            },
          }
        : {
            learnerProfile: {
              create: {
                learnerType: 'STUDENT',
                skillLevel: 'BEGINNER',
              },
            },
          }),
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createMaterial(input: {
  ownerId: string;
  categoryId: string;
  title: string;
  quantity: number;
  unit: string;
  status?: 'AVAILABLE' | 'REUSED';
  condition?: 'NEW' | 'GOOD';
}) {
  const material = await prisma.material.create({
    data: {
      ownerId: input.ownerId,
      categoryId: input.categoryId,
      locationId: ids.locationId!,
      title: `${TEST_MARKER} ${input.title}`,
      description: 'admin impact test material',
      materialType: 'Test type',
      quantity: input.quantity,
      unit: input.unit,
      condition: input.condition ?? 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: input.status ?? 'AVAILABLE',
      isFree: true,
    },
  });
  ids.materials.push(material.id);
  return material;
}

async function createReservation(input: {
  materialId: string;
  requesterId: string;
  ownerId: string;
  status:
    | 'PENDING'
    | 'ACCEPTED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REJECTED'
    | 'EXPIRED';
  quantity?: number;
  completedAt?: Date | null;
}) {
  const reservation = await prisma.reservation.create({
    data: {
      materialId: input.materialId,
      requesterId: input.requesterId,
      ownerId: input.ownerId,
      quantityRequested: input.quantity ?? 1,
      status: input.status,
      completedAt:
        input.completedAt === undefined
          ? input.status === 'COMPLETED'
            ? new Date()
            : null
          : input.completedAt,
    },
  });
  ids.reservations.push(reservation.id);
  return reservation;
}

describe('admin impact analytics', { concurrency: false }, () => {
  before(async () => {
    const electronics = await createCategory('Electronics', 'إلكترونيات', 'MATERIAL');
    const wood = await createCategory('Wood & Panels', 'خشب', 'MATERIAL');
    const projectCategory = await createCategory('Robotics', 'روبوتات', 'PROJECT');
    ids.electronicsCategoryId = electronics.id;
    ids.woodCategoryId = wood.id;
    ids.projectCategoryId = projectCategory.id;

    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: 'Rafidia',
        addressLine: 'Impact test street',
        isApproximate: true,
        visibility: 'PRIVATE',
      },
    });
    ids.locationId = location.id;
  });

  after(async () => {
    if (ids.reservations.length > 0) {
      await prisma.reservation.deleteMany({
        where: { id: { in: ids.reservations } },
      });
    }
    if (ids.builds.length > 0) {
      await prisma.projectBuild.deleteMany({
        where: { id: { in: ids.builds } },
      });
    }
    if (ids.projects.length > 0) {
      await prisma.projectBuild.deleteMany({
        where: { projectId: { in: ids.projects } },
      });
      await prisma.learningProject.deleteMany({
        where: { id: { in: ids.projects } },
      });
    }
    if (ids.materials.length > 0) {
      await prisma.material.deleteMany({
        where: { id: { in: ids.materials } },
      });
    }
    if (ids.users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    }
    if (ids.locationId) {
      await prisma.location.deleteMany({ where: { id: ids.locationId } });
    }
    const categoryIds = [
      ids.electronicsCategoryId,
      ids.woodCategoryId,
      ids.projectCategoryId,
    ].filter((value): value is string => Boolean(value));
    if (categoryIds.length > 0) {
      await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    }
  });

  test('counts completed reservations as reuse events, including partial reuse of remaining listings', async () => {
    const supplier = await createUser({ role: 'SUPPLIER', emailSuffix: 'partial' });
    const learner = await createUser({ role: 'LEARNER', emailSuffix: 'partial' });
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: ids.electronicsCategoryId!,
      title: 'partial listing',
      quantity: 5,
      unit: 'piece',
      status: 'AVAILABLE',
      condition: 'NEW',
    });

    const before = await buildAdminImpactAnalytics();

    const completed = await createReservation({
      materialId: material.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'COMPLETED',
      quantity: 1,
    });
    await createReservation({
      materialId: material.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'PENDING',
    });
    await createReservation({
      materialId: material.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'CANCELLED',
    });
    await createReservation({
      materialId: material.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'REJECTED',
    });
    await createReservation({
      materialId: material.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'EXPIRED',
    });

    const impact = await buildAdminImpactAnalytics();
    const refreshed = await prisma.material.findUnique({
      where: { id: material.id },
      select: { status: true, quantity: true },
    });

    assert.equal(refreshed?.status, 'AVAILABLE');
    assert.equal(Number(refreshed?.quantity), 5);
    assert.equal(
      impact.verifiedImpact.completedReuseEvents,
      before.verifiedImpact.completedReuseEvents + 1,
    );
    assert.ok(ids.reservations.includes(completed.id));
  });

  test('counts distinct learners and suppliers once across multiple completed events', async () => {
    const supplier = await createUser({ role: 'SUPPLIER', emailSuffix: 'distinct' });
    const learnerA = await createUser({ role: 'LEARNER', emailSuffix: 'a' });
    const learnerB = await createUser({ role: 'LEARNER', emailSuffix: 'b' });
    const materialA = await createMaterial({
      ownerId: supplier.id,
      categoryId: ids.electronicsCategoryId!,
      title: 'distinct a',
      quantity: 3,
      unit: 'piece',
    });
    const materialB = await createMaterial({
      ownerId: supplier.id,
      categoryId: ids.woodCategoryId!,
      title: 'distinct b',
      quantity: 2,
      unit: 'kg',
    });

    const before = await buildAdminImpactAnalytics();

    await createReservation({
      materialId: materialA.id,
      requesterId: learnerA.id,
      ownerId: supplier.id,
      status: 'COMPLETED',
    });
    await createReservation({
      materialId: materialB.id,
      requesterId: learnerA.id,
      ownerId: supplier.id,
      status: 'COMPLETED',
    });
    await createReservation({
      materialId: materialB.id,
      requesterId: learnerB.id,
      ownerId: supplier.id,
      status: 'COMPLETED',
    });

    const impact = await buildAdminImpactAnalytics();

    assert.equal(
      impact.verifiedImpact.learnersBenefited,
      before.verifiedImpact.learnersBenefited + 2,
    );
    assert.equal(
      impact.verifiedImpact.suppliersContributed,
      before.verifiedImpact.suppliersContributed + 1,
    );
    assert.equal(
      impact.verifiedImpact.distinctMaterialsReused,
      before.verifiedImpact.distinctMaterialsReused + 2,
    );
  });

  test('category chart uses completed reuse events, not general inventory', async () => {
    const supplier = await createUser({ role: 'SUPPLIER', emailSuffix: 'category' });
    const learner = await createUser({ role: 'LEARNER', emailSuffix: 'category' });
    await createMaterial({
      ownerId: supplier.id,
      categoryId: ids.woodCategoryId!,
      title: 'inventory only wood',
      quantity: 40,
      unit: 'piece',
      status: 'AVAILABLE',
    });
    const electronics = await createMaterial({
      ownerId: supplier.id,
      categoryId: ids.electronicsCategoryId!,
      title: 'completed electronics',
      quantity: 2,
      unit: 'piece',
    });
    const before = await buildAdminImpactAnalytics();
    const beforeElectronics =
      before.reuseByCategory.find((row) => row.nameEn.includes('Electronics'))
        ?.completedReuseEvents ?? 0;
    const beforeWood =
      before.reuseByCategory.find((row) => row.nameEn.includes('Wood'))
        ?.completedReuseEvents ?? 0;

    await createReservation({
      materialId: electronics.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'COMPLETED',
    });

    const impact = await buildAdminImpactAnalytics();
    const electronicsRow = impact.reuseByCategory.find((row) =>
      row.nameEn.includes('Electronics'),
    );
    const woodInventoryRow = impact.reuseByCategory.find((row) =>
      row.nameEn.includes('Wood'),
    );

    assert.ok(electronicsRow);
    assert.equal(electronicsRow!.completedReuseEvents, beforeElectronics + 1);
    assert.equal(woodInventoryRow?.completedReuseEvents ?? 0, beforeWood);
  });

  test('monthly trend groups by reservation completedAt and includes zero months', async () => {
    const supplier = await createUser({ role: 'SUPPLIER', emailSuffix: 'month' });
    const learner = await createUser({ role: 'LEARNER', emailSuffix: 'month' });
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: ids.electronicsCategoryId!,
      title: 'monthly',
      quantity: 2,
      unit: 'piece',
    });
    const now = new Date();
    const thisMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 12, 10, 0, 0),
    );
    await createReservation({
      materialId: material.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'COMPLETED',
      completedAt: thisMonth,
    });

    const impact = await buildAdminImpactAnalytics();
    const expectedMonth = `${thisMonth.getUTCFullYear()}-${String(thisMonth.getUTCMonth() + 1).padStart(2, '0')}`;

    assert.equal(impact.monthlyReuse.length, 6);
    assert.equal(impact.monthlyReuse.some((row) => row.completedReuseEvents === 0), true);
    const current = impact.monthlyReuse.find((row) => row.month === expectedMonth);
    assert.ok(current);
    assert.equal(current!.completedReuseEvents >= 1, true);
  });

  test('learning impact counts only components fulfilled by completed linked reservations', async () => {
    const supplier = await createUser({ role: 'SUPPLIER', emailSuffix: 'learn' });
    const learner = await createUser({ role: 'LEARNER', emailSuffix: 'learn' });
    const materialCompleted = await createMaterial({
      ownerId: supplier.id,
      categoryId: ids.electronicsCategoryId!,
      title: 'linked completed',
      quantity: 2,
      unit: 'piece',
    });
    const materialPending = await createMaterial({
      ownerId: supplier.id,
      categoryId: ids.electronicsCategoryId!,
      title: 'linked pending',
      quantity: 2,
      unit: 'piece',
    });

    const project = await prisma.learningProject.create({
      data: {
        categoryId: ids.projectCategoryId!,
        createdBy: learner.id,
        title: `${TEST_MARKER} Impact project`,
        shortDescription: 'short',
        description: 'description',
        difficulty: 'BEGINNER',
        status: 'PUBLISHED',
        requiredComponents: {
          create: [
            {
              componentName: 'Board A',
              materialType: 'Board',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              categoryId: ids.electronicsCategoryId!,
            },
            {
              componentName: 'Board B',
              materialType: 'Board',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              categoryId: ids.electronicsCategoryId!,
            },
          ],
        },
      },
      include: { requiredComponents: true },
    });
    ids.projects.push(project.id);

    const build = await prisma.projectBuild.create({
      data: {
        projectId: project.id,
        learnerId: learner.id,
        status: 'IN_PROGRESS',
      },
    });
    ids.builds.push(build.id);

    const completedReservation = await createReservation({
      materialId: materialCompleted.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'COMPLETED',
    });
    const pendingReservation = await createReservation({
      materialId: materialPending.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'PENDING',
    });

    const before = await buildAdminImpactAnalytics();

    await prisma.projectBuildItem.create({
      data: {
        buildId: build.id,
        requiredComponentId: project.requiredComponents[0]!.id,
        status: 'RESERVED',
        linkedMaterialId: materialCompleted.id,
        linkedReservationId: completedReservation.id,
      },
    });
    await prisma.projectBuildItem.create({
      data: {
        buildId: build.id,
        requiredComponentId: project.requiredComponents[1]!.id,
        status: 'RESERVED',
        linkedMaterialId: materialPending.id,
        linkedReservationId: pendingReservation.id,
      },
    });

    const impact = await buildAdminImpactAnalytics();

    assert.equal(
      impact.learningImpact.componentsFulfilled,
      before.learningImpact.componentsFulfilled + 1,
    );
    assert.equal(
      impact.learningImpact.buildsSupported,
      before.learningImpact.buildsSupported + 1,
    );
    assert.equal(
      impact.learningImpact.projectsSupported,
      before.learningImpact.projectsSupported + 1,
    );
  });

  test('learning impact ignores unlinked items and non-completed linked reservations', async () => {
    const supplier = await createUser({ role: 'SUPPLIER', emailSuffix: 'learn-neg' });
    const learner = await createUser({ role: 'LEARNER', emailSuffix: 'learn-neg' });
    const materialCancelled = await createMaterial({
      ownerId: supplier.id,
      categoryId: ids.electronicsCategoryId!,
      title: 'linked cancelled',
      quantity: 1,
      unit: 'piece',
    });
    const materialExpired = await createMaterial({
      ownerId: supplier.id,
      categoryId: ids.electronicsCategoryId!,
      title: 'linked expired',
      quantity: 1,
      unit: 'piece',
    });

    const project = await prisma.learningProject.create({
      data: {
        categoryId: ids.projectCategoryId!,
        createdBy: learner.id,
        title: `${TEST_MARKER} Impact ignore project`,
        shortDescription: 'short',
        description: 'description',
        difficulty: 'BEGINNER',
        status: 'PUBLISHED',
        requiredComponents: {
          create: [
            {
              componentName: 'Unlinked part',
              materialType: 'Board',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              categoryId: ids.electronicsCategoryId!,
            },
            {
              componentName: 'Cancelled part',
              materialType: 'Board',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              categoryId: ids.electronicsCategoryId!,
            },
            {
              componentName: 'Expired part',
              materialType: 'Board',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              categoryId: ids.electronicsCategoryId!,
            },
          ],
        },
      },
      include: { requiredComponents: true },
    });
    ids.projects.push(project.id);

    const build = await prisma.projectBuild.create({
      data: {
        projectId: project.id,
        learnerId: learner.id,
        status: 'IN_PROGRESS',
      },
    });
    ids.builds.push(build.id);

    const cancelledReservation = await createReservation({
      materialId: materialCancelled.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'CANCELLED',
    });
    const expiredReservation = await createReservation({
      materialId: materialExpired.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'EXPIRED',
    });

    const before = await buildAdminImpactAnalytics();

    await prisma.projectBuildItem.create({
      data: {
        buildId: build.id,
        requiredComponentId: project.requiredComponents[0]!.id,
        status: 'MISSING',
      },
    });
    await prisma.projectBuildItem.create({
      data: {
        buildId: build.id,
        requiredComponentId: project.requiredComponents[1]!.id,
        status: 'RESERVED',
        linkedMaterialId: materialCancelled.id,
        linkedReservationId: cancelledReservation.id,
      },
    });
    await prisma.projectBuildItem.create({
      data: {
        buildId: build.id,
        requiredComponentId: project.requiredComponents[2]!.id,
        status: 'RESERVED',
        linkedMaterialId: materialExpired.id,
        linkedReservationId: expiredReservation.id,
      },
    });

    const impact = await buildAdminImpactAnalytics();

    assert.equal(
      impact.learningImpact.componentsFulfilled,
      before.learningImpact.componentsFulfilled,
    );
    assert.equal(
      impact.learningImpact.buildsSupported,
      before.learningImpact.buildsSupported,
    );
    assert.equal(
      impact.learningImpact.projectsSupported,
      before.learningImpact.projectsSupported,
    );
  });

  test('environmental estimate excludes unsupported units and does not expose internal ids', async () => {
    const supplier = await createUser({ role: 'SUPPLIER', emailSuffix: 'co2' });
    const learner = await createUser({ role: 'LEARNER', emailSuffix: 'co2' });
    const kgMaterial = await createMaterial({
      ownerId: supplier.id,
      categoryId: ids.woodCategoryId!,
      title: 'kg wood',
      quantity: 4,
      unit: 'kg',
    });
    const pieceMaterial = await createMaterial({
      ownerId: supplier.id,
      categoryId: ids.electronicsCategoryId!,
      title: 'piece electronics',
      quantity: 3,
      unit: 'piece',
    });

    await createReservation({
      materialId: kgMaterial.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'COMPLETED',
      quantity: 2,
    });
    await createReservation({
      materialId: pieceMaterial.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      status: 'COMPLETED',
      quantity: 1,
    });

    const impact = await buildAdminImpactAnalytics();
    const payload = JSON.stringify(impact);

    assert.equal(impact.environmentalEstimate.isEstimate, true);
    assert.equal(impact.environmentalEstimate.totalCompletedReuseEvents >= 2, true);
    assert.equal(impact.environmentalEstimate.includedReuseEvents, 0);
    assert.equal(impact.environmentalEstimate.estimatedCo2eKg, null);
    assert.equal(impact.environmentalEstimate.unavailableReason, 'NO_ELIGIBLE_EVENTS');
    assert.equal(impact.environmentalEstimate.coveragePercent, 0);
    assert.match(impact.environmentalEstimate.methodologyVersion, /mass-only/);
    assert.equal(payload.includes(learner.id), false);
    assert.equal(payload.includes(supplier.id), false);
    assert.equal(payload.includes(kgMaterial.id), false);
  });
});
