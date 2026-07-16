import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'phase2-full-seq-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'phase2-full-seq-refresh-secret';
process.env.AI_CHAT_PROVIDER = 'mock';
process.env.AI_CHAT_RATE_LIMIT_PER_USER = '120';
process.env.AI_CHAT_MAX_CONVERSATIONS_PER_HOUR = '120';

const TEST_MARKER = '[test-ai-phase2-full-sequence]';
const SEED_TOKEN = 'phase2fullseq';
const clientId = (suffix: string) =>
  `client-p2seq-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.slice(
    0,
    64,
  );

type ApiJson = {
  data?: Record<string, unknown> & {
    contentBlocks?: Array<Record<string, unknown>>;
    items?: Array<Record<string, unknown>>;
  };
  error?: { code?: string };
};

const ids = {
  users: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
  learnerId: '',
  supplierId: '',
  materialCategoryId: '',
  projectCategoryId: '',
  createdCategoryIds: [] as string[],
  beginnerProjectId: '',
  intermediateProjectId: '',
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

  const { app } = await import('../../../app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server!.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
  resetRateLimitersForTests();
  setAiChatProviderForTests(new MockAiChatProviderClass());

  const materialCategory = await prisma.category.create({
    data: {
      nameEn: `Electronics ${SEED_TOKEN}`,
      nameAr: `إلكترونيات ${SEED_TOKEN}`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });
  ids.materialCategoryId = materialCategory.id;
  ids.createdCategoryIds.push(materialCategory.id);

  const projectCategory = await prisma.category.create({
    data: {
      nameEn: `Robotics ${SEED_TOKEN}`,
      nameAr: `روبوتات ${SEED_TOKEN}`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.projectCategoryId = projectCategory.id;
  ids.createdCategoryIds.push(projectCategory.id);

  const learner = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} learner`,
      email: `${TEST_MARKER}-learner-${Date.now()}@impactloop.test`,
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
  ids.users.push(learner.id);
  ids.learnerId = learner.id;

  const supplier = await prisma.user.create({
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
  ids.users.push(supplier.id);
  ids.supplierId = supplier.id;
  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: supplier.id },
  });

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

  for (let index = 0; index < 4; index += 1) {
    const material = await prisma.material.create({
      data: {
        ownerId: supplier.id,
        supplierProfileId: supplierProfile?.id,
        categoryId: ids.materialCategoryId,
        locationId: location.id,
        title: `${SEED_TOKEN} material ${index + 1}`,
        description: `${TEST_MARKER} seeded material`,
        materialType: 'LED',
        quantity: 5,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: index % 2 === 0,
        ...(index % 2 === 0
          ? {}
          : { price: 10 + index, currency: 'NIS', isFree: false }),
        pickupAllowed: true,
        deliveryAllowed: false,
      },
    });
    ids.materials.push(material.id);
  }

  const beginnerProject = await prisma.learningProject.create({
    data: {
      categoryId: ids.projectCategoryId,
      createdBy: ids.learnerId,
      title: `${SEED_TOKEN} Beginner Blink`,
      shortDescription: `${TEST_MARKER} beginner`,
      description: `${TEST_MARKER} beginner project`,
      difficulty: 'BEGINNER',
      estimatedDurationMinutes: 30,
      status: 'PUBLISHED',
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
          {
            componentName: 'Resistor',
            materialType: 'Resistor',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: ids.materialCategoryId,
            searchKeywords: ['resistor'],
          },
        ],
      },
    },
  });
  ids.beginnerProjectId = beginnerProject.id;
  ids.projects.push(beginnerProject.id);

  const intermediateProject = await prisma.learningProject.create({
    data: {
      categoryId: ids.projectCategoryId,
      createdBy: ids.learnerId,
      title: `${SEED_TOKEN} Advanced Robot`,
      shortDescription: `${TEST_MARKER} intermediate`,
      description: `${TEST_MARKER} intermediate project`,
      difficulty: 'INTERMEDIATE',
      estimatedDurationMinutes: 180,
      status: 'PUBLISHED',
      requiredComponents: {
        create: [
          {
            componentName: 'Motor',
            materialType: 'Motor',
            quantity: 2,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: ids.materialCategoryId,
            searchKeywords: ['motor'],
          },
          {
            componentName: 'Sensor',
            materialType: 'Sensor',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: ids.materialCategoryId,
            searchKeywords: ['sensor'],
          },
          {
            componentName: 'Battery',
            materialType: 'Battery',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: ids.materialCategoryId,
            searchKeywords: ['battery'],
          },
        ],
      },
    },
  });
  ids.intermediateProjectId = intermediateProject.id;
  ids.projects.push(intermediateProject.id);
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

