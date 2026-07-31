import { createHash } from 'node:crypto';

import { ZodError, type ZodIssue } from 'zod';

import { resolveAiChatProvider } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import { logger } from '../../observability/logger.js';

import {
  type AiAuthoringClarificationProviderResult,
  aiAuthoringClarificationProviderSchema,
  aiProjectAuthoringClarificationBlockSchema,
  type AiProjectAuthoringClarificationBlock,
} from './ai.content-blocks.js';
import type { AiLocale } from './ai.types.js';
import {
  generateRealAuthoringClarification,
} from './ai-project-authoring-real.provider.js';

export type AuthoringClarificationProviderResult = {
  provider: string;
  model: string | null;
  data: AiAuthoringClarificationProviderResult;
  usage: { inputTokens: number | null; outputTokens: number | null };
  latencyMs: number;
};

type ClarificationGenerator = (
  input: AuthoringClarificationContext,
) =>
  | AuthoringClarificationProviderResult
  | Promise<AuthoringClarificationProviderResult>;

export const MAX_AUTHORING_CLARIFICATION_QUESTIONS = 4;

export const AUTHORING_TOPIC_KEYS = [
  'project_goal',
  'expected_behavior',
  'target_user',
  'learner_skill_level',
  'available_materials',
  'required_technology',
  'power_source',
  'project_scale',
  'budget',
  'available_tools',
  'estimated_time',
  'indoor_or_outdoor',
  'safety_constraints',
  'preferred_reused_materials',
  'connectivity_or_control',
  'success_criteria',
] as const;

export type AuthoringTopicKey = (typeof AUTHORING_TOPIC_KEYS)[number];

export type AuthoringClarificationContext = {
  locale: AiLocale;
  ideaText: string;
  projectTitle: string | null;
  projectShortDescription: string | null;
  projectDescription: string | null;
  categoryName: string | null;
  difficulty: string | null;
  componentNames: string[];
  stepTitles: string[];
  answeredQuestionKeys: string[];
  answeredQuestionCount: number;
  currentAnswer: string | null;
  latestClarification: AiProjectAuthoringClarificationBlock | null;
  recentAuthoringAnswers?: string[];
  repairAttempt: boolean;
  repairIssue?: string | null;
  previousInvalidOutput?: string | null;
};

export type AuthoringClarificationRoute =
  | 'override'
  | 'mock'
  | 'gemini'
  | 'openai'
  | 'disabled';

let generatorOverride: ClarificationGenerator | null = null;
let clarificationCallCountForTests = 0;
let lastGeneratorRoute: AuthoringClarificationRoute | null = null;

export const getLastAuthoringClarificationRouteForTests = () =>
  lastGeneratorRoute;

export const getAuthoringClarificationCallCountForTests = () =>
  clarificationCallCountForTests;

export const resetAuthoringClarificationCallCountForTests = () => {
  clarificationCallCountForTests = 0;
};

export const setAuthoringClarificationGeneratorForTests = (
  generator: ClarificationGenerator | null,
) => {
  generatorOverride = generator;
};

const ELECTRONICS_HINT =
  /(arduino|esp32|esp8266|sensor|pump|relay|circuit|microcontroller|electronics|electronic|حساس|مضخة|اردوينو|الكترون)/iu;

const CRAFT_HINT =
  /(cardboard|recycled|paper|organizer|wood|fabric|craft|cardboard|كرتون|ورق|منظم|خشب|اعادة استخدام)/iu;

const isElectronicsProject = (text: string) => ELECTRONICS_HINT.test(text);

const isCraftProject = (text: string) =>
  CRAFT_HINT.test(text) && !isElectronicsProject(text);

const isDetailedIdea = (text: string) => {
  const normalized = text.toLowerCase();
  const signals = [
    /automatic|auto|pump|alert|notify/u,
    /battery|usb|solar|power|طاقة|بطارية/u,
    /plant|seedling|pot|نبات/u,
    /safety|waterproof|عزل|سلامة/u,
    /beginner|intermediate|advanced|مبتدئ/u,
  ];
  return signals.filter((pattern) => pattern.test(normalized)).length >= 3;
};

