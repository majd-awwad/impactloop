import { createHash } from 'node:crypto';

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { ZodError } from 'zod';

import {
  env,
  getAiChatRuntimeConfig,
  getConfiguredGeminiApiKey,
  getGeminiChatModelCandidates,
  resolveAiChatProvider,
} from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import { extractJsonObject } from '../../services/gemini-price-suggestion.provider.js';

import {
  LEARNER_SUBMIT_COMPONENT_ROLES,
  MAX_SUBMIT_COMPONENTS,
} from '../learning-projects/learning-projects.submit-components.js';

import {
  aiAuthoringProposalProviderSchema,
  type AiAuthoringProposalProviderResult,
  type AiProjectAuthoringClarificationBlock,
} from './ai.content-blocks.js';
import type { AiLocale } from './ai.types.js';
import {
  MIN_PROPOSAL_STEPS,
  parseAuthoringProposalProviderPayload,
  recordAuthoringProposalValidationDiagnostic,
} from './ai-project-authoring-proposal.policy.js';

export type AuthoringProposalContext = {
  locale: AiLocale;
  ideaText: string;
  projectTitle: string | null;
  projectShortDescription: string | null;
  projectDescription: string | null;
  categoryName: string | null;
  draftDifficulty: string | null;
  componentNames: string[];
  stepTitles: string[];
  baseUpdatedAt: string;
  clarification: AiProjectAuthoringClarificationBlock;
  clarificationMessageId: string;
  recentAuthoringAnswers: string[];
  repairAttempt: boolean;
  repairIssue?: string | null;
  previousInvalidOutput?: string | null;
};

export type AuthoringProposalProviderResult = {
  provider: string;
  model: string | null;
  data: AiAuthoringProposalProviderResult;
  usage: { inputTokens: number | null; outputTokens: number | null };
  latencyMs: number;
};

export type AuthoringProposalRoute =
  | 'override'
  | 'mock'
  | 'gemini'
  | 'openai'
  | 'disabled';

type ProposalGenerator = (
  input: AuthoringProposalContext,
) => AuthoringProposalProviderResult | Promise<AuthoringProposalProviderResult>;

let generatorOverride: ProposalGenerator | null = null;
let proposalCallCountForTests = 0;
let lastGeneratorRoute: AuthoringProposalRoute | null = null;

export const getLastAuthoringProposalRouteForTests = () => lastGeneratorRoute;
export const getAuthoringProposalCallCountForTests = () => proposalCallCountForTests;
export const resetAuthoringProposalCallCountForTests = () => {
  proposalCallCountForTests = 0;
};
export const setAuthoringProposalGeneratorForTests = (
  generator: ProposalGenerator | null,
) => {
  generatorOverride = generator;
};

const isElectronicsProject = (text: string) =>
  /\b(arduino|esp32|raspberry|sensor|led|usb|microcontroller|electronics|watering|soil)\b/i.test(
    text,
  );

const isCraftProject = (text: string) =>
  /\b(cardboard|paper|craft|organizer|recycl|glue|scissors)\b/i.test(text);

const hasNoPumpConstraint = (text: string) =>
  /\b(no pump|without (a )?pump|no water pump)\b/i.test(text);

