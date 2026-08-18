import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { AppError } from '../../../utils/app-error.js';
import type { BoundedHistoryMessage } from '../ai.types.js';
import type { AiChatGenerateAnswerInput } from '../providers/ai-chat-provider.types.js';
import {
  classifyBuildGuideStepTurnIntent,
  setBuildGuideStepTurnDependenciesForTests,
  shouldAttachBuildStepGuideCard,
  tryHandleBuildGuideStepTurn,
} from './ai-build-guide-step-turn.service.js';

afterEach(() => {
  setBuildGuideStepTurnDependenciesForTests(null);
});

const plantStandStep2Build = {
  id: 'build-plant',
  projectId: 'project-plant',
  status: 'IN_PROGRESS',
  project: { title: 'PVC Plant Stand' },
  materialReadiness: {
    ready: 4,
    linked: 4,
    reserved: 0,
    missing: 0,
    total: 4,
  },
  stepProgress: {
    completed: 1,
    total: 4,
    percent: 25,
    currentStep: {
      stepId: 'step-2',
      stepNumber: 2,
      title: 'Prepare the main parts',
    },
    nextAction: 'COMPLETE_CURRENT_STEP',
    steps: [
      {
        stepId: 'step-1',
        stepNumber: 1,
        title: 'Plan and inspect materials',
        description: 'Review the component list.',
        state: 'COMPLETED',
        imageUrl: null,
      },
      {
        stepId: 'step-2',
        stepNumber: 2,
        title: 'Prepare the main parts',
        description:
          'Measure, clean, cut, or sort the reusable materials needed for assembly.',
        state: 'CURRENT',
        imageUrl: null,
      },
      {
        stepId: 'step-3',
        stepNumber: 3,
        title: 'Assemble and connect',
        description: 'Join the frame and connect the parts.',
        state: 'LOCKED',
        imageUrl: null,
      },
      {
        stepId: 'step-4',
        stepNumber: 4,
        title: 'Test and improve',
        description: 'Check stability.',
        state: 'LOCKED',
        imageUrl: null,
      },
    ],
  },
  items: [
    { component: { componentName: 'PVC Pipe' } },
    { component: { componentName: 'Plastic tray' } },
  ],
};

const loadPlantStand = async () =>
  plantStandStep2Build as Awaited<
    ReturnType<
      typeof import('../../learning-projects/learning-projects.service.js').getOwnedProjectBuildByBuildId
    >
  >;

const answerFromPrompt = (input: AiChatGenerateAnswerInput, label: string) => ({
  provider: 'mock',
  model: 'test-model',
  data: {
    blocks: [
      {
        type: 'text' as const,
        text: `${label} :: hist=${input.history.length}`,
        purpose: 'answer' as const,
      },
    ],
  },
  usage: { inputTokens: 8, outputTokens: 12 },
  latencyMs: 4,
});

const runTurn = (input: {
  userMessage: string;
  history?: BoundedHistoryMessage[];
  generateAnswer?: (
    input: AiChatGenerateAnswerInput,
  ) => ReturnType<typeof answerFromPrompt> | Promise<ReturnType<typeof answerFromPrompt>>;
}) => {
  const captured: AiChatGenerateAnswerInput[] = [];
  setBuildGuideStepTurnDependenciesForTests({
    loadBuild: loadPlantStand,
    isProviderOperational: () => true,
    generateAnswer: async (promptInput) => {
      captured.push(promptInput);
      if (input.generateAnswer) {
        return input.generateAnswer(promptInput);
      }
      return answerFromPrompt(promptInput, 'help');
    },
  });

  return {
    captured,
    result: tryHandleBuildGuideStepTurn({
      userMessage: input.userMessage,
      locale: 'ar',
      conversationId: 'conv-guide',
      authenticatedUserId: 'user-1',
      clientMessageId: `cmsg-${input.userMessage}`,
      projectBuildId: 'build-plant',
      history: input.history,
    }),
  };
};

