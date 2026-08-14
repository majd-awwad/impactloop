import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { Prisma, type ProjectComponentRole } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';

import {
  classifyBuildItemForOptimizer,
  optimizeProjectBuildPlan,
} from './learning-projects.build-optimizer.js';
import {
  linkBuildItemMaterialById,
  linkBuildItemReservationById,
  startProjectBuildById,
  updateProjectBuildItemById,
} from './learning-projects.service.js';
import { createReservation } from '../reservations/reservations.service.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';
import { getMaterialQuantityState } from '../reservations/reservations.quantity.js';

const TEST_MARKER = '[test-learning-project-build-optimizer]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  projects: [] as string[],
  reservations: [] as string[],
};

function futurePreferredWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
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

async function createListedMaterial(input: {
  ownerId: string;
  materialCategoryId: string;
  title: string;
  quantity: number;
  unit?: string;
  price?: number | null;
  isFree?: boolean;
  locationId?: string;
  materialType?: string;
  status?: 'AVAILABLE' | 'UNAVAILABLE';
}) {
  const location =
    input.locationId != null
      ? { id: input.locationId }
      : await prisma.location.create({
          data: {
            country: 'PS',
            city: 'Ramallah',
            area: 'Al Bireh',
            isApproximate: true,
          },
        });
  if (!input.locationId) {
    ids.locations.push(location.id);
  }

  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: input.ownerId },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: input.ownerId,
      supplierProfileId: supplierProfile?.id,
      categoryId: input.materialCategoryId,
      locationId: location.id,
      title: input.title,
      description: `${TEST_MARKER} ${input.title}`,
      materialType: input.materialType ?? 'Wheels',
      quantity: input.quantity,
      unit: input.unit ?? 'pieces',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: input.status ?? 'AVAILABLE',
      isFree: input.isFree ?? false,
      price: input.isFree === true ? null : (input.price ?? 10),
      currency: 'NIS',
      pickupAllowed: true,
      deliveryAllowed: false,
    },
  });
  ids.materials.push(material.id);
  return material;
}

async function createProjectWithComponents(
  authorId: string,
  components: Array<{
    name: string;
    quantity: number;
    unit: string;
    role?: ProjectComponentRole;
    canBeSubstituted?: boolean;
    alternativeKeywords?: string[];
  }>,
) {
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
      title: `${TEST_MARKER} optimizer project`,
      shortDescription: `${TEST_MARKER} short`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      requiredComponents: {
        create: components.map((component) => ({
          categoryId: materialCategory.id,
          componentName: component.name,
          materialType: 'Wheels',
          quantity: component.quantity,
          unit: component.unit,
          componentRole: component.role ?? 'REQUIRED_MATERIAL',
          isRequired: true,
          canBeSubstituted: component.canBeSubstituted ?? false,
          searchKeywords: [component.name.toLowerCase(), 'wheels'],
          alternativeKeywords: component.alternativeKeywords ?? [],
        })),
      },
      steps: {
        create: [{ stepNumber: 1, title: 'Step 1', description: 'Build step' }],
      },
    },
    include: { requiredComponents: true },
  });
  ids.projects.push(project.id);
  return { project, materialCategoryId: materialCategory.id };
}

