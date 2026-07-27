import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, test } from 'node:test';

import type { NormalizedSequentialDiscussionReply } from './ai-project-authoring-sequential-discussion.provider.js';

process.env.NODE_TEST_CONTEXT ??= '1';

const baseContext = {
  locale: 'en' as const,
  projectId: 'project-a',
  projectTitle: 'Arduino door alarm',
  projectShortDescription: 'Alarm when door opens',
  projectDescription: 'Uses reed switch, buzzer, and red LED.',
  projectDifficulty: 'BEGINNER',
  projectEstimatedMinutes: 90,
  explanation: 'Initial suggestion',
  repairAttempt: false,
};

const suggestionValue = (reply: NormalizedSequentialDiscussionReply) => {
  if (reply.replyType !== 'REVISED_SUGGESTION') {
    throw new Error(`Expected a revised suggestion, received ${reply.replyType}`);
  }
  return reply.suggestion.value;
};

describe('scalar authoring provider orchestration', () => {
  const previousProvider = process.env.AI_CHAT_PROVIDER;

  after(() => {
    process.env.AI_CHAT_PROVIDER = previousProvider ?? 'mock';
  });

  afterEach(async () => {
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { setResolvedAiChatProviderForTests } = await import('../../config/env.js');
    setAuthoringRealScalarInvokerForTests(null);
    setResolvedAiChatProviderForTests(null);
  });

  beforeEach(() => {
    process.env.AI_CHAT_PROVIDER = 'mock';
  });

  test('real-provider scalar path never calls buildMockRevision', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setResolvedAiChatProviderForTests } = await import('../../config/env.js');
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialStageDiscussion } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    setResolvedAiChatProviderForTests('gemini');

    let invoked = false;
    setAuthoringRealScalarInvokerForTests(async () => {
      invoked = true;
      return {
        text: JSON.stringify({
          kind: 'REVISED_PROPOSAL',
          stage: 'TITLE',
          value: 'Arduino Door Alarm Kit',
          explanation: 'Concise title from structured provider.',
        }),
        model: 'test-gemini',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    const reply = await generateSequentialStageDiscussion({
      ...baseContext,
      stage: 'TITLE',
      comment: '',
      currentProposal: { value: 'Untitled project' },
    });

    assert.equal(invoked, true);
    assert.equal(reply.replyType, 'REVISED_SUGGESTION');
    assert.equal(suggestionValue(reply), 'Arduino Door Alarm Kit');
  });

  test('mock scalar path may call mock revision only when provider=mock', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { generateSequentialStageDiscussion } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    const reply = await generateSequentialStageDiscussion({
      ...baseContext,
      stage: 'TITLE',
      comment: '',
      currentProposal: { value: 'Untitled project' },
    });

    assert.equal(reply.replyType, 'REVISED_SUGGESTION');
    assert.ok(`${suggestionValue(reply)}`.length > 0);
  });

  test('disabled provider fabricates no proposal', async () => {
    process.env.AI_CHAT_PROVIDER = 'disabled';
    const { generateSequentialStageDiscussion } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    await assert.rejects(
      () =>
        generateSequentialStageDiscussion({
          ...baseContext,
          stage: 'TITLE',
          comment: '',
          currentProposal: { value: 'Untitled project' },
        }),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        (error as { code?: string }).code === 'AI_DISABLED',
    );
  });

  test('initial title uses generic structured result', async () => {
    process.env.AI_CHAT_PROVIDER = 'openai';
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { createStageProposalTurn } = await import('./project-authoring-session.helpers.js');

    setAuthoringRealScalarInvokerForTests(async ({ userPrompt }) => {
      assert.ok(userPrompt.includes('project-a'));
      return {
        text: JSON.stringify({
          kind: 'REVISED_PROPOSAL',
          stage: 'TITLE',
          value: 'Smart Door Alarm',
          explanation: 'Provider-generated concise title.',
        }),
        model: 'test-openai',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    const proposal = await createStageProposalTurn({
      session: {
        id: 'session-1',
        conversationId: 'conv-1',
        version: 1,
      } as never,
      project: {
        id: 'project-a',
        title: 'Beginner Arduino door alarm with reed switch',
        shortDescription: 'TBD',
        description: 'TBD',
        difficulty: 'BEGINNER',
        estimatedDurationMinutes: 90,
        updatedAt: new Date(),
        category: null,
        requiredComponents: [],
        steps: [],
      } as never,
      locale: 'en',
      stage: 'TITLE',
    });

    assert.equal((proposal.payload as { value: string | number }).value, 'Smart Door Alarm');
  });

  test('short description feedback creates revised suggestion', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialStageDiscussionWithRepair } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    setAuthoringRealScalarInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'REVISED_PROPOSAL',
        stage: 'SHORT_DESCRIPTION',
        value:
          'A compact Arduino door alarm with buzzer and red LED triggered by a magnetic reed switch.',
        explanation: 'Shorter description based on feedback.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const feedback = 'Make it shorter and mention buzzer plus red LED clearly.';
    const reply = await generateSequentialStageDiscussionWithRepair({
      ...baseContext,
      stage: 'SHORT_DESCRIPTION',
      comment: feedback,
      currentProposal: {
        value:
          'An Arduino-based door alarm prototype that uses a magnetic reed switch to detect when a door opens and then activates a buzzer and red LED warning indicator for beginners.',
      },
    });

    assert.equal(reply.replyType, 'REVISED_SUGGESTION');
    assert.ok(!`${suggestionValue(reply)}`.includes(feedback));
  });

  test('learner feedback is not embedded in revised value', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialStageDiscussionWithRepair } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    const feedback =
      'العنوان طويل وعام. أعطيني وصف أقصر، ويكون واضح إنه إنذار باب باستخدام Arduino.';
    setAuthoringRealScalarInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'REVISED_PROPOSAL',
        stage: 'SHORT_DESCRIPTION',
        value:
          'إنذار باب Arduino يفعّل Buzzer وLED أحمر عند فتح الباب عبر Reed switch مغناطيسي.',
        explanation: 'وصف أقصر وأوضح.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const reply = await generateSequentialStageDiscussionWithRepair({
      locale: 'ar',
      stage: 'SHORT_DESCRIPTION',
      comment: feedback,
      currentProposal: {
        value:
          'مشروع Arduino لإنذار الباب باستخدام Reed switch وBuzzer وLED أحمر عند فتح الباب.',
      },
      explanation: 'اقتراح أولي',
      projectTitle: 'Arduino door alarm',
      projectShortDescription: 'Door alarm prototype',
      projectDescription: null,
      repairAttempt: false,
    });

    assert.equal(reply.replyType, 'REVISED_SUGGESTION');
    assert.ok(!`${suggestionValue(reply)}`.includes(feedback));
  });

  test('full description feedback uses structured provider result', async () => {
    process.env.AI_CHAT_PROVIDER = 'openai';
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialStageDiscussionWithRepair } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    setAuthoringRealScalarInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'REVISED_PROPOSAL',
        stage: 'FULL_DESCRIPTION',
        value:
          'Learners wire a reed switch to an Arduino, tune the alert, and test buzzer plus LED feedback step by step.',
        explanation: 'Expanded full description.',
      }),
      model: 'test-openai',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const reply = await generateSequentialStageDiscussionWithRepair({
      ...baseContext,
      stage: 'FULL_DESCRIPTION',
      comment: 'Add more build and testing detail.',
      currentProposal: { value: 'Basic door alarm build.' },
    });

    assert.match(`${suggestionValue(reply)}`, /step by step/i);
  });

  test('difficulty revision validates allowed value', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialStageDiscussionWithRepair } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    setAuthoringRealScalarInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'REVISED_PROPOSAL',
        stage: 'DIFFICULTY',
        value: 'INTERMEDIATE',
        explanation: 'More wiring detail than beginner.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const reply = await generateSequentialStageDiscussionWithRepair({
      ...baseContext,
      stage: 'DIFFICULTY',
      comment: 'This feels harder than beginner.',
      currentProposal: { value: 'BEGINNER' },
    });

    assert.equal(suggestionValue(reply), 'INTERMEDIATE');
  });

  test('Arabic duration feedback أعلى من 60 returns value greater than 60', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialStageDiscussionWithRepair } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    setAuthoringRealScalarInvokerForTests(async ({ userPrompt }) => {
      assert.match(userPrompt, /أعلى من 60|greater than 60/i);
      return {
        text: JSON.stringify({
          kind: 'REVISED_PROPOSAL',
          stage: 'ESTIMATED_DURATION',
          value: 90,
          explanation: 'Longer build and testing time.',
        }),
        model: 'test-gemini',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    const reply = await generateSequentialStageDiscussionWithRepair({
      locale: 'ar',
      stage: 'ESTIMATED_DURATION',
      comment: 'بدي وقت أعلى من 60 دقيقة',
      currentProposal: { value: 60 },
      explanation: 'مدة أولية',
      projectTitle: 'Arduino door alarm',
      projectShortDescription: 'Door alarm',
      projectDescription: null,
      repairAttempt: false,
    });

    assert.equal(reply.replyType, 'REVISED_SUGGESTION');
    assert.ok(Number(suggestionValue(reply)) > 60);
  });

  test('suggest another title is materially different', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateAlternativeStageDiscussionWithRepair } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    const current = 'Arduino Door Alarm';
    setAuthoringRealScalarInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'REVISED_PROPOSAL',
        stage: 'TITLE',
        value: 'Magnetic Door Alert Project',
        explanation: 'Alternative title.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const reply = await generateAlternativeStageDiscussionWithRepair({
      ...baseContext,
      stage: 'TITLE',
      comment: '',
      currentProposal: { value: current },
      suggestAnother: true,
    });

    assert.notEqual(suggestionValue(reply), current);
  });

  test('suggest another description is materially different', async () => {
    process.env.AI_CHAT_PROVIDER = 'openai';
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateAlternativeStageDiscussionWithRepair } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    const current =
      'A compact Arduino door alarm that activates a buzzer and red LED when a magnetic reed switch detects an open door.';
    setAuthoringRealScalarInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'REVISED_PROPOSAL',
        stage: 'SHORT_DESCRIPTION',
        value:
          'Arduino reed-switch alarm with instant buzzer and LED warning for beginners.',
        explanation: 'Alternative short description.',
      }),
      model: 'test-openai',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const reply = await generateAlternativeStageDiscussionWithRepair({
      ...baseContext,
      stage: 'SHORT_DESCRIPTION',
      comment: '',
      currentProposal: { value: current },
      suggestAnother: true,
    });

    assert.notEqual(suggestionValue(reply), current);
  });

  test('identical suggest-another result triggers one repair', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateAlternativeStageDiscussionWithRepair } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    let calls = 0;
    const current = 'Arduino Door Alarm';
    setAuthoringRealScalarInvokerForTests(async () => {
      calls += 1;
      return {
        text: JSON.stringify({
          kind: 'REVISED_PROPOSAL',
          stage: 'TITLE',
          value: calls === 1 ? current : 'Reed Switch Door Alert',
          explanation: calls === 1 ? 'Same title.' : 'Different title.',
        }),
        model: 'test-gemini',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    const reply = await generateAlternativeStageDiscussionWithRepair({
      ...baseContext,
      stage: 'TITLE',
      comment: '',
      currentProposal: { value: current },
      suggestAnother: true,
    });

    assert.equal(calls, 2);
    assert.notEqual(suggestionValue(reply), current);
  });

  test('repeated identical suggest-another result returns AI_AUTHORING_NO_ALTERNATIVE', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateAlternativeStageDiscussionWithRepair } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    const current = 'Arduino Door Alarm';
    setAuthoringRealScalarInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'REVISED_PROPOSAL',
        stage: 'TITLE',
        value: current,
        explanation: 'Same title again.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    await assert.rejects(
      () =>
        generateAlternativeStageDiscussionWithRepair({
          ...baseContext,
          stage: 'TITLE',
          comment: '',
          currentProposal: { value: current },
          suggestAnother: true,
        }),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        (error as { code?: string }).code === 'AI_AUTHORING_NO_ALTERNATIVE',
    );
  });

  test('provider failure keeps validation error without fabricating proposal', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialStageDiscussionWithRepair } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    setAuthoringRealScalarInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'REVISED_PROPOSAL',
        stage: 'SHORT_DESCRIPTION',
        value: 'Please make it shorter and clearer for beginners.',
        explanation: 'Echoed learner feedback.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const feedback = 'Please make it shorter and clearer for beginners.';
    await assert.rejects(
      () =>
        generateSequentialStageDiscussionWithRepair({
          ...baseContext,
          stage: 'SHORT_DESCRIPTION',
          comment: feedback,
          currentProposal: { value: 'Long initial description for the door alarm project.' },
        }),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        (error as { code?: string }).code === 'AI_PROVIDER_RESPONSE_INVALID',
    );
  });

  test('test provider injection prevents real external HTTP calls', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setResolvedAiChatProviderForTests } = await import('../../config/env.js');
    const { setAuthoringRealScalarInvokerForTests, getAuthoringRealScalarInvokerCallCountForTests } =
      await import('./ai-project-authoring-real.provider.js');
    const { generateSequentialStageDiscussion } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    setResolvedAiChatProviderForTests('gemini');
    setAuthoringRealScalarInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'REVISED_PROPOSAL',
        stage: 'TITLE',
        value: 'Injected Provider Title',
        explanation: 'From injected invoker only.',
      }),
      model: 'injected',
      inputTokens: 0,
      outputTokens: 0,
    }));

    const reply = await generateSequentialStageDiscussion({
      ...baseContext,
      stage: 'TITLE',
      comment: '',
      currentProposal: { value: 'Untitled project' },
    });

    assert.equal(suggestionValue(reply), 'Injected Provider Title');
    assert.equal(getAuthoringRealScalarInvokerCallCountForTests(), 1);
  });

  test('project A scalar prompt contains no project B context', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealScalarInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialStageDiscussion } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );

    let capturedPrompt = '';
    setAuthoringRealScalarInvokerForTests(async ({ userPrompt }) => {
      capturedPrompt = userPrompt;
      return {
        text: JSON.stringify({
          kind: 'REVISED_PROPOSAL',
          stage: 'TITLE',
          value: 'Cardboard Phone Stand',
          explanation: 'Craft title.',
        }),
        model: 'test-gemini',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    await generateSequentialStageDiscussion({
      locale: 'en',
      projectId: 'project-b',
      stage: 'TITLE',
      comment: '',
      currentProposal: { value: 'Untitled project' },
      explanation: '',
      projectTitle: 'Cardboard phone stand',
      projectShortDescription: 'Simple craft stand',
      projectDescription: 'Fold and glue cardboard.',
      repairAttempt: false,
    });

    assert.ok(capturedPrompt.includes('project-b'));
    assert.ok(capturedPrompt.includes('Cardboard phone stand'));
    assert.ok(!capturedPrompt.includes('project-a'));
    assert.ok(!capturedPrompt.includes('Arduino door alarm'));
  });
});
