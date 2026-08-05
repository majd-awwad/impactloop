import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import {
  createDefaultNotebookDocument,
  createDefaultNotebookPage,
  getProjectBuildNotebook,
  upsertProjectBuildNotebook,
} from './project-build-notebook.js';
import {
  NOTEBOOK_MAX_PAGES,
  NOTEBOOK_MAX_PAGE_TEXT_LENGTH,
  NOTEBOOK_MAX_PAGE_TITLE_LENGTH,
  NOTEBOOK_MAX_POINTS_PER_STROKE,
  NOTEBOOK_MAX_STROKES_PER_PAGE,
  notebookDocumentSchema,
} from './learner-build-notebook.validation.js';
import { startProjectBuildAgainById, startProjectBuildById } from '../learning-projects/learning-projects.service.js';
import { archiveProjectBuild } from '../learning-projects/project-build-lifecycle.js';
import { getMyProjectBuildById } from '../learning-projects/learning-projects.service.js';

const TEST_MARKER = '[test-learner-build-notebook]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
};

let ownerId = '';
let otherLearnerId = '';
let buildId = '';
let projectId = '';

async function createArchivedBuildForTests() {
  await prisma.projectBuild.update({
    where: { id: buildId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  const archivedBuild = await startProjectBuildAgainById(projectId, ownerId);
  ids.builds.push(archivedBuild.id);
  await archiveProjectBuild(archivedBuild.id, ownerId);
  const activeBuild = await startProjectBuildAgainById(projectId, ownerId);
  buildId = activeBuild.id;
  ids.builds.push(buildId);
  return archivedBuild.id;
}

async function createLearner(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner ${suffix}`,
      email: `${TEST_MARKER}-learner-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
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

async function createProject(authorId: string) {
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

  const project = await prisma.learningProject.create({
    data: {
      categoryId: projectCategory.id,
      createdBy: authorId,
      title: `${TEST_MARKER} Notebook project`,
      shortDescription: 'short',
      description: 'description',
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
            categoryId: materialCategory.id,
          },
        ],
      },
      steps: {
        create: [
          {
            stepNumber: 1,
            title: 'Step 1',
            description: 'Do step 1',
            reviewStatus: 'ACCEPTED',
          },
        ],
      },
    },
    include: { steps: true },
  });
  ids.projects.push(project.id);
  return project;
}

function sampleNotebookContent() {
  const page = createDefaultNotebookPage('Wiring diagram');
  page.text = 'Connected the sensor.';
  page.strokes = [
    {
      id: 'stroke-1',
      color: '#1F2937',
      width: 2,
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.3, y: 0.4 },
      ],
    },
  ];
  return {
    schemaVersion: 1 as const,
    pages: [page],
  };
}

before(async () => {
  process.env.NODE_ENV = 'test';

  const owner = await createLearner('owner');
  ownerId = owner.id;
  const other = await createLearner('other');
  otherLearnerId = other.id;

  const project = await createProject(ownerId);
  projectId = project.id;

  const build = await startProjectBuildById(projectId, ownerId);
  buildId = build.id;
  ids.builds.push(buildId);
});