describe('learning-projects.build-optimizer integration', () => {
  before(() => {
    process.env.NODE_ENV = 'test';
  });

  after(async () => {
    const run = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (error) {
        console.error(
          `[${TEST_MARKER}] cleanup failed (${label}):`,
          error instanceof Error ? error.message : error,
        );
      }
    };

    await run('projectBuildItem', () =>
      prisma.projectBuildItem.deleteMany({
        where: { build: { projectId: { in: ids.projects } } },
      }),
    );
    await run('projectBuild', () =>
      prisma.projectBuild.deleteMany({
        where: { projectId: { in: ids.projects } },
      }),
    );
    await run('reservation', () =>
      prisma.reservation.deleteMany({
        where: {
          OR: [
            { materialId: { in: ids.materials } },
            { id: { in: ids.reservations } },
          ],
        },
      }),
    );
    await run('material', () =>
      prisma.material.deleteMany({ where: { id: { in: ids.materials } } }),
    );
    await run('projectStep', () =>
      prisma.projectLearningQuestion.deleteMany({
        where: { projectStep: { projectId: { in: ids.projects } } },
      }),
    );
    await run('projectStep', () =>
      prisma.projectStep.deleteMany({
        where: { projectId: { in: ids.projects } },
      }),
    );
    await run('projectRequiredComponent', () =>
      prisma.projectRequiredComponent.deleteMany({
        where: { projectId: { in: ids.projects } },
      }),
    );
    await run('learningProject', () =>
      prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } }),
    );
    await run('category', () =>
      prisma.category.deleteMany({
        where: { id: { in: [...ids.categories, ...ids.materialCategories] } },
      }),
    );
    await run('location', () =>
      prisma.location.deleteMany({ where: { id: { in: ids.locations } } }),
    );
    await run('user', () =>
      prisma.user.deleteMany({ where: { id: { in: ids.users } } }),
    );
  });

  test('optimizer returns advisory plan for optimizable components', async () => {
    const author = await createLearnerUser('author-basic');
    const supplier = await createSupplierUser('supplier-basic');
    const learner = await createLearnerUser('learner-basic');
    const { project, materialCategoryId } = await createProjectWithComponents(author.id, [
      { name: 'Wheels A', quantity: 2, unit: 'pieces' },
      { name: 'Wheels B', quantity: 1, unit: 'pieces' },
    ]);

    await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels A listing`,
      quantity: 5,
      price: 5,
    });
    await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels B listing`,
      quantity: 5,
      price: 8,
    });

    await startProjectBuildById(project.id, learner.id);
    const result = await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });

    assert.equal(result.advisory, true);
    assert.ok(result.generatedAt);
    assert.equal(result.summary.optimizable, 2);
    assert.ok(result.plans.length >= 1);
    const recommended = result.plans.find((plan) => plan.labels.includes('BEST_OVERALL'));
    assert.ok(recommended);
    assert.equal(recommended.summary.newlyPlannedComponents, 2);
    assert.equal(recommended.summary.deliveryFeeIncluded, false);
  });

  test('active holds are not subtracted twice when evaluating capacity', async () => {
    const author = await createLearnerUser('author-hold');
    const supplier = await createSupplierUser('supplier-hold');
    const learner = await createLearnerUser('learner-hold');
    const { project, materialCategoryId } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Hold', quantity: 5, unit: 'pieces' },
    ]);

    const material = await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels Hold listing`,
      quantity: 10,
      price: 4,
    });

    const reservation = await createReservation(
      learner.id,
      pickupReservationPayload(material.id, 4),
    );
    ids.reservations.push(reservation.id);

    const quantityState = await getMaterialQuantityState(prisma, material.id);
    assert.equal(quantityState?.availableQuantity.toNumber(), 6);

    await startProjectBuildById(project.id, learner.id);
    const result = await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });

    const planned = result.plans[0]?.items.find((item) => item.plannerState === 'PLANNED');
    assert.ok(planned, 'material with availableQuantity=6 should still satisfy required=5');
  });

  test('peer selected claim reduces optimizer capacity without mutating peer item', async () => {
    const author = await createLearnerUser('author-peer');
    const supplier = await createSupplierUser('supplier-peer');
    const learner = await createLearnerUser('learner-peer');
    const { project, materialCategoryId } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Peer A', quantity: 4, unit: 'pieces' },
      { name: 'Wheels Peer B', quantity: 7, unit: 'pieces' },
    ]);

    const material = await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels Peer listing`,
      quantity: 10,
      price: 3,
    });

    const build = await startProjectBuildById(project.id, learner.id);
    const [itemA, itemB] = build!.items;
    await linkBuildItemMaterialById(project.id, learner.id, itemA!.id, material.id);

    const result = await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });

    const itemBPlan = result.plans[0]?.items.find((item) => item.buildItemId === itemB!.id);
    assert.equal(itemBPlan?.plannerState, 'UNCOVERED');
    const stillLinked = await prisma.projectBuildItem.findUnique({
      where: { id: itemA!.id },
    });
    assert.equal(stillLinked?.linkedMaterialId, material.id);
  });

  test('active reservation build item is IN_PROGRESS and not re-planned', async () => {
    const author = await createLearnerUser('author-active-res');
    const supplier = await createSupplierUser('supplier-active-res');
    const learner = await createLearnerUser('learner-active-res');
    const { project, materialCategoryId } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Active', quantity: 2, unit: 'pieces' },
    ]);

    const material = await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels Active listing`,
      quantity: 5,
      price: 6,
    });

    const build = await startProjectBuildById(project.id, learner.id);
    const item = build!.items[0]!;
    await linkBuildItemMaterialById(project.id, learner.id, item.id, material.id);
    const reservation = await createReservation(
      learner.id,
      pickupReservationPayload(material.id, 2, { buildItemId: item.id }),
    );
    ids.reservations.push(reservation.id);
    await linkBuildItemReservationById(project.id, learner.id, item.id, reservation.id);

    const result = await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });

    const plannedItem = result.plans[0]?.items.find((entry) => entry.buildItemId === item.id);
    assert.equal(plannedItem?.plannerState, 'IN_PROGRESS');
    assert.equal(result.summary.optimizable, 0);
  });

  test('linked insufficient material remains ATTENTION without replacement', async () => {
    const author = await createLearnerUser('author-insufficient');
    const supplier = await createSupplierUser('supplier-insufficient');
    const learner = await createLearnerUser('learner-insufficient');
    const { project, materialCategoryId } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Insufficient', quantity: 4, unit: 'pieces' },
    ]);

    const material = await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels Insufficient listing`,
      quantity: 2,
      price: 6,
    });
    await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels Insufficient alt`,
      quantity: 10,
      price: 6,
    });

    const build = await startProjectBuildById(project.id, learner.id);
    const item = build!.items[0]!;
    await assert.rejects(
      () => linkBuildItemMaterialById(project.id, learner.id, item.id, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'INSUFFICIENT_QUANTITY');
        return true;
      },
    );

    await prisma.projectBuildItem.update({
      where: { id: item.id },
      data: { linkedMaterialId: material.id },
    });

    const result = await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });

    const plannedItem = result.plans[0]?.items.find((entry) => entry.buildItemId === item.id);
    assert.equal(plannedItem?.plannerState, 'ATTENTION');
    assert.equal(result.summary.optimizable, 0);
  });

  test('partial completed acquisition remains ATTENTION', async () => {
    const author = await createLearnerUser('author-partial');
    const supplier = await createSupplierUser('supplier-partial');
    const learner = await createLearnerUser('learner-partial');
    const { project, materialCategoryId } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Partial', quantity: 4, unit: 'pieces' },
    ]);

    const material = await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels Partial listing`,
      quantity: 10,
      price: 6,
    });

    const build = await startProjectBuildById(project.id, learner.id);
    const item = build!.items[0]!;
    await linkBuildItemMaterialById(project.id, learner.id, item.id, material.id);

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: learner.id,
        ownerId: supplier.id,
        quantityRequested: 2,
        status: 'COMPLETED',
        fulfillmentMethod: 'PICKUP',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);
    await prisma.projectBuildItem.update({
      where: { id: item.id },
      data: { linkedReservationId: reservation.id },
    });

    const result = await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });

    const plannedItem = result.plans[0]?.items.find((entry) => entry.buildItemId === item.id);
    assert.equal(plannedItem?.plannerState, 'ATTENTION');
  });

  test('already owned and checklist satisfied items are excluded from optimizable set', async () => {
    const author = await createLearnerUser('author-owned');
    const learner = await createLearnerUser('learner-owned');
    const { project } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Owned', quantity: 1, unit: 'pieces' },
      { name: 'Wheels Available', quantity: 1, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const [ownedItem, availableItem] = build!.items;
    await updateProjectBuildItemById(project.id, learner.id, ownedItem!.id, {
      status: 'ALREADY_OWNED',
    });
    await updateProjectBuildItemById(project.id, learner.id, availableItem!.id, {
      status: 'AVAILABLE',
    });

    const result = await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });

    assert.equal(result.summary.alreadySatisfied, 2);
    assert.equal(result.summary.optimizable, 0);
  });

  test('optimizer is read-only', async () => {
    const author = await createLearnerUser('author-readonly');
    const supplier = await createSupplierUser('supplier-readonly');
    const learner = await createLearnerUser('learner-readonly');
    const { project, materialCategoryId } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Readonly', quantity: 1, unit: 'pieces' },
    ]);

    await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels Readonly listing`,
      quantity: 3,
      price: 4,
    });

    const build = await startProjectBuildById(project.id, learner.id);
    const beforeItems = await prisma.projectBuildItem.findMany({
      where: { buildId: build!.id },
    });
    const beforeReservationCount = await prisma.reservation.count();

    await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });

    const afterItems = await prisma.projectBuildItem.findMany({
      where: { buildId: build!.id },
    });
    const afterReservationCount = await prisma.reservation.count();

    assert.deepEqual(
      beforeItems.map((item) => ({
        id: item.id,
        linkedMaterialId: item.linkedMaterialId,
        linkedReservationId: item.linkedReservationId,
        status: item.status,
      })),
      afterItems.map((item) => ({
        id: item.id,
        linkedMaterialId: item.linkedMaterialId,
        linkedReservationId: item.linkedReservationId,
        status: item.status,
      })),
    );
    assert.equal(beforeReservationCount, afterReservationCount);
  });

  test('other learner receives not found', async () => {
    const author = await createLearnerUser('author-auth');
    const learner = await createLearnerUser('learner-auth');
    const other = await createLearnerUser('learner-other');
    const { project } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Auth', quantity: 1, unit: 'pieces' },
    ]);

    await startProjectBuildById(project.id, learner.id);

    await assert.rejects(
      () =>
        optimizeProjectBuildPlan({
          projectId: project.id,
          learnerId: other.id,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('archived and completed builds are rejected', async () => {
    const author = await createLearnerUser('author-status');
    const learner = await createLearnerUser('learner-status');
    const { project } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Status', quantity: 1, unit: 'pieces' },
    ]);

    await startProjectBuildById(project.id, learner.id);

    await prisma.projectBuild.updateMany({
      where: { projectId: project.id, learnerId: learner.id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });

    await assert.rejects(
      () =>
        optimizeProjectBuildPlan({
          projectId: project.id,
          learnerId: learner.id,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'BUILD_ARCHIVED');
        return true;
      },
    );

    await prisma.projectBuild.updateMany({
      where: { projectId: project.id, learnerId: learner.id },
      data: {
        status: 'COMPLETED',
        archivedAt: null,
        completedAt: new Date(),
      },
    });

    await assert.rejects(
      () =>
        optimizeProjectBuildPlan({
          projectId: project.id,
          learnerId: learner.id,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'BUILD_COMPLETED');
        return true;
      },
    );
  });

  test('optimizer output is deterministic for the same build', async () => {
    const author = await createLearnerUser('author-deterministic');
    const supplier = await createSupplierUser('supplier-deterministic');
    const learner = await createLearnerUser('learner-deterministic');
    const { project, materialCategoryId } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Deterministic', quantity: 1, unit: 'pieces' },
    ]);

    await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels Deterministic listing`,
      quantity: 3,
      price: 4,
    });

    await startProjectBuildById(project.id, learner.id);
    const first = await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });
    const second = await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });

    assert.deepEqual(
      first.plans.map((plan) => ({
        labels: plan.labels,
        assignments: plan.items
          .filter((item) => item.plannerState === 'PLANNED')
          .map((item) => ({
            buildItemId: item.buildItemId,
            materialId: item.candidate?.materialId,
          })),
      })),
      second.plans.map((plan) => ({
        labels: plan.labels,
        assignments: plan.items
          .filter((item) => item.plannerState === 'PLANNED')
          .map((item) => ({
            buildItemId: item.buildItemId,
            materialId: item.candidate?.materialId,
          })),
      })),
    );
  });

  test('classifyBuildItemForOptimizer marks linked insufficient material as ATTENTION', async () => {
    const author = await createLearnerUser('author-classify');
    const supplier = await createSupplierUser('supplier-classify');
    const learner = await createLearnerUser('learner-classify');
    const { project, materialCategoryId } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Classify', quantity: 4, unit: 'pieces' },
    ]);

    const material = await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels Classify listing`,
      quantity: 2,
      price: 4,
    });

    const build = await startProjectBuildById(project.id, learner.id);
    const item = build!.items[0]!;
    await prisma.projectBuildItem.update({
      where: { id: item.id },
      data: { linkedMaterialId: material.id },
    });

    const buildRecord = await prisma.projectBuild.findFirstOrThrow({
      where: { projectId: project.id, learnerId: learner.id },
      include: {
        items: {
          include: {
            requiredComponent: true,
            linkedMaterial: true,
            linkedReservation: true,
          },
        },
      },
    });

    const itemRecord = buildRecord.items[0]!;
    const classification = classifyBuildItemForOptimizer({
      item: itemRecord,
      component: itemRecord.requiredComponent,
      availableQuantity: 2,
      peerClaimsOnMaterial: 0,
    });

    assert.equal(classification, 'ATTENTION');
  });

  test('mixed build states classify correctly in optimizer snapshot', async () => {
    const author = await createLearnerUser('author-mixed');
    const supplier = await createSupplierUser('supplier-mixed');
    const learner = await createLearnerUser('learner-mixed');
    const { project, materialCategoryId } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Owned Mixed', quantity: 1, unit: 'pieces' },
      { name: 'Wheels Active Mixed', quantity: 2, unit: 'pieces' },
      { name: 'Wheels Planned Mixed', quantity: 1, unit: 'pieces' },
      { name: 'Wheels Uncovered Mixed', quantity: 1, unit: 'kilograms' },
    ]);

    const activeMaterial = await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels Active Mixed listing`,
      quantity: 5,
      price: 6,
    });
    const plannedMaterial = await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels Planned Mixed listing`,
      quantity: 5,
      price: 4,
    });

    const build = await startProjectBuildById(project.id, learner.id);
    const [ownedItem, activeItem, plannedItem, uncoveredItem] = build!.items;

    await updateProjectBuildItemById(project.id, learner.id, ownedItem!.id, {
      status: 'ALREADY_OWNED',
    });

    await linkBuildItemMaterialById(project.id, learner.id, activeItem!.id, activeMaterial.id);
    const activeReservation = await createReservation(
      learner.id,
      pickupReservationPayload(activeMaterial.id, 2, { buildItemId: activeItem.id }),
    );
    ids.reservations.push(activeReservation.id);
    await linkBuildItemReservationById(
      project.id,
      learner.id,
      activeItem.id,
      activeReservation.id,
    );

    const result = await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });

    const byId = new Map(
      result.plans[0]?.items.map((item) => [item.buildItemId, item.plannerState]) ?? [],
    );

    assert.equal(byId.get(ownedItem!.id), 'ALREADY_SATISFIED');
    assert.equal(byId.get(activeItem!.id), 'IN_PROGRESS');
    assert.equal(byId.get(plannedItem!.id), 'PLANNED');
    assert.equal(byId.get(uncoveredItem!.id), 'UNCOVERED');

    const plannedEntry = result.plans[0]?.items.find(
      (item) => item.buildItemId === plannedItem!.id,
    );
    assert.equal(plannedEntry?.candidate?.materialId, plannedMaterial.id);
  });

  test('planned item becomes IN_PROGRESS after authoritative reservation path', async () => {
    const author = await createLearnerUser('author-lifecycle');
    const supplier = await createSupplierUser('supplier-lifecycle');
    const learner = await createLearnerUser('learner-lifecycle');
    const { project, materialCategoryId } = await createProjectWithComponents(author.id, [
      { name: 'Wheels Lifecycle', quantity: 2, unit: 'pieces' },
    ]);

    const material = await createListedMaterial({
      ownerId: supplier.id,
      materialCategoryId,
      title: `${TEST_MARKER} Wheels Lifecycle listing`,
      quantity: 5,
      price: 6,
    });

    const build = await startProjectBuildById(project.id, learner.id);
    const item = build!.items[0]!;

    const beforeReservation = await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });
    const beforeItem = beforeReservation.plans[0]?.items.find(
      (entry) => entry.buildItemId === item.id,
    );
    assert.equal(beforeItem?.plannerState, 'PLANNED');
    assert.equal(beforeItem?.candidate?.materialId, material.id);

    await linkBuildItemMaterialById(project.id, learner.id, item.id, material.id);
    const reservation = await createReservation(
      learner.id,
      pickupReservationPayload(material.id, 2, { buildItemId: item.id }),
    );
    ids.reservations.push(reservation.id);
    await linkBuildItemReservationById(project.id, learner.id, item.id, reservation.id);

    const afterReservation = await optimizeProjectBuildPlan({
      projectId: project.id,
      learnerId: learner.id,
    });
    const afterItem = afterReservation.plans[0]?.items.find(
      (entry) => entry.buildItemId === item.id,
    );
    assert.equal(afterItem?.plannerState, 'IN_PROGRESS');
    assert.equal(afterReservation.summary.optimizable, 0);
  });
});
