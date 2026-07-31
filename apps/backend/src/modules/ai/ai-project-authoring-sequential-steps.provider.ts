import { z } from 'zod';

import { resolveAiChatProvider } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';

import type { AiProjectAuthoringClarificationBlock } from './ai.content-blocks.js';
import {
  generateRealAuthoringStepPlan,
  applyResolvedComponentRefsToSteps,
  filterComponentConsistencyFalsePositives,
  computeStepPlanQualityRequirements,
  assertStepPlanQuality,
  buildStepQualityRepairIssue,
  type RealAuthoringStepPlanInput,
  type StepPlanQualityRequirements,
} from './ai-project-authoring-real.provider.js';
import {
  reindexWorkingSteps,
  validateComponentStepConsistency,
  type SequentialComponent,
  type SequentialStep,
} from './ai-project-authoring-sequential.policy.js';
import type { AiLocale } from './ai.types.js';

const stepSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(8).max(2000),
  safetyNote: z.string().trim().max(500).nullable().optional(),
  componentRefs: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export const stepStageReplySchema = z.discriminatedUnion('replyType', [
  z.object({
    replyType: z.literal('STEP_PLAN'),
    assistantText: z.string().trim().min(8).max(4000),
    steps: z.array(stepSchema).min(2).max(30),
  }),
  z.object({
    replyType: z.literal('REVISED_STEP_PLAN'),
    assistantText: z.string().trim().min(8).max(4000),
    steps: z.array(stepSchema).min(2).max(30),
  }),
  z.object({
    replyType: z.literal('FOLLOW_UP_QUESTION'),
    assistantText: z.string().trim().min(8).max(1200),
  }),
  z.object({
    replyType: z.literal('STEP_EXPLANATION'),
    assistantText: z.string().trim().min(8).max(2000),
  }),
]);

export type StepStageReply = z.infer<typeof stepStageReplySchema>;

export type StepStageIntent =
  | 'SHOW_OR_GENERATE_FULL_PLAN'
  | 'REVISION'
  | 'EXPLANATION'
  | 'SIMPLIFY'
  | 'OTHER';

export type StepListContext = {
  locale: AiLocale;
  projectId?: string | null;
  ideaText: string;
  projectTitle: string;
  projectShortDescription: string;
  projectDescription: string | null;
  difficulty: string;
  estimatedMinutes: number | null;
  components: SequentialComponent[];
  clarification: AiProjectAuthoringClarificationBlock;
  recentAnswers: string[];
  requestedStepCount?: number | null;
  requestedComponentCount?: number | null;
  repairAttempt?: boolean;
  repairIssue?: string | null;
  previousInvalidOutput?: string | null;
  qualityRequirements?: StepPlanQualityRequirements;
};

export type StepFeedbackContext = StepListContext & {
  comment: string;
  currentSteps: SequentialStep[];
  intent: StepStageIntent;
};

const GENERIC_STEP_ACK_PATTERNS = [
  /^which part of this suggestion/i,
  /^which part would you like to change/i,
  /^i understand/i,
  /^i will revise/i,
  /^فهمت طلبك/i,
  /^ما الجزء الذي تريد تعديله/i,
];

const SHALLOW_DESCRIPTION_PATTERNS = [
  /^connect the components\.?$/i,
  /^write the code\.?$/i,
  /^test the project\.?$/i,
  /^build the project\.?$/i,
  /^prepare the materials\.?$/i,
  /^جهّز المواد\.?$/,
  /^نفّذ المشروع\.?$/,
  /^اختبر النتيجة\.?$/,
];

const IRRELEVANT_DOMAIN_PATTERNS = [
  /\b(transaction|expense|income|database|financial|accounting|invoice)\b/i,
  /\b(web app|mobile app|react|dashboard)\b/i,
  /(معاملات|مصاريف|قاعدة بيانات|محاسبة|فاتورة)/i,
];

const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06FF]/;
const MIN_STEP_DESCRIPTION_LENGTH = 48;

const normalizeText = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[!.؟?،,]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/آ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

const projectContextText = (input: StepListContext) =>
  [
    input.ideaText,
    input.projectTitle,
    input.projectShortDescription,
    input.projectDescription ?? '',
    ...input.recentAnswers,
  ].join(' ');

const constraintText = (input: StepListContext) =>
  [projectContextText(input), JSON.stringify(input.clarification)].join(' ');

