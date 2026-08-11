import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { Prisma, type ProjectComponentRole } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';

import {
  evaluateBuildItemQuantityAllocation,
  evaluateMaterialLinkCapacity,
  normalizeBuildMaterialUnit,
  sumSelectedMaterialClaimsInBuild,
  unitsAreCompatible,
} from './learning-projects.build-material-allocation.js';
import { syncBuildItemFromCompletedMaterialRequest } from './learning-projects.build-material-request-sync.js';
import { resolveBuildItemReadiness } from './learning-projects.build-material-linking.js';
import { isContinueBuildItemReady } from './project-build-continuation.js';
import {
  getMyProjectBuildById,
  linkBuildItemMaterialById,
  linkBuildItemReservationById,
  startProjectBuildById,
} from './learning-projects.service.js';
import { createReservation, cancelReservation } from '../reservations/reservations.service.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';

const TEST_MARKER = '[test-learning-project-material-allocation]';

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

async function createMaterial(input: {
  ownerId: string;
  quantity: number;
  unit?: string;
}) {
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
    where: { userId: input.ownerId },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: input.ownerId,
      supplierProfileId: supplierProfile?.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} wheels`,
      description: `${TEST_MARKER} material`,
      materialType: 'Wheels',
      quantity: input.quantity,
      unit: input.unit ?? 'pieces',
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

async function createProjectWithComponents(
  authorId: string,
  components: Array<{
    name: string;
    quantity: number;
    unit: string;
    role?: ProjectComponentRole;
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
      title: `${TEST_MARKER} allocation project`,
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
          canBeSubstituted: false,
        })),
      },
      steps: {
        create: [
          {
            stepNumber: 1,
            title: 'Step 1',
            description: 'Build step',
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

describe('learning-projects.build-material-allocation', () => {
  before(() => {
    process.env.NODE_ENV = 'test';
  });

  after(async () => {
    await prisma.projectBuildItem.deleteMany({
      where: { build: { projectId: { in: ids.projects } } },
    });
    await prisma.projectBuild.deleteMany({
      where: { projectId: { in: ids.projects } },
    });
    await prisma.reservation.deleteMany({
      where: { materialId: { in: ids.materials } },
    });
    await prisma.reservation.deleteMany({
      where: { id: { in: ids.reservations } },
    });
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
    await prisma.projectStep.deleteMany({
      where: { projectId: { in: ids.projects } },
    });
    await prisma.projectRequiredComponent.deleteMany({
      where: { projectId: { in: ids.projects } },
    });
    await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
    await prisma.category.deleteMany({
      where: {
        id: { in: [...ids.categories, ...ids.materialCategories] },
      },
    });
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  test('normalized units compare correctly', () => {
    assert.equal(normalizeBuildMaterialUnit('Pieces'), 'piece');
    assert.equal(normalizeBuildMaterialUnit('piece'), 'piece');
    assert.equal(normalizeBuildMaterialUnit('boxes'), 'box');
    assert.equal(normalizeBuildMaterialUnit('Boxes'), 'box');
    assert.equal(normalizeBuildMaterialUnit('packs'), 'pack');
    assert.equal(normalizeBuildMaterialUnit('bundles'), 'bundle');
    assert.equal(normalizeBuildMaterialUnit('batches'), 'batch');
    assert.equal(unitsAreCompatible('box', 'boxes'), true);
    assert.equal(unitsAreCompatible('pack', 'set'), false);
    assert.ok(unitsAreCompatible('pieces', 'piece'));
    assert.ok(!unitsAreCompatible('kg', 'piece'));
  });

  test('insufficient quantity does not make item ready', () => {
    const readiness = resolveBuildItemReadiness({
      status: 'MISSING',
      requiredQuantity: 4,
      requiredUnit: 'pieces',
      materialUnit: 'pieces',
      linkedMaterial: {
        id: 'mat-1',
        unit: 'pieces',
      } as never,
      linkedReservation: {
        id: 'res-1',
        status: 'COMPLETED',
        materialId: 'mat-1',
        quantityRequested: new Prisma.Decimal(2),
      },
    });

    assert.equal(readiness.isReadyForBuild, false);
    assert.match(readiness.readinessLabel, /insufficient|Partially acquired/i);
  });

  test('completed sufficient reservation makes item ready', () => {
    const readiness = resolveBuildItemReadiness({
      status: 'MISSING',
      requiredQuantity: 4,
      requiredUnit: 'pieces',
      materialUnit: 'pieces',
      linkedMaterial: { id: 'mat-1', unit: 'pieces' } as never,
      linkedReservation: {
        id: 'res-1',
        status: 'COMPLETED',
        materialId: 'mat-1',
        quantityRequested: new Prisma.Decimal(4),
      },
    });

    assert.equal(readiness.isReadyForBuild, true);
  });

  test('already-owned behavior remains unchanged', () => {
    const readiness = resolveBuildItemReadiness({
      status: 'ALREADY_OWNED',
    });
    assert.equal(readiness.isReadyForBuild, true);
    assert.ok(isContinueBuildItemReady({ status: 'ALREADY_OWNED', linkedReservation: null }));
  });

  test('TOOL behavior remains unchanged', () => {
    const allocation = evaluateBuildItemQuantityAllocation({
      status: 'MISSING',
      componentRole: 'TOOL',
      requiredQuantity: 1,
      requiredUnit: 'piece',
      linkedMaterialId: null,
    });
    assert.equal(allocation.outcome, 'not_applicable');
  });

  test('one material with sufficient quantity can satisfy one build item', async () => {
    const author = await createLearnerUser('author-1');
    const supplier = await createSupplierUser('supplier-1');
    const learner = await createLearnerUser('learner-1');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 10 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels', quantity: 4, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const itemId = build!.items[0]!.id;

    const linked = await linkBuildItemMaterialById(
      project.id,
      learner.id,
      itemId,
      material.id,
    );

    assert.equal(linked!.items[0]!.linkedMaterial?.id, material.id);
    assert.equal(linked!.items[0]!.isReadyForBuild, false);
    assert.notEqual(linked!.items[0]!.quantityAllocation?.outcome, 'insufficient_quantity');
  });

  test('insufficient quantity rejects second over-allocated link', async () => {
    const author = await createLearnerUser('author-2');
    const supplier = await createSupplierUser('supplier-2');
    const learner = await createLearnerUser('learner-2');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 5 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels A', quantity: 4, unit: 'pieces' },
      { name: 'Wheels B', quantity: 4, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const [itemA, itemB] = build!.items;

    await linkBuildItemMaterialById(project.id, learner.id, itemA!.id, material.id);

    await assert.rejects(
      () => linkBuildItemMaterialById(project.id, learner.id, itemB!.id, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'INSUFFICIENT_QUANTITY');
        return true;
      },
    );
  });

  test('one material can satisfy multiple items when total allocation fits', async () => {
    const author = await createLearnerUser('author-3');
    const supplier = await createSupplierUser('supplier-3');
    const learner = await createLearnerUser('learner-3');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 10 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels A', quantity: 4, unit: 'pieces' },
      { name: 'Wheels B', quantity: 3, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const [itemA, itemB] = build!.items;

    await linkBuildItemMaterialById(project.id, learner.id, itemA!.id, material.id);
    const linked = await linkBuildItemMaterialById(
      project.id,
      learner.id,
      itemB!.id,
      material.id,
    );

    assert.equal(linked!.items.filter((item) => item.linkedMaterial?.id === material.id).length, 2);
  });

  test('incompatible units do not create readiness', () => {
    const allocation = evaluateBuildItemQuantityAllocation({
      status: 'MISSING',
      componentRole: 'REQUIRED_MATERIAL',
      requiredQuantity: 4,
      requiredUnit: 'pieces',
      linkedMaterialId: 'mat-1',
      materialUnit: 'kg',
      availableQuantity: 10,
    });

    assert.equal(allocation.outcome, 'incompatible_unit');
    assert.equal(allocation.isQuantityReady, false);
  });

  test('unknown units use conservative behavior', () => {
    const allocation = evaluateBuildItemQuantityAllocation({
      status: 'MISSING',
      componentRole: 'REQUIRED_MATERIAL',
      requiredQuantity: 4,
      requiredUnit: 'pieces',
      linkedMaterialId: 'mat-1',
      materialUnit: '',
      availableQuantity: 10,
    });

    assert.equal(allocation.outcome, 'unknown_quantity');
    assert.equal(allocation.isQuantityReady, false);
  });

  test('sumSelectedMaterialClaimsInBuild excludes completed reservations', () => {
    const total = sumSelectedMaterialClaimsInBuild({
      materialId: 'mat-1',
      peerItems: [
        {
          id: 'a',
          linkedMaterialId: 'mat-1',
          linkedReservationId: 'res-1',
          requiredQuantity: 4,
          requiredUnit: 'pieces',
          componentRole: 'REQUIRED_MATERIAL',
          linkedReservation: {
            id: 'res-1',
            status: 'COMPLETED',
            quantityRequested: new Prisma.Decimal(4),
            materialId: 'mat-1',
          },
        },
        {
          id: 'b',
          linkedMaterialId: 'mat-1',
          linkedReservationId: null,
          requiredQuantity: 3,
          requiredUnit: 'pieces',
          componentRole: 'REQUIRED_MATERIAL',
          linkedReservation: null,
        },
      ],
      excludeItemId: 'c',
    });

    assert.equal(total, 3);
  });

  test('build progress uses quantity-aware readiness', async () => {
    const author = await createLearnerUser('author-4');
    const supplier = await createSupplierUser('supplier-4');
    const learner = await createLearnerUser('learner-4');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 10 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels', quantity: 4, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const itemId = build!.items[0]!.id;
    await linkBuildItemMaterialById(project.id, learner.id, itemId, material.id);

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

    await prisma.projectBuildItem.update({
      where: { id: itemId },
      data: { linkedReservationId: reservation.id },
    });

    const mapped = await getMyProjectBuildById(project.id, learner.id);
    assert.equal(mapped?.items[0]?.isReadyForBuild, false);
    assert.equal(mapped?.progress.ready, 0);
  });

  test('rejects new manual link when listing quantity is below component requirement', async () => {
    const author = await createLearnerUser('author-insufficient');
    const supplier = await createSupplierUser('supplier-insufficient');
    const learner = await createLearnerUser('learner-insufficient');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 2 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels', quantity: 4, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const itemId = build!.items[0]!.id;

    await assert.rejects(
      () => linkBuildItemMaterialById(project.id, learner.id, itemId, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'INSUFFICIENT_QUANTITY');
        const details = error.details as {
          messageEn?: string;
          messageAr?: string;
        };
        assert.equal(details.messageEn, '2 available, 4 required');
        assert.equal(details.messageAr, 'المتوفر 2، المطلوب 4');
        return true;
      },
    );

    const refreshed = await getMyProjectBuildById(project.id, learner.id);
    assert.equal(refreshed?.items[0]?.linkedMaterial, null);
    assert.equal(refreshed?.items[0]?.isReadyForBuild, false);
  });

  test('evaluateMaterialLinkCapacity does not double-count active reservation holds', () => {
    const itemBSucceeds = evaluateMaterialLinkCapacity({
      availableQuantity: 6,
      peerSelectedClaims: 0,
      requiredQuantity: 3,
    });
    assert.equal(itemBSucceeds.ok, true);

    const itemCRejected = evaluateMaterialLinkCapacity({
      availableQuantity: 6,
      peerSelectedClaims: 3,
      requiredQuantity: 4,
    });
    assert.equal(itemCRejected.ok, false);
    if (!itemCRejected.ok) {
      assert.equal(itemCRejected.code, 'insufficient_quantity');
    }
  });

  test('active reservation hold is not double-counted across build items', async () => {
    const author = await createLearnerUser('author-holds');
    const supplier = await createSupplierUser('supplier-holds');
    const learner = await createLearnerUser('learner-holds');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 10 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels A', quantity: 4, unit: 'pieces' },
      { name: 'Wheels B', quantity: 3, unit: 'pieces' },
      { name: 'Wheels C', quantity: 4, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const [itemA, itemB, itemC] = build!.items;

    await linkBuildItemMaterialById(project.id, learner.id, itemA!.id, material.id);
    const reservation = await createReservation(
      learner.id,
      pickupReservationPayload(material.id, 4, { buildItemId: itemA!.id }),
    );
    ids.reservations.push(reservation.id);

    const linkedB = await linkBuildItemMaterialById(
      project.id,
      learner.id,
      itemB!.id,
      material.id,
    );
    assert.equal(linkedB?.items[1]?.linkedMaterial?.id, material.id);

    await assert.rejects(
      () => linkBuildItemMaterialById(project.id, learner.id, itemC!.id, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'INSUFFICIENT_QUANTITY');
        return true;
      },
    );
  });

  test('selected claims before active reservation still use canonical capacity', async () => {
    const author = await createLearnerUser('author-order');
    const supplier = await createSupplierUser('supplier-order');
    const learner = await createLearnerUser('learner-order');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 10 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels A', quantity: 4, unit: 'pieces' },
      { name: 'Wheels B', quantity: 3, unit: 'pieces' },
      { name: 'Wheels C', quantity: 4, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const [itemA, itemB, itemC] = build!.items;

    await linkBuildItemMaterialById(project.id, learner.id, itemA!.id, material.id);
    await linkBuildItemMaterialById(project.id, learner.id, itemB!.id, material.id);

    const reservation = await createReservation(
      learner.id,
      pickupReservationPayload(material.id, 4, { buildItemId: itemA!.id }),
    );
    ids.reservations.push(reservation.id);

    await assert.rejects(
      () => linkBuildItemMaterialById(project.id, learner.id, itemC!.id, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'INSUFFICIENT_QUANTITY');
        return true;
      },
    );
  });

  test('one reservation cannot link to two different build items', async () => {
    const author = await createLearnerUser('author-res-uniq');
    const supplier = await createSupplierUser('supplier-res-uniq');
    const learner = await createLearnerUser('learner-res-uniq');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 10 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels A', quantity: 4, unit: 'pieces' },
      { name: 'Wheels B', quantity: 4, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const [itemA, itemB] = build!.items;

    await linkBuildItemMaterialById(project.id, learner.id, itemA!.id, material.id);
    await linkBuildItemMaterialById(project.id, learner.id, itemB!.id, material.id);

    const reservation = await createReservation(
      learner.id,
      pickupReservationPayload(material.id, 4, { buildItemId: itemA!.id }),
    );
    ids.reservations.push(reservation.id);

    const idempotent = await linkBuildItemReservationById(
      project.id,
      learner.id,
      itemA!.id,
      reservation.id,
    );
    const itemAView = idempotent?.items.find((item) => item.id === itemA!.id);
    assert.equal(itemAView?.linkedReservation?.id, reservation.id);

    await assert.rejects(
      () =>
        linkBuildItemReservationById(
          project.id,
          learner.id,
          itemB!.id,
          reservation.id,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'RESERVATION_ALREADY_ALLOCATED');
        return true;
      },
    );

    const mapped = await getMyProjectBuildById(project.id, learner.id);
    const itemBView = mapped?.items.find((item) => item.id === itemB!.id);
    assert.equal(itemBView?.linkedReservation, null);
    assert.equal(itemBView?.isReadyForBuild, false);
  });

  test('material request sync rejects reservation already linked elsewhere', async () => {
    const author = await createLearnerUser('author-mr-uniq');
    const supplier = await createSupplierUser('supplier-mr-uniq');
    const learner = await createLearnerUser('learner-mr-uniq');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 10 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels A', quantity: 4, unit: 'pieces' },
      { name: 'Wheels B', quantity: 4, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const [itemA, itemB] = build!.items;

    await linkBuildItemMaterialById(project.id, learner.id, itemA!.id, material.id);
    await linkBuildItemMaterialById(project.id, learner.id, itemB!.id, material.id);

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: learner.id,
        ownerId: supplier.id,
        quantityRequested: 4,
        status: 'COMPLETED',
        fulfillmentMethod: 'PICKUP',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);

    await prisma.projectBuildItem.update({
      where: { id: itemA!.id },
      data: { linkedReservationId: reservation.id },
    });

    const outcome = await prisma.$transaction((tx) =>
      syncBuildItemFromCompletedMaterialRequest(tx, {
        materialRequest: {
          id: 'mr-test',
          learnerId: learner.id,
          projectBuildId: build!.id,
          projectBuildItemId: itemB!.id,
        },
        match: {
          materialRequestId: 'mr-test',
          materialId: material.id,
          reservationId: reservation.id,
        },
        reservation: {
          id: reservation.id,
          status: 'COMPLETED',
          requesterId: learner.id,
          materialId: material.id,
        },
      }),
    );

    assert.equal(outcome, 'conflict');
  });

  test('concurrent link attempts cannot exceed material capacity', async () => {
    const author = await createLearnerUser('author-concurrent');
    const supplier = await createSupplierUser('supplier-concurrent');
    const learner = await createLearnerUser('learner-concurrent');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 5 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels A', quantity: 4, unit: 'pieces' },
      { name: 'Wheels B', quantity: 4, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const [itemA, itemB] = build!.items;

    const [first, second] = await Promise.allSettled([
      linkBuildItemMaterialById(project.id, learner.id, itemA!.id, material.id),
      linkBuildItemMaterialById(project.id, learner.id, itemB!.id, material.id),
    ]);

    const outcomes = [first, second];
    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    const refreshed = await getMyProjectBuildById(project.id, learner.id);
    const linkedCount = refreshed!.items.filter(
      (item) => item.linkedMaterial?.id === material.id,
    ).length;
    assert.equal(linkedCount, 1);
  });

  test('cancelled reservation releases capacity for another build item', async () => {
    const author = await createLearnerUser('author-release');
    const supplier = await createSupplierUser('supplier-release');
    const learner = await createLearnerUser('learner-release');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 6 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels A', quantity: 4, unit: 'pieces' },
      { name: 'Wheels B', quantity: 2, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const [itemA, itemB] = build!.items;

    await linkBuildItemMaterialById(project.id, learner.id, itemA!.id, material.id);
    const reservation = await createReservation(
      learner.id,
      pickupReservationPayload(material.id, 5, { buildItemId: itemA!.id }),
    );
    ids.reservations.push(reservation.id);

    await assert.rejects(
      () => linkBuildItemMaterialById(project.id, learner.id, itemB!.id, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'INSUFFICIENT_QUANTITY');
        return true;
      },
    );

    await cancelReservation(learner.id, reservation.id);

    await linkBuildItemMaterialById(project.id, learner.id, itemB!.id, material.id);
    const releasedReservation = await createReservation(
      learner.id,
      pickupReservationPayload(material.id, 2, { buildItemId: itemB!.id }),
    );
    ids.reservations.push(releasedReservation.id);

    const itemARefreshed = await prisma.projectBuildItem.findUnique({
      where: { id: itemA!.id },
    });
    assert.equal(itemARefreshed?.linkedReservationId, null);
    assert.equal(itemARefreshed?.linkedMaterialId, material.id);

    const itemBRefreshed = await prisma.projectBuildItem.findUnique({
      where: { id: itemB!.id },
    });
    assert.equal(itemBRefreshed?.linkedReservationId, releasedReservation.id);
  });

  test('partial completed acquisition remains visible but not ready', async () => {
    const author = await createLearnerUser('author-partial');
    const supplier = await createSupplierUser('supplier-partial');
    const learner = await createLearnerUser('learner-partial');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 10 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels', quantity: 4, unit: 'pieces' },
    ]);

    const build = await startProjectBuildById(project.id, learner.id);
    const itemId = build!.items[0]!.id;
    await linkBuildItemMaterialById(project.id, learner.id, itemId, material.id);

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
      where: { id: itemId },
      data: { linkedReservationId: reservation.id },
    });

    const mapped = await getMyProjectBuildById(project.id, learner.id);
    const item = mapped?.items[0];
    assert.equal(item?.linkedMaterial?.id, material.id);
    assert.equal(item?.linkedReservation?.status, 'COMPLETED');
    assert.equal(item?.isReadyForBuild, false);
    assert.equal(item?.quantityAllocation?.outcome, 'allocation_partial');
    assert.equal(item?.quantityAllocation?.acquiredQuantity, 2);
    assert.equal(item?.quantityAllocation?.requiredQuantity, 4);
    assert.equal(mapped?.progress.ready, 0);
    assert.equal(mapped?.stepProgress.nextAction, 'PREPARE_MATERIALS');
  });

  test('completed sufficient reservation stays ready when listing quantity is zero', async () => {
    const author = await createLearnerUser('author-zero-listing');
    const supplier = await createSupplierUser('supplier-zero-listing');
    const learner = await createLearnerUser('learner-zero-listing');
    const material = await createMaterial({ ownerId: supplier.id, quantity: 1 });
    const project = await createProjectWithComponents(author.id, [
      { name: 'Wheels', quantity: 1, unit: 'pieces' },
    ]);

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
      data: { linkedReservationId: reservation.id },
    });

    await prisma.material.update({
      where: { id: material.id },
      data: { quantity: 0, status: 'REUSED' },
    });

    const mapped = await getMyProjectBuildById(project.id, learner.id);
    const item = mapped?.items[0];

    assert.equal(item?.linkedReservation?.status, 'COMPLETED');
    assert.equal(item?.quantityAllocation?.outcome, 'allocation_sufficient');
    assert.equal(item?.quantityAllocation?.acquiredQuantity, 1);
    assert.equal(item?.quantityAllocation?.requiredQuantity, 1);
    assert.equal(item?.quantityAllocation?.availableQuantity, null);
    assert.equal(item?.isReadyForBuild, true);
    assert.equal(mapped?.progress.ready, 1);
    assert.equal(item?.readinessLabel, 'Ready for build — material acquired');
  });
});
