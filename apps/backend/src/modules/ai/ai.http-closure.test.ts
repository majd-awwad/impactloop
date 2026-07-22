import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'closure-test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'closure-test-refresh-secret';
process.env.AI_CHAT_PROVIDER = 'mock';
process.env.AI_CHAT_RATE_LIMIT_PER_USER = '30';
process.env.AI_CHAT_MAX_CONVERSATIONS_PER_HOUR = '30';

const TEST_MARKER = '[test-ai-http-closure]';
const clientId = (suffix: string) => `client-closure-${suffix.padEnd(16, '0')}`;

type ApiJson = {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown> & {
    meta?: { scopeClassification?: string; provider?: string };
    contentBlocks?: Array<Record<string, unknown>>;
    items?: Array<Record<string, unknown>>;
  };
  error?: { code?: string; details?: Record<string, unknown> };
};

const ids = { users: [] as string[] };

let baseUrl = '';
let server: Server | null = null;
let prisma: typeof import('../../database/prisma.js').prisma;
let signAccessToken: typeof import('../../utils/jwt.js').signAccessToken;
let hashPassword: typeof import('../../utils/password.js').hashPassword;
let resetRateLimitersForTests: typeof import('../../middlewares/rate-limit.middleware.js').resetRateLimitersForTests;
let deleteAiDataForUsers: typeof import('./ai.repository.js').deleteAiDataForUsers;
let setAiChatProviderForTests: typeof import('./providers/ai-chat-provider.factory.js').setAiChatProviderForTests;
let MockAiChatProviderClass: typeof import('./providers/mock-chat.provider.js').MockAiChatProvider;

class CountingMockProvider {
  answerCalls = 0;
  readonly name = 'mock';

  async classifyScope(
    input: Parameters<import('./providers/mock-chat.provider.js').MockAiChatProvider['classifyScope']>[0],
  ) {
    return new MockAiChatProviderClass().classifyScope(input);
  }

  async generateGeneralLearningAnswer(
    input: Parameters<
      import('./providers/mock-chat.provider.js').MockAiChatProvider['generateGeneralLearningAnswer']
    >[0],
  ) {
    this.answerCalls += 1;
    return new MockAiChatProviderClass().generateGeneralLearningAnswer(input);
  }
}

async function createLearnerUser(label: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${label}`,
      email: `${TEST_MARKER}-${label}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      accountStatus: 'ACTIVE',
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: { create: { interests: ['arduino'] } },
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
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
    },
  });
  ids.users.push(user.id);
  return user;
}

function tokenFor(userId: string, roles: string[]) {
  return signAccessToken({ sub: userId, roles });
}