const learnerConstraints = (input: StepListContext) =>
  [
    input.ideaText,
    input.projectDescription ?? '',
    ...input.recentAnswers,
    ...(input.clarification.warnings ?? []),
    ...(input.clarification.assumptions ?? []),
  ].filter(Boolean);

const projectLooksHardwareOriented = (text: string) =>
  /\b(arduino|ldr|led|breadboard|sensor|voltage|gpio|analog|digital pin|microcontroller|resistor)\b/i.test(
    text,
  ) || /(اردوينو|حساس|صمام|مقاومة|توصيل|بريدبورد|ليد)/i.test(text);

const projectLooksArabic = (input: StepListContext) =>
  ARABIC_SCRIPT_PATTERN.test(
    [input.ideaText, input.projectTitle, input.projectShortDescription, input.projectDescription ?? '']
      .join('\n'),
  );

type CatalogComponent = SequentialComponent & { id: string };

const catalogFromInput = (input: StepListContext): CatalogComponent[] =>
  input.components
    .filter((component): component is CatalogComponent => Boolean(component.id?.trim()))
    .map((component) => ({ ...component, id: component.id!.trim() }));

const refsFor = (catalog: CatalogComponent[], patterns: RegExp[]) => {
  const ids = patterns
    .map((pattern) =>
      catalog.find((component) => pattern.test(component.componentName))?.id,
    )
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
};

const allCatalogRefs = (catalog: CatalogComponent[]) => catalog.map((component) => component.id);

const forbiddenStepTerms = (text: string) => {
  const lowered = text.toLowerCase();
  return /\b(ultrasonic|pir|motion sensor|lcd|relay|pump|مضخه|مضخة|ريلاي)\b/i.test(lowered);
};

const resolveQualityRequirements = (input: StepListContext) =>
  input.qualityRequirements ??
  computeStepPlanQualityRequirements({
    locale: input.locale,
    ideaText: input.ideaText,
    projectTitle: input.projectTitle,
    projectShortDescription: input.projectShortDescription,
    projectDescription: input.projectDescription,
    difficulty: input.difficulty,
    estimatedMinutes: input.estimatedMinutes,
    components: input.components,
    recentAnswers: input.recentAnswers,
    requestedStepCount: input.requestedStepCount ?? null,
  });

const assertDetailedStepQuality = (input: StepListContext, steps: SequentialStep[]) => {
  const requirements = resolveQualityRequirements(input);
  const corpus = projectContextText(input);
  const planText = steps.map((step) => `${step.title} ${step.description}`).join('\n');

  if (projectLooksHardwareOriented(corpus) && IRRELEVANT_DOMAIN_PATTERNS.some((pattern) => pattern.test(planText))) {
    throw new AppError('Step plan content is unrelated to the hardware project context.', 502, 'AI_AUTHORING_STEP_QUALITY_INVALID', {
      issues: ['Step plan content is unrelated to the hardware project context.'],
      requiredMinimum: requirements.minimumMeaningfulSteps,
      receivedSteps: steps.length,
      missingPhases: [],
    });
  }

  if (input.requestedStepCount != null && steps.length !== input.requestedStepCount) {
    throw new AppError(
      `Learner requested exactly ${input.requestedStepCount} steps; received ${steps.length}.`,
      502,
      'AI_AUTHORING_STEP_QUALITY_INVALID',
      {
        issues: [`Learner requested exactly ${input.requestedStepCount} steps; received ${steps.length}.`],
        requiredMinimum: input.requestedStepCount,
        receivedSteps: steps.length,
        missingPhases: [],
      },
    );
  }

  assertStepPlanQuality(steps, requirements, input.components);
};

export const toSequentialSteps = (
  steps: Array<{
    title: string;
    description: string;
    safetyNote?: string | null;
    componentRefs?: string[];
  }>,
): SequentialStep[] =>
  reindexWorkingSteps(
    steps.map((step) => ({
      title: step.title,
      description: step.safetyNote
        ? `${step.description}\n\n${step.safetyNote}`
        : step.description,
      componentRefs: step.componentRefs,
    })),
  );

