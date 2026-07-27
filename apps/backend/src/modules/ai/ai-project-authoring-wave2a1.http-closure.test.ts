import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, afterEach, before, describe, test } from 'node:test';

import type {
  AiChatClassifyScopeInput,
  AiChatGenerateAnswerInput,
} from './providers/ai-chat-provider.types.js';

process.env.JWT_ACCESS_SECRET ??= 'ai-project-authoring-wave2a1-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'ai-project-authoring-wave2a1-refresh-secret';
process.env.NODE_TEST_CONTEXT ??= '1';
process.env.AI_CHAT_RATE_LIMIT_PER_USER = '60';
process.env.AI_CHAT_MAX_CONVERSATIONS_PER_HOUR = '60';

const TEST_MARKER = '[test-ai-project-authoring-wave2a1]';

type ApiJson = {
  success?: boolean;
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
let setAuthoringClarificationGeneratorForTests: typeof import('../ai/ai-project-authoring-clarification.provider.js').setAuthoringClarificationGeneratorForTests;
let getLastAuthoringClarificationRouteForTests: typeof import('../ai/ai-project-authoring-clarification.provider.js').getLastAuthoringClarificationRouteForTests;
let resetAuthoringClarificationCallCountForTests: typeof import('../ai/ai-project-authoring-clarification.provider.js').resetAuthoringClarificationCallCountForTests;
let getAuthoringClarificationCallCountForTests: typeof import('../ai/ai-project-authoring-clarification.provider.js').getAuthoringClarificationCallCountForTests;
let setAuthoringRealClarificationInvokerForTests: typeof import('../ai/ai-project-authoring-real.provider.js').setAuthoringRealClarificationInvokerForTests;
let getAuthoringRealClarificationInvokerCallCountForTests: typeof import('../ai/ai-project-authoring-real.provider.js').getAuthoringRealClarificationInvokerCallCountForTests;
let MockAiChatProviderClass: typeof import('../ai/providers/mock-chat.provider.js').MockAiChatProvider;
let AppError: typeof import('../../utils/app-error.js').AppError;

class CountingGeneralProvider {
  answerCalls = 0;
  readonly name = 'mock';

  async classifyScope(
    input: AiChatClassifyScopeInput,
  ) {
    return new MockAiChatProviderClass().classifyScope(input);
  }

  async generateGeneralLearningAnswer(
    input: AiChatGenerateAnswerInput,
  ) {
    this.answerCalls += 1;
    return new MockAiChatProviderClass().generateGeneralLearningAnswer(input);
  }
}

let countingProvider: CountingGeneralProvider;

function realInvokerCalls() {
  return getAuthoringRealClarificationInvokerCallCountForTests();
}

const savedEnv = {
  aiChatProvider: process.env.AI_CHAT_PROVIDER,
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
};

function validRealClarificationJson(input: {
  locale?: 'en' | 'ar';
  status?: 'NEEDS_CLARIFICATION' | 'READY_FOR_PROPOSAL';
  questionKey?: string;
  repeatedKey?: boolean;
  invalidSchema?: boolean;
}) {
  const locale = input.locale ?? 'en';
  const status = input.status ?? 'NEEDS_CLARIFICATION';

  if (input.invalidSchema) {
    return JSON.stringify({
      clarification: {
        type: 'project_authoring_clarification',
        status: 'NEEDS_CLARIFICATION',
        summary: 'bad',
        knownFacts: [],
        nextQuestion: null,
        remainingTopics: 1,
        assumptions: [],
        warnings: [],
      },
      assistantText: 'invalid',
    });
  }

  const questionKey =
    input.questionKey ?? (input.repeatedKey ? 'expected_behavior' : 'power_source');

  return JSON.stringify({
    clarification: {
      type: 'project_authoring_clarification',
      status,
      summary:
        locale === 'ar'
          ? 'أفهم فكرة مشروع Arduino للري الذكي.'
          : 'I understand your Arduino smart watering project idea.',
      knownFacts: [
        {
          key: 'project_idea',
          label: locale === 'ar' ? 'فكرة المشروع' : 'Project idea',
          value: 'Arduino watering',
          source: 'IDEA',
        },
      ],
      nextQuestion:
        status === 'READY_FOR_PROPOSAL'
          ? null
          : {
              key: questionKey,
              prompt:
                locale === 'ar'
                  ? 'هل تريد مضخة تلقائية أم تنبيه فقط؟'
                  : 'Should the pump run automatically or alert only?',
              answerType: 'SINGLE_CHOICE',
              options:
                locale === 'ar'
                  ? ['مضخة تلقائية', 'تنبيه فقط']
                  : ['Automatic pump', 'Alert only'],
            },
      remainingTopics: status === 'READY_FOR_PROPOSAL' ? 0 : 3,
      assumptions: [],
      warnings: [],
    },
    assistantText:
      locale === 'ar'
        ? 'لنحدد سلوك النظام بوضوح.'
        : 'Let us clarify the expected system behavior.',
  });
}

function restoreProviderEnv() {
  if (savedEnv.aiChatProvider === undefined) {
    delete process.env.AI_CHAT_PROVIDER;
  } else {
    process.env.AI_CHAT_PROVIDER = savedEnv.aiChatProvider;
  }

  if (savedEnv.geminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = savedEnv.geminiApiKey;
  }

  if (savedEnv.openaiApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = savedEnv.openaiApiKey;
  }
}

function configureGeminiPath() {
  process.env.AI_CHAT_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'test-gemini-key-wave2a1';
  delete process.env.OPENAI_API_KEY;
}

function configureOpenAiPath() {
  process.env.AI_CHAT_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-openai-key-wave2a1';
  delete process.env.GEMINI_API_KEY;
}

function configureMockPath() {
  process.env.AI_CHAT_PROVIDER = 'mock';
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
}

function idempotencyKey(label: string) {
  return `authoring2a1.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`.slice(
    0,
    128,
  );
}

function clientMessageId(label: string) {
  return `client-authoring2a1-${label}-${Date.now()}`.slice(0, 64);
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

async function createProjectCategory() {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Projects`,
      nameAr: `${TEST_MARKER} مشاريع`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
}

function tokenFor(userId: string) {
  return signAccessToken({ sub: userId, roles: ['LEARNER'] });
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

async function snapshotProject(projectId: string) {
  const project = await prisma.learningProject.findUnique({
    where: { id: projectId },
  });
  assert.ok(project);
  return {
    title: project.title,
    shortDescription: project.shortDescription,
    description: project.description,
    categoryId: project.categoryId,
    difficulty: project.difficulty,
    status: project.status,
    updatedAt: project.updatedAt.toISOString(),
  };
}

function clarificationFromTurn(json: ApiJson) {
  const blocks = (json.data?.contentBlocks ?? []) as Array<Record<string, unknown>>;
  return blocks.find((block) => block.type === 'project_authoring_clarification') as
    | Record<string, unknown>
    | undefined;
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
  ({
    setAuthoringClarificationGeneratorForTests,
    getLastAuthoringClarificationRouteForTests,
    resetAuthoringClarificationCallCountForTests,
    getAuthoringClarificationCallCountForTests,
  } = await import('../ai/ai-project-authoring-clarification.provider.js'));
  ({ setAuthoringRealClarificationInvokerForTests, getAuthoringRealClarificationInvokerCallCountForTests } = await import(
    '../ai/ai-project-authoring-real.provider.js'
  ));
  ({ MockAiChatProvider: MockAiChatProviderClass } = await import(
    '../ai/providers/mock-chat.provider.js'
  ));
  ({ AppError } = await import('../../utils/app-error.js'));

  countingProvider = new CountingGeneralProvider();
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

afterEach(() => {
  setAuthoringClarificationGeneratorForTests(null);
  setAuthoringRealClarificationInvokerForTests(null);
  restoreProviderEnv();
  configureMockPath();
  resetAuthoringClarificationCallCountForTests();
  countingProvider.answerCalls = 0;
});

after(async () => {
  setAiChatProviderForTests(null);
  setAuthoringClarificationGeneratorForTests(null);
  setAuthoringRealClarificationInvokerForTests(null);
  restoreProviderEnv();
  resetAuthoringClarificationCallCountForTests();
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

describe('AI project authoring wave 2A.1 real provider integration', () => {
  test('configured Gemini path is selected with fake structured invoker', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async ({ provider }) => {
      assert.equal(provider, 'gemini');
      return {
        text: validRealClarificationJson({ locale: 'en' }),
        model: 'gemini-test-model',
        inputTokens: 100,
        outputTokens: 80,
      };
    });

    const learner = await createLearner('gemini-path');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'I want to build a beginner smart watering system using Arduino.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('gemini-path'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId as string}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 201);
    assert.equal(getLastAuthoringClarificationRouteForTests(), 'gemini');
    assert.equal(realInvokerCalls(), 1);
    assert.equal(countingProvider.answerCalls, 0);
    assert.ok(clarificationFromTurn(bootstrap.json));
  });

  test('configured OpenAI path is selected with fake structured invoker', async () => {
    configureOpenAiPath();
    setAuthoringRealClarificationInvokerForTests(async ({ provider }) => {
      assert.equal(provider, 'openai');
      return {
        text: validRealClarificationJson({ locale: 'en', questionKey: 'expected_behavior' }),
        model: 'gpt-test-model',
        inputTokens: 90,
        outputTokens: 70,
      };
    });

    const learner = await createLearner('openai-path');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino smart watering for one plant.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('openai-path'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId as string}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 201);
    assert.equal(getLastAuthoringClarificationRouteForTests(), 'openai');
    assert.equal(realInvokerCalls, 1);
  });

  test('explicit mock provider uses deterministic clarification generator', async () => {
    configureMockPath();

    const learner = await createLearner('mock-path');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino watering monitor.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('mock-path'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId as string}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 201);
    assert.equal(getLastAuthoringClarificationRouteForTests(), 'mock');
    assert.equal(realInvokerCalls(), 0);
    assert.equal(getAuthoringClarificationCallCountForTests(), 1);
  });

  test('test override supersedes configured Gemini provider', async () => {
    configureGeminiPath();
    setAuthoringClarificationGeneratorForTests(() => ({
      provider: 'override-test',
      model: 'override-model',
      data: {
        assistantText: 'override clarification',
        clarification: {
          type: 'project_authoring_clarification',
          status: 'NEEDS_CLARIFICATION',
          summary: 'Override summary for authoring.',
          knownFacts: [
            {
              key: 'project_idea',
              label: 'Project idea',
              value: 'override',
              source: 'IDEA',
            },
          ],
          nextQuestion: {
            key: 'project_goal',
            prompt: 'What is the main outcome?',
            answerType: 'FREE_TEXT',
            options: [],
          },
          remainingTopics: 2,
          assumptions: [],
          warnings: [],
        },
      },
      usage: { inputTokens: 1, outputTokens: 1 },
      latencyMs: 1,
    }));

    const learner = await createLearner('override-path');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino watering.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('override-path'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId as string}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 201);
    assert.equal(getLastAuthoringClarificationRouteForTests(), 'override');
    assert.equal(realInvokerCalls, 0);
    assert.match(
      String(clarificationFromTurn(bootstrap.json)?.summary),
      /Override summary/,
    );
  });

  test('valid real-provider structured response persists with unchanged project snapshot', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => ({
      text: validRealClarificationJson({ locale: 'en' }),
      model: 'gemini-test-model',
      inputTokens: 50,
      outputTokens: 40,
    }));

    const learner = await createLearner('valid-real');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino smart watering system.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('valid-real'),
    });
    const data = created.json.data as Record<string, unknown>;
    const projectId = data.learningProjectId as string;
    ids.projects.push(projectId);
    const before = await snapshotProject(projectId);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId as string}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 201);
    const clarification = clarificationFromTurn(bootstrap.json);
    assert.equal(clarification?.status, 'NEEDS_CLARIFICATION');
    assert.deepEqual(await snapshotProject(projectId), before);
  });

  test('Arabic structured real-provider response persists correctly', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => ({
      text: validRealClarificationJson({ locale: 'ar' }),
      model: 'gemini-test-model',
      inputTokens: 50,
      outputTokens: 40,
    }));

    const learner = await createLearner('arabic-real');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'بدي أعمل نظام تنبيه لجفاف التربة باستخدام Arduino وLED بدون مضخة.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      locale: 'ar',
      idempotencyKey: idempotencyKey('arabic-real'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId as string}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 201);
    const clarification = clarificationFromTurn(bootstrap.json);
    assert.match(String(clarification?.summary), /Arduino|مشروع/u);
    assert.match(
      String((clarification?.nextQuestion as Record<string, unknown> | undefined)?.prompt),
      /مضخة|تنبيه/u,
    );
  });

  test('detailed idea can return READY_FOR_PROPOSAL from real provider', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => ({
      text: validRealClarificationJson({ status: 'READY_FOR_PROPOSAL' }),
      model: 'gemini-test-model',
      inputTokens: 50,
      outputTokens: 40,
    }));

    const learner = await createLearner('ready-real');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText:
        'USB-powered Arduino soil dryness alert using moisture sensor and LED for one indoor plant without pump under 50 NIS.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('ready-real'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId as string}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 201);
    assert.equal(clarificationFromTurn(bootstrap.json)?.status, 'READY_FOR_PROPOSAL');
  });

  test('malformed JSON triggers one repair attempt then stable error', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => ({
      text: 'not-json',
      model: 'gemini-test-model',
      inputTokens: 10,
      outputTokens: 5,
    }));

    const learner = await createLearner('malformed-json');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino watering.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('malformed-json'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);
    const conversationId = data.conversationId as string;

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 502);
    assert.equal(bootstrap.json.error?.code, 'AI_RESPONSE_INVALID');
    assert.equal(realInvokerCalls(), 2);

    const assistantCount = await prisma.aiMessage.count({
      where: { conversationId, role: 'ASSISTANT' },
    });
    assert.equal(assistantCount, 0);
  });

  test('schema-invalid response triggers repair then stable error without invalid block', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => ({
      text: validRealClarificationJson({ invalidSchema: true }),
      model: 'gemini-test-model',
      inputTokens: 10,
      outputTokens: 5,
    }));

    const learner = await createLearner('schema-invalid');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino watering.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('schema-invalid'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);
    const conversationId = data.conversationId as string;

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 502);
    assert.equal(bootstrap.json.error?.code, 'AI_RESPONSE_INVALID');
    assert.equal(realInvokerCalls, 2);
  });

  test('repeated question from real provider is repaired to READY fallback', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => ({
      text: validRealClarificationJson({ questionKey: 'expected_behavior' }),
      model: 'gemini-test-model',
      inputTokens: 10,
      outputTokens: 5,
    }));

    const learner = await createLearner('repeated-question');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino watering.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('repeated-question'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);
    const conversationId = data.conversationId as string;

    await apiFetch(`/api/ai/v1/conversations/${conversationId}/authoring/start`, {
      method: 'POST',
      token,
    });

    const answer = await apiFetch(`/api/ai/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      token,
      body: {
        text: 'Automatic pump',
        locale: 'en',
        clientMessageId: clientMessageId('repeated-question'),
      },
    });

    assert.equal(answer.response.status, 201);
    const clarification = clarificationFromTurn(answer.json);
    assert.equal(clarification?.status, 'READY_FOR_PROPOSAL');
    assert.equal(realInvokerCalls(), 3);
  });

  test('provider unavailable maps to AI_PROVIDER_ERROR', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => {
      throw new AppError(
        'The learning assistant is temporarily unavailable.',
        502,
        'AI_PROVIDER_ERROR',
      );
    });

    const learner = await createLearner('provider-error');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino watering.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('provider-error'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);
    const conversationId = data.conversationId as string;

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 502);
    assert.equal(bootstrap.json.error?.code, 'AI_PROVIDER_ERROR');
    assert.equal(realInvokerCalls, 1);
  });

  test('provider rate limit maps to AI_PROVIDER_RATE_LIMITED', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => {
      throw new AppError(
        'The learning assistant is temporarily busy. Please try again shortly.',
        429,
        'AI_PROVIDER_RATE_LIMITED',
      );
    });

    const learner = await createLearner('provider-rate-limit');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino watering.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('provider-rate-limit'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId as string}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 429);
    assert.equal(bootstrap.json.error?.code, 'AI_PROVIDER_RATE_LIMITED');
  });

  test('provider timeout maps to AI_PROVIDER_TIMEOUT', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => {
      throw new AppError(
        'The learning assistant timed out. Please try again.',
        504,
        'AI_PROVIDER_TIMEOUT',
      );
    });

    const learner = await createLearner('provider-timeout');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino watering.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('provider-timeout'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId as string}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 504);
    assert.equal(bootstrap.json.error?.code, 'AI_PROVIDER_TIMEOUT');
  });

  test('processing state returns to IDLE after provider failure', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => ({
      text: 'not-json',
      model: 'gemini-test-model',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const learner = await createLearner('idle-after-failure');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino watering.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('idle-after-failure'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);
    const conversationId = data.conversationId as string;

    await apiFetch(`/api/ai/v1/conversations/${conversationId}/authoring/start`, {
      method: 'POST',
      token,
    });

    const conversation = await prisma.aiConversation.findUnique({
      where: { id: conversationId },
    });
    assert.equal(conversation?.processingState, 'IDLE');
  });

  test('bootstrap idempotency avoids repeated real-provider calls', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => ({
      text: validRealClarificationJson({ locale: 'en' }),
      model: 'gemini-test-model',
      inputTokens: 10,
      outputTokens: 10,
    }));

    const learner = await createLearner('idempotent-real');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);

    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino watering.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: idempotencyKey('idempotent-real'),
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);
    const conversationId = data.conversationId as string;

    await apiFetch(`/api/ai/v1/conversations/${conversationId}/authoring/start`, {
      method: 'POST',
      token,
    });
    await apiFetch(`/api/ai/v1/conversations/${conversationId}/authoring/start`, {
      method: 'POST',
      token,
    });

    assert.equal(realInvokerCalls, 1);
  });
});
