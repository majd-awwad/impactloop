import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

import { app } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';
import { compareMatchedProjectsForRanking, type RankedProjectMatch } from './materials.material-related-projects.js';

const TEST_MARKER = '[test-material-related-projects]';

const uniqueMaterialTitle = (label: string) =>
  `${TEST_MARKER} ${label} controller`;

const ids = {
  users: [] as string[],
  categories: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  projects: [] as string[],
  reservations: [] as string[],
  builds: [] as string[],
  projectLikes: [] as string[],
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

const tokenFor = (user: { id: string; activeRole: string | null }) =>
  signAccessToken({
    sub: user.id,
    roles: [user.activeRole ?? 'LEARNER'],
  });

const createCategory = async (input: {
  suffix: string;
  categoryType: 'MATERIAL' | 'PROJECT' | 'BOTH';
  isActive?: boolean;
}) => {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} ${input.suffix}`,
      nameAr: `${TEST_MARKER} ${input.suffix} ar`,
      categoryType: input.categoryType,
      isActive: input.isActive ?? true,
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
  status?: 'AVAILABLE' | 'RESERVED' | 'REUSED';
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
      status: input.status ?? 'AVAILABLE',
      isFree: true,
      pickupAllowed: true,
      tags: input.tags
        ? { create: input.tags.map((tag) => ({ tag })) }
        : undefined,
    },
    include: {
      owner: {
        select: {
          email: true,
          phone: true,
          displayName: true,
        },
      },
    },
  });
  ids.materials.push(material.id);
  return material;
};

const createProject = async (input: {
  authorId: string;
  projectCategoryId: string;
  status?: 'PUBLISHED' | 'DRAFT' | 'PENDING_REVIEW' | 'REJECTED';
  hiddenAt?: Date | null;
  archivedAt?: Date | null;
  title: string;
  components: Array<{
    componentName: string;
    materialType: string;
    categoryId: string | null;
    componentRole?: 'REQUIRED_MATERIAL' | 'TOOL' | 'OPTIONAL_MATERIAL';
    canBeSubstituted?: boolean;
    searchKeywords?: string[];
    alternativeKeywords?: string[];
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
      estimatedDurationMinutes: 90,
      status: input.status ?? 'PUBLISHED',
      hiddenAt: input.hiddenAt ?? null,
      archivedAt: input.archivedAt ?? null,
      coverImageUrl: '/uploads/projects/cover.jpg',
      requiredComponents: {
        create: input.components.map((component) => ({
          componentName: component.componentName,
          materialType: component.materialType,
          quantity: 1,
          unit: 'piece',
          componentRole: component.componentRole ?? 'REQUIRED_MATERIAL',
          categoryId: component.categoryId,
          canBeSubstituted: component.canBeSubstituted ?? false,
          searchKeywords: component.searchKeywords ?? [],
          alternativeKeywords: component.alternativeKeywords ?? [],
        })),
      },
    },
    include: { requiredComponents: true },
  });
  ids.projects.push(project.id);
  return project;
};

const createProjectLikes = async (projectId: string, count: number) => {
  for (let index = 0; index < count; index += 1) {
    const liker = await createUser({
      suffix: `like-${projectId.slice(-6)}-${index}`,
      role: 'LEARNER',
    });
    const like = await prisma.projectLike.create({
      data: {
        projectId,
        userId: liker.id,
      },
    });
    ids.projectLikes.push(like.id);
  }
};

const projectTitlesFromBody = (
  body: Awaited<ReturnType<typeof parseBody>>,
  titlePrefix: string,
) =>
  body.data.items
    .map((item) => (item.project as { title?: string }).title ?? '')
    .filter((title) => title.includes(titlePrefix));

const requestRelatedProjects = async (
  materialId: string,
  token?: string,
  query = '',
) =>
  fetch(`${baseUrl}/api/materials/${materialId}/related-projects${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

const parseBody = async (response: Response) => response.json() as Promise<{
  success: boolean;
  data: {
    materialId: string;
    items: Array<{
      project: {
        title?: string;
        [key: string]: unknown;
      };
      bestMatchedComponent?: {
        componentName?: string;
        [key: string]: unknown;
      };
      match?: {
        matchType?: string;
        compatibilityScore?: number;
        matchReasons?: string[];
        additionalMatchedComponentsCount?: number;
        [key: string]: unknown;
      };
      learnerContext?: {
        hasActiveBuild?: boolean;
        action?: string;
        buildId?: string | null;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}>;

const markedItems = (
  body: Awaited<ReturnType<typeof parseBody>>,
) =>
  body.data.items.filter((item) =>
    String((item.project as { title?: string } | undefined)?.title ?? '').includes(
      TEST_MARKER,
    ),
  );

const itemsMatchingMaterialTitle = (
  body: Awaited<ReturnType<typeof parseBody>>,
  materialTitle: string,
) =>
  body.data.items.filter((item) => {
    const componentName =
      (item.bestMatchedComponent as { componentName?: string } | undefined)
        ?.componentName ?? '';
    return (
      componentName === materialTitle ||
      componentName.startsWith(`${materialTitle} `)
    );
  });

const findProjectItem = (
  body: Awaited<ReturnType<typeof parseBody>>,
  projectTitle: string,
) =>
  body.data.items.find(
    (item) =>
      (item.project as { title?: string } | undefined)?.title === projectTitle,
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
  if (ids.builds.length) {
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  }
  if (ids.reservations.length) {
    await prisma.reservation.deleteMany({
      where: { id: { in: ids.reservations } },
    });
  }
  if (ids.projects.length) {
    await prisma.learningProject.deleteMany({
      where: { id: { in: ids.projects } },
    });
  }
  if (ids.projectLikes.length) {
    await prisma.projectLike.deleteMany({
      where: { id: { in: ids.projectLikes } },
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

describe('GET /api/materials/:id/related-projects', () => {
  test('public AVAILABLE material returns related published projects', async () => {
    const supplier = await createUser({ suffix: 'pub-supplier', role: 'SUPPLIER' });
    const author = await createUser({ suffix: 'pub-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'pub-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'pub-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: uniqueMaterialTitle('pub'),
    });
    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Robot Car`,
      components: [
        {
          componentName: uniqueMaterialTitle('pub'),
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
      ],
    });

    const response = await requestRelatedProjects(material.id);
    assert.equal(response.status, 200);
    const body = await parseBody(response);
    const items = markedItems(body);
    assert.equal(body.data.materialId, material.id);
    assert.equal(items.length, 1);
    const item = items[0];
    assert.ok(item);
    assert.equal(item.project.title, `${TEST_MARKER} Robot Car`);
    assert.equal(item.match?.matchType, 'EXACT');
    assert.equal(item.learnerContext, undefined);
  });

  test('exact component-name match ranks above weaker category-only match', async () => {
    const supplier = await createUser({ suffix: 'rank-supplier', role: 'SUPPLIER' });
    const author = await createUser({ suffix: 'rank-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'rank-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'rank-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: uniqueMaterialTitle('rank'),
    });
    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Weak category project`,
      components: [
        {
          componentName: 'LED strip',
          materialType: 'LED',
          categoryId: materialCategory.id,
        },
      ],
    });
    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Exact match project`,
      components: [
        {
          componentName: uniqueMaterialTitle('rank'),
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
      ],
    });

    const body = await parseBody(await requestRelatedProjects(material.id));
    const items = body.data.items.filter((item) => {
      const title = (item.project as { title?: string }).title ?? '';
      return (
        title === `${TEST_MARKER} Exact match project` ||
        title === `${TEST_MARKER} Weak category project`
      );
    });
    assert.equal(items.length, 2);
    const exactItem = items[0];
    const weakItem = items[1];
    assert.ok(exactItem && weakItem);
    assert.equal(exactItem.project.title, `${TEST_MARKER} Exact match project`);
    assert.equal(exactItem.match?.matchType, 'EXACT');
    assert.ok(
      (exactItem.match?.compatibilityScore ?? 0) >
        (weakItem.match?.compatibilityScore ?? 0),
    );
  });

  test('compatible keyword match is returned', async () => {
    const supplier = await createUser({ suffix: 'compat-supplier', role: 'SUPPLIER' });
    const author = await createUser({ suffix: 'compat-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'compat-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'compat-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: uniqueMaterialTitle('compat'),
      tags: ['microcontroller'],
    });
    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Smart Door Lock`,
      components: [
        {
          componentName: 'Microcontroller board',
          materialType: 'Microcontroller',
          categoryId: materialCategory.id,
          searchKeywords: [uniqueMaterialTitle('compat')],
        },
      ],
    });

    const body = await parseBody(await requestRelatedProjects(material.id));
    const item = findProjectItem(body, `${TEST_MARKER} Smart Door Lock`);
    assert.ok(item);
    assert.equal(item.match?.matchType, 'COMPATIBLE');
    assert.ok(item.match?.matchReasons?.includes('KEYWORD_MATCH'));
  });

  test('alternative match requires substitution and alternative keywords', async () => {
    const supplier = await createUser({
      suffix: 'alt-supplier',
      role: 'SUPPLIER',
    });
    const author = await createUser({ suffix: 'alt-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'alt-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'alt-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: uniqueMaterialTitle('alt'),
    });
    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Plant Monitoring System`,
      components: [
        {
          componentName: 'Microcontroller board',
          materialType: 'Microcontroller',
          categoryId: materialCategory.id,
          canBeSubstituted: true,
          alternativeKeywords: [uniqueMaterialTitle('alt')],
        },
      ],
    });

    const body = await parseBody(await requestRelatedProjects(material.id));
    const item = findProjectItem(body, `${TEST_MARKER} Plant Monitoring System`);
    assert.ok(item);
    assert.equal(item.match?.matchType, 'ALTERNATIVE');
  });

  test('weak unrelated components are excluded', async () => {
    const supplier = await createUser({
      suffix: 'weak-supplier',
      role: 'SUPPLIER',
    });
    const author = await createUser({ suffix: 'weak-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'weak-mat',
      categoryType: 'MATERIAL',
    });
    const electronicsCategory = await createCategory({
      suffix: 'weak-electronics',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'weak-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: 'Cardboard box',
      materialType: 'Packaging',
    });
    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Electronics project`,
      components: [
        {
          componentName: 'Arduino Uno board',
          materialType: 'Arduino board',
          categoryId: electronicsCategory.id,
        },
      ],
    });

    const items = markedItems(await parseBody(await requestRelatedProjects(material.id)));
    assert.equal(items.length, 0);
  });

  test('TOOL components are excluded', async () => {
    const supplier = await createUser({ suffix: 'tool-supplier', role: 'SUPPLIER' });
    const author = await createUser({ suffix: 'tool-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'tool-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'tool-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: 'Soldering iron',
      materialType: 'Tool',
    });
    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Tool-only project`,
      components: [
        {
          componentName: 'Soldering iron',
          materialType: 'Tool',
          categoryId: materialCategory.id,
          componentRole: 'TOOL',
        },
      ],
    });

    const items = markedItems(await parseBody(await requestRelatedProjects(material.id)));
    assert.equal(items.length, 0);
  });

  test('draft, pending, rejected, hidden, and archived projects are excluded', async () => {
    const supplier = await createUser({
      suffix: 'hidden-supplier',
      role: 'SUPPLIER',
    });
    const author = await createUser({ suffix: 'hidden-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'hidden-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'hidden-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: uniqueMaterialTitle('hidden'),
    });

    const statuses = [
      { title: `${TEST_MARKER} Draft project`, status: 'DRAFT' as const },
      { title: `${TEST_MARKER} Pending project`, status: 'PENDING_REVIEW' as const },
      { title: `${TEST_MARKER} Rejected project`, status: 'REJECTED' as const },
    ];
    for (const entry of statuses) {
      await createProject({
        authorId: author.id,
        projectCategoryId: projectCategory.id,
        title: entry.title,
        status: entry.status,
        components: [
          {
            componentName: uniqueMaterialTitle('hidden'),
            materialType: 'Arduino board',
            categoryId: materialCategory.id,
          },
        ],
      });
    }
    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Hidden project`,
      hiddenAt: new Date(),
      components: [
        {
          componentName: uniqueMaterialTitle('hidden'),
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
      ],
    });
    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Archived project`,
      archivedAt: new Date(),
      components: [
        {
          componentName: uniqueMaterialTitle('hidden'),
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
      ],
    });
    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Visible project`,
      components: [
        {
          componentName: uniqueMaterialTitle('hidden'),
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
      ],
    });

    const body = await parseBody(await requestRelatedProjects(material.id));
    const visible = findProjectItem(body, `${TEST_MARKER} Visible project`);
    assert.ok(visible);
    assert.equal(
      itemsMatchingMaterialTitle(body, uniqueMaterialTitle('hidden')).length,
      1,
    );
  });

  test('one project with multiple matching components is returned once with count', async () => {
    const supplier = await createUser({
      suffix: 'dedupe-supplier',
      role: 'SUPPLIER',
    });
    const author = await createUser({ suffix: 'dedupe-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'dedupe-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'dedupe-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: uniqueMaterialTitle('dedupe'),
    });
    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Multi component project`,
      components: [
        {
          componentName: uniqueMaterialTitle('dedupe'),
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
        {
          componentName: `${uniqueMaterialTitle('dedupe')} spare`,
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
      ],
    });

    const body = await parseBody(await requestRelatedProjects(material.id));
    const items = itemsMatchingMaterialTitle(body, uniqueMaterialTitle('dedupe'));
    assert.equal(items.length, 1);
    const dedupeItem = items[0];
    assert.ok(dedupeItem);
    assert.equal(dedupeItem.match?.additionalMatchedComponentsCount, 1);
  });

  test('pagination and maximum limits are enforced', async () => {
    const supplier = await createUser({
      suffix: 'page-supplier',
      role: 'SUPPLIER',
    });
    const author = await createUser({ suffix: 'page-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'page-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'page-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const uniqueToken = `PagedMatch-${Date.now()}`;
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} ${uniqueToken} board`,
    });

    for (let index = 0; index < 4; index += 1) {
      await createProject({
        authorId: author.id,
        projectCategoryId: projectCategory.id,
        title: `${TEST_MARKER} Paged project ${index}`,
        components: [
          {
            componentName: `${TEST_MARKER} ${uniqueToken} board ${index}`,
            materialType: 'Arduino board',
            categoryId: materialCategory.id,
          },
        ],
      });
    }

    const page1 = await parseBody(
      await requestRelatedProjects(material.id, undefined, '?page=1&limit=2'),
    );
    const page1Items = page1.data.items.filter((item) =>
      String((item.project as { title?: string }).title ?? '').includes(
        `${TEST_MARKER} Paged project`,
      ),
    );
    assert.equal(page1Items.length, 2);
    assert.equal(page1.data.pagination.limit, 2);

    const allPaged = await parseBody(
      await requestRelatedProjects(material.id, undefined, '?limit=12'),
    );
    assert.equal(
      allPaged.data.items.filter((item) =>
        String((item.project as { title?: string }).title ?? '').includes(
          `${TEST_MARKER} Paged project`,
        ),
      ).length,
      4,
    );

    const page3 = await parseBody(
      await requestRelatedProjects(material.id, undefined, '?page=3&limit=2'),
    );
    assert.equal(
      page3.data.items.filter((item) =>
        String((item.project as { title?: string }).title ?? '').includes(
          `${TEST_MARKER} Paged project`,
        ),
      ).length,
      0,
    );
    assert.equal(page3.data.pagination.page, 3);

    const overLimit = await requestRelatedProjects(
      material.id,
      undefined,
      '?limit=99',
    );
    assert.equal(overLimit.status, 400);
  });

  test('acquired learner can access non-public material and guest cannot', async () => {
    const supplier = await createUser({
      suffix: 'acq-supplier',
      role: 'SUPPLIER',
    });
    const learner = await createUser({ suffix: 'acq-learner', role: 'LEARNER' });
    const otherLearner = await createUser({
      suffix: 'acq-other',
      role: 'LEARNER',
    });
    const author = await createUser({ suffix: 'acq-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'acq-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'acq-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: uniqueMaterialTitle('acq'),
      status: 'REUSED',
    });
    await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Acquired access project`,
      components: [
        {
          componentName: uniqueMaterialTitle('acq'),
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
      ],
    });
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

    assert.equal((await requestRelatedProjects(material.id)).status, 404);
    assert.equal(
      (await requestRelatedProjects(material.id, tokenFor(otherLearner))).status,
      404,
    );

    const acquiredBody = await parseBody(
      await requestRelatedProjects(material.id, tokenFor(learner)),
    );
    const acquired = findProjectItem(
      acquiredBody,
      `${TEST_MARKER} Acquired access project`,
    );
    assert.ok(acquired);
  });

  test('acquired access still works after build allocation is removed', async () => {
    const supplier = await createUser({
      suffix: 'removed-supplier',
      role: 'SUPPLIER',
    });
    const learner = await createUser({
      suffix: 'removed-learner',
      role: 'LEARNER',
    });
    const author = await createUser({ suffix: 'removed-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'removed-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'removed-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: uniqueMaterialTitle('removed'),
      status: 'REUSED',
    });
    const learningProject = await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Removed allocation project`,
      components: [
        {
          componentName: uniqueMaterialTitle('removed'),
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
      ],
    });
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
    const build = await prisma.projectBuild.create({
      data: {
        projectId: learningProject.id,
        learnerId: learner.id,
        status: 'IN_PROGRESS',
        items: {
          create: {
            requiredComponentId: learningProject.requiredComponents[0]!.id,
            status: 'MISSING',
            linkedMaterialId: null,
            linkedReservationId: null,
          },
        },
      },
    });
    ids.builds.push(build.id);

    const removedBody = await parseBody(
      await requestRelatedProjects(material.id, tokenFor(learner)),
    );
    assert.ok(
      findProjectItem(removedBody, `${TEST_MARKER} Removed allocation project`),
    );
  });

  test('response excludes supplier private fields and exposes learner build context only for viewer', async () => {
    const supplier = await createUser({
      suffix: 'privacy-supplier',
      role: 'SUPPLIER',
    });
    const learner = await createUser({
      suffix: 'privacy-learner',
      role: 'LEARNER',
    });
    const author = await createUser({ suffix: 'privacy-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'privacy-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'privacy-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: uniqueMaterialTitle('privacy'),
    });
    const learningProject = await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Learner context project`,
      components: [
        {
          componentName: uniqueMaterialTitle('privacy'),
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
      ],
    });
    const build = await prisma.projectBuild.create({
      data: {
        projectId: learningProject.id,
        learnerId: learner.id,
        status: 'IN_PROGRESS',
      },
    });
    ids.builds.push(build.id);

    const guestItems = markedItems(await parseBody(await requestRelatedProjects(material.id)));
    assert.equal(guestItems[0]?.learnerContext, undefined);
    const serialized = JSON.stringify(guestItems);
    assert.equal(serialized.includes('supplier@'), false);
    assert.equal(serialized.includes('phone'), false);

    const learnerItems = markedItems(
      await parseBody(
        await requestRelatedProjects(material.id, tokenFor(learner)),
      ),
    );
    assert.equal(learnerItems[0]?.learnerContext?.hasActiveBuild, true);
    assert.equal(learnerItems[0]?.learnerContext?.action, 'CONTINUE_BUILD');
    assert.equal(learnerItems[0]?.learnerContext?.buildId, build.id);
  });

  test('empty related projects returns 200 with empty list', async () => {
    const supplier = await createUser({
      suffix: 'empty-supplier',
      role: 'SUPPLIER',
    });
    const materialCategory = await createCategory({
      suffix: 'empty-mat',
      categoryType: 'BOTH',
    });
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Unrelated widget`,
      materialType: 'Widget',
    });

    const response = await requestRelatedProjects(material.id);
    assert.equal(response.status, 200);
    const body = await parseBody(response);
    assert.equal(markedItems(body).length, 0);
  });

  test('likes tie-breaker is applied before pagination', async () => {
    const supplier = await createUser({
      suffix: 'likes-supplier',
      role: 'SUPPLIER',
    });
    const author = await createUser({ suffix: 'likes-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'likes-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'likes-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const matchName = uniqueMaterialTitle('likes-rank');
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: matchName,
    });

    const lowLikes = await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Likes rank low`,
      components: [
        {
          componentName: matchName,
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
      ],
    });
    const midLikes = await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Likes rank mid`,
      components: [
        {
          componentName: matchName,
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
      ],
    });
    const highLikes = await createProject({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      title: `${TEST_MARKER} Likes rank high`,
      components: [
        {
          componentName: matchName,
          materialType: 'Arduino board',
          categoryId: materialCategory.id,
        },
      ],
    });

    await createProjectLikes(lowLikes.id, 1);
    await createProjectLikes(midLikes.id, 3);
    await createProjectLikes(highLikes.id, 5);

    const page1 = await parseBody(
      await requestRelatedProjects(material.id, undefined, '?page=1&limit=2'),
    );
    const page2 = await parseBody(
      await requestRelatedProjects(material.id, undefined, '?page=2&limit=2'),
    );

    const page1Titles = projectTitlesFromBody(page1, `${TEST_MARKER} Likes rank`);
    const page2Titles = projectTitlesFromBody(page2, `${TEST_MARKER} Likes rank`);

    assert.deepEqual(page1Titles, [
      `${TEST_MARKER} Likes rank high`,
      `${TEST_MARKER} Likes rank mid`,
    ]);
    assert.deepEqual(page2Titles, [`${TEST_MARKER} Likes rank low`]);
    assert.equal(
      page1Titles.length + page2Titles.length,
      3,
    );
    assert.equal(page1.data.pagination.page, 1);
    assert.equal(page2.data.pagination.page, 2);
  });

  test('repeated requests and pagination preserve deterministic ranked order', async () => {
    const supplier = await createUser({
      suffix: 'stable-supplier',
      role: 'SUPPLIER',
    });
    const author = await createUser({ suffix: 'stable-author', role: 'LEARNER' });
    const materialCategory = await createCategory({
      suffix: 'stable-mat',
      categoryType: 'BOTH',
    });
    const projectCategory = await createCategory({
      suffix: 'stable-proj',
      categoryType: 'PROJECT',
    });
    const location = await createLocation();
    const matchName = uniqueMaterialTitle('stable-rank');
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: matchName,
    });

    for (let index = 0; index < 4; index += 1) {
      const project = await createProject({
        authorId: author.id,
        projectCategoryId: projectCategory.id,
        title: `${TEST_MARKER} Stable rank ${index}`,
        components: [
          {
            componentName: matchName,
            materialType: 'Arduino board',
            categoryId: materialCategory.id,
          },
        ],
      });
      await createProjectLikes(project.id, 4 - index);
    }

    const first = await parseBody(
      await requestRelatedProjects(material.id, undefined, '?limit=12'),
    );
    const second = await parseBody(
      await requestRelatedProjects(material.id, undefined, '?limit=12'),
    );
    const stableTitles = projectTitlesFromBody(first, `${TEST_MARKER} Stable rank`);
    assert.deepEqual(
      projectTitlesFromBody(second, `${TEST_MARKER} Stable rank`),
      stableTitles,
    );

    const limit2 = await parseBody(
      await requestRelatedProjects(material.id, undefined, '?page=1&limit=2'),
    );
    const limit3 = await parseBody(
      await requestRelatedProjects(material.id, undefined, '?page=1&limit=3'),
    );
    const limit2Titles = projectTitlesFromBody(limit2, `${TEST_MARKER} Stable rank`);
    const limit3Titles = projectTitlesFromBody(limit3, `${TEST_MARKER} Stable rank`);

    assert.deepEqual(limit2Titles, stableTitles.slice(0, 2));
    assert.deepEqual(limit3Titles.slice(0, 2), limit2Titles);

    const page1 = await parseBody(
      await requestRelatedProjects(material.id, undefined, '?page=1&limit=2'),
    );
    const page2 = await parseBody(
      await requestRelatedProjects(material.id, undefined, '?page=2&limit=2'),
    );
    const page1StableIds = page1.data.items
      .filter((item) =>
        String((item.project as { title?: string }).title ?? '').includes(
          `${TEST_MARKER} Stable rank`,
        ),
      )
      .map((item) => item.project.id);
    const page2StableIds = page2.data.items
      .filter((item) =>
        String((item.project as { title?: string }).title ?? '').includes(
          `${TEST_MARKER} Stable rank`,
        ),
      )
      .map((item) => item.project.id);
    assert.equal(
      page1StableIds.some((projectId) => page2StableIds.includes(projectId)),
      false,
    );
  });
});