export const validateStepList = (steps: SequentialStep[]): SequentialStep[] => {
  const normalized = reindexWorkingSteps(steps);
  if (normalized.length < 2) {
    throw new AppError('Step plan must include at least two steps.', 502, 'AI_STEP_PROPOSAL_INVALID');
  }
  const titles = normalized.map((step) => normalizeText(step.title));
  if (new Set(titles).size !== titles.length) {
    throw new AppError('Duplicate step titles are not allowed.', 502, 'AI_STEP_PROPOSAL_INVALID');
  }
  return normalized;
};

const assertStepPlanConsistency = (input: StepListContext, steps: SequentialStep[]) => {
  const resolved = applyResolvedComponentRefsToSteps(steps, input.components);
  if (resolved.unknown.length > 0 || resolved.ambiguous.length > 0) {
    const unknownComponents = [...resolved.unknown, ...resolved.ambiguous];
    throw new AppError(
      `Step plan references unknown components: ${unknownComponents.join(', ')}`,
      409,
      'AI_STEP_COMPONENT_INCONSISTENT',
      {
        unknownComponents,
        ambiguousComponents: resolved.ambiguous,
        issues: [
          ...resolved.unknown.map(
            (ref) => `Step plan references unknown component "${ref}".`,
          ),
          ...resolved.ambiguous.map(
            (ref) => `Step plan references ambiguous component "${ref}".`,
          ),
        ],
      },
    );
  }
  const consistency = validateComponentStepConsistency({
    components: input.components,
    steps: resolved.steps,
    constraints: [constraintText(input)],
  });
  if (!consistency.ok) {
    const filteredIssues = filterComponentConsistencyFalsePositives(
      consistency.issues,
      input.components,
      resolved.steps,
    );
    if (filteredIssues.length > 0) {
      throw new AppError(filteredIssues.join(' '), 409, 'AI_STEP_COMPONENT_INCONSISTENT', {
        issues: filteredIssues,
      });
    }
  }
  const planText = resolved.steps.map((step) => `${step.title} ${step.description}`).join(' ');
  if (forbiddenStepTerms(planText)) {
    throw new AppError(
      'Step plan references forbidden components for this project.',
      409,
      'AI_STEP_COMPONENT_INCONSISTENT',
    );
  }
  return resolved.steps;
};

