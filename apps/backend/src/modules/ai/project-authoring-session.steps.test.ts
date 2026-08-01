import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  detectAuthoringConceptConflicts,
  parseRequestedComponentCount,
  parseRequestedStepCount,
  resolveAuthoringContentLocale,
  resolveStepsComposerIntent,
  validateAuthoringStepPlanForSession,
  validateRequestedComponentCount,
  validateRequestedStepCount,
  type ProjectRecord,
} from './project-authoring-session.helpers.js';
import {
  mergeConfirmedRequirementsIntoComponentState,
  readConfirmedRequirements,
} from './project-authoring-session.state.js';

const arabicArduinoProject = {
  id: 'project-arduino-night-light',
  title: 'مصباح ليلي ذكي بـ Arduino',
  shortDescription: 'مشروع مبتدئ يشغّل LED عند الظلام',
  description:
    'مصباح ليلي باستخدام Arduino وLDR وLED على Breadboard بدون Relay أو LCD.',
  difficulty: 'BEGINNER',
  estimatedDurationMinutes: 90,
  updatedAt: new Date('2026-07-20T12:00:00.000Z'),
  status: 'DRAFT',
  requiredComponents: [
    {
      id: 'comp-arduino',
      componentName: 'Arduino Uno',
      materialType: 'Electronics',
      quantity: 1,
      unit: 'piece',
      componentRole: 'REQUIRED_MATERIAL',
      isRequired: true,
      canBeSubstituted: false,
      searchKeywords: ['arduino'],
      notes: null,
    },
    {
      id: 'comp-ldr',
      componentName: 'LDR',
      materialType: 'Sensor',
      quantity: 1,
      unit: 'piece',
      componentRole: 'REQUIRED_MATERIAL',
      isRequired: true,
      canBeSubstituted: false,
      searchKeywords: ['ldr'],
      notes: null,
    },
  ],
  steps: [],
} as unknown as ProjectRecord;

