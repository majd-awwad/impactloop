import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import {
  completeProjectBuildStepById,
  getMyProjectBuildById,
  getOrCreateBuildGuideConversationByProjectId,
  linkBuildItemMaterialById,
  startProjectBuildById,
  updateProjectBuildItemById,
} from './learning-projects.service.js';

const TEST_MARKER = '[test-learning-project-build-steps]';

type TestIds = {
  users: string[];
  categories: string[];
  materialCategories: string[];
  locations: string[];
  materials: string[];
  projects: string[];
  builds: string[];
  conversations: string[];
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
  conversations: [],
  reservations: [],
};

function assertAllStepsLocked(
  build: NonNullable<Awaited<ReturnType<typeof getMyProjectBuildById>>>,
) {
  assert.equal(build.stepProgress.currentStep, null);
  assert.equal(build.stepProgress.nextAction, 'PREPARE_MATERIALS');
  assert.ok(build.stepProgress.steps.every((step) => step.state === 'LOCKED'));
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
      materialType: 'LED',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
    },
  });
  ids.materials.push(material.id);
  return material;
}

async function createProjectCategories(suffix: string) {
  const projectCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Projects ${suffix}`,
      nameAr: `${TEST_MARKER} مشاريع ${suffix}`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(projectCategory.id);
  const materialCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Electronics ${suffix}`,
      nameAr: `${TEST_MARKER} إلكترونيات ${suffix}`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });
  ids.materialCategories.push(materialCategory.id);
  return { projectCategory, materialCategory };
}

