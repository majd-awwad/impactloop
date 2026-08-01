import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import { submitLearningProjectForReview } from './learning-projects.service.js';
import {
  normalizeSubmitComponent,
  resolveSubmitMaterialType,
} from './learning-projects.submit-components.js';
import { submitLearningProjectSchema } from './learning-projects.validation.js';

const TEST_MARKER = '[test-learning-project-submit-components]';

type TestIds = {
  users: string[];
  categories: string[];
  projects: string[];
};

const ids: TestIds = {
  users: [],
  categories: [],
  projects: [],
};

async function createLearnerUser() {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner`,
      email: `${TEST_MARKER}-learner-${Date.now()}@impactloop.test`,
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

async function createMaterialCategory(categoryType: 'MATERIAL' | 'PROJECT') {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} ${categoryType} cat`,
      nameAr: `${TEST_MARKER} فئة`,
      categoryType,
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
}

function baseSubmitInput(categoryId: string) {
  return {
    title: `${TEST_MARKER} Structured project`,
    shortDescription: `${TEST_MARKER} short description for structured components.`,
    description: `${TEST_MARKER} full description for structured components testing.`,
    categoryId,
    difficulty: 'BEGINNER' as const,
    estimatedDurationMinutes: 120,
  };
}

before(async () => {
  await prisma.$connect();
});

