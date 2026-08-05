import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { AppError } from '../../utils/app-error.js';

import {
  getProjectLearningPackGenerator,
  isProjectLearningLocalDeterministicMode,
  resolveProjectLearningGeneratorMode,
  setProjectLearningPackGeneratorForTests,
} from './project-learning-pack-generator.factory.js';
import {
  buildLocalDeterministicLearningPack,
  LocalDeterministicProjectLearningPackGeneratorProvider,
} from './project-learning-pack-generator.local.provider.js';
import { validateGeneratedLearningPack } from './project-learning-pack-validation.js';
import type { ProjectLearningCanonicalSnapshot } from './project-learning-snapshot.js';

const sampleSnapshot = (
  overrides?: Partial<ProjectLearningCanonicalSnapshot>,
): ProjectLearningCanonicalSnapshot => ({
  title: 'Sample Bench Light',
  shortDescription: 'Build a safe desk light from basic parts.',
  description: 'A practical project for learning circuits and assembly.',
  difficulty: 'BEGINNER',
  estimatedDurationMinutes: 45,
  components: [
    {
      componentName: 'LED',
      materialType: 'electronic',
      quantity: '1',
      unit: 'pcs',
      componentRole: 'PRIMARY',
      isRequired: true,
      canBeSubstituted: false,
      notes: null,
      searchKeywords: null,
      alternativeKeywords: null,
    },
    {
      componentName: 'Resistor',
      materialType: 'electronic',
      quantity: '1',
      unit: 'pcs',
      componentRole: 'SUPPORT',
      isRequired: true,
      canBeSubstituted: true,
      notes: null,
      searchKeywords: null,
      alternativeKeywords: null,
    },
  ],
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      title: 'Prepare materials',
      description: 'Lay out the LED and resistor safely.',
    },
    {
      id: 'step-2',
      stepNumber: 2,
      title: 'Assemble circuit',
      description: 'Connect the LED through the resistor.',
    },
  ],
  ...overrides,
});

describe('project learning local deterministic generator', () => {
  afterEach(() => {
    setProjectLearningPackGeneratorForTests(null);
    delete process.env.PROJECT_LEARNING_GENERATOR_MODE;
    delete process.env.NODE_ENV;
  });

  test('local deterministic mode is accepted outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.PROJECT_LEARNING_GENERATOR_MODE = 'local_deterministic';
    assert.equal(isProjectLearningLocalDeterministicMode(), true);
    assert.equal(resolveProjectLearningGeneratorMode(), 'local_deterministic');
    const provider = getProjectLearningPackGenerator();
    assert.equal(provider.name, 'local-deterministic');
  });

  test('local deterministic mode is disabled in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.PROJECT_LEARNING_GENERATOR_MODE = 'local_deterministic';
    assert.equal(isProjectLearningLocalDeterministicMode(), false);
    assert.equal(resolveProjectLearningGeneratorMode(), 'auto');
  });

  test('local generator makes zero network calls and passes validation', async () => {
    const snapshot = sampleSnapshot();
    const provider = new LocalDeterministicProjectLearningPackGeneratorProvider();
    const result = await provider.generateProjectLearningPack({
      snapshot,
      contentHash: 'hash',
      promptVersion: 'test',
      generatorSchemaVersion: 1,
    });

    assert.equal(result.provider, 'local-deterministic');
    assert.equal(result.model, 'local-template-v1');
    const validated = validateGeneratedLearningPack(result.data, snapshot);
    const start = validated.questions.filter((q) => q.stage === 'START');
    const final = validated.questions.filter((q) => q.stage === 'FINAL');
    assert.ok(start.length >= 2 && start.length <= 3);
    assert.ok(final.length >= 3 && final.length <= 5);
    for (const step of snapshot.steps) {
      const stepQs = validated.questions.filter(
        (q) => q.stage === 'STEP' && q.projectStepId === step.id,
      );
      assert.ok(stepQs.length >= 1 && stepQs.length <= 2);
    }
    for (const question of validated.questions) {
      assert.ok(question.promptEn.trim().length > 0);
      assert.ok(question.promptAr.trim().length > 0);
      assert.ok(
        question.options.some((option) => option.optionKey === question.correctOptionKey),
      );
    }
  });

  test('same snapshot produces deterministic output', () => {
    const snapshot = sampleSnapshot();
    const first = buildLocalDeterministicLearningPack(snapshot);
    const second = buildLocalDeterministicLearningPack(snapshot);
    assert.deepEqual(first, second);
  });

  test('changed snapshot title changes generated prompts', () => {
    const first = buildLocalDeterministicLearningPack(sampleSnapshot());
    const second = buildLocalDeterministicLearningPack(
      sampleSnapshot({ title: 'Changed Project Title' }),
    );
    assert.notEqual(first.questions[0]?.promptEn, second.questions[0]?.promptEn);
  });

  test('factory override still wins for tests', () => {
    setProjectLearningPackGeneratorForTests({
      name: 'override',
      generateProjectLearningPack: async () => {
        throw new AppError('boom', 500, 'TEST');
      },
    });
    assert.equal(getProjectLearningPackGenerator().name, 'override');
  });

  test('local generator avoids forbidden distractors and title-only STEP answers', () => {
    const snapshot = sampleSnapshot();
    const pack = buildLocalDeterministicLearningPack(snapshot);
    const forbidden =
      /\b(skip all|ignore (required )?materials|change (the )?step order randomly|discard learning|do nothing|choose anything)\b/i;
    const genericKeys = new Set([
      'concept',
      'question',
      'generic',
      'misc',
      'other',
      'test',
      'todo',
    ]);

    for (const question of pack.questions) {
      assert.ok(!genericKeys.has(question.conceptKey));
      assert.ok(question.explanationEn.trim().length > 0);
      assert.ok(question.explanationAr.trim().length > 0);
      for (const option of question.options) {
        if (option.optionKey === question.correctOptionKey) {
          continue;
        }
        assert.equal(forbidden.test(option.textEn), false, option.textEn);
        assert.equal(forbidden.test(option.textAr), false, option.textAr);
      }
      if (question.stage === 'STEP' && question.questionType !== 'TRUE_FALSE') {
        const step = snapshot.steps.find((item) => item.id === question.projectStepId);
        assert.ok(step);
        const correct = question.options.find(
          (option) => option.optionKey === question.correctOptionKey,
        );
        assert.ok(correct);
        assert.notEqual(correct.textEn.trim().toLowerCase(), step.title.trim().toLowerCase());
        assert.equal(
          /^complete step\s+\d+/i.test(correct.textEn.trim()),
          false,
          correct.textEn,
        );
        assert.match(question.promptEn, new RegExp(step.title, 'i'));
      }
    }

    const finalPrompts = pack.questions
      .filter((question) => question.stage === 'FINAL')
      .map((question) => question.promptEn.toLowerCase());
    assert.ok(
      finalPrompts.some(
        (prompt) =>
          prompt.includes('not') ||
          prompt.includes('troubleshoot') ||
          prompt.includes('check') ||
          prompt.includes('verify') ||
          prompt.includes('fail'),
      ),
    );
  });
});