const topicQuestion = (
  key: AuthoringTopicKey,
  locale: AiLocale,
): {
  key: string;
  prompt: string;
  answerType: 'FREE_TEXT' | 'SINGLE_CHOICE' | 'MULTI_CHOICE';
  options: string[];
} => {
  const questions: Record<
    AuthoringTopicKey,
    { en: string; ar: string; answerType: 'FREE_TEXT' | 'SINGLE_CHOICE' | 'MULTI_CHOICE'; options: { en: string[]; ar: string[] } }
  > = {
    project_goal: {
      en: 'What is the main outcome you want from this project?',
      ar: 'ما النتيجة الرئيسية التي تريدها من هذا المشروع؟',
      answerType: 'FREE_TEXT',
      options: { en: [], ar: [] },
    },
    expected_behavior: {
      en: 'Should the system activate a water pump automatically or only alert the user?',
      ar: 'هل يجب أن يشغّل النظام مضخة الماء تلقائيًا أم يكتفي بتنبيه المستخدم؟',
      answerType: 'SINGLE_CHOICE',
      options: {
        en: ['Automatic pump', 'Alert only', 'Both pump and alert'],
        ar: ['مضخة تلقائية', 'تنبيه فقط', 'مضخة وتنبيه معًا'],
      },
    },
    target_user: {
      en: 'Who will primarily use or benefit from this project?',
      ar: 'من سيستخدم أو يستفيد من هذا المشروع بشكل أساسي؟',
      answerType: 'FREE_TEXT',
      options: { en: [], ar: [] },
    },
    learner_skill_level: {
      en: 'What skill level should this project assume?',
      ar: 'ما مستوى المهارة الذي يفترضه هذا المشروع؟',
      answerType: 'SINGLE_CHOICE',
      options: {
        en: ['Beginner', 'Intermediate', 'Advanced'],
        ar: ['مبتدئ', 'متوسط', 'متقدم'],
      },
    },
    available_materials: {
      en: 'Which materials do you already have available for this build?',
      ar: 'ما المواد المتوفرة لديك لهذا المشروع؟',
      answerType: 'MULTI_CHOICE',
      options: {
        en: ['Arduino board', 'Sensors', 'Pump or valve', 'Recycled containers', 'Basic tools only'],
        ar: ['لوحة Arduino', 'حساسات', 'مضخة أو صمام', 'حاويات معاد تدويرها', 'أدوات أساسية فقط'],
      },
    },
    required_technology: {
      en: 'Which platform or technology do you want to base this on?',
      ar: 'ما المنصة أو التقنية التي تريد بناء المشروع عليها؟',
      answerType: 'SINGLE_CHOICE',
      options: {
        en: ['Arduino', 'ESP32', 'No microcontroller', 'Not sure yet'],
        ar: ['Arduino', 'ESP32', 'بدون متحكم', 'غير متأكد بعد'],
      },
    },
    power_source: {
      en: 'What power source do you plan to use?',
      ar: 'ما مصدر الطاقة الذي تخطط لاستخدامه؟',
      answerType: 'SINGLE_CHOICE',
      options: {
        en: ['USB power', 'Battery pack', 'Wall adapter', 'Solar panel'],
        ar: ['طاقة USB', 'بطارية', 'محول كهربائي', 'لوح شمسي'],
      },
    },
    project_scale: {
      en: 'How many plants or zones should the system support?',
      ar: 'كم عدد النباتات أو المناطق التي يجب أن يدعمها النظام؟',
      answerType: 'SINGLE_CHOICE',
      options: {
        en: ['1 plant', '2-3 plants', '4-6 plants', 'More than 6'],
        ar: ['نبات واحد', '2-3 نباتات', '4-6 نباتات', 'أكثر من 6'],
      },
    },
    budget: {
      en: 'What is your approximate budget for missing parts?',
      ar: 'ما ميزانيتك التقريبية للقطع الناقصة؟',
      answerType: 'SINGLE_CHOICE',
      options: {
        en: ['Very low', 'Moderate', 'Flexible'],
        ar: ['منخفضة جدًا', 'متوسطة', 'مرنة'],
      },
    },
    available_tools: {
      en: 'Which tools can you reliably access for this project?',
      ar: 'ما الأدوات المتاحة لديك لهذا المشروع؟',
      answerType: 'MULTI_CHOICE',
      options: {
        en: ['Soldering iron', 'Multimeter', 'Hot glue gun', 'Hand tools only'],
        ar: ['كاوية لحام', 'ملتيميتر', 'مسدس صمغ حراري', 'أدوات يدوية فقط'],
      },
    },
    estimated_time: {
      en: 'How much build time can you realistically spend?',
      ar: 'كم من وقت البناء يمكنك تخصيصه واقعيًا؟',
      answerType: 'SINGLE_CHOICE',
      options: {
        en: ['One weekend', '2-3 weeks', 'About a month'],
        ar: ['عطلة نهاية أسبوع', '2-3 أسابيع', 'حوالي شهر'],
      },
    },
    indoor_or_outdoor: {
      en: 'Will this project be used indoors or outdoors?',
      ar: 'هل سيُستخدم المشروع داخل المنزل أم خارجه؟',
      answerType: 'SINGLE_CHOICE',
      options: {
        en: ['Indoors', 'Outdoors', 'Both'],
        ar: ['داخلي', 'خارجي', 'كلاهما'],
      },
    },
    safety_constraints: {
      en: 'Are there water or electricity safety constraints we should respect?',
      ar: 'هل توجد قيود سلامة متعلقة بالماء أو الكهرباء يجب مراعاتها؟',
      answerType: 'FREE_TEXT',
      options: { en: [], ar: [] },
    },
    preferred_reused_materials: {
      en: 'Do you want to prioritize specific reused materials?',
      ar: 'هل تريد إعطاء أولوية لمواد معاد تدويرها محددة؟',
      answerType: 'FREE_TEXT',
      options: { en: [], ar: [] },
    },
    connectivity_or_control: {
      en: 'Do you need remote monitoring or app control?',
      ar: 'هل تحتاج إلى مراقبة عن بُعد أو تحكم عبر تطبيق؟',
      answerType: 'SINGLE_CHOICE',
      options: {
        en: ['No remote control', 'Local display only', 'Wi-Fi monitoring'],
        ar: ['بدون تحكم عن بُعد', 'شاشة محلية فقط', 'مراقبة عبر Wi-Fi'],
      },
    },
    success_criteria: {
      en: 'How will you know the project succeeded?',
      ar: 'كيف ستعرف أن المشروع نجح؟',
      answerType: 'FREE_TEXT',
      options: { en: [], ar: [] },
    },
  };

  const entry = questions[key];
  const options = locale === 'ar' ? entry.options.ar : entry.options.en;
  return {
    key,
    prompt: locale === 'ar' ? entry.ar : entry.en,
    answerType: entry.answerType,
    options,
  };
};

