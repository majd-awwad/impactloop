import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBuildGuideModelContext,
  formatBuildGuideTrustedSystemContext,
  type BuildGuideContextSource,
} from './ai-build-guide-model-context.js';
import { composeGeneralLearningSystemInstruction } from './providers/chat-prompt-builders.js';
import { MockAiChatProvider } from './providers/mock-chat.provider.js';
import { GENERAL_LEARNING_SYSTEM_POLICY } from './ai.policy.js';

const plantStand = (currentNumber: 3 | 4): BuildGuideContextSource => ({
  project: { title: 'PVC Plant Stand' },
  status: 'IN_PROGRESS',
  materialReadiness: { ready: 4, total: 4 },
  stepProgress: {
    completed: currentNumber - 1,
    total: 4,
    percent: currentNumber === 3 ? 50 : 75,
    currentStep: {
      stepNumber: currentNumber,
      title:
        currentNumber === 3 ? 'Assemble and connect' : 'Test and improve',
    },
    steps: [
      {
        stepNumber: 1,
        title: 'Plan and inspect materials',
        description: 'Review the component list.',
        state: 'COMPLETED',
      },
      {
        stepNumber: 2,
        title: 'Prepare the main parts',
        description: 'Cut and organize the parts.',
        state: 'COMPLETED',
      },
      {
        stepNumber: 3,
        title: 'Assemble and connect',
        description: 'Join the frame and connect the parts.',
        state: currentNumber === 3 ? 'CURRENT' : 'COMPLETED',
      },
      {
        stepNumber: 4,
        title: 'Test and improve',
        description: 'Check stability and improve weak joints.',
        state: currentNumber === 4 ? 'CURRENT' : 'LOCKED',
      },
    ],
  },
  items: [
    { component: { componentName: 'PVC Pipe' } },
    { component: { componentName: 'Elbow connectors' } },
    { component: { componentName: 'PVC Pipe' } },
  ],
});

test('build-guide model context uses live current step and omits internal IDs', () => {
  const context = buildBuildGuideModelContext(plantStand(3));
  const prompt = formatBuildGuideTrustedSystemContext(context);

  assert.equal(context.projectTitle, 'PVC Plant Stand');
  assert.equal(context.currentStepNumber, 3);
  assert.equal(context.totalSteps, 4);
  assert.equal(context.currentStepTitle, 'Assemble and connect');
  assert.equal(context.currentStepInstructions, 'Join the frame and connect the parts.');
  assert.equal(context.materialsReady, 4);
  assert.equal(context.materialsTotal, 4);
  assert.deepEqual(context.materialNames, ['PVC Pipe', 'Elbow connectors']);
  assert.match(prompt, /PVC Plant Stand/);
  assert.match(prompt, /Step 3 of 4/);
  assert.match(prompt, /Assemble and connect/);
  assert.match(prompt, /Join the frame and connect the parts/);
  assert.match(prompt, /4 of 4 ready/);
  assert.doesNotMatch(prompt, /stepId|buildId|projectId|reservation/i);
});

test('step 4 context does not retain step 3 as current', () => {
  const step3 = formatBuildGuideTrustedSystemContext(
    buildBuildGuideModelContext(plantStand(3)),
  );
  const step4 = formatBuildGuideTrustedSystemContext(
    buildBuildGuideModelContext(plantStand(4)),
  );

  assert.match(step3, /Current step: 3\. Assemble and connect/);
  assert.match(step4, /Current step: 4\. Test and improve/);
  assert.doesNotMatch(step4, /Current step: 3\. Assemble and connect/);
  assert.match(step4, /Check stability and improve weak joints/);
});

test('different projects produce scoped context', () => {
  const other: BuildGuideContextSource = {
    ...plantStand(3),
    project: { title: 'LED Night Light' },
    stepProgress: {
      ...plantStand(3).stepProgress,
      currentStep: { stepNumber: 1, title: 'Wire the LED' },
      steps: [
        {
          stepNumber: 1,
          title: 'Wire the LED',
          description: 'Connect the LED to the resistor.',
          state: 'CURRENT',
        },
      ],
      completed: 0,
      total: 1,
      percent: 0,
    },
  };

  const plant = formatBuildGuideTrustedSystemContext(
    buildBuildGuideModelContext(plantStand(3)),
  );
  const led = formatBuildGuideTrustedSystemContext(
    buildBuildGuideModelContext(other),
  );

  assert.match(plant, /PVC Plant Stand/);
  assert.match(led, /LED Night Light/);
  assert.doesNotMatch(led, /PVC Plant Stand/);
  assert.doesNotMatch(led, /Assemble and connect/);
});