const buildElectronicsProposal = (
  input: AuthoringProposalContext,
): AiAuthoringProposalProviderResult => {
  const noPump = hasNoPumpConstraint(input.ideaText);
  const usbPowered = /\busb\b/i.test(input.ideaText);

  return aiAuthoringProposalProviderSchema.parse({
    assistantText:
      input.locale === 'ar'
        ? 'إليك مسودة منظمة لمشروعك الإلكتروني التعليمي.'
        : 'Here is a structured draft for your electronics learning project.',
    project: {
      title:
        input.locale === 'ar'
          ? 'نظام تنبيه رطوبة التربة بالـ Arduino'
          : 'Arduino Soil Moisture Alert System',
      shortDescription:
        input.locale === 'ar'
          ? 'مشروع مبتدئ يقرأ رطوبة التربة ويشغّل تنبيه LED عند الجفاف.'
          : 'A beginner project that reads soil moisture and triggers an LED alert when dry.',
      description:
        input.locale === 'ar'
          ? 'يبني المتعلم دائرة بسيطة باستخدام Arduino ومستشعر رطوبة التربة وLED لمراقبة نبات واحد. يركز المشروع على القراءة والتنبيه المحلي دون ضخ مياه.'
          : 'The learner builds a simple Arduino circuit with a soil moisture sensor and LED to monitor one plant. The project focuses on sensing and local alerting without pumping water.',
      difficulty: input.draftDifficulty ?? 'BEGINNER',
      estimatedMinutes: 120,
    },
    requiredComponents: [
      {
        componentName: input.locale === 'ar' ? 'لوحة Arduino Uno' : 'Arduino Uno board',
        materialType: 'Microcontroller',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: ['Arduino', 'Uno'],
        alternativeKeywords: ['Arduino Nano'],
      },
      {
        componentName:
          input.locale === 'ar' ? 'مستشعر رطوبة التربة' : 'Soil moisture sensor',
        materialType: 'Sensor',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['soil', 'moisture', 'sensor'],
        alternativeKeywords: ['capacitive soil sensor'],
      },
      {
        componentName: input.locale === 'ar' ? 'LED أحمر' : 'Red LED',
        materialType: 'Electronic component',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['LED', 'indicator'],
        alternativeKeywords: ['5mm LED'],
      },
      {
        componentName: input.locale === 'ar' ? 'مقاومة 220 أوم' : '220 ohm resistor',
        materialType: 'Electronic component',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['resistor', '220'],
        alternativeKeywords: [],
      },
      {
        componentName:
          input.locale === 'ar' ? 'أسلاك توصيل' : 'Jumper wires',
        materialType: 'Accessory',
        quantity: 10,
        unit: 'piece',
        componentRole: 'CONSUMABLE',
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['jumper', 'wires'],
        alternativeKeywords: [],
      },
      {
        componentName: input.locale === 'ar' ? 'كاوية لحام' : 'Soldering iron',
        materialType: 'Tool',
        quantity: 1,
        unit: 'piece',
        componentRole: 'TOOL',
        isRequired: false,
        canBeSubstituted: true,
        searchKeywords: ['soldering'],
        alternativeKeywords: ['breadboard only'],
        notes:
          input.locale === 'ar'
            ? 'يمكن تجميع النموذج الأولي على لوحة تجارب بدون لحام.'
            : 'Prototype can be assembled on a breadboard without soldering.',
      },
    ].filter((component) => !(noPump && /pump/i.test(component.componentName))),
    steps: [
      {
        title: input.locale === 'ar' ? 'تجهيز المكونات' : 'Prepare the components',
        description:
          input.locale === 'ar'
            ? 'اجمع Arduino ومستشعر الرطوبة والـ LED والمقاومة وأسلاك التوصيل على سطح عمل نظيف.'
            : 'Gather the Arduino, soil moisture sensor, LED, resistor, and jumper wires on a clean workspace.',
      },
      {
        title: input.locale === 'ar' ? 'توصيل الدائرة' : 'Wire the circuit',
        description:
          input.locale === 'ar'
            ? 'وصّل مستشعر الرطوبة والـ LED إلى Arduino باستخدام المقاومة وأسلاك التوصيل حسب مخطط الدائرة البسيط.'
            : 'Connect the soil moisture sensor and LED to the Arduino using the resistor and jumper wires following a simple circuit diagram.',
      },
      {
        title:
          input.locale === 'ar'
            ? 'برمجة قراءة الرطوبة'
            : 'Program moisture readings',
        description:
          input.locale === 'ar'
            ? 'اكتب أو حمّل برنامجًا يقرأ قيمة الرطوبة ويحدد عتبة الجفاف لنبات واحد.'
            : 'Write or upload code that reads moisture values and sets a dry threshold for one plant.',
      },
      {
        title: input.locale === 'ar' ? 'اختبار التنبيه' : 'Test the alert',
        description:
          input.locale === 'ar'
            ? 'تحقق أن الـ LED يعمل عند انخفاض الرطوبة وأن القراءات مستقرة مع مصدر طاقة USB.'
            : usbPowered
              ? 'Verify the LED turns on when moisture is low and readings remain stable on USB power.'
              : 'Verify the LED turns on when moisture is low and readings remain stable.',
      },
    ],
    assumptions: input.clarification.assumptions,
    warnings: noPump
      ? [
          input.locale === 'ar'
            ? 'لا يتضمن المشروع مضخة مياه حسب قيدك.'
            : 'This project excludes a water pump per your constraint.',
        ]
      : [],
    safetyConsiderations: [
      input.locale === 'ar'
        ? 'استخدم مصدر طاقة USB مناسب وتجنب ملامسة الدائرة أثناء التشغيل.'
        : 'Use an appropriate USB power source and avoid touching the live circuit while powered.',
    ],
  });
};

