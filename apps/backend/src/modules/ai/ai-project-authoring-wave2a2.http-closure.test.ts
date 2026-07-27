import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, afterEach, before, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'ai-project-authoring-wave2a2-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'ai-project-authoring-wave2a2-refresh-secret';
process.env.NODE_TEST_CONTEXT ??= '1';
process.env.AI_CHAT_PROVIDER = 'mock';
process.env.AI_CHAT_RATE_LIMIT_PER_USER = '60';
process.env.AI_CHAT_MAX_CONVERSATIONS_PER_HOUR = '60';

const TEST_MARKER = '[test-ai-project-authoring-wave2a2]';

type ApiJson = {
  success?: boolean;
  data?: Record<string, unknown>;
  error?: { code?: string };
};

const ids = { users: [] as string[], categories: [] as string[], projects: [] as string[] };

let baseUrl = '';
let server: Server | null = null;
let prisma: typeof import('../../database/prisma.js').prisma;
let signAccessToken: typeof import('../../utils/jwt.js').signAccessToken;
let hashPassword: typeof import('../../utils/password.js').hashPassword;
let resetRateLimitersForTests: typeof import('../../middlewares/rate-limit.middleware.js').resetRateLimitersForTests;
let deleteAiDataForUsers: typeof import('../ai/ai.repository.js').deleteAiDataForUsers;
let setAuthoringClarificationGeneratorForTests: typeof import('../ai/ai-project-authoring-clarification.provider.js').setAuthoringClarificationGeneratorForTests;
let setAuthoringRealClarificationInvokerForTests: typeof import('../ai/ai-project-authoring-real.provider.js').setAuthoringRealClarificationInvokerForTests;
let getAuthoringRealClarificationInvokerCallCountForTests: typeof import('../ai/ai-project-authoring-real.provider.js').getAuthoringRealClarificationInvokerCallCountForTests;
let getLastAuthoringValidationDiagnosticForTests: typeof import('../ai/ai-project-authoring-clarification.provider.js').getLastAuthoringValidationDiagnosticForTests;
let resetAuthoringValidationDiagnosticForTests: typeof import('../ai/ai-project-authoring-clarification.provider.js').resetAuthoringValidationDiagnosticForTests;
let computeAuthoringTopicState: typeof import('../ai/ai-project-authoring-clarification.provider.js').computeAuthoringTopicState;
let evaluateAuthoringReadiness: typeof import('../ai/ai-project-authoring-clarification.provider.js').evaluateAuthoringReadiness;
let normalizeAuthoringProviderPayload: typeof import('../ai/ai-project-authoring-clarification.provider.js').normalizeAuthoringProviderPayload;
let MAX_AUTHORING_CLARIFICATION_QUESTIONS: typeof import('../ai/ai-project-authoring.service.js').MAX_AUTHORING_CLARIFICATION_QUESTIONS;

const savedEnv = {
  aiChatProvider: process.env.AI_CHAT_PROVIDER,
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
};

function configureGeminiPath() {
  process.env.AI_CHAT_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'test-gemini-key-wave2a2';
  delete process.env.OPENAI_API_KEY;
}

