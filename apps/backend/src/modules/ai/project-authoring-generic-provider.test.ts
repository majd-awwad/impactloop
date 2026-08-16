import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

process.env.NODE_TEST_CONTEXT ??= '1';

import { AppError } from '../../utils/app-error.js';

const clarification = {
  type: 'project_authoring_clarification' as const,
  status: 'READY_FOR_PROPOSAL' as const,
  summary: 'Ready',
  knownFacts: [],
  nextQuestion: null,
  remainingTopics: 0,
  assumptions: [],
  warnings: [],
  ideaText: 'Project idea',
  questions: [],
  answers: [],
  policyVersion: 'v1',
};

const reactionGameContext = {
  locale: 'en' as const,
  projectId: 'project-a',
  ideaText:
    'Beginner Arduino reaction game with push button, three LEDs, and buzzer. No screen, no relay.',
  projectTitle: 'Arduino reaction game',
  projectShortDescription: 'Fast reflex game',
  projectDescription: 'Press the button when LEDs light up. No screen or relay.',
  difficulty: 'BEGINNER',
  durationMinutes: 90,
  clarification,
  recentAnswers: ['No screen', 'No relay'],
};

const cardboardContext = {
  locale: 'en' as const,
  projectId: 'project-b',
  ideaText: 'Recycled cardboard phone stand with glue, ruler, and cutting tool. No Arduino or electronics.',
  projectTitle: 'Cardboard phone stand',
  projectShortDescription: 'Simple craft stand',
  projectDescription: 'Fold and glue cardboard into a phone stand.',
  difficulty: 'BEGINNER',
  durationMinutes: 60,
  clarification,
  recentAnswers: [],
};

const fabricContext = {
  locale: 'en' as const,
  projectId: 'project-c',
  ideaText: 'Fabric tote bag from textile scraps with thread and needle. Beginner sewing project.',
  projectTitle: 'Fabric tote bag',
  projectShortDescription: 'Sew a tote from scraps',
  projectDescription: 'Cut and sew fabric scraps into a tote bag.',
  difficulty: 'BEGINNER',
  durationMinutes: 120,
  clarification,
  recentAnswers: [],
};

const productionAiDir = join(process.cwd(), 'src/modules/ai');