describe('material related projects ranking', () => {
  const baseProject = {
    shortDescription: null,
    coverImageUrl: null,
    difficulty: 'BEGINNER' as const,
    estimatedDurationMinutes: 90,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    category: { id: 'cat-1', nameEn: 'Cat', nameAr: 'Cat ar' },
    requiredMaterialComponentCount: 1,
  };

  const baseMatch = {
    componentId: 'comp-1',
    componentName: 'Board',
    componentRole: 'REQUIRED_MATERIAL' as const,
    requiredQuantity: 1,
    unit: 'piece',
    canBeSubstituted: false,
    isRequired: true,
    componentPosition: 0,
    compatibilityScore: 500,
    matchReasonCodes: ['EXACT_NAME'] as const,
    matchReasonCode: 'EXACT_NAME' as const,
  };

  test('EXACT outranks COMPATIBLE when compatibility scores tie', () => {
    const exact = {
      project: { ...baseProject, id: 'proj-exact', title: 'Exact' },
      bestMatch: {
        ...baseMatch,
        projectId: 'proj-exact',
        matchType: 'EXACT' as const,
      },
      additionalMatchedComponentsCount: 0,
    };
    const compatible = {
      project: { ...baseProject, id: 'proj-compatible', title: 'Compatible' },
      bestMatch: {
        ...baseMatch,
        projectId: 'proj-compatible',
        matchType: 'COMPATIBLE' as const,
        matchReasonCodes: ['CATEGORY_MATCH'] as const,
        matchReasonCode: 'CATEGORY_MATCH' as const,
      },
      additionalMatchedComponentsCount: 0,
    };

    assert.ok(
      compareMatchedProjectsForRanking(
        exact as unknown as RankedProjectMatch,
        compatible as unknown as RankedProjectMatch,
        new Map(),
      ) < 0,
    );
  });

  test('stable project ID tie-breaking is deterministic', () => {
    const left = {
      project: { ...baseProject, id: 'aaa-project', title: 'A' },
      bestMatch: {
        ...baseMatch,
        projectId: 'aaa-project',
        matchType: 'COMPATIBLE' as const,
        matchReasonCodes: ['CATEGORY_MATCH'] as const,
        matchReasonCode: 'CATEGORY_MATCH' as const,
      },
      additionalMatchedComponentsCount: 0,
    };
    const right = {
      project: { ...baseProject, id: 'zzz-project', title: 'Z' },
      bestMatch: {
        ...baseMatch,
        projectId: 'zzz-project',
        matchType: 'COMPATIBLE' as const,
        matchReasonCodes: ['CATEGORY_MATCH'] as const,
        matchReasonCode: 'CATEGORY_MATCH' as const,
      },
      additionalMatchedComponentsCount: 0,
    };

    assert.ok(compareMatchedProjectsForRanking(left as unknown as RankedProjectMatch, right as unknown as RankedProjectMatch, new Map()) < 0);
    assert.ok(compareMatchedProjectsForRanking(left as unknown as RankedProjectMatch, right as unknown as RankedProjectMatch, new Map()) < 0);
  });

  test('compatibility score outranks popularity', () => {
    const popularWeak = {
      project: { ...baseProject, id: 'proj-weak', title: 'Weak' },
      bestMatch: {
        ...baseMatch,
        projectId: 'proj-weak',
        compatibilityScore: 150,
        matchType: 'COMPATIBLE' as const,
        matchReasonCodes: ['CATEGORY_MATCH'] as const,
        matchReasonCode: 'CATEGORY_MATCH' as const,
      },
      additionalMatchedComponentsCount: 0,
    };
    const exactStrong = {
      project: { ...baseProject, id: 'proj-exact', title: 'Exact' },
      bestMatch: {
        ...baseMatch,
        projectId: 'proj-exact',
        compatibilityScore: 400,
        matchType: 'EXACT' as const,
      },
      additionalMatchedComponentsCount: 0,
    };
    const likes = new Map([
      ['proj-weak', 100],
      ['proj-exact', 0],
    ]);

    assert.ok(
      compareMatchedProjectsForRanking(
        exactStrong as unknown as RankedProjectMatch,
        popularWeak as unknown as RankedProjectMatch,
        likes,
      ) < 0,
    );
  });

  test('likes break ties when compatibility scores are equal', () => {
    const moreLiked = {
      project: { ...baseProject, id: 'proj-liked', title: 'Liked' },
      bestMatch: {
        ...baseMatch,
        projectId: 'proj-liked',
        matchType: 'EXACT' as const,
      },
      additionalMatchedComponentsCount: 0,
    };
    const lessLiked = {
      project: { ...baseProject, id: 'proj-unliked', title: 'Unliked' },
      bestMatch: {
        ...baseMatch,
        projectId: 'proj-unliked',
        matchType: 'EXACT' as const,
      },
      additionalMatchedComponentsCount: 0,
    };
    const likes = new Map([
      ['proj-liked', 8],
      ['proj-unliked', 1],
    ]);

    assert.ok(
      compareMatchedProjectsForRanking(
        moreLiked as unknown as RankedProjectMatch,
        lessLiked as unknown as RankedProjectMatch,
        likes,
      ) < 0,
    );
  });
});
