import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'ai-actions-http-closure-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'ai-actions-http-closure-refresh-secret';
process.env.AI_CHAT_PROVIDER = 'mock';
process.env.AI_CHAT_RATE_LIMIT_PER_USER = '60';
process.env.AI_CHAT_MAX_CONVERSATIONS_PER_HOUR = '60';

const TEST_MARKER = '[test-ai-actions-http-closure]';
const SEED_TOKEN = 'actionhttpseed';
const clientId = (suffix: string) =>
  `client-actions-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.slice(
    0,
    64,
  );

type ApiJson = {
  success?: boolean;
  data?: Record<string, unknown> & {
    id?: string;
    block?: Record<string, unknown>;
    contentBlocks?: Array<Record<string, unknown>>;
  };
  error?: { code?: string };
};

type SeedIds = {
  users: string[];
  locations: string[];
  materials: string[];
  projects: string[];
  builds: string[];
  learnerAId: string;
  learnerBId: string;
  supplierId: string;
  materialCategoryId: string;
  projectCategoryId: string;
  createdCategoryIds: string[];
  availableMaterialId: string;
  reservableMaterialId: string;
  lowQuantityMaterialId: string;
  incompatibleMaterialId: string;
  publishedProjectId: string;
  secondPublishedProjectId: string;
  buildId: string;
  buildItemId: string;
};

const ids: SeedIds = {
  users: [],
  locations: [],
  materials: [],
  projects: [],
  builds: [],
  learnerAId: '',
  learnerBId: '',
  supplierId: '',
  materialCategoryId: '',
  projectCategoryId: '',
  createdCategoryIds: [],
  availableMaterialId: '',
  reservableMaterialId: '',
  lowQuantityMaterialId: '',
  incompatibleMaterialId: '',
  publishedProjectId: '',
  secondPublishedProjectId: '',
  buildId: '',
  buildItemId: '',
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
let aiContentBlocksSchema: typeof import('../ai.content-blocks.js').aiContentBlocksSchema;
let likeMaterialById: typeof import('../../materials/materials.service.js').likeMaterialById;
let saveLearningProjectById: typeof import('../../learning-projects/learning-projects.service.js').saveLearningProjectById;
let startProjectBuildById: typeof import('../../learning-projects/learning-projects.service.js').startProjectBuildById;
let updateProjectBuildItemById: typeof import('../../learning-projects/learning-projects.service.js').updateProjectBuildItemById;
let linkBuildItemMaterialById: typeof import('../../learning-projects/learning-projects.service.js').linkBuildItemMaterialById;

async function createLearnerUser(label: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${label}`,
      email: `${TEST_MARKER}-${label}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: {
        create: {
          learnerType: 'STUDENT',
          skillLevel: 'BEGINNER',
          interests: ['arduino'],
        },
      },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createSupplierUser() {
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
          publicName: `${TEST_MARKER} Public Supplier`,
          verificationStatus: 'APPROVED',
        },
      },
    },
  });
  ids.users.push(user.id);
  ids.supplierId = user.id;
  return user;
}

async function createMaterial(input: {
  locationId: string;
  title: string;
  status?: 'AVAILABLE' | 'UNAVAILABLE';
  quantity?: number;
  pickupAllowed?: boolean;
  deliveryAllowed?: boolean;
  isFree?: boolean;
}) {
  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: ids.supplierId },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: ids.supplierId,
      supplierProfileId: supplierProfile?.id,
      categoryId: ids.materialCategoryId,
      locationId: input.locationId,
      title: input.title,
      description: `${TEST_MARKER} seeded material`,
      materialType: 'LED',
      quantity: input.quantity ?? 5,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: input.status ?? 'AVAILABLE',
      isFree: input.isFree ?? true,
      pickupAllowed: input.pickupAllowed ?? true,
      deliveryAllowed: input.deliveryAllowed ?? false,
    },
  });
  ids.materials.push(material.id);
  return material;
}

function tokenFor(userId: string) {
  return signAccessToken({ sub: userId, roles: ['LEARNER'] });
}

async function apiFetch(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = (await response.json()) as ApiJson;
  return { response, json };
}

async function createConversation(token: string) {
  const created = await apiFetch('/api/ai/v1/conversations', {
    method: 'POST',
    token,
    body: { mode: 'GENERAL_LEARNING', locale: 'ar' },
  });
  assert.equal(created.response.status, 201);
  return created.json.data?.id as string;
}

async function sendMessage(
  token: string,
  conversationId: string,
  text: string,
  messageClientId: string,
) {
  return apiFetch(`/api/ai/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    token,
    body: { text, locale: 'ar', clientMessageId: messageClientId },
  });
}