const listProductionSourceFiles = () =>
  readdirSync(productionAiDir, { recursive: true })
    .filter((entry) => typeof entry === 'string' && entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
    .map((entry) => join(productionAiDir, String(entry)));

describe('generic authoring provider orchestration', () => {
  const previousProvider = process.env.AI_CHAT_PROVIDER;

  after(() => {
    process.env.AI_CHAT_PROVIDER = previousProvider ?? 'mock';
  });

  test('production sources do not export project-specific component/step builders', () => {
    const forbidden = [
      'buildDoorAlarmComponentList',
      'buildSoilMoistureComponentList',
      'buildAlternativeSoilMoistureComponentList',
      'buildDoorAlarmStepPlan',
      'buildSoilMoistureStepPlan',
      'buildLdrDeskLightStepPlan',
      'isDoorAlarmProject',
      'isSoilMoistureProject',
      'isLdrDeskLightProject',
    ];

    for (const file of listProductionSourceFiles()) {
      const source = readFileSync(file, 'utf8');
      for (const symbol of forbidden) {
        assert.equal(
          source.includes(`export const ${symbol}`),
          false,
          `${file} must not export ${symbol}`,
        );
      }
    }
  });

  test('real-provider component generation uses structured provider output', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealComponentInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialComponentList } = await import(
      './ai-project-authoring-sequential-components.provider.js'
    );

    let capturedPrompt = '';
    setAuthoringRealComponentInvokerForTests(async ({ userPrompt }) => {
      capturedPrompt = userPrompt;
      return {
        text: JSON.stringify({
          kind: 'COMPONENT_LIST',
          components: [
            {
              name: 'Push button',
              quantity: 1,
              unit: 'piece',
              role: 'MATERIAL',
              required: true,
              notes: 'Player input',
            },
            {
              name: 'Buzzer',
              quantity: 1,
              unit: 'piece',
              role: 'MATERIAL',
              required: true,
              notes: 'Audio feedback',
            },
            {
              name: 'Arduino Uno',
              quantity: 1,
              unit: 'piece',
              role: 'MATERIAL',
              required: true,
              notes: 'Microcontroller',
            },
            {
              name: 'Breadboard',
              quantity: 1,
              unit: 'piece',
              role: 'MATERIAL',
              required: true,
              notes: 'Wiring surface',
            },
            {
              name: 'Jumper wires',
              quantity: 1,
              unit: 'set',
              role: 'MATERIAL',
              required: true,
              notes: 'Connections',
            },
            {
              name: 'LED',
              quantity: 3,
              unit: 'piece',
              role: 'MATERIAL',
              required: true,
              notes: 'Visual feedback',
            },
          ],
          explanation: 'Reaction game parts from provider.',
        }),
        model: 'test-gemini',
        inputTokens: 10,
        outputTokens: 20,
      };
    });

    const generated = await generateSequentialComponentList(reactionGameContext);
    assert.ok(capturedPrompt.includes('project-a'));
    assert.ok(capturedPrompt.includes('Arduino reaction game'));
    assert.ok(!capturedPrompt.includes('project-b'));
    assert.match(
      generated.components.map((component) => component.componentName).join(' '),
      /push button|buzzer/i,
    );
    setAuthoringRealComponentInvokerForTests(null);
  });

  test('real-provider step generation uses structured provider output', async () => {
    process.env.AI_CHAT_PROVIDER = 'openai';
    const { setAuthoringRealStepInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialStepList } = await import(
      './ai-project-authoring-sequential-steps.provider.js'
    );

    const components = [
      {
        id: 'comp-button',
        componentName: 'Push button',
        materialType: 'Input',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL' as const,
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['button'],
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
        canBeSubstituted: true,
        searchKeywords: ['buzzer'],
        notes: null,
      },
      {
        id: 'comp-led',
        componentName: 'Green LED',
        materialType: 'Output',
        quantity: 3,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL' as const,
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['led'],
        notes: null,
      },
    ];

    setAuthoringRealStepInvokerForTests(async ({ userPrompt }) => ({
      text: JSON.stringify({
        kind: 'STEP_PLAN',
        steps: [
          {
            order: 1,
            title: 'Prepare and inspect components',
            description:
              'Lay out the push button and buzzer on a clean surface and inspect each part before placing anything on the breadboard.',
            safetyNote: 'Disconnect power before rewiring.',
            componentRefs: ['comp-button', 'comp-buzzer'],
          },
          {
            order: 2,
            title: 'Mount button on breadboard',
            description:
              'Place the push button on the breadboard and connect one side to the Arduino input pin with a pull-down resistor.',
            safetyNote: null,
            componentRefs: ['comp-button'],
          },
          {
            order: 3,
            title: 'Wire buzzer output',
            description:
              'Connect the buzzer to the output pin with correct polarity and verify a short test tone from a simple sketch.',
            safetyNote: null,
            componentRefs: ['comp-buzzer'],
          },
          {
            order: 4,
            title: 'Define code pin constants',
            description:
              'In the sketch, define INPUT_PIN and BUZZER_PIN constants that match the wiring before writing game logic.',
            safetyNote: null,
            componentRefs: ['comp-button', 'comp-buzzer'],
          },
          {
            order: 5,
            title: 'Read button state in loop',
          description:
            'Connect the push button to the Arduino input pin on the breadboard and verify the pin reads correctly when pressed.',
            safetyNote: null,
            componentRefs: ['comp-button'],
          },
          {
            order: 6,
            title: 'Threshold and buzzer control',
          description:
            'Compare reaction time against a threshold and trigger the buzzer output when the player reacts quickly enough, then verify the tone.',
            safetyNote: null,
            componentRefs: ['comp-buzzer'],
          },
          {
            order: 7,
            title: 'LED ready signal',
          description:
            'Connect the green LEDs to output pins and verify the ready-state blink pattern appears before each round.',
            safetyNote: null,
            componentRefs: ['comp-led'],
          },
          {
            order: 8,
            title: 'Final play test',
          description:
            'Run the full reaction game and verify the buzzer and LEDs respond correctly during normal play on the breadboard.',
            safetyNote: null,
            componentRefs: ['comp-button', 'comp-buzzer'],
          },
        ],
        explanation: 'Provider step plan.',
      }),
      model: 'test-openai',
      inputTokens: 12,
      outputTokens: 24,
    }));

    const generated = await generateSequentialStepList({
      ...reactionGameContext,
      components,
      difficulty: 'BEGINNER',
      estimatedMinutes: 90,
    });
    assert.ok(generated.steps.length >= 8);
    assert.match(generated.steps[0]?.title ?? '', /Prepare and inspect|Reaction step/i);
    setAuthoringRealStepInvokerForTests(null);
  });

  test('disabled provider fabricates no component proposal', async () => {
    process.env.AI_CHAT_PROVIDER = 'disabled';
    const { generateSequentialComponentList } = await import(
      './ai-project-authoring-sequential-components.provider.js'
    );

    await assert.rejects(
      () => generateSequentialComponentList(reactionGameContext),
      (error: unknown) => error instanceof AppError && error.code === 'AI_DISABLED',
    );
  });

  test('provider failure fabricates no component template fallback', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealComponentInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialComponentList } = await import(
      './ai-project-authoring-sequential-components.provider.js'
    );

    setAuthoringRealComponentInvokerForTests(async () => {
      throw new Error('provider unavailable');
    });

    await assert.rejects(
      () => generateSequentialComponentList(reactionGameContext),
      (error: unknown) => error instanceof AppError,
    );
    setAuthoringRealComponentInvokerForTests(null);
  });

  test('three unseen mock projects remain isolated', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { generateSequentialComponentList } = await import(
      './ai-project-authoring-sequential-components.provider.js'
    );

    const projectA = await generateSequentialComponentList(reactionGameContext);
    const projectB = await generateSequentialComponentList(cardboardContext);
    const projectC = await generateSequentialComponentList(fabricContext);

    const namesA = projectA.components.map((component) => component.componentName.toLowerCase()).join(' ');
    const namesB = projectB.components.map((component) => component.componentName.toLowerCase()).join(' ');
    const namesC = projectC.components.map((component) => component.componentName.toLowerCase()).join(' ');

    assert.match(namesA, /button|buzzer|led|arduino/);
    assert.doesNotMatch(namesA, /soil moisture|reed switch|pump|ldr/);

    assert.match(namesB, /cardboard|glue|ruler|cutting/);
    assert.doesNotMatch(namesB, /arduino|sensor|led|buzzer|breadboard|jumper/);

    assert.match(namesC, /fabric|thread|needle/);
    assert.doesNotMatch(namesC, /arduino|cardboard|sensor|breadboard/);
    assert.notEqual(namesA, namesB);
    assert.notEqual(namesB, namesC);
  });

  test('generic exclusion validation removes relay from provider output', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealComponentInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialComponentList } = await import(
      './ai-project-authoring-sequential-components.provider.js'
    );

    setAuthoringRealComponentInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'COMPONENT_LIST',
        components: [
          {
            name: 'Relay module',
            quantity: 1,
            unit: 'piece',
            role: 'MATERIAL',
            required: false,
            notes: 'Should be filtered',
          },
          {
            name: 'Push button',
            quantity: 1,
            unit: 'piece',
            role: 'MATERIAL',
            required: true,
            notes: 'Primary player input for reaction timing.',
          },
          {
            name: 'Arduino Uno',
            quantity: 1,
            unit: 'piece',
            role: 'MATERIAL',
            required: true,
            notes: 'Microcontroller',
          },
          {
            name: 'Breadboard',
            quantity: 1,
            unit: 'piece',
            role: 'MATERIAL',
            required: true,
            notes: 'Wiring surface',
          },
          {
            name: 'Jumper wires',
            quantity: 1,
            unit: 'set',
            role: 'MATERIAL',
            required: true,
            notes: 'Connections',
          },
          {
            name: 'LED',
            quantity: 1,
            unit: 'piece',
            role: 'MATERIAL',
            required: true,
            notes: 'Indicator',
          },
        ],
        explanation: 'Filtered list.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const generated = await generateSequentialComponentList({
      ...reactionGameContext,
      recentAnswers: ['No relay'],
      projectDescription: 'No relay allowed',
    });
    const names = generated.components.map((component) => component.componentName.toLowerCase()).join(' ');
    assert.doesNotMatch(names, /relay/);
    assert.match(names, /button/);
    setAuthoringRealComponentInvokerForTests(null);
  });

  test('suggest another components calls provider path', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const { setAuthoringRealComponentInvokerForTests, getAuthoringRealComponentInvokerCallCountForTests } =
      await import('./ai-project-authoring-real.provider.js');
    const {
      generateAlternativeSequentialComponentListWithRepair,
      generateSequentialComponentList,
    } = await import('./ai-project-authoring-sequential-components.provider.js');

    const initial = await generateSequentialComponentList({
      ...reactionGameContext,
      projectId: 'project-a',
    });
    process.env.AI_CHAT_PROVIDER = 'gemini';

    setAuthoringRealComponentInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'COMPONENT_LIST',
        components: [
          {
            name: 'Mini breadboard',
            quantity: 1,
            unit: 'piece',
            role: 'TOOL',
            required: true,
            notes: 'Alternative compact breadboard for rewiring.',
          },
          {
            name: 'Tactile push button',
            quantity: 1,
            unit: 'piece',
            role: 'MATERIAL',
            required: true,
            notes: 'Alternative tactile button for player input.',
          },
          {
            name: 'Piezo buzzer',
            quantity: 1,
            unit: 'piece',
            role: 'MATERIAL',
            required: true,
            notes: 'Alternative piezo buzzer for audio feedback.',
          },
          {
            name: 'Arduino Uno',
            quantity: 1,
            unit: 'piece',
            role: 'MATERIAL',
            required: true,
            notes: 'Main microcontroller for game logic.',
          },
          {
            name: 'Jumper wire set',
            quantity: 1,
            unit: 'set',
            role: 'MATERIAL',
            required: true,
            notes: 'Jumper wire set for breadboard connections.',
          },
          {
            name: 'Green LED',
            quantity: 3,
            unit: 'piece',
            role: 'MATERIAL',
            required: true,
            notes: 'LED indicators for reaction feedback.',
          },
        ],
        explanation: 'Alternative provider list.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const alternative = await generateAlternativeSequentialComponentListWithRepair({
      ...reactionGameContext,
      previousComponents: initial.components,
    });
    assert.ok(getAuthoringRealComponentInvokerCallCountForTests() >= 1);
    assert.notEqual(
      JSON.stringify(alternative.components.map((component) => component.componentName)),
      JSON.stringify(initial.components.map((component) => component.componentName)),
    );
    setAuthoringRealComponentInvokerForTests(null);
  });

  test('suggest another steps calls provider path', async () => {
    process.env.AI_CHAT_PROVIDER = 'openai';
    const { setAuthoringRealStepInvokerForTests, getAuthoringRealStepInvokerCallCountForTests } =
      await import('./ai-project-authoring-real.provider.js');
    const { generateAlternativeSequentialStepPlanWithRepair } = await import(
      './ai-project-authoring-sequential-steps.provider.js'
    );

    const components = [
      {
        id: 'comp-a',
        componentName: 'Push button',
        materialType: 'Input',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL' as const,
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['button'],
        notes: 'Player input button for reaction timing.',
      },
      {
        id: 'comp-b',
        componentName: 'Buzzer',
        materialType: 'Output',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL' as const,
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['buzzer'],
        notes: 'Audio feedback buzzer for successful reactions.',
      },
    ];
    const previousSteps = Array.from({ length: 8 }, (_, index) => ({
      title: `Previous step ${index + 1}`,
      description:
        `Previous step ${index + 1} explains what to do, where to do it, why it matters, and how to verify success.`,
    }));

    setAuthoringRealStepInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'STEP_PLAN',
        steps: [
          {
            order: 1,
            title: 'Prepare and inspect push button',
            description:
              'Prepare the push button on the breadboard, inspect the pins, and verify the part is not damaged before wiring.',
            safetyNote: null,
            componentRefs: ['comp-a'],
          },
          {
            order: 2,
            title: 'Wire button to Arduino input',
            description:
              'Connect the push button to the Arduino digital input pin and verify the pin state changes when pressed.',
            safetyNote: null,
            componentRefs: ['comp-a'],
          },
          {
            order: 3,
            title: 'Define pin constants',
            description:
              'Write INPUT_PIN constants in the sketch and verify they match the breadboard wiring before coding game logic.',
            safetyNote: null,
            componentRefs: ['comp-a'],
          },
          {
            order: 4,
            title: 'Read button in loop',
            description:
              'Read the button state inside loop() and verify the pressed value updates correctly during each reaction window.',
            safetyNote: null,
            componentRefs: ['comp-a'],
          },
          {
            order: 5,
            title: 'Add reaction threshold logic',
            description:
              'Compare reaction timing against a threshold and verify the buzzer trigger condition behaves as expected.',
            safetyNote: null,
            componentRefs: ['comp-a'],
          },
          {
            order: 6,
            title: 'Test buzzer output',
            description:
              'Connect and test the buzzer output pin on comp-b, then verify the tone plays when the reaction threshold is met.',
            safetyNote: null,
            componentRefs: ['comp-b'],
          },
          {
            order: 7,
            title: 'Blink ready LEDs',
            description:
              'Connect LEDs to output pins and verify the ready-state blink pattern appears before each round.',
            safetyNote: null,
            componentRefs: ['comp-a'],
          },
          {
            order: 8,
            title: 'Final game verification',
            description:
              'Run the full reaction game flow and verify button, buzzer, and LED behavior during normal play.',
            safetyNote: null,
            componentRefs: ['comp-a'],
          },
        ],
        explanation: 'Alternative provider steps.',
      }),
      model: 'test-openai',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const generated = await generateAlternativeSequentialStepPlanWithRepair({
      locale: 'en',
      projectId: 'project-a',
      ideaText: reactionGameContext.ideaText,
      projectTitle: reactionGameContext.projectTitle,
      projectShortDescription: reactionGameContext.projectShortDescription,
      projectDescription: reactionGameContext.projectDescription,
      difficulty: 'BEGINNER',
      estimatedMinutes: 90,
      components,
      clarification,
      recentAnswers: [],
      previousSteps,
    });

    assert.ok(getAuthoringRealStepInvokerCallCountForTests() >= 1);
    assert.notEqual(
      generated.steps.map((step) => step.title).join('|'),
      previousSteps.map((step) => step.title).join('|'),
    );
    setAuthoringRealStepInvokerForTests(null);
  });

  test('door-alarm project works from provider result without production builder', async () => {
    process.env.AI_CHAT_PROVIDER = 'gemini';
    const { setAuthoringRealComponentInvokerForTests } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const { generateSequentialComponentList } = await import(
      './ai-project-authoring-sequential-components.provider.js'
    );

    setAuthoringRealComponentInvokerForTests(async () => ({
      text: JSON.stringify({
        kind: 'COMPONENT_LIST',
        components: [
          { name: 'Arduino Uno', quantity: 1, unit: 'piece', role: 'TOOL', required: true, notes: 'Main microcontroller board for alarm logic.' },
          { name: 'Magnetic reed switch', quantity: 1, unit: 'piece', role: 'MATERIAL', required: true, notes: 'Door contact sensor for open-close detection.' },
          { name: 'Buzzer', quantity: 1, unit: 'piece', role: 'MATERIAL', required: true, notes: 'Audible alarm output when door opens.' },
          { name: 'Red LED', quantity: 1, unit: 'piece', role: 'MATERIAL', required: true, notes: 'Visual alarm indicator for door status.' },
          { name: 'Breadboard', quantity: 1, unit: 'piece', role: 'MATERIAL', required: true, notes: 'Breadboard for prototyping the alarm circuit.' },
          { name: 'Jumper wires', quantity: 1, unit: 'set', role: 'MATERIAL', required: true, notes: 'Jumper wires for breadboard connections.' },
        ],
        explanation: 'Door alarm provider list.',
      }),
      model: 'test-gemini',
      inputTokens: 1,
      outputTokens: 1,
    }));

    const generated = await generateSequentialComponentList({
      locale: 'en',
      projectId: 'door-alarm',
      ideaText: 'Arduino door alarm with magnetic reed switch, buzzer, and red LED',
      projectTitle: 'Arduino door alarm',
      projectShortDescription: 'Alarm when the door opens',
      projectDescription: 'No LCD, no relay, no motion sensor',
      clarification,
      recentAnswers: [],
    });
    const names = generated.components.map((component) => component.componentName.toLowerCase()).join(' ');
    assert.match(names, /reed|buzzer|led|arduino/);
    assert.doesNotMatch(names, /soil moisture/);
    setAuthoringRealComponentInvokerForTests(null);
  });
});
