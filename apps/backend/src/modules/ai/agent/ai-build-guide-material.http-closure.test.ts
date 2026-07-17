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
  reservations: [] as string[],
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

async function cancelAction(token: string, pendingActionId: string, idempotencyKey: string) {
  return apiFetch(`/api/ai/v1/actions/${pendingActionId}/cancel`, {
    method: 'POST',
    token,
    body: { idempotencyKey, locale: 'ar' },
  });
}

async function searchForMatches(token: string, conversationId: string, label: string) {
  const response = await sendMessage(
    token,
    conversationId,
    'لاقيلّي مواد للمكونات الناقصة',
    clientId(`${label}-search`),
  );
  assert.equal(response.response.status, 201);
  const blocks = parseBlocks(response.json);
  assert.ok(blocks.some((block) => block.type === 'component_matches'));
  return blocks;
}

function futurePickupWindow(hoursFromNow = 72) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function completeBuildGuideReservation(
  token: string,
  conversationId: string,
  label: string,
) {
  const step1 = await sendMessage(token, conversationId, 'احجزها', clientId(`${label}-reserve-1`));
  assert.equal(step1.response.status, 201);
  const step2 = await sendMessage(token, conversationId, '1', clientId(`${label}-reserve-2`));
  assert.equal(step2.response.status, 201);
  const window = futurePickupWindow(72);
  const step3 = await sendMessage(
    token,
    conversationId,
    `استلام من ${window.start} إلى ${window.end}`,
    clientId(`${label}-reserve-3`),
  );
  assert.equal(step3.response.status, 201);
  const confirmation = confirmationBlock(parseBlocks(step3.json));
  await confirmAction(token, confirmation.pendingActionId as string, clientId(`${label}-reserve-confirm`));
  return confirmation;
}

async function searchAndLinkFirstMaterial(token: string, conversationId: string, label: string) {
  await searchForMatches(token, conversationId, label);
  const prepared = await sendMessage(token, conversationId, 'اربط أول مادة', clientId(`${label}-link`));
  const confirmation = confirmationBlock(parseBlocks(prepared.json));
  await confirmAction(token, confirmation.pendingActionId as string, clientId(`${label}-confirm`));
  return confirmation;
}