const buildMockHardwareStepPlan = (
  input: StepListContext,
  catalog: CatalogComponent[],
): SequentialStep[] => {
  const ar = input.locale === 'ar';
  const arduinoRef = refsFor(catalog, [/arduino/i]);
  const ldrRef = refsFor(catalog, [/ldr|photoresistor/i]);
  const ledRef = refsFor(catalog, [/led/i]);
  const resistorRef = refsFor(catalog, [/10k|220|resistor|مقاومة/i]);
  const breadboardRef = refsFor(catalog, [/breadboard/i]);
  const allRefs = allCatalogRefs(catalog);
  const componentNames = catalog.map((component) => component.componentName).join(ar ? ' و' : ', ');

  const steps: SequentialStep[] = [
    {
      title: ar ? 'تجهيز وفحص المكوّنات' : 'Prepare and inspect the components',
      description: ar
        ? `جهّز ${componentNames} على سطح نظيف وتحقق من سلامة كل قطعة وعدم وجود تلف في الأسلاك أو الأرجل قبل البدء بالتوصيل على Breadboard.`
        : `Lay out ${componentNames} on a clean surface and inspect each part for damage before placing anything on the breadboard.`,
      componentRefs: allRefs,
    },
    {
      title: ar ? 'فهم دائرة Voltage Divider للـ LDR' : 'Understand the LDR voltage divider',
      description: ar
        ? 'اقرأ كيف يعمل مقسم الجهد بمقاومة 10kΩ مع LDR ولماذا نحتاجه لتحويل تغير الضوء إلى قيمة Analog يمكن لـ Arduino قراءتها بأمان على 5V.'
        : 'Review how the 10kΩ resistor forms a voltage divider with the LDR so light changes become a safe analog voltage the Arduino can read at 5V.',
      componentRefs: [...ldrRef, ...resistorRef],
    },
    {
      title: ar ? 'تثبيت المكوّنات على Breadboard' : 'Place components on the breadboard',
      description: ar
        ? 'ضع Arduino وBreadboard والمكوّنات الأساسية في مواقع واضحة مع ترك مسارات للأسلاك حتى يسهل تتبع التوصيلات أثناء البناء.'
        : 'Place the Arduino, breadboard, and core parts in clear positions with room for jumper wires so each connection stays easy to follow.',
      componentRefs: [...breadboardRef, ...arduinoRef],
    },
    {
      title: ar ? 'توصيل LDR والمقاومة 10kΩ' : 'Wire the LDR and 10kΩ resistor',
      description: ar
        ? 'وصّل LDR ومقاومة 10kΩ على Breadboard لتكوين Voltage Divider، ثم أوصل نقطة القراءة الوسطى إلى Analog pin A0 على Arduino مع توصيل 5V وGND بشكل صحيح.'
        : 'Wire the LDR and 10kΩ resistor on the breadboard as a voltage divider, then connect the junction to Arduino analog pin A0 with correct 5V and GND ties.',
      componentRefs: [...ldrRef, ...resistorRef, ...arduinoRef],
    },
    {
      title: ar ? 'توصيل LED ومقاومة الحماية' : 'Connect the LED and current-limiting resistor',
      description: ar
        ? 'وصّل LED مع مقاومة 220Ω على Digital pin محدد مع مراعاة اتجاه القطبين، وتأكد أن مسار التيار يمر عبر المقاومة قبل LED.'
        : 'Connect the LED with a 220Ω resistor to a chosen digital pin, observing polarity and ensuring current flows through the resistor before the LED.',
      componentRefs: [...ledRef, ...resistorRef, ...arduinoRef],
    },
    {
      title: ar ? 'تعريف الـ pins في الكود' : 'Define pins in the sketch',
      description: ar
        ? 'افتح Arduino IDE وعرّف أسماء واضحة لـ Analog pin A0 وDigital pin الخاص بالـ LED حتى يسهل قراءة الكود لاحقًا أثناء المعايرة.'
        : 'Open the Arduino IDE and define clear constants for analog pin A0 and the LED digital pin so later calibration code stays readable.',
      componentRefs: arduinoRef,
    },
    {
      title: ar ? 'قراءة قيمة LDR في Serial Monitor' : 'Read the LDR value in Serial Monitor',
      description: ar
        ? 'اكتب كودًا يقرأ analogRead من A0 ويطبع القيمة في Serial Monitor عند 9600 baud لتلاحظ الفرق بين الإضاءة القوية والضعيفة قبل ضبط Threshold.'
        : 'Write code that reads analogRead(A0) and prints values in Serial Monitor at 9600 baud so you can compare bright and dark readings before choosing a threshold.',
      componentRefs: [...arduinoRef, ...ldrRef],
    },
    {
      title: ar ? 'ضبط Threshold وتشغيل LED' : 'Set the threshold and control the LED',
      description: ar
        ? 'اختر قيمة Threshold مناسبة بناءً على قراءاتك السابقة، ثم أضف منطقًا يشغّل LED عندما تنخفض الإضاءة عن هذه القيمة.'
        : 'Choose a threshold from your earlier readings, then add logic that turns the LED on when the light level falls below that value.',
      componentRefs: [...arduinoRef, ...ledRef, ...ldrRef],
    },
    {
      title: ar ? 'رفع الكود والاختبار في الضوء والظلام' : 'Upload and test in bright and dark conditions',
      description: ar
        ? 'ارفع السكيتش عبر USB واختبر المشروع في إضاءة قوية وضعيفة، وسجّل ما إذا كان LED يعمل كما تتوقع قبل إنهاء التوصيلات.'
        : 'Upload the sketch over USB and test in bright and dark conditions, noting whether the LED behaves as expected before finalizing wiring.',
      componentRefs: arduinoRef,
    },
    {
      title: ar ? 'استكشاف الأخطاء وإعادة المعايرة' : 'Troubleshoot and recalibrate',
      description: ar
        ? 'إذا لم يعمل LED أو القراءة غير مستقرة، راجع التوصيلات وGND وA0 والمقاومات، ثم عدّل Threshold وأعد الاختبار حتى يصبح السلوك ثابتًا.'
        : 'If the LED does not respond or readings drift, recheck wiring, GND, A0, and resistor values, then adjust the threshold and retest until behavior is stable.',
      componentRefs: allRefs,
    },
  ];

  return validateStepList(steps);
};

