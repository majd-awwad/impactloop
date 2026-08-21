import { ZodError, type ZodIssue } from 'zod';

import { logger } from '../../observability/logger.js';

import { aiAuthoringClarificationProviderSchema } from './ai.content-blocks.js';

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

export const MAX_AUTHORING_CLARIFICATION_QUESTIONS = 4;

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
  issues: Array<{
    path: string;
    code: string;
    message: string;
    expected?: string | null;
    received?: string;
  }>;
  policyReason?: string;
};

export type AuthoringProviderSchemaIssue = {
  path: string;
  expected: string | null;
  received: string;
  code: string;
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

export const ALL_TOPICS: AuthoringTopicKey[] = [
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

const zodIssues = (error: ZodError) => {
  const safeIssues = getAuthoringProviderSchemaIssues(error);
  return error.issues.map((issue: ZodIssue, index) => ({
    path: issue.path.join('.') || '(root)',
    code: issue.code,
    message: issue.message,
    expected: safeIssues[index]?.expected ?? null,
    received: safeIssues[index]?.received ?? 'unknown',
  }));
};

const valueCategory = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
};

const receivedCategoryFromIssue = (
  issue: ZodIssue,
  raw: Record<string, unknown>,
  response: unknown,
): string => {
  if (Object.prototype.hasOwnProperty.call(raw, 'input')) {
    return valueCategory(raw.input);
  }

  let valueAtPath = response;
  for (const pathSegment of issue.path) {
    if (
      valueAtPath == null ||
      (typeof valueAtPath !== 'object' && !Array.isArray(valueAtPath))
    ) {
      valueAtPath = undefined;
      break;
    }
    valueAtPath = (valueAtPath as Record<string | number, unknown>)[pathSegment];
  }
  if (valueAtPath !== undefined) {
    return valueCategory(valueAtPath);
  }

  const received = issue.message.match(/received ([^,]+)$/i)?.[1]?.trim();
  return received || 'unknown';
};

export const getAuthoringProviderSchemaIssues = (
  error: ZodError,
  response?: unknown,
): AuthoringProviderSchemaIssue[] =>
  error.issues.map((issue) => {
    const raw = issue as unknown as Record<string, unknown>;
    const values = Array.isArray(raw.values)
      ? raw.values.filter((value): value is string => typeof value === 'string')
      : [];
    const expected = typeof raw.expected === 'string'
      ? raw.expected
      : values.length > 0
        ? values.join(' | ')
        : null;

    return {
      path: issue.path.join('.') || '(root)',
      expected,
      received: receivedCategoryFromIssue(issue, raw, response),
      code: issue.code,
    };
  });

export const formatAuthoringProviderSchemaRepairIssue = (
  issues: unknown,
): string | null => {
  if (!Array.isArray(issues) || issues.length === 0) {
    return null;
  }

  const rendered = issues.slice(0, 8).flatMap((issue) => {
    if (!issue || typeof issue !== 'object') {
      return [];
    }
    const value = issue as Record<string, unknown>;
    return typeof value.path === 'string'
      ? [`${value.path}: expected ${typeof value.expected === 'string' ? value.expected : 'the required schema type'}, received ${typeof value.received === 'string' ? value.received : 'an invalid value'} (${typeof value.code === 'string' ? value.code : 'validation_error'}).`]
      : [];
  });

  return rendered.length > 0
    ? `Fix these exact validation errors. ${rendered.join(' ')}`
    : null;
};

export const recordAuthoringValidationDiagnostic = (
  diagnostic: AuthoringValidationDiagnostic,
) => {
  lastDiagnosticForTests = diagnostic;
  if ((process.env.NODE_ENV ?? 'development') === 'development') {
    const providerSchemaIssues = diagnostic.stage === 'provider_schema'
      ? diagnostic.issues.slice(0, 12).map((issue) => ({
          path: issue.path,
          expected: issue.expected ?? null,
          received: issue.received ?? 'unknown',
          code: issue.code,
        }))
      : [];
    logger.debug(
      {
        provider: diagnostic.provider,
        attempt: diagnostic.attempt,
        stage: diagnostic.stage,
        issueCount: diagnostic.issues.length,
        policyReason: diagnostic.policyReason ?? null,
        providerSchemaIssues,
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