function restoreProviderEnv() {
  process.env.AI_CHAT_PROVIDER = savedEnv.aiChatProvider ?? 'mock';
  if (savedEnv.geminiApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = savedEnv.geminiApiKey;
  if (savedEnv.openaiApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedEnv.openaiApiKey;
}

function validClarificationJson(input: {
  status?: 'NEEDS_CLARIFICATION' | 'READY_FOR_PROPOSAL';
  questionKey?: string;
  locale?: 'en' | 'ar';
  answerType?: 'FREE_TEXT' | 'SINGLE_CHOICE';
  options?: string[];
}) {
  const status = input.status ?? 'NEEDS_CLARIFICATION';
  const questionKey = input.questionKey ?? 'available_tools';
  const locale = input.locale ?? 'en';
  const answerType = input.answerType ?? 'SINGLE_CHOICE';
  const options =
    input.options ??
    (answerType === 'FREE_TEXT'
      ? []
      : locale === 'ar'
        ? ['مقص', 'صمغ حراري']
        : ['Scissors', 'Hot glue gun']);

  return JSON.stringify({
    clarification: {
      type: 'project_authoring_clarification',
      status,
      summary: locale === 'ar' ? 'ملخص المشروع.' : 'Project summary.',
      knownFacts: [
        {
          key: 'project_idea',
          label: 'Project idea',
          value: 'idea',
          source: 'IDEA',
        },
      ],
      nextQuestion:
        status === 'READY_FOR_PROPOSAL'
          ? null
          : {
              key: questionKey,
              prompt: locale === 'ar' ? 'ما الأدوات المتاحة؟' : 'Which tools can you access?',
              answerType,
              options,
            },
      remainingTopics: status === 'READY_FOR_PROPOSAL' ? 0 : 2,
      assumptions: [],
      warnings: [],
    },
    assistantText: locale === 'ar' ? 'لنكمل.' : 'Let us continue.',
  });
}

function capturedInvalidCraftResponse() {
  return JSON.stringify({
    clarification: {
      type: 'project_authoring_clarification',
      status: 'NEEDS_CLARIFICATION',
      summary: 'Cardboard organizer idea.',
      knownFacts: [],
      nextQuestion: {
        key: 'project_goal',
        prompt: 'What size compartments do you need?',
        answerType: 'free_text',
        options: ['Small', 'Medium'],
      },
      remainingTopics: 2,
      assumptions: [],
      warnings: [],
    },
    assistantText: 'Let us clarify the organizer.',
  });
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
      learnerProfile: { create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' } },
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
  options: { method?: string; token?: string; body?: unknown; idempotencyKey?: string } = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { response, json: (await response.json()) as ApiJson };
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
  const project = await prisma.learningProject.findUnique({ where: { id: projectId } });
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
  return blocks.find((block) => block.type === 'project_authoring_clarification');
}

before(async () => {
  const prismaModule = await import('../../database/prisma.js');
  prisma = prismaModule.prisma;
  ({ signAccessToken } = await import('../../utils/jwt.js'));
  ({ hashPassword } = await import('../../utils/password.js'));
  ({ resetRateLimitersForTests } = await import('../../middlewares/rate-limit.middleware.js'));
  ({ deleteAiDataForUsers } = await import('../ai/ai.repository.js'));
  ({ setAuthoringClarificationGeneratorForTests } = await import(
    '../ai/ai-project-authoring-clarification.provider.js'
  ));
  ({
    setAuthoringRealClarificationInvokerForTests,
    getAuthoringRealClarificationInvokerCallCountForTests,
  } = await import('../ai/ai-project-authoring-real.provider.js'));
  ({
    getLastAuthoringValidationDiagnosticForTests,
    resetAuthoringValidationDiagnosticForTests,
    computeAuthoringTopicState,
    evaluateAuthoringReadiness,
    normalizeAuthoringProviderPayload,
  } = await import('../ai/ai-project-authoring-clarification.provider.js'));
  ({ MAX_AUTHORING_CLARIFICATION_QUESTIONS } = await import(
    '../ai/ai-project-authoring.service.js'
  ));

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
  resetAuthoringValidationDiagnosticForTests();
  restoreProviderEnv();
  process.env.AI_CHAT_PROVIDER = 'mock';
});

after(async () => {
  restoreProviderEnv();
  if (ids.projects.length > 0) {
    await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
  }
  await deleteAiDataForUsers(ids.users);
  if (ids.users.length > 0) {
    await prisma.idempotencyRecord.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }
  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('AI project authoring wave 2A.2 topic policy', () => {
  test('difficulty in DRAFT satisfies learner_skill_level', () => {
    const state = computeAuthoringTopicState({
      ideaText: 'Arduino watering project.',
      projectTitle: null,
      projectShortDescription: null,
      projectDescription: null,
      categoryName: null,
      difficulty: 'BEGINNER',
      answeredQuestionKeys: [],
      answeredQuestionCount: 0,
    });
    assert.ok(state.satisfiedTopics.includes('learner_skill_level'));
    assert.equal(state.unresolvedTopics.includes('learner_skill_level'), false);
  });

  test('USB-powered detailed idea satisfies power_source and readiness', () => {
    const context = {
      ideaText:
        'USB-powered Arduino soil dryness alert using moisture sensor and LED for one indoor plant, without a pump, under 50 NIS.',
      projectTitle: null,
      projectShortDescription: null,
      projectDescription: null,
      categoryName: null,
      difficulty: 'BEGINNER',
      answeredQuestionKeys: [],
      answeredQuestionCount: 0,
    };
    const state = computeAuthoringTopicState(context);
    assert.ok(state.satisfiedTopics.includes('power_source'));
    assert.ok(state.satisfiedTopics.includes('expected_behavior'));
    assert.ok(state.satisfiedTopics.includes('project_scale'));
    assert.ok(state.satisfiedTopics.includes('budget'));
    const readiness = evaluateAuthoringReadiness(context, state);
    assert.equal(readiness.ready, true);
  });

  test('craft organizer does not treat power_source as unresolved', () => {
    const state = computeAuthoringTopicState({
      ideaText: 'I want to build a recycled cardboard desk organizer.',
      projectTitle: null,
      projectShortDescription: null,
      projectDescription: null,
      categoryName: null,
      difficulty: 'BEGINNER',
      answeredQuestionKeys: [],
      answeredQuestionCount: 0,
    });
    assert.equal(state.domain, 'craft');
    assert.equal(state.unresolvedTopics.includes('power_source'), false);
    assert.equal(state.unresolvedTopics.includes('required_technology'), false);
  });

  test('normalization fixes FREE_TEXT options and enum casing', () => {
    const normalized = normalizeAuthoringProviderPayload(
      JSON.parse(capturedInvalidCraftResponse()),
    ) as {
      clarification: { nextQuestion: { answerType: string; options: string[] } };
    };
    assert.equal(normalized.clarification.nextQuestion.answerType, 'FREE_TEXT');
    assert.deepEqual(normalized.clarification.nextQuestion.options, []);
  });
});

describe('AI project authoring wave 2A.2 HTTP closure', () => {
  test('cardboard organizer uses server readiness or craft question without power topic', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => ({
      text: validClarificationJson({ questionKey: 'available_tools' }),
      model: 'gemini-test',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const learner = await createLearner('craft-organizer');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const created = await createAuthoringDraft(token, {
      ideaText: 'I want to build a recycled cardboard desk organizer for my desk.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: `craft-${Date.now()}`,
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);
    const before = await snapshotProject(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 201);
    const clarification = clarificationFromTurn(bootstrap.json);
    assert.ok(clarification);
    const nextKey = (clarification?.nextQuestion as { key?: string } | null)?.key ?? null;
    if (clarification?.status === 'NEEDS_CLARIFICATION') {
      assert.notEqual(nextKey, 'power_source');
      assert.notEqual(nextKey, 'required_technology');
    }
    assert.deepEqual(await snapshotProject(data.learningProjectId as string), before);
  });

  test('captured-equivalent invalid craft output is repaired and persisted', async () => {
    configureGeminiPath();
    let call = 0;
    setAuthoringRealClarificationInvokerForTests(async () => {
      call += 1;
      if (call === 1) {
        return {
          text: JSON.stringify({
            clarification: {
              type: 'project_authoring_clarification',
              status: 'NEEDS_CLARIFICATION',
              summary: 'Cardboard organizer idea.',
              knownFacts: [
                {
                  key: 'project_idea',
                  label: 'Project idea',
                  value: 'organizer',
                  source: 'IDEA',
                },
              ],
              nextQuestion: {
                key: 'project_scale',
                prompt: 'What size compartments do you need?',
                answerType: 'SINGLE_CHOICE',
                options: ['Only one size'],
              },
              remainingTopics: 2,
              assumptions: [],
              warnings: [],
            },
            assistantText: 'Let us clarify the organizer.',
          }),
          model: 'gemini-test',
          inputTokens: 1,
          outputTokens: 1,
        };
      }
      return {
        text: validClarificationJson({ questionKey: 'available_tools' }),
        model: 'gemini-test',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    const learner = await createLearner('craft-repair');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const created = await createAuthoringDraft(token, {
      ideaText: 'Recycled cardboard desk organizer for school supplies.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: `craft-repair-${Date.now()}`,
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 201);
    assert.equal(getAuthoringRealClarificationInvokerCallCountForTests(), 2);
    const diagnostic = getLastAuthoringValidationDiagnosticForTests();
    assert.ok(diagnostic);
    assert.equal(diagnostic?.stage, 'provider_schema');
  });

  test('two invalid responses return AI_RESPONSE_INVALID with no assistant block', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => ({
      text: JSON.stringify({
        clarification: {
          type: 'project_authoring_clarification',
          status: 'NEEDS_CLARIFICATION',
          summary: 'bad',
          knownFacts: [],
          nextQuestion: {
            key: 'project_goal',
            prompt: 'x',
            answerType: 'SINGLE_CHOICE',
            options: ['only-one'],
          },
          remainingTopics: 1,
          assumptions: [],
          warnings: [],
        },
        assistantText: 'invalid',
      }),
      model: 'gemini-test',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const learner = await createLearner('two-invalid');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino watering monitor.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: `two-invalid-${Date.now()}`,
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);
    const conversationId = data.conversationId as string;
    const before = await snapshotProject(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 502);
    assert.equal(bootstrap.json.error?.code, 'AI_RESPONSE_INVALID');
    const assistantCount = await prisma.aiMessage.count({
      where: { conversationId, role: 'ASSISTANT' },
    });
    assert.equal(assistantCount, 0);
    const conversation = await prisma.aiConversation.findUnique({ where: { id: conversationId } });
    assert.equal(conversation?.processingState, 'IDLE');
    assert.deepEqual(await snapshotProject(data.learningProjectId as string), before);
  });

  test('detailed USB soil alert returns READY without learner skill question', async () => {
    const learner = await createLearner('detailed-ready');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const created = await createAuthoringDraft(token, {
      ideaText:
        'USB-powered Arduino soil dryness alert using moisture sensor and LED for one indoor plant, without a pump, under 50 NIS.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: `detailed-${Date.now()}`,
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 201);
    const clarification = clarificationFromTurn(bootstrap.json);
    assert.equal(clarification?.status, 'READY_FOR_PROPOSAL');
    assert.equal(clarification?.nextQuestion, null);
    const meta = bootstrap.json.data?.meta as Record<string, unknown> | undefined;
    assert.equal(meta?.provider, 'server-readiness');
  });

  test('provider asking satisfied learner_skill_level is rejected to READY', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => ({
      text: validClarificationJson({ questionKey: 'learner_skill_level' }),
      model: 'gemini-test',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const learner = await createLearner('reject-satisfied');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino smart watering for one plant with USB power and alert only.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: `reject-satisfied-${Date.now()}`,
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${data.conversationId}/authoring/start`,
      { method: 'POST', token },
    );

    assert.equal(bootstrap.response.status, 201);
    const clarification = clarificationFromTurn(bootstrap.json);
    assert.equal(clarification?.status, 'READY_FOR_PROPOSAL');
  });

  test('refresh reopen restores latest clarification without duplicate bootstrap', async () => {
    configureGeminiPath();
    setAuthoringRealClarificationInvokerForTests(async () => ({
      text: validClarificationJson({ questionKey: 'expected_behavior' }),
      model: 'gemini-test',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const learner = await createLearner('reopen');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino smart watering system for beginners.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: `reopen-${Date.now()}`,
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);
    const conversationId = data.conversationId as string;
    const projectId = data.learningProjectId as string;

    const bootstrap = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/authoring/start`,
      { method: 'POST', token },
    );
    const firstKey = (
      (clarificationFromTurn(bootstrap.json)?.nextQuestion as { key?: string })?.key
    );

    for (let index = 0; index < 2; index += 1) {
      const turn = await apiFetch(`/api/ai/v1/conversations/${conversationId}/messages`, {
        method: 'POST',
        token,
        body: {
          text: `Answer ${index + 1}`,
          locale: 'en',
          clientMessageId: `reopen-${index}-${Date.now()}`,
        },
      });
      assert.equal(turn.response.status, 201);
    }

    const before = await snapshotProject(projectId);
    const invokerCallsBeforeReopen = getAuthoringRealClarificationInvokerCallCountForTests();
    const reopen = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/authoring/start`,
      { method: 'POST', token },
    );
    assert.equal(reopen.response.status, 201);
    assert.equal(
      getAuthoringRealClarificationInvokerCallCountForTests(),
      invokerCallsBeforeReopen,
    );
    const latest = clarificationFromTurn(reopen.json);
    assert.ok(latest);
    const latestKey = (latest?.nextQuestion as { key?: string } | null)?.key ?? null;
    if (latest?.status === 'NEEDS_CLARIFICATION') {
      assert.notEqual(latestKey, firstKey);
    }
    assert.deepEqual(await snapshotProject(projectId), before);
  });

  test('maximum question behavior remains bounded', async () => {
    const learner = await createLearner('max-questions');
    const category = await createProjectCategory();
    const token = tokenFor(learner.id);
    const created = await createAuthoringDraft(token, {
      ideaText: 'Arduino watering monitor for classroom seedlings.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      idempotencyKey: `max-${Date.now()}`,
    });
    const data = created.json.data as Record<string, unknown>;
    ids.projects.push(data.learningProjectId as string);
    const conversationId = data.conversationId as string;

    await apiFetch(`/api/ai/v1/conversations/${conversationId}/authoring/start`, {
      method: 'POST',
      token,
    });

    for (let index = 0; index < MAX_AUTHORING_CLARIFICATION_QUESTIONS; index += 1) {
      const turn = await apiFetch(`/api/ai/v1/conversations/${conversationId}/messages`, {
        method: 'POST',
        token,
        body: {
          text: `Answer ${index + 1}`,
          locale: 'en',
          clientMessageId: `max-${index}-${Date.now()}`,
        },
      });
      assert.equal(turn.response.status, 201);
    }

    const finalTurn = await apiFetch(`/api/ai/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      token,
      body: {
        text: 'One more detail',
        locale: 'en',
        clientMessageId: `max-final-${Date.now()}`,
      },
    });
    assert.equal(clarificationFromTurn(finalTurn.json)?.status, 'READY_FOR_PROPOSAL');
  });
});