const buildCraftProposal = (
  input: AuthoringProposalContext,
): AiAuthoringProposalProviderResult => {
  return aiAuthoringProposalProviderSchema.parse({
    assistantText:
      input.locale === 'ar'
        ? 'إليك مسودة منظمة لمشروع الحرف اليدوية.'
        : 'Here is a structured draft for your craft learning project.',
    project: {
      title:
        input.locale === 'ar'
          ? 'منظم مكتب من الكرتون المعاد التدوير'
          : 'Recycled Cardboard Desk Organizer',
      shortDescription:
        input.locale === 'ar'
          ? 'مشروع حرفي بسيط لصنع منظم مكتب من الكرتون المعاد التدوير.'
          : 'A simple craft project to build a desk organizer from recycled cardboard.',
      description:
        input.locale === 'ar'
          ? 'يقوم المتعلم بتصميم وتجميع حوامل متعددة من الكرتون لفرز الأقلام والأدوات الصغيرة باستخدام أدوات يدوية أساسية.'
          : 'The learner designs and assembles multi-compartment holders from cardboard to sort pens and small tools using basic hand tools.',
      difficulty: input.draftDifficulty ?? 'BEGINNER',
      estimatedMinutes: 90,
    },
    requiredComponents: [
      {
        componentName: input.locale === 'ar' ? 'كرتون معاد التدوير' : 'Recycled cardboard',
        materialType: 'Cardboard',
        quantity: 3,
        unit: 'sheet',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['cardboard', 'box'],
        alternativeKeywords: ['cereal box'],
      },
      {
        componentName: input.locale === 'ar' ? 'صمغ حراري' : 'Hot glue gun',
        materialType: 'Tool',
        quantity: 1,
        unit: 'piece',
        componentRole: 'TOOL',
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['glue gun'],
        alternativeKeywords: ['craft glue'],
      },
      {
        componentName: input.locale === 'ar' ? 'مقص' : 'Scissors',
        materialType: 'Tool',
        quantity: 1,
        unit: 'piece',
        componentRole: 'TOOL',
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: ['scissors'],
        alternativeKeywords: [],
      },
      {
        componentName: input.locale === 'ar' ? 'مسطرة' : 'Ruler',
        materialType: 'Tool',
        quantity: 1,
        unit: 'piece',
        componentRole: 'TOOL',
        isRequired: false,
        canBeSubstituted: true,
        searchKeywords: ['ruler'],
        alternativeKeywords: ['measuring tape'],
      },
    ],
    steps: [
      {
        title: input.locale === 'ar' ? 'قص القوالب' : 'Cut the templates',
        description:
          input.locale === 'ar'
            ? 'ارسم واقطع قطع الكرتون للحوامل والقاعدة حسب المقاس المطلوب.'
            : 'Draw and cut cardboard pieces for compartments and the base to the desired size.',
      },
      {
        title: input.locale === 'ar' ? 'تجميع الحوامل' : 'Assemble compartments',
        description:
          input.locale === 'ar'
            ? 'ثبّت جدران الحوامل باستخدام الصمغ الحراري مع مراعاة الاستقرار.'
            : 'Attach compartment walls with hot glue while keeping the structure stable.',
      },
      {
        title: input.locale === 'ar' ? 'تشطيب السطح' : 'Finish the surface',
        description:
          input.locale === 'ar'
            ? 'قم بإزالة الحواف البارزة واختبر أن المنظم يستوعب الأدوات المطلوبة.'
            : 'Trim rough edges and test that the organizer fits the intended tools.',
      },
    ],
    assumptions: input.clarification.assumptions,
    warnings: [],
    safetyConsiderations: [
      input.locale === 'ar'
        ? 'استخدم الصمغ الحراري بحذر وتجنب ملامسة الفوهة الساخنة.'
        : 'Use the hot glue gun carefully and avoid touching the hot nozzle.',
    ],
  });
};

