import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'ai-build-guide-material-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'ai-build-guide-material-refresh-secret';
process.env.AI_CHAT_PROVIDER = 'mock';
process.env.AI_CHAT_RATE_LIMIT_PER_USER = '60';
process.env.AI_CHAT_MAX_CONVERSATIONS_PER_HOUR = '60';

const TEST_MARKER = '[test-ai-build-guide-material]';
const COMPONENTS = [
  { componentName: 'LED', materialType: 'LED', searchKeywords: ['led'] },
  { componentName: 'Resistor', materialType: 'Resistor', searchKeywords: ['resistor', 'مقاومة'] },
  { componentName: 'Breadboard', materialType: 'Breadboard', searchKeywords: ['breadboard'] },
];
const clientId = (suffix: string) =>
  `client-material-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 64);

type ApiJson = {
  data?: Record<string, unknown> & {
    id?: string;
    contentBlocks?: Array<Record<string, unknown>>;
  };
  error?: { code?: string };
};

const ids = {
  users: [] as string[],
  categories: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
};

let baseUrl = '';
let server: Server | null = null;
let prisma: typeof import('../../../database/prisma.js').prisma;
let signAccessToken: typeof import('../../../utils/jwt.js').signAccessToken;
let hashPassword: typeof import('../../../utils/password.js').hashPassword;
let resetRateLimitersForTests: typeof import('../../../middlewares/rate-limit.middleware.js').resetRateLimitersForTests;
let deleteAiDataForUsers: typeof import('../ai.repository.js').deleteAiDataForUsers;
let setAiChatProviderForTests: typeof import('../providers/ai-chat-provider.factory.js').setAiChatProviderForTests;
let MockAiChatProviderClass: typeof import('../providers/mock-chat.provider.js').MockAiChatProvider;

async function createLearner(label: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${label}`,
      email: `${TEST_MARKER}-${label}-${Date.now()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: { create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' } },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createSupplier() {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Supplier`,
      email: `${TEST_MARKER}-supplier-${Date.now()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
      supplierProfile: {
        create: {
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: `${TEST_MARKER} Supplier`,
          verificationStatus: 'APPROVED',
        },
      },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createCategory(nameEn: string, nameAr: string, categoryType: 'PROJECT' | 'BOTH') {
  const category = await prisma.category.create({
    data: { nameEn: `${TEST_MARKER} ${nameEn}`, nameAr: `${TEST_MARKER} ${nameAr}`, categoryType, isActive: true },
  });
  ids.categories.push(category.id);
  return category;
}

async function apiFetch(path: string, options: { method?: string; token?: string; body?: unknown } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { response, json: (await response.json()) as ApiJson };
}

function tokenFor(userId: string) {
  return signAccessToken({ sub: userId, roles: ['LEARNER'] });
}

function parseBlocks(json: ApiJson) {
  return (json.data?.contentBlocks ?? []) as Array<Record<string, unknown>>;
}

function confirmationBlock(blocks: Array<Record<string, unknown>>) {
  const block = blocks.find((entry) => entry.type === 'action_confirmation');
  assert.ok(block, 'expected action_confirmation');
  return block;
}

async function sendMessage(token: string, conversationId: string, text: string, messageClientId: string) {
  return apiFetch(`/api/ai/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    token,
    body: { text, locale: 'ar', clientMessageId: messageClientId },
  });
}

async function confirmAction(token: string, pendingActionId: string, idempotencyKey: string) {
  return apiFetch(`/api/ai/v1/actions/${pendingActionId}/confirm`, {
    method: 'POST',
    token,
    body: { idempotencyKey, locale: 'ar' },
  });
}