const buildMockCraftStepPlan = (input: StepListContext, catalog: CatalogComponent[]): SequentialStep[] => {
  const ar = input.locale === 'ar';
  const names = catalog.map((component) => component.componentName).join(ar ? ' و' : ', ');
  const refs = allCatalogRefs(catalog);
  return validateStepList([
    {
      title: ar ? 'تجهيز المواد والأدوات' : 'Prepare materials and tools',
      description: ar
        ? `اجمع ${names || 'المواد المطلوبة'} وتحقق من توفر كل قطعة على سطح عمل نظيف قبل البدء بالتنفيذ.`
        : `Gather ${names || 'the required materials'} and confirm everything is available on a clean work surface before starting.`,
      componentRefs: refs,
    },
    {
      title: ar ? 'قياس وتخطيط العمل' : 'Measure and plan the build',
      description: ar
        ? 'حدد الأبعاد أو المواقع المطلوبة وعلّمها بوضوح حتى تقل الأخطاء أثناء القص أو الطي أو التجميع.'
        : 'Mark the required dimensions or positions clearly so cutting, folding, or assembly mistakes are less likely.',
      componentRefs: refs.slice(0, 1),
    },
    {
      title: ar ? 'تنفيذ الخطوة الأساسية' : 'Complete the main build step',
      description: ar
        ? 'نفّذ الجزء الرئيسي من المشروع ببطء مع مراجعة كل حركة قبل تثبيتها نهائيًا.'
        : 'Complete the main build action carefully, checking each move before making it permanent.',
      componentRefs: refs,
    },
    {
      title: ar ? 'اللمسات الأخيرة والتحقق' : 'Finish and verify the result',
      description: ar
        ? 'أضف اللمسات النهائية ثم تحقق أن النتيجة تطابق هدف المشروع وتعمل أو تبدو كما خططت.'
        : 'Add finishing touches, then verify the result matches the project goal and works or looks as intended.',
      componentRefs: refs,
    },
  ]);
};

const mockGenerateSequentialStepList = (
  input: StepListContext & { suggestAnother?: boolean; previousSteps?: SequentialStep[] },
): { steps: SequentialStep[]; explanation: string } => {
  const catalog = catalogFromInput(input);
  const corpus = projectContextText(input);
  let steps: SequentialStep[];

  if (catalog.length > 0 && projectLooksHardwareOriented(corpus)) {
    steps = buildMockHardwareStepPlan(input, catalog);
  } else if (catalog.length > 0) {
    steps = buildMockCraftStepPlan(input, catalog);
  } else {
    steps = validateStepList([
      {
        title: input.locale === 'ar' ? 'تجهيز مساحة العمل والمواد' : 'Prepare the workspace and materials',
        description:
          input.locale === 'ar'
            ? 'جهّز مساحة عمل آمنة ونظّم المواد الأساسية وتحقق من توفر كل ما تحتاجه قبل البدء.'
            : 'Set up a safe workspace, organize the core materials, and confirm everything needed is available before starting.',
      },
      {
        title: input.locale === 'ar' ? 'تنفيذ الخطوة الرئيسية' : 'Complete the main project action',
        description:
          input.locale === 'ar'
            ? 'نفّذ الجزء الأساسي من المشروع خطوة بخطوة مع مراجعة النتيجة بعد كل جزء مهم.'
            : 'Carry out the main project action step by step, checking progress after each important part.',
      },
      {
        title: input.locale === 'ar' ? 'المراجعة والاختبار النهائي' : 'Review and final test',
        description:
          input.locale === 'ar'
            ? 'راجع عملك بالكامل واختبر النتيجة النهائية للتأكد أنها تطابق هدف المشروع.'
            : 'Review the full build and run a final test to confirm the outcome matches the project goal.',
      },
      {
        title: input.locale === 'ar' ? 'توثيق ما تعلمته' : 'Document what you learned',
        description:
          input.locale === 'ar'
            ? 'دوّن ما نجح وما احتاج تعديلًا حتى يسهل إعادة المشروع أو تحسينه لاحقًا.'
            : 'Write down what worked and what needed adjustment so you can repeat or improve the project later.',
      },
    ]);
  }

  if (input.suggestAnother && input.previousSteps?.length) {
    const alternateTitle =
      input.locale === 'ar' ? 'مراجعة بديلة قبل الإنهاء' : 'Alternate review before finishing';
    if (!steps.some((step) => normalizeText(step.title) === normalizeText(alternateTitle))) {
      steps = validateStepList([
        ...steps,
        {
          title: alternateTitle,
          description:
            input.locale === 'ar'
              ? 'راجع مسارًا بديلًا للتنفيذ أو الاختبار قبل اعتماد الخطة النهائية للتأكد من وضوح كل خطوة.'
              : 'Review an alternate build or test path before adopting the final plan to confirm every step stays clear.',
          componentRefs: allCatalogRefs(catalog).slice(0, 1),
        },
      ]);
    }
  }

  assertDetailedStepQuality(input, steps);

  return {
    steps,
    explanation:
      input.locale === 'ar'
        ? 'خطة خطوات مفصلة مرتبطة بمكوّنات المشروع وسياق الفكرة.'
        : 'A detailed step plan grounded in the project components and idea context.',
  };
};

