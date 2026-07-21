import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.NODE_TEST_CONTEXT ??= '1';
process.env.AI_CHAT_PROVIDER = 'mock';

import type { SequentialComponent } from './ai-project-authoring-sequential.policy.js';
import {
  assertComponentListQuality,
  classifyComponentStageIntent,
  generateAlternativeSequentialComponentList,
  generateComponentStageReply,
  generateSequentialComponentList,
  processComponentStageComposerMessage,
  resolveComponentComposerIntent,
} from './ai-project-authoring-sequential-components.provider.js';

const clarification = {
  type: 'project_authoring_clarification' as const,
  status: 'READY_FOR_PROPOSAL' as const,
  summary: 'Beginner Arduino soil moisture alert',
  knownFacts: [],
  nextQuestion: null,
  remainingTopics: 0,
  assumptions: [],
  warnings: [],
};

const mockSoilMoistureComponentList = (locale: 'en' | 'ar'): SequentialComponent[] => [
  {
    componentName: locale === 'ar' ? 'لوحة Arduino Uno' : 'Arduino Uno',
    materialType: 'Microcontroller',
    quantity: 1,
    unit: 'piece',
    componentRole: 'TOOL',
    isRequired: true,
    canBeSubstituted: true,
    searchKeywords: ['Arduino'],
    notes: null,
  },
  {
    componentName: locale === 'ar' ? 'مستشعر رطوبة التربة' : 'Soil moisture sensor',
    materialType: 'Sensor',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL',
    isRequired: true,
    canBeSubstituted: true,
    searchKeywords: ['soil'],
    notes: null,
  },
  {
    componentName: locale === 'ar' ? 'LED' : 'LED',
    materialType: 'Electronic component',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL',
    isRequired: true,
    canBeSubstituted: true,
    searchKeywords: ['LED'],
    notes: null,
  },
  {
    componentName: locale === 'ar' ? 'مقاومة 220 أوم' : '220 ohm resistor',
    materialType: 'Electronic component',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL',
    isRequired: true,
    canBeSubstituted: true,
    searchKeywords: ['resistor'],
    notes: null,
  },
  {
    componentName: locale === 'ar' ? 'أسلاك توصيل' : 'Jumper wires',
    materialType: 'Accessory',
    quantity: 10,
    unit: 'piece',
    componentRole: 'CONSUMABLE',
    isRequired: true,
    canBeSubstituted: true,
    searchKeywords: ['jumper'],
    notes: null,
  },
];