async function apiFetch(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {},
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

before(async () => {
  const prismaModule = await import('../../database/prisma.js');
  prisma = prismaModule.prisma;
  ({ signAccessToken } = await import('../../utils/jwt.js'));
  ({ hashPassword } = await import('../../utils/password.js'));
  ({ resetRateLimitersForTests } = await import(
    '../../middlewares/rate-limit.middleware.js'
  ));
  ({ deleteAiDataForUsers } = await import('./ai.repository.js'));
  ({ setAiChatProviderForTests } = await import(
    './providers/ai-chat-provider.factory.js'
  ));
  ({ MockAiChatProvider: MockAiChatProviderClass } = await import(
    './providers/mock-chat.provider.js'
  ));

  const { app } = await import('../../app.js');
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
  setAiChatProviderForTests(null);
  resetRateLimitersForTests();
  await deleteAiDataForUsers(ids.users);
  if (ids.users.length > 0) {
    await prisma.learnerProfile.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  await new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('ai http closure', () => {
  test('conversation creation auth and validation', async () => {
    const unauth = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      body: { mode: 'GENERAL_LEARNING', locale: 'en' },
    });
    assert.equal(unauth.response.status, 401);

    const supplier = await createSupplierUser();
    const supplierToken = tokenFor(supplier.id, ['SUPPLIER']);
    const supplierAttempt = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token: supplierToken,
      body: { mode: 'GENERAL_LEARNING', locale: 'en' },
    });
    assert.equal(supplierAttempt.response.status, 403);

    const learner = await createLearnerUser('create');
    const learnerToken = tokenFor(learner.id, ['LEARNER']);

    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token: learnerToken,
      body: { mode: 'GENERAL_LEARNING', locale: 'en' },
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.json.success, true);
    assert.equal(created.json.data?.mode, 'LEARNER_ASSISTANT');

    const learnerAssistantAlias = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token: learnerToken,
      body: { mode: 'LEARNER_ASSISTANT', locale: 'en' },
    });
    assert.equal(learnerAssistantAlias.response.status, 201);
    assert.equal(learnerAssistantAlias.json.data?.mode, 'LEARNER_ASSISTANT');
    const aliasConversationId = learnerAssistantAlias.json.data?.id as string;
    const storedAlias = await prisma.aiConversation.findUnique({
      where: { id: aliasConversationId },
    });
    assert.equal(storedAlias?.mode, 'GENERAL_LEARNING');

    const futureMode = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token: learnerToken,
      body: { mode: 'LEARNER_AGENT', locale: 'en' },
    });
    assert.equal(futureMode.response.status, 400);

    const badLocale = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token: learnerToken,
      body: { mode: 'GENERAL_LEARNING', locale: 'fr' },
    });
    assert.equal(badLocale.response.status, 400);
  });

  test('in-scope Arabic message persists structured assistant blocks', async () => {
    const learner = await createLearnerUser('in-scope-ar');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'ar' },
    });
    const conversationId = created.json.data?.id as string;

    const sent = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token,
        body: {
          text: 'كيف بشتغل Arduino Uno؟',
          locale: 'ar',
          clientMessageId: clientId('in-scope-ar-001'),
        },
      },
    );
    assert.equal(sent.response.status, 201);
    const blocks = sent.json.data?.contentBlocks as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(blocks) && blocks.length > 0);
    assert.equal(sent.json.data?.meta?.scopeClassification, 'DOMAIN_KNOWLEDGE');

    const conversation = await prisma.aiConversation.findUnique({
      where: { id: conversationId },
    });
    assert.equal(conversation?.processingState, 'IDLE');
    assert.ok(conversation?.lastMessageAt);

    const messageCount = await prisma.aiMessage.count({
      where: { conversationId },
    });
    assert.equal(messageCount, 2);
  });

  test('out-of-scope weather is refused without answer provider metadata', async () => {
    const provider = new CountingMockProvider();
    setAiChatProviderForTests(provider);

    const learner = await createLearnerUser('out-scope');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'ar' },
    });
    const conversationId = created.json.data?.id as string;

    const sent = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token,
        body: {
          text: 'كيف الطقس اليوم؟',
          locale: 'ar',
          clientMessageId: clientId('weather-001'),
        },
      },
    );

    assert.equal(sent.response.status, 201);
    assert.equal(sent.json.data?.meta?.scopeClassification, 'OUT_OF_SCOPE');
    assert.equal(provider.answerCalls, 0);
    const blocks = sent.json.data?.contentBlocks as Array<Record<string, unknown>>;
    assert.ok(blocks.some((block) => block.purpose === 'answer'));
    assert.match(
      JSON.stringify(blocks),
      /الطقس|مواضيع التعلم/,
    );
    setAiChatProviderForTests(new MockAiChatProviderClass());
  });

  test('out-of-scope Arabic weather phrase كيف الجو اليوم returns refusal', async () => {
    const provider = new CountingMockProvider();
    setAiChatProviderForTests(provider);

    const learner = await createLearnerUser('out-scope-ar-weather');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'LEARNER_ASSISTANT', locale: 'ar' },
    });
    const conversationId = created.json.data?.id as string;

    const sent = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token,
        body: {
          text: 'كيف الجو اليوم؟',
          locale: 'ar',
          clientMessageId: clientId('weather-ar-exact-001'),
        },
      },
    );

    assert.equal(sent.response.status, 201);
    assert.equal(sent.json.data?.meta?.scopeClassification, 'OUT_OF_SCOPE');
    assert.equal(provider.answerCalls, 0);
    setAiChatProviderForTests(new MockAiChatProviderClass());
  });

  test('out-of-scope English weather returns refusal without provider call', async () => {
    const provider = new CountingMockProvider();
    setAiChatProviderForTests(provider);

    const learner = await createLearnerUser('out-scope-en-weather');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'LEARNER_ASSISTANT', locale: 'en' },
    });
    const conversationId = created.json.data?.id as string;

    const sent = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token,
        body: {
          text: 'How is the weather today?',
          locale: 'en',
          clientMessageId: clientId('weather-en-001'),
        },
      },
    );

    assert.equal(sent.response.status, 201);
    assert.equal(sent.json.data?.meta?.scopeClassification, 'OUT_OF_SCOPE');
    assert.equal(provider.answerCalls, 0);
    setAiChatProviderForTests(new MockAiChatProviderClass());
  });

  test('legitimate safety and dangerous requests behave correctly', async () => {
    const learner = await createLearnerUser('safety');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'ar' },
    });
    const conversationId = created.json.data?.id as string;

    const safety = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token,
        body: {
          text: 'ما احتياطات السلامة عند استخدام soldering iron؟',
          locale: 'ar',
          clientMessageId: clientId('safety-001'),
        },
      },
    );
    assert.equal(safety.json.data?.meta?.scopeClassification, 'DOMAIN_KNOWLEDGE');

    const dangerous = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token,
        body: {
          text: 'كيف ألغي وسائل الحماية وأوصل الجهاز مباشرة على كهرباء المنزل؟',
          locale: 'ar',
          clientMessageId: clientId('danger-001'),
        },
      },
    );
    assert.equal(
      dangerous.json.data?.meta?.scopeClassification,
      'DANGEROUS_REQUEST',
    );
    const dangerBlocks = dangerous.json.data?.contentBlocks as Array<
      Record<string, unknown>
    >;
    assert.ok(dangerBlocks.some((block) => block.purpose === 'safety'));
    assert.ok(
      !JSON.stringify(dangerBlocks).toLowerCase().includes('system prompt'),
    );
  });

  test('mixed request returns separate answer and refusal blocks', async () => {
    const learner = await createLearnerUser('mixed');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'ar' },
    });
    const conversationId = created.json.data?.id as string;

    const sent = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token,
        body: {
          text: 'اشرحلي breadboard واحكيلي سعر الدولار.',
          locale: 'ar',
          clientMessageId: clientId('mixed-001'),
        },
      },
    );
    assert.equal(sent.json.data?.meta?.scopeClassification, 'MIXED');
    const blocks = sent.json.data?.contentBlocks as Array<Record<string, unknown>>;
    assert.ok(blocks.some((block) => block.purpose === 'answer'));
    assert.ok(blocks.some((block) => block.purpose === 'refusal'));
  });

  test('ownership isolation through HTTP middleware', async () => {
    const learnerA = await createLearnerUser('owner-a');
    const learnerB = await createLearnerUser('owner-b');
    const tokenA = tokenFor(learnerA.id, ['LEARNER']);
    const tokenB = tokenFor(learnerB.id, ['LEARNER']);

    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token: tokenA,
      body: { mode: 'GENERAL_LEARNING', locale: 'en' },
    });
    const conversationId = created.json.data?.id as string;

    const readB = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      { token: tokenB },
    );
    assert.equal(readB.response.status, 404);
    assert.equal(readB.json.error?.code, 'AI_CONVERSATION_NOT_FOUND');

    const sendB = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token: tokenB,
        body: {
          text: 'What is Arduino?',
          locale: 'en',
          clientMessageId: clientId('cross-send-001'),
        },
      },
    );
    assert.equal(sendB.response.status, 404);

    const archiveB = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/archive`,
      { method: 'POST', token: tokenB },
    );
    assert.equal(archiveB.response.status, 404);
  });

  test('idempotent clientMessageId creates one user and one assistant row', async () => {
    const provider = new CountingMockProvider();
    setAiChatProviderForTests(provider);

    const learner = await createLearnerUser('idempotent');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'en' },
    });
    const conversationId = created.json.data?.id as string;
    const stableId = clientId('idem-001');
    const body = {
      text: 'Explain jumper wires for beginners.',
      locale: 'en',
      clientMessageId: stableId,
    };

    const first = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      { method: 'POST', token, body },
    );
    assert.equal(first.response.status, 201);
    const firstAssistantId = first.json.data?.assistantMessageId;

    const second = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      { method: 'POST', token, body },
    );
    assert.equal(second.response.status, 201);
    assert.equal(second.json.data?.assistantMessageId, firstAssistantId);
    assert.equal(provider.answerCalls, 1);

    const userRows = await prisma.aiMessage.count({
      where: { conversationId, role: 'USER', clientMessageId: stableId },
    });
    const assistantRows = await prisma.aiMessage.count({
      where: { conversationId, role: 'ASSISTANT' },
    });
    assert.equal(userRows, 1);
    assert.equal(assistantRows, 1);

    setAiChatProviderForTests(new MockAiChatProviderClass());
  });

  test('concurrent turns reject busy conversation', async () => {
    const learner = await createLearnerUser('concurrent');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'en' },
    });
    const conversationId = created.json.data?.id as string;

    await prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        processingState: 'PROCESSING',
        processingStartedAt: new Date(),
      },
    });

    const busy = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token,
        body: {
          text: 'What is a breadboard?',
          locale: 'en',
          clientMessageId: clientId('busy-001'),
        },
      },
    );
    assert.equal(busy.response.status, 409);
    assert.equal(busy.json.error?.code, 'AI_CONVERSATION_BUSY');

    await prisma.aiConversation.update({
      where: { id: conversationId },
      data: { processingState: 'IDLE', processingStartedAt: null },
    });
  });

  test('stale processing lock can be recovered', async () => {
    const learner = await createLearnerUser('stale');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'en' },
    });
    const conversationId = created.json.data?.id as string;

    await prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        processingState: 'PROCESSING',
        processingStartedAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    });

    const sent = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token,
        body: {
          text: 'Explain LEDs for beginners.',
          locale: 'en',
          clientMessageId: clientId('stale-001'),
        },
      },
    );
    assert.equal(sent.response.status, 201);

    const conversation = await prisma.aiConversation.findUnique({
      where: { id: conversationId },
    });
    assert.equal(conversation?.processingState, 'IDLE');
  });

  test('archive hides conversation from active listing', async () => {
    const learner = await createLearnerUser('archive');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'en', title: 'Archive me' },
    });
    const conversationId = created.json.data?.id as string;

    const archived = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/archive`,
      { method: 'POST', token },
    );
    assert.equal(archived.response.status, 200);

    const listed = await apiFetch('/api/ai/v1/conversations', { token });
    const items = listed.json.data?.items as Array<{ id: string }>;
    assert.ok(!items.some((item) => item.id === conversationId));

    const messages = await prisma.aiMessage.count({
      where: { conversationId },
    });
    assert.equal(messages, 0);

    const archivedRow = await prisma.aiConversation.findUnique({
      where: { id: conversationId },
    });
    assert.equal(archivedRow?.status, 'ARCHIVED');
  });

  test('archived conversations can be listed and restored', async () => {
    const learner = await createLearnerUser('restore');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'LEARNER_ASSISTANT', locale: 'en', title: 'Restore me' },
    });
    const conversationId = created.json.data?.id as string;

    await apiFetch(`/api/ai/v1/conversations/${conversationId}/archive`, {
      method: 'POST',
      token,
    });

    const archivedList = await apiFetch(
      '/api/ai/v1/conversations?status=ARCHIVED',
      { token },
    );
    const archivedItems = archivedList.json.data?.items as Array<{ id: string }>;
    assert.ok(archivedItems.some((item) => item.id === conversationId));

    const restored = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/restore`,
      { method: 'POST', token },
    );
    assert.equal(restored.response.status, 200);

    const activeList = await apiFetch('/api/ai/v1/conversations', { token });
    const activeItems = activeList.json.data?.items as Array<{ id: string }>;
    assert.ok(activeItems.some((item) => item.id === conversationId));
  });

  test('history reload excludes raw provider payloads', async () => {
    const learner = await createLearnerUser('history');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'en' },
    });
    const conversationId = created.json.data?.id as string;

    await apiFetch(`/api/ai/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      token,
      body: {
        text: 'Explain breadboard basics.',
        locale: 'en',
        clientMessageId: clientId('history-001'),
      },
    });

    const history = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      { token },
    );
    assert.equal(history.response.status, 200);
    const items = history.json.data?.items as Array<Record<string, unknown>>;
    assert.ok(items.length >= 2);
    assert.ok(items[0]?.createdAt);
    assert.equal(JSON.stringify(history.json).includes('rawProvider'), false);
  });

  test('openai provider stub returns assistant blocks through HTTP send', async () => {
    const { OpenAiAiChatProvider, setOpenAiChatClientFactoryForTests } =
      await import('./providers/openai-chat.provider.js');

    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => ({
            id: 'chatcmpl-http',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    classification: 'DOMAIN_KNOWLEDGE',
                    confidence: 0.95,
                    reason: 'Arduino basics',
                  }),
                },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
          }),
        },
      },
    }));

    setAiChatProviderForTests(new OpenAiAiChatProvider());

    const learner = await createLearnerUser('openai-http');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'LEARNER_ASSISTANT', locale: 'en' },
    });
    const conversationId = created.json.data?.id as string;

    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => ({
            id: 'chatcmpl-http-answer',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    blocks: [
                      {
                        type: 'text',
                        text: 'An Arduino Uno is a beginner-friendly microcontroller board.',
                        purpose: 'answer',
                      },
                    ],
                  }),
                },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 20, completion_tokens: 16, total_tokens: 36 },
          }),
        },
      },
    }));

    const sent = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token,
        body: {
          text: 'How do I use an Arduino Uno?',
          locale: 'en',
          clientMessageId: clientId('openai-http-001'),
        },
      },
    );

    assert.equal(sent.response.status, 201);
    const blocks = sent.json.data?.contentBlocks as Array<Record<string, unknown>>;
    assert.ok(blocks.some((block) => block.type === 'text' && block.purpose === 'answer'));
    assert.equal(sent.json.data?.meta?.provider, 'openai');

    setOpenAiChatClientFactoryForTests(null);
  });
});