async function createLinkedResistorMaterial(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: fixture.supplier.id },
  });
  assert.ok(supplierProfile);
  const materialCategory = await prisma.category.findFirst({
    where: { nameEn: { contains: 'Electronics' } },
  });
  assert.ok(materialCategory);

  const location = await prisma.location.findFirst({
    where: { city: { contains: TEST_MARKER } },
  });
  assert.ok(location);

  const material = await prisma.material.create({
    data: {
      ownerId: fixture.supplier.id,
      supplierProfileId: supplierProfile.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} available Resistor`,
      description: `${TEST_MARKER} Resistor for matching`,
      materialType: 'Resistor',
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
  ids.materials.push(material.id);
  return material;
}

function checklistItems(blocks: Array<Record<string, unknown>>) {
  const checklist = blocks.find((block) => block.type === 'build_checklist');
  return (checklist?.items ?? []) as Array<{
    name: string;
    status: string;
    readinessLabel?: string;
    linkedMaterialId?: string | null;
    linkedReservationId?: string | null;
  }>;
}

async function patchBuildItem(
  token: string,
  projectId: string,
  itemId: string,
  status: 'MISSING' | 'ALREADY_OWNED' | 'AVAILABLE' | 'RESERVED' | 'ALTERNATIVE',
) {
  return apiFetch(`/api/learning-projects/${projectId}/builds/me/items/${itemId}`, {
    method: 'PATCH',
    token,
    body: { status },
  });
}

async function getMyBuild(token: string, projectId: string) {
  return apiFetch(`/api/learning-projects/${projectId}/builds/me`, { token });
}

async function linkBuildItemMaterial(
  token: string,
  projectId: string,
  itemId: string,
  materialId: string,
) {
  return apiFetch(
    `/api/learning-projects/${projectId}/builds/me/items/${itemId}/link-material`,
    {
      method: 'POST',
      token,
      body: { materialId },
    },
  );
}

async function createFixture(options: { includeMaterial?: boolean } = {}) {
  const includeMaterial = options.includeMaterial ?? true;
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

  const ledMaterial = includeMaterial
    ? await prisma.material.create({
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
      })
    : null;
  if (ledMaterial) {
    ids.materials.push(ledMaterial.id);
  }

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

  const buildItems = await prisma.projectBuildItem.findMany({
    where: { buildId: build.id },
    include: { requiredComponent: true },
  });

  return {
    project,
    build,
    buildItems,
    ledMaterial,
    supplier,
    token: tokenFor(learner.id),
    conversationId,
  };
}

async function createIsolatedNoMatchFixture() {
  const learner = await createLearner('nomatch');
  const uniqueToken = `nomatch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const projectCategory = await createCategory('Projects', 'مشاريع', 'PROJECT');
  const isolatedCategory = await createCategory(
    `Isolated-${uniqueToken}`,
    `معزول-${uniqueToken}`,
    'BOTH',
  );
  const componentName = `Widget-${uniqueToken}`;

  const project = await prisma.learningProject.create({
    data: {
      categoryId: projectCategory.id,
      createdBy: learner.id,
      title: `${TEST_MARKER} No-match ${uniqueToken}`,
      shortDescription: `${TEST_MARKER} short`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      requiredComponents: {
        create: [
          {
            componentName,
            materialType: `Type-${uniqueToken}`,
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: isolatedCategory.id,
            searchKeywords: [uniqueToken],
          },
        ],
      },
      steps: {
        create: [
          {
            stepNumber: 1,
            title: 'Assemble',
            description: 'Assemble widget',
            reviewStatus: 'ACCEPTED',
          },
        ],
      },
    },
  });
  ids.projects.push(project.id);

  const build = await prisma.projectBuild.create({
    data: {
      projectId: project.id,
      learnerId: learner.id,
      items: {
        create: (
          await prisma.projectRequiredComponent.findMany({ where: { projectId: project.id } })
        ).map((component) => ({ requiredComponentId: component.id })),
      },
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

  return {
    token: tokenFor(learner.id),
    conversationId,
    componentName,
    uniqueToken,
  };
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
  if (ids.reservations.length > 0) {
    await prisma.reservation.deleteMany({ where: { id: { in: ids.reservations } } });
  }
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
    assert.ok(
      ledGroup.materials.some(
        (material) => material.materialId === fixture.ledMaterial?.id,
      ),
    );

    const conversation = await prisma.aiConversation.findUnique({
      where: { id: fixture.conversationId },
      select: { processingState: true },
    });
    assert.equal(conversation?.processingState, 'IDLE');
  });

  test('search one missing component returns matches for that component only', async () => {
    const fixture = await createFixture();
    const response = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'لاقيلي مادة للـLED',
      clientId('search-led'),
    );
    assert.equal(response.response.status, 201);
    const matches = parseBlocks(response.json).find((block) => block.type === 'component_matches');
    assert.ok(matches);
    const groups = matches.groups as Array<{ componentName: string; materials: Array<{ materialId: string }> }>;
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.componentName, 'LED');
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

  test('double confirm with same idempotency key executes once', async () => {
    const fixture = await createFixture();
    await sendMessage(
      fixture.token,
      fixture.conversationId,
      'لاقيلّي مواد للمكونات الناقصة',
      clientId('double-search'),
    );
    const prepared = await sendMessage(fixture.token, fixture.conversationId, 'اربط أول مادة', clientId('double-link'));
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const idempotencyKey = clientId('double-confirm');
    await confirmAction(fixture.token, confirmation.pendingActionId as string, idempotencyKey);
    await confirmAction(fixture.token, confirmation.pendingActionId as string, idempotencyKey);
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

describe('build-guide genuine readiness', () => {
  test('MISSING components are included in missing overview', async () => {
    const fixture = await createFixture();
    const response = await sendMessage(fixture.token, fixture.conversationId, 'شو ناقصني؟', clientId('missing'));
    assert.equal(response.response.status, 201);
    const names = checklistItems(parseBlocks(response.json)).map((item) => item.name);
    assert.deepEqual(names.sort(), ['Breadboard', 'LED', 'Resistor']);
  });

  test('AVAILABLE self-report is included as not genuinely ready', async () => {
    const fixture = await createFixture();
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    assert.ok(ledItem);
    const patched = await patchBuildItem(fixture.token, fixture.project.id, ledItem.id, 'AVAILABLE');
    assert.equal(patched.response.status, 200);

    const response = await sendMessage(fixture.token, fixture.conversationId, 'شو ناقصني؟', clientId('available'));
    const names = checklistItems(parseBlocks(response.json)).map((item) => item.name);
    assert.ok(names.includes('LED'));
    const led = checklistItems(parseBlocks(response.json)).find((item) => item.name === 'LED');
    assert.equal(led?.status, 'AVAILABLE');
  });

  test('ALTERNATIVE self-report is included as not genuinely ready', async () => {
    const fixture = await createFixture();
    const resistorItem = fixture.buildItems.find(
      (item) => item.requiredComponent.componentName === 'Resistor',
    );
    assert.ok(resistorItem);
    await patchBuildItem(fixture.token, fixture.project.id, resistorItem.id, 'ALTERNATIVE');

    const response = await sendMessage(fixture.token, fixture.conversationId, 'شو ناقصني؟', clientId('alt'));
    const resistor = checklistItems(parseBlocks(response.json)).find((item) => item.name === 'Resistor');
    assert.ok(resistor);
    assert.equal(resistor.status, 'ALTERNATIVE');
  });

  test('linked material is included and labelled as not received', async () => {
    const fixture = await createFixture();
    assert.ok(fixture.ledMaterial);
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    assert.ok(ledItem);
    const linked = await linkBuildItemMaterial(
      fixture.token,
      fixture.project.id,
      ledItem.id,
      fixture.ledMaterial.id,
    );
    assert.equal(linked.response.status, 200);

    const response = await sendMessage(fixture.token, fixture.conversationId, 'شو ناقصني؟', clientId('linked'));
    const led = checklistItems(parseBlocks(response.json)).find((item) => item.name === 'LED');
    assert.ok(led);
    assert.equal(led.linkedMaterialId, fixture.ledMaterial.id);
    assert.match(led.readinessLabel ?? '', /Material selected|reserve|acquire/i);
  });

  test('active reservation is included as reserved and not received', async () => {
    const fixture = await createFixture();
    assert.ok(fixture.ledMaterial);
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    assert.ok(ledItem);
    const reservation = await prisma.reservation.create({
      data: {
        materialId: fixture.ledMaterial.id,
        ownerId: fixture.supplier.id,
        requesterId: (await prisma.projectBuild.findUniqueOrThrow({ where: { id: fixture.build.id } })).learnerId,
        quantityRequested: 1,
        fulfillmentMethod: 'PICKUP',
        status: 'ACCEPTED',
      },
    });
    ids.reservations.push(reservation.id);
    await prisma.projectBuildItem.update({
      where: { id: ledItem.id },
      data: {
        status: 'RESERVED',
        linkedMaterialId: fixture.ledMaterial.id,
        linkedReservationId: reservation.id,
        linkedMaterialAt: new Date(),
      },
    });

    const response = await sendMessage(fixture.token, fixture.conversationId, 'شو ناقصني؟', clientId('reserved'));
    const led = checklistItems(parseBlocks(response.json)).find((item) => item.name === 'LED');
    assert.ok(led);
    assert.equal(led.linkedReservationId, reservation.id);
    assert.match(led.readinessLabel ?? '', /Reservation|reserved|not ready/i);
  });

  test('completed acquisition is excluded from missing overview', async () => {
    const fixture = await createFixture();
    assert.ok(fixture.ledMaterial);
    const reservation = await prisma.reservation.create({
      data: {
        materialId: fixture.ledMaterial.id,
        ownerId: fixture.supplier.id,
        requesterId: (await prisma.projectBuild.findUniqueOrThrow({ where: { id: fixture.build.id } })).learnerId,
        quantityRequested: 1,
        fulfillmentMethod: 'PICKUP',
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    assert.ok(ledItem);
    await prisma.projectBuildItem.update({
      where: { id: ledItem.id },
      data: {
        linkedMaterialId: fixture.ledMaterial.id,
        linkedReservationId: reservation.id,
        linkedMaterialAt: new Date(),
      },
    });

    const response = await sendMessage(fixture.token, fixture.conversationId, 'شو ناقصني؟', clientId('completed'));
    const names = checklistItems(parseBlocks(response.json)).map((item) => item.name);
    assert.ok(!names.includes('LED'));
  });

  test('ALREADY_OWNED is excluded from missing overview', async () => {
    const fixture = await createFixture();
    const owned = await sendMessage(fixture.token, fixture.conversationId, 'عندي LED', clientId('owned'));
    const ownedConfirm = confirmationBlock(parseBlocks(owned.json));
    await confirmAction(fixture.token, ownedConfirm.pendingActionId as string, clientId('owned-confirm'));

    const response = await sendMessage(fixture.token, fixture.conversationId, 'شو ناقصني؟', clientId('owned-gap'));
    const names = checklistItems(parseBlocks(response.json)).map((item) => item.name);
    assert.ok(!names.includes('LED'));
  });

  test('search-all uses the same genuine-readiness filtering', async () => {
    const fixture = await createFixture();
    const owned = await sendMessage(fixture.token, fixture.conversationId, 'عندي LED', clientId('search-owned'));
    const ownedConfirm = confirmationBlock(parseBlocks(owned.json));
    await confirmAction(fixture.token, ownedConfirm.pendingActionId as string, clientId('search-owned-confirm'));

    const resistorItem = fixture.buildItems.find(
      (item) => item.requiredComponent.componentName === 'Resistor',
    );
    assert.ok(resistorItem);
    await patchBuildItem(fixture.token, fixture.project.id, resistorItem.id, 'AVAILABLE');

    const response = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'لاقيلّي مواد للمكونات الناقصة',
      clientId('search-filtered'),
    );
    assert.equal(response.response.status, 201);
    const matches = parseBlocks(response.json).find((block) => block.type === 'component_matches');
    assert.ok(matches);
    const groupNames = (matches.groups as Array<{ componentName: string }>).map((group) => group.componentName);
    assert.ok(!groupNames.includes('LED'));
    assert.ok(groupNames.includes('Resistor'));
    assert.ok(groupNames.includes('Breadboard'));
  });

  test('isolated fixture returns stable no-match success without writes', async () => {
    const fixture = await createIsolatedNoMatchFixture();
    const beforeMaterials = await prisma.material.count({
      where: { categoryId: { in: ids.categories } },
    });
    const beforeLinks = await prisma.projectBuildItem.count({
      where: { linkedMaterialId: { not: null } },
    });

    const response = await sendMessage(
      fixture.token,
      fixture.conversationId,
      `لاقيلي مادة للـ${fixture.componentName}`,
      clientId('no-match'),
    );
    assert.equal(response.response.status, 201);
    const blocks = parseBlocks(response.json);
    assert.ok(!blocks.some((block) => block.type === 'component_matches'));
    assert.ok(!blocks.some((block) => block.type === 'action_confirmation'));
    const text = blocks
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n');
    assert.match(text, /لم أجد مواد متوافقة|could not find compatible materials/i);

    const conversation = await prisma.aiConversation.findUnique({
      where: { id: fixture.conversationId },
      select: { processingState: true },
    });
    assert.equal(conversation?.processingState, 'IDLE');

    const afterMaterials = await prisma.material.count({
      where: { categoryId: { in: ids.categories } },
    });
    const afterLinks = await prisma.projectBuildItem.count({
      where: { linkedMaterialId: { not: null } },
    });
    assert.equal(afterMaterials, beforeMaterials);
    assert.equal(afterLinks, beforeLinks);
  });

  test('linking does not make the component genuinely ready or unlock step 1', async () => {
    const fixture = await createFixture();
    assert.ok(fixture.ledMaterial);
    const search = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'لاقيلّي مواد للمكونات الناقصة',
      clientId('link-ready-search'),
    );
    assert.equal(search.response.status, 201);
    const prepared = await sendMessage(fixture.token, fixture.conversationId, 'اربط أول مادة', clientId('link-ready'));
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    await confirmAction(fixture.token, confirmation.pendingActionId as string, clientId('link-ready-confirm'));

    const build = await getMyBuild(fixture.token, fixture.project.id);
    assert.equal(build.response.status, 200);
    const stepProgress = build.json.data?.stepProgress as {
      steps: Array<{ state: string }>;
    };
    assert.equal(stepProgress.steps[0]?.state, 'LOCKED');

    const overview = await sendMessage(fixture.token, fixture.conversationId, 'شو ناقصني؟', clientId('link-ready-gap'));
    const led = checklistItems(parseBlocks(overview.json)).find((item) => item.name === 'LED');
    assert.ok(led);
    assert.ok(led.linkedMaterialId);
  });

  test('active reservation keeps step 1 locked', async () => {
    const fixture = await createFixture();
    assert.ok(fixture.ledMaterial);
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    assert.ok(ledItem);
    const reservation = await prisma.reservation.create({
      data: {
        materialId: fixture.ledMaterial.id,
        ownerId: fixture.supplier.id,
        requesterId: (await prisma.projectBuild.findUniqueOrThrow({ where: { id: fixture.build.id } })).learnerId,
        quantityRequested: 1,
        fulfillmentMethod: 'PICKUP',
        status: 'ACCEPTED',
      },
    });
    ids.reservations.push(reservation.id);
    await prisma.projectBuildItem.update({
      where: { id: ledItem.id },
      data: {
        status: 'RESERVED',
        linkedMaterialId: fixture.ledMaterial.id,
        linkedReservationId: reservation.id,
        linkedMaterialAt: new Date(),
      },
    });

    const build = await getMyBuild(fixture.token, fixture.project.id);
    const stepProgress = build.json.data?.stepProgress as {
      steps: Array<{ state: string }>;
    };
    assert.equal(stepProgress.steps[0]?.state, 'LOCKED');
  });

  test('completed acquisition unlocks step 1 through canonical Wave 1 predicate', async () => {
    const fixture = await createFixture();
    assert.ok(fixture.ledMaterial);
    const learnerId = (await prisma.projectBuild.findUniqueOrThrow({ where: { id: fixture.build.id } })).learnerId;

    for (const item of fixture.buildItems) {
      const reservation = await prisma.reservation.create({
        data: {
          materialId: fixture.ledMaterial.id,
          ownerId: fixture.supplier.id,
          requesterId: learnerId,
          quantityRequested: 1,
          fulfillmentMethod: 'PICKUP',
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      ids.reservations.push(reservation.id);
      await prisma.projectBuildItem.update({
        where: { id: item.id },
        data: {
          linkedMaterialId: fixture.ledMaterial.id,
          linkedReservationId: reservation.id,
          linkedMaterialAt: new Date(),
        },
      });
    }

    const build = await getMyBuild(fixture.token, fixture.project.id);
    const stepProgress = build.json.data?.stepProgress as {
      steps: Array<{ state: string }>;
    };
    assert.equal(stepProgress.steps[0]?.state, 'CURRENT');

    const response = await sendMessage(fixture.token, fixture.conversationId, 'شو ناقصني؟', clientId('all-ready'));
    assert.equal(checklistItems(parseBlocks(response.json)).length, 0);
  });
});

describe('build-guide unlink and reservation follow-ups', () => {
  test('search link confirm then فك الربط returns unlink confirmation with trusted ids', async () => {
    const fixture = await createFixture();
    await searchAndLinkFirstMaterial(fixture.token, fixture.conversationId, 'unlink-flow');
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    assert.ok(ledItem && fixture.ledMaterial);

    const beforeLinks = await prisma.projectBuildItem.count({
      where: { buildId: fixture.build.id, linkedMaterialId: { not: null } },
    });
    assert.equal(beforeLinks, 1);

    const response = await sendMessage(fixture.token, fixture.conversationId, 'فك الربط', clientId('unlink'));
    assert.equal(response.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(response.json));
    assert.equal(confirmation.actionType, 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT');
    assert.match(String(confirmation.summary ?? ''), /LED/i);
    assert.match(String(confirmation.summary ?? ''), new RegExp(fixture.ledMaterial!.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    const target = confirmation.target as { title?: string } | undefined;
    assert.match(String(target?.title ?? ''), /Material project/i);

    const pending = await prisma.aiPendingAction.findUnique({
      where: { id: confirmation.pendingActionId as string },
    });
    assert.ok(pending);
    const payload = pending.payload as {
      target?: { projectId?: string; buildId?: string; buildItemId?: string };
    };
    assert.equal(payload.target?.projectId, fixture.project.id);
    assert.equal(payload.target?.buildId, fixture.build.id);
    assert.equal(payload.target?.buildItemId, ledItem.id);

    const afterLinks = await prisma.projectBuildItem.count({
      where: { buildId: fixture.build.id, linkedMaterialId: { not: null } },
    });
    assert.equal(afterLinks, 1);
  });

  test('confirm unlink removes canonical link and returns IDLE', async () => {
    const fixture = await createFixture();
    await searchAndLinkFirstMaterial(fixture.token, fixture.conversationId, 'unlink-confirm');
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    assert.ok(ledItem);

    const prepared = await sendMessage(fixture.token, fixture.conversationId, 'فك الربط', clientId('unlink-prepare'));
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    await confirmAction(fixture.token, confirmation.pendingActionId as string, clientId('unlink-confirm'));

    const linked = await prisma.projectBuildItem.findUnique({ where: { id: ledItem.id } });
    assert.equal(linked?.linkedMaterialId, null);

    const conversation = await prisma.aiConversation.findUnique({
      where: { id: fixture.conversationId },
      select: { processingState: true },
    });
    assert.equal(conversation?.processingState, 'IDLE');
  });

  test('search link confirm then احجزها starts reservation draft for linked material', async () => {
    const fixture = await createFixture();
    await searchAndLinkFirstMaterial(fixture.token, fixture.conversationId, 'reserve-short');
    assert.ok(fixture.ledMaterial);

    const response = await sendMessage(fixture.token, fixture.conversationId, 'احجزها', clientId('reserve-it'));
    assert.equal(response.response.status, 201);
    const text = parseBlocks(response.json)
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n');
    assert.match(text, /كم كمية|quantity/i);
    assert.ok(
      !parseBlocks(response.json).some((block) => block.type === 'action_confirmation'),
    );

    const draft = await prisma.aiPendingAction.findFirst({
      where: {
        conversationId: fixture.conversationId,
        actionType: 'PREPARE_MATERIAL_RESERVATION',
        status: 'PENDING',
      },
    });
    assert.ok(draft);
    const payload = draft.payload as { target?: { materialId?: string } };
    assert.equal(payload.target?.materialId, fixture.ledMaterial.id);
  });

  test('احجز العنصر اللي تم ربطه resolves the linked material', async () => {
    const fixture = await createFixture();
    await searchAndLinkFirstMaterial(fixture.token, fixture.conversationId, 'reserve-linked');
    assert.ok(fixture.ledMaterial);

    const response = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'احجز العنصر اللي تم ربطه',
      clientId('reserve-linked-phrase'),
    );
    assert.equal(response.response.status, 201);
    const text = parseBlocks(response.json)
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n');
    assert.match(text, /كم كمية|quantity/i);

    const draft = await prisma.aiPendingAction.findFirst({
      where: {
        conversationId: fixture.conversationId,
        actionType: 'PREPARE_MATERIAL_RESERVATION',
        status: 'PENDING',
      },
    });
    assert.ok(draft);
    const payload = draft.payload as { target?: { materialId?: string } };
    assert.equal(payload.target?.materialId, fixture.ledMaterial.id);
  });

  test('canonical single linked material resolves احجزها without recent link result', async () => {
    const fixture = await createFixture();
    assert.ok(fixture.ledMaterial);
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    assert.ok(ledItem);
    await linkBuildItemMaterial(
      fixture.token,
      fixture.project.id,
      ledItem.id,
      fixture.ledMaterial.id,
    );

    const response = await sendMessage(fixture.token, fixture.conversationId, 'احجزها', clientId('reserve-canonical'));
    assert.equal(response.response.status, 201);
    const text = parseBlocks(response.json)
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n');
    assert.match(text, /كم كمية|quantity/i);
  });

  test('two linked materials with احجزها asks clarification without writes', async () => {
    const fixture = await createFixture();
    assert.ok(fixture.ledMaterial);
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    const resistorItem = fixture.buildItems.find(
      (item) => item.requiredComponent.componentName === 'Resistor',
    );
    assert.ok(ledItem && resistorItem);
    const resistorMaterial = await createLinkedResistorMaterial(fixture);

    await linkBuildItemMaterial(fixture.token, fixture.project.id, ledItem.id, fixture.ledMaterial.id);
    await linkBuildItemMaterial(
      fixture.token,
      fixture.project.id,
      resistorItem.id,
      resistorMaterial.id,
    );

    const beforeReservations = await prisma.reservation.count({
      where: { requesterId: (await prisma.projectBuild.findUniqueOrThrow({ where: { id: fixture.build.id } })).learnerId },
    });

    const response = await sendMessage(fixture.token, fixture.conversationId, 'احجزها', clientId('reserve-ambiguous'));
    assert.equal(response.response.status, 201);
    const text = parseBlocks(response.json)
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n');
    assert.match(text, /أي مادة مربوطة|which linked material/i);
    assert.ok(text.includes('LED'));
    assert.ok(text.includes('Resistor'));
    assert.ok(
      !parseBlocks(response.json).some((block) => block.type === 'action_confirmation'),
    );

    const afterReservations = await prisma.reservation.count({
      where: { requesterId: (await prisma.projectBuild.findUniqueOrThrow({ where: { id: fixture.build.id } })).learnerId },
    });
    assert.equal(afterReservations, beforeReservations);
  });

  test('active reservation blocks duplicate reservation draft', async () => {
    const fixture = await createFixture();
    assert.ok(fixture.ledMaterial);
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    assert.ok(ledItem);
    const reservation = await prisma.reservation.create({
      data: {
        materialId: fixture.ledMaterial.id,
        ownerId: fixture.supplier.id,
        requesterId: (await prisma.projectBuild.findUniqueOrThrow({ where: { id: fixture.build.id } })).learnerId,
        quantityRequested: 1,
        fulfillmentMethod: 'PICKUP',
        status: 'ACCEPTED',
      },
    });
    ids.reservations.push(reservation.id);
    await prisma.projectBuildItem.update({
      where: { id: ledItem.id },
      data: {
        status: 'RESERVED',
        linkedMaterialId: fixture.ledMaterial.id,
        linkedReservationId: reservation.id,
        linkedMaterialAt: new Date(),
      },
    });

    const response = await sendMessage(fixture.token, fixture.conversationId, 'احجزها', clientId('reserve-active'));
    assert.equal(response.response.status, 201);
    const text = parseBlocks(response.json)
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n');
    assert.match(text, /حجز نشط|active reservation/i);
    assert.match(text, /ACCEPTED|accepted|supplier/i);

    const draft = await prisma.aiPendingAction.findFirst({
      where: {
        conversationId: fixture.conversationId,
        actionType: 'PREPARE_MATERIAL_RESERVATION',
        status: 'PENDING',
      },
    });
    assert.equal(draft, null);
  });

  test('latest link result overrides older component_matches for احجزها', async () => {
    const fixture = await createFixture();
    await searchAndLinkFirstMaterial(fixture.token, fixture.conversationId, 'override-link');
    assert.ok(fixture.ledMaterial);

    const response = await sendMessage(fixture.token, fixture.conversationId, 'احجزها', clientId('override-reserve'));
    assert.equal(response.response.status, 201);
    const draft = await prisma.aiPendingAction.findFirst({
      where: {
        conversationId: fixture.conversationId,
        actionType: 'PREPARE_MATERIAL_RESERVATION',
        status: 'PENDING',
      },
    });
    assert.ok(draft);
    const payload = draft.payload as { target?: { materialId?: string } };
    assert.equal(payload.target?.materialId, fixture.ledMaterial.id);
  });

  test('general conversation احجزها does not gain build-bound reservation access', async () => {
    const learner = await createLearner('general-reserve');
    const token = tokenFor(learner.id);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'ar' },
    });
    assert.equal(created.response.status, 201);
    const response = await sendMessage(
      token,
      created.json.data?.id as string,
      'احجزها',
      clientId('general-reserve'),
    );
    assert.equal(response.response.status, 201);
    const text = parseBlocks(response.json)
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n');
    assert.ok(
      /حدّد|specify|لم أتمكن|could not/i.test(text) ||
        /مشروع|project|مادة|material/i.test(text),
    );
    const draft = await prisma.aiPendingAction.findFirst({
      where: {
        conversationId: created.json.data?.id as string,
        actionType: 'PREPARE_MATERIAL_RESERVATION',
        status: 'PENDING',
      },
    });
    assert.equal(draft, null);
  });

  test('cancel unlink and reservation preparation perform zero writes', async () => {
    const fixture = await createFixture();
    await searchAndLinkFirstMaterial(fixture.token, fixture.conversationId, 'cancel-flow');
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    assert.ok(ledItem);

    const unlinkPrepared = await sendMessage(fixture.token, fixture.conversationId, 'فك الربط', clientId('cancel-unlink'));
    const unlinkConfirmation = confirmationBlock(parseBlocks(unlinkPrepared.json));
    await cancelAction(
      fixture.token,
      unlinkConfirmation.pendingActionId as string,
      clientId('cancel-unlink-key'),
    );
    const stillLinked = await prisma.projectBuildItem.findUnique({ where: { id: ledItem.id } });
    assert.ok(stillLinked?.linkedMaterialId);

    const reservePrepared = await sendMessage(fixture.token, fixture.conversationId, 'احجزها', clientId('cancel-reserve'));
    const text = parseBlocks(reservePrepared.json)
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n');
    assert.match(text, /كم كمية|quantity/i);
    const draft = await prisma.aiPendingAction.findFirst({
      where: {
        conversationId: fixture.conversationId,
        actionType: 'PREPARE_MATERIAL_RESERVATION',
        status: 'PENDING',
      },
    });
    assert.ok(draft);
    await cancelAction(fixture.token, draft.id, clientId('cancel-reserve-key'));

    const reservations = await prisma.reservation.count({
      where: { requesterId: (await prisma.projectBuild.findUniqueOrThrow({ where: { id: fixture.build.id } })).learnerId },
    });
    assert.equal(reservations, 0);
    const linkedAfter = await prisma.projectBuildItem.findUnique({ where: { id: ledItem.id } });
    assert.ok(linkedAfter?.linkedMaterialId);
  });

  test('double confirm unlink executes once', async () => {
    const fixture = await createFixture();
    await searchAndLinkFirstMaterial(fixture.token, fixture.conversationId, 'double-unlink');
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    assert.ok(ledItem);

    const prepared = await sendMessage(fixture.token, fixture.conversationId, 'فك الربط', clientId('double-unlink-prepare'));
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const idempotencyKey = clientId('double-unlink-confirm');
    await confirmAction(fixture.token, confirmation.pendingActionId as string, idempotencyKey);
    await confirmAction(fixture.token, confirmation.pendingActionId as string, idempotencyKey);

    const linked = await prisma.projectBuildItem.findUnique({ where: { id: ledItem.id } });
    assert.equal(linked?.linkedMaterialId, null);
  });
});

describe('build-guide natural link phrasing', () => {
  const firstResultPhrases = [
    'اربط أول مادة',
    'اربط أول وحدة',
    'اربط أول واحدة',
    'اختار الأولى واربطها',
    'اربط الخيار الأول',
    'خلينا نستخدم الأولى',
    'الأولى مناسبة، اربطها',
    'خد أول نتيجة',
    'link the first one',
    'choose the first result',
    'use the first material',
    'link option one',
  ];

  for (const phrase of firstResultPhrases) {
    test(`"${phrase}" prepares first trusted link confirmation without writes`, async () => {
      const fixture = await createFixture();
      await searchForMatches(fixture.token, fixture.conversationId, `phrase-${phrase.length}`);
      const beforeLinks = await prisma.projectBuildItem.count({
        where: { buildId: fixture.build.id, linkedMaterialId: { not: null } },
      });
      assert.equal(beforeLinks, 0);

      const prepared = await sendMessage(
        fixture.token,
        fixture.conversationId,
        phrase,
        clientId(`phrase-${phrase.length}`),
      );
      assert.equal(prepared.response.status, 201);
      const confirmation = confirmationBlock(parseBlocks(prepared.json));
      assert.equal(confirmation.actionType, 'LINK_MATERIAL_TO_BUILD_COMPONENT');
      assert.ok(fixture.ledMaterial);
      const pending = await prisma.aiPendingAction.findUnique({
        where: { id: confirmation.pendingActionId as string },
      });
      const payload = pending?.payload as {
        target?: { materialId?: string; buildItemId?: string };
      };
      assert.equal(payload?.target?.materialId, fixture.ledMaterial.id);

      const afterLinks = await prisma.projectBuildItem.count({
        where: { buildId: fixture.build.id, linkedMaterialId: { not: null } },
      });
      assert.equal(afterLinks, 0);
    });
  }

  test('اربط ثاني وحدة prepares a different result than اربط أول وحدة', async () => {
    const fixture = await createFixture();
    const blocks = await searchForMatches(fixture.token, fixture.conversationId, 'second-unit');
    const matches = blocks.find((block) => block.type === 'component_matches');
    const flatMaterials = (
      (matches?.groups as Array<{
        componentId: string;
        materials: Array<{ materialId: string }>;
      }> | undefined) ?? []
    ).flatMap((group) =>
      group.materials.map((material) => ({
        materialId: material.materialId,
        componentId: group.componentId,
      })),
    );
    assert.ok(flatMaterials.length >= 2);

    const firstPrepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'اربط أول وحدة',
      clientId('second-unit-first'),
    );
    const secondPrepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'اربط ثاني وحدة',
      clientId('second-unit-second'),
    );
    assert.equal(firstPrepared.response.status, 201);
    assert.equal(secondPrepared.response.status, 201);
    const firstPayload = (
      await prisma.aiPendingAction.findUnique({
        where: { id: confirmationBlock(parseBlocks(firstPrepared.json)).pendingActionId as string },
      })
    )?.payload as { target?: { materialId?: string } };
    const secondPayload = (
      await prisma.aiPendingAction.findUnique({
        where: { id: confirmationBlock(parseBlocks(secondPrepared.json)).pendingActionId as string },
      })
    )?.payload as { target?: { materialId?: string } };
    assert.equal(firstPayload?.target?.materialId, flatMaterials[0]?.materialId);
    assert.equal(secondPayload?.target?.materialId, flatMaterials[1]?.materialId);
  });

  test('no trusted results returns precise clarification with zero writes', async () => {
    const fixture = await createFixture();
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'اربط أول وحدة',
      clientId('no-results'),
    );
    assert.equal(prepared.response.status, 201);
    const text = parseBlocks(prepared.json)
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n');
    assert.match(text, /لم أتمكن|could not determine|حدّد/i);
    assert.ok(!parseBlocks(prepared.json).some((block) => block.type === 'action_confirmation'));
    const links = await prisma.projectBuildItem.count({
      where: { buildId: fixture.build.id, linkedMaterialId: { not: null } },
    });
    assert.equal(links, 0);
  });
});

describe('build-guide reservation linkage', () => {
  test('confirming reservation links build item and canonical build returns linkedReservation', async () => {
    const fixture = await createFixture();
    await searchAndLinkFirstMaterial(fixture.token, fixture.conversationId, 'reserve-link');
    const ledItem = fixture.buildItems.find((item) => item.requiredComponent.componentName === 'LED');
    assert.ok(ledItem && fixture.ledMaterial);

    await completeBuildGuideReservation(fixture.token, fixture.conversationId, 'reserve-flow');

    const item = await prisma.projectBuildItem.findUnique({ where: { id: ledItem.id } });
    assert.ok(item?.linkedReservationId);
    assert.equal(item.linkedMaterialId, fixture.ledMaterial.id);

    const build = await getMyBuild(fixture.token, fixture.project.id);
    assert.equal(build.response.status, 200);
    const items = (build.json.data?.items ?? []) as Array<{
      id: string;
      linkedReservation?: { id: string; status: string; statusLabel: string } | null;
      isReadyForBuild?: boolean;
      readinessLabel?: string;
    }>;
    const led = items.find((entry) => entry.id === ledItem.id);
    assert.ok(led?.linkedReservation);
    assert.equal(led.linkedReservation?.status, 'PENDING');
    assert.match(led.linkedReservation?.statusLabel ?? '', /pending|supplier/i);
    assert.equal(led.isReadyForBuild, false);
    assert.match(led.readinessLabel ?? '', /reserve|not ready|Material selected/i);

    const stepProgress = build.json.data?.stepProgress as {
      steps: Array<{ state: string }>;
    };
    assert.equal(stepProgress.steps[0]?.state, 'LOCKED');

    const refetch = await getMyBuild(fixture.token, fixture.project.id);
    const ledAfter = ((refetch.json.data?.items ?? []) as Array<{
      linkedReservation?: { id: string } | null;
    }>).find((entry) => entry.id === ledItem.id);
    assert.equal(ledAfter?.linkedReservation?.id, led.linkedReservation?.id);
  });

  test('duplicate reservation remains prevented after linked reservation exists', async () => {
    const fixture = await createFixture();
    await searchAndLinkFirstMaterial(fixture.token, fixture.conversationId, 'dup-reserve');
    await completeBuildGuideReservation(fixture.token, fixture.conversationId, 'dup-reserve');

    const response = await sendMessage(fixture.token, fixture.conversationId, 'احجزها', clientId('dup-again'));
    assert.equal(response.response.status, 201);
    const text = parseBlocks(response.json)
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n');
    assert.match(text, /حجز نشط|active reservation/i);
    const reservations = await prisma.reservation.count({
      where: {
        requesterId: (await prisma.projectBuild.findUniqueOrThrow({ where: { id: fixture.build.id } })).learnerId,
        materialId: fixture.ledMaterial!.id,
      },
    });
    assert.equal(reservations, 1);
  });
});

function buildStepGuideBlock(blocks: Array<Record<string, unknown>>) {
  const block = blocks.find((entry) => entry.type === 'build_step_guide');
  assert.ok(block, 'expected build_step_guide');
  return block;
}

async function makeFixtureMaterialsReady(fixture: Awaited<ReturnType<typeof createFixture>>) {
  assert.ok(fixture.ledMaterial);
  const learnerId = (
    await prisma.projectBuild.findUniqueOrThrow({ where: { id: fixture.build.id } })
  ).learnerId;

  for (const item of fixture.buildItems) {
    const reservation = await prisma.reservation.create({
      data: {
        materialId: fixture.ledMaterial.id,
        ownerId: fixture.supplier.id,
        requesterId: learnerId,
        quantityRequested: 1,
        fulfillmentMethod: 'PICKUP',
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);
    await prisma.projectBuildItem.update({
      where: { id: item.id },
      data: {
        linkedMaterialId: fixture.ledMaterial.id,
        linkedReservationId: reservation.id,
        linkedMaterialAt: new Date(),
      },
    });
  }
}

async function createTwoStepReadyFixture() {
  const fixture = await createFixture();
  await makeFixtureMaterialsReady(fixture);
  await prisma.projectStep.create({
    data: {
      projectId: fixture.project.id,
      stepNumber: 2,
      title: 'Attach side panel',
      description: 'Attach the side panel firmly.',
      reviewStatus: 'ACCEPTED',
    },
  });
  const project = await prisma.learningProject.findUniqueOrThrow({
    where: { id: fixture.project.id },
    include: { steps: { orderBy: { stepNumber: 'asc' } } },
  });
  return { ...fixture, project };
}

async function createSingleStepReadyFixture() {
  const fixture = await createFixture();
  await makeFixtureMaterialsReady(fixture);
  const project = await prisma.learningProject.findUniqueOrThrow({
    where: { id: fixture.project.id },
    include: { steps: { orderBy: { stepNumber: 'asc' } } },
  });
  return { ...fixture, project };
}

async function completeBuildStepManual(
  token: string,
  projectId: string,
  stepId: string,
) {
  return apiFetch(
    `/api/learning-projects/${projectId}/builds/me/steps/${stepId}/complete`,
    { method: 'POST', token },
  );
}

async function assertConversationIdle(conversationId: string) {
  const conversation = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
    select: { processingState: true },
  });
  assert.equal(conversation?.processingState, 'IDLE');
}

function confirmResultBlock(json: ApiJson) {
  const block = json.data?.block as Record<string, unknown> | undefined;
  assert.ok(block, 'expected confirm result block');
  return block;
}

describe('build-guide step guide and completion', () => {
  test('materials missing + ابدأ معي returns checklist without step guide', async () => {
    const fixture = await createFixture();
    const response = await sendMessage(fixture.token, fixture.conversationId, 'ابدأ معي', clientId('step-missing-begin'));
    assert.equal(response.response.status, 201);
    const blocks = parseBlocks(response.json);
    assert.ok(blocks.some((block) => block.type === 'build_checklist'));
    assert.ok(!blocks.some((block) => block.type === 'build_step_guide'));
    assert.ok(!blocks.some((block) => block.type === 'action_confirmation'));
    const conversation = await prisma.aiConversation.findUnique({
      where: { id: fixture.conversationId },
      select: { processingState: true },
    });
    assert.equal(conversation?.processingState, 'IDLE');
  });

  test('current step guide returns trusted projectStepId', async () => {
    const fixture = await createTwoStepReadyFixture();
    const response = await sendMessage(fixture.token, fixture.conversationId, 'ابدأ معي', clientId('step-begin'));
    assert.equal(response.response.status, 201);
    const guide = buildStepGuideBlock(parseBlocks(response.json));
    const step1 = fixture.project.steps.find((step) => step.stepNumber === 1);
    assert.ok(step1);
    assert.equal(guide.projectStepId, step1.id);
    assert.equal(guide.stepNumber, 1);
    assert.equal(guide.totalSteps, 2);
    assert.equal(guide.title, 'Wire LED');
  });

  test('خلصت الخطوة prepares completion without writing progress', async () => {
    const fixture = await createTwoStepReadyFixture();
    const step1 = fixture.project.steps.find((step) => step.stepNumber === 1);
    assert.ok(step1);
    const before = await prisma.projectBuildStepProgress.count({ where: { buildId: fixture.build.id } });
    const response = await sendMessage(fixture.token, fixture.conversationId, 'خلصت الخطوة', clientId('step-complete-prepare'));
    assert.equal(response.response.status, 201);
    const blocks = parseBlocks(response.json);
    const confirmations = blocks.filter((block) => block.type === 'action_confirmation');
    assert.equal(confirmations.length, 1);
    const confirmation = confirmationBlock(blocks);
    assert.equal(confirmation.type, 'action_confirmation');
    assert.equal(confirmation.actionType, 'COMPLETE_CURRENT_BUILD_STEP');
    assert.ok(typeof confirmation.pendingActionId === 'string' && confirmation.pendingActionId.length > 0);
    assert.equal(confirmation.confirmLabel, 'نعم، أنهيتها');
    assert.equal(confirmation.cancelLabel, 'إلغاء');
    assert.equal((confirmation.target as { type?: string; id?: string }).type, 'BUILD');
    assert.equal((confirmation.target as { type?: string; id?: string }).id, fixture.build.id);
    const pendingActions = await prisma.aiPendingAction.findMany({
      where: {
        conversationId: fixture.conversationId,
        actionType: 'COMPLETE_CURRENT_BUILD_STEP',
        status: 'PENDING',
      },
    });
    assert.equal(pendingActions.length, 1);
    assert.equal(pendingActions[0]?.id, confirmation.pendingActionId);
    const payload = pendingActions[0]?.payload as {
      target?: { buildId?: string; projectStepId?: string };
    };
    assert.equal(payload.target?.buildId, fixture.build.id);
    assert.equal(payload.target?.projectStepId, step1.id);
    const conversation = await prisma.aiConversation.findUnique({
      where: { id: fixture.conversationId },
      select: { processingState: true },
    });
    assert.equal(conversation?.processingState, 'IDLE');
    const after = await prisma.projectBuildStepProgress.count({ where: { buildId: fixture.build.id } });
    assert.equal(after, before);
  });

  test('confirm completes current step and advances progress', async () => {
    const fixture = await createTwoStepReadyFixture();
    const prepared = await sendMessage(fixture.token, fixture.conversationId, 'خلصت', clientId('step-complete-confirm'));
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const confirmResponse = await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      clientId('step-complete-confirm-action'),
    );
    assert.equal(confirmResponse.response.status, 201);

    const build = await getMyBuild(fixture.token, fixture.project.id);
    const stepProgress = build.json.data?.stepProgress as {
      percent: number;
      currentStep: { stepNumber: number; title: string } | null;
      steps: Array<{ stepNumber: number; state: string }>;
    };
    assert.equal(stepProgress.steps[0]?.state, 'COMPLETED');
    assert.equal(stepProgress.steps[1]?.state, 'CURRENT');
    assert.equal(stepProgress.percent, 50);
    assert.equal(stepProgress.currentStep?.stepNumber, 2);
    const progressCount = await prisma.projectBuildStepProgress.count({
      where: { buildId: fixture.build.id },
    });
    assert.equal(progressCount, 1);
    const action = await prisma.aiPendingAction.findUnique({
      where: { id: confirmation.pendingActionId as string },
    });
    assert.equal(action?.status, 'EXECUTED');
  });

  test('double confirm on step completion is idempotent', async () => {
    const fixture = await createTwoStepReadyFixture();
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'خلصت الخطوة',
      clientId('step-double-prepare'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const idempotencyKey = clientId('step-double-confirm');
    const first = await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      idempotencyKey,
    );
    assert.equal(first.response.status, 201);
    const second = await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      idempotencyKey,
    );
    assert.equal(second.response.status, 201);
    const progressCount = await prisma.projectBuildStepProgress.count({
      where: { buildId: fixture.build.id },
    });
    assert.equal(progressCount, 1);
    const build = await getMyBuild(fixture.token, fixture.project.id);
    const stepProgress = build.json.data?.stepProgress as {
      steps: Array<{ stepNumber: number; state: string }>;
    };
    assert.equal(stepProgress.steps[0]?.state, 'COMPLETED');
    assert.equal(stepProgress.steps[1]?.state, 'CURRENT');
    assert.equal(stepProgress.steps[2]?.state, undefined);
  });

  test('وين وصلت returns canonical progress values', async () => {
    const fixture = await createTwoStepReadyFixture();
    const response = await sendMessage(fixture.token, fixture.conversationId, 'وين وصلت؟', clientId('step-progress'));
    assert.equal(response.response.status, 201);
    const text = String(parseBlocks(response.json).find((block) => block.type === 'text')?.text ?? '');
    assert.match(text, /0.*2|٠.*٢/);
    assert.match(text, /Wire LED|الخطوة الحالية/i);
  });

  test('cancel performs zero step writes', async () => {
    const fixture = await createTwoStepReadyFixture();
    const prepared = await sendMessage(fixture.token, fixture.conversationId, 'تمت', clientId('step-cancel-prepare'));
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    await cancelAction(fixture.token, confirmation.pendingActionId as string, clientId('step-cancel'));
    const progressCount = await prisma.projectBuildStepProgress.count({
      where: { buildId: fixture.build.id },
    });
    assert.equal(progressCount, 0);
  });

  test('general conversation does not complete build on خلصت', async () => {
    const learner = await createLearner('general-done');
    const conversation = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token: tokenFor(learner.id),
      body: { mode: 'LEARNER_ASSISTANT', locale: 'ar' },
    });
    assert.equal(conversation.response.status, 201);
    const conversationId = conversation.json.data?.id as string;
    const response = await sendMessage(tokenFor(learner.id), conversationId, 'خلصت', clientId('general-done'));
    assert.equal(response.response.status, 201);
    const blocks = parseBlocks(response.json);
    assert.ok(!blocks.some((block) => block.type === 'action_confirmation' && block.actionType === 'COMPLETE_CURRENT_BUILD_STEP'));
  });

  test('final step prepare performs zero writes and keeps build in progress', async () => {
    const fixture = await createSingleStepReadyFixture();
    const onlyStep = fixture.project.steps[0];
    assert.ok(onlyStep);
    const before = await prisma.projectBuildStepProgress.count({ where: { buildId: fixture.build.id } });
    const response = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'خلصت الخطوة',
      clientId('final-step-prepare'),
    );
    assert.equal(response.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(response.json));
    assert.equal(confirmation.actionType, 'COMPLETE_CURRENT_BUILD_STEP');
    const payload = (
      await prisma.aiPendingAction.findFirstOrThrow({
        where: { id: confirmation.pendingActionId as string },
      })
    ).payload as { target?: { buildId?: string; projectStepId?: string } };
    assert.equal(payload.target?.buildId, fixture.build.id);
    assert.equal(payload.target?.projectStepId, onlyStep.id);
    const buildRow = await prisma.projectBuild.findUniqueOrThrow({ where: { id: fixture.build.id } });
    assert.equal(buildRow.status, 'IN_PROGRESS');
    const after = await prisma.projectBuildStepProgress.count({ where: { buildId: fixture.build.id } });
    assert.equal(after, before);
    await assertConversationIdle(fixture.conversationId);
  });

  test('final step confirm completes build at 100 percent', async () => {
    const fixture = await createSingleStepReadyFixture();
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'خلصت الخطوة',
      clientId('final-step-confirm-prepare'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const confirmResponse = await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      clientId('final-step-confirm'),
    );
    assert.equal(confirmResponse.response.status, 201);
    const result = confirmResultBlock(confirmResponse.json);
    assert.equal(result.type, 'action_result');
    assert.equal(result.actionType, 'COMPLETE_CURRENT_BUILD_STEP');
    assert.equal(result.status, 'EXECUTED');

    const build = await getMyBuild(fixture.token, fixture.project.id);
    assert.equal(build.response.status, 200);
    const data = build.json.data as {
      status?: string;
      stepProgress?: {
        percent: number;
        currentStep: unknown;
        steps: Array<{ state: string }>;
      };
    };
    assert.equal(data.status, 'COMPLETED');
    assert.equal(data.stepProgress?.percent, 100);
    assert.equal(data.stepProgress?.currentStep, null);
    assert.equal(data.stepProgress?.steps[0]?.state, 'COMPLETED');
    const progressCount = await prisma.projectBuildStepProgress.count({
      where: { buildId: fixture.build.id },
    });
    assert.equal(progressCount, 1);
    const action = await prisma.aiPendingAction.findUnique({
      where: { id: confirmation.pendingActionId as string },
    });
    assert.equal(action?.status, 'EXECUTED');

    const followUp = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'خلصت',
      clientId('final-step-no-second-action'),
    );
    assert.equal(followUp.response.status, 201);
    const followUpBlocks = parseBlocks(followUp.json);
    assert.ok(
      !followUpBlocks.some(
        (block) =>
          block.type === 'action_confirmation' &&
          block.actionType === 'COMPLETE_CURRENT_BUILD_STEP',
      ),
    );
    await assertConversationIdle(fixture.conversationId);
  });

  test('repeat confirm on final step is idempotent', async () => {
    const fixture = await createSingleStepReadyFixture();
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'خلصت الخطوة',
      clientId('final-step-double-prepare'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const idempotencyKey = clientId('final-step-double-confirm');
    const first = await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      idempotencyKey,
    );
    assert.equal(first.response.status, 201);
    const second = await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      idempotencyKey,
    );
    assert.equal(second.response.status, 201);
    assert.equal(
      await prisma.projectBuildStepProgress.count({ where: { buildId: fixture.build.id } }),
      1,
    );
    const buildRow = await prisma.projectBuild.findUniqueOrThrow({ where: { id: fixture.build.id } });
    assert.equal(buildRow.status, 'COMPLETED');
  });

  test('stale confirm after manual step completion fails safely', async () => {
    const fixture = await createTwoStepReadyFixture();
    const step1 = fixture.project.steps.find((step) => step.stepNumber === 1);
    const step2 = fixture.project.steps.find((step) => step.stepNumber === 2);
    assert.ok(step1 && step2);
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'خلصت الخطوة',
      clientId('stale-prepare'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const manual = await completeBuildStepManual(fixture.token, fixture.project.id, step1.id);
    assert.equal(manual.response.status, 200);

    const buildAfterManual = await getMyBuild(fixture.token, fixture.project.id);
    const manualProgress = buildAfterManual.json.data?.stepProgress as {
      steps: Array<{ stepNumber: number; state: string }>;
      currentStep: { stepNumber: number } | null;
    };
    assert.equal(manualProgress.steps[0]?.state, 'COMPLETED');
    assert.equal(manualProgress.steps[1]?.state, 'CURRENT');
    assert.equal(manualProgress.currentStep?.stepNumber, 2);

    const staleConfirm = await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      clientId('stale-confirm'),
    );
    assert.equal(staleConfirm.response.status, 201);
    const staleResult = confirmResultBlock(staleConfirm.json);
    assert.equal(staleResult.status, 'FAILED');

    const progressCount = await prisma.projectBuildStepProgress.count({
      where: { buildId: fixture.build.id },
    });
    assert.equal(progressCount, 1);
    const buildAfterStale = await getMyBuild(fixture.token, fixture.project.id);
    const staleProgress = buildAfterStale.json.data?.stepProgress as {
      steps: Array<{ stepNumber: number; state: string }>;
    };
    assert.equal(staleProgress.steps[0]?.state, 'COMPLETED');
    assert.equal(staleProgress.steps[1]?.state, 'CURRENT');
    await assertConversationIdle(fixture.conversationId);
  });

  test('completed build follow-up messages stay read-only', async () => {
    const fixture = await createSingleStepReadyFixture();
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'خلصت الخطوة',
      clientId('completed-followup-prepare'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      clientId('completed-followup-confirm'),
    );

    for (const [index, text] of [
      'كملني من وين وقفت',
      'شو الخطوة الحالية؟',
      'خلصت',
      'روح عالخطوة التالية',
    ].entries()) {
      const response = await sendMessage(
        fixture.token,
        fixture.conversationId,
        text,
        clientId(`completed-followup-${index}`),
      );
      assert.equal(response.response.status, 201);
      const blocks = parseBlocks(response.json);
      assert.ok(
        !blocks.some(
          (block) =>
            block.type === 'action_confirmation' &&
            block.actionType === 'COMPLETE_CURRENT_BUILD_STEP',
        ),
      );
      assert.ok(!blocks.some((block) => block.type === 'build_step_guide'));
      await assertConversationIdle(fixture.conversationId);
    }

    const progressCount = await prisma.projectBuildStepProgress.count({
      where: { buildId: fixture.build.id },
    });
    assert.equal(progressCount, 1);
  });

  test('archived build rejects step completion from chat', async () => {
    const fixture = await createSingleStepReadyFixture();
    await prisma.projectBuild.update({
      where: { id: fixture.build.id },
      data: { status: 'ARCHIVED' },
    });
    const response = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'خلصت الخطوة',
      clientId('archived-complete'),
    );
    assert.equal(response.response.status, 201);
    const blocks = parseBlocks(response.json);
    assert.ok(!blocks.some((block) => block.type === 'action_confirmation'));
    const progressCount = await prisma.projectBuildStepProgress.count({
      where: { buildId: fixture.build.id },
    });
    assert.equal(progressCount, 0);
    await assertConversationIdle(fixture.conversationId);
  });
});
