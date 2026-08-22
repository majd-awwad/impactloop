import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';

process.env.NODE_TEST_CONTEXT ??= '1';

import { AppError } from '../../utils/app-error.js';
import type { SequentialStep } from './ai-project-authoring-sequential.policy.js';
import {
  generateAlternativeSequentialStepPlanWithRepair,
  generateSequentialStepList,
  generateSequentialStepListWithRepair,
  generateStepStageReply,
} from './ai-project-authoring-sequential-steps.provider.js';

const clarification = {
  type: 'project_authoring_clarification' as const,
  status: 'READY_FOR_PROPOSAL' as const,
  summary: 'Beginner Arduino door alarm',
  knownFacts: [],
  nextQuestion: null,
  remainingTopics: 0,
  assumptions: [],
  warnings: [],
};

const doorComponents = [
  {
    id: 'comp-arduino',
    componentName: 'Arduino Uno',
    materialType: 'Microcontroller',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: ['arduino'],
    notes: null,
  },
  {
    id: 'comp-reed',
    componentName: 'Reed switch',
    materialType: 'Sensor',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: ['reed'],
    notes: null,
  },
  {
    id: 'comp-buzzer',
    componentName: 'Buzzer',
    materialType: 'Output',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: ['buzzer'],
    notes: null,
  },
  {
    id: 'comp-led',
    componentName: 'Red LED',
    materialType: 'Output',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: ['led'],
    notes: null,
  },
];

const ldrComponents = [
  {
    id: 'comp-arduino',
    componentName: 'Arduino Uno',
    materialType: 'Microcontroller',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: ['arduino'],
    notes: null,
  },
  {
    id: 'comp-ldr',
    componentName: 'LDR photoresistor',
    materialType: 'Sensor',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: ['ldr'],
    notes: null,
  },
  {
    id: 'comp-10k',
    componentName: '10k ohm resistor',
    materialType: 'Electronics',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: [],
    notes: null,
  },
  {
    id: 'comp-led',
    componentName: 'White LED',
    materialType: 'Output',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: ['led'],
    notes: null,
  },
  {
    id: 'comp-220',
    componentName: '220 ohm resistor',
    materialType: 'Electronics',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: [],
    notes: null,
  },
  {
    id: 'comp-breadboard',
    componentName: 'Breadboard',
    materialType: 'Tool',
    quantity: 1,
    unit: 'piece',
    componentRole: 'TOOL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: [],
    notes: null,
  },
];

const detailedProviderSteps = (prefix: string) => {
  const descriptions = [
    `${prefix}: جهّز Arduino Uno وLDR وLED والمقاومات على سطح نظيف وتحقق من سلامة كل قطعة قبل البدء.`,
    `${prefix}: افهم كيف يعمل مقسم الجهد بين LDR ومقاومة 10kΩ على Breadboard لقراءة الضوء بأمان.`,
    `${prefix}: ضع Arduino وBreadboard في مواقع واضحة مع مسارات للأسلاك حتى يسهل تتبع التوصيلات.`,
    `${prefix}: وصّل LDR ومقاومة 10kΩ على Breadboard واربط نقطة القراءة بـ Analog pin A0.`,
    `${prefix}: وصّل LED مع مقاومة 220Ω إلى دبوس رقمي مع مراعاة اتجاه القطبين والتحقق من المسار.`,
    `${prefix}: افتح Arduino IDE وعرّف أسماء واضحة لـ A0 ودبوس LED حتى يسهل قراءة الكود لاحقًا.`,
    `${prefix}: اكتب كودًا يقرأ analogRead من A0 ويطبع القيمة في Serial Monitor عند 9600 baud.`,
    `${prefix}: اختر Threshold مناسبًا وشغّل LED عند انخفاض الإضاءة، ثم ارفع الكود واختبر في الضوء والظلام.`,
  ];
  return descriptions.map((description, index) => ({
    order: index + 1,
    title: `${prefix} step ${index + 1}`,
    description,
    safetyNote: index === 0 ? 'Disconnect USB before rewiring.' : null,
    componentRefs: ['comp-arduino'],
  }));
};

const mockDoorAlarmStepPlan = (locale: 'en' | 'ar'): SequentialStep[] =>
  Array.from({ length: 8 }, (_, index) => ({
    title: locale === 'ar' ? `خطوة ${index + 1}` : `Step ${index + 1}`,
    description:
      locale === 'ar'
        ? `وصف تفصيلي للخطوة ${index + 1} يشرح ماذا تفعل وأين ولماذا وكيف تتأكد أنها نجحت في مشروع Arduino.`
        : `Detailed description for step ${index + 1} explaining what to do, where, why, and how to verify success in this Arduino project.`,
  }));