const mockGenerateAuthoringProposal = (
  input: AuthoringProposalContext,
): AuthoringProposalProviderResult => {
  const startedAt = Date.now();

  if (input.ideaText.includes('__MOCK_INVALID_PROPOSAL__')) {
    return {
      provider: 'mock',
      model: 'mock-authoring-proposal',
      data: {
        assistantText: 'invalid',
        project: {
          title: 'x',
          shortDescription: 'short',
          description: 'desc',
          difficulty: 'BEGINNER',
        },
        requiredComponents: [],
        steps: [],
        assumptions: [],
        warnings: [],
        safetyConsiderations: [],
      },
      usage: { inputTokens: 40, outputTokens: 60 },
      latencyMs: Date.now() - startedAt,
    };
  }

  if (input.ideaText.includes('__MOCK_PROVIDER_THROW__')) {
    throw new Error('mock proposal provider failure');
  }

  const corpus = `${input.ideaText}\n${input.clarification.summary}`;
  const data = isCraftProject(corpus) && !isElectronicsProject(corpus)
    ? buildCraftProposal(input)
    : buildElectronicsProposal(input);

  return {
    provider: 'mock',
    model: 'mock-authoring-proposal',
    data,
    usage: { inputTokens: 120, outputTokens: 280 },
    latencyMs: Date.now() - startedAt,
  };
};

export const PROJECT_AUTHORING_PROPOSAL_SYSTEM_POLICY = [
  'You are ImpactLoop project authoring proposal assistant.',
  'Generate one complete structured learning project proposal from trusted authoring context.',
  'Use only supplied context. Do not mutate the saved draft or claim platform inventory availability.',
  'Do not include project IDs, category IDs, component IDs, step IDs, stepNumber, proposalId, or supplier/reservation data.',
  'Respect learner constraints such as no pump, USB-only power, budget limits, and available tools.',
  'Category is fixed by the learner; you may warn if the idea seems inconsistent but must not output categoryId.',
  'Component fields: componentName, materialType, quantity, unit, componentRole, isRequired, canBeSubstituted, searchKeywords, alternativeKeywords, notes.',
  `componentRole must be one of: ${LEARNER_SUBMIT_COMPONENT_ROLES.join(', ')}.`,
  'Step fields: title, description only. Provide ordered logical steps.',
  `Provide ${MIN_PROPOSAL_STEPS}-100 steps and 1-${MAX_SUBMIT_COMPONENTS} components with unique names.`,
  'Project fields: title, shortDescription, description, difficulty, estimatedMinutes.',
  'Difficulty must be BEGINNER, INTERMEDIATE, or ADVANCED.',
  'Include assumptions, warnings, and safetyConsiderations arrays (may be empty).',
  'Keep each step description concise (under 400 characters) so the full JSON fits in one response.',
  'Return one complete JSON object. Never truncate strings or leave JSON unfinished.',
  'Match response locale. Preserve mixed technical terms in Arabic naturally.',
  'Do not cite external sources or search the web.',
  'Return strict JSON only with keys: project, requiredComponents, steps, assumptions, warnings, safetyConsiderations, assistantText.',
  'Do not wrap JSON in markdown.',
].join('\n');

const AUTHORING_PROPOSAL_MAX_OUTPUT_TOKENS = 4096;

type RealProviderName = 'gemini' | 'openai';

type RealProposalInvoker = (input: {
  provider: RealProviderName;
  systemInstruction: string;
  userPrompt: string;
}) => Promise<{
  text: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}>;

let invokerOverride: RealProposalInvoker | null = null;
let invokerCallCountForTests = 0;

export const setAuthoringRealProposalInvokerForTests = (
  invoker: RealProposalInvoker | null,
) => {
  invokerOverride = invoker;
  invokerCallCountForTests = 0;
};

export const getAuthoringRealProposalInvokerCallCountForTests = () =>
  invokerCallCountForTests;

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new AppError(
              'The learning assistant timed out. Please try again.',
              504,
              'AI_PROVIDER_TIMEOUT',
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const mapOpenAiFailure = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError || error instanceof SyntaxError) {
    return new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
    );
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);
  if (message.includes('rate limit')) {
    return new AppError(
      'The learning assistant is temporarily busy. Please try again shortly.',
      429,
      'AI_PROVIDER_RATE_LIMITED',
    );
  }

  return new AppError(
    'The learning assistant is temporarily unavailable.',
    502,
    'AI_PROVIDER_ERROR',
  );
};

const mapGeminiFailure = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError || error instanceof SyntaxError) {
    return new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
    );
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);
  if (
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('resource exhausted')
  ) {
    return new AppError(
      'The learning assistant is temporarily busy. Please try again shortly.',
      429,
      'AI_PROVIDER_RATE_LIMITED',
    );
  }

  return new AppError(
    'The learning assistant is temporarily unavailable.',
    502,
    'AI_PROVIDER_ERROR',
  );
};