describe('project authoring STEPS policy', () => {
  test('resolveAuthoringContentLocale follows Arabic learner idea', () => {
    assert.equal(
      resolveAuthoringContentLocale({
        ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino',
        uiLocale: 'en',
      }),
      'ar',
    );
  });

  test('financial software plan is rejected for Arduino hardware project', () => {
    const result = validateAuthoringStepPlanForSession({
      project: arabicArduinoProject,
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino وLDR وLED',
      contentLocale: 'ar',
      steps: [
        {
          title: 'Develop Transaction Logging and Management Interface',
          description: 'Build UI components for income and expenses and save transactions to a database.',
        },
        {
          title: 'Implement Financial Data Visualization',
          description: 'Create charts for expense management.',
        },
      ],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'AI_STEP_PLAN_IRRELEVANT');
    }
  });

  test('Arabic Arduino plan passes language validation', () => {
    const result = validateAuthoringStepPlanForSession({
      project: arabicArduinoProject,
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino وLDR وLED',
      contentLocale: 'ar',
      steps: [
        {
          title: 'تجهيز Arduino والمكوّنات',
          description:
            'جهّز Arduino Uno وLDR وLED وBreadboard والأسلاك وتحقق من سلامة كل قطعة قبل البدء بالتوصيل.',
        },
        {
          title: 'فهم Voltage Divider للـ LDR',
          description:
            'اقرأ كيف يعمل مقسم الجهد بمقاومة 10kΩ مع LDR ولماذا نحتاجه لقراءة الإضاءة على Analog pin.',
        },
        {
          title: 'توصيل LDR والمقاومة على Breadboard',
          description:
            'ضع LDR ومقاومة 10kΩ على Breadboard ووصّل نقطة القراءة الوسطى نحو Analog pin A0 على Arduino.',
        },
        {
          title: 'توصيل LED مع مقاومة 220Ω',
          description:
            'وصّل LED مع مقاومة 220Ω على Digital pin محدد وتأكد من اتجاه القطبين قبل تثبيت التوصيل.',
        },
        {
          title: 'كتابة كود القراءة والتحكم',
          description:
            'اكتب كودًا يقرأ قيمة LDR من A0 ويضبط Threshold لتشغيل LED عندما يصبح الظلام كافيًا.',
        },
        {
          title: 'فتح Arduino IDE وتعريف الأرجل',
          description:
            'افتح Arduino IDE وعرّف LDR_PIN وLED_PIN بأسماء واضحة ثم تأكد أن الأرقام تطابق التوصيل الفعلي على اللوحة.',
        },
        {
          title: 'قراءة Serial Monitor',
          description:
            'اكتب كودًا يقرأ analogRead من A0 ويطبع القيم في Serial Monitor عند 9600 baud وتأكد أن القيم منطقية.',
        },
        {
          title: 'المعايرة والاختبار في الضوء والظلام',
          description:
            'ارفع الكود عبر USB وجرّب المشروع في إضاءة قوية وضعيفة وعدّل Threshold حتى يعمل LED بشكل صحيح.',
        },
      ],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.sequential.length >= 8);
    }
  });

  test('English-only plan fails for Arabic Arduino project', () => {
    const result = validateAuthoringStepPlanForSession({
      project: arabicArduinoProject,
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino وLDR وLED',
      contentLocale: 'ar',
      steps: [
        {
          title: 'Prepare the Arduino board',
          description: 'Gather the Arduino Uno and components.',
        },
        {
          title: 'Wire the LDR divider',
          description: 'Connect the LDR voltage divider to an analog pin.',
        },
        {
          title: 'Connect the LED output',
          description: 'Wire the LED with a 220 ohm resistor.',
        },
      ],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'AI_STEP_PLAN_LANGUAGE_MISMATCH');
    }
  });

  test('hardware Arduino plan with only three steps is rejected', () => {
    const result = validateAuthoringStepPlanForSession({
      project: arabicArduinoProject,
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino وLDR وLED',
      contentLocale: 'ar',
      steps: [
        {
          title: 'تجهيز Arduino والمكوّنات',
          description:
            'جهّز Arduino Uno وLDR وLED وBreadboard والأسلاك وتحقق من سلامة كل قطعة قبل البدء بالتوصيل.',
        },
        {
          title: 'توصيل LDR والمقاومة على Breadboard',
          description:
            'ضع LDR ومقاومة 10kΩ على Breadboard ووصّل نقطة القراءة الوسطى نحو Analog pin A0 على Arduino.',
        },
        {
          title: 'المعايرة والاختبار في الضوء والظلام',
          description:
            'ارفع الكود عبر USB وجرّب المشروع في إضاءة قوية وضعيفة وعدّل Threshold حتى يعمل LED بشكل صحيح.',
        },
      ],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'AI_AUTHORING_STEP_QUALITY_INVALID');
      assert.equal(result.requiredMinimum, 8);
      assert.equal(result.receivedSteps, 3);
    }
  });

  test('short follow-up uses recent assistant context', () => {
    assert.equal(
      resolveStepsComposerIntent({
        comment: 'اه',
        history: [{ role: 'assistant', text: 'شرح سابق عن LDR' }],
        stage: 'STEPS_OVERVIEW',
      }),
      'CONTINUE_PREVIOUS_RESPONSE',
    );
    assert.equal(
      resolveStepsComposerIntent({
        comment: 'كمل',
        history: [{ role: 'assistant', text: 'تابع الشرح' }],
        stage: 'STEP_REVIEW',
      }),
      'CONTINUE_PREVIOUS_RESPONSE',
    );
  });

  test('add-more-steps request maps to ADD_STEPS intent', () => {
    assert.equal(
      resolveStepsComposerIntent({
        comment: 'زيد عدد الخطوات وأضف مرحلة للمعايرة',
        history: [],
        stage: 'STEPS_OVERVIEW',
      }),
      'ADD_STEPS',
    );
  });

  test('explanation request maps to explain intent', () => {
    assert.equal(
      resolveStepsComposerIntent({
        comment: 'اشرحلي أول خطوة بالتفصيل',
        history: [],
        stage: 'STEPS_OVERVIEW',
      }),
      'EXPLAIN_SPECIFIC_STEP',
    );
    assert.equal(
      resolveStepsComposerIntent({
        comment: 'ليش لازم أستخدم مقاومة 10kΩ؟',
        history: [{ role: 'assistant', text: 'شرح سابق' }],
        stage: 'STEPS_OVERVIEW',
      }),
      'EXPLAIN_CURRENT_PLAN',
    );
  });

  test('explicit step count is parsed and persisted separately from material quantity', () => {
    assert.equal(parseRequestedStepCount('خليهم 6 خطوات'), 6);
    assert.equal(parseRequestedStepCount('make it 8 steps'), 8);
    assert.equal(parseRequestedStepCount('بدي 4 قطع من LED'), null);
    assert.equal(parseRequestedComponentCount('بدي 4 مواد فقط'), 4);
    assert.equal(parseRequestedComponentCount('4 components only'), 4);
    assert.equal(parseRequestedComponentCount('quantity 3 pieces'), null);

    const merged = mergeConfirmedRequirementsIntoComponentState(null, {
      requestedStepCount: 6,
      requestedComponentCount: 4,
    });
    const requirements = readConfirmedRequirements({ componentWorkingState: merged });
    assert.equal(requirements.requestedStepCount, 6);
    assert.equal(requirements.requestedComponentCount, 4);
  });

  test('requested counts are validated against product limits', () => {
    assert.equal(validateRequestedStepCount(6, 'en').ok, true);
    assert.equal(validateRequestedStepCount(1, 'en').ok, false);
    assert.equal(validateRequestedComponentCount(4, 'en').ok, true);
    assert.equal(validateRequestedComponentCount(0, 'en').ok, false);
  });

  test('step plan validation enforces exact requested step count', () => {
    const steps = [
      {
        title: 'Step one',
        description:
          'Prepare the Arduino board, LDR, LED, breadboard, and jumper wires on a clean workspace.',
      },
      {
        title: 'Step two',
        description:
          'Wire the LDR voltage divider and connect the LED with a current-limiting resistor.',
      },
    ];
    const mismatch = validateAuthoringStepPlanForSession({
      project: arabicArduinoProject,
      steps,
      requestedStepCount: 6,
    });
    assert.equal(mismatch.ok, false);

    const match = validateAuthoringStepPlanForSession({
      project: arabicArduinoProject,
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino وLDR وLED',
      contentLocale: 'ar',
      steps: [
        {
          title: 'تجهيز Arduino والمكوّنات',
          description:
            'جهّز Arduino Uno وLDR وLED وBreadboard والأسلاك وتحقق من سلامة كل قطعة قبل البدء بالتوصيل.',
        },
        {
          title: 'فهم Voltage Divider للـ LDR',
          description:
            'اقرأ كيف يعمل مقسم الجهد بمقاومة 10kΩ مع LDR ولماذا نحتاجه لقراءة الإضاءة على Analog pin.',
        },
        {
          title: 'توصيل LDR والمقاومة على Breadboard',
          description:
            'ضع LDR ومقاومة 10kΩ على Breadboard ووصّل نقطة القراءة الوسطى نحو Analog pin A0 على Arduino.',
        },
        {
          title: 'توصيل LED مع مقاومة 220Ω',
          description:
            'وصّل LED مع مقاومة 220Ω على Digital pin محدد وتأكد من اتجاه القطبين قبل تثبيت التوصيل.',
        },
        {
          title: 'كتابة كود القراءة والتحكم',
          description:
            'اكتب كودًا يقرأ قيمة LDR من A0 عبر analogRead ويطبع القيم في Serial Monitor ثم يضبط Threshold لتشغيل LED.',
        },
        {
          title: 'المعايرة والاختبار في الضوء والظلام',
          description:
            'ارفع الكود عبر USB وجرّب المشروع في إضاءة قوية وضعيفة وعدّل Threshold حتى يعمل LED بشكل صحيح.',
        },
      ],
      requestedStepCount: 6,
    });
    assert.equal(match.ok, true);
  });

  test('LDR project scalar proposal cannot introduce PIR motion sensing', () => {
    const brief = [
      arabicArduinoProject.title,
      arabicArduinoProject.description,
      'Arduino Uno LDR LED Breadboard',
    ].join('\n');
    const conflicts = detectAuthoringConceptConflicts({
      briefText: brief,
      fields: [
        {
          field: 'SHORT_DESCRIPTION',
          text: 'مشروع يستخدم PIR motion sensor لكشف الأشخاص وتشغيل الإضاءة.',
        },
      ],
    });
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.field, 'SHORT_DESCRIPTION');
    assert.equal(conflicts[0]?.fieldConcept, 'MOTION_SENSING');
    assert.equal(conflicts[0]?.briefConcept, 'LIGHT_SENSING');
  });

  test('contradictory accepted context is detected before step generation', () => {
    const brief = [
      arabicArduinoProject.title,
      arabicArduinoProject.description,
      'Arduino Uno LDR LED Breadboard',
    ].join('\n');
    const conflicts = detectAuthoringConceptConflicts({
      briefText: brief,
      fields: [
        {
          field: 'shortDescription',
          text: 'PIR motion-sensor automation that detects people.',
        },
      ],
    });
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.fieldConcept, 'MOTION_SENSING');
  });

  test('consistent Arabic LDR context produces no concept conflicts', () => {
    const brief = [
      arabicArduinoProject.title,
      arabicArduinoProject.description,
      'Arduino Uno LDR LED Breadboard',
    ].join('\n');
    const conflicts = detectAuthoringConceptConflicts({
      briefText: brief,
      fields: [
        {
          field: 'shortDescription',
          text: 'مصباح ليلي يعتمد على LDR لتشغيل LED عند الظلام.',
        },
      ],
    });
    assert.equal(conflicts.length, 0);
  });

  test('step count intent is detected before generic revision intent', () => {
    assert.equal(
      resolveStepsComposerIntent({
        comment: 'خليهم 6 خطوات',
        history: [],
        stage: 'STEPS_OVERVIEW',
      }),
      'SET_STEP_COUNT',
    );
  });

  test('step review revision maps to REVISE_SPECIFIC_STEP', () => {
    assert.equal(
      resolveStepsComposerIntent({
        comment: 'change the step description and mention A0 clearly',
        history: [],
        stage: 'STEP_REVIEW',
      }),
      'REVISE_SPECIFIC_STEP',
    );
  });

  test('scalar composer intent distinguishes explanation from revision', async () => {
    const { resolveScalarComposerIntent } = await import('./project-authoring-session.helpers.js');
    assert.equal(
      resolveScalarComposerIntent({
        comment: 'ليش هذا الوصف مناسب للمبتدئ؟',
        history: [],
        stage: 'SHORT_DESCRIPTION',
      }),
      'EXPLAIN_CURRENT_PROPOSAL',
    );
    assert.equal(
      resolveScalarComposerIntent({
        comment: 'خليه أوضح للمبتدئ، واذكر إنه يعتمد على الضوء مش الحركة.',
        history: [],
        stage: 'SHORT_DESCRIPTION',
      }),
      'REVISE_CURRENT_PROPOSAL',
    );
    assert.equal(
      resolveScalarComposerIntent({
        comment: 'اه، كمل ووضحلي كيف بوصلها.',
        history: [{ role: 'assistant', text: 'شرح سابق عن المقاومة.' }],
        stage: 'SHORT_DESCRIPTION',
      }),
      'CONTINUE_PREVIOUS_RESPONSE',
    );
  });

  test('session validation uses the same authoritative quality requirements object', async () => {
    const { computeStepPlanQualityRequirements } = await import(
      './ai-project-authoring-real.provider.js'
    );
    const components = [
      {
        id: 'comp-arduino',
        componentName: 'Arduino Uno',
        materialType: 'Microcontroller',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL' as const,
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: [],
        notes: null,
      },
    ];
    const qualityRequirements = computeStepPlanQualityRequirements({
      locale: 'ar',
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino وLDR وLED',
      projectTitle: arabicArduinoProject.title,
      projectShortDescription: arabicArduinoProject.shortDescription,
      projectDescription: arabicArduinoProject.description,
      difficulty: 'BEGINNER',
      estimatedMinutes: 300,
      components,
      recentAnswers: [],
      requestedStepCount: null,
    });
    const shortPlan = validateAuthoringStepPlanForSession({
      project: arabicArduinoProject,
      ideaText: 'بدي أعمل مصباح ليلي ذكي باستخدام Arduino وLDR وLED',
      contentLocale: 'ar',
      qualityRequirements,
      steps: [
        {
          title: 'خطوة واحدة',
          description:
            'جهّز Arduino Uno وLDR وLED وBreadboard والأسلاك وتحقق من سلامة كل قطعة قبل البدء بالتوصيل.',
        },
        {
          title: 'خطوة اثنان',
          description:
            'وصّل LDR ومقاومة 10kΩ على Breadboard واربط نقطة القراءة بـ Analog pin A0 ثم تحقق أن القراءة تتغير.',
        },
      ],
    });
    assert.equal(shortPlan.ok, false);
    if (!shortPlan.ok) {
      assert.equal(shortPlan.code, 'AI_AUTHORING_STEP_QUALITY_INVALID');
      assert.equal(shortPlan.requiredMinimum, qualityRequirements.minimumMeaningfulSteps);
      assert.equal(shortPlan.receivedSteps, 2);
    }
  });
});