const buildKnownFacts = (
  input: AuthoringClarificationContext,
): AiProjectAuthoringClarificationBlock['knownFacts'] => {
  const facts: AiProjectAuthoringClarificationBlock['knownFacts'] = [
    {
      key: 'project_idea',
      label: input.locale === 'ar' ? 'فكرة المشروع' : 'Project idea',
      value: input.ideaText.slice(0, 500),
      source: 'IDEA',
    },
  ];

  if (input.projectTitle?.trim()) {
    facts.push({
      key: 'draft_title',
      label: input.locale === 'ar' ? 'عنوان المسودة' : 'Draft title',
      value: input.projectTitle.trim().slice(0, 200),
      source: 'DRAFT',
    });
  }

  if (input.difficulty) {
    facts.push({
      key: 'difficulty',
      label: input.locale === 'ar' ? 'مستوى الصعوبة' : 'Difficulty',
      value: input.difficulty,
      source: 'DRAFT',
    });
  }

  if (input.categoryName) {
    facts.push({
      key: 'category',
      label: input.locale === 'ar' ? 'التصنيف' : 'Category',
      value: input.categoryName.slice(0, 120),
      source: 'DRAFT',
    });
  }

  if (isElectronicsProject(input.ideaText)) {
    facts.push({
      key: 'domain',
      label: input.locale === 'ar' ? 'المجال' : 'Domain',
      value: input.locale === 'ar' ? 'إلكترونيات وتتحكم' : 'Electronics and control',
      source: 'IDEA',
    });
  }

  for (const key of input.answeredQuestionKeys) {
    if (key === 'expected_behavior') {
      facts.push({
        key: 'expected_behavior',
        label: input.locale === 'ar' ? 'السلوك المتوقع' : 'Expected behavior',
        value: input.locale === 'ar' ? 'تم توضيحه من إجابة المتعلم' : 'Clarified from learner answer',
        source: 'LEARNER_ANSWER',
      });
    }
  }

  return facts.slice(0, 20);
};

const selectNextTopic = (
  input: AuthoringClarificationContext,
): AuthoringTopicKey | null => {
  const corpus = [
    input.ideaText,
    input.projectDescription ?? '',
    input.projectShortDescription ?? '',
    input.currentAnswer ?? '',
  ].join(' ');

  const electronics = isElectronicsProject(corpus);
  const craft = isCraftProject(corpus);

  const priority: AuthoringTopicKey[] = electronics
    ? [
        'expected_behavior',
        'power_source',
        'project_scale',
        'safety_constraints',
        'available_tools',
        'connectivity_or_control',
        'success_criteria',
      ]
    : craft
      ? [
          'project_goal',
          'target_user',
          'preferred_reused_materials',
          'available_tools',
          'project_scale',
          'success_criteria',
        ]
      : [
          'project_goal',
          'learner_skill_level',
          'available_materials',
          'estimated_time',
          'success_criteria',
        ];

  for (const topic of priority) {
    if (input.answeredQuestionKeys.includes(topic)) {
      continue;
    }
    if (!electronics && ['power_source', 'connectivity_or_control', 'required_technology'].includes(topic)) {
      continue;
    }
    return topic;
  }

  return null;
};

const buildSummary = (input: AuthoringClarificationContext) => {
  if (input.locale === 'ar') {
    if (isElectronicsProject(input.ideaText)) {
      return 'أفهم أنك تريد مشروع تعليمي في الإلكترونيات والتحكم، مع تركيز على فكرة المشروع الحالية والمسودة المرتبطة بها.';
    }
    return 'أفهم فكرة مشروعك الحالية وسياق المسودة، وسأطرح سؤالًا واحدًا فقط لتوضيح النقطة الأهم التالية.';
  }

  if (isElectronicsProject(input.ideaText)) {
    return 'I understand you want a practical electronics learning project based on your saved idea and draft context.';
  }

  return 'I understand your saved project idea and draft context, and I will ask one high-impact clarification at a time.';
};