async function confirmAction(
  token: string,
  pendingActionId: string,
  idempotencyKey: string,
) {
  return apiFetch(`/api/ai/v1/actions/${pendingActionId}/confirm`, {
    method: 'POST',
    token,
    body: { idempotencyKey, locale: 'ar' },
  });
}

async function cancelAction(token: string, pendingActionId: string) {
  return apiFetch(`/api/ai/v1/actions/${pendingActionId}/cancel`, {
    method: 'POST',
    token,
  });
}

function parseBlocks(json: ApiJson) {
  const blocks = json.data?.contentBlocks as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(blocks));
  aiContentBlocksSchema.parse(blocks);
  return blocks;
}

function confirmationBlock(blocks: Array<Record<string, unknown>>) {
  const block = blocks.find((item) => item.type === 'action_confirmation');
  assert.ok(block, 'expected action_confirmation');
  return block;
}

async function seedMaterialResultsAndPrepareSave(token: string, userId: string) {
  const conversationId = await createConversation(token);
  const search = await sendMessage(
    token,
    conversationId,
    'اعرضلي مواد إلكترونيات متوفرة',
    clientId('search-save'),
  );
  assert.equal(search.response.status, 201);
  const searchBlocks = parseBlocks(search.json);
  assert.ok(
    searchBlocks.some((block) => block.type === 'material_results'),
    'material search must return results before save prepare',
  );
  const beforeLikes = await prisma.materialLike.count({ where: { userId } });
  const prepared = await sendMessage(
    token,
    conversationId,
    'احفظلي أول مادة',
    clientId('prepare-save'),
  );
  assert.equal(prepared.response.status, 201);
  const blocks = parseBlocks(prepared.json);
  const confirmation = confirmationBlock(blocks);
  const pendingActionId = confirmation.pendingActionId as string;
  assert.ok(pendingActionId);
  const afterPrepareLikes = await prisma.materialLike.count({ where: { userId } });
  assert.equal(afterPrepareLikes, beforeLikes);
  return { conversationId, pendingActionId, confirmation };
}

function futurePickupWindow(hoursFromNow = 72) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

