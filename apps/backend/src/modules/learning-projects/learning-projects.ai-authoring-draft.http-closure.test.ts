import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'ai-authoring-draft-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'ai-authoring-draft-refresh-secret';
process.env.NODE_TEST_CONTEXT ??= '1';
process.env.AI_CHAT_PROVIDER = 'mock';
process.env.AI_CHAT_RATE_LIMIT_PER_USER = '60';
process.env.AI_CHAT_MAX_CONVERSATIONS_PER_HOUR = '60';

const TEST_MARKER = '[test-learning-projects-ai-authoring-draft]';

type ApiJson = {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown>;
  error?: { code?: string; details?: Record<string, unknown> };
};

const ids = {
  users: [] as string[],
  categories: [] as string[],
  projects: [] as string[],
};

let baseUrl = '';
let server: Server | null = null;
let prisma: typeof import('../../database/prisma.js').prisma;
let signAccessToken: typeof import('../../utils/jwt.js').signAccessToken;
let hashPassword: typeof import('../../utils/password.js').hashPassword;
let resetRateLimitersForTests: typeof import('../../middlewares/rate-limit.middleware.js').resetRateLimitersForTests;
let deleteAiDataForUsers: typeof import('../ai/ai.repository.js').deleteAiDataForUsers;
let setAiChatProviderForTests: typeof import('../ai/providers/ai-chat-provider.factory.js').setAiChatProviderForTests;
let MockAiChatProviderClass: typeof import('../ai/providers/mock-chat.provider.js').MockAiChatProvider;
let deriveAuthoringDraftFields: typeof import('./learning-projects.authoring-draft-fields.js').deriveAuthoringDraftFields;

class CountingMockProvider {
  answerCalls = 0;
  readonly name = 'mock';

  async classifyScope(
    input: Parameters<import('../ai/providers/mock-chat.provider.js').MockAiChatProvider['classifyScope']>[0],
  ) {
    return new MockAiChatProviderClass().classifyScope(input);
  }

  async generateGeneralLearningAnswer(
    input: Parameters<
      import('../ai/providers/mock-chat.provider.js').MockAiChatProvider['generateGeneralLearningAnswer']
    >[0],
  ) {
    this.answerCalls += 1;
    return new MockAiChatProviderClass().generateGeneralLearningAnswer(input);
  }
}

let countingProvider: CountingMockProvider;

function idempotencyKey(label: string) {
  return `authoring.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`.slice(
    0,
    128,
  );
}

function clientMessageId(label: string) {
  return `client-authoring-${label}-${Date.now()}`.slice(0, 64);
}

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

async function createSupplier() {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} supplier`,
      email: `${TEST_MARKER}-supplier-${Date.now()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      accountStatus: 'ACTIVE',
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createProjectCategory(input: { isActive?: boolean } = {}) {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Projects`,
      nameAr: `${TEST_MARKER} مشاريع`,
      categoryType: 'PROJECT',
      isActive: input.isActive ?? true,
    },
  });
  ids.categories.push(category.id);
  return category;
}

async function createMaterialCategory() {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Materials only`,
      nameAr: `${TEST_MARKER} مواد`,
      categoryType: 'MATERIAL',
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
}

function tokenFor(userId: string, roles: string[] = ['LEARNER']) {
  return signAccessToken({ sub: userId, roles });
}

async function apiFetch(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    idempotencyKey?: string;
  } = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.idempotencyKey
        ? { 'Idempotency-Key': options.idempotencyKey }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = (await response.json()) as ApiJson;
  return { response, json };
}

async function createAuthoringDraft(
  token: string,
  input: {
    ideaText: string;
    categoryId: string;
    difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    idempotencyKey: string;
    locale?: 'en' | 'ar';
  },
) {
  return apiFetch('/api/learning-projects/mine/ai-authoring-drafts', {
    method: 'POST',
    token,
    idempotencyKey: input.idempotencyKey,
    body: {
      ideaText: input.ideaText,
      categoryId: input.categoryId,
      difficulty: input.difficulty,
      ...(input.locale ? { locale: input.locale } : {}),
    },
  });
}