const mockGenerateAuthoringClarification = (
  input: AuthoringClarificationContext,
): AuthoringClarificationProviderResult => {
  clarificationCallCountForTests += 1;
  const start = Date.now();

  if (input.ideaText.includes('__MOCK_INVALID_CLARIFICATION__')) {
    return {
      provider: 'mock',
      model: 'mock-authoring-clarification',
      data: {
        assistantText: 'invalid',
        clarification: {
          type: 'project_authoring_clarification',
          status: 'NEEDS_CLARIFICATION',
          summary: 'x',
          knownFacts: [],
          nextQuestion: {
            key: 'bad',
            prompt: '',
            answerType: 'SINGLE_CHOICE',
            options: ['only-one'],
          },
          remainingTopics: 1,
          assumptions: [],
          warnings: [],
        },
      },
      usage: { inputTokens: 40, outputTokens: 60 },
      latencyMs: Date.now() - start,
    };
  }

  if (input.ideaText.includes('__MOCK_PROVIDER_THROW__')) {
    throw new Error('mock provider failure');
  }

  const forceReady =
    isDetailedIdea(input.ideaText) ||
    input.answeredQuestionCount >= MAX_AUTHORING_CLARIFICATION_QUESTIONS;

  const nextTopic = forceReady ? null : selectNextTopic(input);
  const knownFacts = buildKnownFacts(input);
  const assumptions: string[] = [];
  const warnings: string[] = [];

  if (input.repairAttempt) {
    warnings.push(
      input.locale === 'ar'
        ? 'تم تجنب تكرار سؤال سابق، لذلك أصبحت الفكرة جاهزة للمسودة المنظمة.'
        : 'A repeated clarification question was avoided, so the idea is ready for structured draft generation.',
    );
  }

  if (forceReady && !isDetailedIdea(input.ideaText) && input.answeredQuestionCount >= MAX_AUTHORING_CLARIFICATION_QUESTIONS) {
    assumptions.push(
      input.locale === 'ar'
        ? 'قد تبقى بعض التفاصيل غير مؤكدة بعد أربعة أسئلة توضيحية.'
        : 'Some details may remain uncertain after four clarification questions.',
    );
  }

  const clarification: AiProjectAuthoringClarificationBlock = {
    type: 'project_authoring_clarification',
    status: nextTopic ? 'NEEDS_CLARIFICATION' : 'READY_FOR_PROPOSAL',
    summary: buildSummary(input),
    knownFacts,
    nextQuestion: nextTopic ? topicQuestion(nextTopic, input.locale) : null,
    remainingTopics: nextTopic ? Math.max(0, MAX_AUTHORING_CLARIFICATION_QUESTIONS - input.answeredQuestionCount - 1) : 0,
    assumptions,
    warnings,
  };

  const assistantText =
    clarification.status === 'READY_FOR_PROPOSAL'
      ? input.locale === 'ar'
        ? 'أصبحت فكرة مشروعك واضحة بما يكفي لإنشاء مسودة منظمة.'
        : 'Your project idea has enough detail to generate a structured draft.'
      : clarification.nextQuestion?.prompt ??
        (input.locale === 'ar'
          ? 'لنكمل توضيح فكرة المشروع.'
          : 'Let us continue clarifying your project idea.');

  const parsed = aiAuthoringClarificationProviderSchema.parse({
    clarification,
    assistantText,
  });

  return {
    provider: 'mock',
    model: 'mock-authoring-clarification',
    data: parsed,
    usage: { inputTokens: 80, outputTokens: 120 },
    latencyMs: Math.max(1, Date.now() - start),
  };
};

export const generateAuthoringClarification = async (
  input: AuthoringClarificationContext,
): Promise<AuthoringClarificationProviderResult> => {
  if (generatorOverride) {
    lastGeneratorRoute = 'override';
    return generatorOverride(input);
  }

  const resolvedProvider = resolveAiChatProvider();

  if (resolvedProvider === 'mock') {
    lastGeneratorRoute = 'mock';
    return mockGenerateAuthoringClarification(input);
  }

  if (resolvedProvider === 'openai') {
    lastGeneratorRoute = 'openai';
    return generateRealAuthoringClarification(input, 'openai');
  }

  if (resolvedProvider === 'gemini') {
    lastGeneratorRoute = 'gemini';
    return generateRealAuthoringClarification(input, 'gemini');
  }

  lastGeneratorRoute = 'disabled';
  throw new AppError(
    input.locale === 'ar'
      ? 'مساعد الذكاء الاصطناعي غير متاح حاليًا.'
      : 'The AI assistant is currently unavailable.',
    503,
    'AI_DISABLED',
  );
};

export const normalizeQuestionPrompt = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const hashAuthoringSeed = (value: string) =>
  createHash('sha256').update(value).digest('hex').slice(0, 12);

export type AuthoringProjectDomain = 'electronics' | 'craft' | 'general';

export type AuthoringTopicContext = {
  ideaText: string;
  projectTitle: string | null;
  projectShortDescription: string | null;
  projectDescription: string | null;
  categoryName: string | null;
  difficulty: string | null;
  answeredQuestionKeys: string[];
  answeredQuestionCount: number;
};