async function createPublishedProjectWithZeroSteps(input: {
  authorId: string;
  projectCategoryId: string;
  materialCategoryId: string;
}) {
  const project = await prisma.learningProject.create({
    data: {
      categoryId: input.projectCategoryId,
      createdBy: input.authorId,
      title: `${TEST_MARKER} Zero-step project`,
      shortDescription: `${TEST_MARKER} short`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      requiredComponents: {
        create: [
          {
            componentName: 'LED',
            materialType: 'LED',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: input.materialCategoryId,
            searchKeywords: ['led'],
          },
        ],
      },
    },
    include: {
      requiredComponents: true,
      steps: { orderBy: { stepNumber: 'asc' } },
    },
  });
  ids.projects.push(project.id);
  return project;
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

async function createPublishedProjectWithSteps(input: {
  authorId: string;
  projectCategoryId: string;
  materialCategoryId: string;
}) {
  const project = await prisma.learningProject.create({
    data: {
      categoryId: input.projectCategoryId,
      createdBy: input.authorId,
      title: `${TEST_MARKER} Step project`,
      shortDescription: `${TEST_MARKER} short`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      requiredComponents: {
        create: [
          {
            componentName: 'LED',
            materialType: 'LED',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: input.materialCategoryId,
            searchKeywords: ['led'],
          },
          {
            componentName: 'Resistor',
            materialType: 'Resistor',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: input.materialCategoryId,
            searchKeywords: ['resistor'],
          },
        ],
      },
      steps: {
        create: [
          {
            stepNumber: 1,
            title: 'Place the LED',
            description: 'Insert LED into breadboard',
            reviewStatus: 'ACCEPTED',
          },
          {
            stepNumber: 2,
            title: 'Add the resistor',
            description: 'Connect resistor in series',
            reviewStatus: 'ACCEPTED',
          },
        ],
      },
    },
    include: {
      requiredComponents: true,
      steps: { orderBy: { stepNumber: 'asc' } },
    },
  });
  ids.projects.push(project.id);
  return project;
}

before(() => {
  process.env.NODE_ENV = 'test';
});

after(async () => {
  if (ids.conversations.length > 0) {
    await prisma.aiConversation.deleteMany({
      where: { id: { in: ids.conversations } },
    });
  }

  if (ids.reservations.length > 0) {
    await prisma.reservation.deleteMany({
      where: { id: { in: ids.reservations } },
    });
  }

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
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('learning project build step progress', () => {
  test('locks all steps until materials are ready', async () => {
    const learner = await createLearnerUser('steps-a');
    const projectCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Projects`,
        nameAr: `${TEST_MARKER} مشاريع`,
        categoryType: 'PROJECT',
        isActive: true,
      },
    });
    ids.categories.push(projectCategory.id);
    const materialCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Electronics`,
        nameAr: `${TEST_MARKER} إلكترونيات`,
        categoryType: 'BOTH',
        isActive: true,
      },
    });
    ids.materialCategories.push(materialCategory.id);

    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    assert.equal(build.stepProgress.percent, 0);
    assert.equal(build.stepProgress.currentStep, null);
    assert.equal(build.stepProgress.nextAction, 'PREPARE_MATERIALS');
    assert.ok(
      build.stepProgress.steps.every((step) => step.state === 'LOCKED'),
    );
  });

  test('unlocks step 1 when all materials become ready', async () => {
    const learner = await createLearnerUser('steps-b');
    const projectCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Projects B`,
        nameAr: `${TEST_MARKER} مشاريع B`,
        categoryType: 'PROJECT',
        isActive: true,
      },
    });
    ids.categories.push(projectCategory.id);
    const materialCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Electronics B`,
        nameAr: `${TEST_MARKER} إلكترونيات B`,
        categoryType: 'BOTH',
        isActive: true,
      },
    });
    ids.materialCategories.push(materialCategory.id);

    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(started.id);

    for (const item of started.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'ALREADY_OWNED',
        learnerNote: null,
      });
    }

    const ready = await getMyProjectBuildById(project.id, learner.id);
    assert.ok(ready);
    assert.equal(ready.stepProgress.currentStep?.stepNumber, 1);
    assert.equal(ready.stepProgress.steps[0]?.state, 'CURRENT');
    assert.equal(ready.stepProgress.steps[1]?.state, 'LOCKED');
    assert.equal(ready.stepProgress.nextAction, 'COMPLETE_CURRENT_STEP');
  });

  test('completes current step sequentially and finishes the build', async () => {
    const learner = await createLearnerUser('steps-c');
    const projectCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Projects C`,
        nameAr: `${TEST_MARKER} مشاريع C`,
        categoryType: 'PROJECT',
        isActive: true,
      },
    });
    ids.categories.push(projectCategory.id);
    const materialCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Electronics C`,
        nameAr: `${TEST_MARKER} إلكترونيات C`,
        categoryType: 'BOTH',
        isActive: true,
      },
    });
    ids.materialCategories.push(materialCategory.id);

    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(started.id);

    for (const item of started.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'ALREADY_OWNED',
        learnerNote: null,
      });
    }

    const step1Id = project.steps[0]!.id;
    const step2Id = project.steps[1]!.id;

    const afterStep1 = await completeProjectBuildStepById(
      project.id,
      learner.id,
      step1Id,
    );
    assert.equal(afterStep1.stepProgress.steps[0]?.state, 'COMPLETED');
    assert.equal(afterStep1.stepProgress.steps[1]?.state, 'CURRENT');
    assert.equal(afterStep1.stepProgress.completed, 1);

    const afterStep1Again = await completeProjectBuildStepById(
      project.id,
      learner.id,
      step1Id,
    );
    assert.equal(afterStep1Again.stepProgress.steps[0]?.state, 'COMPLETED');
    assert.equal(
      await prisma.projectBuildStepProgress.count({ where: { buildId: started.id } }),
      1,
    );

    const finished = await completeProjectBuildStepById(
      project.id,
      learner.id,
      step2Id,
    );
    assert.equal(finished.status, 'COMPLETED');
    assert.equal(finished.stepProgress.percent, 100);
    assert.equal(finished.stepProgress.currentStep, null);
    assert.equal(finished.stepProgress.nextAction, 'BUILD_COMPLETED');
  });

  test('rejects completing a later step before the current step', async () => {
    const learner = await createLearnerUser('steps-seq');
    const projectCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Projects Seq`,
        nameAr: `${TEST_MARKER} مشاريع Seq`,
        categoryType: 'PROJECT',
        isActive: true,
      },
    });
    ids.categories.push(projectCategory.id);
    const materialCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Electronics Seq`,
        nameAr: `${TEST_MARKER} إلكترونيات Seq`,
        categoryType: 'BOTH',
        isActive: true,
      },
    });
    ids.materialCategories.push(materialCategory.id);

    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(started.id);

    for (const item of started.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'ALREADY_OWNED',
        learnerNote: null,
      });
    }

    const step2Id = project.steps[1]!.id;

    await assert.rejects(
      () => completeProjectBuildStepById(project.id, learner.id, step2Id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'BUILD_STEP_LOCKED');
        return true;
      },
    );

    assert.equal(
      await prisma.projectBuildStepProgress.count({ where: { buildId: started.id } }),
      0,
    );
  });

  test('rejects step completion while materials are missing', async () => {
    const learner = await createLearnerUser('steps-d');
    const projectCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Projects D`,
        nameAr: `${TEST_MARKER} مشاريع D`,
        categoryType: 'PROJECT',
        isActive: true,
      },
    });
    ids.categories.push(projectCategory.id);
    const materialCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Electronics D`,
        nameAr: `${TEST_MARKER} إلكترونيات D`,
        categoryType: 'BOTH',
        isActive: true,
      },
    });
    ids.materialCategories.push(materialCategory.id);

    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(started.id);

    await assert.rejects(
      () =>
        completeProjectBuildStepById(project.id, learner.id, project.steps[0]!.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'BUILD_MATERIALS_NOT_READY');
        return true;
      },
    );

    assert.equal(
      await prisma.projectBuildStepProgress.count({ where: { buildId: started.id } }),
      0,
    );
  });

  test('blocks another learner from completing step progress', async () => {
    const owner = await createLearnerUser('steps-owner');
    const other = await createLearnerUser('steps-other');
    const projectCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Projects E`,
        nameAr: `${TEST_MARKER} مشاريع E`,
        categoryType: 'PROJECT',
        isActive: true,
      },
    });
    ids.categories.push(projectCategory.id);
    const materialCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Electronics E`,
        nameAr: `${TEST_MARKER} إلكترونيات E`,
        categoryType: 'BOTH',
        isActive: true,
      },
    });
    ids.materialCategories.push(materialCategory.id);

    const project = await createPublishedProjectWithSteps({
      authorId: owner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, owner.id);
    ids.builds.push(started.id);

    for (const item of started.items) {
      await updateProjectBuildItemById(project.id, owner.id, item.id, {
        status: 'ALREADY_OWNED',
        learnerNote: null,
      });
    }

    await assert.rejects(
      () =>
        completeProjectBuildStepById(project.id, other.id, project.steps[0]!.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'BUILD_NOT_FOUND');
        return true;
      },
    );
  });

  test('get-or-create build guide conversation is stable per build', async () => {
    const learner = await createLearnerUser('steps-guide');
    const other = await createLearnerUser('steps-guide-other');
    const projectCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Projects F`,
        nameAr: `${TEST_MARKER} مشاريع F`,
        categoryType: 'PROJECT',
        isActive: true,
      },
    });
    ids.categories.push(projectCategory.id);
    const materialCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Electronics F`,
        nameAr: `${TEST_MARKER} إلكترونيات F`,
        categoryType: 'BOTH',
        isActive: true,
      },
    });
    ids.materialCategories.push(materialCategory.id);

    const projectA = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const projectB = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const buildA = await startProjectBuildById(projectA.id, learner.id);
    const buildB = await startProjectBuildById(projectB.id, learner.id);
    ids.builds.push(buildA.id, buildB.id);

    const first = await getOrCreateBuildGuideConversationByProjectId(
      projectA.id,
      learner.id,
      'en',
    );
    ids.conversations.push(first.conversation.id);

    const second = await getOrCreateBuildGuideConversationByProjectId(
      projectA.id,
      learner.id,
      'en',
    );
    assert.equal(second.conversation.id, first.conversation.id);
    assert.equal(second.conversation.kind, 'BUILD_GUIDE');
    assert.equal(second.buildContext.buildId, buildA.id);

    const otherBuildConversation = await getOrCreateBuildGuideConversationByProjectId(
      projectB.id,
      learner.id,
      'en',
    );
    ids.conversations.push(otherBuildConversation.conversation.id);
    assert.notEqual(otherBuildConversation.conversation.id, first.conversation.id);

    await assert.rejects(
      () => getOrCreateBuildGuideConversationByProjectId(projectA.id, other.id, 'en'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'BUILD_NOT_FOUND');
        return true;
      },
    );

    await prisma.aiConversation.update({
      where: { id: first.conversation.id },
      data: { status: 'ARCHIVED' },
    });

    const restored = await getOrCreateBuildGuideConversationByProjectId(
      projectA.id,
      learner.id,
      'en',
    );
    assert.equal(restored.conversation.id, first.conversation.id);
    assert.equal(restored.conversation.status, 'ACTIVE');
    assert.equal(
      await prisma.aiConversation.count({
        where: { userId: learner.id, projectBuildId: buildA.id },
      }),
      1,
    );
  });
});