after(async () => {
  const projectIds = ids.projects.filter((id): id is string => Boolean(id));
  if (projectIds.length > 0) {
    await prisma.projectRequiredComponent.deleteMany({
      where: { projectId: { in: projectIds } },
    });
    await prisma.learningProject.deleteMany({
      where: { id: { in: projectIds } },
    });
  }

  if (ids.users.length > 0) {
    await prisma.idempotencyRecord.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.learningProject.deleteMany({
      where: { createdBy: { in: ids.users } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }

  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }

  await prisma.$disconnect();
});

describe('learning project structured submit components', () => {
  test('normalizeSubmitComponent applies defaults and keywords', () => {
    const normalized = normalizeSubmitComponent({
      name: 'Arduino Uno',
      quantity: 2,
      unit: 'pieces',
      componentRole: 'TOOL',
      searchKeywords: ['arduino', 'uno'],
    });

    assert.equal(normalized.quantity, 2);
    assert.equal(normalized.unit, 'pieces');
    assert.equal(normalized.componentRole, 'TOOL');
    assert.equal(normalized.materialType, 'Arduino Uno');
    assert.equal(normalized.canBeSubstituted, false);
    assert.equal(normalized.isRequired, true);
    assert.ok(normalized.searchKeywords.includes('Arduino Uno'));
    assert.ok(normalized.searchKeywords.includes('arduino'));
  });

  test('resolveSubmitMaterialType prefers explicit type', () => {
    assert.equal(
      resolveSubmitMaterialType('LED', 'Light diode'),
      'Light diode',
    );
    assert.equal(resolveSubmitMaterialType('LED', ''), 'LED');
    assert.equal(resolveSubmitMaterialType('', ''), 'Unspecified');
  });

  test('normalizeSubmitComponent splits comma-separated keywords', () => {
    const normalized = normalizeSubmitComponent({
      name: 'Arduino Uno',
      searchKeywords: ['arduino, microcontroller', 'uno'],
    });

    assert.ok(normalized.searchKeywords.includes('arduino'));
    assert.ok(normalized.searchKeywords.includes('microcontroller'));
    assert.ok(normalized.searchKeywords.includes('uno'));
  });

  test('submit schema accepts cuid component categoryId values', () => {
    const categoryId = 'clxyz1234567890abcdefghij';
    const parsed = submitLearningProjectSchema.parse({
      title: `${TEST_MARKER} schema cuid category`,
      shortDescription: `${TEST_MARKER} short description for cuid category.`,
      description: `${TEST_MARKER} full description for cuid category test.`,
      categoryId: 'project-category-id',
      difficulty: 'BEGINNER',
      requiredComponents: [
        {
          name: 'LED',
          categoryId,
        },
      ],
    });

    assert.equal(parsed.requiredComponents?.[0]?.categoryId, categoryId);
  });

  test('submit schema ignores sentinel component categoryId values', () => {
    const parsed = submitLearningProjectSchema.parse({
      title: `${TEST_MARKER} schema sentinel`,
      shortDescription: `${TEST_MARKER} short description for schema test.`,
      description: `${TEST_MARKER} full description for schema sentinel test.`,
      categoryId: 'project-category-id',
      difficulty: 'BEGINNER',
      requiredComponents: [
        {
          name: 'LED',
          categoryId: 'None',
        },
      ],
    });

    assert.equal(parsed.requiredComponents?.[0]?.categoryId, undefined);
  });

  test('submit stores structured components without General materialType', async () => {
    const learner = await createLearnerUser();
    const projectCategory = await createProjectCategory();
    const materialCategory = await createMaterialCategory('MATERIAL');

    const { response } = await submitLearningProjectForReview(
      learner.id,
      {
        ...baseSubmitInput(projectCategory.id),
        requiredComponents: [
          {
            name: 'Ultrasonic sensor',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            materialType: 'Distance sensor',
            categoryId: materialCategory.id,
            searchKeywords: ['hc-sr04'],
            canBeSubstituted: true,
          },
          {
            name: 'Soldering iron',
            componentRole: 'TOOL',
          },
        ],
      },
      `submit-structured-${Date.now()}-abcdefgh`,
    );

    ids.projects.push(response.id);
    assert.ok(response.id);

    const project = await prisma.learningProject.findFirst({
      where: { id: response.id },
      include: {
        requiredComponents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    assert.ok(project);
    const stored = project!.requiredComponents;

    assert.equal(stored.length, 2);
    const sensor = stored.find(
      (component) => component.componentName === 'Ultrasonic sensor',
    );
    const tool = stored.find(
      (component) => component.componentName === 'Soldering iron',
    );

    assert.ok(sensor);
    assert.equal(sensor.materialType, 'Distance sensor');
    assert.notEqual(sensor.materialType, 'General');
    assert.equal(sensor.componentRole, 'REQUIRED_MATERIAL');
    assert.equal(sensor.categoryId, materialCategory.id);
    assert.equal(sensor.providedByUser, true);
    assert.equal(sensor.confirmedByUser, false);
    assert.equal(sensor.canBeSubstituted, true);

    const keywords = sensor.searchKeywords;
    assert.ok(Array.isArray(keywords));
    assert.ok((keywords as string[]).includes('Ultrasonic sensor'));

    assert.ok(tool);
    assert.equal(tool.componentRole, 'TOOL');
    assert.equal(tool.materialType, 'Soldering iron');
  });

  test('submit rejects duplicate component names', async () => {
    const learner = await createLearnerUser();
    const projectCategory = await createProjectCategory();

    await assert.rejects(
      () =>
        submitLearningProjectForReview(
          learner.id,
          {
            ...baseSubmitInput(projectCategory.id),
            requiredComponents: [
              { name: 'LED' },
              { name: 'led' },
            ],
          },
          `submit-duplicate-${Date.now()}-abcdefgh`,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal((error as AppError).code, 'DUPLICATE_COMPONENT_NAME');
        return true;
      },
    );
  });

  test('submit rejects PROJECT-only component category', async () => {
    const learner = await createLearnerUser();
    const projectCategory = await createProjectCategory();
    const projectOnlyCategory = await createMaterialCategory('PROJECT');

    await assert.rejects(
      () =>
        submitLearningProjectForReview(
          learner.id,
          {
            ...baseSubmitInput(projectCategory.id),
            requiredComponents: [
              {
                name: 'Motor',
                categoryId: projectOnlyCategory.id,
              },
            ],
          },
          `submit-bad-category-${Date.now()}-abcdefgh`,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal((error as AppError).code, 'INVALID_COMPONENT_CATEGORY');
        return true;
      },
    );
  });
});
