import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'authoring-session-test-access';
process.env.JWT_REFRESH_SECRET ??= 'authoring-session-test-refresh';
process.env.NODE_TEST_CONTEXT ??= '1';
process.env.AI_CHAT_PROVIDER = 'mock';

const TEST_MARKER = '[test-project-authoring-session]';

let prisma: typeof import('../../database/prisma.js').prisma;
const ids = {
  users: [] as string[],
  categories: [] as string[],
  projects: [] as string[],
  conversations: [] as string[],
};

before(async () => {
  ({ prisma } = await import('../../database/prisma.js'));
  const { setAuthoringClarificationGeneratorForTests } = await import(
    './ai-project-authoring-clarification.provider.js'
  );
  setAuthoringClarificationGeneratorForTests(() => ({
    provider: 'mock',
    model: 'mock-authoring-clarification',
    data: {
      assistantText: 'Your project idea has enough detail to generate a structured draft.',
      clarification: {
        type: 'project_authoring_clarification',
        status: 'READY_FOR_PROPOSAL',
        summary: 'Ready',
        knownFacts: [],
        nextQuestion: null,
        remainingTopics: 0,
        assumptions: [],
        warnings: [],
      },
    },
    usage: { inputTokens: 1, outputTokens: 1 },
    latencyMs: 1,
  }));
});

beforeEach(() => {
  process.env.AI_CHAT_PROVIDER = 'mock';
});

after(async () => {
  if (ids.conversations.length > 0) {
    await prisma.projectAuthoringSession.deleteMany({
      where: { conversationId: { in: ids.conversations } },
    });
  }
  if (ids.projects.length > 0) {
    await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
  }
  if (ids.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }
});

