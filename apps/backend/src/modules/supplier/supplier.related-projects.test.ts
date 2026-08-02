import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

import { app } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';

import {
  matchRelatedProjectsForMaterial,
} from './supplier-related-projects.js';
import { getSupplierMaterialRelatedProjects } from './supplier.service.js';

const TEST_MARKER = '[test-supplier-related-projects]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  projects: [] as string[],
};

let server: Server;
let baseUrl = '';

const createUser = async (input: {
  suffix: string;
  role: 'SUPPLIER' | 'LEARNER';
}) => {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      activeRole: input.role,
      roles: { create: [{ role: input.role, isPrimary: true }] },
      ...(input.role === 'SUPPLIER'
        ? {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} ${input.suffix}`,
                verificationStatus: 'VERIFIED',
              },
            },
          }
        : {
            learnerProfile: {
              create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
            },
          }),
    },
  });
  ids.users.push(user.id);
  return user;
};

const createCategory = async (input: {
  suffix: string;
  categoryType: 'MATERIAL' | 'PROJECT' | 'BOTH';
}) => {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} ${input.suffix}`,
      nameAr: `${TEST_MARKER} ${input.suffix} ar`,
      categoryType: input.categoryType,
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
};

const createLocation = async () => {
  const location = await prisma.location.create({
    data: {
      country: 'PS',
      city: 'Ramallah',
      area: `${TEST_MARKER}-area`,
      isApproximate: true,
      visibility: 'ORDER_ONLY',
      locationType: 'MATERIAL_PICKUP',
    },
  });
  ids.locations.push(location.id);
  return location;
};

const createMaterial = async (input: {
  ownerId: string;
  categoryId: string;
  locationId: string;
  title: string;
  materialType?: string;
  tags?: string[];
}) => {
  const profile = await prisma.supplierProfile.findUnique({
    where: { userId: input.ownerId },
    select: { id: true },
  });
  const material = await prisma.material.create({
    data: {
      ownerId: input.ownerId,
      supplierProfileId: profile?.id,
      categoryId: input.categoryId,
      locationId: input.locationId,
      title: input.title,
      description: `${TEST_MARKER} description`,
      materialType: input.materialType ?? 'Arduino board',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      pickupAllowed: true,
      tags: input.tags
        ? { create: input.tags.map((tag) => ({ tag })) }
        : undefined,
    },
  });
  ids.materials.push(material.id);
  return material;
};

const createProject = async (input: {
  authorId: string;
  projectCategoryId: string;
  status?: 'PUBLISHED' | 'DRAFT';
  hiddenAt?: Date | null;
  archivedAt?: Date | null;
  title: string;
  components: Array<{
    componentName: string;
    materialType: string;
    categoryId: string | null;
    componentRole?: 'REQUIRED_MATERIAL' | 'TOOL';
    searchKeywords?: string[];
  }>;
}) => {
  const project = await prisma.learningProject.create({
    data: {
      categoryId: input.projectCategoryId,
      createdBy: input.authorId,
      title: input.title,
      shortDescription: `${TEST_MARKER} short`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: input.status ?? 'PUBLISHED',
      hiddenAt: input.hiddenAt ?? null,
      archivedAt: input.archivedAt ?? null,
      coverImageUrl: null,
      requiredComponents: {
        create: input.components.map((component) => ({
          componentName: component.componentName,
          materialType: component.materialType,
          quantity: 1,
          unit: 'piece',
          componentRole: component.componentRole ?? 'REQUIRED_MATERIAL',
          categoryId: component.categoryId,
          searchKeywords: component.searchKeywords ?? [],
        })),
      },
    },
    include: { requiredComponents: true },
  });
  ids.projects.push(project.id);
  return project;
};

const requestRelatedProjects = async (
  materialId: string,
  token?: string,
  query = '',
) =>
  fetch(
    `${baseUrl}/api/supplier/materials/${materialId}/related-projects${query}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );

before(async () => {
  process.env.NODE_ENV = 'test';
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (ids.projects.length) {
    await prisma.learningProject.deleteMany({
      where: { id: { in: ids.projects } },
    });
  }
  if (ids.materials.length) {
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
  }
  if (ids.users.length) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  if (ids.locations.length) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  }
  if (ids.categories.length) {
    await prisma.category.deleteMany({
      where: { id: { in: ids.categories } },
    });
  }
});

describe('matchRelatedProjectsForMaterial pure matching', () => {
  test('exact name ranks above category-only and dedupes project components', () => {
    const material = {
      id: 'mat-1',
      title: 'Arduino Uno board',
      description: 'Board for learners',
      materialType: 'Arduino board',
      categoryId: 'cat-electronics',
      tags: [{ tag: 'arduino' }],
    };

    const result = matchRelatedProjectsForMaterial(
      material,
      [
        {
          id: 'comp-weak',
          categoryId: 'cat-electronics',
          componentName: 'LED strip',
          materialType: 'LED',
          searchKeywords: [],
          alternativeKeywords: null,
          project: {
            id: 'proj-shared',
            title: 'Shared project',
            coverImageUrl: null,
            difficulty: 'BEGINNER',
          },
        },
        {
          id: 'comp-strong',
          categoryId: 'cat-electronics',
          componentName: 'Arduino Uno board',
          materialType: 'Arduino board',
          searchKeywords: ['arduino'],
          alternativeKeywords: null,
          project: {
            id: 'proj-shared',
            title: 'Shared project',
            coverImageUrl: null,
            difficulty: 'BEGINNER',
          },
        },
        {
          id: 'comp-other',
          categoryId: 'cat-electronics',
          componentName: 'Resistor pack',
          materialType: 'Resistor',
          searchKeywords: [],
          alternativeKeywords: null,
          project: {
            id: 'proj-other',
            title: 'Other project',
            coverImageUrl: '/uploads/projects/a.jpg',
            difficulty: 'INTERMEDIATE',
          },
        },
      ],
      6,
    );

    assert.equal(result.relatedProjectCount, 2);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0]?.projectId, 'proj-shared');
    assert.equal(result.items[0]?.matchedComponentId, 'comp-strong');
    assert.equal(result.items[0]?.matchReasonCode, 'EXACT_NAME');
    assert.ok(
      (result.items[0]?.rankingScore ?? 0) >
        (result.items[1]?.rankingScore ?? 0),
    );
  });

  test('unrelated components are excluded', () => {
    const result = matchRelatedProjectsForMaterial(
      {
        id: 'mat-2',
        title: 'Cardboard box',
        description: 'Empty shipping box',
        materialType: 'Packaging',
        categoryId: 'cat-packaging',
        tags: [],
      },
      [
        {
          id: 'comp-1',
          categoryId: 'cat-electronics',
          componentName: 'Arduino Uno board',
          materialType: 'Arduino board',
          searchKeywords: ['arduino'],
          alternativeKeywords: null,
          project: {
            id: 'proj-1',
            title: 'Electronics project',
            coverImageUrl: null,
            difficulty: 'BEGINNER',
          },
        },
      ],
      6,
    );

    assert.equal(result.relatedProjectCount, 0);
    assert.deepEqual(result.items, []);
  });

  test('limit truncates items but preserves full count', () => {
    const components = Array.from({ length: 4 }, (_, index) => ({
      id: `comp-${index}`,
      categoryId: 'cat-electronics',
      componentName: `Arduino Uno board ${index}`,
      materialType: 'Arduino board',
      searchKeywords: ['arduino'] as string[],
      alternativeKeywords: null,
      project: {
        id: `proj-${index}`,
        title: `Project ${index}`,
        coverImageUrl: null as string | null,
        difficulty: 'BEGINNER' as const,
      },
    }));

    const result = matchRelatedProjectsForMaterial(
      {
        id: 'mat-3',
        title: 'Arduino Uno board',
        description: 'Board',
        materialType: 'Arduino board',
        categoryId: 'cat-electronics',
        tags: [],
      },
      components,
      2,
    );

    assert.equal(result.relatedProjectCount, 4);
    assert.equal(result.items.length, 2);
  });
});

describe('getSupplierMaterialRelatedProjects service + HTTP', () => {
  test('returns matching published projects for owned material', async () => {
    const supplier = await createUser({ suffix: 'owner', role: 'SUPPLIER' });
    const author = await createUser({ suffix: 'author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'mat-cat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'proj-cat',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const uniqueName = `${TEST_MARKER} UniqueBoardXYZ`;
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: uniqueName,
      materialType: uniqueName,
      tags: [`${TEST_MARKER}-tag`],
    });

    const published = await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Exact match project`,
      components: [
        {
          componentName: uniqueName,
          materialType: uniqueName,
          categoryId: materialCategory.id,
          searchKeywords: [`${TEST_MARKER}-keyword`],
        },
      ],
    });

    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Draft project`,
      status: 'DRAFT',
      components: [
        {
          componentName: uniqueName,
          materialType: uniqueName,
          categoryId: materialCategory.id,
        },
      ],
    });

    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Hidden project`,
      hiddenAt: new Date(),
      components: [
        {
          componentName: uniqueName,
          materialType: uniqueName,
          categoryId: materialCategory.id,
        },
      ],
    });

    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Tool-only project`,
      components: [
        {
          componentName: uniqueName,
          materialType: uniqueName,
          categoryId: materialCategory.id,
          componentRole: 'TOOL',
        },
      ],
    });

    const result = await getSupplierMaterialRelatedProjects(
      supplier.id,
      material.id,
      6,
    );

    assert.equal(result.materialId, material.id);
    assert.equal(result.relatedProjectCount, 1);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.projectId, published.id);
    assert.equal(result.items[0]?.matchReasonCode, 'EXACT_NAME');
    assert.equal(result.items[0]?.matchedComponentName, uniqueName);
    assert.equal(typeof result.items[0]?.rankingScore, 'number');
  });

  test('other supplier material returns not found', async () => {
    const owner = await createUser({ suffix: 'owner-b', role: 'SUPPLIER' });
    const other = await createUser({ suffix: 'other-b', role: 'SUPPLIER' });
    const materialCategory = await createCategory({
      suffix: 'mat-cat-b',
      categoryType: 'BOTH',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: owner.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: 'DC motor',
    });

    await assert.rejects(
      () => getSupplierMaterialRelatedProjects(other.id, material.id, 6),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 404 &&
        error.code === 'NOT_FOUND',
    );
  });

  test('HTTP auth and ownership gates', async () => {
    const supplier = await createUser({ suffix: 'http-owner', role: 'SUPPLIER' });
    const other = await createUser({ suffix: 'http-other', role: 'SUPPLIER' });
    const learner = await createUser({ suffix: 'http-learner', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'http-mat',
      categoryType: 'BOTH',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: 'Wood board',
      materialType: 'Wood',
    });

    const unauthenticated = await requestRelatedProjects(material.id);
    assert.equal(unauthenticated.status, 401);

    const learnerToken = signAccessToken({
      sub: learner.id,
      roles: ['LEARNER'],
    });
    const forbidden = await requestRelatedProjects(material.id, learnerToken);
    assert.equal(forbidden.status, 403);

    const otherToken = signAccessToken({
      sub: other.id,
      roles: ['SUPPLIER'],
    });
    const missing = await requestRelatedProjects(material.id, otherToken);
    assert.equal(missing.status, 404);

    const ownerToken = signAccessToken({
      sub: supplier.id,
      roles: ['SUPPLIER'],
    });
    const ok = await requestRelatedProjects(material.id, ownerToken, '?limit=3');
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as {
      data: { materialId: string; relatedProjectCount: number; items: unknown[] };
    };
    assert.equal(body.data.materialId, material.id);
    assert.equal(typeof body.data.relatedProjectCount, 'number');
    assert.ok(Array.isArray(body.data.items));
  });
});