export type AuthoringTopicState = {
  domain: AuthoringProjectDomain;
  satisfiedTopics: AuthoringTopicKey[];
  unresolvedTopics: AuthoringTopicKey[];
  answeredTopics: AuthoringTopicKey[];
};

export type AuthoringReadinessResult = {
  ready: boolean;
  reasons: string[];
};

export type AuthoringValidationStage =
  | 'json_extraction'
  | 'provider_schema'
  | 'content_block_schema'
  | 'server_policy';

export type AuthoringValidationDiagnostic = {
  provider: string;
  attempt: number;
  stage: AuthoringValidationStage;
  issues: Array<{ path: string; code: string; message: string }>;
  policyReason?: string;
};

let lastDiagnosticForTests: AuthoringValidationDiagnostic | null = null;

export const getLastAuthoringValidationDiagnosticForTests = () =>
  lastDiagnosticForTests;

export const resetAuthoringValidationDiagnosticForTests = () => {
  lastDiagnosticForTests = null;
};

const TOPICS_ELECTRONICS_HINT =
  /(\barduino\b|\besp32\b|\besp8266\b|\bsensor\b|\bpump\b|\brelay\b|\bcircuit\b|\bmicrocontroller\b|\belectronics?\b|\bmoisture\b|\bled\b|\bحساس\b|\bمضخة\b|\bاردوينو\b|\bالكترون\b)/iu;

const TOPICS_CRAFT_HINT =
  /(cardboard|recycled|paper|organizer|wood|fabric|craft|desk organizer|كرتون|ورق|منظم|خشب|اعادة استخدام)/iu;

const corpusFrom = (input: AuthoringTopicContext) =>
  [
    input.ideaText,
    input.projectTitle ?? '',
    input.projectShortDescription ?? '',
    input.projectDescription ?? '',
    input.categoryName ?? '',
  ].join(' ');

export const detectAuthoringProjectDomain = (
  input: AuthoringTopicContext,
): AuthoringProjectDomain => {
  const text = corpusFrom(input);
  if (TOPICS_ELECTRONICS_HINT.test(text)) {
    return 'electronics';
  }
  if (TOPICS_CRAFT_HINT.test(text)) {
    return 'craft';
  }
  return 'general';
};

const ALL_TOPICS: AuthoringTopicKey[] = [
  'project_goal',
  'expected_behavior',
  'target_user',
  'learner_skill_level',
  'available_materials',
  'required_technology',
  'power_source',
  'project_scale',
  'budget',
  'available_tools',
  'estimated_time',
  'indoor_or_outdoor',
  'safety_constraints',
  'preferred_reused_materials',
  'connectivity_or_control',
  'success_criteria',
];

const ELECTRONICS_ONLY_TOPICS: AuthoringTopicKey[] = [
  'power_source',
  'connectivity_or_control',
  'required_technology',
  'safety_constraints',
];

const CRAFT_PRIORITY_TOPICS: AuthoringTopicKey[] = [
  'project_goal',
  'project_scale',
  'target_user',
  'available_tools',
  'preferred_reused_materials',
  'success_criteria',
];

const ELECTRONICS_PRIORITY_TOPICS: AuthoringTopicKey[] = [
  'expected_behavior',
  'power_source',
  'project_scale',
  'safety_constraints',
  'available_tools',
  'connectivity_or_control',
  'success_criteria',
];

export const isTopicRelevantForDomain = (
  topic: AuthoringTopicKey,
  domain: AuthoringProjectDomain,
): boolean => {
  if (domain === 'electronics') {
    return true;
  }

  if (domain === 'craft') {
    return !ELECTRONICS_ONLY_TOPICS.includes(topic);
  }

  return !['connectivity_or_control'].includes(topic);
};

const matchesAny = (text: string, patterns: RegExp[]) =>
  patterns.some((pattern) => pattern.test(text));

const satisfiedTopicDetectors: Record<
  AuthoringTopicKey,
  (text: string, input: AuthoringTopicContext) => boolean
