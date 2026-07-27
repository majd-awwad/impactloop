import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'ai-build-guide-ownership-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'ai-build-guide-ownership-refresh-secret';
process.env.AI_CHAT_PROVIDER = 'mock';
process.env.AI_CHAT_RATE_LIMIT_PER_USER = '60';
process.env.AI_CHAT_MAX_CONVERSATIONS_PER_HOUR = '60';

const TEST_MARKER = '[test-ai-build-guide-ownership]';
const clientId = (suffix: string) =>
  `client-ownership-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.slice(
    0,
    64,
  );

type ApiJson = {
  success?: boolean;
  data?: Record<string, unknown> & {
    id?: string;
    contentBlocks?: Array<Record<string, unknown>>;
    block?: Record<string, unknown>;
  };
};

const ids = {
  users: [] as string[],
  categories: [] as string[],
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
      learnerProfile: {
        create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
      },
    },
  });
  ids.users.push(user.id);
  return user;
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
    body: {},
  });
}

async function createOwnershipFixture() {
  const learner = await createLearner('owner');
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
  ids.categories.push(materialCategory.id);

  const project = await prisma.learningProject.create({
    data: {
      categoryId: projectCategory.id,
      createdBy: learner.id,
      title: `${TEST_MARKER} Ownership project`,
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
            categoryId: materialCategory.id,
            searchKeywords: ['led'],
          },
          {
            componentName: 'Resistor',
            materialType: 'Resistor',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: materialCategory.id,
            searchKeywords: ['resistor', 'مقاومة'],
          },
          {
            componentName: 'Breadboard',
            materialType: 'Breadboard',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: materialCategory.id,
            searchKeywords: ['breadboard'],
          },
        ],
      },
      steps: {
        create: [
          {
            stepNumber: 1,
            title: 'Wire LED',
            description: 'Connect LED',
            reviewStatus: 'ACCEPTED',
          },
        ],
      },
    },
    include: {
      requiredComponents: true,
      steps: true,
    },
  });
  ids.projects.push(project.id);

  const build = await prisma.projectBuild.create({
    data: {
      projectId: project.id,
      learnerId: learner.id,
      items: {
        create: project.requiredComponents.map((component) => ({
          requiredComponentId: component.id,
        })),
      },
    },
    include: { items: true },
  });
  ids.builds.push(build.id);

  const guide = await apiFetch(
    `/api/learning-projects/${project.id}/builds/me/guide-conversation`,
    {
      method: 'POST',
      token: tokenFor(learner.id),
      body: { locale: 'ar' },
    },
  );
  assert.equal(guide.response.status, 200);
  const conversationId = (
    (guide.json.data?.conversation as Record<string, unknown> | undefined)?.id
  ) as string;
  assert.ok(conversationId);

  return {
    learner,
    project,
    build,
    token: tokenFor(learner.id),
    conversationId,
    itemsByName: new Map(
      build.items.map((item) => {
        const component = project.requiredComponents.find(
          (entry) => entry.id === item.requiredComponentId,
        )!;
        return [component.componentName, item];
      }),
    ),
  };
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
  if (ids.users.length > 0) {
    await deleteAiDataForUsers(ids.users);
  }
  if (ids.builds.length > 0) {
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  }
  if (ids.projects.length > 0) {
    await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
  }
  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }
  if (ids.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

async function createAmbiguousWiresFixture() {
  const learner = await createLearner('wires');
  const projectCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Wires Projects`,
      nameAr: `${TEST_MARKER} مشاريع أسلاك`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(projectCategory.id);
  const materialCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Wires Electronics`,
      nameAr: `${TEST_MARKER} إلكترونيات أسلاك`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });
  ids.categories.push(materialCategory.id);

  const project = await prisma.learningProject.create({
    data: {
      categoryId: projectCategory.id,
      createdBy: learner.id,
      title: `${TEST_MARKER} Wires project`,
      shortDescription: `${TEST_MARKER} short`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      requiredComponents: {
        create: [
          {
            componentName: 'Jumper wires',
            materialType: 'Jumper wires',
            quantity: 1,
            unit: 'pack',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: materialCategory.id,
            searchKeywords: ['jumper', 'wires', 'أسلاك'],
          },
          {
            componentName: 'Battery wires',
            materialType: 'Battery wires',
            quantity: 1,
            unit: 'pack',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: materialCategory.id,
            searchKeywords: ['battery wires', 'أسلاك'],
          },
        ],
      },
      steps: {
        create: [
          {
            stepNumber: 1,
            title: 'Connect wires',
            description: 'Wire components',
            reviewStatus: 'ACCEPTED',
          },
        ],
      },
    },
    include: { requiredComponents: true },
  });
  ids.projects.push(project.id);

  const build = await prisma.projectBuild.create({
    data: {
      projectId: project.id,
      learnerId: learner.id,
      items: {
        create: project.requiredComponents.map((component) => ({
          requiredComponentId: component.id,
        })),
      },
    },
    include: { items: true },
  });
  ids.builds.push(build.id);

  const guide = await apiFetch(
    `/api/learning-projects/${project.id}/builds/me/guide-conversation`,
    {
      method: 'POST',
      token: tokenFor(learner.id),
      body: { locale: 'ar' },
    },
  );
  assert.equal(guide.response.status, 200);
  const conversationId = (
    (guide.json.data?.conversation as Record<string, unknown> | undefined)?.id
  ) as string;

  return {
    learner,
    project,
    build,
    token: tokenFor(learner.id),
    conversationId,
  };
}

async function readPendingPayload(pendingActionId: string) {
  const pending = await prisma.aiPendingAction.findUnique({
    where: { id: pendingActionId },
  });
  assert.ok(pending);
  return pending.payload as {
    target: { buildId: string; projectId: string };
    parameters: {
      targetStatus: string;
      items: Array<{ buildItemId: string; componentName: string }>;
    };
  };
}

describe('build-guide component ownership actions', () => {
  test('single component Arabic creates pending action and updates after confirm', async () => {
    const fixture = await createOwnershipFixture();
    const ledItem = fixture.itemsByName.get('LED')!;

    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'عندي LED',
      clientId('single-led'),
    );
    assert.equal(prepared.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    assert.equal(confirmation.actionType, 'UPDATE_BUILD_COMPONENT_STATUSES');
    assert.equal(
      await prisma.projectBuildItem.count({
        where: { id: ledItem.id, status: 'ALREADY_OWNED' },
      }),
      0,
    );

    const confirmed = await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      clientId('confirm-single-led'),
    );
    assert.equal(confirmed.response.status, 201);
    assert.equal(
      await prisma.projectBuildItem.count({
        where: { id: ledItem.id, status: 'ALREADY_OWNED' },
      }),
      1,
    );
  });

  test('multiple components update atomically from one pending action', async () => {
    const fixture = await createOwnershipFixture();
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'عندي LED ومقاومة',
      clientId('multi-ar'),
    );
    assert.equal(prepared.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const pendingId = confirmation.pendingActionId as string;
    assert.equal(
      await prisma.aiPendingAction.count({
        where: { id: pendingId, actionType: 'UPDATE_BUILD_COMPONENT_STATUSES' },
      }),
      1,
    );

    await confirmAction(fixture.token, pendingId, clientId('confirm-multi-ar'));

    const owned = await prisma.projectBuildItem.count({
      where: {
        buildId: fixture.build.id,
        status: 'ALREADY_OWNED',
      },
    });
    assert.equal(owned, 2);
  });

  test('all materials selects only items not already owned', async () => {
    const fixture = await createOwnershipFixture();
    const ledItem = fixture.itemsByName.get('LED')!;
    await prisma.projectBuildItem.update({
      where: { id: ledItem.id },
      data: { status: 'ALREADY_OWNED' },
    });

    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'عندي كل المواد',
      clientId('all-materials'),
    );
    assert.equal(prepared.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      clientId('confirm-all'),
    );

    assert.equal(
      await prisma.projectBuildItem.count({
        where: { buildId: fixture.build.id, status: 'ALREADY_OWNED' },
      }),
      3,
    );
  });

  test('missing phrase marks component MISSING after confirmation', async () => {
    const fixture = await createOwnershipFixture();
    const breadboard = fixture.itemsByName.get('Breadboard')!;
    await prisma.projectBuildItem.update({
      where: { id: breadboard.id },
      data: { status: 'ALREADY_OWNED' },
    });

    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'طلع ما عندي Breadboard',
      clientId('missing-bb'),
    );
    assert.equal(prepared.response.status, 201);
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      clientId('confirm-missing-bb'),
    );

    const item = await prisma.projectBuildItem.findUnique({
      where: { id: breadboard.id },
    });
    assert.equal(item?.status, 'MISSING');
  });

  test('cancel performs zero writes', async () => {
    const fixture = await createOwnershipFixture();
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'I have the LED',
      clientId('cancel-led'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const cancelled = await cancelAction(
      fixture.token,
      confirmation.pendingActionId as string,
    );
    assert.equal(cancelled.response.status, 200);
    assert.equal(
      await prisma.projectBuildItem.count({
        where: { buildId: fixture.build.id, status: 'ALREADY_OWNED' },
      }),
      0,
    );
  });

  test('double confirm is idempotent', async () => {
    const fixture = await createOwnershipFixture();
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'I have the resistor',
      clientId('double-resistor'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const pendingId = confirmation.pendingActionId as string;
    const key = clientId('confirm-double');

    await confirmAction(fixture.token, pendingId, key);
    await confirmAction(fixture.token, pendingId, key);

    assert.equal(
      await prisma.projectBuildItem.count({
        where: {
          id: fixture.itemsByName.get('Resistor')!.id,
          status: 'ALREADY_OWNED',
        },
      }),
      1,
    );
  });

  test('already owned returns no pending write', async () => {
    const fixture = await createOwnershipFixture();
    const ledItem = fixture.itemsByName.get('LED')!;
    await prisma.projectBuildItem.update({
      where: { id: ledItem.id },
      data: { status: 'ALREADY_OWNED' },
    });

    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'عندي LED',
      clientId('already-owned'),
    );
    assert.equal(prepared.response.status, 201);
    const blocks = parseBlocks(prepared.json);
    assert.ok(!blocks.some((block) => block.type === 'action_confirmation'));
  });

  test('unknown component produces clarification without pending action', async () => {
    const fixture = await createOwnershipFixture();
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'عندي Arduino Uno',
      clientId('unknown-arduino'),
    );
    assert.equal(prepared.response.status, 201);
    const blocks = parseBlocks(prepared.json);
    assert.ok(!blocks.some((block) => block.type === 'action_confirmation'));
    assert.ok(blocks.some((block) => block.type === 'text'));
  });

  test('general conversation does not mutate build ownership', async () => {
    const learner = await createLearner('general');
    const token = tokenFor(learner.id);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'en' },
    });
    assert.equal(created.response.status, 201);
    const conversationId = created.json.data?.id as string;

    const prepared = await sendMessage(
      token,
      conversationId,
      'I have the LED',
      clientId('general-led'),
    );
    assert.equal(prepared.response.status, 201);
    const blocks = parseBlocks(prepared.json);
    assert.ok(
      !blocks.some(
        (block) =>
          block.type === 'action_confirmation' &&
          block.actionType === 'UPDATE_BUILD_COMPONENT_STATUSES',
      ),
    );
  });

  test('step 1 becomes available after final owned component', async () => {
    const fixture = await createOwnershipFixture();
    for (const name of ['LED', 'Resistor']) {
      const prepared = await sendMessage(
        fixture.token,
        fixture.conversationId,
        `عندي ${name}`,
        clientId(`own-${name}`),
      );
      const confirmation = confirmationBlock(parseBlocks(prepared.json));
      await confirmAction(
        fixture.token,
        confirmation.pendingActionId as string,
        clientId(`confirm-${name}`),
      );
    }

    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'I have the breadboard',
      clientId('own-breadboard'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      clientId('confirm-breadboard'),
    );

    const buildResponse = await apiFetch(
      `/api/learning-projects/${fixture.project.id}/builds/me`,
      { token: fixture.token },
    );
    assert.equal(buildResponse.response.status, 200);
    const stepProgress = buildResponse.json.data?.stepProgress as Record<
      string,
      unknown
    >;
    const currentStep = stepProgress.currentStep as Record<string, unknown> | null;
    assert.equal(currentStep?.stepNumber, 1);
  });

  test('ambiguous component reference returns clarification without pending action', async () => {
    const fixture = await createAmbiguousWiresFixture();
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'عندي الأسلاك',
      clientId('ambiguous-wires'),
    );
    assert.equal(prepared.response.status, 201);
    const blocks = parseBlocks(prepared.json);
    assert.ok(!blocks.some((block) => block.type === 'action_confirmation'));
    const text = blocks
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n');
    assert.match(text, /Jumper wires/i);
    assert.match(text, /Battery wires/i);
  });

  test('mixed known and unknown references avoid misleading confirmation', async () => {
    const fixture = await createOwnershipFixture();
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'عندي LED وArduino Uno',
      clientId('mixed-known-unknown'),
    );
    assert.equal(prepared.response.status, 201);
    const blocks = parseBlocks(prepared.json);
    assert.ok(!blocks.some((block) => block.type === 'action_confirmation'));
    const text = blocks
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n');
    assert.match(text, /Arduino Uno/i);
    assert.match(text, /LED/i);
  });

  test('learner cannot confirm another learner pending ownership action', async () => {
    const ownerFixture = await createOwnershipFixture();
    const intruder = await createLearner('intruder');
    const intruderToken = tokenFor(intruder.id);

    const prepared = await sendMessage(
      ownerFixture.token,
      ownerFixture.conversationId,
      'I have the LED',
      clientId('isolation-led'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const denied = await confirmAction(
      intruderToken,
      confirmation.pendingActionId as string,
      clientId('intruder-confirm'),
    );
    assert.ok(denied.response.status === 403 || denied.response.status === 404);
    assert.equal(
      await prisma.projectBuildItem.count({
        where: { buildId: ownerFixture.build.id, status: 'ALREADY_OWNED' },
      }),
      0,
    );
  });

  test('pending payload uses only trusted build item ids from the bound build', async () => {
    const fixture = await createOwnershipFixture();
    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'I have the LED and resistor',
      clientId('trusted-payload'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    const payload = await readPendingPayload(confirmation.pendingActionId as string);
    assert.equal(payload.target.buildId, fixture.build.id);
    assert.equal(payload.target.projectId, fixture.project.id);
    assert.equal(payload.parameters.items.length, 2);
    const trustedIds = new Set(fixture.build.items.map((item) => item.id));
    for (const item of payload.parameters.items) {
      assert.ok(trustedIds.has(item.buildItemId));
    }
  });

  test('mark missing updates canonical readiness in build response', async () => {
    const fixture = await createOwnershipFixture();
    for (const name of ['LED', 'Resistor', 'Breadboard']) {
      const item = fixture.itemsByName.get(name)!;
      await prisma.projectBuildItem.update({
        where: { id: item.id },
        data: { status: 'ALREADY_OWNED' },
      });
    }

    const prepared = await sendMessage(
      fixture.token,
      fixture.conversationId,
      'Mark the breadboard as missing',
      clientId('missing-en'),
    );
    const confirmation = confirmationBlock(parseBlocks(prepared.json));
    await confirmAction(
      fixture.token,
      confirmation.pendingActionId as string,
      clientId('confirm-missing-en'),
    );

    const buildResponse = await apiFetch(
      `/api/learning-projects/${fixture.project.id}/builds/me`,
      { token: fixture.token },
    );
    assert.equal(buildResponse.response.status, 200);
    const readiness = buildResponse.json.data?.materialReadiness as Record<
      string,
      number
    >;
    assert.equal(readiness.missing, 1);
    const breadboard = fixture.itemsByName.get('Breadboard')!;
    const item = await prisma.projectBuildItem.findUnique({
      where: { id: breadboard.id },
    });
    assert.equal(item?.status, 'MISSING');
  });
});