const planSignature = (steps: SequentialStep[]) =>
  steps
    .map((step) => `${normalizeText(step.title)}|${normalizeText(step.description)}`)
    .join('::');

const toRealStepInput = (
  input: StepListContext & {
    suggestAnother?: boolean;
    previousSteps?: SequentialStep[];
    feedback?: string | null;
  },
): RealAuthoringStepPlanInput => ({
  locale: input.locale,
  projectId: input.projectId ?? null,
  ideaText: input.ideaText,
  projectTitle: input.projectTitle,
  projectShortDescription: input.projectShortDescription,
  projectDescription: input.projectDescription,
  difficulty: input.difficulty,
  durationMinutes: input.estimatedMinutes,
  learnerConstraints: learnerConstraints(input),
  recentMessages: input.recentAnswers,
  components: input.components,
  clarification: input.clarification,
  repairAttempt: input.repairAttempt ?? false,
  repairIssue: input.repairIssue ?? null,
  previousInvalidOutput: input.previousInvalidOutput ?? null,
  suggestAnother: input.suggestAnother,
  previousSteps: input.previousSteps,
  feedback: input.feedback ?? null,
  requestedStepCount: input.requestedStepCount ?? null,
  qualityRequirements: resolveQualityRequirements(input),
});

const readPreviousInvalidOutput = (error: unknown): string | null => {
  if (!(error instanceof AppError) || !error.details || typeof error.details !== 'object') {
    return null;
  }
  const details = error.details as Record<string, unknown>;
  return typeof details.previousInvalidOutput === 'string'
    ? details.previousInvalidOutput
    : null;
};

