import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';

process.env.NODE_TEST_CONTEXT ??= '1';
process.env.AI_CHAT_PROVIDER = 'mock';

describe('authoring session corrections', () => {
  beforeEach(async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { setResolvedAiChatProviderForTests } = await import('../../config/env.js');
    setResolvedAiChatProviderForTests('mock');
  });

  after(async () => {
    const { setResolvedAiChatProviderForTests } = await import('../../config/env.js');
    setResolvedAiChatProviderForTests(null);
  });
  test('learner feedback cannot become scalar proposal payload', async () => {
    const { generateSequentialStageDiscussionWithRepair } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );
    const feedback =
      'العنوان طويل وعام. أعطيني وصف أقصر، ويكون واضح إنه إنذار باب باستخدام Arduino.';

    const reply = await generateSequentialStageDiscussionWithRepair({
      locale: 'ar',
      stage: 'SHORT_DESCRIPTION',
      comment: feedback,
      currentProposal: {
        value:
          'مشروع Arduino لإنذار الباب باستخدام Reed switch وBuzzer وLED أحمر عند فتح الباب.',
      },
      explanation: 'اقتراح أولي',
      projectTitle: 'Arduino door alarm with reed switch',
      projectShortDescription: 'Door alarm prototype',
      projectDescription: null,
      repairAttempt: false,
    });

    assert.equal(reply.replyType, 'REVISED_SUGGESTION');
    assert.ok(!`${reply.suggestion.value}`.includes(feedback));
    assert.notEqual(reply.suggestion.value, feedback);
  });

  test('suggest another returns a materially different short description', async () => {
    const { generateAlternativeStageDiscussionWithRepair } = await import(
      './ai-project-authoring-sequential-discussion.provider.js'
    );
    const current =
      'A compact Arduino door alarm that activates a buzzer and red LED when a magnetic reed switch detects an open door.';

    const reply = await generateAlternativeStageDiscussionWithRepair({
      locale: 'en',
      stage: 'SHORT_DESCRIPTION',
      comment: '',
      currentProposal: { value: current },
      explanation: 'Initial suggestion',
      projectTitle: 'Arduino door alarm',
      projectShortDescription: current,
      projectDescription: null,
      repairAttempt: false,
      suggestAnother: true,
    });

    assert.notEqual(reply.suggestion.value, current);
  });

  test('door-alarm component generation excludes soil moisture sensor', async () => {
    const { generateSequentialComponentList } = await import(
      './ai-project-authoring-sequential-components.provider.js'
    );
    const generated = await generateSequentialComponentList({
      locale: 'en',
      ideaText: 'Arduino door alarm with magnetic reed switch, buzzer, and red LED',
      projectTitle: 'Arduino door alarm',
      projectShortDescription: 'Alarm when the door opens',
      projectDescription: 'No LCD, no relay, no motion sensor',
      clarification: {
        type: 'project_authoring_clarification',
        status: 'READY_FOR_PROPOSAL',
        summary: 'Door alarm',
        knownFacts: [],
        nextQuestion: null,
        remainingTopics: 0,
        assumptions: [],
        warnings: [],
        ideaText: 'Arduino door alarm',
        questions: [],
        answers: [],
        policyVersion: 'v1',
      },
      recentAnswers: [],
    });

    const names = generated.components.map((component) => component.componentName.toLowerCase()).join(' ');
    assert.match(names, /reed|buzzer|led|arduino/);
    assert.doesNotMatch(names, /soil moisture/);
  });

  test('unknown electronics project does not default to soil moisture sensor', async () => {
    const { generateSequentialComponentList } = await import(
      './ai-project-authoring-sequential-components.provider.js'
    );
    const generated = await generateSequentialComponentList({
      locale: 'en',
      ideaText: 'Beginner electronics breadboard practice kit',
      projectTitle: 'Breadboard practice kit',
      projectShortDescription: 'Learn basic wiring',
      projectDescription: 'Generic beginner electronics exercise',
      clarification: {
        type: 'project_authoring_clarification',
        status: 'READY_FOR_PROPOSAL',
        summary: 'Practice kit',
        knownFacts: [],
        nextQuestion: null,
        remainingTopics: 0,
        assumptions: [],
        warnings: [],
        ideaText: 'Breadboard practice kit',
        questions: [],
        answers: [],
        policyVersion: 'v1',
      },
      recentAnswers: [],
    });

    const names = generated.components.map((component) => component.componentName.toLowerCase()).join(' ');
    assert.doesNotMatch(names, /soil moisture/);
  });
});