async function createLearner(label: string) {
  const { hashPassword } = await import('../../utils/password.js');
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

async function createDraftPair(label: string) {
  const learner = await createLearner(label);
  const { createTaxonomyReadyProjectCategory } = await import(
    '../../test-support/publishable-category.fixture.js'
  );
  const category = await createTaxonomyReadyProjectCategory({
    nameEn: `${TEST_MARKER} cat ${label}`,
    nameAr: `${TEST_MARKER} فئة ${label}`,
  });
  ids.categories.push(category.id);

  const project = await prisma.learningProject.create({
    data: {
      title: 'Beginner soil moisture monitor with LED alert.',
      shortDescription: 'TBD',
      description: 'TBD',
      difficulty: 'BEGINNER',
      estimatedDurationMinutes: 120,
      status: 'DRAFT',
      createdByUser: { connect: { id: learner.id } },
      category: { connect: { id: category.id } },
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
  ids.conversations.push(conversation.id);

  await prisma.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'USER',
      contentText: project.title,
      status: 'COMPLETED',
      locale: 'en',
    },
  });

  return { learner, project, conversation };
}

describe('project authoring persisted session', () => {
  test('sessions are isolated per project/conversation', async () => {
    const { startPersistedAuthoringSession } = await import('./project-authoring-session.service.js');
    const a = await createDraftPair('iso-a');
    const b = await createDraftPair('iso-b');

    await startPersistedAuthoringSession(a.learner.id, a.conversation.id, {
      writeLegacyMessage: false,
    });
    await startPersistedAuthoringSession(b.learner.id, b.conversation.id, {
      writeLegacyMessage: false,
    });

    const sessions = await prisma.projectAuthoringSession.findMany({
      where: { conversationId: { in: [a.conversation.id, b.conversation.id] } },
    });
    assert.equal(sessions.length, 2);
    assert.notEqual(sessions[0]!.learningProjectId, sessions[1]!.learningProjectId);
  });

  test('feedback supersedes current turn', async () => {
    const { setAuthoringClarificationGeneratorForTests } = await import(
      './ai-project-authoring-clarification.provider.js'
    );
    setAuthoringClarificationGeneratorForTests(() => ({
      provider: 'mock',
      model: 'mock-authoring-clarification',
      data: {
        assistantText: 'Your project idea has enough detail to generate a structured draft.',
        clarification: {
          type: 'project_authoring_clarification',
          status: 'READY_FOR_PROPOSAL',
          summary: 'Ready',
          knownFacts: [],
          nextQuestion: null,
          remainingTopics: 0,
          assumptions: [],
          warnings: [],
        },
      },
      usage: { inputTokens: 1, outputTokens: 1 },
      latencyMs: 1,
    }));

    const {
      runPersistedAuthoringSessionAction,
      sendPersistedAuthoringSessionMessage,
      startPersistedAuthoringSession,
      submitPersistedComposerFeedback,
    } = await import('./project-authoring-session.service.js');
    const { learner, conversation } = await createDraftPair('feedback');
    let started = (await startPersistedAuthoringSession(learner.id, conversation.id, {
      writeLegacyMessage: false,
    })) as { session: { id: string; version: number; stage: string; currentTurnId: string | null } };

    if (started.session.currentTurnId) {
      started = (await sendPersistedAuthoringSessionMessage(learner.id, started.session.id, {
        text: 'Alert only with LED, beginner level, USB power.',
        expectedVersion: started.session.version,
      })) as typeof started;
    }

    started = (await runPersistedAuthoringSessionAction(learner.id, started.session.id, {
      action: 'START',
      expectedVersion: started.session.version,
    })) as typeof started;

    const turnA = started.session.currentTurnId;
    assert.ok(turnA);

    const projectRecord = await prisma.learningProject.findUniqueOrThrow({
      where: { id: conversation.learningProjectId! },
      include: {
        requiredComponents: true,
        steps: true,
        category: true,
        tags: true,
        images: true,
        createdByUser: true,
        links: true,
      },
    });

    await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId: started.session.id,
      conversation,
      project: projectRecord,
      locale: 'en',
      comment: 'Please make the title shorter and more beginner friendly.',
      expectedVersion: started.session.version,
      skipLegacyAssistantMessage: true,
    });

    const session = await prisma.projectAuthoringSession.findUniqueOrThrow({
      where: { id: started.session.id },
      include: { currentTurn: true },
    });
    assert.notEqual(session.currentTurnId, turnA);
    const oldTurn = await prisma.projectAuthoringTurn.findUniqueOrThrow({ where: { id: turnA! } });
    assert.equal(oldTurn.status, 'SUPERSEDED');
    assert.equal(session.currentTurn?.status, 'PROPOSED');
    assert.notEqual(
      (session.currentTurn?.payload as { value?: string }).value,
      'Please make the title shorter and more beginner friendly.',
    );
  });

  test('reopening clarification session does not create duplicate turn', async () => {
    const { setAuthoringClarificationGeneratorForTests } = await import(
      './ai-project-authoring-clarification.provider.js'
    );
    let clarificationCalls = 0;
    setAuthoringClarificationGeneratorForTests(() => {
      clarificationCalls += 1;
      return {
        provider: 'mock',
        model: 'mock-authoring-clarification',
        data: {
          assistantText: 'Your project idea has enough detail to generate a structured draft.',
          clarification: {
            type: 'project_authoring_clarification',
            status: 'READY_FOR_PROPOSAL',
            summary: 'Ready',
            knownFacts: [],
            nextQuestion: null,
            remainingTopics: 0,
            assumptions: [],
            warnings: [],
          },
        },
        usage: { inputTokens: 1, outputTokens: 1 },
        latencyMs: 1,
      };
    });

    const { getPersistedAuthoringSessionStateById, startPersistedAuthoringSession } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation } = await createDraftPair('clarification-reload');

    const first = (await startPersistedAuthoringSession(learner.id, conversation.id, {
      writeLegacyMessage: false,
    })) as { session: { id: string; version: number } };
    const firstVersion = first.session.version;
    const firstTurnCount = await prisma.projectAuthoringTurn.count({
      where: { sessionId: first.session.id, stage: 'OVERVIEW' },
    });

    const second = (await startPersistedAuthoringSession(learner.id, conversation.id, {
      writeLegacyMessage: false,
    })) as { session: { id: string; version: number } };
    const secondTurnCount = await prisma.projectAuthoringTurn.count({
      where: { sessionId: first.session.id, stage: 'OVERVIEW' },
    });

    await getPersistedAuthoringSessionStateById(learner.id, first.session.id);
    const third = (await startPersistedAuthoringSession(learner.id, conversation.id, {
      writeLegacyMessage: false,
    })) as { session: { id: string; version: number } };
    const thirdTurnCount = await prisma.projectAuthoringTurn.count({
      where: { sessionId: first.session.id, stage: 'OVERVIEW' },
    });

    assert.equal(clarificationCalls, 1);
    assert.equal(second.session.version, firstVersion);
    assert.equal(third.session.version, firstVersion);
    assert.equal(secondTurnCount, firstTurnCount);
    assert.equal(thirdTurnCount, firstTurnCount);
    setAuthoringClarificationGeneratorForTests(null);
  });

  test('repeated finish is idempotent', async () => {
    const { runPersistedAuthoringSessionAction, startPersistedAuthoringSession } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation } = await createDraftPair('finish');
    const started = (await startPersistedAuthoringSession(learner.id, conversation.id, {
      writeLegacyMessage: false,
    })) as { session: { id: string; version: number } };

    const first = await runPersistedAuthoringSessionAction(learner.id, started.session.id, {
      action: 'FINISH',
      expectedVersion: started.session.version,
    });
    const second = await runPersistedAuthoringSessionAction(learner.id, started.session.id, {
      action: 'FINISH',
      expectedVersion: first.session.version,
    });
    assert.equal(second.session.status, 'COMPLETE');
    assert.equal(second.session.stage, 'COMPLETE');
  });

  test('SAVE_MANUAL duration is accepted at ESTIMATED_DURATION', async () => {
    const { randomUUID } = await import('node:crypto');
    const { runPersistedAuthoringSessionAction } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('duration-save');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'ESTIMATED_DURATION',
        status: 'WAITING_FOR_USER',
        version: 1,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: ['TITLE', 'SHORT_DESCRIPTION', 'FULL_DESCRIPTION', 'DIFFICULTY'],
      },
    });
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'ESTIMATED_DURATION',
        kind: 'STAGE_PROPOSAL',
        status: 'PROPOSED',
        payload: { value: 120 },
        explanation: 'Suggested duration',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });

    const saved = await runPersistedAuthoringSessionAction(learner.id, sessionId, {
      action: 'SAVE_MANUAL',
      expectedVersion: 1,
      turnId,
      manualValue: 90,
    });
    assert.equal(saved.session.stage, 'COMPONENTS');
    const updatedProject = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
    });
    assert.equal(updatedProject.estimatedDurationMinutes, 90);
  });

  test('invalid duration SAVE_MANUAL performs zero canonical writes', async () => {
    const { randomUUID } = await import('node:crypto');
    const { runPersistedAuthoringSessionAction } = await import(
      './project-authoring-session.service.js'
    );
    const { AppError } = await import('../../utils/app-error.js');
    const { learner, conversation, project } = await createDraftPair('duration-invalid');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'ESTIMATED_DURATION',
        status: 'WAITING_FOR_USER',
        version: 1,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: ['TITLE', 'SHORT_DESCRIPTION', 'FULL_DESCRIPTION', 'DIFFICULTY'],
      },
    });
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'ESTIMATED_DURATION',
        kind: 'STAGE_PROPOSAL',
        status: 'PROPOSED',
        payload: { value: 120 },
        explanation: 'Suggested duration',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });

    await assert.rejects(
      () =>
        runPersistedAuthoringSessionAction(learner.id, sessionId, {
          action: 'SAVE_MANUAL',
          expectedVersion: 1,
          turnId,
          manualValue: -5,
        }),
      (error: unknown) => error instanceof AppError && error.code === 'INVALID_ESTIMATED_DURATION',
    );

    const unchanged = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
    });
    assert.equal(unchanged.estimatedDurationMinutes, 120);
  });

  test('CHOOSE_STEP_MODE STEP_BY_STEP is accepted at STEPS_OVERVIEW', async () => {
    const { randomUUID } = await import('node:crypto');
    const { runPersistedAuthoringSessionAction } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('step-mode');
    const sessionId = randomUUID();
    const turnId = randomUUID();
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
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'STEPS_OVERVIEW',
        kind: 'STEP_PLAN',
        status: 'PROPOSED',
        payload: {
          steps: [
            { title: 'Step 1', description: 'Prepare board', safetyNote: null, order: 1 },
            { title: 'Step 2', description: 'Wire sensor', safetyNote: null, order: 2 },
          ],
        },
        explanation: 'Step plan',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });

    const reviewed = await runPersistedAuthoringSessionAction(learner.id, sessionId, {
      action: 'CHOOSE_STEP_MODE',
      expectedVersion: 1,
      turnId,
      mode: 'STEP_BY_STEP',
    });
    assert.equal(reviewed.session.stage, 'STEP_REVIEW');
    assert.equal(
      (reviewed.session.stepReviewState as { mode?: string } | null)?.mode,
      'STEP_BY_STEP',
    );
    assert.ok(reviewed.currentTurn);
    assert.equal(reviewed.currentTurn?.stage, 'STEP_REVIEW');
  });

  test('start on existing STEPS session without current turn does not reset to TITLE', async () => {
    const { randomUUID } = await import('node:crypto');
    const { startPersistedAuthoringSession } = await import('./project-authoring-session.service.js');
    const { learner, conversation, project } = await createDraftPair('steps-refresh');
    const sessionId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'STEPS_OVERVIEW',
        status: 'GENERATION_FAILED',
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
        generationErrorCode: 'AI_AUTHORING_STEP_GENERATION_FAILED',
      },
    });

    const resumed = (await startPersistedAuthoringSession(learner.id, conversation.id, {
      writeLegacyMessage: false,
    })) as { session: { stage: string; status: string } };

    assert.equal(resumed.session.stage, 'STEPS_OVERVIEW');
    assert.equal(resumed.session.status, 'GENERATION_FAILED');
  });

  test('get session by id restores step proposal without writes', async () => {
    const { randomUUID } = await import('node:crypto');
    const { getPersistedAuthoringSessionStateById } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('steps-get');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'STEPS_OVERVIEW',
        status: 'WAITING_FOR_USER',
        version: 3,
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
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'STEPS_OVERVIEW',
        kind: 'STEP_PLAN',
        status: 'PROPOSED',
        payload: {
          steps: [
            { title: 'Prepare board', description: 'Gather parts and tools.', order: 1 },
            { title: 'Wire sensor', description: 'Connect the sensor safely.', order: 2 },
            { title: 'Test output', description: 'Verify the alarm works.', order: 3 },
          ],
        },
        explanation: 'A 3-step plan ready for review.',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });

    const loaded = await getPersistedAuthoringSessionStateById(learner.id, sessionId);
    assert.equal(loaded.session.stage, 'STEPS_OVERVIEW');
    assert.equal(loaded.currentTurn?.id, turnId);
    const steps = (loaded.currentTurn?.payload as { steps?: unknown[] }).steps ?? [];
    assert.equal(steps.length, 3);
  });

  test('tryGenerateStepPlan fails without unrelated catalog fallback when provider is unavailable', async () => {
    const { randomUUID } = await import('node:crypto');
    const { tryGenerateStepPlan } = await import('./project-authoring-session.helpers.js');
    const { learner, conversation, project } = await createDraftPair('steps-fallback');
    const sessionId = randomUUID();
    const componentId = randomUUID();
    await prisma.projectRequiredComponent.create({
      data: {
        id: componentId,
        projectId: project.id,
        componentName: 'Cardboard box',
        materialType: 'Recycled material',
        quantity: 3,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: [],
      },
    });
    const refreshedProject = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        requiredComponents: true,
        steps: true,
        category: true,
        tags: true,
        images: true,
        createdByUser: true,
        links: true,
      },
    });
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'STEPS_OVERVIEW',
        status: 'WAITING_FOR_ASSISTANT',
        version: 2,
        baseProjectUpdatedAt: refreshedProject.updatedAt,
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
    const session = await prisma.projectAuthoringSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { currentTurn: true },
    });

    const originalProvider = process.env.AI_CHAT_PROVIDER;
    process.env.AI_CHAT_PROVIDER = 'disabled';
    try {
      const { AppError } = await import('../../utils/app-error.js');
      await assert.rejects(
        () =>
          tryGenerateStepPlan({
            session,
            project: refreshedProject,
            locale: 'en',
            expectedVersion: session.version,
          }),
        (error: unknown) => error instanceof AppError && error.code === 'AI_DISABLED',
      );
      const failed = await prisma.projectAuthoringSession.findUniqueOrThrow({
        where: { id: sessionId },
      });
      assert.equal(failed.status, 'GENERATION_FAILED');
      assert.equal(failed.currentTurnId, null);
    } finally {
      if (originalProvider === undefined) {
        delete process.env.AI_CHAT_PROVIDER;
      } else {
        process.env.AI_CHAT_PROVIDER = originalProvider;
      }
    }
  });

  test('component finalize still succeeds when step generation fails afterward', async () => {
    const { randomUUID } = await import('node:crypto');
    const { runPersistedAuthoringSessionAction } = await import('./project-authoring-session.service.js');
    const { learner, conversation, project } = await createDraftPair('components-before-steps');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'COMPONENTS',
        status: 'WAITING_FOR_USER',
        version: 1,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: [
          'TITLE',
          'SHORT_DESCRIPTION',
          'FULL_DESCRIPTION',
          'DIFFICULTY',
          'ESTIMATED_DURATION',
        ],
        componentReviewMode: 'FULL_LIST',
        componentWorkingState: {
          mode: 'FULL_LIST',
          workingComponents: [
            {
              componentName: 'Cardboard sheet',
              materialType: 'Recycled material',
              quantity: 2,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              isRequired: true,
              canBeSubstituted: false,
              searchKeywords: [],
              notes: null,
            },
          ],
          currentIndex: 0,
          acceptedIndexes: [],
          awaitingFinalSave: true,
          sourceTurnId: turnId,
        },
      },
    });
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'COMPONENTS',
        kind: 'COMPONENT_LIST',
        status: 'PROPOSED',
        payload: {
          components: [
            {
              componentName: 'Cardboard sheet',
              materialType: 'Recycled material',
              quantity: 2,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              isRequired: true,
              canBeSubstituted: false,
              searchKeywords: [],
              notes: null,
            },
          ],
        },
        explanation: 'Component list ready.',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });

    const originalProvider = process.env.AI_CHAT_PROVIDER;
    process.env.AI_CHAT_PROVIDER = 'disabled';
    try {
      const response = await runPersistedAuthoringSessionAction(learner.id, sessionId, {
        action: 'ACCEPT_CURRENT',
        expectedVersion: 1,
        turnId,
      });
      assert.equal(response.session.stage, 'STEPS_OVERVIEW');
      assert.equal(response.canonicalProject.components.length, 1);
      assert.equal(response.canonicalProject.components[0]?.componentName, 'Cardboard sheet');
      assert.ok(
        response.session.status === 'GENERATION_FAILED' ||
          (response.session.status === 'WAITING_FOR_USER' &&
            response.currentTurn?.kind === 'STEP_PLAN'),
      );
    } finally {
      if (originalProvider === undefined) {
        delete process.env.AI_CHAT_PROVIDER;
      } else {
        process.env.AI_CHAT_PROVIDER = originalProvider;
      }
    }
  });

  test('component generation failure state allows chat without TURN_SUPERSEDED', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { randomUUID } = await import('node:crypto');
    const { submitPersistedComposerFeedback } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('components-failure-chat');
    const sessionId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'COMPONENTS',
        status: 'GENERATION_FAILED',
        version: 1,
        currentTurnId: null,
        generationErrorCode: 'AI_COMPONENT_PROPOSAL_INVALID',
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: [
          'TITLE',
          'SHORT_DESCRIPTION',
          'FULL_DESCRIPTION',
          'DIFFICULTY',
          'ESTIMATED_DURATION',
        ],
      },
    });

    const projectRecord = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        requiredComponents: true,
        steps: true,
        category: true,
        tags: true,
        images: true,
        createdByUser: true,
        links: true,
      },
    });

    const response = await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId,
      conversation,
      project: projectRecord,
      locale: 'ar',
      comment: 'ليش فشل توليد قائمة المكوّنات؟',
      expectedVersion: 1,
      skipLegacyAssistantMessage: true,
    });

    assert.ok(response && typeof response === 'object' && 'conversationMessages' in response);
    const withMessages = response as {
      session: { stage: string };
      conversationMessages: Array<{ role: string; contentText: string | null }>;
    };
    assert.equal(withMessages.session.stage, 'COMPONENTS');
    const userMessages = withMessages.conversationMessages.filter(
      (message) => message.role === 'USER',
    );
    const assistantMessages = withMessages.conversationMessages.filter(
      (message) => message.role === 'ASSISTANT',
    );
    assert.ok(
      userMessages.some((message) => (message.contentText ?? '').includes('فشل')),
      'learner message must remain visible',
    );
    assert.ok(assistantMessages.length >= 1, 'assistant reply must be generated');
  });

  test('a failed next-stage component generation consumes Accept into a retryable state', async () => {
    const { randomUUID } = await import('node:crypto');
    const { AppError } = await import('../../utils/app-error.js');
    const { runPersistedAuthoringSessionAction } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('component-generation-retry');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'ESTIMATED_DURATION',
        status: 'WAITING_FOR_USER',
        version: 1,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: [
          'OVERVIEW',
          'TITLE',
          'SHORT_DESCRIPTION',
          'FULL_DESCRIPTION',
          'DIFFICULTY',
        ],
      },
    });
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'ESTIMATED_DURATION',
        kind: 'STAGE_PROPOSAL',
        status: 'PROPOSED',
        payload: { value: 120 },
        explanation: 'Two hours gives a beginner enough time to build and test it.',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });

    const originalProvider = process.env.AI_CHAT_PROVIDER;
    process.env.AI_CHAT_PROVIDER = 'disabled';
    try {
      await assert.rejects(
        () => runPersistedAuthoringSessionAction(learner.id, sessionId, {
          action: 'ACCEPT_CURRENT',
          expectedVersion: 1,
          turnId,
        }),
        (error: unknown) => error instanceof AppError && error.code === 'AI_DISABLED',
      );

      const failed = await prisma.projectAuthoringSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: { currentTurn: true },
      });
      const accepted = await prisma.projectAuthoringTurn.findUniqueOrThrow({ where: { id: turnId } });
      assert.equal(accepted.status, 'ACCEPTED');
      assert.equal(failed.stage, 'COMPONENTS');
      assert.equal(failed.status, 'GENERATION_FAILED');
      assert.equal(failed.currentTurn, null);
      assert.equal(failed.generationErrorCode, 'AI_DISABLED');

      process.env.AI_CHAT_PROVIDER = 'mock';
      const recovered = await runPersistedAuthoringSessionAction(learner.id, sessionId, {
        action: 'REGENERATE_FAILED_STAGE',
        expectedVersion: failed.version,
      });
      assert.equal(recovered.session.stage, 'COMPONENTS');
      assert.equal(recovered.session.status, 'WAITING_FOR_USER');
      assert.equal(recovered.currentTurn?.kind, 'COMPONENT_LIST');
      assert.notEqual(recovered.currentTurn?.id, turnId);
    } finally {
      if (originalProvider === undefined) {
        delete process.env.AI_CHAT_PROVIDER;
      } else {
        process.env.AI_CHAT_PROVIDER = originalProvider;
      }
    }
  });

  test('get session by id does not invoke scalar proposal generation on reload', async () => {
    const { randomUUID } = await import('node:crypto');
    const { getPersistedAuthoringSessionStateById } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('scalar-get-readonly');
    const sessionId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'TITLE',
        status: 'WAITING_FOR_ASSISTANT',
        version: 1,
        currentTurnId: null,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: ['OVERVIEW'],
      },
    });

    const before = await prisma.projectAuthoringSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    const loaded = await getPersistedAuthoringSessionStateById(learner.id, sessionId);
    const after = await prisma.projectAuthoringSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    const turnCount = await prisma.projectAuthoringTurn.count({
      where: { sessionId },
    });

    assert.equal(loaded.currentTurn, null);
    assert.equal(after.currentTurnId, null);
    assert.equal(turnCount, 0);
    assert.ok(loaded.availableActions.includes('REGENERATE_FAILED_STAGE'));
    assert.ok(after.version >= before.version);
  });

  test('second contextual component message preserves conversation', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { randomUUID } = await import('node:crypto');
    const { submitPersistedComposerFeedback } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('components-second-message');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'COMPONENTS',
        status: 'WAITING_FOR_USER',
        version: 1,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: [
          'TITLE',
          'SHORT_DESCRIPTION',
          'FULL_DESCRIPTION',
          'DIFFICULTY',
          'ESTIMATED_DURATION',
        ],
      },
    });
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'COMPONENTS',
        kind: 'COMPONENT_LIST',
        status: 'PROPOSED',
        payload: {
          components: [
            {
              componentName: 'Arduino Uno',
              materialType: 'Microcontroller',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              isRequired: true,
            },
          ],
        },
        explanation: 'Component list',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });

    const projectRecord = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        requiredComponents: true,
        steps: true,
        category: true,
        tags: true,
        images: true,
        createdByUser: true,
        links: true,
      },
    });

    const first = await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId,
      conversation,
      project: projectRecord,
      locale: 'ar',
      comment: 'ليش بحتاج مقاومة 10kΩ مع الـLDR؟',
      expectedVersion: 1,
      skipLegacyAssistantMessage: true,
    });
    assert.ok(first && 'conversationMessages' in first);
    const firstMessages = (first as { conversationMessages: Array<{ role: string }> })
      .conversationMessages;
    assert.ok(firstMessages.filter((message) => message.role === 'USER').length >= 1);
    const firstWithTurn = first as {
      session: { currentTurnId: string | null };
      currentTurn: { payload: { components?: unknown[] } } | null;
    };
    assert.equal(firstWithTurn.session.currentTurnId, turnId);
    assert.equal(firstWithTurn.currentTurn?.payload.components?.length, 1);

    const second = await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId,
      conversation,
      project: projectRecord,
      locale: 'ar',
      comment: 'طيب شو بصير لو ما استخدمتها؟',
      expectedVersion: (first as { session: { version: number } }).session.version,
      skipLegacyAssistantMessage: true,
    });
    assert.ok(second && 'conversationMessages' in second);
    const secondMessages = (second as { conversationMessages: Array<{ role: string }> })
      .conversationMessages;
    assert.ok(secondMessages.filter((message) => message.role === 'USER').length >= 2);
    assert.ok(secondMessages.filter((message) => message.role === 'ASSISTANT').length >= 2);
    const secondWithTurn = second as {
      session: { currentTurnId: string | null };
      currentTurn: { payload: { components?: unknown[] } } | null;
    };
    assert.equal(secondWithTurn.session.currentTurnId, turnId);
    assert.equal(secondWithTurn.currentTurn?.payload.components?.length, 1);
  });

  test('components revision supersedes current turn', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { randomUUID } = await import('node:crypto');
    const { submitPersistedComposerFeedback } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('components-revise');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'COMPONENTS',
        status: 'WAITING_FOR_USER',
        version: 1,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: [
          'TITLE',
          'SHORT_DESCRIPTION',
          'FULL_DESCRIPTION',
          'DIFFICULTY',
          'ESTIMATED_DURATION',
        ],
      },
    });
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'COMPONENTS',
        kind: 'COMPONENT_LIST',
        status: 'PROPOSED',
        payload: {
          components: [
            {
              componentName: 'Arduino Uno',
              materialType: 'Microcontroller',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              isRequired: true,
            },
          ],
        },
        explanation: 'Component list',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });
    const projectRecord = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        requiredComponents: true,
        steps: true,
        category: true,
        tags: true,
        images: true,
        createdByUser: true,
        links: true,
      },
    });
    const beforeComponents = await prisma.projectRequiredComponent.count({
      where: { projectId: project.id },
    });
    const response = await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId,
      conversation,
      project: projectRecord,
      locale: 'ar',
      comment: 'تأكد إنه كابل USB موجود واحذف أي مكوّن غير مرتبط بالـLDR.',
      expectedVersion: 1,
      skipLegacyAssistantMessage: true,
    });
    const afterComponents = await prisma.projectRequiredComponent.count({
      where: { projectId: project.id },
    });
    assert.equal(beforeComponents, afterComponents);
    assert.ok(response && 'conversationMessages' in response);
    const withTurn = response as {
      session: { currentTurnId: string | null };
      currentTurn: { id: string; payload: { components?: unknown[] } } | null;
      conversationMessages: Array<{ role: string }>;
    };
    assert.notEqual(withTurn.session.currentTurnId, turnId);
    assert.ok((withTurn.currentTurn?.payload.components?.length ?? 0) >= 1);
    assert.ok(withTurn.conversationMessages.filter((message) => message.role === 'USER').length >= 1);
    assert.ok(
      withTurn.conversationMessages.filter((message) => message.role === 'ASSISTANT').length >= 1,
    );
  });

  test('general project chat performs zero canonical writes', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { randomUUID } = await import('node:crypto');
    const { submitPersistedComposerFeedback } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('general-chat');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'SHORT_DESCRIPTION',
        status: 'WAITING_FOR_USER',
        version: 1,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: ['TITLE'],
      },
    });
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'SHORT_DESCRIPTION',
        kind: 'STAGE_PROPOSAL',
        status: 'PROPOSED',
        payload: { value: 'وصف للمبتدئين.' },
        explanation: 'وصف أولي',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });
    const projectBefore = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
    });
    const projectRecord = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        requiredComponents: true,
        steps: true,
        category: true,
        tags: true,
        images: true,
        createdByUser: true,
        links: true,
      },
    });
    const response = await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId,
      conversation,
      project: projectRecord,
      locale: 'ar',
      comment: 'هل المشروع مناسب لشخص أول مرة يستخدم Arduino؟',
      expectedVersion: 1,
      skipLegacyAssistantMessage: true,
    });
    const projectAfter = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
    });
    assert.equal(projectAfter.shortDescription, projectBefore.shortDescription);
    assert.equal(projectAfter.title, projectBefore.title);
    assert.ok(response && 'conversationMessages' in response);
    const withMessages = response as {
      session: { currentTurnId: string | null };
      conversationMessages: Array<{ role: string }>;
    };
    assert.equal(withMessages.session.currentTurnId, turnId);
    assert.ok(withMessages.conversationMessages.filter((message) => message.role === 'ASSISTANT').length >= 1);
  });

  test('same text with different clientMessageIds creates distinct messages', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { randomUUID } = await import('node:crypto');
    const { submitPersistedComposerFeedback } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('distinct-text');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'SHORT_DESCRIPTION',
        status: 'WAITING_FOR_USER',
        version: 1,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: ['TITLE'],
      },
    });
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'SHORT_DESCRIPTION',
        kind: 'STAGE_PROPOSAL',
        status: 'PROPOSED',
        payload: { value: 'وصف للمبتدئين.' },
        explanation: 'وصف أولي',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });
    const projectRecord = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        requiredComponents: true,
        steps: true,
        category: true,
        tags: true,
        images: true,
        createdByUser: true,
        links: true,
      },
    });
    const comment = 'وضح أكثر.';
    const first = await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId,
      conversation,
      project: projectRecord,
      locale: 'ar',
      comment,
      clientMessageId: `authoring-test-${randomUUID()}`,
      expectedVersion: 1,
      skipLegacyAssistantMessage: true,
    });
    const second = await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId,
      conversation,
      project: projectRecord,
      locale: 'ar',
      comment,
      clientMessageId: `authoring-test-${randomUUID()}`,
      expectedVersion: (first as { session: { version: number } }).session.version,
      skipLegacyAssistantMessage: true,
    });
    const messages = (second as { conversationMessages: Array<{ role: string; contentText: string | null }> })
      .conversationMessages;
    assert.equal(
      messages.filter(
        (message) => message.role === 'USER' && (message.contentText ?? '').trim() === comment,
      ).length,
      2,
    );
  });

  test('steps explanation preserves step plan turn', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { randomUUID } = await import('node:crypto');
    const { submitPersistedComposerFeedback } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('steps-explain');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    const steps = Array.from({ length: 8 }, (_, index) => ({
      stepNumber: index + 1,
      title: `خطوة ${index + 1}`,
      description: `وصف الخطوة ${index + 1} للمبتدئ.`,
      estimatedMinutes: 15,
      materials: [],
      tools: [],
      safetyNotes: [],
      tips: [],
    }));
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
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'STEPS_OVERVIEW',
        kind: 'STEP_PLAN',
        status: 'PROPOSED',
        payload: { steps },
        explanation: 'Step plan',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });
    const projectRecord = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        requiredComponents: true,
        steps: true,
        category: true,
        tags: true,
        images: true,
        createdByUser: true,
        links: true,
      },
    });
    const response = await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId,
      conversation,
      project: projectRecord,
      locale: 'ar',
      comment: 'اشرحلي أول خطوة بالتفصيل.',
      expectedVersion: 1,
      skipLegacyAssistantMessage: true,
    });
    assert.ok(response && 'conversationMessages' in response);
    const withTurn = response as {
      session: { currentTurnId: string | null };
      currentTurn: { id: string; payload: { steps?: unknown[] } } | null;
      conversationMessages: Array<{ role: string }>;
    };
    assert.equal(withTurn.session.currentTurnId, turnId);
    assert.equal(withTurn.currentTurn?.payload.steps?.length, 8);
    assert.ok(withTurn.conversationMessages.filter((message) => message.role === 'ASSISTANT').length >= 1);
  });

  test('scalar explanation persists messages and preserves current turn', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { randomUUID } = await import('node:crypto');
    const { submitPersistedComposerFeedback } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('scalar-explain');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'SHORT_DESCRIPTION',
        status: 'WAITING_FOR_USER',
        version: 1,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: ['TITLE'],
      },
    });
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'SHORT_DESCRIPTION',
        kind: 'STAGE_PROPOSAL',
        status: 'PROPOSED',
        payload: {
          value: 'مصباح ليلي باستخدام Arduino وLDR للمبتدئين.',
        },
        explanation: 'وصف مختصر',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });
    const projectRecord = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        requiredComponents: true,
        steps: true,
        category: true,
        tags: true,
        images: true,
        createdByUser: true,
        links: true,
      },
    });
    const response = await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId,
      conversation,
      project: projectRecord,
      locale: 'ar',
      comment: 'ليش هذا الوصف مناسب للمبتدئ؟',
      expectedVersion: 1,
      skipLegacyAssistantMessage: true,
    });
    assert.ok(response && 'conversationMessages' in response);
    const withMessages = response as {
      session: { currentTurnId: string | null; version: number };
      currentTurn: { id: string; payload: { value?: string } } | null;
      conversationMessages: Array<{ role: string; contentText: string | null }>;
    };
    assert.equal(withMessages.session.currentTurnId, turnId);
    assert.equal(withMessages.currentTurn?.payload.value, 'مصباح ليلي باستخدام Arduino وLDR للمبتدئين.');
    assert.ok(
      withMessages.conversationMessages.some(
        (message) =>
          message.role === 'USER' &&
          (message.contentText ?? '').includes('ليش هذا الوصف مناسب للمبتدئ'),
      ),
    );
    assert.ok(
      withMessages.conversationMessages.filter((message) => message.role === 'ASSISTANT').length >=
        1,
    );
  });

  test('scalar revision persists messages and supersedes current turn', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { randomUUID } = await import('node:crypto');
    const { submitPersistedComposerFeedback } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('scalar-revise');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'SHORT_DESCRIPTION',
        status: 'WAITING_FOR_USER',
        version: 1,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: ['TITLE'],
      },
    });
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'SHORT_DESCRIPTION',
        kind: 'STAGE_PROPOSAL',
        status: 'PROPOSED',
        payload: {
          value: 'وصف طويل جدًا للمبتدئين.',
        },
        explanation: 'وصف أولي',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });
    const projectRecord = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        requiredComponents: true,
        steps: true,
        category: true,
        tags: true,
        images: true,
        createdByUser: true,
        links: true,
      },
    });
    const response = await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId,
      conversation,
      project: projectRecord,
      locale: 'ar',
      comment: 'خليه أوضح للمبتدئ، واذكر إنه يعتمد على الضوء مش الحركة.',
      expectedVersion: 1,
      skipLegacyAssistantMessage: true,
    });
    assert.ok(response && 'conversationMessages' in response);
    const withMessages = response as {
      session: { currentTurnId: string | null };
      currentTurn: { id: string; payload: { value?: string } } | null;
      conversationMessages: Array<{ role: string }>;
    };
    assert.notEqual(withMessages.session.currentTurnId, turnId);
    assert.notEqual(
      withMessages.currentTurn?.payload.value,
      'وصف طويل جدًا للمبتدئين.',
    );
    assert.ok(withMessages.conversationMessages.filter((message) => message.role === 'USER').length >= 1);
    assert.ok(
      withMessages.conversationMessages.filter((message) => message.role === 'ASSISTANT').length >=
        1,
    );
  });

  test('same clientMessageId does not duplicate persisted messages', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { randomUUID } = await import('node:crypto');
    const { submitPersistedComposerFeedback } = await import(
      './project-authoring-session.service.js'
    );
    const { learner, conversation, project } = await createDraftPair('scalar-idempotent');
    const sessionId = randomUUID();
    const turnId = randomUUID();
    const clientMessageId = `authoring-test-${randomUUID()}`;
    await prisma.projectAuthoringSession.create({
      data: {
        id: sessionId,
        conversationId: conversation.id,
        learningProjectId: project.id,
        ownerId: learner.id,
        stage: 'SHORT_DESCRIPTION',
        status: 'WAITING_FOR_USER',
        version: 1,
        baseProjectUpdatedAt: project.updatedAt,
        completedStages: ['TITLE'],
      },
    });
    await prisma.projectAuthoringTurn.create({
      data: {
        id: turnId,
        sessionId,
        stage: 'SHORT_DESCRIPTION',
        kind: 'STAGE_PROPOSAL',
        status: 'PROPOSED',
        payload: { value: 'وصف للمبتدئين.' },
        explanation: 'وصف',
        baseProjectUpdatedAt: project.updatedAt,
      },
    });
    await prisma.projectAuthoringSession.update({
      where: { id: sessionId },
      data: { currentTurnId: turnId },
    });
    const projectRecord = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        requiredComponents: true,
        steps: true,
        category: true,
        tags: true,
        images: true,
        createdByUser: true,
        links: true,
      },
    });
    const first = await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId,
      conversation,
      project: projectRecord,
      locale: 'ar',
      comment: 'ليش هذا الوصف مناسب؟',
      expectedVersion: 1,
      clientMessageId,
      skipLegacyAssistantMessage: true,
    });
    const second = await submitPersistedComposerFeedback({
      userId: learner.id,
      sessionId,
      conversation,
      project: projectRecord,
      locale: 'ar',
      comment: 'ليش هذا الوصف مناسب؟',
      expectedVersion: (first as { session: { version: number } }).session.version,
      clientMessageId,
      skipLegacyAssistantMessage: true,
    });
    const messages = (second as { conversationMessages: Array<{ role: string; contentText: string | null }> })
      .conversationMessages;
    assert.equal(
      messages.filter(
        (message) =>
          message.role === 'USER' &&
          (message.contentText ?? '').includes('ليش هذا الوصف مناسب'),
      ).length,
      1,
    );
    assert.equal(messages.filter((message) => message.role === 'ASSISTANT').length, 1);
  });
});