describe('build step unlock material readiness', () => {
  test('keeps steps LOCKED for MISSING checklist status', async () => {
    const learner = await createLearnerUser('readiness-missing');
    const { projectCategory, materialCategory } =
      await createProjectCategories('missing');
    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    assert.ok(build.items.every((item) => item.status === 'MISSING'));
    assertAllStepsLocked(build);
  });

  test('keeps steps LOCKED when checklist status is AVAILABLE self-report', async () => {
    const learner = await createLearnerUser('readiness-available');
    const { projectCategory, materialCategory } =
      await createProjectCategories('available');
    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(started.id);

    for (const item of started.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'AVAILABLE',
        learnerNote: null,
      });
    }

    const build = await getMyProjectBuildById(project.id, learner.id);
    assert.ok(build);
    assert.ok(build.items.every((item) => item.isReadyForBuild));
    assertAllStepsLocked(build);
  });

  test('keeps steps LOCKED when a platform material is linked but not acquired', async () => {
    const learner = await createLearnerUser('readiness-linked');
    const supplier = await createSupplierUser('readiness-linked');
    const { projectCategory, materialCategory } =
      await createProjectCategories('linked');
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} LED pack`,
    });
    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(started.id);

    await linkBuildItemMaterialById(
      project.id,
      learner.id,
      started.items[0]!.id,
      material.id,
    );

    const build = await getMyProjectBuildById(project.id, learner.id);
    assert.ok(build);
    assert.ok(build.items.some((item) => item.linkedMaterial != null));
    assertAllStepsLocked(build);
  });

  test('keeps steps LOCKED for active RESERVED checklist status', async () => {
    const learner = await createLearnerUser('readiness-reserved');
    const { projectCategory, materialCategory } =
      await createProjectCategories('reserved');
    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(started.id);

    for (const item of started.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'RESERVED',
        learnerNote: null,
      });
    }

    const build = await getMyProjectBuildById(project.id, learner.id);
    assert.ok(build);
    assertAllStepsLocked(build);
  });

  test('unlocks steps when linked reservation is COMPLETED', async () => {
    const learner = await createLearnerUser('readiness-completed');
    const supplier = await createSupplierUser('readiness-completed');
    const { projectCategory, materialCategory } =
      await createProjectCategories('completed');
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Resistor pack`,
    });
    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(started.id);

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        ownerId: supplier.id,
        requesterId: learner.id,
        quantityRequested: 1,
        fulfillmentMethod: 'PICKUP',
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);

    for (const item of started.items) {
      await prisma.projectBuildItem.update({
        where: { id: item.id },
        data: {
          linkedMaterialId: material.id,
          linkedReservationId: reservation.id,
          linkedMaterialAt: new Date(),
        },
      });
    }

    const build = await getMyProjectBuildById(project.id, learner.id);
    assert.ok(build);
    assert.equal(build.stepProgress.currentStep?.stepNumber, 1);
    assert.equal(build.stepProgress.steps[0]?.state, 'CURRENT');
    assert.equal(build.stepProgress.steps[1]?.state, 'LOCKED');
  });

  test('unlocks steps for ALREADY_OWNED checklist status', async () => {
    const learner = await createLearnerUser('readiness-owned');
    const { projectCategory, materialCategory } =
      await createProjectCategories('owned');
    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(started.id);

    for (const item of started.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'ALREADY_OWNED',
        learnerNote: null,
      });
    }

    const build = await getMyProjectBuildById(project.id, learner.id);
    assert.ok(build);
    assert.equal(build.stepProgress.currentStep?.stepNumber, 1);
    assert.equal(build.stepProgress.steps[0]?.state, 'CURRENT');
    assert.equal(build.stepProgress.steps[1]?.state, 'LOCKED');
  });

  test('keeps steps LOCKED for suggested ALTERNATIVE status', async () => {
    const learner = await createLearnerUser('readiness-alternative');
    const { projectCategory, materialCategory } =
      await createProjectCategories('alternative');
    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(started.id);

    for (const item of started.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'ALTERNATIVE',
        learnerNote: null,
      });
    }

    const build = await getMyProjectBuildById(project.id, learner.id);
    assert.ok(build);
    assert.ok(build.items.every((item) => item.isReadyForBuild));
    assertAllStepsLocked(build);
  });

  test('returns stable progress for a project with zero steps', async () => {
    const learner = await createLearnerUser('readiness-zero-steps');
    const { projectCategory, materialCategory } =
      await createProjectCategories('zero-steps');
    const project = await createPublishedProjectWithZeroSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(started.id);

    for (const item of started.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'ALREADY_OWNED',
        learnerNote: null,
      });
    }

    const build = await getMyProjectBuildById(project.id, learner.id);
    assert.ok(build);
    assert.equal(build.status, 'IN_PROGRESS');
    assert.equal(build.stepProgress.total, 0);
    assert.equal(build.stepProgress.completed, 0);
    assert.equal(build.stepProgress.percent, 0);
    assert.equal(build.stepProgress.currentStep, null);
    assert.equal(build.stepProgress.nextAction, null);
    assert.deepEqual(build.stepProgress.steps, []);
  });

  test('unlocks step 1 when every material is genuinely ready on multi-step builds', async () => {
    const learner = await createLearnerUser('readiness-multi');
    const { projectCategory, materialCategory } =
      await createProjectCategories('multi');
    const project = await createPublishedProjectWithSteps({
      authorId: learner.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });
    const started = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(started.id);

    for (const item of started.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'ALREADY_OWNED',
        learnerNote: null,
      });
    }

    const build = await getMyProjectBuildById(project.id, learner.id);
    assert.ok(build);
    assert.equal(build.stepProgress.total, 2);
    assert.equal(build.stepProgress.currentStep?.stepNumber, 1);
    assert.equal(build.stepProgress.steps[0]?.state, 'CURRENT');
    assert.ok(build.stepProgress.steps.slice(1).every((step) => step.state === 'LOCKED'));
  });
});
