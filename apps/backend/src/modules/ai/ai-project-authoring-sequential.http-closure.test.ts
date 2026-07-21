import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'ai-sequential-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'ai-sequential-refresh-secret';
process.env.NODE_TEST_CONTEXT ??= '1';
process.env.AI_CHAT_PROVIDER = 'mock';
process.env.AI_CHAT_RATE_LIMIT_PER_USER = '60';
process.env.AI_CHAT_MAX_CONVERSATIONS_PER_HOUR = '60';

const TEST_MARKER = '[test-ai-sequential-authoring]';

type ApiJson = {
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
let setAuthoringProposalGeneratorForTests: typeof import('../ai/ai-project-authoring-proposal.provider.js').setAuthoringProposalGeneratorForTests;
let generateMockAuthoringProposalForTests: typeof import('../ai/ai-project-authoring-proposal.provider.js').generateMockAuthoringProposalForTests;
let resetAuthoringProposalCallCountForTests: typeof import('../ai/ai-project-authoring-proposal.provider.js').resetAuthoringProposalCallCountForTests;
let setAuthoringRevisionGeneratorForTests: typeof import('../ai/ai-project-authoring-review.service.js').setAuthoringRevisionGeneratorForTests;
let setAiChatProviderForTests: typeof import('../ai/providers/ai-chat-provider.factory.js').setAiChatProviderForTests;
let MockAiChatProviderClass: typeof import('../ai/providers/mock-chat.provider.js').MockAiChatProvider;

function idempotencyKey(label: string) {
  return `authoring-seq.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`.slice(
    0,
    128,
  );
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
  const json = (await response.json()) as ApiJson;
  return { response, json };
}

function blockFromTurn(json: ApiJson, type: string) {
  const blocks = (json.data?.contentBlocks as Array<Record<string, unknown>>) ?? [];
  return blocks.find((block) => block.type === type);
}

function proposedTurnFromTurn(json: ApiJson) {
  const blocks = (json.data?.contentBlocks as Array<Record<string, unknown>>) ?? [];
  return blocks.find(
    (block) => block.type === 'project_authoring_turn' && block.status === 'PROPOSED',
  );
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
      locale: input.locale ?? 'en',
    },
  });
}

async function ensureReadySequentialSession(input?: { label?: string }) {
  const learner = await createLearner(input?.label ?? 'ready');
  const category = await createProjectCategory();
  const token = tokenFor(learner.id);
  const ideaText =
    'Beginner Arduino USB soil moisture alert for one plant with LED warning, no pump, low budget.';

  const created = await createAuthoringDraft(token, {
    ideaText,
    categoryId: category.id,
    difficulty: 'BEGINNER',
    idempotencyKey: idempotencyKey('draft'),
  });
  assert.equal(created.response.status, 201);
  const data = created.json.data as Record<string, unknown>;
  const projectId = data.learningProjectId as string;
  const conversationId = data.conversationId as string;
  ids.projects.push(projectId);

  const bootstrap = await apiFetch(
    `/api/ai/v1/conversations/${conversationId}/authoring/start`,
    { method: 'POST', token },
  );
  assert.equal(bootstrap.response.status, 201);
  const clarification = blockFromTurn(bootstrap.json, 'project_authoring_clarification');
  assert.equal(clarification?.status, 'READY_FOR_PROPOSAL');

  const overview = await apiFetch(
    `/api/ai/v1/conversations/${conversationId}/authoring/proposal`,
    { method: 'POST', token },
  );
  assert.equal(overview.response.status, 201);
  const session = blockFromTurn(overview.json, 'project_authoring_session');
  assert.equal(session?.stage, 'OVERVIEW');

  return { learner, token, projectId, conversationId, category, ideaText };
}

async function sequentialAction(
  token: string,
  conversationId: string,
  body: Record<string, unknown>,
) {
  return apiFetch(`/api/ai/v1/conversations/${conversationId}/authoring/sequential/action`, {
    method: 'POST',
    token,
    body,
  });
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
    setAuthoringProposalGeneratorForTests,
    resetAuthoringProposalCallCountForTests,
    generateMockAuthoringProposalForTests,
  } = await import('../ai/ai-project-authoring-proposal.provider.js'));
  ({ setAuthoringRevisionGeneratorForTests } = await import(
    '../ai/ai-project-authoring-review.service.js'
  ));
  ({ setAiChatProviderForTests } = await import('../ai/providers/ai-chat-provider.factory.js'));
  ({ MockAiChatProvider: MockAiChatProviderClass } = await import(
    '../ai/providers/mock-chat.provider.js'
  ));

  setAiChatProviderForTests(new MockAiChatProviderClass());
  setAuthoringProposalGeneratorForTests(generateMockAuthoringProposalForTests);

  const { app } = await import('../../app.js');
  process.env.AI_CHAT_PROVIDER = 'mock';
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server!.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
  resetRateLimitersForTests();
});