async function countDraftArtifacts(projectId: string) {
  const [project, conversations, messages] = await Promise.all([
    prisma.learningProject.findUnique({
      where: { id: projectId },
      include: {
        requiredComponents: true,
        steps: true,
      },
    }),
    prisma.aiConversation.findMany({
      where: { learningProjectId: projectId, mode: 'PROJECT_AUTHORING' },
    }),
    prisma.aiMessage.findMany({
      where: {
        conversation: {
          learningProjectId: projectId,
          mode: 'PROJECT_AUTHORING',
        },
      },
    }),
  ]);

  return {
    project,
    conversations,
    messages,
    assistantMessages: messages.filter((message) => message.role === 'ASSISTANT'),
    userMessages: messages.filter((message) => message.role === 'USER'),
  };
}

async function createOwnedDraftProject(input: {
  createdBy: string;
  categoryId: string;
  status?: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED';
  title?: string;
}) {
  const project = await prisma.learningProject.create({
    data: {
      createdBy: input.createdBy,
      categoryId: input.categoryId,
      title: input.title ?? `${TEST_MARKER} manual draft`,
      shortDescription: `${TEST_MARKER} short description for manual draft project.`,
      description: `${TEST_MARKER} full description for manual draft project.`,
      difficulty: 'BEGINNER',
      status: input.status ?? 'DRAFT',
      submittedAt: input.status && input.status !== 'DRAFT' ? new Date() : null,
      reviewedAt: input.status && input.status !== 'DRAFT' ? new Date() : null,
    },
  });
  ids.projects.push(project.id);
  return project;
}