> = {
  project_goal: (text) =>
    matchesAny(text, [
      /\b(build|make|create|design|organize|water|monitor|alert)\b/iu,
      /\b(أريد|بدي|بناء|تصميم|عمل)\b/u,
    ]),
  expected_behavior: (text) =>
    matchesAny(text, [
      /\b(alert only|notify|notification|led only|without a pump|no pump|without pump|pump automatically|automatic pump|تنبيه فقط|بدون مضخة)\b/iu,
    ]),
  target_user: (text) =>
    matchesAny(text, [
      /\b(for (kids|students|classroom|home|beginners)|classroom|learner)\b/iu,
      /\b(للطلاب|للمنزل|للمبتدئين)\b/u,
    ]),
  learner_skill_level: (_text, input) =>
    Boolean(
      input.difficulty &&
        ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(input.difficulty),
    ),
  available_materials: (text) =>
    matchesAny(text, [
      /\b(already have|available materials|cardboard|recycled|arduino board|sensor)\b/iu,
    ]),
  required_technology: (text) =>
    matchesAny(text, [
      /\b(arduino|esp32|esp8266|microcontroller|moisture sensor)\b/iu,
      /\b(اردوينو)\b/u,
    ]),
  power_source: (text) =>
    matchesAny(text, [
      /\b(usb[- ]?powered|usb power|battery|solar|wall adapter|plug[- ]?in)\b/iu,
      /\b(طاقة usb|بطارية)\b/iu,
    ]),
  project_scale: (text) =>
    matchesAny(text, [
      /\b(one plant|1 plant|single plant|one indoor|for one|one zone|desk organizer)\b/iu,
      /\b(نبات واحد|لنبات واحد)\b/u,
    ]),
  budget: (text) =>
    matchesAny(text, [
      /\b(under\s+\d+|below\s+\d+|\d+\s*nis|\d+\s*usd|budget|low cost)\b/iu,
      /\b(ميزانية|أقل من)\b/u,
    ]),
  available_tools: (text) =>
    matchesAny(text, [
      /\b(hot glue|scissors|soldering|hand tools|craft knife)\b/iu,
    ]),
  estimated_time: (text) =>
    matchesAny(text, [
      /\b(one weekend|few hours|2-3 weeks|about a month)\b/iu,
    ]),
  indoor_or_outdoor: (text) =>
    matchesAny(text, [
      /\b(indoor|outdoor|inside the home|outdoors)\b/iu,
      /\b(داخلي|خارجي)\b/u,
    ]),
  safety_constraints: (text) =>
    matchesAny(text, [
      /\b(waterproof|water safe|electricity safe|safety|عزل|سلامة)\b/iu,
    ]),
  preferred_reused_materials: (text) =>
    matchesAny(text, [
      /\b(recycled|cardboard|reused|upcycle|معاد تدوير|كرتون)\b/iu,
    ]),
  connectivity_or_control: (text) =>
    matchesAny(text, [
      /\b(wi[- ]?fi|bluetooth|remote|app control|monitoring)\b/iu,
    ]),
  success_criteria: (text) =>
    matchesAny(text, [
      /\b(know it succeeded|success when|alert when|notify when)\b/iu,
    ]),
};

export const computeAuthoringTopicState = (
  input: AuthoringTopicContext,
): AuthoringTopicState => {
  const domain = detectAuthoringProjectDomain(input);
  const text = corpusFrom(input).toLowerCase();

  const answeredTopics = input.answeredQuestionKeys.filter((key): key is AuthoringTopicKey =>
    ALL_TOPICS.includes(key as AuthoringTopicKey),
  );

  const satisfiedTopics = ALL_TOPICS.filter((topic) => {
    if (answeredTopics.includes(topic)) {
      return true;
    }
    if (!isTopicRelevantForDomain(topic, domain)) {
      return true;
    }
    return satisfiedTopicDetectors[topic](text, input);
  });

  const unresolvedTopics = ALL_TOPICS.filter(
    (topic) =>
      isTopicRelevantForDomain(topic, domain) &&
      !satisfiedTopics.includes(topic) &&
      !answeredTopics.includes(topic),
  );

  const priority =
    domain === 'craft'
      ? CRAFT_PRIORITY_TOPICS
      : domain === 'electronics'
        ? ELECTRONICS_PRIORITY_TOPICS
        : ALL_TOPICS;

  const orderedUnresolved = [
    ...priority.filter((topic) => unresolvedTopics.includes(topic)),
    ...unresolvedTopics.filter((topic) => !priority.includes(topic)),
  ];

  return {
    domain,
    satisfiedTopics,
    unresolvedTopics: orderedUnresolved,
    answeredTopics,
  };
};

export const evaluateAuthoringReadiness = (
  input: AuthoringTopicContext,
  topicState: AuthoringTopicState,
): AuthoringReadinessResult => {
  const reasons: string[] = [];

  if (input.answeredQuestionCount >= MAX_AUTHORING_CLARIFICATION_QUESTIONS) {
    reasons.push('question_limit_reached');
    return { ready: true, reasons };
  }

  const text = corpusFrom(input).toLowerCase();
  const hasDifficulty = satisfiedTopicDetectors.learner_skill_level(text, input);
  const hasGoal = satisfiedTopicDetectors.project_goal(text, input);
  const domainKnown = topicState.domain !== 'general' || hasGoal;

  if (topicState.domain === 'electronics') {
    const behaviorKnown = satisfiedTopicDetectors.expected_behavior(text, input);
    const powerKnown = satisfiedTopicDetectors.power_source(text, input);
    const techKnown = satisfiedTopicDetectors.required_technology(text, input);
    const scaleKnown = satisfiedTopicDetectors.project_scale(text, input);

    const detailSignals = [behaviorKnown, powerKnown, techKnown, scaleKnown, hasDifficulty].filter(
      Boolean,
    ).length;

    if (detailSignals >= 4 && hasGoal) {
      reasons.push('detailed_electronics_idea');
      return { ready: true, reasons };
    }

    if (
      behaviorKnown &&
      powerKnown &&
      techKnown &&
      scaleKnown &&
      hasDifficulty &&
      hasGoal
    ) {
      reasons.push('core_electronics_topics_satisfied');
      return { ready: true, reasons };
    }
  }

  if (topicState.domain === 'craft') {
    const materialsKnown = satisfiedTopicDetectors.preferred_reused_materials(text, input);
    const scaleKnown = satisfiedTopicDetectors.project_scale(text, input);
    if (hasGoal && (materialsKnown || scaleKnown)) {
      reasons.push('craft_goal_and_scope_known');
      return { ready: true, reasons };
    }
  }

  if (topicState.unresolvedTopics.length === 0 && domainKnown && hasDifficulty) {
    reasons.push('no_unresolved_topics');
    return { ready: true, reasons };
  }

  return { ready: false, reasons };
};