after(async () => {
  setAiChatProviderForTests(null);
  setAuthoringClarificationGeneratorForTests(null);
  setAuthoringProposalGeneratorForTests(null);
  setAuthoringRevisionGeneratorForTests(null);
  resetAuthoringProposalCallCountForTests();
  resetRateLimitersForTests();

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
    if (!server) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function reloadSessionFromDb(conversationId: string) {
  const { findLatestAuthoringSessionState } = await import(
    '../ai/ai-project-authoring-sequential.service.js'
  );
  const messages = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
  return findLatestAuthoringSessionState(messages)?.block ?? null;
}

async function latestSessionStage(conversationId: string) {
  const session = await reloadSessionFromDb(conversationId);
  return session?.stage ?? null;
}

async function latestProposedTurnId(conversationId: string) {
  const session = await reloadSessionFromDb(conversationId);
  if (session?.currentTurnId) {
    return session.currentTurnId;
  }

  const messages = await prisma.aiMessage.findMany({
    where: { conversationId, role: 'ASSISTANT' },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  for (const message of messages) {
    const blocks = Array.isArray(message.contentBlocks)
      ? (message.contentBlocks as Array<Record<string, unknown>>)
      : [];
    const turn = blocks.find(
      (block) =>
        block.type === 'project_authoring_turn' && block.status === 'PROPOSED',
    );
    if (turn?.turnId) {
      return turn.turnId as string;
    }
  }
  return null;
}

async function acceptLatestTurn(token: string, conversationId: string) {
  const turnId = await latestProposedTurnId(conversationId);
  assert.ok(turnId, 'expected a proposed turn');
  return sequentialAction(token, conversationId, {
    action: 'ACCEPT_TURN',
    turnId,
  });
}

async function advanceThroughBasicFields(token: string, conversationId: string) {
  await sequentialAction(token, conversationId, { action: 'START' });
  for (let guard = 0; guard < 6; guard += 1) {
    const stage = await latestSessionStage(conversationId);
    if (
      stage !== 'TITLE' &&
      stage !== 'SHORT_DESCRIPTION' &&
      stage !== 'FULL_DESCRIPTION' &&
      stage !== 'DIFFICULTY' &&
      stage !== 'ESTIMATED_DURATION'
    ) {
      return stage;
    }
    const accepted = await acceptLatestTurn(token, conversationId);
    assert.equal(accepted.response.status, 201);
  }
  return latestSessionStage(conversationId);
}

async function advanceToComponentsStage(token: string, conversationId: string) {
  const stage = await advanceThroughBasicFields(token, conversationId);
  assert.equal(stage, 'COMPONENTS');
}

async function advanceToStepsOverview(token: string, conversationId: string) {
  await advanceToComponentsStage(token, conversationId);
  const accepted = await acceptLatestTurn(token, conversationId);
  assert.equal(accepted.response.status, 201);
  assert.equal(await latestSessionStage(conversationId), 'STEPS_OVERVIEW');
}

async function advanceToFinalReview(token: string, conversationId: string) {
  await sequentialAction(token, conversationId, { action: 'START' });
  for (let guard = 0; guard < 24; guard += 1) {
    const stage = await latestSessionStage(conversationId);
    if (stage === 'FINAL_REVIEW' || stage === 'COMPLETE') {
      return stage;
    }
    if (stage === 'STEPS_OVERVIEW') {
      const session = await reloadSessionFromDb(conversationId);
      const turnId = session?.currentTurnId ?? (await latestProposedTurnId(conversationId));
      if (!turnId && !session?.stepReviewMode && !session?.awaitingStepsFinalSave) {
        const chosen = await sequentialAction(token, conversationId, {
          action: 'CHOOSE_MODE',
          mode: 'STEPS_FULL_PLAN',
        });
        if (chosen.response.status === 201) {
          continue;
        }
      }
    }
    const turnId = await latestProposedTurnId(conversationId);
    if (!turnId) {
      break;
    }
    const accepted = await sequentialAction(token, conversationId, {
      action: 'ACCEPT_TURN',
      turnId,
    });
    if (accepted.response.status !== 201) {
      break;
    }
  }
  return latestSessionStage(conversationId);
}

async function countProjectComponents(projectId: string) {
  return prisma.projectRequiredComponent.count({ where: { projectId } });
}

async function countProjectSteps(projectId: string) {
  return prisma.projectStep.count({ where: { projectId } });
}

describe('AI project authoring sequential', () => {
  test('overview start performs zero project writes', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'overview',
    });
    const before = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });

    const started = await sequentialAction(token, conversationId, { action: 'START' });
    assert.equal(started.response.status, 201);

    const after = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.equal(after.title, before.title);
    assert.equal(after.updatedAt.toISOString(), before.updatedAt.toISOString());
  });

  test('accept title updates title only', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'accept-title',
    });
    const before = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });

    const started = await sequentialAction(token, conversationId, { action: 'START' });
    const turn = blockFromTurn(started.json, 'project_authoring_turn');
    assert.ok(turn?.turnId);

    const accepted = await sequentialAction(token, conversationId, {
      action: 'ACCEPT_TURN',
      turnId: turn!.turnId as string,
    });
    assert.equal(accepted.response.status, 201);

    const project = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.notEqual(project.title, before.title);
    assert.equal(project.shortDescription, before.shortDescription);
    assert.equal(project.description, before.description);
    assert.equal(project.status, 'DRAFT');
  });

  test('duplicate title accept is idempotent', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'dup-accept',
    });
    const started = await sequentialAction(token, conversationId, { action: 'START' });
    const turn = blockFromTurn(started.json, 'project_authoring_turn');
    assert.ok(turn?.turnId);

    const first = await sequentialAction(token, conversationId, {
      action: 'ACCEPT_TURN',
      turnId: turn!.turnId as string,
    });
    assert.equal(first.response.status, 201);
    const afterFirst = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });

    const second = await sequentialAction(token, conversationId, {
      action: 'ACCEPT_TURN',
      turnId: turn!.turnId as string,
    });
    assert.equal(second.response.status, 201);
    const afterSecond = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.equal(afterSecond.title, afterFirst.title);
    assert.equal(afterSecond.updatedAt.toISOString(), afterFirst.updatedAt.toISOString());
  });

  test('suggest another performs zero project writes', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'suggest-another',
    });
    const started = await sequentialAction(token, conversationId, { action: 'START' });
    const turn = blockFromTurn(started.json, 'project_authoring_turn');
    const before = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });

    const revised = await sequentialAction(token, conversationId, {
      action: 'SUGGEST_ANOTHER',
      turnId: turn!.turnId as string,
      comment: 'Make the title shorter.',
    });
    assert.equal(revised.response.status, 201);
    const newTurn = proposedTurnFromTurn(revised.json);
    assert.notEqual(newTurn?.turnId, turn?.turnId);

    const after = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.equal(after.title, before.title);
    assert.equal(after.updatedAt.toISOString(), before.updatedAt.toISOString());
  });

  test('discussion persists user and assistant messages', async () => {
    const { token, conversationId } = await ensureReadySequentialSession({ label: 'discuss' });
    const started = await sequentialAction(token, conversationId, { action: 'START' });
    const turn = blockFromTurn(started.json, 'project_authoring_turn');

    const discussed = await apiFetch(
      `/api/ai/v1/conversations/${conversationId}/authoring/turns/${turn!.turnId}/discuss`,
      {
        method: 'POST',
        token,
        body: {
          comment: 'Why is this title better than a generic one?',
          clientMessageId: idempotencyKey('discuss'),
        },
      },
    );
    assert.equal(discussed.response.status, 201);

    const messages = await prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    const userDiscuss = messages.filter(
      (message) =>
        message.role === 'USER' &&
        message.contentText?.includes('Why is this title better'),
    );
    const assistantDiscuss = messages.filter(
      (message) =>
        message.role === 'ASSISTANT' &&
        message.id !== (discussed.json.data?.messageId as string | undefined),
    );
    assert.ok(userDiscuss.length >= 1);
    assert.ok(assistantDiscuss.length >= 1);
  });

  test('manual value save updates through domain service', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'manual',
    });
    await sequentialAction(token, conversationId, { action: 'START' });
    const manualTitle = 'My Custom Arduino Title';

    const saved = await sequentialAction(token, conversationId, {
      action: 'SAVE_MANUAL',
      manualValue: manualTitle,
    });
    assert.equal(saved.response.status, 201);

    const project = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.equal(project.title, manualTitle);
    assert.equal(project.status, 'DRAFT');
  });

  test('stale turn cannot overwrite manual edits', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'stale',
    });
    const started = await sequentialAction(token, conversationId, { action: 'START' });
    const turn = blockFromTurn(started.json, 'project_authoring_turn');

    await prisma.learningProject.update({
      where: { id: projectId },
      data: { title: 'Manual edit title' },
    });

    const stale = await sequentialAction(token, conversationId, {
      action: 'ACCEPT_TURN',
      turnId: turn!.turnId as string,
    });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.json.error?.code, 'AI_AUTHORING_PROPOSAL_STALE');

    const project = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.equal(project.title, 'Manual edit title');
  });

  test('finish authoring leaves project DRAFT', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'finish',
    });
    const stage = await advanceToFinalReview(token, conversationId);
    assert.equal(stage, 'FINAL_REVIEW');

    const finished = await sequentialAction(token, conversationId, { action: 'FINISH' });
    assert.equal(finished.response.status, 201);
    const project = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.equal(project.status, 'DRAFT');
    assert.equal(project.submittedAt, null);
  });

  test('cross-user turn is denied', async () => {
    const owner = await ensureReadySequentialSession({ label: 'owner' });
    const other = await createLearner('other');
    const otherToken = tokenFor(other.id);
    const started = await sequentialAction(owner.token, owner.conversationId, {
      action: 'START',
    });
    const turn = blockFromTurn(started.json, 'project_authoring_turn');

    const denied = await sequentialAction(otherToken, owner.conversationId, {
      action: 'ACCEPT_TURN',
      turnId: turn!.turnId as string,
    });
    assert.equal(denied.response.status, 404);
  });

  test('start creates title turn', async () => {
    const { token, conversationId } = await ensureReadySequentialSession({ label: 'start-title' });
    const started = await sequentialAction(token, conversationId, { action: 'START' });
    assert.equal(started.response.status, 201);

    const session = blockFromTurn(started.json, 'project_authoring_session');
    const turn = proposedTurnFromTurn(started.json);
    assert.equal(session?.stage, 'TITLE');
    assert.equal(turn?.stage, 'TITLE');
    assert.equal(turn?.status, 'PROPOSED');
    assert.ok(turn?.turnId);
    assert.ok('value' in ((turn?.proposal as Record<string, unknown>) ?? {}));
  });

  test('next turn uses refreshed updatedAt after title accept', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'refreshed-basis',
    });
    const before = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });

    await sequentialAction(token, conversationId, { action: 'START' });
    const titleTurnId = await latestProposedTurnId(conversationId);
    const titleAccepted = await sequentialAction(token, conversationId, {
      action: 'ACCEPT_TURN',
      turnId: titleTurnId!,
    });
    assert.equal(titleAccepted.response.status, 201);

    const afterTitle = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.notEqual(afterTitle.updatedAt.toISOString(), before.updatedAt.toISOString());

    const shortTurn = proposedTurnFromTurn(titleAccepted.json);
    assert.equal(shortTurn?.stage, 'SHORT_DESCRIPTION');
    assert.equal(shortTurn?.baseUpdatedAt, afterTitle.updatedAt.toISOString());

    const session = blockFromTurn(titleAccepted.json, 'project_authoring_session');
    assert.equal(session?.baseUpdatedAt, afterTitle.updatedAt.toISOString());
  });

  test('short and full descriptions apply independently', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'descriptions',
    });
    const before = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });

    await sequentialAction(token, conversationId, { action: 'START' });
    await acceptLatestTurn(token, conversationId);

    const afterTitle = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    await acceptLatestTurn(token, conversationId);

    const afterShort = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.notEqual(afterShort.shortDescription, before.shortDescription);
    assert.equal(afterShort.description, before.description);

    await acceptLatestTurn(token, conversationId);
    const afterFull = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.notEqual(afterFull.description, before.description);
    assert.equal(afterFull.shortDescription, afterShort.shortDescription);
  });

  test('difficulty and duration apply independently', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'difficulty-duration',
    });

    await sequentialAction(token, conversationId, { action: 'START' });
    await acceptLatestTurn(token, conversationId);
    await acceptLatestTurn(token, conversationId);
    await acceptLatestTurn(token, conversationId);

    const afterDescription = await prisma.learningProject.findUniqueOrThrow({
      where: { id: projectId },
    });
    assert.equal(afterDescription.difficulty, 'BEGINNER');

    await acceptLatestTurn(token, conversationId);
    const afterDifficulty = await prisma.learningProject.findUniqueOrThrow({
      where: { id: projectId },
    });
    assert.equal(afterDifficulty.difficulty, 'BEGINNER');
    assert.equal(afterDifficulty.estimatedDurationMinutes, afterDescription.estimatedDurationMinutes);

    await acceptLatestTurn(token, conversationId);
    const afterDuration = await prisma.learningProject.findUniqueOrThrow({
      where: { id: projectId },
    });
    assert.equal(afterDuration.estimatedDurationMinutes, 120);
    assert.equal(afterDuration.difficulty, 'BEGINNER');
  });

  test('components full-list accept saves atomically', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'components-full',
    });
    await advanceToComponentsStage(token, conversationId);
    const beforeCount = await countProjectComponents(projectId);

    await sequentialAction(token, conversationId, {
      action: 'CHOOSE_MODE',
      mode: 'COMPONENTS_FULL_LIST',
    });
    const accepted = await acceptLatestTurn(token, conversationId);
    assert.equal(accepted.response.status, 201);

    const afterCount = await countProjectComponents(projectId);
    assert.equal(beforeCount, 0);
    assert.ok(afterCount >= 4);
    assert.equal(await latestSessionStage(conversationId), 'STEPS_OVERVIEW');
  });

  test('component one-by-one persists working state without project writes', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'components-one-by-one',
    });
    await advanceToComponentsStage(token, conversationId);
    const beforeCount = await countProjectComponents(projectId);

    const chosen = await sequentialAction(token, conversationId, {
      action: 'CHOOSE_MODE',
      mode: 'COMPONENTS_ONE_BY_ONE',
    });
    assert.equal(chosen.response.status, 201);
    const sessionAfterChoose = blockFromTurn(chosen.json, 'project_authoring_session');
    assert.equal(sessionAfterChoose?.componentReviewMode, 'ONE_BY_ONE');
    assert.equal(sessionAfterChoose?.currentComponentIndex, 0);

    const firstAccepted = await acceptLatestTurn(token, conversationId);
    assert.equal(firstAccepted.response.status, 201);
    assert.equal(await countProjectComponents(projectId), beforeCount);

    const sessionAfterFirst = blockFromTurn(firstAccepted.json, 'project_authoring_session');
    assert.equal(sessionAfterFirst?.currentComponentIndex, 1);
    assert.ok((sessionAfterFirst?.acceptedComponentIndexes as number[])?.includes(0));
  });

  test('component removal works in one-by-one mode', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'component-remove',
    });
    await advanceToComponentsStage(token, conversationId);
    await sequentialAction(token, conversationId, {
      action: 'CHOOSE_MODE',
      mode: 'COMPONENTS_ONE_BY_ONE',
    });

    const removed = await sequentialAction(token, conversationId, {
      action: 'REMOVE_ITEM',
      manualValue: 0,
    });
    assert.equal(removed.response.status, 201);
    const session = blockFromTurn(removed.json, 'project_authoring_session');
    const turn = proposedTurnFromTurn(removed.json);
    assert.ok(session?.workingComponents);
    assert.ok(turn && 'total' in (turn.proposal as Record<string, unknown>));
    assert.equal(await countProjectComponents(projectId), 0);
  });

  test('component final save writes all reviewed components atomically', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'component-final',
    });
    await advanceToComponentsStage(token, conversationId);
    await sequentialAction(token, conversationId, {
      action: 'CHOOSE_MODE',
      mode: 'COMPONENTS_ONE_BY_ONE',
    });

    for (let guard = 0; guard < 12; guard += 1) {
      const session = await reloadSessionFromDb(conversationId);
      if (session?.awaitingComponentsFinalSave) {
        break;
      }
      const accepted = await acceptLatestTurn(token, conversationId);
      assert.equal(accepted.response.status, 201);
    }

    const beforeCount = await countProjectComponents(projectId);
    assert.equal(beforeCount, 0);

    const finalAccepted = await acceptLatestTurn(token, conversationId);
    assert.equal(finalAccepted.response.status, 201);
    const afterCount = await countProjectComponents(projectId);
    assert.ok(afterCount > 0);
    assert.equal(await latestSessionStage(conversationId), 'STEPS_OVERVIEW');
  });

  test('duplicate components are rejected on final component save', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'duplicate-components',
    });
    await advanceToComponentsStage(token, conversationId);
    await sequentialAction(token, conversationId, {
      action: 'CHOOSE_MODE',
      mode: 'COMPONENTS_ONE_BY_ONE',
    });

    for (let index = 0; index < 6; index += 1) {
      await sequentialAction(token, conversationId, {
        action: 'REMOVE_ITEM',
        manualValue: 0,
      });
    }

    const duplicateComponent = {
      componentName: 'Duplicate Test Sensor',
      materialType: 'Sensor',
      quantity: 1,
      unit: 'piece',
      componentRole: 'REQUIRED_MATERIAL' as const,
      isRequired: true,
      canBeSubstituted: false,
      searchKeywords: ['duplicate'],
      notes: null,
    };
    await sequentialAction(token, conversationId, {
      action: 'ADD_ITEM',
      manualValue: duplicateComponent,
    }).then((result) => assert.equal(result.response.status, 201));
    await sequentialAction(token, conversationId, {
      action: 'ADD_ITEM',
      manualValue: { ...duplicateComponent },
    }).then((result) => assert.equal(result.response.status, 201));

    for (let guard = 0; guard < 4; guard += 1) {
      const session = await reloadSessionFromDb(conversationId);
      if (session?.awaitingComponentsFinalSave) {
        break;
      }
      await acceptLatestTurn(token, conversationId);
    }

    const session = await reloadSessionFromDb(conversationId);
    assert.equal(session?.awaitingComponentsFinalSave, true);
    const rejected = await sequentialAction(token, conversationId, {
      action: 'ACCEPT_TURN',
      turnId: session!.currentTurnId!,
    });
    assert.equal(rejected.response.status, 409);
    assert.equal(rejected.json.error?.code, 'DUPLICATE_COMPONENT_NAME');
    assert.equal(await countProjectComponents(projectId), 0);
  });

  test('steps full-plan accept saves atomically', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'steps-full',
    });
    await advanceToStepsOverview(token, conversationId);
    const beforeCount = await countProjectSteps(projectId);

    await sequentialAction(token, conversationId, {
      action: 'CHOOSE_MODE',
      mode: 'STEPS_FULL_PLAN',
    });
    const accepted = await acceptLatestTurn(token, conversationId);
    assert.equal(accepted.response.status, 201);
    const turn = proposedTurnFromTurn(accepted.json);
    const acceptedTurnBlocks = (accepted.json.data?.contentBlocks as Array<Record<string, unknown>>) ?? [];
    const savedTurn = acceptedTurnBlocks.find(
      (block) => block.type === 'project_authoring_turn' && block.status === 'ACCEPTED',
    );
    assert.ok(savedTurn);

    const afterCount = await countProjectSteps(projectId);
    assert.equal(beforeCount, 0);
    assert.ok(afterCount >= 3);
    assert.equal(await latestSessionStage(conversationId), 'FINAL_REVIEW');
    assert.ok(turn?.stage === 'STEPS_OVERVIEW' || savedTurn?.stage === 'STEPS_OVERVIEW');
  });

  test('step-by-step persists working state without project writes', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'steps-one-by-one',
    });
    await advanceToStepsOverview(token, conversationId);
    const beforeCount = await countProjectSteps(projectId);

    const chosen = await sequentialAction(token, conversationId, {
      action: 'CHOOSE_MODE',
      mode: 'STEP_BY_STEP',
    });
    assert.equal(chosen.response.status, 201);
    const sessionAfterChoose = blockFromTurn(chosen.json, 'project_authoring_session');
    assert.equal(sessionAfterChoose?.stepReviewMode, 'STEP_BY_STEP');
    assert.equal(sessionAfterChoose?.stage, 'STEP_REVIEW');
    assert.equal(sessionAfterChoose?.currentStepIndex, 0);

    const firstAccepted = await acceptLatestTurn(token, conversationId);
    assert.equal(firstAccepted.response.status, 201);
    assert.equal(await countProjectSteps(projectId), beforeCount);

    const sessionAfterFirst = blockFromTurn(firstAccepted.json, 'project_authoring_session');
    assert.equal(sessionAfterFirst?.currentStepIndex, 1);
    assert.ok((sessionAfterFirst?.acceptedStepIndexes as number[])?.includes(0));
  });

  test('explain step performs zero project writes', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'explain-step',
    });
    await advanceToStepsOverview(token, conversationId);
    await sequentialAction(token, conversationId, {
      action: 'CHOOSE_MODE',
      mode: 'STEP_BY_STEP',
    });
    const turnId = await latestProposedTurnId(conversationId);
    const before = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });

    const explained = await sequentialAction(token, conversationId, {
      action: 'EXPLAIN_STEP',
      turnId: turnId ?? undefined,
    });
    assert.equal(explained.response.status, 201);

    const after = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.equal(after.updatedAt.toISOString(), before.updatedAt.toISOString());
    assert.equal(await countProjectSteps(projectId), 0);
  });

  test('step removal works in step-by-step mode', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'step-remove',
    });
    await advanceToStepsOverview(token, conversationId);
    await sequentialAction(token, conversationId, {
      action: 'CHOOSE_MODE',
      mode: 'STEP_BY_STEP',
    });

    const removed = await sequentialAction(token, conversationId, {
      action: 'REMOVE_ITEM',
      manualValue: 0,
    });
    assert.equal(removed.response.status, 201);
    const session = blockFromTurn(removed.json, 'project_authoring_session');
    assert.ok(session?.workingSteps);
    assert.equal(await countProjectSteps(projectId), 0);
  });

  test('final step save writes ordered steps atomically', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'step-final-order',
    });
    await advanceToStepsOverview(token, conversationId);
    await sequentialAction(token, conversationId, {
      action: 'CHOOSE_MODE',
      mode: 'STEP_BY_STEP',
    });

    for (let guard = 0; guard < 12; guard += 1) {
      const session = await reloadSessionFromDb(conversationId);
      if (session?.awaitingStepsFinalSave) {
        break;
      }
      const accepted = await acceptLatestTurn(token, conversationId);
      assert.equal(accepted.response.status, 201);
    }

    const summaryTurnId = await latestProposedTurnId(conversationId);
    const messages = await prisma.aiMessage.findMany({
      where: { conversationId, role: 'ASSISTANT' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    let expectedTitles: string[] = [];
    for (const message of messages) {
      const blocks = (message.contentBlocks as Array<Record<string, unknown>>) ?? [];
      const turn = blocks.find(
        (block) => block.type === 'project_authoring_turn' && block.turnId === summaryTurnId,
      );
      if (turn && 'steps' in ((turn.proposal as Record<string, unknown>) ?? {})) {
        expectedTitles = (
          (turn.proposal as { steps: Array<{ title: string }> }).steps ?? []
        ).map((step) => step.title);
        break;
      }
    }
    assert.ok(expectedTitles.length > 0);

    const finalAccepted = await sequentialAction(token, conversationId, {
      action: 'ACCEPT_TURN',
      turnId: summaryTurnId!,
    });
    assert.equal(finalAccepted.response.status, 201);

    const savedSteps = await prisma.projectStep.findMany({
      where: { projectId },
      orderBy: { stepNumber: 'asc' },
    });
    assert.equal(savedSteps.length, expectedTitles.length);
    assert.deepEqual(
      savedSteps.map((step) => step.title),
      expectedTitles,
    );
    assert.equal(await latestSessionStage(conversationId), 'FINAL_REVIEW');
  });

  test('component-step inconsistency is rejected', async () => {
    // The persisted Learning Hub authoring flow finalizes steps through the
    // persisted SAVE_MANUAL/FINALIZE_STEPS actions, which run
    // validateComponentStepConsistency and reject an inconsistent plan with 409
    // AI_STEP_COMPONENT_INCONSISTENT. (The legacy REMOVE_ITEM/ADD_ITEM item
    // mutations map to null and are never delegated to the persisted finalize,
    // and the legacy sequential route neither owns a persisted session here nor
    // accepts a manual step-plan array, so the legacy route cannot exercise this
    // guard. We therefore verify the active persisted guard directly.)
    const { randomUUID } = await import('node:crypto');
    const { runPersistedAuthoringSessionAction } = await import(
      '../ai/project-authoring-session.service.js'
    );
    const learner = await createLearner('inconsistent-steps');
    const category = await createProjectCategory();
    const project = await prisma.learningProject.create({
      data: {
        title: 'Arduino LDR night light',
        shortDescription: 'A night light that turns on an LED in the dark using an LDR.',
        description: 'Build an Arduino night light using an LDR sensor and an LED.',
        difficulty: 'BEGINNER',
        estimatedDurationMinutes: 180,
        status: 'DRAFT',
        createdByUser: { connect: { id: learner.id } },
        category: { connect: { id: category.id } },
        requiredComponents: {
          create: [
            {
              componentName: 'Arduino Uno',
              materialType: 'Microcontroller board',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              isRequired: true,
              canBeSubstituted: false,
            },
            {
              componentName: 'LDR',
              materialType: 'Light sensor',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              isRequired: true,
              canBeSubstituted: false,
            },
          ],
        },
      },
    });
    ids.projects.push(project.id);
    const conversation = await prisma.aiConversation.create({
      data: {
        userId: learner.id,
        learningProjectId: project.id,
        mode: 'PROJECT_AUTHORING',
        locale: 'en',
        title: project.title,
        status: 'ACTIVE',
      },
    });
    const sessionId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'STEPS_OVERVIEW',
        status: 'WAITING_FOR_USER',
        version: 1,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: [
          'TITLE',
          'SHORT_DESCRIPTION',
          'FULL_DESCRIPTION',
          'DIFFICULTY',
          'ESTIMATED_DURATION',
          'COMPONENTS',
        ],
      },
    });

    let rejectedStatus: number | undefined;
    let rejectedCode: string | undefined;
    try {
      await runPersistedAuthoringSessionAction(learner.id, sessionId, {
        action: 'SAVE_MANUAL',
        expectedVersion: 1,
        manualValue: [
          {
            title: 'Prepare the workspace',
            description: 'Gather the Arduino Uno and the LDR and lay them out on the bench.',
          },
          {
            title: 'Mount the ultrasonic sensor',
            description:
              'Install and wire the ultrasonic sensor even though no ultrasonic sensor is in the saved component list.',
          },
        ],
      });
    } catch (error) {
      rejectedStatus = (error as { statusCode?: number }).statusCode;
      rejectedCode = (error as { code?: string }).code;
    }
    assert.equal(rejectedStatus, 409);
    assert.equal(rejectedCode, 'AI_STEP_COMPONENT_INCONSISTENT');
    assert.equal(await countProjectSteps(project.id), 0);
  });

  test('refresh restores exact stage and index from stored messages', async () => {
    const { token, conversationId } = await ensureReadySequentialSession({ label: 'refresh' });
    await advanceToComponentsStage(token, conversationId);
    await sequentialAction(token, conversationId, {
      action: 'CHOOSE_MODE',
      mode: 'COMPONENTS_ONE_BY_ONE',
    });
    await acceptLatestTurn(token, conversationId);

    const liveSession = await reloadSessionFromDb(conversationId);
    assert.equal(liveSession?.stage, 'COMPONENTS');
    assert.equal(liveSession?.currentComponentIndex, 1);

    const reloaded = await apiFetch(`/api/ai/v1/conversations/${conversationId}/messages`, {
      token,
    });
    assert.equal(reloaded.response.status, 200);
    const items = (reloaded.json.data?.items as Array<Record<string, unknown>>) ?? [];
    const blocks = items.flatMap((item) =>
      Array.isArray(item.contentBlocks)
        ? (item.contentBlocks as Array<Record<string, unknown>>)
        : [],
    );
    const sessionFromHistory = [...blocks]
      .reverse()
      .find((block) => block.type === 'project_authoring_session');
    assert.equal(sessionFromHistory?.stage, liveSession?.stage);
    assert.equal(sessionFromHistory?.currentComponentIndex, liveSession?.currentComponentIndex);
    assert.equal(sessionFromHistory?.sessionId, liveSession?.sessionId);
  });

  test('non-DRAFT project denies sequential authoring writes', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'non-draft',
    });
    await prisma.learningProject.update({
      where: { id: projectId },
      data: { status: 'PENDING_REVIEW', submittedAt: new Date() },
    });

    const denied = await sequentialAction(token, conversationId, { action: 'START' });
    assert.equal(denied.response.status, 409);
    assert.equal(denied.json.error?.code, 'PROJECT_NOT_EDITABLE');
  });

  test('continue guided creates one sequential session without new project', async () => {
    const { token, projectId, conversationId, learner } = await ensureReadySequentialSession({
      label: 'continue-guided',
    });
    await prisma.aiMessage.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        contentText: 'Legacy proposal snapshot',
        contentBlocks: [
          {
            type: 'project_authoring_proposal',
            proposalId: 'legacy-proposal-seq',
            version: 1,
            status: 'PROPOSED',
            project: { title: 'Legacy Arduino Title' },
          },
        ],
        status: 'COMPLETED',
        locale: 'en',
        provider: 'system',
      },
    });

    const beforeCount = await prisma.learningProject.count({
      where: { createdBy: learner.id },
    });
    const continued = await sequentialAction(token, conversationId, {
      action: 'CONTINUE_GUIDED',
    });
    assert.equal(continued.response.status, 201);
    const session = blockFromTurn(continued.json, 'project_authoring_session');
    assert.ok(session?.sessionId);

    const afterCount = await prisma.learningProject.count({
      where: { createdBy: learner.id },
    });
    assert.equal(beforeCount, afterCount);
    const project = await prisma.learningProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.equal(project.id, projectId);
  });

  test('repeated finish is idempotent', async () => {
    const { token, conversationId } = await ensureReadySequentialSession({ label: 'finish-dup' });
    await advanceToFinalReview(token, conversationId);

    const first = await sequentialAction(token, conversationId, { action: 'FINISH' });
    assert.equal(first.response.status, 201);
    const firstSession = blockFromTurn(first.json, 'project_authoring_session');
    assert.equal(firstSession?.stage, 'COMPLETE');

    const second = await sequentialAction(token, conversationId, { action: 'FINISH' });
    assert.equal(second.response.status, 201);
    const secondSession = blockFromTurn(second.json, 'project_authoring_session');
    assert.equal(secondSession?.stage, 'COMPLETE');
    assert.equal(secondSession?.sessionId, firstSession?.sessionId);
  });

  test('legacy proposal blocks remain readable in stored history', async () => {
    const { conversationId } = await ensureReadySequentialSession({ label: 'legacy-blocks' });
    await prisma.aiMessage.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        contentText: 'Legacy review snapshot',
        contentBlocks: [
          {
            type: 'project_authoring_review_state',
            reviewStateId: 'legacy-review-seq',
            proposalId: 'legacy-proposal-seq-2',
            fieldDecisions: { title: 'ACCEPT_PROPOSAL' },
            status: 'IN_PROGRESS',
            resolvedCount: 1,
            unreviewed: 6,
            total: 7,
          },
        ],
        status: 'COMPLETED',
        locale: 'en',
        provider: 'system',
      },
    });

    const messages = await prisma.aiMessage.findMany({ where: { conversationId } });
    const legacy = messages.flatMap((message) =>
      Array.isArray(message.contentBlocks)
        ? (message.contentBlocks as Array<Record<string, unknown>>)
        : [],
    );
    assert.ok(legacy.some((block) => block.type === 'project_authoring_review_state'));
    assert.ok(legacy.some((block) => block.type === 'project_authoring_session'));
  });

  test('sequential authoring never submits publishes or moderates project', async () => {
    const { token, projectId, conversationId } = await ensureReadySequentialSession({
      label: 'no-submit',
    });
    await advanceToFinalReview(token, conversationId);
    await sequentialAction(token, conversationId, { action: 'FINISH' });

    const project = await prisma.learningProject.findUniqueOrThrow({
      where: { id: projectId },
      include: { requiredComponents: true, steps: true },
    });
    assert.equal(project.status, 'DRAFT');
    assert.equal(project.submittedAt, null);
    assert.equal(project.reviewedAt, null);
    assert.equal(project.reviewedBy, null);
    assert.equal(project.hiddenAt, null);
    assert.equal(project.archivedAt, null);
    assert.ok(project.requiredComponents.length > 0);
    assert.ok(project.steps.length > 0);
  });
});