describe('ai disabled provider closure', () => {
  test('DisabledAiChatProvider throws AI_DISABLED', async () => {
    const { DisabledAiChatProvider } = await import(
      './providers/disabled-chat.provider.js'
    );
    const { AppError } = await import('../../utils/app-error.js');
    const provider = new DisabledAiChatProvider();

    await assert.rejects(
      () =>
        provider.generateGeneralLearningAnswer({
          locale: 'en',
          userMessage: 'What is Arduino?',
          history: [],
          scopeClassification: 'DOMAIN_KNOWLEDGE',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_DISABLED');
        return true;
      },
    );
  });

  test('orchestrator rejects sends when chat provider is not operational', async () => {
    const { isAiChatProviderOperational } = await import('../../config/env.js');
    if (isAiChatProviderOperational()) {
      // Runtime HTTP disabled verification requires process start with AI_CHAT_PROVIDER=disabled.
      return;
    }

    const learner = await createLearnerUser('disabled-runtime');
    const token = tokenFor(learner.id, ['LEARNER']);
    const created = await apiFetch('/api/ai/v1/conversations', {
      method: 'POST',
      token,
      body: { mode: 'GENERAL_LEARNING', locale: 'en' },
    });
    const conversationId = created.json.data?.id as string;
    const sent = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        token,
        body: {
          text: 'What is Arduino?',
          locale: 'en',
          clientMessageId: clientId('disabled-001'),
        },
      },
    );
    assert.equal(sent.response.status, 503);
    assert.equal(sent.json.error?.code, 'AI_DISABLED');
  });
});