before(async () => {
  const prismaModule = await import('../../../database/prisma.js');
  prisma = prismaModule.prisma;
  ({ signAccessToken } = await import('../../../utils/jwt.js'));
  ({ hashPassword } = await import('../../../utils/password.js'));
  ({ resetRateLimitersForTests } = await import(
    '../../../middlewares/rate-limit.middleware.js'
  ));
  ({ deleteAiDataForUsers } = await import('../ai.repository.js'));
  ({ setAiChatProviderForTests } = await import(
    '../providers/ai-chat-provider.factory.js'
  ));
  ({ MockAiChatProvider: MockAiChatProviderClass } = await import(
    '../providers/mock-chat.provider.js'
  ));
  ({ aiContentBlocksSchema } = await import('../ai.content-blocks.js'));
  ({
    saveLearningProjectById,
    startProjectBuildById,
    updateProjectBuildItemById,
    linkBuildItemMaterialById,
  } = await import('../../learning-projects/learning-projects.service.js'));
  ({ likeMaterialById } = await import('../../materials/materials.service.js'));

  const { app } = await import('../../../app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server!.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
  resetRateLimitersForTests();
  setAiChatProviderForTests(new MockAiChatProviderClass());

  const { getCategories } = await import('../../categories/categories.service.js');
  const discoveryCategories = await getCategories({
    type: 'MATERIAL',
    rootOnly: true,
    discoveryOnly: true,
  });
  const materialCategory =
    discoveryCategories.find((category) =>
      category.nameEn.toLowerCase().includes('electronics'),
    ) ??
    (await prisma.category.create({
      data: {
        nameEn: 'Electronics',
        nameAr: 'إلكترونيات',
        categoryType: 'BOTH',
        isActive: true,
      },
    }));
  ids.materialCategoryId = materialCategory.id;

  const projectCategory = await prisma.category.create({
    data: {
      nameEn: `Actions Robotics ${SEED_TOKEN}`,
      nameAr: `روبوتات ${SEED_TOKEN}`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.projectCategoryId = projectCategory.id;
  ids.createdCategoryIds.push(projectCategory.id);

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

  const learnerA = await createLearnerUser('learner-a');
  const learnerB = await createLearnerUser('learner-b');
  ids.learnerAId = learnerA.id;
  ids.learnerBId = learnerB.id;
  await createSupplierUser();

  const available = await createMaterial({
    locationId: location.id,
    title: `${SEED_TOKEN} available led`,
  });
  const reservable = await createMaterial({
    locationId: location.id,
    title: `${SEED_TOKEN} reservable led`,
    quantity: 5,
  });
  const lowQuantity = await createMaterial({
    locationId: location.id,
    title: `${SEED_TOKEN} low quantity led`,
    quantity: 1,
  });
  const incompatible = await createMaterial({
    locationId: location.id,
    title: `${SEED_TOKEN} incompatible led`,
    status: 'UNAVAILABLE',
  });
  ids.availableMaterialId = available.id;
  ids.reservableMaterialId = reservable.id;
  ids.lowQuantityMaterialId = lowQuantity.id;
  ids.incompatibleMaterialId = incompatible.id;

  const published = await prisma.learningProject.create({
    data: {
      categoryId: ids.projectCategoryId,
      createdBy: ids.learnerAId,
      title: `${SEED_TOKEN} Robot Car`,
      shortDescription: `${TEST_MARKER} starter`,
      description: `${TEST_MARKER} published project`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      tags: { create: [{ tag: 'arduino' }] },
      requiredComponents: {
        create: [
          {
            componentName: 'LED',
            materialType: 'LED',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: ids.materialCategoryId,
            searchKeywords: ['led'],
          },
        ],
      },
    },
  });
  ids.publishedProjectId = published.id;
  ids.projects.push(published.id);

  const secondPublished = await prisma.learningProject.create({
    data: {
      categoryId: ids.projectCategoryId,
      createdBy: ids.learnerAId,
      title: `${SEED_TOKEN} Line Follower`,
      shortDescription: `${TEST_MARKER} second project`,
      description: `${TEST_MARKER} second published project`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      tags: { create: [{ tag: 'arduino' }] },
    },
  });
  ids.secondPublishedProjectId = secondPublished.id;
  ids.projects.push(secondPublished.id);

  await saveLearningProjectById(published.id, ids.learnerAId);

  const build = await startProjectBuildById(published.id, ids.learnerAId);
  ids.buildId = build.id;
  ids.builds.push(build.id);
  const item = build.items[0];
  assert.ok(item);
  ids.buildItemId = item.id;
  await updateProjectBuildItemById(published.id, ids.learnerAId, item.id, {
    status: 'MISSING',
    learnerNote: null,
  });

  const { getMaterials } = await import('../../materials/materials.service.js');
  const seedCheck = await getMaterials(
    {
      page: 1,
      limit: 20,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'newest',
      q: SEED_TOKEN,
    },
    { sub: ids.learnerAId, roles: ['LEARNER'] },
  );
  assert.ok(seedCheck.items.length >= 3, 'seed materials must be discoverable');
});

after(async () => {
  setAiChatProviderForTests(null);
  resetRateLimitersForTests();
  await new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });
  server = null;
  await deleteAiDataForUsers(ids.users);
  if (ids.builds.length > 0) {
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  }
  if (ids.projects.length > 0) {
    await prisma.projectSave.deleteMany({ where: { projectId: { in: ids.projects } } });
    await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
  }
  if (ids.materials.length > 0) {
    await prisma.reservation.deleteMany({ where: { materialId: { in: ids.materials } } });
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
  }
  if (ids.locations.length > 0) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  }
  if (ids.createdCategoryIds.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.createdCategoryIds } } });
  }
  if (ids.users.length > 0) {
    await prisma.learnerProfile.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.supplierProfile.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('ai actions http closure', () => {
  test('prepare SAVE_MATERIAL returns confirmation without write', async () => {
    const token = tokenFor(ids.learnerBId);
    const { pendingActionId } = await seedMaterialResultsAndPrepareSave(
      token,
      ids.learnerBId,
    );
    const action = await prisma.aiPendingAction.findUnique({
      where: { id: pendingActionId },
    });
    assert.equal(action?.status, 'PENDING');
    assert.equal(action?.userId, ids.learnerBId);
  });

  test('confirm SAVE_MATERIAL writes once and returns action_result', async () => {
    const token = tokenFor(ids.learnerBId);
    const { pendingActionId } = await seedMaterialResultsAndPrepareSave(
      token,
      ids.learnerBId,
    );
    const confirmed = await confirmAction(token, pendingActionId, 'confirm-save-1');
    assert.equal(confirmed.response.status, 201);
    assert.equal(confirmed.json.data?.block?.type, 'action_result');
    assert.equal(confirmed.json.data?.block?.status, 'EXECUTED');
    const likes = await prisma.materialLike.count({ where: { userId: ids.learnerBId } });
    assert.equal(likes, 1);
    const action = await prisma.aiPendingAction.findUnique({
      where: { id: pendingActionId },
    });
    assert.equal(action?.status, 'EXECUTED');
  });

  test('reconfirm executed SAVE_MATERIAL is idempotent', async () => {
    const token = tokenFor(ids.learnerBId);
    const { pendingActionId } = await seedMaterialResultsAndPrepareSave(
      token,
      ids.learnerBId,
    );
    await confirmAction(token, pendingActionId, 'confirm-save-a');
    const second = await confirmAction(token, pendingActionId, 'confirm-save-b');
    assert.equal(second.response.status, 201);
    const likes = await prisma.materialLike.count({ where: { userId: ids.learnerBId } });
    assert.equal(likes, 1);
  });

  test('cancel pending action prevents execution', async () => {
    const token = tokenFor(ids.learnerBId);
    const { pendingActionId } = await seedMaterialResultsAndPrepareSave(
      token,
      ids.learnerBId,
    );
    const cancelled = await cancelAction(token, pendingActionId);
    assert.equal(cancelled.response.status, 200);
    const beforeLikes = await prisma.materialLike.count({ where: { userId: ids.learnerBId } });
    const confirm = await confirmAction(token, pendingActionId, 'confirm-after-cancel');
    assert.equal(confirm.response.status, 409);
    assert.equal(confirm.json.error?.code, 'AI_ACTION_CANCELLED');
    const afterLikes = await prisma.materialLike.count({ where: { userId: ids.learnerBId } });
    assert.equal(afterLikes, beforeLikes);
  });

  test('cross-user confirm is blocked', async () => {
    const tokenA = tokenFor(ids.learnerAId);
    const { pendingActionId } = await seedMaterialResultsAndPrepareSave(
      tokenA,
      ids.learnerAId,
    );
    const tokenB = tokenFor(ids.learnerBId);
    const confirm = await confirmAction(tokenB, pendingActionId, 'cross-user');
    assert.equal(confirm.response.status, 404);
    assert.equal(confirm.json.error?.code, 'AI_ACTION_NOT_FOUND');
  });

  test('expired action cannot execute', async () => {
    const token = tokenFor(ids.learnerBId);
    const { pendingActionId } = await seedMaterialResultsAndPrepareSave(
      token,
      ids.learnerBId,
    );
    await prisma.aiPendingAction.update({
      where: { id: pendingActionId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const confirm = await confirmAction(token, pendingActionId, 'expired-action-key');
    assert.equal(confirm.response.status, 409);
    assert.equal(confirm.json.error?.code, 'AI_ACTION_EXPIRED');
  });

  test('UNSAVE_MATERIAL executes after confirmation', async () => {
    const token = tokenFor(ids.learnerAId);
    const conversationId = await createConversation(token);
    await sendMessage(
      token,
      conversationId,
      'اعرضلي مواد إلكترونيات متوفرة',
      clientId('unsave-search'),
    );
    const savePrepared = await sendMessage(
      token,
      conversationId,
      'احفظلي أول مادة',
      clientId('unsave-save'),
    );
    const saveConfirmation = confirmationBlock(parseBlocks(savePrepared.json));
    await confirmAction(
      token,
      saveConfirmation.pendingActionId as string,
      'confirm-before-unsave',
    );
    const prepared = await sendMessage(
      token,
      conversationId,
      'الغي حفظ أول مادة',
      clientId('unsave-prepare'),
    );
    assert.equal(prepared.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const confirmed = await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-unsave',
    );
    assert.equal(confirmed.response.status, 201);
    const likes = await prisma.materialLike.count({
      where: { userId: ids.learnerAId },
    });
    assert.equal(likes, 0);
  });

  test('SAVE_PROJECT and UNSAVE_PROJECT', async () => {
    const token = tokenFor(ids.learnerBId);
    const conversationId = await createConversation(token);
    await sendMessage(
      token,
      conversationId,
      'اعرضلي مشاريع Arduino',
      clientId('project-search'),
    );
    const prepared = await sendMessage(
      token,
      conversationId,
      'احفظلي أول مشروع',
      clientId('project-save'),
    );
    assert.equal(prepared.response.status, 201);
    const saveConfirmation = confirmationBlock(parseBlocks(prepared.json));
    await confirmAction(
      token,
      saveConfirmation.pendingActionId as string,
      'confirm-project-save',
    );
    const saves = await prisma.projectSave.count({
      where: { userId: ids.learnerBId },
    });
    assert.equal(saves, 1);

    await sendMessage(
      token,
      conversationId,
      'الغي حفظ أول مشروع',
      clientId('project-unsave'),
    );
    const unsavePrepared = await sendMessage(
      token,
      conversationId,
      'الغي حفظ أول مشروع',
      clientId('project-unsave-2'),
    );
    assert.equal(unsavePrepared.response.status, 201);
    const unsaveConfirmation = confirmationBlock(parseBlocks(unsavePrepared.json));
    await confirmAction(
      token,
      unsaveConfirmation.pendingActionId as string,
      'confirm-project-unsave',
    );
    const savesAfter = await prisma.projectSave.count({
      where: { userId: ids.learnerBId },
    });
    assert.equal(savesAfter, 0);
  });

  test('START_PROJECT_BUILD creates exactly one build', async () => {
    const token = tokenFor(ids.learnerBId);
    const conversationId = await createConversation(token);
    await sendMessage(
      token,
      conversationId,
      `اعرضلي مشاريع ${SEED_TOKEN}`,
      clientId('build-search'),
    );
    const before = await prisma.projectBuild.count({ where: { learnerId: ids.learnerBId } });
    assert.equal(before, 0);
    const prepared = await sendMessage(
      token,
      conversationId,
      'ابدألي أول مشروع',
      clientId('build-start'),
    );
    assert.equal(prepared.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-build',
    );
    const after = await prisma.projectBuild.count({ where: { learnerId: ids.learnerBId } });
    assert.equal(after, 1);
    const again = await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-build-again',
    );
    assert.equal(again.response.status, 201);
    const still = await prisma.projectBuild.count({ where: { learnerId: ids.learnerBId } });
    assert.equal(still, 1);
  });

  test('LINK_MATERIAL_TO_BUILD_COMPONENT links once after confirm', async () => {
    const token = tokenFor(ids.learnerAId);
    const conversationId = await createConversation(token);
    await sendMessage(
      token,
      conversationId,
      `اعرضلي مواد ${SEED_TOKEN}`,
      clientId('link-search'),
    );
    const prepared = await sendMessage(
      token,
      conversationId,
      'اربط أول مادة بالمكون الناقص',
      clientId('link-prepare'),
    );
    assert.equal(prepared.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    assert.match(String(confirmation.summary ?? ''), /(المادة:|Material:)/);
    assert.match(String(confirmation.summary ?? ''), /(المكوّن:|Component:)/);
    assert.match(String(confirmation.summary ?? ''), /(المشروع:|Project:)/);
    const before = await prisma.projectBuildItem.findUnique({
      where: { id: ids.buildItemId },
      select: { linkedMaterialId: true },
    });
    assert.equal(before?.linkedMaterialId, null);
    await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-link',
    );
    const after = await prisma.projectBuildItem.findUnique({
      where: { id: ids.buildItemId },
      select: { linkedMaterialId: true },
    });
    assert.ok(after?.linkedMaterialId);
  });

  test('incompatible link returns typed failure without link write', async () => {
    const token = tokenFor(ids.learnerAId);
    await prisma.projectBuildItem.update({
      where: { id: ids.buildItemId },
      data: { linkedMaterialId: null },
    });
    const conversationId = await createConversation(token);
    await prisma.material.update({
      where: { id: ids.reservableMaterialId },
      data: { status: 'AVAILABLE' },
    });
    await sendMessage(
      token,
      conversationId,
      `اعرضلي مواد ${SEED_TOKEN}`,
      clientId('bad-link-search'),
    );
    const prepared = await sendMessage(
      token,
      conversationId,
      'اربط أول مادة بالمكون الناقص',
      clientId('bad-link-prepare'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const payload = await prisma.aiPendingAction.findUnique({
      where: { id: confirmation.pendingActionId as string },
    });
    const parsedPayload = payload?.payload as { target?: { materialId?: string } };
    const materialId = parsedPayload?.target?.materialId;
    assert.ok(materialId);
    await prisma.material.update({
      where: { id: materialId },
      data: { status: 'UNAVAILABLE' },
    });
    const confirm = await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-bad-link',
    );
    assert.notEqual(confirm.response.status, 201);
    const failedAction = await prisma.aiPendingAction.findUnique({
      where: { id: confirmation.pendingActionId as string },
    });
    assert.ok(
      [400, 409, 422, 502].includes(confirm.response.status) ||
        failedAction?.status === 'FAILED',
    );
    assert.ok(
      ['MATERIAL_NOT_AVAILABLE', 'NOT_FOUND', 'AI_ACTION_CONFLICT', 'CONFLICT'].includes(
        confirm.json.error?.code ?? '',
      ),
    );
    const item = await prisma.projectBuildItem.findUnique({
      where: { id: ids.buildItemId },
      select: { linkedMaterialId: true },
    });
    assert.equal(item?.linkedMaterialId, null);
  });

  test('UNLINK action removes an existing link', async () => {
    const token = tokenFor(ids.learnerAId);
    await linkBuildItemMaterialById(
      ids.publishedProjectId,
      ids.learnerAId,
      ids.buildItemId,
      ids.reservableMaterialId,
    );
    const linkedBefore = await prisma.projectBuildItem.findUnique({
      where: { id: ids.buildItemId },
      select: { linkedMaterialId: true },
    });
    assert.ok(linkedBefore?.linkedMaterialId);
    const conversationId = await createConversation(token);
    await sendMessage(token, conversationId, 'شو ناقصني؟', clientId('unlink-gap'));
    const prepared = await sendMessage(
      token,
      conversationId,
      'unlink material from component',
      clientId('unlink-prepare'),
    );
    assert.equal(prepared.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-unlink',
    );
    const item = await prisma.projectBuildItem.findUnique({
      where: { id: ids.buildItemId },
      select: { linkedMaterialId: true },
    });
    assert.equal(item?.linkedMaterialId, null);
  });

  test('reservation preparation creates no reservation rows', async () => {
    const token = tokenFor(ids.learnerBId);
    const conversationId = await createConversation(token);
    await sendMessage(
      token,
      conversationId,
      `اعرضلي مواد ${SEED_TOKEN}`,
      clientId('reserve-search'),
    );
    const before = await prisma.reservation.count({
      where: { learnerId: ids.learnerBId },
    });
    const prepared = await sendMessage(
      token,
      conversationId,
      'احجزلي أول مادة',
      clientId('reserve-missing'),
    );
    assert.equal(prepared.response.status, 201);
    const blocks = parseBlocks(prepared.json);
    assert.equal(
      blocks.some((block) => block.type === 'action_confirmation'),
      false,
    );
    const after = await prisma.reservation.count({
      where: { learnerId: ids.learnerBId },
    });
    assert.equal(after, before);
  });

  test('reservation multi-turn continuation accepts numeric quantity reply', async () => {
    const token = tokenFor(ids.learnerAId);
    const conversationId = await createConversation(token);
    await sendMessage(
      token,
      conversationId,
      'اعرضلي مواد إلكترونيات متوفرة',
      clientId('reserve-mt-search'),
    );
    const step1 = await sendMessage(
      token,
      conversationId,
      'احجزلي أول مادة',
      clientId('reserve-mt-step1'),
    );
    assert.equal(step1.response.status, 201);
    const blocks1 = parseBlocks(step1.json);
    const clarify1 = blocks1.find((block) => block.type === 'text');
    assert.match(String(clarify1?.text ?? ''), /كمية|quantity/i);

    const draftCount = await prisma.aiPendingAction.count({
      where: {
        conversationId,
        actionType: 'PREPARE_MATERIAL_RESERVATION',
        status: 'PENDING',
      },
    });
    assert.equal(draftCount, 1);

    const reservationsBefore = await prisma.reservation.count({
      where: { requesterId: ids.learnerAId },
    });

    const step2 = await sendMessage(token, conversationId, '1', clientId('reserve-mt-step2'));
    assert.equal(step2.response.status, 201);
    const blocks2 = parseBlocks(step2.json);
    const clarify2 = blocks2.find((block) => block.type === 'text');
    assert.match(String(clarify2?.text ?? ''), /استلام|توصيل|pickup|delivery/i);

    const window = futurePickupWindow(72);
    const step3 = await sendMessage(
      token,
      conversationId,
      `استلام من ${window.start} إلى ${window.end}`,
      clientId('reserve-mt-step3'),
    );
    assert.equal(step3.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(step3.json));
    assert.equal(
      await prisma.reservation.count({ where: { requesterId: ids.learnerAId } }),
      reservationsBefore,
    );

    await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-reservation-mt',
    );
    const reservationsAfter = await prisma.reservation.count({
      where: { requesterId: ids.learnerAId },
    });
    assert.equal(reservationsAfter, reservationsBefore + 1);

    await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-reservation-mt-again',
    );
    const reservationsFinal = await prisma.reservation.count({
      where: { requesterId: ids.learnerAId },
    });
    assert.equal(reservationsFinal, reservationsAfter);
  });

  test('valid reservation confirmation creates one reservation', async () => {
    const token = tokenFor(ids.learnerBId);
    const conversationId = await createConversation(token);
    await sendMessage(
      token,
      conversationId,
      `اعرضلي مواد ${SEED_TOKEN}`,
      clientId('reserve2-search'),
    );
    const window = futurePickupWindow();
    const prepared = await sendMessage(
      token,
      conversationId,
      `احجزلي أول مادة كمية 1 استلام من ${window.start} إلى ${window.end}`,
      clientId('reserve2-prepare'),
    );
    assert.equal(prepared.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const before = await prisma.reservation.count({
      where: { learnerId: ids.learnerBId },
    });
    const confirmed = await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-reservation',
    );
    assert.equal(confirmed.response.status, 201);
    const after = await prisma.reservation.count({
      where: { learnerId: ids.learnerBId },
    });
    assert.equal(after, before + 1);
  });

  test('reconfirm reservation does not duplicate', async () => {
    const token = tokenFor(ids.learnerBId);
    const conversationId = await createConversation(token);
    await sendMessage(
      token,
      conversationId,
      `اعرضلي مواد ${SEED_TOKEN}`,
      clientId('reserve3-search'),
    );
    const window = futurePickupWindow(96);
    const prepared = await sendMessage(
      token,
      conversationId,
      `احجزلي أول مادة كمية 1 استلام من ${window.start} إلى ${window.end}`,
      clientId('reserve3-prepare'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-reservation-a',
    );
    const countAfterFirst = await prisma.reservation.count({
      where: { learnerId: ids.learnerBId },
    });
    await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-reservation-b',
    );
    const countAfterSecond = await prisma.reservation.count({
      where: { learnerId: ids.learnerBId },
    });
    assert.equal(countAfterFirst, countAfterSecond);
  });

  test('material unavailable at confirm fails safely', async () => {
    const token = tokenFor(ids.learnerBId);
    const conversationId = await createConversation(token);
    await sendMessage(
      token,
      conversationId,
      `اعرضلي مواد ${SEED_TOKEN}`,
      clientId('reserve4-search'),
    );
    const window = futurePickupWindow(120);
    const prepared = await sendMessage(
      token,
      conversationId,
      `احجزلي أول مادة كمية 1 استلام من ${window.start} إلى ${window.end}`,
      clientId('reserve4-prepare'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const payload = await prisma.aiPendingAction.findUnique({
      where: { id: confirmation.pendingActionId as string },
    });
    const parsedPayload = payload?.payload as { target?: { materialId?: string } };
    const materialId = parsedPayload?.target?.materialId;
    assert.ok(materialId);
    await prisma.material.update({
      where: { id: materialId },
      data: { status: 'UNAVAILABLE' },
    });
    const confirm = await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-unavailable',
    );
    assert.equal(confirm.response.status, 409);
    assert.equal(confirm.json.error?.code, 'MATERIAL_NOT_AVAILABLE');
  });

  test('insufficient quantity fails safely', async () => {
    const token = tokenFor(ids.learnerBId);
    const conversationId = await createConversation(token);
    await sendMessage(
      token,
      conversationId,
      `اعرضلي مواد ${SEED_TOKEN}`,
      clientId('reserve5-search'),
    );
    const window = futurePickupWindow(144);
    const prepared = await sendMessage(
      token,
      conversationId,
      `احجزلي أول مادة كمية 99 استلام من ${window.start} إلى ${window.end}`,
      clientId('reserve5-prepare'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const confirm = await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-insufficient',
    );
    assert.ok([400, 409].includes(confirm.response.status));
    assert.ok(
      ['INVALID_QUANTITY', 'VALIDATION_ERROR'].includes(
        confirm.json.error?.code ?? '',
      ),
    );
  });

  test('pickup window too close preserves specific error', async () => {
    const token = tokenFor(ids.learnerBId);
    const conversationId = await createConversation(token);
    await sendMessage(
      token,
      conversationId,
      `اعرضلي مواد ${SEED_TOKEN}`,
      clientId('reserve6-search'),
    );
    const start = new Date(Date.now() + 15 * 60_000);
    const end = new Date(start.getTime() + 60 * 60_000);
    const prepared = await sendMessage(
      token,
      conversationId,
      `احجزلي أول مادة كمية 1 استلام من ${start.toISOString()} إلى ${end.toISOString()}`,
      clientId('reserve6-prepare'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const confirm = await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-window',
    );
    assert.ok([400, 409].includes(confirm.response.status));
    assert.ok(
      ['PICKUP_WINDOW_TOO_CLOSE', 'PICKUP_START_TOO_SOON', 'PICKUP_WINDOW_TOO_CLOSE_TO_ENDING'].includes(
        confirm.json.error?.code ?? '',
      ),
    );
  });

  test('concurrent confirmation executes exactly one domain write', async () => {
    const token = tokenFor(ids.learnerBId);
    const { pendingActionId } = await seedMaterialResultsAndPrepareSave(
      token,
      ids.learnerBId,
    );
    const before = await prisma.materialLike.count({ where: { userId: ids.learnerBId } });
    const [first, second] = await Promise.all([
      confirmAction(token, pendingActionId, 'concurrent-a'),
      confirmAction(token, pendingActionId, 'concurrent-b'),
    ]);
    const statuses = [first.response.status, second.response.status].sort();
    assert.deepEqual(statuses, [201, 409]);
    const after = await prisma.materialLike.count({ where: { userId: ids.learnerBId } });
    assert.equal(after, before + 1);
  });

  test('confirmation and result blocks persist on reload', async () => {
    const token = tokenFor(ids.learnerBId);
    const { conversationId, pendingActionId } = await seedMaterialResultsAndPrepareSave(
      token,
      ids.learnerBId,
    );
    await confirmAction(token, pendingActionId, 'persist-confirm');
    const messages = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      { token },
    );
    assert.equal(messages.response.status, 200);
    const items = messages.json.data?.items as Array<{
      contentBlocks: Array<Record<string, unknown>>;
    }>;
    const allBlocks = items.flatMap((item) => item.contentBlocks ?? []);
    assert.ok(
      allBlocks.some(
        (block) =>
          block.type === 'action_confirmation' &&
          block.pendingActionId === pendingActionId,
      ),
    );
    assert.ok(
      allBlocks.some(
        (block) => block.type === 'action_result' && block.status === 'EXECUTED',
      ),
    );
  });

  test('reservation multi-turn continuation accepts pickup time before date', async () => {
    const token = tokenFor(ids.learnerBId);
    const conversationId = await createConversation(token);
    await sendMessage(
      token,
      conversationId,
      'اعرضلي مواد إلكترونيات متوفرة',
      clientId('reserve-time-search'),
    );

    const step1 = await sendMessage(
      token,
      conversationId,
      'احجزلي أول مادة',
      clientId('reserve-time-step1'),
    );
    assert.equal(step1.response.status, 201);

    const step2 = await sendMessage(token, conversationId, '1', clientId('reserve-time-step2'));
    assert.equal(step2.response.status, 201);
    const blocks2 = parseBlocks(step2.json);
    assert.match(
      String(blocks2.find((block) => block.type === 'text')?.text ?? ''),
      /استلام|توصيل/i,
    );

    const step3 = await sendMessage(
      token,
      conversationId,
      'استلام',
      clientId('reserve-time-step3'),
    );
    assert.equal(step3.response.status, 201);

    const step4 = await sendMessage(
      token,
      conversationId,
      'من 4 إلى 5',
      clientId('reserve-time-step4'),
    );
    assert.equal(step4.response.status, 201);
    const blocks4 = parseBlocks(step4.json);
    const clarify4 = String(blocks4.find((block) => block.type === 'text')?.text ?? '');
    assert.doesNotMatch(
      clarify4,
      /Specify which material or project you want to act on|حدّد المادة أو المشروع/i,
    );
    assert.match(clarify4, /تاريخ الاستلام|4:00|04:00/i);

    const pickupDate = new Date(Date.now() + 4 * 24 * 3_600_000)
      .toISOString()
      .slice(0, 10);
    const step5 = await sendMessage(
      token,
      conversationId,
      pickupDate,
      clientId('reserve-time-step5'),
    );
    assert.equal(step5.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(step5.json));
    const reservationsBefore = await prisma.reservation.count({
      where: { requesterId: ids.learnerBId },
    });

    await confirmAction(
      token,
      confirmation.pendingActionId as string,
      'confirm-reservation-time-flow',
    );
    const reservationsAfter = await prisma.reservation.count({
      where: { requesterId: ids.learnerBId },
    });
    assert.equal(reservationsAfter, reservationsBefore + 1);

    const craft = await sendMessage(
      token,
      conversationId,
      'كيف اصنع الشمع',
      clientId('reserve-time-craft'),
    );
    assert.equal(craft.response.status, 201);
    const craftBlocks = parseBlocks(craft.json);
    assert.equal(
      craftBlocks.some(
        (block) =>
          block.type === 'text' &&
          typeof block.text === 'string' &&
          /كمية|quantity/i.test(block.text),
      ),
      false,
    );
  });
});