const readGeminiText = (response: { text?: string | null }) => {
  const text = response.text?.trim();
  if (!text) {
    throw new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
    );
  }
  return text;
};

const readOpenAiText = (response: OpenAI.Chat.Completions.ChatCompletion) => {
  const text = response.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
    );
  }
  return text;
};

const getGeminiClient = () => {
  const apiKey = getConfiguredGeminiApiKey();
  if (!apiKey) {
    throw new AppError(
      'The learning assistant is temporarily unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  return new GoogleGenAI({ apiKey });
};

const getOpenAiClient = (runtime: ReturnType<typeof getAiChatRuntimeConfig>) => {
  if (!runtime.openaiApiKey) {
    throw new AppError(
      'The learning assistant is temporarily unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  return new OpenAI({
    apiKey: runtime.openaiApiKey,
    baseURL: runtime.openaiBaseUrl ?? undefined,
    timeout: runtime.timeoutMs,
    defaultHeaders: runtime.isOpenRouter
      ? {
          'HTTP-Referer': env.appPublicBaseUrl || 'http://localhost:4000',
          'X-Title': 'ImpactLoop',
        }
      : undefined,
  });
};

const callGeminiStructured = async (
  systemInstruction: string,
  userPrompt: string,
) => {
  const startedAt = Date.now();
  const candidates = getGeminiChatModelCandidates();
  let lastError: unknown;
  const ai = getGeminiClient();

  for (const model of candidates) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            temperature: 0.2,
            maxOutputTokens: AUTHORING_PROPOSAL_MAX_OUTPUT_TOKENS,
            responseMimeType: 'application/json',
            systemInstruction,
          },
        }),
        env.aiChatTimeoutMs,
      );

      return {
        text: readGeminiText(response),
        model: response.modelVersion ?? model,
        inputTokens: response.usageMetadata?.promptTokenCount ?? null,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error);
      if (
        !message.includes('not found') &&
        !message.includes('no longer available')
      ) {
        throw mapGeminiFailure(error);
      }
    }
  }

  throw mapGeminiFailure(lastError);
};

