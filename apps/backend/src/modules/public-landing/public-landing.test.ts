import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import type { Express } from 'express';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { getPublicLanding } from './public-landing.service.js';

const TEST_MARKER = `[test-public-landing-${Date.now()}]`;

const ids = {
  users: [] as string[],
  categories: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  projects: [] as string[],
};

let app: Express;
const supplierEmail = `${TEST_MARKER}-supplier@impactloop.test`;
const supplierPhone = '0590000444';

const forbiddenKeys = [
  'email',
  'phone',
  'password',
  'passwordHash',
  'refreshToken',
  'accessToken',
  'token',
  'addressLine',
  'latitude',
  'longitude',
  'approximateLatitude',
  'approximateLongitude',
  'moderationReason',
  'verificationAdminNote',
];

const assertNoPrivateFields = (value: unknown, path = 'payload') => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoPrivateFields(entry, `${path}[${index}]`),
    );
    return;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      assert.equal(
        forbiddenKeys.includes(key),
        false,
        `forbidden key exposed at ${path}.${key}`,
      );
      assertNoPrivateFields(record[key], `${path}.${key}`);
    }
  }
};

const request = async (path: string) => {
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
    const body = (await response.json()) as {
      success?: boolean;
      data?: Record<string, unknown>;
    };
    return { status: response.status, body };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

async function createSupplier() {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Supplier`,
      email: supplierEmail,
      phone: supplierPhone,
      passwordHash: await hashPassword('TestPassword123!'),
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      profileImageUrl: '/demo-assets/visual-assets/people/profiles/test-supplier-avatar.png',
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
      supplierProfile: {
        create: {
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: `${TEST_MARKER} Public Shop`,
          verificationStatus: 'APPROVED',
        },
      },
    },
    include: { supplierProfile: true },
  });
  ids.users.push(user.id);
  return user;
}

async function createLearner() {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner`,
      email: `${TEST_MARKER}-learner@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      profileImageUrl: '/demo-assets/visual-assets/people/profiles/test-learner-avatar.png',
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createCategories() {
  const materialCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} materials`,
      nameAr: `${TEST_MARKER} مواد`,
      categoryType: 'MATERIAL',
      isActive: true,
    },
  });
  const projectCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} projects`,
      nameAr: `${TEST_MARKER} مشاريع`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(materialCategory.id, projectCategory.id);
  return { materialCategory, projectCategory };
}

async function createLocation() {
  const location = await prisma.location.create({
    data: {
      country: 'PS',
      city: 'Nablus',
      area: 'Rafidia',
      addressLine: `${TEST_MARKER} secret street 9`,
      latitude: 32.221111,
      longitude: 35.254444,
      visibility: 'ORDER_ONLY',
      isApproximate: true,
      locationType: 'MATERIAL_PICKUP',
    },
  });
  ids.locations.push(location.id);
  return location;
}

async function createMaterial(input: {
  ownerId: string;
  supplierProfileId: string;
  categoryId: string;
  locationId: string;
  title: string;
  status: 'AVAILABLE' | 'PENDING_RESERVATION' | 'REUSED' | 'UNAVAILABLE';
  createdAt?: Date;
}) {
  const material = await prisma.material.create({
    data: {
      ownerId: input.ownerId,
      supplierProfileId: input.supplierProfileId,
      categoryId: input.categoryId,
      locationId: input.locationId,
      title: input.title,
      description: `${TEST_MARKER} description`,
      materialType: 'Wood',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: input.status,
      quantity: 4,
      unit: 'piece',
      isFree: input.status === 'AVAILABLE',
      price: input.status === 'AVAILABLE' ? null : 12,
      currency: 'NIS',
      pickupAllowed: true,
      deliveryAllowed: false,
      createdAt: input.createdAt,
    },
  });
  ids.materials.push(material.id);
  return material;
}

async function createProject(input: {
  creatorId: string;
  categoryId: string;
  title: string;
  status: 'PUBLISHED' | 'DRAFT' | 'PENDING_REVIEW';
  createdAt?: Date;
}) {
  const project = await prisma.learningProject.create({
    data: {
      createdBy: input.creatorId,
      categoryId: input.categoryId,
      title: input.title,
      shortDescription: `${TEST_MARKER} summary`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: input.status,
      createdAt: input.createdAt,
    },
  });
  ids.projects.push(project.id);
  return project;
}

describe('public landing', () => {
  let availableMaterialTitle: string;
  let publishedProjectTitle: string;
  let reusedMaterialTitle: string;
  let draftProjectTitle: string;
  let pendingMaterialTitle: string;

  before(async () => {
    process.env.NODE_ENV = 'test';
    const { createApp } = await import('../../app.js');
    app = createApp({ recommendationEventOrigin: 'TEST' });

    const supplier = await createSupplier();
    const learner = await createLearner();
    const placeholderAvatarUser = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} Placeholder`,
        email: `${TEST_MARKER}-placeholder@impactloop.test`,
        passwordHash: await hashPassword('TestPassword123!'),
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        profileImageUrl:
          'https://api.dicebear.com/9.x/initials/png?seed=placeholder',
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      },
    });
    ids.users.push(placeholderAvatarUser.id);
    const { materialCategory, projectCategory } = await createCategories();
    const location = await createLocation();
    const now = Date.now();

    availableMaterialTitle = `${TEST_MARKER} available plywood`;
    pendingMaterialTitle = `${TEST_MARKER} pending reservation`;
    reusedMaterialTitle = `${TEST_MARKER} reused offcut`;
    publishedProjectTitle = `${TEST_MARKER} published shelf`;
    draftProjectTitle = `${TEST_MARKER} private draft`;

    await createMaterial({
      ownerId: supplier.id,
      supplierProfileId: supplier.supplierProfile!.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: availableMaterialTitle,
      status: 'AVAILABLE',
      createdAt: new Date(now),
    });
    await createMaterial({
      ownerId: supplier.id,
      supplierProfileId: supplier.supplierProfile!.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: pendingMaterialTitle,
      status: 'PENDING_RESERVATION',
      createdAt: new Date(now + 1_000),
    });
    await createMaterial({
      ownerId: supplier.id,
      supplierProfileId: supplier.supplierProfile!.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: reusedMaterialTitle,
      status: 'REUSED',
      createdAt: new Date(now + 2_000),
    });
    await createProject({
      creatorId: learner.id,
      categoryId: projectCategory.id,
      title: publishedProjectTitle,
      status: 'PUBLISHED',
      createdAt: new Date(now),
    });
    await createProject({
      creatorId: learner.id,
      categoryId: projectCategory.id,
      title: draftProjectTitle,
      status: 'DRAFT',
      createdAt: new Date(now + 1_000),
    });
  });

  after(async () => {
    if (ids.projects.length > 0) {
      await prisma.learningProject.deleteMany({
        where: { id: { in: ids.projects } },
      });
    }
    if (ids.materials.length > 0) {
      await prisma.material.deleteMany({
        where: { id: { in: ids.materials } },
      });
    }
    if (ids.locations.length > 0) {
      await prisma.location.deleteMany({
        where: { id: { in: ids.locations } },
      });
    }
    if (ids.categories.length > 0) {
      await prisma.category.deleteMany({
        where: { id: { in: ids.categories } },
      });
    }
    if (ids.users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    }
  });

  test('guest HTTP endpoint returns only public available materials and published projects', async () => {
    const response = await request('/api/public/landing');
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);

    const data = response.body.data;
    assert.ok(data);
    const stats = data.stats as {
      availableMaterialsCount: number;
      publishedProjectsCount: number;
      reusedMaterialsCount: number;
    };
    const materials = data.materials as Array<Record<string, unknown>>;
    const projects = data.projects as Array<Record<string, unknown>>;
    const communityMembers = data.communityMembers as Array<{
      displayName?: string;
      avatarUrl?: string;
    }>;

    assert.equal(stats.availableMaterialsCount >= 1, true);
    assert.equal(stats.publishedProjectsCount >= 1, true);
    assert.equal(stats.reusedMaterialsCount >= 1, true);
    assert.equal(materials.length <= 6, true);
    assert.equal(projects.length <= 6, true);
    assert.equal(communityMembers.length <= 4, true);
    assert.equal(
      communityMembers.some(
        (member) => member.displayName === `${TEST_MARKER} Learner`,
      ),
      true,
    );
    assert.equal(
      communityMembers.some(
        (member) => member.displayName === `${TEST_MARKER} Placeholder`,
      ),
      false,
    );
    assert.equal(
      communityMembers.every(
        (member) =>
          typeof member.avatarUrl === 'string' &&
          member.avatarUrl.length > 0 &&
          !member.avatarUrl.toLowerCase().includes('dicebear.com'),
      ),
      true,
    );

    const materialTitles = materials.map((item) => String(item.title));
    const projectTitles = projects.map((item) => String(item.title));
    assert.equal(materialTitles.includes(availableMaterialTitle), true);
    assert.equal(materialTitles.includes(pendingMaterialTitle), false);
    assert.equal(materialTitles.includes(reusedMaterialTitle), false);
    assert.equal(projectTitles.includes(publishedProjectTitle), true);
    assert.equal(projectTitles.includes(draftProjectTitle), false);

    for (const material of materials) {
      assert.equal(material.status, 'AVAILABLE');
      assert.equal('email' in material, false);
      assert.equal('addressLine' in material, false);
    }

    const serialized = JSON.stringify(data);
    assert.equal(serialized.includes(supplierEmail), false);
    assert.equal(serialized.includes(supplierPhone), false);
    assert.equal(serialized.includes('secret street'), false);
    assertNoPrivateFields(data);
  });

  test('service payload stays within public-safe featured limits', async () => {
    const landing = await getPublicLanding();
    assert.equal(landing.materials.length <= 6, true);
    assert.equal(landing.projects.length <= 6, true);
    assert.equal(landing.communityMembers.length <= 4, true);
    assert.equal(
      landing.communityMembers.every((member) => Boolean(member.avatarUrl)),
      true,
    );
    assert.equal(
      landing.materials.every((item) => item.status === 'AVAILABLE'),
      true,
    );
    assert.equal(
      landing.materials.some((item) => item.title === availableMaterialTitle),
      true,
    );
    assert.equal(
      landing.projects.some((item) => item.title === publishedProjectTitle),
      true,
    );
    assertNoPrivateFields(landing);
  });
});