async function createFixture() {
  const learner = await createLearner('owner');
  const supplier = await createSupplier();
  const supplierProfile = await prisma.supplierProfile.findUnique({ where: { userId: supplier.id } });
  assert.ok(supplierProfile);

  const projectCategory = await createCategory('Projects', 'مشاريع', 'PROJECT');
  const materialCategory = await createCategory('Electronics', 'إلكترونيات', 'BOTH');

  const location = await prisma.location.create({
    data: {
      country: 'PS',
      city: `${TEST_MARKER}-Nablus`,
      area: 'Industrial',
      latitude: 32.2211,
      longitude: 35.2544,
      visibility: 'PRIVATE',
      isApproximate: true,
    },
  });
  ids.locations.push(location.id);

  const ledMaterial = await prisma.material.create({
    data: {
      ownerId: supplier.id,
      supplierProfileId: supplierProfile.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} available LED`,
      description: `${TEST_MARKER} LED for matching`,
      materialType: 'LED',
      quantity: 5,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: false,
    },
  });
  ids.materials.push(ledMaterial.id);

  const project = await prisma.learningProject.create({
    data: {
      categoryId: projectCategory.id,
      createdBy: learner.id,
      title: `${TEST_MARKER} Material project`,
      shortDescription: `${TEST_MARKER} short`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      requiredComponents: {
        create: COMPONENTS.map((component) => ({
          ...component,
          quantity: 1,
          unit: 'piece',
          componentRole: 'REQUIRED_MATERIAL' as const,
          categoryId: materialCategory.id,
        })),
      },
      steps: {
        create: [{ stepNumber: 1, title: 'Wire LED', description: 'Connect LED', reviewStatus: 'ACCEPTED' }],
      },
    },
    include: { requiredComponents: true },
  });
  ids.projects.push(project.id);

  const build = await prisma.projectBuild.create({
    data: {
      projectId: project.id,
      learnerId: learner.id,
      items: { create: project.requiredComponents.map((c) => ({ requiredComponentId: c.id })) },
    },
  });
  ids.builds.push(build.id);

  const guide = await apiFetch(`/api/learning-projects/${project.id}/builds/me/guide-conversation`, {
    method: 'POST',
    token: tokenFor(learner.id),
    body: { locale: 'ar' },
  });
  assert.equal(guide.response.status, 200);
  const conversationId = ((guide.json.data?.conversation as Record<string, unknown> | undefined)?.id) as string;
  assert.ok(conversationId);

  return { project, build, ledMaterial, token: tokenFor(learner.id), conversationId };
}

before(async () => {
  ({ prisma } = await import('../../../database/prisma.js'));
  ({ signAccessToken } = await import('../../../utils/jwt.js'));
  ({ hashPassword } = await import('../../../utils/password.js'));
  ({ resetRateLimitersForTests } = await import('../../../middlewares/rate-limit.middleware.js'));
  ({ deleteAiDataForUsers } = await import('../ai.repository.js'));
  ({ setAiChatProviderForTests } = await import('../providers/ai-chat-provider.factory.js'));
  ({ MockAiChatProvider: MockAiChatProviderClass } = await import('../providers/mock-chat.provider.js'));

  const { app } = await import('../../../app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server!.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
  resetRateLimitersForTests();
  setAiChatProviderForTests(new MockAiChatProviderClass());
});

after(async () => {
  if (ids.users.length > 0) await deleteAiDataForUsers(ids.users);
  if (ids.builds.length > 0) await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  if (ids.materials.length > 0) await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
  if (ids.projects.length > 0) await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
  if (ids.locations.length > 0) await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  if (ids.categories.length > 0) await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  if (ids.users.length > 0) {
    await prisma.supplierProfile.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

describe('build-guide material actions', () => {
  test('missing overview returns build_checklist with only not-ready items', async () => {
    const fixture = await createFixture();
    const owned = await sendMessage(fixture.token, fixture.conversationId, 'عندي LED', clientId('own-led'));
    assert.equal(owned.response.status, 201);
    const ownedConfirm = confirmationBlock(parseBlocks(owned.json));
    await confirmAction(fixture.token, ownedConfirm.pendingActionId as string, clientId('confirm-led'));

    const response = await sendMessage(fixture.token, fixture.conversationId, 'شو ناقصني؟', clientId('gap'));
    assert.equal(response.response.status, 201);
    const checklist = parseBlocks(response.json).find((block) => block.type === 'build_checklist');
    assert.ok(checklist);
    assert.equal(checklist.buildId, fixture.build.id);
    const items = checklist.items as Array<{ name: string; status: string }>;
    assert.equal(items.length, 2);
    assert.ok(!items.some((item) => item.name === 'LED'));
    assert.ok(items.every((item) => item.status !== 'ALREADY_OWNED'));
  });

  test('search all missing returns component_matches', async () => {
    const fixture = await createFixture();
    const response = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'لاقيلّي مواد للمكونات الناقصة',
      clientId('search-all'),
    );
    assert.equal(response.response.status, 201);
    const matches = parseBlocks(response.json).find((block) => block.type === 'component_matches');
    assert.ok(matches);
    assert.equal(matches.buildId, fixture.build.id);
    const ledGroup = (matches.groups as Array<{ componentName: string; materials: Array<{ materialId: string }> }>)
      .find((group) => group.componentName === 'LED');
    assert.ok(ledGroup);
    assert.ok(ledGroup.materials.some((material) => material.materialId === fixture.ledMaterial.id));
  });

  test('link flow: search then اربط أول مادة confirm once', async () => {
    const fixture = await createFixture();
    const search = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'لاقيلّي مواد للمكونات الناقصة',
      clientId('link-search'),
    );
    assert.equal(search.response.status, 201);
    assert.ok(parseBlocks(search.json).some((block) => block.type === 'component_matches'));

    const prepared = await sendMessage(fixture.token, fixture.conversationId, 'اربط أول مادة', clientId('link'));
    assert.equal(prepared.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    assert.equal(confirmation.actionType, 'LINK_MATERIAL_TO_BUILD_COMPONENT');
    await confirmAction(fixture.token, confirmation.pendingActionId as string, clientId('link-confirm'));

    const linked = await prisma.projectBuildItem.count({
      where: { buildId: fixture.build.id, linkedMaterialId: { not: null } },
    });
    assert.equal(linked, 1);
  });

  test('general conversation asking شو ناقصني does not use trusted build', async () => {
    const learner = await createLearner('general');
    const token = tokenFor(learner.id);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'ar' },
    });
    assert.equal(created.response.status, 201);
    const response = await sendMessage(token, created.json.data?.id as string, 'شو ناقصني؟', clientId('general'));
    assert.equal(response.response.status, 201);
    const blocks = parseBlocks(response.json);
    const checklist = blocks.find((block) => block.type === 'build_checklist');
    if (checklist) {
      assert.ok(!checklist.buildId);
    } else {
      const text = blocks.filter((b) => b.type === 'text').map((b) => String(b.text ?? '')).join('\n');
      assert.match(text, /مشروع بناء|project build/i);
    }
  });

  test('other learner cannot access build guide conversation', async () => {
    const fixture = await createFixture();
    const intruderToken = tokenFor((await createLearner('intruder')).id);
    const guideDenied = await apiFetch(
      `/api/learning-projects/${fixture.project.id}/builds/me/guide-conversation`,
      { method: 'POST', token: intruderToken, body: { locale: 'ar' } },
    );
    assert.equal(guideDenied.response.status, 404);
    assert.equal(guideDenied.json.error?.code, 'BUILD_NOT_FOUND');
    const messageDenied = await sendMessage(intruderToken, fixture.conversationId, 'شو ناقصني؟', clientId('intruder'));
    assert.equal(messageDenied.response.status, 404);
    assert.equal(messageDenied.json.error?.code, 'AI_CONVERSATION_NOT_FOUND');
  });
});