const callOpenAiStructured = async (
  systemInstruction: string,
  userPrompt: string,
) => {
  const startedAt = Date.now();
  const runtime = getAiChatRuntimeConfig();
  const client = getOpenAiClient(runtime);

  try {
    const response = await withTimeout(
      client.chat.completions.create({
        model: runtime.model,
        temperature: 0.2,
        max_tokens: AUTHORING_PROPOSAL_MAX_OUTPUT_TOKENS,
        ...(runtime.openaiJsonMode
          ? { response_format: { type: 'json_object' as const } }
          : {}),
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
      }),
      runtime.timeoutMs,
    );

    return {
      text: readOpenAiText(response),
      model: response.model ?? runtime.model,
      inputTokens: response.usage?.prompt_tokens ?? null,
      outputTokens: response.usage?.completion_tokens ?? null,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    throw mapOpenAiFailure(error);
  }
};

const invokeRealProvider = async (
  provider: RealProviderName,
  systemInstruction: string,
  userPrompt: string,
) => {
  if (invokerOverride) {
    invokerCallCountForTests += 1;
    const response = await invokerOverride({
      provider,
      systemInstruction,
      userPrompt,
    });
    return {
      ...response,
      latencyMs: 1,
    };
  }

  if (provider === 'openai') {
    return callOpenAiStructured(systemInstruction, userPrompt);
  }

  return callGeminiStructured(systemInstruction, userPrompt);
};

export const buildAuthoringProposalPrompt = (input: AuthoringProposalContext) => {
  const payload = {
    locale: input.locale,
    ideaText: input.ideaText,
    draft: {
      title: input.projectTitle,
      shortDescription: input.projectShortDescription,
      description: input.projectDescription,
      categoryDisplayName: input.categoryName,
      difficulty: input.draftDifficulty,
      componentNames: input.componentNames,
      stepTitles: input.stepTitles,
      baseUpdatedAt: input.baseUpdatedAt,
    },
    clarification: {
      summary: input.clarification.summary,
      knownFacts: input.clarification.knownFacts,
      assumptions: input.clarification.assumptions,
      warnings: input.clarification.warnings,
      status: input.clarification.status,
      messageBasisId: input.clarificationMessageId,
    },
    recentAuthoringAnswers: input.recentAuthoringAnswers,
    repairAttempt: input.repairAttempt,
    repairIssue: input.repairIssue ?? null,
    previousInvalidOutput: input.previousInvalidOutput ?? null,
    requiredOutputShape: {
      project: {
        title: 'string',
        shortDescription: 'string',
        description: 'string',
        difficulty: 'BEGINNER | INTERMEDIATE | ADVANCED',
        estimatedMinutes: 'optional positive integer',
      },
      requiredComponents: [
        {
          componentName: 'string',
          materialType: 'string',
          quantity: 'positive number',
          unit: 'string',
          componentRole: LEARNER_SUBMIT_COMPONENT_ROLES.join(' | '),
          isRequired: 'boolean',
          canBeSubstituted: 'boolean',
          searchKeywords: ['string'],
          alternativeKeywords: ['string'],
          notes: 'optional string',
        },
      ],
      steps: [{ title: 'string', description: 'string' }],
      assumptions: ['string'],
      warnings: ['string'],
      safetyConsiderations: ['string'],
      assistantText: 'short learner-facing summary',
    },
  };

  if (input.repairAttempt && input.repairIssue) {
    return JSON.stringify({
      repair: { issue: input.repairIssue },
      context: payload,
    });
  }

  return JSON.stringify(payload);
};

export const generateRealAuthoringProposal = async (
  input: AuthoringProposalContext,
): Promise<AuthoringProposalProviderResult> => {
  const resolved = resolveAiChatProvider();
  const provider: RealProviderName = resolved === 'openai' ? 'openai' : 'gemini';
  const startedAt = Date.now();
  const userPrompt = buildAuthoringProposalPrompt(input);
  const attempt = input.repairAttempt ? 2 : 1;

  try {
    const response = await invokeRealProvider(
      provider,
      PROJECT_AUTHORING_PROPOSAL_SYSTEM_POLICY,
      userPrompt,
    );

    let raw: unknown;
    try {
      raw = extractJsonObject(response.text);
    } catch (error) {
      recordAuthoringProposalValidationDiagnostic({
        provider,
        attempt,
        stage: 'schema',
        issues: [
          {
            code: 'json_extraction_failed',
            message:
              error instanceof Error ? error.message : 'Could not extract JSON object',
          },
        ],
      });
      throw new AppError(
        input.locale === 'ar'
          ? 'تعذر على مساعد التأليف إنشاء اقتراح صالح. حاول مرة أخرى.'
          : 'The authoring assistant could not produce a valid proposal. Please try again.',
        502,
        'AI_RESPONSE_INVALID',
      );
    }

    const parsed = parseAuthoringProposalProviderPayload({
      raw,
      provider,
      attempt,
    });

    return {
      provider,
      model: response.model,
      data: parsed,
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
      latencyMs: response.latencyMs ?? Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw provider === 'openai'
      ? mapOpenAiFailure(error)
      : mapGeminiFailure(error);
  }
};


export const generateMockAuthoringProposalForTests = mockGenerateAuthoringProposal;

export const generateAuthoringProposal = async (
  input: AuthoringProposalContext,
): Promise<AuthoringProposalProviderResult> => {
  if (generatorOverride) {
    lastGeneratorRoute = 'override';
    proposalCallCountForTests += 1;
    return generatorOverride(input);
  }

  const resolvedProvider = resolveAiChatProvider();

  if (resolvedProvider === 'mock') {
    lastGeneratorRoute = 'mock';
    proposalCallCountForTests += 1;
    return mockGenerateAuthoringProposal(input);
  }

  if (resolvedProvider === 'openai') {
    lastGeneratorRoute = 'openai';
    proposalCallCountForTests += 1;
    return generateRealAuthoringProposal(input);
  }

  if (resolvedProvider === 'gemini') {
    lastGeneratorRoute = 'gemini';
    proposalCallCountForTests += 1;
    return generateRealAuthoringProposal(input);
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

export const buildStableProposalId = (input: {
  conversationId: string;
  clarificationMessageId: string;
  baseUpdatedAt: string;
}) =>
  createHash('sha256')
    .update(
      `${input.conversationId}:${input.clarificationMessageId}:${input.baseUpdatedAt}`,
    )
    .digest('hex')
    .slice(0, 24);