describe('sequential components provider', () => {
  test('builds soil moisture component list without pump or relay', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const result = await generateSequentialComponentList({
      locale: 'en',
      ideaText:
        'Beginner Arduino USB soil moisture alert for one plant with LED warning, no pump',
      projectTitle: 'Soil moisture alert',
      projectShortDescription: 'Beginner Arduino project',
      projectDescription: 'LED alert when soil is dry',
      clarification,
      recentAnswers: [],
    });

    assert.ok(result.components.length >= 4);
    const names = result.components.map((component) =>
      component.componentName.toLowerCase(),
    );
    assert.ok(names.some((name) => name.includes('arduino')));
    assert.ok(names.some((name) => name.includes('soil')));
    assert.ok(names.some((name) => name.includes('led')));
    assert.ok(!names.some((name) => name.includes('ultrasonic')));
    assert.ok(!names.some((name) => name.includes('pump')));
    assert.ok(!names.some((name) => name.includes('relay')));
  });

  test('LDR project rejects an unrelated Ultrasonic sensor component', () => {
    const ldrContext = {
      locale: 'ar' as const,
      ideaText:
        'مصباح ليلي ذكي باستخدام Arduino وحساس LDR وLED يعمل على USB 5V.',
      projectTitle: 'مصباح ليلي ذكي',
      projectShortDescription: 'مشروع Arduino للمبتدئين باستخدام LDR',
      projectDescription: 'مصباح ليلي باستخدام LDR وLED',
      clarification,
      recentAnswers: [],
    };
    const ldrComponent = (
      name: string,
      role: SequentialComponent['componentRole'],
      notes: string,
    ): SequentialComponent => ({
      componentName: name,
      materialType: 'Electronics',
      quantity: 1,
      unit: 'piece',
      componentRole: role,
      isRequired: true,
      canBeSubstituted: true,
      searchKeywords: [name.toLowerCase()],
      notes,
    });
    const listWithUltrasonic: SequentialComponent[] = [
      ldrComponent('لوحة Arduino Uno', 'TOOL', 'لوحة التحكم.'),
      ldrComponent('حساس LDR', 'REQUIRED_MATERIAL', 'يقيس الإضاءة.'),
      ldrComponent('LED', 'REQUIRED_MATERIAL', 'مخرج ضوئي.'),
      ldrComponent('مقاومة 220Ω', 'REQUIRED_MATERIAL', 'تحدّ التيار.'),
      {
        componentName: 'Ultrasonic sensor (HC-SR04)',
        materialType: 'Sensor',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['ultrasonic'],
        notes: 'يقيس المسافة.',
      },
    ];
    assert.throws(
      () => assertComponentListQuality(ldrContext, listWithUltrasonic),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        (error as { code?: string }).code === 'AI_COMPONENT_PROPOSAL_INVALID' &&
        /ultrasonic/i.test((error as Error).message),
    );
  });

  test('valid LDR component list passes quality with no unrelated sensor', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const result = await generateSequentialComponentList({
      locale: 'ar',
      ideaText:
        'مصباح ليلي ذكي باستخدام Arduino وحساس LDR وLED يعمل على USB 5V بدون Relay أو LCD.',
      projectTitle: 'مصباح ليلي ذكي',
      projectShortDescription: 'مشروع Arduino للمبتدئين باستخدام LDR',
      projectDescription: 'مصباح ليلي باستخدام LDR وLED',
      clarification: { ...clarification, summary: 'Beginner Arduino LDR night-light' },
      recentAnswers: [],
    });
    const names = result.components.map((component) => component.componentName.toLowerCase());
    assert.ok(!names.some((name) => name.includes('ultrasonic')));
    assert.ok(!names.some((name) => /pir|motion|حركة/.test(name)));
    assert.ok(names.some((name) => /ldr|photoresistor|حساس/.test(name)));
  });

  test('Arabic give-me-components intent is show list', () => {
    assert.equal(
      classifyComponentStageIntent('اعطيني مكونات المشروع'),
      'SHOW_OR_GENERATE_FULL_LIST',
    );
    assert.equal(
      classifyComponentStageIntent('ما بدي اغير، بدي تعطيني مكونات المشروع'),
      'SHOW_OR_GENERATE_FULL_LIST',
    );
  });

  test('remove pump comment is revision intent', () => {
    assert.equal(classifyComponentStageIntent('احذف المضخة'), 'REVISION');
  });

  test('show list message returns component list reply', async () => {
    const components = mockSoilMoistureComponentList('en');
    const reply = await generateComponentStageReply({
      locale: 'en',
      ideaText: 'Soil moisture alert',
      projectTitle: 'Soil moisture alert',
      projectShortDescription: 'Beginner project',
      projectDescription: null,
      clarification,
      recentAnswers: [],
      comment: 'Give me the project components',
      currentComponents: components,
      intent: 'SHOW_OR_GENERATE_FULL_LIST',
    });

    assert.equal(reply.replyType, 'COMPONENT_LIST');
    if (reply.replyType === 'COMPONENT_LIST') {
      assert.ok(reply.components.length > 0);
      assert.ok(!/which part/i.test(reply.assistantText));
    }
  });

  test('Arabic revision adds breadboard and updates jumper wire quantity', async () => {
    const components = mockSoilMoistureComponentList('en');
    const reply = await generateComponentStageReply({
      locale: 'ar',
      ideaText: 'Soil moisture alert',
      projectTitle: 'Soil moisture alert',
      projectShortDescription: 'Beginner project',
      projectDescription: null,
      clarification,
      recentAnswers: [],
      comment: 'ضيف Breadboard وخلي Jumper wires عددهم 15.',
      currentComponents: components,
      intent: 'OTHER',
    });

    assert.equal(reply.replyType, 'REVISED_COMPONENT_LIST');
    if (reply.replyType === 'REVISED_COMPONENT_LIST') {
      const names = reply.components.map((component) =>
        component.componentName.toLowerCase(),
      );
      assert.ok(names.some((name) => name.includes('breadboard')));
      const wires = reply.components.find((component) =>
        /jumper|wire|اسلاك|أسلاك/i.test(component.componentName),
      );
      assert.equal(wires?.quantity, 15);
    }
  });

  test('builds Arduino LDR night-light list with circuit-complete parts', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const result = await generateSequentialComponentList({
      locale: 'ar',
      ideaText:
        'بدي أعمل مصباح ليلي ذكي بسيط باستخدام Arduino Uno وحساس LDR وضوء LED. المشروع مناسب للمبتدئين ويعمل على 5V من USB. ما بدي Relay أو شاشة LCD.',
      projectTitle: 'مصباح ليلي ذكي',
      projectShortDescription: 'مشروع Arduino للمبتدئين',
      projectDescription: 'مصباح ليلي باستخدام LDR',
      clarification: {
        ...clarification,
        summary: 'Beginner Arduino LDR night-light',
      },
      recentAnswers: [],
    });

    assert.ok(result.components.length >= 6);
    assert.notEqual(result.components.length, 3);
    const names = result.components.map((component) =>
      component.componentName.toLowerCase(),
    );
    assert.ok(names.some((name) => name.includes('arduino')));
    assert.ok(names.some((name) => /ldr|photoresistor|حساس/.test(name)));
    assert.ok(names.some((name) => name.includes('led')));
    assert.ok(names.some((name) => /10k|10 k/.test(name)));
    assert.ok(names.some((name) => /220/.test(name)));
    assert.ok(names.some((name) => name.includes('breadboard') || name.includes('تجارب')));
    assert.ok(names.some((name) => name.includes('usb') || name.includes('كابل')));
    assert.ok(!names.some((name) => name.includes('relay')));
  });

  test('component explanation intent keeps list unchanged', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const components = (
      await generateSequentialComponentList({
        locale: 'ar',
        ideaText: 'Arduino LDR LED night light on USB 5V',
        projectTitle: 'Night light',
        projectShortDescription: 'Beginner Arduino',
        projectDescription: null,
        clarification,
        recentAnswers: [],
      })
    ).components;
    const intent = resolveComponentComposerIntent({
      comment: 'ليش بحتاج مقاومة 10kΩ؟',
      history: [],
      currentComponents: components,
    });
    assert.equal(intent, 'EXPLAIN_COMPONENT');
    const explanation = await processComponentStageComposerMessage({
      comment: 'ليش بحتاج مقاومة 10kΩ؟',
      context: {
        locale: 'ar',
        ideaText: 'Arduino LDR LED night light on USB 5V',
        projectTitle: 'Night light',
        projectShortDescription: 'Beginner Arduino',
        projectDescription: null,
        clarification,
        recentAnswers: [],
      },
      currentComponents: components,
      history: [],
      project: {
        id: 'project-1',
        title: 'Night light',
        shortDescription: 'Beginner Arduino',
        description: null,
        difficulty: 'BEGINNER',
        estimatedDurationMinutes: 60,
        updatedAt: new Date(),
      } as never,
    });
    assert.equal(explanation.kind, 'EXPLANATION');
    if (explanation.kind === 'EXPLANATION') {
      assert.ok(explanation.assistantText.trim().length > 0);
    }
  });

  test('component revision updates unsaved list', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const components = mockSoilMoistureComponentList('en');
    const revision = await processComponentStageComposerMessage({
      comment: 'ضيف Breadboard وخلي Jumper wires عددهم 15.',
      context: {
        locale: 'en',
        ideaText: 'Arduino soil moisture alert',
        projectTitle: 'Soil moisture alert',
        projectShortDescription: 'Beginner Arduino',
        projectDescription: null,
        clarification,
        recentAnswers: [],
      },
      currentComponents: components,
      history: [],
      project: {
        id: 'project-1',
        title: 'Soil moisture alert',
        shortDescription: 'Beginner Arduino',
        description: null,
        difficulty: 'BEGINNER',
        estimatedDurationMinutes: 60,
        updatedAt: new Date(),
      } as never,
    });
    assert.equal(revision.kind, 'REVISED_LIST');
    if (revision.kind === 'REVISED_LIST') {
      const wires = revision.components.find((component) =>
        /jumper|wire/i.test(component.componentName),
      );
      assert.equal(wires?.quantity, 15);
      assert.ok(
        revision.components.some((component) => /breadboard/i.test(component.componentName)),
      );
    }
  });

  test('alternative list differs from the current list', async () => {
    process.env.AI_CHAT_PROVIDER = 'mock';
    const current = mockSoilMoistureComponentList('en');
    const alternative = await generateAlternativeSequentialComponentList({
      locale: 'en',
      ideaText: 'Beginner Arduino soil moisture alert without pump',
      projectTitle: 'Soil moisture alert',
      projectShortDescription: 'Beginner project',
      projectDescription: null,
      clarification,
      recentAnswers: [],
      previousComponents: current,
    });

    assert.notEqual(
      JSON.stringify(alternative.components.map((component) => component.componentName)),
      JSON.stringify(current.map((component) => component.componentName)),
    );
  });
});