after(async () => {
  if (ids.builds.length) {
    await prisma.projectBuildNotebook.deleteMany({
      where: { buildId: { in: ids.builds } },
    });
    await prisma.projectBuildStepProgress.deleteMany({
      where: { buildId: { in: ids.builds } },
    });
    await prisma.projectBuildItem.deleteMany({
      where: { buildId: { in: ids.builds } },
    });
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  }
  if (ids.projects.length) {
    for (const projectIdValue of ids.projects) {
      const steps = await prisma.projectStep.findMany({
        where: { projectId: projectIdValue },
        select: { id: true },
      });
      if (steps.length) {
        await prisma.projectLearningQuestion.deleteMany({
          where: { projectStepId: { in: steps.map((step) => step.id) } },
        });
        await prisma.projectStep.deleteMany({
          where: { id: { in: steps.map((step) => step.id) } },
        });
      }
      await prisma.projectRequiredComponent.deleteMany({
        where: { projectId: projectIdValue },
      });
    }
    await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
  }
  if (ids.materialCategories.length) {
    await prisma.category.deleteMany({
      where: { id: { in: ids.materialCategories } },
    });
  }
  if (ids.categories.length) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }
  if (ids.users.length) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('learner build notebook service', () => {
  test('owner can read a default notebook', async () => {
    const notebook = await getProjectBuildNotebook(buildId, ownerId);
    assert.equal(notebook.persisted, false);
    assert.equal(notebook.content.schemaVersion, 1);
    assert.equal(notebook.content.pages.length, 1);
    assert.equal(notebook.createdAt, null);
    assert.equal(notebook.updatedAt, null);
  });

  test('default read does not create a database row', async () => {
    const count = await prisma.projectBuildNotebook.count({
      where: { buildId },
    });
    assert.equal(count, 0);
  });

  test('owner can save a notebook', async () => {
    const content = sampleNotebookContent();
    const saved = await upsertProjectBuildNotebook(buildId, ownerId, content);
    assert.equal(saved.persisted, true);
    assert.equal(saved.content.pages[0]!.text, 'Connected the sensor.');
  });

  test('a later GET returns saved content', async () => {
    const notebook = await getProjectBuildNotebook(buildId, ownerId);
    assert.equal(notebook.persisted, true);
    assert.equal(notebook.content.pages[0]!.text, 'Connected the sensor.');
  });

  test('another learner cannot read it', async () => {
    await assert.rejects(
      () => getProjectBuildNotebook(buildId, otherLearnerId),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
    );
  });

  test('another learner cannot update it', async () => {
    await assert.rejects(
      () =>
        upsertProjectBuildNotebook(
          buildId,
          otherLearnerId,
          createDefaultNotebookDocument(),
        ),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
    );
  });

  test('malformed pages are rejected', () => {
    const parsed = notebookDocumentSchema.safeParse({
      schemaVersion: 2,
      pages: [],
    });
    assert.equal(parsed.success, false);
  });

  test('too many pages are rejected', () => {
    const pages = Array.from({ length: NOTEBOOK_MAX_PAGES + 1 }, (_, index) =>
      createDefaultNotebookPage(`Page ${index + 1}`),
    );
    const parsed = notebookDocumentSchema.safeParse({
      schemaVersion: 1,
      pages,
    });
    assert.equal(parsed.success, false);
  });

  test('oversized title/text/strokes/points are rejected', () => {
    const titlePage = createDefaultNotebookPage(
      'x'.repeat(NOTEBOOK_MAX_PAGE_TITLE_LENGTH + 1),
    );
    assert.equal(
      notebookDocumentSchema.safeParse({
        schemaVersion: 1,
        pages: [titlePage],
      }).success,
      false,
    );

    const textPage = createDefaultNotebookPage('Valid');
    textPage.text = 'x'.repeat(NOTEBOOK_MAX_PAGE_TEXT_LENGTH + 1);
    assert.equal(
      notebookDocumentSchema.safeParse({
        schemaVersion: 1,
        pages: [textPage],
      }).success,
      false,
    );

    const strokePage = createDefaultNotebookPage('Valid');
    strokePage.strokes = Array.from(
      { length: NOTEBOOK_MAX_STROKES_PER_PAGE + 1 },
      (_, index) => ({
        id: `stroke-${index}`,
        color: '#1F2937' as const,
        width: 2,
        points: [{ x: 0.1, y: 0.2 }],
      }),
    );
    assert.equal(
      notebookDocumentSchema.safeParse({
        schemaVersion: 1,
        pages: [strokePage],
      }).success,
      false,
    );

    const pointsPage = createDefaultNotebookPage('Valid');
    pointsPage.strokes = [
      {
        id: 'too-many-points',
        color: '#1F2937',
        width: 2,
        points: Array.from({ length: NOTEBOOK_MAX_POINTS_PER_STROKE + 1 }, (_, index) => ({
          x: 0.1,
          y: index / (NOTEBOOK_MAX_POINTS_PER_STROKE + 2),
        })),
      },
    ];
    assert.equal(
      notebookDocumentSchema.safeParse({
        schemaVersion: 1,
        pages: [pointsPage],
      }).success,
      false,
    );
  });

  test('invalid normalized coordinates are rejected', () => {
    const page = createDefaultNotebookPage('Valid');
    page.strokes = [
      {
        id: 'bad-point',
        color: '#1F2937',
        width: 2,
        points: [{ x: 1.2, y: 0.5 }],
      },
    ];
    assert.equal(
      notebookDocumentSchema.safeParse({
        schemaVersion: 1,
        pages: [page],
      }).success,
      false,
    );
  });

  test('duplicate page IDs are rejected', () => {
    const page = createDefaultNotebookPage('One');
    assert.equal(
      notebookDocumentSchema.safeParse({
        schemaVersion: 1,
        pages: [page, { ...page }],
      }).success,
      false,
    );
  });

  test('duplicate stroke IDs are rejected', () => {
    const page = createDefaultNotebookPage('One');
    const stroke = {
      id: 'dup-stroke',
      color: '#1F2937' as const,
      width: 2,
      points: [{ x: 0.1, y: 0.2 }],
    };
    page.strokes = [stroke, stroke];
    assert.equal(
      notebookDocumentSchema.safeParse({
        schemaVersion: 1,
        pages: [page],
      }).success,
      false,
    );
  });

  test('PUT performs an upsert without duplicate notebooks', async () => {
    const content = sampleNotebookContent();
    content.pages[0]!.text = 'Updated once';
    await upsertProjectBuildNotebook(buildId, ownerId, content);
    content.pages[0]!.text = 'Updated twice';
    await upsertProjectBuildNotebook(buildId, ownerId, content);
    const count = await prisma.projectBuildNotebook.count({
      where: { buildId },
    });
    assert.equal(count, 1);
  });

  test('COMPLETED build remains editable', async () => {
    await prisma.projectBuild.update({
      where: { id: buildId },
      data: { status: 'COMPLETED' },
    });
    const content = sampleNotebookContent();
    content.pages[0]!.text = 'Completed edit';
    const saved = await upsertProjectBuildNotebook(buildId, ownerId, content);
    assert.equal(saved.content.pages[0]!.text, 'Completed edit');
    await prisma.projectBuild.update({
      where: { id: buildId },
      data: { status: 'IN_PROGRESS' },
    });
  });

  test('ARCHIVED build remains readable', async () => {
    const archivedBuildId = await createArchivedBuildForTests();
    const notebook = await getProjectBuildNotebook(archivedBuildId, ownerId);
    assert.equal(notebook.readOnly, true);
  });

  test('ARCHIVED build update is rejected', async () => {
    const archivedBuildId = await createArchivedBuildForTests();
    await assert.rejects(
      () =>
        upsertProjectBuildNotebook(
          archivedBuildId,
          ownerId,
          createDefaultNotebookDocument(),
        ),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 409 &&
        error.code === 'NOTEBOOK_READ_ONLY',
    );
  });

  test('notebook is not exposed by public Project endpoints', async () => {
    const build = await getMyProjectBuildById(projectId, ownerId);
    assert.equal('notebook' in (build ?? {}), false);
  });
});