const STATUS_VALUES = ['NEEDS_CLARIFICATION', 'READY_FOR_PROPOSAL'] as const;
const ANSWER_TYPES = ['FREE_TEXT', 'SINGLE_CHOICE', 'MULTI_CHOICE'] as const;

const normalizeEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const upper = value.trim().toUpperCase().replace(/\s+/g, '_');
  const match = allowed.find((entry) => entry === upper);
  return match;
};

const uniqueTrimmedStrings = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

export const normalizeAuthoringProviderPayload = (
  raw: unknown,
): unknown => {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }

  const payload = raw as Record<string, unknown>;
  const assistantText =
    typeof payload.assistantText === 'string' ? payload.assistantText.trim() : payload.assistantText;

  const clarificationRaw = payload.clarification;
  if (!clarificationRaw || typeof clarificationRaw !== 'object') {
    return { ...payload, assistantText };
  }

  const clarification = clarificationRaw as Record<string, unknown>;
  const status = normalizeEnum(clarification.status, STATUS_VALUES) ?? clarification.status;
  const nextQuestionRaw = clarification.nextQuestion;

  let nextQuestion = nextQuestionRaw;
  if (nextQuestionRaw && typeof nextQuestionRaw === 'object') {
    const question = nextQuestionRaw as Record<string, unknown>;
    const answerType =
      normalizeEnum(question.answerType, ANSWER_TYPES) ?? question.answerType;
    const options = uniqueTrimmedStrings(
      Array.isArray(question.options) ? question.options : [],
    );
    nextQuestion = {
      ...question,
      key: typeof question.key === 'string' ? question.key.trim() : question.key,
      prompt: typeof question.prompt === 'string' ? question.prompt.trim() : question.prompt,
      answerType,
      options: answerType === 'FREE_TEXT' ? [] : options,
    };
  }

  return {
    assistantText,
    clarification: {
      ...clarification,
      type: 'project_authoring_clarification',
      status,
      summary:
        typeof clarification.summary === 'string'
          ? clarification.summary.trim()
          : clarification.summary,
      assumptions: uniqueTrimmedStrings(
        Array.isArray(clarification.assumptions) ? clarification.assumptions : [],
      ),
      warnings: uniqueTrimmedStrings(
        Array.isArray(clarification.warnings) ? clarification.warnings : [],
      ),
      nextQuestion,
    },
  };
};

const zodIssues = (error: ZodError) =>
  error.issues.map((issue: ZodIssue) => ({
    path: issue.path.join('.') || '(root)',
    code: issue.code,
    message: issue.message,
  }));

export const recordAuthoringValidationDiagnostic = (
  diagnostic: AuthoringValidationDiagnostic,
) => {
  lastDiagnosticForTests = diagnostic;
  if ((process.env.NODE_ENV ?? 'development') !== 'production') {
    logger.debug(
      {
        provider: diagnostic.provider,
        attempt: diagnostic.attempt,
        stage: diagnostic.stage,
        issueCount: diagnostic.issues.length,
        policyReason: diagnostic.policyReason ?? null,
        issues: diagnostic.issues.slice(0, 8),
      },
      'Authoring clarification validation diagnostic',
    );
  }
};

export const parseAuthoringProviderPayload = (input: {
  raw: unknown;
  provider: string;
  attempt: number;
}) => {
  try {
    const normalized = normalizeAuthoringProviderPayload(input.raw);
    return aiAuthoringClarificationProviderSchema.parse(normalized);
  } catch (error) {
    if (error instanceof ZodError) {
      recordAuthoringValidationDiagnostic({
        provider: input.provider,
        attempt: input.attempt,
        stage: 'provider_schema',
        issues: zodIssues(error),
      });
    }
    throw error;
  }
};

export type AuthoringPolicyValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'repeated_key'
        | 'repeated_prompt'
        | 'satisfied_topic'
        | 'irrelevant_topic'
        | 'unsupported_topic'
        | 'status_question_mismatch';
      repairIssue: string;
    };