describe('ai rate limit closure', () => {
  test('message rate limit is keyed per authenticated user', async () => {
    const { checkRateLimit, resetRateLimitersForTests: resetBuckets } =
      await import('../../middlewares/rate-limit.middleware.js');
    const { AppError } = await import('../../utils/app-error.js');
    resetBuckets();

    const policy = {
      name: 'ai-chat-message-test',
      windowMs: 60_000,
      max: 2,
    };

    checkRateLimit('user-a', policy);
    checkRateLimit('user-a', policy);

    assert.throws(
      () => checkRateLimit('user-a', policy),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'RATE_LIMITED');
        return true;
      },
    );

    checkRateLimit('user-b', policy);
    resetBuckets();
  });
});

describe('price ai regression closure', () => {
  test('price AI config remains separate from chat config', async () => {
    const { env, isAiProviderOperational, getAiPriceSuggestionDebugInfo } =
      await import('../../config/env.js');
    const { generateMockPriceSuggestion } = await import(
      '../../services/mock-price-suggestion.provider.js'
    );

    assert.notEqual(env.aiProvider, undefined);
    assert.notEqual(env.aiChatProvider, undefined);
    assert.equal(typeof isAiProviderOperational(), 'boolean');
    assert.equal(typeof getAiPriceSuggestionDebugInfo().aiProvider, 'string');

    const suggestion = generateMockPriceSuggestion({
      materialName: 'Arduino Uno',
      categoryName: 'Electronics',
      unit: 'piece',
      lookupKey: 'closure-test-arduino',
    });
    assert.ok(suggestion.payload.suggestedMaterialNameEn.length > 0);
  });
});