const hasGuideCard = (blocks: Array<{ type: string }>) =>
  blocks.some((block) => block.type === 'build_step_guide');

describe('build-guide step-turn help vs status', () => {
  test('classifies SHOW vs EXPLAIN without treating help as current-step status', () => {
    assert.equal(classifyBuildGuideStepTurnIntent('شو الخطوة الحالية؟').kind, 'show');
    assert.equal(classifyBuildGuideStepTurnIntent('وين وصلت؟').kind, 'show');
    assert.equal(shouldAttachBuildStepGuideCard('show'), true);

    assert.equal(classifyBuildGuideStepTurnIntent('شو هاي الخطوة؟').kind, 'explain');
    assert.equal(classifyBuildGuideStepTurnIntent('اشرح لي أكثر').kind, 'explain');
    assert.equal(classifyBuildGuideStepTurnIntent('اشرح لي أكثر').followUp, true);
    assert.equal(classifyBuildGuideStepTurnIntent('لسا مش فاهم').kind, 'explain');
    assert.equal(classifyBuildGuideStepTurnIntent('شو أعمل هسا؟').kind, 'explain');
    assert.equal(
      classifyBuildGuideStepTurnIntent(
        'هل انت شغال حاليا؟ ساعدني فهمني بالتفصيل شو اعمل',
      ).kind,
      'explain',
    );
    assert.equal(shouldAttachBuildStepGuideCard('explain'), false);
    assert.equal(shouldAttachBuildStepGuideCard('follow_up'), false);
  });

  test('same conversation: explain follow-ups stay on the live step, pass history, and do not repeat the step card', async () => {
    const turn1 = runTurn({ userMessage: 'شو هاي الخطوة؟' });
    const first = await turn1.result;
    assert.ok(first);
    assert.equal(first.route, 'BUILD_CHECKLIST');
    assert.equal(hasGuideCard(first.blocks), false);
    assert.match(turn1.captured[0]?.userMessage ?? '', /concise practical explanation/i);
    assert.match(turn1.captured[0]?.userMessage ?? '', /Recent conversation: \(none\)/);
    assert.equal(turn1.captured[0]?.history.length, 0);

    const historyAfterTurn1: BoundedHistoryMessage[] = [
      { role: 'user', text: 'شو هاي الخطوة؟' },
      {
        role: 'assistant',
        text: first.blocks.find((block) => block.type === 'text')?.text ?? '',
      },
    ];

    const turn2 = runTurn({
      userMessage: 'اشرح لي أكثر',
      history: historyAfterTurn1,
    });
    const second = await turn2.result;
    assert.ok(second);
    assert.equal(hasGuideCard(second.blocks), false);
    assert.notEqual(
      second.blocks.find((block) => block.type === 'text')?.text,
      first.blocks.find((block) => block.type === 'text')?.text,
    );
    assert.match(turn2.captured[0]?.userMessage ?? '', /Give MORE detail/i);
    assert.match(turn2.captured[0]?.userMessage ?? '', /شو هاي الخطوة؟/);
    assert.equal(turn2.captured[0]?.history.length, 2);
    assert.match(
      turn2.captured[0]?.trustedSystemContext ?? '',
      /PVC Plant Stand/,
    );
    assert.match(
      turn2.captured[0]?.trustedSystemContext ?? '',
      /Current step: 2 of 4/,
    );

    const historyAfterTurn2: BoundedHistoryMessage[] = [
      ...historyAfterTurn1,
      { role: 'user', text: 'اشرح لي أكثر' },
      {
        role: 'assistant',
        text: second.blocks.find((block) => block.type === 'text')?.text ?? '',
      },
    ];

    const turn3 = runTurn({
      userMessage: 'لسا مش فاهم',
      history: historyAfterTurn2,
    });
    const third = await turn3.result;
    assert.ok(third);
    assert.equal(hasGuideCard(third.blocks), false);
    assert.match(turn3.captured[0]?.userMessage ?? '', /still does not understand/i);
    assert.match(turn3.captured[0]?.userMessage ?? '', /numbered actions/i);
    assert.equal(turn3.captured[0]?.history.length, 4);
    assert.match(
      turn3.captured[0]?.userMessage ?? '',
      /PVC Pipe, Plastic tray/,
    );
    assert.doesNotMatch(turn3.captured[0]?.userMessage ?? '', /Elbow connectors/i);
  });

  test('availability + detailed help routes to contextual explain, not a status card', async () => {
    const turn = runTurn({
      userMessage: 'هل انت شغال حاليا؟ ساعدني فهمني بالتفصيل شو اعمل',
    });
    const result = await turn.result;
    assert.ok(result);
    assert.equal(hasGuideCard(result.blocks), false);
    assert.match(turn.captured[0]?.userMessage ?? '', /Prepare the main parts/);
    assert.doesNotMatch(turn.captured[0]?.userMessage ?? '', /I am online|available now/i);
  });

  test('explicit current-step status may include the structured card once', async () => {
    const turn = runTurn({ userMessage: 'شو الخطوة الحالية؟' });
    const result = await turn.result;
    assert.ok(result);
    assert.equal(hasGuideCard(result.blocks), true);
    assert.equal(turn.captured.length, 0);
    const text = result.blocks.find((block) => block.type === 'text')?.text ?? '';
    assert.match(text, /أنجزت 1 من 4/);
    assert.match(text, /الخطوة الحالية: 2/);
  });

  test('provider timeout does not clear the linked build; next turn still has Step 2 context', async () => {
    const loadCalls: string[] = [];
    let shouldTimeout = true;
    const captured: AiChatGenerateAnswerInput[] = [];

    setBuildGuideStepTurnDependenciesForTests({
      loadBuild: async (buildId) => {
        loadCalls.push(buildId);
        return loadPlantStand();
      },
      isProviderOperational: () => true,
      generateAnswer: async (promptInput) => {
        captured.push(promptInput);
        if (shouldTimeout) {
          throw new AppError(
            'The learning assistant timed out. Please try again.',
            504,
            'AI_PROVIDER_TIMEOUT',
          );
        }
        return answerFromPrompt(promptInput, 'recovered');
      },
    });

    await assert.rejects(
      () =>
        tryHandleBuildGuideStepTurn({
          userMessage: 'اشرح لي أكثر مش فاهم اشي!',
          locale: 'ar',
          conversationId: 'conv-guide',
          authenticatedUserId: 'user-1',
          clientMessageId: 'cmsg-timeout',
          projectBuildId: 'build-plant',
          history: [
            { role: 'user', text: 'شو هاي الخطوة؟' },
            { role: 'assistant', text: 'شرح مختصر للخطوة 2.' },
          ],
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'AI_PROVIDER_TIMEOUT',
    );

    shouldTimeout = false;
    const recovered = await tryHandleBuildGuideStepTurn({
      userMessage: 'اشرح لي أكثر',
      locale: 'ar',
      conversationId: 'conv-guide',
      authenticatedUserId: 'user-1',
      clientMessageId: 'cmsg-retry',
      projectBuildId: 'build-plant',
      history: [
        { role: 'user', text: 'شو هاي الخطوة؟' },
        { role: 'assistant', text: 'شرح مختصر للخطوة 2.' },
      ],
    });

    assert.deepEqual(loadCalls, ['build-plant', 'build-plant']);
    assert.ok(recovered);
    assert.equal(hasGuideCard(recovered.blocks), false);
    assert.match(captured.at(-1)?.trustedSystemContext ?? '', /PVC Plant Stand/);
    assert.match(captured.at(-1)?.trustedSystemContext ?? '', /Current step: 2 of 4/);
    assert.match(captured.at(-1)?.userMessage ?? '', /Prepare the main parts/);
  });
});