const invokeConfiguredStepProvider = async (
  input: StepListContext & {
    suggestAnother?: boolean;
    previousSteps?: SequentialStep[];
    feedback?: string | null;
  },
) => {
  const resolvedProvider = resolveAiChatProvider();

  if (resolvedProvider === 'disabled') {
    throw new AppError(
      input.locale === 'ar'
        ? 'مساعد الذكاء الاصطناعي غير متاح حاليًا.'
        : 'The AI assistant is currently unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  let result: { steps: SequentialStep[]; explanation: string };
  if (resolvedProvider === 'mock') {
    result = mockGenerateSequentialStepList(input);
  } else {
    const providerResult = await generateRealAuthoringStepPlan(
      toRealStepInput(input),
      resolvedProvider,
    );
    result = providerResult.data;
  }

  const steps = validateStepList(result.steps);
  const consistentSteps = assertStepPlanConsistency(input, steps);
  assertDetailedStepQuality(input, consistentSteps);
  return { steps: consistentSteps, explanation: result.explanation };
};

export const generateSequentialStepList = async (
  input: StepListContext,
): Promise<{ steps: SequentialStep[]; explanation: string }> =>
  invokeConfiguredStepProvider(input);

export const generateSequentialStepListWithRepair = async (
  input: StepListContext & {
    suggestAnother?: boolean;
    previousSteps?: SequentialStep[];
    feedback?: string | null;
  },
): Promise<{ steps: SequentialStep[]; explanation: string }> => {
  try {
    return await generateSequentialStepList(input);
  } catch (error) {
    if (input.repairAttempt) {
      if (error instanceof AppError && error.code === 'AI_PROVIDER_TIMEOUT') {
        throw new AppError(
          input.locale === 'ar'
            ? 'انتهت مهلة إنشاء خطة الخطوات. حاول مرة أخرى.'
            : 'Step plan generation timed out. Please try again.',
          504,
          'AI_AUTHORING_STEP_GENERATION_TIMEOUT',
        );
      }
      throw error instanceof AppError
        ? error
        : new AppError(
            input.locale === 'ar'
              ? 'تعذّر إنشاء خطة خطوات صالحة.'
              : 'Could not generate a valid step plan.',
            502,
            'AI_AUTHORING_STEP_GENERATION_FAILED',
          );
    }
    const previousInvalidOutput = readPreviousInvalidOutput(error);
    const qualityDetails =
      error instanceof AppError && error.details && typeof error.details === 'object'
        ? (error.details as {
            issues?: string[];
            requiredMinimum?: number;
            receivedSteps?: number;
            missingPhases?: string[];
          })
        : {};
    const requirements = resolveQualityRequirements(input);
    const unknownComponents =
      error instanceof AppError &&
      error.details &&
      typeof error.details === 'object' &&
      Array.isArray((error.details as { unknownComponents?: unknown }).unknownComponents)
        ? (error.details as { unknownComponents: string[] }).unknownComponents
        : [];
    const issueParts = [
      error instanceof AppError && error.code === 'AI_AUTHORING_STEP_QUALITY_INVALID'
        ? buildStepQualityRepairIssue({
            requirements,
            receivedSteps: qualityDetails.receivedSteps ?? 0,
            issues: qualityDetails.issues ?? [error.message],
            missingPhases: qualityDetails.missingPhases ?? [],
          })
        : error instanceof AppError
          ? error.message
          : 'Step plan was invalid.',
      unknownComponents.length > 0
        ? `Unknown componentRefs: ${JSON.stringify(unknownComponents)}`
        : null,
      error instanceof AppError &&
      Array.isArray((error.details as { issues?: unknown })?.issues) &&
      error.code !== 'AI_AUTHORING_STEP_QUALITY_INVALID'
        ? `Issues: ${JSON.stringify((error.details as { issues: unknown }).issues).slice(0, 1500)}`
        : null,
    ].filter(Boolean);
    return generateSequentialStepList({
      ...input,
      repairAttempt: true,
      repairIssue: issueParts.join(' '),
      previousInvalidOutput,
    });
  }
};

export const classifyStepStageIntent = (comment: string): StepStageIntent => {
  const normalized = normalizeText(comment);
  if (
    normalized.includes('اشرح') ||
    normalized.includes('وضح') ||
    normalized.includes('explain') ||
    normalized.includes('more detail')
  ) {
    return 'EXPLANATION';
  }
  if (
    normalized.includes('ابسط') ||
    normalized.includes('اسهل') ||
    normalized.includes('simpler') ||
    normalized.includes('beginner')
  ) {
    return 'SIMPLIFY';
  }
  if (
    normalized.includes('اضف') ||
    normalized.includes('أضف') ||
    normalized.includes('احذف') ||
    normalized.includes('ازل') ||
    normalized.includes('add') ||
    normalized.includes('remove') ||
    normalized.includes('delete') ||
    normalized.includes('revise')
  ) {
    return 'REVISION';
  }
  if (
    normalized.includes('اعطني الخطوات') ||
    normalized.includes('اعطيني الخطوات') ||
    normalized.includes('step plan') ||
    normalized.includes('build steps')
  ) {
    return 'SHOW_OR_GENERATE_FULL_PLAN';
  }
  return 'OTHER';
};

const rejectGenericReply = (text: string) => {
  if (GENERIC_STEP_ACK_PATTERNS.some((pattern) => pattern.test(text.trim()))) {
    throw new AppError('Provider returned a generic acknowledgement.', 502, 'AI_STEP_PROPOSAL_INVALID');
  }
};

const buildPlanReply = (
  input: StepFeedbackContext,
  steps: SequentialStep[],
  replyType: 'STEP_PLAN' | 'REVISED_STEP_PLAN',
  assistantNote?: string,
): StepStageReply => {
  const numbered = steps
    .map((step, index) => `${index + 1}. ${step.title}\n${step.description}`)
    .join('\n\n');
  const prefix =
    assistantNote ??
    (input.locale === 'ar'
      ? `إليك خطة الخطوات المقترحة:\n\n${numbered}`
      : `Here is the proposed step plan:\n\n${numbered}`);
  rejectGenericReply(prefix);
  return stepStageReplySchema.parse({
    replyType,
    assistantText: prefix,
    steps: steps.map((step, index) => ({
      order: index + 1,
      title: step.title,
      description: step.description,
      safetyNote: null,
      componentRefs: step.componentRefs,
    })),
  });
};

const applyRevisionHeuristics = (
  input: StepFeedbackContext,
  current: SequentialStep[],
): SequentialStep[] => {
  const comment = normalizeText(input.comment);
  let steps = [...current];

  if (comment.includes('buzzer') && comment.includes('led') && comment.includes('اختبار')) {
    const testingTitle =
      input.locale === 'ar' ? 'اختبر Buzzer وLED' : 'Test the buzzer and LED';
    if (!steps.some((step) => normalizeText(step.title).includes('اختبار') || normalizeText(step.title).includes('test'))) {
      steps.splice(Math.max(steps.length - 1, 0), 0, {
        title: testingTitle,
        description:
          input.locale === 'ar'
            ? 'اختبر المخرجات قبل إكمال بقية الخطوات وتأكد أن Buzzer وLED يستجيبان كما هو متوقع.'
            : 'Test the outputs before completing the remaining steps and confirm the buzzer and LED respond as expected.',
      });
    }
  }

  if (comment.includes('احذف') && comment.includes('تثبيت')) {
    steps = steps.filter(
      (step) =>
        !normalizeText(step.title).includes('ثبيت') &&
        !normalizeText(step.title).includes('mount'),
    );
  }

  return validateStepList(steps);
};

export const validateStepStageReply = (reply: StepStageReply): StepStageReply => {
  rejectGenericReply(reply.assistantText);
  if (reply.replyType === 'STEP_PLAN' || reply.replyType === 'REVISED_STEP_PLAN') {
    toSequentialSteps(reply.steps);
  }
  return reply;
};

export const generateStepStageReply = async (
  input: StepFeedbackContext,
): Promise<StepStageReply> => {
  const intent =
    input.intent === 'OTHER' ? classifyStepStageIntent(input.comment) : input.intent;

  if (intent === 'EXPLANATION') {
    const step = input.currentSteps[input.currentSteps.length - 1] ?? input.currentSteps[0];
    const text =
      input.locale === 'ar'
        ? `هذه الخطوة (${step?.title ?? 'الخطوة الحالية'}) توضّح كيفية التنفيذ بأمان قبل الانتقال للخطوة التالية.`
        : `This step (${step?.title ?? 'current step'}) explains how to proceed safely before moving on.`;
    return stepStageReplySchema.parse({
      replyType: 'STEP_EXPLANATION',
      assistantText: text,
    });
  }

  if (intent === 'REVISION' || intent === 'SIMPLIFY') {
    const revised = applyRevisionHeuristics(input, input.currentSteps);
    assertStepPlanConsistency(input, revised);
    return buildPlanReply(input, revised, 'REVISED_STEP_PLAN');
  }

  if (intent === 'SHOW_OR_GENERATE_FULL_PLAN' && input.currentSteps.length > 0) {
    return buildPlanReply(input, input.currentSteps, 'STEP_PLAN');
  }

  const generated = await generateSequentialStepList(input);
  return buildPlanReply(input, generated.steps, 'STEP_PLAN', generated.explanation);
};

export const generateAlternativeSequentialStepPlanWithRepair = async (
  input: StepListContext & { previousSteps: SequentialStep[] },
): Promise<{ steps: SequentialStep[]; explanation: string }> => {
  try {
    const generated = await invokeConfiguredStepProvider({
      ...input,
      suggestAnother: true,
      previousSteps: input.previousSteps,
      feedback:
        input.locale === 'ar'
          ? 'اقترح خطة خطوات بديلة ومختلفة ماديًا عن الخطة السابقة.'
          : 'Suggest a materially different alternative step plan from the previous one.',
    });

    if (planSignature(generated.steps) === planSignature(input.previousSteps)) {
      throw new AppError(
        input.locale === 'ar'
          ? 'أعاد المساعد نفس خطة الخطوات. جرّب اقتراحًا آخر.'
          : 'The assistant returned the same step plan. Retry another suggestion.',
        409,
        'AI_STEP_PLAN_IDENTICAL',
      );
    }

    return generated;
  } catch (error) {
    if (input.repairAttempt) {
      throw error;
    }
    return generateAlternativeSequentialStepPlanWithRepair({
      ...input,
      repairAttempt: true,
      repairIssue: error instanceof AppError ? error.message : 'Step plan was identical.',
    });
  }
};