describe('phase 2 full sequence http closure', () => {
  test('runs the 24-step learner conversation with actions and history reload', async () => {
    const token = tokenFor(ids.learnerId);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'ar' },
    });
    assert.equal(created.response.status, 201);
    const conversationId = created.json.data?.id as string;

    const send = async (text: string, suffix: string) => {
      const result = await apiFetch(
        `/api/ai/v1/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          token,
          body: { text, locale: 'ar', clientMessageId: clientId(suffix) },
        },
      );
      assert.equal(result.response.status, 201, `step failed for: ${text}`);
      const conversation = await prisma.aiConversation.findUnique({
        where: { id: conversationId },
      });
      assert.equal(conversation?.processingState, 'IDLE');
      return parseBlocks(result.json);
    };

    const confirm = async (pendingActionId: string, key: string) => {
      const result = await apiFetch(`/api/ai/v1/actions/${pendingActionId}/confirm`, {
        method: 'POST',
        token,
        body: { idempotencyKey: key, locale: 'ar' },
      });
      assert.equal(result.response.status, 201);
      return result;
    };

    // 1
    const materials1 = await send(`اعرضلي مواد ${SEED_TOKEN}`, 's01');
    const materialBlock = materials1.find((block) => block.type === 'material_results');
    assert.ok(materialBlock);
    const materialItems = materialBlock.items as Array<{ materialId: string }>;
    assert.ok(materialItems.length >= 3);

    // 2
    const details = await send('احكيلي عن أول مادة', 's02');
    const detailsItem = details.find((block) => block.type === 'material_details')?.item as
      | { materialId?: string }
      | undefined;
    assert.equal(detailsItem?.materialId, materialItems[0]!.materialId);

    // 3
    const materialComparison = await send('قارن أول مادتين', 's03');
    const materialCmp = materialComparison.find((block) => block.type === 'comparison');
    assert.equal(materialCmp?.subject, 'MATERIAL');
    const comparedMaterialIds = (
      (materialCmp?.items as Array<{ id: string }> | undefined) ?? []
    ).map((item) => item.id);
    assert.deepEqual(comparedMaterialIds, [
      materialItems[0]!.materialId,
      materialItems[1]!.materialId,
    ]);

    // 4-5
    const closer = await send('أي واحدة أقرب؟', 's04');
    assert.ok(closer.some((block) => block.type === 'text'));
    assert.equal(
      closer.some((block) => block.type === 'material_results'),
      false,
    );
    const cheaperFollowUp = await send('أي واحدة أرخص؟', 's05');
    assert.ok(cheaperFollowUp.some((block) => block.type === 'text'));

    // 6-7
    const likesBefore = await prisma.materialLike.count({ where: { userId: ids.learnerId } });
    const savePrepare = await send('احفظلي الأرخص', 's06');
    const saveConfirmation = confirmationBlock(savePrepare);
    const likesAfterPrepare = await prisma.materialLike.count({
      where: { userId: ids.learnerId },
    });
    assert.equal(likesAfterPrepare, likesBefore);
    await confirm(saveConfirmation.pendingActionId as string, 'confirm-save-cheaper');
    const likesAfterConfirm = await prisma.materialLike.count({
      where: { userId: ids.learnerId },
    });
    assert.equal(likesAfterConfirm, likesBefore + 1);

    // 8
    const projects8 = await send(`اعرضلي مشاريع ${SEED_TOKEN}`, 's08');
    const projectBlock = projects8.find((block) => block.type === 'project_results');
    assert.ok(projectBlock);
    const projectItems = projectBlock.items as Array<{ projectId: string }>;
    assert.ok(projectItems.length >= 2);

    // 9-10
    const projectComparison = await send('قارن أول مشروعين', 's09');
    const projectCmp = projectComparison.find((block) => block.type === 'comparison');
    assert.equal(projectCmp?.subject, 'PROJECT');
    const comparedProjectIds = (
      (projectCmp?.items as Array<{ id: string }> | undefined) ?? []
    ).map((item) => item.id);
    assert.deepEqual(comparedProjectIds, [
      projectItems[0]!.projectId,
      projectItems[1]!.projectId,
    ]);
    const easier = await send('أي واحد أسهل؟', 's10');
    const easierText = easier.find((block) => block.type === 'text')?.text as string;
    assert.match(easierText, /Beginner Blink|المبتدئ|الأسهل/i);

    // 11-12
    const buildsBefore = await prisma.projectBuild.count({
      where: { learnerId: ids.learnerId },
    });
    const startPrepare = await send('ابدألي الأسهل', 's11');
    const startConfirmation = confirmationBlock(startPrepare);
    await confirm(startConfirmation.pendingActionId as string, 'confirm-start-build');
    const buildsAfter = await prisma.projectBuild.count({
      where: { learnerId: ids.learnerId },
    });
    assert.equal(buildsAfter, buildsBefore + 1);

    // 13-14
    const activeBuilds = await send('اعرضلي المشاريع اللي بلشت فيها', 's13');
    const activeBlock = activeBuilds.find((block) => block.type === 'project_results');
    assert.ok(activeBlock);
    const activeItems = activeBlock.items as Array<{
      activeBuildId?: string | null;
      projectId?: string;
    }>;
    assert.ok(activeItems.length >= 1);
    assert.ok(activeItems.every((item) => item.activeBuildId));
    const dbActiveBuilds = await prisma.projectBuild.count({
      where: { learnerId: ids.learnerId, status: 'IN_PROGRESS' },
    });
    assert.equal(activeItems.length, dbActiveBuilds);

    // 15-16
    const checklistBlocks = await send('شو ناقصني من المواد بالمشروع؟', 's15');
    const checklist = checklistBlocks.find((block) => block.type === 'build_checklist');
    assert.ok(checklist);
    ids.builds.push(checklist.buildId as string);

    // 17-18
    const matchesBlocks = await send('لاقيلّي مواد للمكونات الناقصة', 's17');
    assert.ok(matchesBlocks.some((block) => block.type === 'component_matches'));

    // 19-20
    const linkPrepare = await send('اربط أول مادة بالمكون الناقص', 's19');
    const linkConfirmation = confirmationBlock(linkPrepare);
    const buildItemBefore = await prisma.projectBuildItem.findFirst({
      where: { buildId: checklist.buildId as string, linkedMaterialId: { not: null } },
    });
    assert.equal(buildItemBefore, null);
    await confirm(linkConfirmation.pendingActionId as string, 'confirm-link');
    const buildItemAfter = await prisma.projectBuildItem.findFirst({
      where: { buildId: checklist.buildId as string, linkedMaterialId: { not: null } },
    });
    assert.ok(buildItemAfter?.linkedMaterialId);

    // 21-23
    await send(`اعرضلي مواد ${SEED_TOKEN}`, 's21-search');
    const reserveMissing = await send('احجزلي أول مادة', 's21');
    assert.equal(
      reserveMissing.some((block) => block.type === 'action_confirmation'),
      false,
    );
    const window = futurePickupWindow();
    const reservePrepare = await send(
      `احجزلي أول مادة كمية 1 استلام من ${window.start} إلى ${window.end}`,
      's22',
    );
    const reserveConfirmation = confirmationBlock(reservePrepare);
    const reservationsBefore = await prisma.reservation.count({
      where: { requesterId: ids.learnerId },
    });
    await confirm(reserveConfirmation.pendingActionId as string, 'confirm-reservation-1');
    const reservationsAfter = await prisma.reservation.count({
      where: { requesterId: ids.learnerId },
    });
    assert.equal(reservationsAfter, reservationsBefore + 1);
    const reserveAgain = await confirm(
      reserveConfirmation.pendingActionId as string,
      'confirm-reservation-2',
    );
    assert.equal(reserveAgain.response.status, 201);
    const reservationsFinal = await prisma.reservation.count({
      where: { requesterId: ids.learnerId },
    });
    assert.equal(reservationsFinal, reservationsAfter);

    // 24 history reload
    const history = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages?limit=100`,
      { token },
    );
    assert.equal(history.response.status, 200);
    const historyItems = history.json.data?.items as Array<{
      role: string;
      contentBlocks?: Array<Record<string, unknown>>;
    }>;
    assert.ok(Array.isArray(historyItems));
    const allBlockTypes = historyItems
      .filter((message) => message.role === 'ASSISTANT')
      .flatMap((message) => message.contentBlocks ?? [])
      .map((block) => block.type);
    for (const expectedType of [
      'material_results',
      'material_details',
      'comparison',
      'project_results',
      'build_checklist',
      'component_matches',
      'action_confirmation',
      'action_result',
    ]) {
      assert.ok(
        allBlockTypes.includes(expectedType),
        `expected persisted block type: ${expectedType}`,
      );
    }

    const afterReloadDetails = await send(
      'احكيلي عن المادة الأرخص من المقارنة السابقة',
      's24-material',
    );
    assert.ok(afterReloadDetails.some((block) => block.type === 'material_details'));

    const afterReloadGap = await send('شو ناقصني بالمشروع اللي بدأته؟', 's24-gap');
    assert.ok(afterReloadGap.some((block) => block.type === 'build_checklist'));
  });
});