describe('sequential steps provider', () => {
  const previousProvider = process.env.AI_CHAT_PROVIDER;

  after(() => {
    process.env.AI_CHAT_PROVIDER = previousProvider ?? 'mock';
  });

  test('mock hardware plan is not limited to three shallow steps', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const result = await generateSequentialStepList({
      locale: 'en',
      ideaText:
        'Simple beginner Arduino door alarm with reed switch, buzzer, and red LED. No LCD, relay, or motion sensor.',
      projectTitle: 'Door alarm',
      projectShortDescription: 'Beginner door alarm',
      projectDescription: 'Alert when the door opens',
      difficulty: 'BEGINNER',
      estimatedMinutes: 90,
      components: doorComponents,
      clarification,
      recentAnswers: ['No LCD', 'No relay', 'No motion sensor'],
    });

    assert.ok(result.steps.length >= 8);
    assert.ok(result.steps.every((step) => step.description.trim().length >= 48));
    const joined = result.steps.map((step) => `${step.title} ${step.description}`).join(' ').toLowerCase();
    assert.ok(joined.includes('reed') || joined.includes('arduino') || joined.includes('buzzer'));
    assert.ok(!joined.includes('ultrasonic'));
    assert.ok(!joined.includes('transaction'));
  });

  test('Arabic Arduino mock plan returns Arabic detailed steps', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const result = await generateSequentialStepList({
      locale: 'ar',
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
      projectTitle: 'مصباح ليلي',
      projectShortDescription: 'مشروع مبتدئ',
      projectDescription: 'مصباح ليلي بدون Relay أو LCD',
      difficulty: 'BEGINNER',
      estimatedMinutes: 90,
      components: ldrComponents,
      clarification,
      recentAnswers: [],
    });

    assert.ok(result.steps.length >= 8);
    const joined = result.steps.map((step) => `${step.title} ${step.description}`).join('\n');
    assert.match(joined, /[\u0600-\u06FF]/);
    assert.ok(result.steps.every((step) => step.description.trim().length >= 48));
  });

  test('real-provider path rejects unrelated finance output', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    setAuthoringRealStepInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'STEP_PLAN',
        steps: detailedProviderSteps('Finance').map((step, index) => ({
          ...step,
          title: `Finance step ${index + 1}`,
          description:
            'Build UI components for income and expenses and save transactions to a database for accounting and reporting.',
        })),
        explanation: 'Finance plan.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    await assert.rejects(
      () =>
        generateSequentialStepList({
          locale: 'en',
          ideaText: 'Arduino LDR night light with LED on breadboard',
          projectTitle: 'Night light',
          projectShortDescription: 'Beginner Arduino',
          projectDescription: 'LDR controlled LED',
          difficulty: 'BEGINNER',
          estimatedMinutes: 90,
          components: ldrComponents,
          clarification,
          recentAnswers: [],
        }),
      (error: unknown) =>
        error instanceof AppError &&
        (error.code === 'AI_AUTHORING_STEP_QUALITY_INVALID' ||
          error.code === 'AI_AUTHORING_STEP_GENERATION_FAILED'),
    );
    setAuthoringRealStepInvokerForTests(null);
  });

  test('real-provider path rejects English-only output for Arabic project', async () => {
    process.env.AI_CHAT_PROVIDER = 'openai';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    setAuthoringRealStepInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'STEP_PLAN',
        steps: Array.from({ length: 8 }, (_, index) => ({
          order: index + 1,
          title: `English step ${index + 1}`,
          description: `Connect the Arduino board and wire the LDR and LED for step ${index + 1}. Verify the wiring before continuing.`,
          safetyNote: null,
          componentRefs: ['comp-arduino'],
        })),
        explanation: 'English plan.',
      }),
      model: 'test-openai',
      inputTokens: 1,
      outputTokens: 1,
    }));

    await assert.rejects(
      () =>
        generateSequentialStepList({
          locale: 'ar',
          ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
          projectTitle: 'مصباح ليلي',
          projectShortDescription: 'مشروع مبتدئ',
          projectDescription: 'بدون Relay',
          difficulty: 'BEGINNER',
          estimatedMinutes: 90,
          components: ldrComponents,
          clarification,
          recentAnswers: [],
        }),
      (error: unknown) =>
        error instanceof AppError &&
        (error.code === 'AI_AUTHORING_STEP_QUALITY_INVALID' ||
          error.code === 'AI_AUTHORING_STEP_GENERATION_FAILED'),
    );
    setAuthoringRealStepInvokerForTests(null);
  });

  test('production provider failure does not return mock/generic plan', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests, getAuthoringRealStepInvokerCallCountForTests } =
      await import('./ai-project-authoring-real.provider.js');
    setAuthoringRealStepInvokerForTests(async () => {
      throw new Error('provider unavailable');
    });

    await assert.rejects(
      () =>
        generateSequentialStepListWithRepair({
          locale: 'en',
          ideaText: 'Arduino LDR night light',
          projectTitle: 'Night light',
          projectShortDescription: 'Beginner Arduino',
          projectDescription: 'LDR controlled LED',
          difficulty: 'BEGINNER',
          estimatedMinutes: 90,
          components: ldrComponents,
          clarification,
          recentAnswers: [],
        }),
      (error: unknown) => error instanceof AppError,
    );
    assert.equal(getAuthoringRealStepInvokerCallCountForTests(), 1);
    setAuthoringRealStepInvokerForTests(null);
  });

  test('bounded repair accepts valid provider output on second attempt', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    let calls = 0;
    setAuthoringRealStepInvokerForTests(async () => {
      calls += 1;
      if (calls === 1) {
        return {
          text: JSON.stringify({
            kind: 'STEP_PLAN',
            steps: [
              {
                order: 1,
                title: 'Too short',
                description: 'Short.',
                safetyNote: null,
                componentRefs: ['comp-arduino'],
              },
              {
                order: 2,
                title: 'Also short',
                description: 'Still short.',
                safetyNote: null,
                componentRefs: ['comp-arduino'],
              },
              {
                order: 3,
                title: 'Third short',
                description: 'Not enough.',
                safetyNote: null,
                componentRefs: ['comp-arduino'],
              },
            ],
            explanation: 'Bad plan.',
          }),
          model: 'test-gemini',
          inputTokens: 1,
          outputTokens: 1,
        };
      }
      return {
        text: JSON.stringify({
          kind: 'STEP_PLAN',
          steps: detailedProviderSteps('Repaired'),
          explanation: 'Repaired provider plan.',
        }),
        model: 'test-gemini',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    const generated = await generateSequentialStepListWithRepair({
      locale: 'en',
      ideaText: 'Arduino LDR night light with LED on breadboard',
      projectTitle: 'Night light',
      projectShortDescription: 'Beginner Arduino',
      projectDescription: 'LDR controlled LED',
      difficulty: 'BEGINNER',
      estimatedMinutes: 90,
      components: ldrComponents,
      clarification,
      recentAnswers: [],
    });

    assert.equal(calls, 2);
    assert.ok(generated.steps.length >= 8);
    setAuthoringRealStepInvokerForTests(null);
  });

  test('Arabic revision adds a testing step', async () => {
    const currentSteps = mockDoorAlarmStepPlan('en');
    const reply = await generateStepStageReply({
      locale: 'ar',
      ideaText: 'إنذار باب',
      projectTitle: 'إنذار باب',
      projectShortDescription: 'مشروع للمبتدئين',
      projectDescription: 'إنذار عند فتح الباب',
      difficulty: 'BEGINNER',
      estimatedMinutes: 90,
      components: doorComponents,
      clarification,
      recentAnswers: [],
      comment: 'أضف خطوة لاختبار الـBuzzer والـLED قبل تثبيت الحساس على الباب.',
      currentSteps,
      intent: 'REVISION',
    });

    assert.equal(reply.replyType, 'REVISED_STEP_PLAN');
    if (reply.replyType === 'REVISED_STEP_PLAN') {
      assert.ok(reply.steps.length >= currentSteps.length);
      const joined = reply.steps.map((step) => step.title).join(' ').toLowerCase();
      assert.ok(joined.includes('test') || joined.includes('اختبار') || joined.includes('buzzer'));
    }
  });

  test('alternative plan returns a materially different plan', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const currentSteps = mockDoorAlarmStepPlan('en');
    const generated = await generateAlternativeSequentialStepPlanWithRepair({
      locale: 'en',
      ideaText: 'Arduino door alarm with reed switch',
      projectTitle: 'Door alarm',
      projectShortDescription: 'Beginner project',
      projectDescription: null,
      difficulty: 'BEGINNER',
      estimatedMinutes: 90,
      components: doorComponents,
      clarification,
      recentAnswers: [],
      previousSteps: currentSteps,
    });

    assert.notEqual(
      generated.steps.map((step) => step.title).join('|'),
      currentSteps.map((step) => step.title).join('|'),
    );
    assert.ok(generated.steps.length >= 8);
  });

  test('LDR desk light mock plan uses canonical components', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const result = await generateSequentialStepList({
      locale: 'en',
      ideaText:
        'Automatic desk light using Arduino, LDR, and a white LED. No relay, LCD, buzzer, or high-voltage wiring.',
      projectTitle: 'Automatic desk light',
      projectShortDescription: 'LDR-controlled LED',
      projectDescription: 'Turn on a white LED when ambient light is low.',
      difficulty: 'BEGINNER',
      estimatedMinutes: 120,
      components: ldrComponents,
      clarification,
      recentAnswers: ['No relay', 'No pump'],
    });

    assert.ok(result.steps.length >= 8);
    const joined = result.steps.map((step) => `${step.title} ${step.description}`).join(' ').toLowerCase();
    assert.ok(joined.includes('ldr') || joined.includes('photoresistor') || joined.includes('led'));
    assert.ok(!joined.includes('soil moisture'));
    assert.ok(!joined.includes('pump'));
    assert.ok(result.steps.every((step) => (step.componentRefs?.length ?? 0) > 0));
  });

  test('Gemini JSON fence around STEP_PLAN is parsed safely', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests, parseStepPlanProviderJson } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const fenced = `\`\`\`json
${JSON.stringify({
  kind: 'STEP_PLAN',
  steps: detailedProviderSteps('Fenced'),
  explanation: 'Fenced plan.',
})}
\`\`\``;
    const parsed = parseStepPlanProviderJson(fenced) as { kind: string; steps: unknown[] };
    assert.equal(parsed.kind, 'STEP_PLAN');
    assert.ok(parsed.steps.length >= 8);

    setAuthoringRealStepInvokerForTests(async () => ({
      text: fenced,
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));
    const generated = await generateSequentialStepList({
      locale: 'en',
      ideaText: 'Arduino LDR night light with LED on breadboard',
      projectTitle: 'Night light',
      projectShortDescription: 'Beginner Arduino',
      projectDescription: 'LDR controlled LED',
      difficulty: 'BEGINNER',
      estimatedMinutes: 90,
      components: ldrComponents,
      clarification,
      recentAnswers: [],
    });
    assert.ok(generated.steps.length >= 8);
    setAuthoringRealStepInvokerForTests(null);
  });

  test('wrong root shape is rejected as AI_AUTHORING_STEP_SCHEMA_INVALID', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    setAuthoringRealStepInvokerForTests(async () => ({
      text: JSON.stringify({ kind: 'COMPONENT_LIST', components: [], explanation: 'Wrong root.' }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));
    await assert.rejects(
      () =>
        generateSequentialStepList({
          locale: 'en',
          ideaText: 'Arduino LDR night light',
          projectTitle: 'Night light',
          projectShortDescription: 'Beginner Arduino',
          projectDescription: 'LDR controlled LED',
          difficulty: 'BEGINNER',
          estimatedMinutes: 90,
          components: ldrComponents,
          clarification,
          recentAnswers: [],
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'AI_AUTHORING_STEP_SCHEMA_INVALID',
    );
    setAuthoringRealStepInvokerForTests(null);
  });

  test('missing steps array is rejected as AI_AUTHORING_STEP_SCHEMA_INVALID', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    setAuthoringRealStepInvokerForTests(async () => ({
      text: JSON.stringify({ kind: 'STEP_PLAN', explanation: 'No steps key.' }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));
    await assert.rejects(
      () =>
        generateSequentialStepList({
          locale: 'en',
          ideaText: 'Arduino LDR night light',
          projectTitle: 'Night light',
          projectShortDescription: 'Beginner Arduino',
          projectDescription: 'LDR controlled LED',
          difficulty: 'BEGINNER',
          estimatedMinutes: 90,
          components: ldrComponents,
          clarification,
          recentAnswers: [],
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'AI_AUTHORING_STEP_SCHEMA_INVALID',
    );
    setAuthoringRealStepInvokerForTests(null);
  });

  test('component catalog names map to canonical ids in step refs', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests, normalizeStepComponentRefs } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const mapped = normalizeStepComponentRefs(
      ['Arduino Uno', 'LDR photoresistor', 'comp-led'],
      ldrComponents,
    );
    assert.deepEqual(mapped, ['comp-arduino', 'comp-ldr', 'comp-led']);

    setAuthoringRealStepInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'STEP_PLAN',
        steps: detailedProviderSteps('Named refs').map((step) => ({
          ...step,
          componentRefs: ['Arduino Uno', 'LDR photoresistor'],
        })),
        explanation: 'Name refs plan.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));
    const generated = await generateSequentialStepList({
      locale: 'en',
      ideaText: 'Arduino LDR night light with LED on breadboard',
      projectTitle: 'Night light',
      projectShortDescription: 'Beginner Arduino',
      projectDescription: 'LDR controlled LED',
      difficulty: 'BEGINNER',
      estimatedMinutes: 90,
      components: ldrComponents,
      clarification,
      recentAnswers: [],
    });
    assert.ok(generated.steps.some((step) => step.componentRefs?.includes('comp-arduino')));
    setAuthoringRealStepInvokerForTests(null);
  });

  test('unknown component references are rejected', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    setAuthoringRealStepInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'STEP_PLAN',
        steps: detailedProviderSteps('Unknown').map((step) => ({
          ...step,
          description: `${step.description} Mount the ultrasonic sensor for distance.`,
          componentRefs: ['unknown-ultrasonic-id'],
        })),
        explanation: 'Unknown refs.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));
    await assert.rejects(
      () =>
        generateSequentialStepList({
          locale: 'en',
          ideaText: 'Arduino LDR night light with LED on breadboard',
          projectTitle: 'Night light',
          projectShortDescription: 'Beginner Arduino',
          projectDescription: 'LDR controlled LED',
          difficulty: 'BEGINNER',
          estimatedMinutes: 90,
          components: ldrComponents,
          clarification,
          recentAnswers: [],
        }),
      (error: unknown) =>
        error instanceof AppError &&
        (error.code === 'AI_STEP_COMPONENT_INCONSISTENT' ||
          error.code === 'AI_AUTHORING_STEP_QUALITY_INVALID' ||
          error.code === 'AI_AUTHORING_STEP_GENERATION_FAILED'),
    );
    setAuthoringRealStepInvokerForTests(null);
  });

  test('first invalid response issues and output are passed into repair', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const repairPrompts: string[] = [];
    let calls = 0;
    setAuthoringRealStepInvokerForTests(async ({ userPrompt }) => {
      calls += 1;
      if (calls === 1) {
        return {
          text: '{not-json',
          model: 'test-gemini',
          inputTokens: 1,
          outputTokens: 1,
        };
      }
      repairPrompts.push(userPrompt);
      return {
        text: JSON.stringify({
          kind: 'STEP_PLAN',
          steps: detailedProviderSteps('Repaired after JSON'),
          explanation: 'Repaired.',
        }),
        model: 'test-gemini',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    const generated = await generateSequentialStepListWithRepair({
      locale: 'en',
      ideaText: 'Arduino LDR night light with LED on breadboard',
      projectTitle: 'Night light',
      projectShortDescription: 'Beginner Arduino',
      projectDescription: 'LDR controlled LED',
      difficulty: 'BEGINNER',
      estimatedMinutes: 90,
      components: ldrComponents,
      clarification,
      recentAnswers: [],
    });
    assert.equal(calls, 2);
    assert.ok(generated.steps.length >= 8);
    assert.equal(repairPrompts.length, 1);
    const repairPayload = JSON.parse(repairPrompts[0]!) as {
      repairAttempt: boolean;
      previousInvalidOutput: string | null;
      repairIssue: string | null;
    };
    assert.equal(repairPayload.repairAttempt, true);
    assert.ok((repairPayload.previousInvalidOutput ?? '').includes('{not-json'));
    assert.ok((repairPayload.repairIssue ?? '').length > 0);
    setAuthoringRealStepInvokerForTests(null);
  });

  test('repair repeating invalid structure fails with specific JSON code', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    setAuthoringRealStepInvokerForTests(async () => ({
      text: '{still-broken',
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));
    await assert.rejects(
      () =>
        generateSequentialStepListWithRepair({
          locale: 'en',
          ideaText: 'Arduino LDR night light',
          projectTitle: 'Night light',
          projectShortDescription: 'Beginner Arduino',
          projectDescription: 'LDR controlled LED',
          difficulty: 'BEGINNER',
          estimatedMinutes: 90,
          components: ldrComponents,
          clarification,
          recentAnswers: [],
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'AI_AUTHORING_STEP_JSON_INVALID',
    );
    setAuthoringRealStepInvokerForTests(null);
  });

  test('Arabic detailed provider steps pass semantic quality validation', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    setAuthoringRealStepInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'STEP_PLAN',
        steps: [
          {
            order: 1,
            title: 'فحص المكوّنات',
            description:
              'افحص Arduino Uno وLDR وLED وBreadboard والأسلاك وتأكد أن كل قطعة سليمة قبل البدء بالتوصيل.',
            safetyNote: null,
            componentRefs: ['comp-arduino', 'comp-ldr', 'comp-led'],
          },
          {
            order: 2,
            title: 'تجهيز Breadboard للطاقة',
            description:
              'ضع Arduino Uno بجانب Breadboard ووصّل 5V وGND إلى خطوط الطاقة وتحقق أن التوصيل ثابت.',
            safetyNote: null,
            componentRefs: ['comp-arduino'],
          },
          {
            order: 3,
            title: 'بناء مقسم جهد LDR',
            description:
              'ضع LDR ومقاومة 10kΩ على Breadboard ووصّل نقطة الوسط إلى Analog A0 ثم تأكد من ثبات الأسلاك.',
            safetyNote: null,
            componentRefs: ['comp-ldr', 'comp-10k', 'comp-arduino'],
          },
          {
            order: 4,
            title: 'توصيل LED مع مقاومة 220Ω',
            description:
              'وصّل LED عبر مقاومة 220Ω إلى دبوس رقمي على Arduino ثم تحقق أن القطب الموجب في الاتجاه الصحيح.',
            safetyNote: null,
            componentRefs: ['comp-led', 'comp-arduino'],
          },
          {
            order: 5,
            title: 'تعريف الأرجل في الكود',
            description:
              'افتح Arduino IDE واكتب تعريفات LDR_PIN وLED_PIN ثم تأكد أن الأرقام تطابق التوصيل الفعلي.',
            safetyNote: null,
            componentRefs: ['comp-arduino'],
          },
          {
            order: 6,
            title: 'قراءة قيمة Analog',
            description:
              'اكتب كودًا يقرأ قيمة LDR عبر analogRead ويسجّل النتيجة، ثم تحقق أن القيم تتغير مع الضوء.',
            safetyNote: null,
            componentRefs: ['comp-arduino', 'comp-ldr'],
          },
          {
            order: 7,
            title: 'اختيار Threshold وتشغيل LED',
            description:
              'عرّف Threshold مناسبًا وشغّل LED عندما تكون القراءة أقل منه، ثم تأكد أن السلوك صحيح في الظلام.',
            safetyNote: null,
            componentRefs: ['comp-arduino', 'comp-led', 'comp-ldr'],
          },
          {
            order: 8,
            title: 'رفع الكود والمعايرة',
            description:
              'ارفع الكود عبر USB واختبر في ضوء قوي وضعيف وعاير Threshold حتى يعمل LED بشكل صحيح.',
            safetyNote: null,
            componentRefs: ['comp-arduino'],
          },
        ],
        explanation: 'خطة عربية مفصلة.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const generated = await generateSequentialStepList({
      locale: 'ar',
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
      projectTitle: 'مصباح ليلي',
      projectShortDescription: 'مشروع مبتدئ',
      projectDescription: 'مصباح ليلي بدون Relay',
      difficulty: 'BEGINNER',
      estimatedMinutes: 300,
      components: ldrComponents,
      clarification,
      recentAnswers: [],
    });
    assert.equal(generated.steps.length, 8);
    assert.match(
      generated.steps.map((step) => step.description).join('\n'),
      /[\u0600-\u06FF]/,
    );
    setAuthoringRealStepInvokerForTests(null);
  });

  const arabicLiveComponents = [
    {
      id: '405791b4-a970-434e-9beb-389f839d8bdc',
      componentName: 'Arduino Uno',
      materialType: 'Microcontroller',
      quantity: 1,
      unit: 'قطعة',
      componentRole: 'REQUIRED_MATERIAL' as const,
      isRequired: true,
      canBeSubstituted: false,
      searchKeywords: ['arduino'],
      notes: null,
    },
    {
      id: '8766ce3a-1ebf-40c7-97f5-167497115936',
      componentName: 'حساس ضوء LDR',
      materialType: 'Sensor',
      quantity: 1,
      unit: 'قطعة',
      componentRole: 'REQUIRED_MATERIAL' as const,
      isRequired: true,
      canBeSubstituted: false,
      searchKeywords: ['ldr'],
      notes: null,
    },
    {
      id: 'f24b897f-d224-4915-be6a-d1f1ea8c4fbd',
      componentName: 'مقاومة 10 كيلو أوم',
      materialType: 'Electronics',
      quantity: 1,
      unit: 'قطعة',
      componentRole: 'REQUIRED_MATERIAL' as const,
      isRequired: true,
      canBeSubstituted: false,
      searchKeywords: [],
      notes: null,
    },
    {
      id: '685919c0-b270-4a30-aaf7-3bce866fd00b',
      componentName: 'مواد هيكل خارجي (أكريليك أو خشب)',
      materialType: 'Material',
      quantity: 1,
      unit: 'مجموعة',
      componentRole: 'REQUIRED_MATERIAL' as const,
      isRequired: true,
      canBeSubstituted: false,
      searchKeywords: [],
      notes: null,
    },
    {
      id: 'e75589a7-d79c-4d3b-87e6-aef4921b5fb2',
      componentName: 'مسدس شمع أو لاصق قوي',
      materialType: 'Tool',
      quantity: 1,
      unit: 'قطعة',
      componentRole: 'TOOL' as const,
      isRequired: true,
      canBeSubstituted: false,
      searchKeywords: [],
      notes: null,
    },
  ];

  test('Arabic alias and ohm notation resolve to canonical ids', async () => {
    const { resolveStepComponentRefs } = await import('./ai-project-authoring-real.provider.js');
    const catalog = (await import('./ai-project-authoring-real.provider.js'))
      .buildComponentReferenceCatalog(arabicLiveComponents);
    assert.deepEqual(resolveStepComponentRefs(['حساس ضوء LDR'], catalog).refs, [
      '8766ce3a-1ebf-40c7-97f5-167497115936',
    ]);
    assert.deepEqual(resolveStepComponentRefs(['مقاومة 10k'], catalog).refs, [
      'f24b897f-d224-4915-be6a-d1f1ea8c4fbd',
    ]);
    assert.deepEqual(resolveStepComponentRefs(['10k ohm resistor'], catalog).refs, [
      'f24b897f-d224-4915-be6a-d1f1ea8c4fbd',
    ]);
    assert.deepEqual(resolveStepComponentRefs(['hot glue gun'], catalog).refs, [
      'e75589a7-d79c-4d3b-87e6-aef4921b5fb2',
    ]);
  });

  test('ambiguous shared alias is rejected', async () => {
    const { resolveStepComponentRefs, buildComponentReferenceCatalog } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const ambiguousComponents = [
      {
        id: 'comp-led-red',
        componentName: 'Red LED',
        materialType: 'Output',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL' as const,
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: ['led'],
        notes: null,
      },
      {
        id: 'comp-led-green',
        componentName: 'Green LED',
        materialType: 'Output',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL' as const,
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: ['led'],
        notes: null,
      },
    ];
    const catalog = buildComponentReferenceCatalog(ambiguousComponents);
    const result = resolveStepComponentRefs(['led'], catalog);
    assert.deepEqual(result.refs, []);
    assert.deepEqual(result.ambiguous, ['led']);
  });

  test('Arabic housing prose with wood passes consistency after ref normalization', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    setAuthoringRealStepInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'STEP_PLAN',
        steps: [
          {
            order: 1,
            title: 'تجهيز المكونات',
            description:
              'جهّز Arduino Uno وحساس LDR والمقاومات على سطح نظيف وتحقق من سلامة كل قطعة قبل البدء بالتوصيل على Breadboard.',
            componentRefs: ['Arduino Uno', 'حساس ضوء LDR', 'مقاومة 10 كيلو أوم'],
          },
          {
            order: 2,
            title: 'بناء الهيكل',
            description:
              'قص قطع الأكريليك أو الخشب لتشكيل غلاف المصباح المكتبي، ثم ثبّت مسدس الشمع لتجميع الأجزاء بثبات وتأكد من ثبات التركيب.',
            componentRefs: ['مواد هيكل خارجي (أكريليك أو خشب)', 'مسدس شمع أو لاصق قوي'],
          },
          {
            order: 3,
            title: 'توصيل LDR',
            description:
              'وصّل حساس LDR مع مقاومة 10k على Breadboard واربط نقطة القراءة بـ A0 ثم تحقق أن القراءة تتغير مع الضوء.',
            componentRefs: ['8766ce3a-1ebf-40c7-97f5-167497115936', 'مقاومة 10k'],
          },
          {
            order: 4,
            title: 'تعريف الأرجل',
            description:
              'افتح Arduino IDE وعرّف أرجل LDR وLED في الكود ثم تأكد أن الأرقام تطابق التوصيل الفعلي على اللوحة.',
            componentRefs: ['405791b4-a970-434e-9beb-389f839d8bdc'],
          },
          {
            order: 5,
            title: 'قراءة Serial',
            description:
              'اكتب كودًا يقرأ analogRead ويطبع القيم في Serial Monitor عند 9600 baud وتأكد أن القيم منطقية.',
            componentRefs: ['405791b4-a970-434e-9beb-389f839d8bdc'],
          },
          {
            order: 6,
            title: 'ضبط Threshold',
            description:
              'اختر Threshold مناسبًا وشغّل LED عند انخفاض الإضاءة ثم تحقق أن السلوك صحيح في الظلام والضوء.',
            componentRefs: [],
          },
          {
            order: 7,
            title: 'رفع الكود',
            description:
              'ارفع السكيتش عبر USB واختبر المشروع في إضاءة قوية وضعيفة وتأكد أن LED يستجيب كما هو متوقع.',
            componentRefs: ['405791b4-a970-434e-9beb-389f839d8bdc'],
          },
          {
            order: 8,
            title: 'مراجعة الهيكل',
            description:
              'راجع تثبيت الهيكل الخارجي والتوصيلات النهائية وتأكد أن كل شيء آمن قبل إنهاء المشروع.',
            componentRefs: ['685919c0-b270-4a30-aaf7-3bce866fd00b'],
          },
        ],
        explanation: 'خطة عربية.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const generated = await generateSequentialStepList({
      locale: 'ar',
      ideaText: 'مصباح ليلي ذكي باستخدام Arduino وLDR',
      projectTitle: 'مصباح ليلي ذكي',
      projectShortDescription: 'مشروع مبتدئ',
      projectDescription: 'مصباح ليلي مع هيكل خارجي',
      difficulty: 'BEGINNER',
      estimatedMinutes: 300,
      components: arabicLiveComponents,
      clarification,
      recentAnswers: [],
    });
    assert.ok(generated.steps.length >= 6);
    assert.ok(
      generated.steps.every(
        (step) =>
          !step.componentRefs ||
          step.componentRefs.every((ref) => arabicLiveComponents.some((component) => component.id === ref)),
      ),
    );
    setAuthoringRealStepInvokerForTests(null);
  });

  test('invented component refs trigger repair with unknown references listed', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const repairPrompts: string[] = [];
    let calls = 0;
    setAuthoringRealStepInvokerForTests(async ({ userPrompt }) => {
      calls += 1;
      if (calls === 1) {
        return {
          text: JSON.stringify({
            kind: 'STEP_PLAN',
            steps: detailedProviderSteps('Invented').map((step) => ({
              ...step,
              componentRefs: ['comp-arduino', 'ultrasonic-sensor-id'],
            })),
            explanation: 'Invalid refs.',
          }),
          model: 'test-gemini',
          inputTokens: 1,
          outputTokens: 1,
        };
      }
      repairPrompts.push(userPrompt);
      return {
        text: JSON.stringify({
          kind: 'STEP_PLAN',
          steps: detailedProviderSteps('Repaired refs'),
          explanation: 'Repaired.',
        }),
        model: 'test-gemini',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    const generated = await generateSequentialStepListWithRepair({
      locale: 'en',
      ideaText: 'Arduino LDR night light with LED on breadboard',
      projectTitle: 'Night light',
      projectShortDescription: 'Beginner Arduino',
      projectDescription: 'LDR controlled LED',
      difficulty: 'BEGINNER',
      estimatedMinutes: 90,
      components: ldrComponents,
      clarification,
      recentAnswers: [],
    });
    assert.equal(calls, 2);
    assert.ok(generated.steps.length >= 8);
    assert.equal(repairPrompts.length, 1);
    assert.match(repairPrompts[0] ?? '', /ultrasonic-sensor-id|Unknown componentRefs/i);
    setAuthoringRealStepInvokerForTests(null);
  });

  test('repeated unknown refs after repair return AI_STEP_COMPONENT_INCONSISTENT details', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    setAuthoringRealStepInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'STEP_PLAN',
        steps: detailedProviderSteps('Still unknown').map((step) => ({
          ...step,
          componentRefs: ['unknown-ultrasonic-id'],
        })),
        explanation: 'Still invalid.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));
    await assert.rejects(
      () =>
        generateSequentialStepListWithRepair({
          locale: 'en',
          ideaText: 'Arduino LDR night light with LED on breadboard',
          projectTitle: 'Night light',
          projectShortDescription: 'Beginner Arduino',
          projectDescription: 'LDR controlled LED',
          difficulty: 'BEGINNER',
          estimatedMinutes: 90,
          components: ldrComponents,
          clarification,
          recentAnswers: [],
        }),
      (error: unknown) => {
        if (!(error instanceof AppError) || error.code !== 'AI_STEP_COMPONENT_INCONSISTENT') {
          return false;
        }
        const details = error.details as { unknownComponents?: string[] };
        return Array.isArray(details.unknownComponents) &&
          details.unknownComponents.includes('unknown-ultrasonic-id');
      },
    );
    setAuthoringRealStepInvokerForTests(null);
  });

  test('Arduino LDR quality requirements keep eight as minimum but prefer semantic depth above eight', async () => {
    const { computeStepPlanQualityRequirements } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const requirements = computeStepPlanQualityRequirements({
      locale: 'ar',
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
      projectTitle: 'مصباح ليلي',
      projectShortDescription: 'مشروع مبتدئ',
      projectDescription: 'مصباح ليلي بدون Relay',
      difficulty: 'BEGINNER',
      estimatedMinutes: 300,
      components: ldrComponents,
      recentAnswers: [],
      requestedStepCount: null,
    });
    assert.equal(requirements.projectType, 'HARDWARE_ELECTRONICS');
    assert.equal(requirements.minimumMeaningfulSteps, 8);
    assert.ok(requirements.preferredRangeMin > 8);
    assert.ok(requirements.preferredRangeMax >= requirements.preferredRangeMin + 2);
    assert.ok(requirements.expectedPhaseCount > 8);
    assert.ok(requirements.requiredPhases.length >= 8);
  });

  test('cardboard craft project does not receive global minimum eight', async () => {
    const { computeStepPlanQualityRequirements } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const requirements = computeStepPlanQualityRequirements({
      locale: 'en',
      ideaText: 'Simple cardboard craft birdhouse for kids',
      projectTitle: 'Cardboard birdhouse',
      projectShortDescription: 'Easy craft project',
      projectDescription: 'Build a small birdhouse from cardboard and glue',
      difficulty: 'BEGINNER',
      estimatedMinutes: 45,
      components: [
        {
          id: 'comp-cardboard',
          componentName: 'Cardboard sheets',
          materialType: 'Material',
          quantity: 2,
          unit: 'piece',
          componentRole: 'REQUIRED_MATERIAL',
          isRequired: true,
          canBeSubstituted: false,
          searchKeywords: [],
          notes: null,
        },
      ],
      recentAnswers: [],
      requestedStepCount: null,
    });
    assert.equal(requirements.minimumMeaningfulSteps, 4);
    assert.equal(requirements.preferredRangeMax, 6);
    assert.notEqual(requirements.minimumMeaningfulSteps, 8);
  });

  test('initial prompt receives authoritative minimum before first provider call', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const {
      buildStepPlanProviderJsonSchema,
      computeStepPlanQualityRequirements,
      setAuthoringRealStepInvokerForTests,
    } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const capturedPrompts: string[] = [];
    setAuthoringRealStepInvokerForTests(async ({ userPrompt }) => {
      capturedPrompts.push(userPrompt);
      return {
        text: JSON.stringify({
          kind: 'STEP_PLAN',
          steps: detailedProviderSteps('Prompt check'),
          explanation: 'Valid step plan.',
        }),
        model: 'test-gemini',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    await generateSequentialStepList({
      locale: 'ar',
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
      projectTitle: 'مصباح ليلي',
      projectShortDescription: 'مشروع مبتدئ',
      projectDescription: 'مصباح ليلي بدون Relay',
      difficulty: 'BEGINNER',
      estimatedMinutes: 300,
      components: ldrComponents,
      clarification,
      recentAnswers: [],
    });

    assert.equal(capturedPrompts.length, 1);
    const payload = JSON.parse(capturedPrompts[0]!) as {
      stepPlanQualityRequirements?: {
        minimumMeaningfulSteps?: number;
        preferredRange?: { min?: number; max?: number };
        semanticDepthTarget?: number;
        guidance?: { onePrimaryObjectivePerStep?: boolean };
        hardCountContract?: {
          minimumMeaningfulSteps?: number;
          instruction?: string;
          noPadding?: string;
        };
      };
    };
    assert.equal(payload.stepPlanQualityRequirements?.minimumMeaningfulSteps, 8);
    assert.ok((payload.stepPlanQualityRequirements?.preferredRange?.min ?? 0) > 8);
    assert.ok((payload.stepPlanQualityRequirements?.semanticDepthTarget ?? 0) > 8);
    assert.equal(
      payload.stepPlanQualityRequirements?.guidance?.onePrimaryObjectivePerStep,
      true,
    );
    assert.equal(
      payload.stepPlanQualityRequirements?.hardCountContract?.minimumMeaningfulSteps,
      8,
    );
    assert.match(
      payload.stepPlanQualityRequirements?.hardCountContract?.instruction ?? '',
      /do not return fewer than 8/i,
    );
    assert.match(
      payload.stepPlanQualityRequirements?.hardCountContract?.noPadding ?? '',
      /duplicating|rewording/i,
    );
    const requirements = computeStepPlanQualityRequirements({
      locale: 'ar',
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
      projectTitle: 'مصباح ليلي',
      projectShortDescription: 'مشروع مبتدئ',
      projectDescription: 'مصباح ليلي بدون Relay',
      difficulty: 'BEGINNER',
      estimatedMinutes: 300,
      components: ldrComponents,
      recentAnswers: [],
      requestedStepCount: null,
    });
    const transportSchema = buildStepPlanProviderJsonSchema(requirements) as {
      properties?: { steps?: { minItems?: number; maxItems?: number } };
    };
    assert.equal(transportSchema.properties?.steps?.minItems, 8);
    assert.equal(transportSchema.properties?.steps?.maxItems, requirements.safeMaximum);
    assert.doesNotMatch(capturedPrompts[0]!, /target exactly 8/i);
    setAuthoringRealStepInvokerForTests(null);
  });

  test('seven-step hardware response triggers repair requesting minimum eight', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const repairPrompts: string[] = [];
    let calls = 0;
    setAuthoringRealStepInvokerForTests(async ({ userPrompt }) => {
      calls += 1;
      if (calls === 1) {
        return {
          text: JSON.stringify({
            kind: 'STEP_PLAN',
            steps: detailedProviderSteps('Seven only').slice(0, 7),
            explanation: 'Too few steps.',
          }),
          model: 'test-gemini',
          inputTokens: 1,
          outputTokens: 1,
        };
      }
      repairPrompts.push(userPrompt);
      return {
        text: JSON.stringify({
          kind: 'STEP_PLAN',
          steps: detailedProviderSteps('Repaired eight'),
          explanation: 'Repaired.',
        }),
        model: 'test-gemini',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    const generated = await generateSequentialStepListWithRepair({
      locale: 'ar',
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
      projectTitle: 'مصباح ليلي',
      projectShortDescription: 'مشروع مبتدئ',
      projectDescription: 'مصباح ليلي بدون Relay',
      difficulty: 'BEGINNER',
      estimatedMinutes: 300,
      components: ldrComponents,
      clarification,
      recentAnswers: [],
    });

    assert.equal(calls, 2);
    assert.ok(generated.steps.length >= 8);
    assert.equal(repairPrompts.length, 1);
    const repairPayload = JSON.parse(repairPrompts[0]!) as {
      repairIssue?: string | null;
      previousInvalidOutput?: string | null;
      repairInstructions?: { preserveValidContent?: string } | null;
    };
    assert.match(repairPayload.repairIssue ?? '', /at least 8 meaningful steps/i);
    assert.doesNotMatch(repairPayload.repairIssue ?? '', /at least 6 meaningful steps/i);
    assert.match(repairPayload.repairIssue ?? '', /previous response contained 7/i);
    assert.match(repairPayload.repairIssue ?? '', /preserve every valid/i);
    assert.match(repairPayload.previousInvalidOutput ?? '', /Seven only step 1/i);
    assert.match(
      repairPayload.repairInstructions?.preserveValidContent ?? '',
      /preserve valid, distinct steps/i,
    );
    setAuthoringRealStepInvokerForTests(null);
  });

  test('repair that still returns seven is bounded and preserves the exact count error', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    let calls = 0;
    setAuthoringRealStepInvokerForTests(async () => {
      calls += 1;
      if (calls === 1) {
        return {
          text: JSON.stringify({
            kind: 'STEP_PLAN',
            steps: detailedProviderSteps('Initial seven').slice(0, 7),
            explanation: 'Too few.',
          }),
          model: 'test-gemini',
          inputTokens: 1,
          outputTokens: 1,
        };
      }
      return {
        text: JSON.stringify({
          kind: 'STEP_PLAN',
          steps: detailedProviderSteps('Still seven').slice(0, 7),
          explanation: 'Still too few.',
        }),
        model: 'test-gemini',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    await assert.rejects(
      () =>
        generateSequentialStepListWithRepair({
          locale: 'ar',
          ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
          projectTitle: 'مصباح ليلي',
          projectShortDescription: 'مشروع مبتدئ',
          projectDescription: 'مصباح ليلي بدون Relay',
          difficulty: 'BEGINNER',
          estimatedMinutes: 300,
          components: ldrComponents,
          clarification,
          recentAnswers: [],
        }),
      (error: unknown) => {
        if (!(error instanceof AppError) || error.code !== 'AI_AUTHORING_STEP_QUALITY_INVALID') {
          return false;
        }
        const details = error.details as {
          requiredMinimum?: number;
          receivedSteps?: number;
        };
        return details.requiredMinimum === 8 && details.receivedSteps === 7;
      },
    );
    assert.equal(calls, 2);
    setAuthoringRealStepInvokerForTests(null);
  });

  test('eight artificial duplicate steps fail semantic validation', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    let calls = 0;
    setAuthoringRealStepInvokerForTests(async () => {
      calls += 1;
      return {
        text: JSON.stringify({
        kind: 'STEP_PLAN',
        steps: Array.from({ length: 8 }, (_, index) => ({
          order: index + 1,
          title: `Duplicate step ${index + 1}`,
          description:
            'وصّل LDR ومقاومة 10kΩ على Breadboard واربط نقطة القراءة بـ Analog pin A0 ثم تحقق أن القراءة تتغير مع الضوء.',
          safetyNote: null,
          componentRefs: ['comp-arduino'],
        })),
        explanation: 'Duplicate plan.',
        }),
        model: 'test-gemini',
        inputTokens: 1,
        outputTokens: 1,
      };
    });

    await assert.rejects(
      () =>
        generateSequentialStepListWithRepair({
          locale: 'ar',
          ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
          projectTitle: 'مصباح ليلي',
          projectShortDescription: 'مشروع مبتدئ',
          projectDescription: 'مصباح ليلي بدون Relay',
          difficulty: 'BEGINNER',
          estimatedMinutes: 300,
          components: ldrComponents,
          clarification,
          recentAnswers: [],
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'AI_AUTHORING_STEP_QUALITY_INVALID',
    );
    assert.equal(calls, 2);
    setAuthoringRealStepInvokerForTests(null);
  });

  test('hardware LDR requirements compute expected phase count above minimum eight', async () => {
    const { computeStepPlanQualityRequirements } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const requirements = computeStepPlanQualityRequirements({
      locale: 'ar',
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
      projectTitle: 'مصباح ليلي',
      projectShortDescription: 'مشروع مبتدئ',
      projectDescription: 'مصباح ليلي بدون Relay',
      difficulty: 'BEGINNER',
      estimatedMinutes: 300,
      components: ldrComponents,
      recentAnswers: [],
      requestedStepCount: null,
    });
    assert.equal(requirements.minimumMeaningfulSteps, 8);
    assert.ok(requirements.expectedPhaseCount > 8);
    assert.ok(requirements.preferredRangeMax >= requirements.expectedPhaseCount);
    assert.equal(requirements.safeMaximum, 20);
    assert.ok(requirements.preferredRangeMax < requirements.safeMaximum);
  });

  test('meaningful twelve-step LDR plan passes without truncation', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const twelveSteps = [
      ...detailedProviderSteps('Expanded LDR plan'),
      {
        order: 9,
        title: 'تحقق من التوصيلات',
        description:
          'Expanded LDR plan: راجع كل توصيلة على Breadboard وتأكد أن GND و5V موصولان بشكل صحيح قبل تشغيل Arduino.',
        safetyNote: null,
        componentRefs: ['comp-arduino'],
      },
      {
        order: 10,
        title: 'راقب Serial Monitor',
        description:
          'Expanded LDR plan: افتح Serial Monitor وتحقق أن قراءة LDR من A0 تتغير عند تغطية الحساس ثم إزالة اليد.',
        safetyNote: null,
        componentRefs: ['comp-arduino'],
      },
      {
        order: 11,
        title: 'اضبط Threshold',
        description:
          'Expanded LDR plan: جرّب قيم Threshold مختلفة حتى يعمل LED في الظلام فقط وتسجّل القيمة الأنسب للمبتدئ.',
        safetyNote: null,
        componentRefs: ['comp-arduino'],
      },
      {
        order: 12,
        title: 'معايرة نهائية',
        description:
          'Expanded LDR plan: اختبر المصباح في إضاءة خافتة وساطعة ودوّن أي تعديل بسيط مطلوب على Threshold أو التوصيلات.',
        safetyNote: null,
        componentRefs: ['comp-arduino'],
      },
    ];
    setAuthoringRealStepInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'STEP_PLAN',
        steps: twelveSteps,
        explanation: 'Expanded beginner-friendly plan.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const generated = await generateSequentialStepList({
      locale: 'ar',
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
      projectTitle: 'مصباح ليلي',
      projectShortDescription: 'مشروع مبتدئ',
      projectDescription: 'مصباح ليلي بدون Relay',
      difficulty: 'BEGINNER',
      estimatedMinutes: 300,
      components: ldrComponents,
      clarification,
      recentAnswers: [],
    });
    assert.equal(generated.steps.length, 12);
    setAuthoringRealStepInvokerForTests(null);
  });

  test('eight-step overloaded hardware plan is flagged for repair guidance only', async () => {
    const { detectOverloadedSteps, evaluateStepPlanQuality, computeStepPlanQualityRequirements } =
      await import('./ai-project-authoring-real.provider.js');
    const requirements = computeStepPlanQualityRequirements({
      locale: 'ar',
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
      projectTitle: 'مصباح ليلي',
      projectShortDescription: 'مشروع مبتدئ',
      projectDescription: 'مصباح ليلي بدون Relay',
      difficulty: 'BEGINNER',
      estimatedMinutes: 300,
      components: ldrComponents,
      recentAnswers: [],
      requestedStepCount: null,
    });
    const overloadedSteps = Array.from({ length: 8 }, (_, index) => ({
      title: `خطوة ${index + 1}`,
      description: `المرحلة ${index + 1}: وصّل LDR وLED على Breadboard، اكتب كود Arduino كامل، ارفع البرنامج عبر USB، اضبط Threshold، ثم اختبر ومعاير النتيجة في الضوء والظلام.`,
      componentRefs: ['comp-arduino'],
    }));
    const overloadedIssues = detectOverloadedSteps(overloadedSteps);
    assert.ok(overloadedIssues.length > 0);
    const evaluation = evaluateStepPlanQuality(overloadedSteps, requirements, ldrComponents);
    assert.equal(evaluation.ok, false);
    if (!evaluation.ok) {
      assert.ok(!evaluation.issues.some((issue) => issue.includes('OVERLOADED_STEPS')));
    }
  });

  test('related Arabic wiring step is not flagged as overloaded', async () => {
    const { detectOverloadedSteps } = await import('./ai-project-authoring-real.provider.js');
    const issues = detectOverloadedSteps([
      {
        title: 'وصل LDR',
        description:
          'وصّل LDR ومقاومة 10kΩ كمقسم جهد واربط المخرج بـ A0 ثم تحقق من تغير القراءة عند تغطية الحساس.',
        componentRefs: ['comp-ldr'],
      },
    ]);
    assert.equal(issues.length, 0);
  });

  test('detailed ten-step LDR plan passes when below expectedPhaseCount', async () => {
    const {
      assertStepPlanQuality,
      computeStepPlanQualityRequirements,
      evaluateStepPlanQuality,
    } = await import('./ai-project-authoring-real.provider.js');
    const requirements = computeStepPlanQualityRequirements({
      locale: 'ar',
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
      projectTitle: 'مصباح ليلي',
      projectShortDescription: 'مشروع مبتدئ',
      projectDescription: 'مصباح ليلي بدون Relay',
      difficulty: 'BEGINNER',
      estimatedMinutes: 300,
      components: ldrComponents,
      recentAnswers: [],
      requestedStepCount: null,
    });
    assert.ok(requirements.expectedPhaseCount > 10);
    const tenSteps = [
      ...detailedProviderSteps('Ten step LDR'),
      {
        order: 9,
        title: 'Ten step LDR step 9',
        description:
          'Ten step LDR: اختبر LED في الظلام والضوء ودوّن أي تعديل بسيط مطلوب على Threshold أو التوصيلات.',
        safetyNote: null,
        componentRefs: ['comp-arduino'],
      },
      {
        order: 10,
        title: 'Ten step LDR step 10',
        description:
          'Ten step LDR: راجع التوصيلات النهائية وتحقق أن Serial Monitor يعرض قراءات LDR بشكل مستقر قبل إنهاء المشروع.',
        safetyNote: null,
        componentRefs: ['comp-arduino'],
      },
    ];
    const evaluation = evaluateStepPlanQuality(tenSteps, requirements, ldrComponents);
    assert.equal(evaluation.ok, true);
    assert.doesNotThrow(() => assertStepPlanQuality(tenSteps, requirements, ldrComponents));
  });

  test('buildStepQualityRepairIssue treats expectedPhaseCount as guidance only', async () => {
    const { buildStepQualityRepairIssue, computeStepPlanQualityRequirements } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const requirements = computeStepPlanQualityRequirements({
      locale: 'ar',
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino Uno وLDR وLED',
      projectTitle: 'مصباح ليلي',
      projectShortDescription: 'مشروع مبتدئ',
      projectDescription: 'مصباح ليلي بدون Relay',
      difficulty: 'BEGINNER',
      estimatedMinutes: 300,
      components: ldrComponents,
      recentAnswers: [],
      requestedStepCount: null,
    });
    const issue = buildStepQualityRepairIssue({
      requirements,
      receivedSteps: 10,
      issues: ['INSUFFICIENT_STEP_COUNT'],
      missingPhases: [],
    });
    assert.match(issue, /guidance only and not a hard minimum/);
    assert.match(issue, /Preferred range is .*; it is guidance only/);
    assert.doesNotMatch(issue, /requires at least ${requirements.expectedPhaseCount}/);
  });
});