export const validateAuthoringClarificationPolicy = (input: {
  clarification: AiProjectAuthoringClarificationBlock;
  answeredQuestionKeys: string[];
  previousPrompts: string[];
  topicState: AuthoringTopicState;
  remainingQuestionBudget: number;
  normalizeQuestionPrompt: (value: string) => string;
}): AuthoringPolicyValidationResult => {
  const { clarification, topicState } = input;

  if (clarification.status === 'READY_FOR_PROPOSAL' && clarification.nextQuestion) {
    return {
      ok: false,
      reason: 'status_question_mismatch',
      repairIssue:
        'READY_FOR_PROPOSAL requires nextQuestion to be null. Remove the question or change status to NEEDS_CLARIFICATION.',
    };
  }

  if (clarification.status === 'NEEDS_CLARIFICATION' && !clarification.nextQuestion) {
    return {
      ok: false,
      reason: 'status_question_mismatch',
      repairIssue:
        'NEEDS_CLARIFICATION requires exactly one nextQuestion object with a valid key and prompt.',
    };
  }

  if (!clarification.nextQuestion) {
    return { ok: true };
  }

  const questionKey = clarification.nextQuestion.key as AuthoringTopicKey;

  if (input.answeredQuestionKeys.includes(questionKey)) {
    return {
      ok: false,
      reason: 'repeated_key',
      repairIssue: `Question key "${questionKey}" was already answered. Choose a different unresolved topic.`,
    };
  }

  const normalized = input.normalizeQuestionPrompt(clarification.nextQuestion.prompt);
  if (
    input.previousPrompts.some(
      (prompt) => input.normalizeQuestionPrompt(prompt) === normalized,
    )
  ) {
    return {
      ok: false,
      reason: 'repeated_prompt',
      repairIssue:
        'The question prompt repeats a previous clarification question. Ask a new unresolved topic instead.',
    };
  }

  if (!ALL_TOPICS.includes(questionKey)) {
    return {
      ok: false,
      reason: 'unsupported_topic',
      repairIssue: `Question key "${questionKey}" is not supported. Use only allowed unresolved topic keys.`,
    };
  }

  if (!isTopicRelevantForDomain(questionKey, topicState.domain)) {
    return {
      ok: false,
      reason: 'irrelevant_topic',
      repairIssue: `Question key "${questionKey}" is not relevant for a ${topicState.domain} project. Choose a craft-appropriate unresolved topic.`,
    };
  }

  if (topicState.satisfiedTopics.includes(questionKey)) {
    return {
      ok: false,
      reason: 'satisfied_topic',
      repairIssue: `Question key "${questionKey}" is already satisfied by the idea or draft context. Choose another unresolved topic or return READY_FOR_PROPOSAL.`,
    };
  }

  if (!topicState.unresolvedTopics.includes(questionKey)) {
    return {
      ok: false,
      reason: 'unsupported_topic',
      repairIssue: `Question key "${questionKey}" is not in the unresolved topic list. Allowed unresolved keys: ${topicState.unresolvedTopics.join(', ') || '(none)'}.`,
    };
  }

  if (input.remainingQuestionBudget <= 0) {
    return {
      ok: false,
      reason: 'status_question_mismatch',
      repairIssue:
        'No clarification question budget remains. Return READY_FOR_PROPOSAL with nextQuestion null.',
    };
  }

  return { ok: true };
};

export const buildAuthoringRepairIssue = (input: {
  policy: AuthoringPolicyValidationResult & { ok: false };
  unresolvedTopics: AuthoringTopicKey[];
  remainingQuestionBudget: number;
}) =>
  [
    input.policy.repairIssue,
    `Allowed unresolved topic keys: ${input.unresolvedTopics.join(', ') || '(none)'}.`,
    `Remaining question budget: ${input.remainingQuestionBudget}.`,
    'Return strict JSON with clarification and assistantText only.',
  ].join(' ');

export const buildDeterministicReadyClarification = (input: {
  locale: 'en' | 'ar';
  topicState: AuthoringTopicState;
  latest: AiProjectAuthoringClarificationBlock | null;
  reasons: string[];
}): AiProjectAuthoringClarificationBlock => ({
  type: 'project_authoring_clarification',
  status: 'READY_FOR_PROPOSAL',
  summary:
    input.latest?.summary ??
    (input.locale === 'ar'
      ? 'أصبحت فكرة مشروعك واضحة بما يكفي لإنشاء مسودة منظمة.'
      : 'Your project idea has enough detail to generate a structured draft.'),
  knownFacts: input.latest?.knownFacts ?? [],
  nextQuestion: null,
  remainingTopics: 0,
  assumptions: input.latest?.assumptions ?? [],
  warnings: [
    ...(input.latest?.warnings ?? []),
    input.locale === 'ar'
      ? 'اكتملت معلومات التوضيح الأساسية.'
      : 'Core clarification information is complete.',
  ].slice(0, 10),
});

export const parseAuthoringClarificationBlock = (input: {
  clarification: unknown;
  provider: string;
  attempt: number;
}) => {
  try {
    return aiProjectAuthoringClarificationBlockSchema.parse(input.clarification);
  } catch (error) {
    if (error instanceof ZodError) {
      recordAuthoringValidationDiagnostic({
        provider: input.provider,
        attempt: input.attempt,
        stage: 'content_block_schema',
        issues: zodIssues(error),
      });
    }
    throw error;
  }
};