test('general learning system instruction includes trusted build-guide context', () => {
  const trusted = formatBuildGuideTrustedSystemContext(
    buildBuildGuideModelContext(plantStand(3)),
  );
  const instruction = composeGeneralLearningSystemInstruction({
    locale: 'ar',
    userMessage: 'مش فاهم',
    history: [],
    scopeClassification: 'DOMAIN_KNOWLEDGE',
    trustedSystemContext: trusted,
  });

  assert.match(instruction, new RegExp(GENERAL_LEARNING_SYSTEM_POLICY.slice(0, 40)));
  assert.match(instruction, /PVC Plant Stand/);
  assert.match(instruction, /Step 3 of 4/);
  assert.match(instruction, /Assemble and connect/);
});

test('trusted context forbids invented project-specific materials and step mapping', () => {
  const source: BuildGuideContextSource = {
    project: { title: 'PVC Plant Stand' },
    status: 'IN_PROGRESS',
    materialReadiness: { ready: 4, total: 4 },
    stepProgress: {
      completed: 2,
      total: 4,
      percent: 50,
      currentStep: { stepNumber: 3, title: 'Assemble and connect' },
      steps: plantStand(3).stepProgress.steps,
    },
    items: [
      { component: { componentName: 'PVC pipes' } },
      { component: { componentName: 'PVC conduit' } },
      { component: { componentName: 'Bolts and washers' } },
      { component: { componentName: 'Plastic tray' } },
    ],
  };

  const prompt = formatBuildGuideTrustedSystemContext(
    buildBuildGuideModelContext(source),
    { explanationLocale: 'ar' },
  );

  assert.match(prompt, /PVC pipes/);
  assert.match(prompt, /PVC conduit/);
  assert.match(prompt, /Bolts and washers/);
  assert.match(prompt, /Plastic tray/);
  assert.doesNotMatch(prompt, /Elbow connectors|PVC elbows/i);
  assert.match(prompt, /no authoritative mapping from the current step/i);
  assert.match(
    prompt,
    /do not invent project-specific components, dimensions, wiring, materials/i,
  );
  assert.match(prompt, /project-wide, not step-specific/);
  assert.match(prompt, /Explain in Arabic/);
});

test('mock provider uses only known project materials from trusted context', async () => {
  const source: BuildGuideContextSource = {
    project: { title: 'PVC Plant Stand' },
    status: 'IN_PROGRESS',
    materialReadiness: { ready: 3, total: 3 },
    stepProgress: {
      completed: 2,
      total: 4,
      percent: 50,
      currentStep: { stepNumber: 3, title: 'Assemble and connect' },
      steps: plantStand(3).stepProgress.steps,
    },
    items: [
      { component: { componentName: 'PVC pipes' } },
      { component: { componentName: 'PVC conduit' } },
      { component: { componentName: 'Bolts and washers' } },
    ],
  };

  const trusted = formatBuildGuideTrustedSystemContext(
    buildBuildGuideModelContext(source),
  );
  const provider = new MockAiChatProvider();
  const result = await provider.generateGeneralLearningAnswer({
    locale: 'ar',
    userMessage: 'شو القطع اللي بدي استخدمها بهالخطوة؟',
    history: [],
    scopeClassification: 'DOMAIN_KNOWLEDGE',
    trustedSystemContext: trusted,
  });
  const text = result.data.blocks
    .map((block) => ('text' in block ? block.text : ''))
    .join('\n');

  assert.match(text, /PVC pipes/);
  assert.match(text, /PVC conduit/);
  assert.match(text, /Bolts and washers/);
  assert.doesNotMatch(text, /Plastic tray|Elbow|PVC elbows/i);
  assert.match(text, /do not invent project-specific components/i);
  assert.match(text, /no authoritative mapping from the current step/i);
});

test('step 4 after step 3 still uses live current step for next-action follow-up', () => {
  const step4 = formatBuildGuideTrustedSystemContext(
    buildBuildGuideModelContext(plantStand(4)),
  );
  assert.match(step4, /Current step: 4\. Test and improve/);
  assert.doesNotMatch(step4, /Current step: 3\. Assemble and connect/);
});