before(async () => {
  const prismaModule = await import('../../database/prisma.js');
  prisma = prismaModule.prisma;
  ({ signAccessToken } = await import('../../utils/jwt.js'));
  ({ hashPassword } = await import('../../utils/password.js'));
  ({ resetRateLimitersForTests } = await import(
    '../../middlewares/rate-limit.middleware.js'
  ));
  ({ deleteAiDataForUsers } = await import('../ai/ai.repository.js'));
  ({ setAiChatProviderForTests } = await import(
    '../ai/providers/ai-chat-provider.factory.js'
  ));
  ({ MockAiChatProvider: MockAiChatProviderClass } = await import(
    '../ai/providers/mock-chat.provider.js'
  ));
  ({ deriveAuthoringDraftFields } = await import(
    './learning-projects.authoring-draft-fields.js'
  ));

  countingProvider = new CountingMockProvider();
  setAiChatProviderForTests(countingProvider);

  const { app } = await import('../../app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server!.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
  resetRateLimitersForTests();
});

beforeEach(() => {
  resetRateLimitersForTests();
  process.env.AI_CHAT_PROVIDER = 'mock';
});

after(async () => {
  setAiChatProviderForTests(null);
  resetRateLimitersForTests();

  if (ids.projects.length > 0) {
    await prisma.learningProject.deleteMany({
      where: { id: { in: ids.projects } },
    });
  }

  await deleteAiDataForUsers(ids.users);

  if (ids.users.length > 0) {
    await prisma.idempotencyRecord.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }

  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }

  await new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('learning project AI authoring draft wave 1A', () => {
  test('learner creates AI authoring draft with deterministic fields and bindings', async () => {
    const learner = await createLearner('create');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const ideaText = 'I want to build a low-cost smart watering project.';
    const derived = deriveAuthoringDraftFields(ideaText);
    const key = idempotencyKey('create');

    const created = await createAuthoringDraft(token, {
      ideaText,
      categoryId: category.id,
      difficulty: 'INTERMEDIATE',
      idempotencyKey: key,
    });

    assert.equal(created.response.status, 201);
    assert.equal(created.json.success, true);
    const data = created.json.data as Record<string, unknown>;
    assert.equal(data.status, 'DRAFT');
    assert.equal(data.mode, 'PROJECT_AUTHORING');
    assert.equal(data.title, derived.title);
    assert.ok(typeof data.learningProjectId === 'string');
    assert.ok(typeof data.conversationId === 'string');
    assert.ok(typeof data.updatedAt === 'string');

    ids.projects.push(data.learningProjectId as string);

    const artifacts = await countDraftArtifacts(data.learningProjectId as string);
    assert.ok(artifacts.project);
    assert.equal(artifacts.project!.createdBy, learner.id);
    assert.equal(artifacts.project!.status, 'DRAFT');
    assert.equal(artifacts.project!.title, derived.title);
    assert.equal(artifacts.project!.shortDescription, derived.shortDescription);
    assert.equal(artifacts.project!.description, derived.description);
    assert.equal(artifacts.project!.categoryId, category.id);
    assert.equal(artifacts.project!.difficulty, 'INTERMEDIATE');
    assert.equal(artifacts.project!.requiredComponents.length, 0);
    assert.equal(artifacts.project!.steps.length, 0);
    assert.equal(artifacts.project!.submittedAt, null);
    assert.equal(artifacts.project!.reviewedAt, null);
    assert.equal(artifacts.conversations.length, 1);
    assert.equal(artifacts.conversations[0]!.userId, learner.id);
    assert.equal(artifacts.conversations[0]!.mode, 'PROJECT_AUTHORING');
    assert.equal(artifacts.conversations[0]!.projectBuildId, null);
    assert.equal(artifacts.userMessages.length, 1);
    assert.equal(artifacts.userMessages[0]!.contentText, ideaText);
    assert.equal(artifacts.assistantMessages.length, 0);
  });

  test('Arabic idea creation preserves idea message and neutral draft placeholders', async () => {
    const learner = await createLearner('arabic');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const ideaText =
      'أريد بناء مشروع ري ذكي منخفض التكلفة للحديقة المنزلية.';
    const derived = deriveAuthoringDraftFields(ideaText);

    const created = await createAuthoringDraft(token, {
      ideaText,
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('arabic'),
      locale: 'ar',
    });

    assert.equal(created.response.status, 201);
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);

    assert.equal(derived.title, 'مسودة بدون عنوان');
    assert.equal(data.title, derived.title);
    assert.equal(derived.shortDescription, 'مسودة قيد الإعداد');
    assert.equal(derived.description, 'سيتم إنشاء وصف المشروع أثناء التأليف الموجّه.');

    const artifacts = await countDraftArtifacts(data.learningProjectId as string);
    assert.equal(artifacts.userMessages[0]!.contentText, ideaText);
    assert.equal(artifacts.project!.title, derived.title);
    assert.ok(!artifacts.project!.title.includes('أريد'));
    assert.ok(!artifacts.project!.description.includes('أريد'));
  });

  test('idempotent replay returns the same draft and conversation', async () => {
    const learner = await createLearner('idempotent');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const key = idempotencyKey('replay');
    const payload = {
      ideaText: 'Build a solar-powered phone charger for camping trips.',
      categoryId: category.id,
      difficulty: 'ADVANCED' as const,
      idempotencyKey: key,
    };

    const first = await createAuthoringDraft(token, payload);
    const second = await createAuthoringDraft(token, payload);

    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 200);

    const firstData = first.json.data as Record<string, unknown>;
    const secondData = second.json.data as Record<string, unknown>;
    assert.equal(firstData.learningProjectId, secondData.learningProjectId);
    assert.equal(firstData.conversationId, secondData.conversationId);

    ids.projects.push(firstData.learningProjectId as string);

    const draftCount = await prisma.learningProject.count({
      where: { createdBy: learner.id, status: 'DRAFT' },
    });
    const conversationCount = await prisma.aiConversation.count({
      where: {
        learningProjectId: firstData.learningProjectId as string,
        mode: 'PROJECT_AUTHORING',
      },
    });
    const messageCount = await prisma.aiMessage.count({
      where: { conversationId: firstData.conversationId as string },
    });

    assert.equal(draftCount, 1);
    assert.equal(conversationCount, 1);
    assert.equal(messageCount, 1);
  });

  test('distinct idempotency key creates a second independent draft', async () => {
    const learner = await createLearner('second-draft');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const ideaText = 'Design a recycled-material birdhouse learning project.';
    const body = {
      ideaText,
      categoryId: category.id,
      difficulty: 'BEGINNER' as const,
    };

    const first = await createAuthoringDraft(token, {
      ...body,
      idempotencyKey: idempotencyKey('first'),
    });
    const second = await createAuthoringDraft(token, {
      ...body,
      idempotencyKey: idempotencyKey('second'),
    });

    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 201);

    const firstData = first.json.data as Record<string, unknown>;
    const secondData = second.json.data as Record<string, unknown>;
    assert.notEqual(firstData.learningProjectId, secondData.learningProjectId);
    assert.notEqual(firstData.conversationId, secondData.conversationId);

    ids.projects.push(firstData.learningProjectId as string);
    ids.projects.push(secondData.learningProjectId as string);
  });

  test('invalid idea inputs reject without writes', async () => {
    const learner = await createLearner('invalid-idea');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const beforeCount = await prisma.learningProject.count({
      where: { createdBy: learner.id },
    });

    const cases = [
      { ideaText: '', label: 'empty' },
      { ideaText: '   \n\t  ', label: 'whitespace' },
      { ideaText: 'too short', label: 'short' },
      {
        ideaText: 'x'.repeat(10001),
        label: 'long',
      },
    ];

    for (const testCase of cases) {
      const result = await createAuthoringDraft(token, {
        ideaText: testCase.ideaText,
        categoryId: category.id,
        difficulty: 'BEGINNER',
        idempotencyKey: idempotencyKey(testCase.label),
      });
      assert.ok(
        result.response.status === 400,
        `expected 400 for ${testCase.label}, got ${result.response.status}`,
      );
    }

    const afterCount = await prisma.learningProject.count({
      where: { createdBy: learner.id },
    });
    assert.equal(afterCount, beforeCount);
  });

  test('invalid category inputs reject without writes', async () => {
    const learner = await createLearner('invalid-category');
    const inactiveCategory = await createProjectCategory({ isActive: false });
    const materialCategory = await createMaterialCategory();
    const token = tokenFor(learner.id);
    const beforeCount = await prisma.learningProject.count({
      where: { createdBy: learner.id },
    });
    const ideaText = 'Build a weather station using recycled sensors.';

    const malformed = await createAuthoringDraft(token, {
      ideaText,
      categoryId: '',
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('malformed-category'),
    });
    assert.equal(malformed.response.status, 400);

    const missing = await createAuthoringDraft(token, {
      ideaText,
      categoryId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('missing-category'),
    });
    assert.equal(missing.response.status, 400);
    assert.equal(missing.json.error?.code, 'INVALID_CATEGORY');

    const inactive = await createAuthoringDraft(token, {
      ideaText,
      categoryId: inactiveCategory.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('inactive-category'),
    });
    assert.equal(inactive.response.status, 400);
    assert.equal(inactive.json.error?.code, 'INVALID_CATEGORY');

    const materialOnly = await createAuthoringDraft(token, {
      ideaText,
      categoryId: materialCategory.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('material-category'),
    });
    assert.equal(materialOnly.response.status, 400);
    assert.equal(materialOnly.json.error?.code, 'INVALID_CATEGORY');

    const afterCount = await prisma.learningProject.count({
      where: { createdBy: learner.id },
    });
    assert.equal(afterCount, beforeCount);
  });

  test('invalid difficulty rejects without writes', async () => {
    const learner = await createLearner('invalid-difficulty');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const beforeCount = await prisma.learningProject.count({
      where: { createdBy: learner.id },
    });

    const result = await apiFetch('/api/learning-projects/mine/ai-authoring-drafts', {
      method: 'POST',
      token,
      idempotencyKey: idempotencyKey('bad-difficulty'),
      body: {
        ideaText: 'Build a recycled-material weather station for schools.',
        categoryId: category.id,
        difficulty: 'EXPERT',
      },
    });

    assert.equal(result.response.status, 400);
    const afterCount = await prisma.learningProject.count({
      where: { createdBy: learner.id },
    });
    assert.equal(afterCount, beforeCount);
  });

  test('strict body rejects sensitive injected fields', async () => {
    const learner = await createLearner('injection');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const beforeCount = await prisma.learningProject.count({
      where: { createdBy: learner.id },
    });

    const injections = [
      { userId: learner.id },
      { createdBy: learner.id },
      { status: 'PUBLISHED' },
      { conversationId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { mode: 'BUILD_GUIDE' },
      { projectBuildId: '00000000-0000-0000-0000-000000000001' },
      { submittedAt: new Date().toISOString() },
    ];

    for (const extra of injections) {
      const result = await apiFetch('/api/learning-projects/mine/ai-authoring-drafts', {
        method: 'POST',
        token,
        idempotencyKey: idempotencyKey(`inject-${Object.keys(extra)[0]}`),
        body: {
          ideaText: 'Build a recycled-material weather station for schools.',
          categoryId: category.id,
          difficulty: 'BEGINNER',
          ...extra,
        },
      });
      assert.equal(result.response.status, 400, JSON.stringify(extra));
    }

    const afterCount = await prisma.learningProject.count({
      where: { createdBy: learner.id },
    });
    assert.equal(afterCount, beforeCount);
  });

  test('unauthenticated and non-learner requests are rejected without writes', async () => {
    const learner = await createLearner('auth-policy');
    const supplier = await createSupplier();
    const category = await createProjectCategory();
    const beforeCount = await prisma.learningProject.count();

    const unauth = await createAuthoringDraft('', {
      ideaText: 'Build a recycled-material weather station for schools.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('unauth'),
    });
    assert.equal(unauth.response.status, 401);

    const supplierAttempt = await createAuthoringDraft(tokenFor(supplier.id, ['SUPPLIER']), {
      ideaText: 'Build a recycled-material weather station for schools.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('supplier'),
    });
    assert.equal(supplierAttempt.response.status, 403);

    const afterCount = await prisma.learningProject.count();
    assert.equal(afterCount, beforeCount);

    const learnerDraftCount = await prisma.learningProject.count({
      where: { createdBy: learner.id },
    });
    assert.equal(learnerDraftCount, 0);
  });

  test('reopen existing DRAFT returns the same conversation without duplicate message', async () => {
    const learner = await createLearner('reopen');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const draft = await createOwnedDraftProject({
      createdBy: learner.id,
      categoryId: category.id,
      status: 'DRAFT',
    });

    const first = await apiFetch(
      `/api/learning-projects/mine/${draft.id}/authoring-conversation`,
      {
        method: 'POST',
        token,
        body: { locale: 'en' },
      },
    );
    const second = await apiFetch(
      `/api/learning-projects/mine/${draft.id}/authoring-conversation`,
      {
        method: 'POST',
        token,
        body: { locale: 'en' },
      },
    );

    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 200);

    const firstData = first.json.data as Record<string, unknown>;
    const secondData = second.json.data as Record<string, unknown>;
    assert.equal(firstData.conversationId, secondData.conversationId);

    const conversationCount = await prisma.aiConversation.count({
      where: { learningProjectId: draft.id, mode: 'PROJECT_AUTHORING' },
    });
    const messageCount = await prisma.aiMessage.count({
      where: { conversationId: firstData.conversationId as string },
    });
    assert.equal(conversationCount, 1);
    assert.equal(messageCount, 0);
  });

  test('cross-user reopen is denied without leaking project existence', async () => {
    const owner = await createLearner('owner');
    const other = await createLearner('other');
    const category = await createProjectCategory();
    const draft = await createOwnedDraftProject({
      createdBy: owner.id,
      categoryId: category.id,
      status: 'DRAFT',
    });

    const denied = await apiFetch(
      `/api/learning-projects/mine/${draft.id}/authoring-conversation`,
      {
        method: 'POST',
        token: tokenFor(other.id),
        body: {},
      },
    );

    assert.equal(denied.response.status, 404);
    assert.equal(denied.json.error?.code, 'NOT_FOUND');

    const conversationCount = await prisma.aiConversation.count({
      where: { learningProjectId: draft.id, mode: 'PROJECT_AUTHORING' },
    });
    assert.equal(conversationCount, 0);
  });

  test('non-DRAFT projects cannot enter authoring conversation flow', async () => {
    const learner = await createLearner('status-guard');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    for (const status of ['PENDING_REVIEW', 'PUBLISHED', 'REJECTED'] as const) {
      const project = await createOwnedDraftProject({
        createdBy: learner.id,
        categoryId: category.id,
        status,
        title: `${TEST_MARKER} ${status}`,
      });

      const result = await apiFetch(
        `/api/learning-projects/mine/${project.id}/authoring-conversation`,
        {
          method: 'POST',
          token,
          body: {},
        },
      );

      assert.equal(result.response.status, 404, status);
      const conversationCount = await prisma.aiConversation.count({
        where: { learningProjectId: project.id, mode: 'PROJECT_AUTHORING' },
      });
      assert.equal(conversationCount, 0, status);
    }
  });

  test('concurrent reopen creates only one authoring conversation', async () => {
    const learner = await createLearner('concurrency');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const draft = await createOwnedDraftProject({
      createdBy: learner.id,
      categoryId: category.id,
      status: 'DRAFT',
      title: `${TEST_MARKER} concurrent draft`,
    });

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        apiFetch(`/api/learning-projects/mine/${draft.id}/authoring-conversation`, {
          method: 'POST',
          token,
          body: {},
        }),
      ),
    );

    for (const result of results) {
      assert.equal(result.response.status, 200);
    }

    const conversationIds = new Set(
      results.map((result) => (result.json.data as Record<string, unknown>).conversationId),
    );
    assert.equal(conversationIds.size, 1);

    const conversationCount = await prisma.aiConversation.count({
      where: { learningProjectId: draft.id, mode: 'PROJECT_AUTHORING' },
    });
    assert.equal(conversationCount, 1);
  });

  test('PROJECT_AUTHORING message send is isolated from general learning agent flows', async () => {
    countingProvider.answerCalls = 0;
    const learner = await createLearner('routing');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Build a low-power soil moisture monitor for seedlings.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('routing'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);
    const conversationId = data.conversationId as string;
    const projectBefore = await prisma.learningProject.findUnique({
      where: { id: data.learningProjectId as string },
    });

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/authoring/start`,
      { method: 'POST', token },
    );
    assert.equal(bootstrap.response.status, 201);
    assert.equal(countingProvider.answerCalls, 0);

    const messageAttempt = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token,
        body: {
          text: 'Automatic pump with USB power for one plant.',
          locale: 'en',
          clientMessageId: clientMessageId('routing'),
        },
      },
    );

    assert.equal(messageAttempt.response.status, 201);
    assert.equal(countingProvider.answerCalls, 0);
    const blocks = (messageAttempt.json.data as Record<string, unknown>)
      .contentBlocks as Array<Record<string, unknown>>;
    assert.ok(
      blocks.some((block) => block.type === 'project_authoring_clarification'),
    );

    const projectAfter = await prisma.learningProject.findUnique({
      where: { id: data.learningProjectId as string },
    });
    assert.equal(projectAfter!.updatedAt.getTime(), projectBefore!.updatedAt.getTime());

    const pendingActions = await prisma.aiPendingAction.count({
      where: { conversationId },
    });
    assert.equal(pendingActions, 0);
  });

  test('created DRAFT is loadable and editable through existing mine detail and patch APIs', async () => {
    const learner = await createLearner('edit-flow');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const ideaText = 'Create a classroom compost monitoring kit with simple sensors.';
    const derived = deriveAuthoringDraftFields(ideaText);

    const created = await createAuthoringDraft(token, {
      ideaText,
      categoryId: category.id,
      difficulty: 'INTERMEDIATE',
      idempotencyKey: idempotencyKey('edit-flow'),
    });
    const projectId = (created.json.data as Record<string, unknown>)
      .learningProjectId as string;
    ids.projects.push(projectId);

    const detail = await apiFetch(`/api/learning-projects/mine/${projectId}`, {
      token,
    });
    assert.equal(detail.response.status, 200);
    const detailData = detail.json.data as Record<string, unknown>;
    assert.equal(detailData.status, 'DRAFT');
    assert.equal(detailData.title, derived.title);
    assert.deepEqual(detailData.requiredComponents, []);
    assert.deepEqual(detailData.steps, []);

    const patched = await apiFetch(`/api/learning-projects/mine/${projectId}`, {
      method: 'PATCH',
      token,
      body: {
        categoryId: category.id,
        title: `${TEST_MARKER} updated draft title`,
        shortDescription: `${TEST_MARKER} updated short description for draft.`,
        description: `${TEST_MARKER} updated full description for draft project.`,
        difficulty: 'ADVANCED',
        estimatedDurationMinutes: 120,
        requiredComponents: [],
        steps: [],
        links: [],
      },
    });
    assert.equal(patched.response.status, 200);
    const patchedData = patched.json.data as Record<string, unknown>;
    assert.equal(patchedData.title, `${TEST_MARKER} updated draft title`);
    assert.equal(patchedData.difficulty, 'ADVANCED');
  });
});
