import { z } from 'zod';

import { resolveAiChatProvider } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';

import type { AiProjectAuthoringTurnBlock } from './ai.content-blocks.js';
import { formatAuthoringProviderSchemaRepairIssue } from './ai-project-authoring-clarification.shared.js';
import {
  generateRealAuthoringScalarProposal,
  type RealAuthoringScalarInput,
} from './ai-project-authoring-real.provider.js';
import type { SequentialStage } from './ai-project-authoring-sequential.policy.js';
import { isPlaceholderText } from './ai-project-authoring-sequential.policy.js';
import type { AiLocale } from './ai.types.js';

const suggestionValueSchema = z.union([
  z.string().trim().min(1).max(8000),
  z.number().int().positive().max(10000),
]);

export const sequentialDiscussionReplySchema = z.discriminatedUnion('replyType', [
  z.object({
    replyType: z.literal('REVISED_SUGGESTION'),
    assistantText: z.string().trim().min(8).max(4000),
    suggestion: z.object({
      value: suggestionValueSchema,
    }),
  }),
  z.object({
    replyType: z.literal('REVISED_PROPOSAL'),
    assistantText: z.string().trim().min(8).max(4000),
    proposal: z.object({
      value: suggestionValueSchema,
    }),
  }),
  z.object({
    replyType: z.literal('FOLLOW_UP_QUESTION'),
    assistantText: z.string().trim().min(8).max(1200),
  }),
]);

export type SequentialDiscussionReply = z.infer<typeof sequentialDiscussionReplySchema>;

export type NormalizedSequentialDiscussionReply =
  | {
      replyType: 'REVISED_SUGGESTION';
      assistantText: string;
      suggestion: { value: string | number };
    }
  | {
      replyType: 'FOLLOW_UP_QUESTION';
      assistantText: string;
    };

const GENERIC_ACK_PATTERNS = [
  /^i understand your request/i,
  /^i understand and will revise/i,
  /^i will revise/i,
  /^فهمت طلبك/i,
  /^سأعدّل الاقتراح/i,
  /^سأعدل الاقتراح/i,
];

export const isGenericDiscussionAcknowledgement = (text: string) =>
  GENERIC_ACK_PATTERNS.some((pattern) => pattern.test(text.trim()));

export type DurationConstraints = {
  minExclusive?: number;
  minInclusive?: number;
  maxExclusive?: number;
  maxInclusive?: number;
  approximate?: number;
  approximateTolerance?: number;
};

export type OverviewStartIntent = 'START' | 'UPDATE_IDEA' | 'OTHER';

export type SequentialDiscussionContext = {
  locale: AiLocale;
  stage: SequentialStage;
  comment: string;
  currentProposal: AiProjectAuthoringTurnBlock['proposal'];
  explanation: string;
  projectId?: string | null;
  projectTitle: string;
  projectShortDescription: string;
  projectDescription: string | null;
  projectDifficulty?: string | null;
  projectEstimatedMinutes?: number | null;
  canonicalSavedValue?: string | number | null;
  projectConstraints?: string[];
  clarificationContext?: string[];
  repairAttempt: boolean;
  repairIssue?: string | null;
  previousInvalidOutput?: string | null;
  violatedConstraint?: string | null;
  suggestAnother?: boolean;
};

export const normalizeScalarValue = (value: string | number) => {
  if (typeof value === 'number') {
    return String(value);
  }
  return normalizeDiscussionText(value)
    .replace(/[^\w\s\u0600-\u06FF]/g, '')
    .trim();
};

export const areScalarsMateriallyIdentical = (
  left: string | number | null | undefined,
  right: string | number | null | undefined,
) => {
  if (left == null || right == null) {
    return false;
  }
  return normalizeScalarValue(left) === normalizeScalarValue(right);
};

const projectContextText = (input: SequentialDiscussionContext) =>
  [
    input.projectTitle,
    input.projectShortDescription,
    input.projectDescription ?? '',
    input.comment,
  ].join(' ');

const isDoorAlarmProject = (text: string) =>
  /\b(door alarm|reed switch|magnetic door|reed|انذار باب|إنذار باب|حساس مغناطيسي|مفتاح ريد)\b/i.test(
    text,
  );

const isSoilMoistureProject = (text: string) =>
  /\b(soil moisture|رطوبه التربه|رطوبة التربة|moisture sensor|حساس رطوبه|حساس رطوبة)\b/i.test(
    text,
  );

type DiscussionGenerator = (
  input: SequentialDiscussionContext,
) => SequentialDiscussionReply | Promise<SequentialDiscussionReply>;

type StartIntentGenerator = (
  comment: string,
  locale: AiLocale,
) => OverviewStartIntent | Promise<OverviewStartIntent>;

let generatorOverride: DiscussionGenerator | null = null;
let startIntentOverride: StartIntentGenerator | null = null;

export const setSequentialDiscussionGeneratorForTests = (
  generator: DiscussionGenerator | null,
) => {
  generatorOverride = generator;
};

export const setOverviewStartIntentGeneratorForTests = (
  generator: StartIntentGenerator | null,
) => {
  startIntentOverride = generator;
};

const normalizeDiscussionText = (text: string) =>
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

const normalizeTitle = (value: string) =>
  normalizeDiscussionText(value).replace(/[^\w\s\u0600-\u06FF]/g, '');

export const parseDurationConstraints = (comment: string): DurationConstraints | null => {
  const text = normalizeDiscussionText(comment);

  if (
    /(?:more than (?:an |one )?hour|اكثر من ساعه|أكثر من ساعة|اكثر من ساعة)/i.test(
      text,
    )
  ) {
    return { minExclusive: 60 };
  }

  if (
    /(?:at least two hours|two hours or more|ساعتين على الاقل|ساعتين على الأقل|على الاقل ساعتين)/i.test(
      text,
    )
  ) {
    return { minInclusive: 120 };
  }

  if (/(?:about two hours|حوالي ساعتين|تقريبا ساعتين)/i.test(text)) {
    return { approximate: 120, approximateTolerance: 30 };
  }

  const greaterThan = text.match(
    /(?:higher than|more than|greater than|اعل[ىي]\s*من|اكثر\s*من)\s*(\d+)/i,
  );
  if (greaterThan) {
    return { minExclusive: Number(greaterThan[1]) };
  }

  const arabicGreaterLoose = text.match(/(?:اعل[ىي]|اكثر).{0,12}?(\d+)/i);
  if (arabicGreaterLoose && /(?:اعل[ىي]|اكثر)/i.test(text)) {
    return { minExclusive: Number(arabicGreaterLoose[1]) };
  }

  const atLeast = text.match(
    /(?:at least|minimum|على الاقل|على الأقل|لا يقل عن)\s*(\d+)\s*(?:minutes|minute|دقيقه|دقيقة|min)?/i,
  );
  if (atLeast) {
    return { minInclusive: Number(atLeast[1]) };
  }

  const lessThan = text.match(
    /(?:less than|under|اقل من|أقل من)\s*(\d+)\s*(?:minutes|minute|دقيقه|دقيقة|min)?/i,
  );
  if (lessThan) {
    return { maxExclusive: Number(lessThan[1]) };
  }

  const hourMatch = text.match(/(\d+)\s*(?:hours|hour|ساعات|ساعه|ساعة)/i);
  if (hourMatch) {
    const minutes = Number(hourMatch[1]) * 60;
    if (/(?:about|around|حوالي|تقريبا)/i.test(text)) {
      return { approximate: minutes, approximateTolerance: 30 };
    }
    return { minInclusive: minutes };
  }

  return null;
};

export const durationSatisfiesConstraints = (
  minutes: number,
  constraints: DurationConstraints,
): boolean => {
  if (constraints.minExclusive !== undefined && minutes <= constraints.minExclusive) {
    return false;
  }
  if (constraints.minInclusive !== undefined && minutes < constraints.minInclusive) {
    return false;
  }
  if (constraints.maxExclusive !== undefined && minutes >= constraints.maxExclusive) {
    return false;
  }
  if (constraints.maxInclusive !== undefined && minutes > constraints.maxInclusive) {
    return false;
  }
  if (constraints.approximate !== undefined) {
    const tolerance = constraints.approximateTolerance ?? 20;
    return Math.abs(minutes - constraints.approximate) <= tolerance;
  }
  return true;
};

export const describeDurationConstraintViolation = (
  minutes: number,
  constraints: DurationConstraints,
): string | null => {
  if (constraints.minExclusive !== undefined && minutes <= constraints.minExclusive) {
    return `Duration must be greater than ${constraints.minExclusive} minutes.`;
  }
  if (constraints.minInclusive !== undefined && minutes < constraints.minInclusive) {
    return `Duration must be at least ${constraints.minInclusive} minutes.`;
  }
  if (constraints.maxExclusive !== undefined && minutes >= constraints.maxExclusive) {
    return `Duration must be less than ${constraints.maxExclusive} minutes.`;
  }
  if (constraints.maxInclusive !== undefined && minutes > constraints.maxInclusive) {
    return `Duration must be at most ${constraints.maxInclusive} minutes.`;
  }
  if (constraints.approximate !== undefined) {
    const tolerance = constraints.approximateTolerance ?? 20;
    if (Math.abs(minutes - constraints.approximate) > tolerance) {
      return `Duration should be around ${constraints.approximate} minutes.`;
    }
  }
  return null;
};

const deriveDurationFromConstraints = (
  current: number,
  constraints: DurationConstraints,
): number => {
  if (constraints.minExclusive !== undefined) {
    return Math.max(constraints.minExclusive + 15, current + 30, 75);
  }
  if (constraints.minInclusive !== undefined) {
    return Math.max(constraints.minInclusive, current);
  }
  if (constraints.maxExclusive !== undefined) {
    return Math.min(constraints.maxExclusive - 15, current);
  }
  if (constraints.maxInclusive !== undefined) {
    return Math.min(constraints.maxInclusive, current);
  }
  if (constraints.approximate !== undefined) {
    return constraints.approximate;
  }
  return current;
};

const currentScalarValue = (proposal: AiProjectAuthoringTurnBlock['proposal']) => {
  if ('value' in proposal) {
    return proposal.value;
  }
  return null;
};

const buildShorterBeginnerTitle = (
  title: string,
  locale: AiLocale,
  emphasizeBeginner: boolean,
): string => {
  const words = title.split(/\s+/).filter(Boolean);
  const shortened = words.slice(0, Math.min(6, Math.max(4, words.length - 2))).join(' ');
  if (emphasizeBeginner) {
    return locale === 'ar'
      ? `${shortened} للمبتدئين`
      : `${shortened} for Beginners`;
  }
  return shortened;
};

const normalizeDiscussionReply = (
  reply: SequentialDiscussionReply,
): NormalizedSequentialDiscussionReply => {
  if (reply.replyType === 'REVISED_PROPOSAL') {
    return {
      replyType: 'REVISED_SUGGESTION',
      assistantText: reply.assistantText,
      suggestion: { value: reply.proposal.value },
    };
  }
  if (reply.replyType === 'REVISED_SUGGESTION') {
    return reply;
  }
  return reply;
};

const validateDiscussionReplyForStage = (
  input: SequentialDiscussionContext,
  reply: NormalizedSequentialDiscussionReply,
) => {
  if (reply.replyType !== 'REVISED_SUGGESTION') {
    return;
  }

  const current = currentScalarValue(input.currentProposal);

  if (input.stage === 'TITLE' && typeof reply.suggestion.value === 'string') {
    const requestedRevision =
      /shorter|أقصر|اقصر|brief|مختصر|مبتدئ|مبتدئين|beginner/i.test(input.comment);
    if (
      requestedRevision &&
      normalizeTitle(reply.suggestion.value) === normalizeTitle(String(current ?? ''))
    ) {
      throw new AppError(
        'Revised title cannot be identical to the previous suggestion.',
        502,
        'AI_PROVIDER_RESPONSE_INVALID',
      );
    }
  }

  if (input.stage === 'ESTIMATED_DURATION' && typeof reply.suggestion.value === 'number') {
    const constraints = parseDurationConstraints(input.comment);
    if (constraints) {
      const violation = describeDurationConstraintViolation(
        reply.suggestion.value,
        constraints,
      );
      if (violation) {
        throw new AppError(violation, 502, 'AI_PROVIDER_RESPONSE_INVALID', {
          violatedConstraint: violation,
        });
      }
    }
  }

  if (input.stage === 'DIFFICULTY' && typeof reply.suggestion.value === 'string') {
    const normalized = reply.suggestion.value.trim().toUpperCase();
    if (!['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(normalized)) {
      throw new AppError(
        'Difficulty must be BEGINNER, INTERMEDIATE, or ADVANCED.',
        502,
        'AI_PROVIDER_RESPONSE_INVALID',
      );
    }
  }
};

const buildDoorAlarmShortDescription = (locale: AiLocale, emphasizeAudioLight = false) =>
  locale === 'ar'
    ? emphasizeAudioLight
      ? 'إنذار باب Arduino يشغّل صوت Buzzer وضوء LED أحمر فور فتح الباب عبر Reed switch مغناطيسي.'
      : 'إنذار باب Arduino مدمج يفعّل Buzzer وLED أحمر عند فتح الباب باستخدام Reed switch مغناطيسي.'
    : emphasizeAudioLight
      ? 'An Arduino door alarm that turns on a buzzer and red LED as soon as a magnetic reed switch detects an open door.'
      : 'A compact Arduino door alarm that activates a buzzer and red LED when a magnetic reed switch detects an open door.';

const buildSoilMoistureShortDescription = (locale: AiLocale, base: string) =>
  locale === 'ar'
    ? `${base} يشرح للمبتدئين مراقبة رطوبة التربة باستخدام Arduino وحساس رطوبة وLED تحذيري دون مضخة أو Relay.`
    : `${base} This beginner-friendly Arduino project monitors soil moisture and activates an LED warning when the soil becomes dry, without using a pump or relay.`;

const buildMockAlternative = (input: SequentialDiscussionContext): SequentialDiscussionReply => {
  const current = currentScalarValue(input.currentProposal);
  const corpus = projectContextText(input);

  if (typeof current === 'string') {
    if (input.stage === 'SHORT_DESCRIPTION' && isDoorAlarmProject(corpus)) {
      const revised = buildDoorAlarmShortDescription(input.locale, true);
      if (!areScalarsMateriallyIdentical(revised, current)) {
        return {
          replyType: 'REVISED_SUGGESTION',
          assistantText:
            input.locale === 'ar'
              ? `إليك وصفًا بديلًا:\n\n${revised}`
              : `Here is an alternative description:\n\n${revised}`,
          suggestion: { value: revised },
        };
      }
    }

    const words = current.split(/\s+/).filter(Boolean);
    const revised =
      input.stage === 'TITLE'
        ? input.locale === 'ar'
          ? `${words.slice(1).join(' ') || current} — نسخة بديلة`
          : `${words.slice(1).join(' ') || current} — alternative draft`
        : input.locale === 'ar'
          ? `نسخة بديلة: ${words.slice(0, Math.max(4, words.length - 2)).join(' ')} مع تركيز أوضح على هدف المشروع.`
          : `Alternative draft: ${words.slice(0, Math.max(6, words.length - 3)).join(' ')} with clearer project intent.`;

    if (areScalarsMateriallyIdentical(revised, current)) {
      throw new AppError(
        input.locale === 'ar'
          ? 'لم أتمكن من إنشاء اقتراح بديل مختلف. صف التغيير الذي تريده.'
          : 'I could not produce a materially different alternative. Describe the change you want.',
        409,
        'AI_AUTHORING_NO_ALTERNATIVE',
      );
    }

    return {
      replyType: 'REVISED_SUGGESTION',
      assistantText:
        input.locale === 'ar'
          ? `إليك اقتراحًا بديلًا:\n\n${revised}`
          : `Here is an alternative suggestion:\n\n${revised}`,
      suggestion: { value: revised },
    };
  }

  if (typeof current === 'number' && input.stage === 'ESTIMATED_DURATION') {
    const revised = current >= 180 ? current - 30 : current + 45;
    if (revised === current) {
      throw new AppError(
        input.locale === 'ar'
          ? 'لم أتمكن من إنشاء مدة بديلة. صف المدة التي تفضلها.'
          : 'I could not produce an alternative duration. Describe the timing you prefer.',
        409,
        'AI_AUTHORING_NO_ALTERNATIVE',
      );
    }
    return {
      replyType: 'REVISED_SUGGESTION',
      assistantText:
        input.locale === 'ar'
          ? `اقتراح بديل: ${revised} دقيقة.`
          : `Alternative suggestion: ${revised} minutes.`,
      suggestion: { value: revised },
    };
  }

  throw new AppError(
    input.locale === 'ar'
      ? 'لم أتمكن من إنشاء اقتراح بديل مختلف. صف التغيير الذي تريده.'
      : 'I could not produce a materially different alternative. Describe the change you want.',
    409,
    'AI_AUTHORING_NO_ALTERNATIVE',
  );
};

const buildInitialMockScalar = (input: SequentialDiscussionContext): SequentialDiscussionReply => {
  const current = currentScalarValue(input.currentProposal);

  if (input.stage === 'TITLE') {
    const base = isPlaceholderText(input.projectTitle)
      ? 'Learning Project'
      : input.projectTitle.trim().split(/\s+/).slice(0, 8).join(' ');
    return {
      replyType: 'REVISED_SUGGESTION',
      assistantText:
        input.locale === 'ar'
          ? `اقتراح عنوان:\n\n${base}`
          : `Suggested title:\n\n${base}`,
      suggestion: { value: base },
    };
  }

  if (input.stage === 'SHORT_DESCRIPTION') {
    const base = isPlaceholderText(input.projectShortDescription)
      ? `${input.projectTitle.split(/\s+/).slice(0, 10).join(' ')} — concise summary.`
      : `${input.projectShortDescription.trim().split(/\s+/).slice(0, 14).join(' ')}.`;
    return {
      replyType: 'REVISED_SUGGESTION',
      assistantText:
        input.locale === 'ar'
          ? `اقتراح وصف مختصر:\n\n${base}`
          : `Suggested short description:\n\n${base}`,
      suggestion: { value: base },
    };
  }

  if (input.stage === 'FULL_DESCRIPTION') {
    const base =
      (typeof current === 'string' && current.trim().length > 0 && !isPlaceholderText(current)
        ? current
        : isPlaceholderText(input.projectDescription ?? '')
          ? input.projectShortDescription
          : input.projectDescription) ?? input.projectTitle;
    const revised = `${base}\n\n${
      input.locale === 'ar'
        ? 'سيبني المتعلم المشروع خطوة بخطوة مع شرح واضح لكل قرار.'
        : 'The learner will build and test the project step by step with clear design decisions.'
    }`;
    return {
      replyType: 'REVISED_SUGGESTION',
      assistantText:
        input.locale === 'ar'
          ? `اقتراح وصف كامل:\n\n${revised}`
          : `Suggested full description:\n\n${revised}`,
      suggestion: { value: revised },
    };
  }

  if (input.stage === 'DIFFICULTY') {
    const difficulty = (input.projectDifficulty ?? 'BEGINNER').toUpperCase();
    return {
      replyType: 'REVISED_SUGGESTION',
      assistantText:
        input.locale === 'ar'
          ? `اقتراح مستوى الصعوبة: ${difficulty}`
          : `Suggested difficulty: ${difficulty}`,
      suggestion: { value: difficulty },
    };
  }

  const minutes =
    typeof current === 'number'
      ? current
      : input.projectEstimatedMinutes && input.projectEstimatedMinutes > 0
        ? input.projectEstimatedMinutes
        : 120;
  return {
    replyType: 'REVISED_SUGGESTION',
    assistantText:
      input.locale === 'ar'
        ? `اقتراح المدة: ${minutes} دقيقة.`
        : `Suggested duration: ${minutes} minutes.`,
    suggestion: { value: minutes },
  };
};

const buildMockRevision = (input: SequentialDiscussionContext): SequentialDiscussionReply => {
  if (input.suggestAnother) {
    return buildMockAlternative(input);
  }

  if (!input.comment.trim()) {
    return buildInitialMockScalar(input);
  }

  const current = currentScalarValue(input.currentProposal);
  const comment = input.comment.toLowerCase();
  const corpus = projectContextText(input);

  if (input.stage === 'TITLE') {
    const wantsShorter = /shorter|أقصر|اقصر|brief|مختصر/i.test(comment);
    const wantsBeginner = /beginner|مبتدئ|مبتدئين/i.test(comment);
    if (wantsShorter || wantsBeginner) {
      const base =
        typeof current === 'string' && current.trim().length > 0
          ? current.trim()
          : input.projectTitle;
      const revised = buildShorterBeginnerTitle(base, input.locale, wantsBeginner);
      if (normalizeTitle(revised) === normalizeTitle(String(current ?? ''))) {
        throw new AppError(
          'Revised title cannot be identical to the previous suggestion.',
          502,
          'AI_PROVIDER_RESPONSE_INVALID',
        );
      }
      return {
        replyType: 'REVISED_SUGGESTION',
        assistantText:
          input.locale === 'ar'
            ? `إليك عنوانًا أقصر:\n\n${revised}`
            : `Here is a shorter title:\n\n${revised}`,
        suggestion: { value: revised },
      };
    }
  }

  if (input.stage === 'ESTIMATED_DURATION' && typeof current === 'number') {
    const constraints = parseDurationConstraints(input.comment);
    let revised = current;
    if (constraints) {
      revised = deriveDurationFromConstraints(current, constraints);
    } else if (comment.includes('longer') || comment.includes('أطول') || comment.includes('اطول')) {
      revised = current + 30;
    } else {
      revised = current;
    }

    const activeConstraints = constraints ?? parseDurationConstraints(input.comment);
    if (activeConstraints) {
      const violation = describeDurationConstraintViolation(revised, activeConstraints);
      if (violation) {
        throw new AppError(violation, 502, 'AI_PROVIDER_RESPONSE_INVALID', {
          violatedConstraint: violation,
        });
      }
    }

    return {
      replyType: 'REVISED_SUGGESTION',
      assistantText:
        input.locale === 'ar'
          ? `اقترحت مدة ${revised} دقيقة بناءً على طلبك.`
          : `I suggested ${revised} minutes based on your request.`,
      suggestion: { value: revised },
    };
  }

  if (
    input.stage === 'SHORT_DESCRIPTION' &&
    (/أقصر|اقصر|shorter|brief|مختصر|اوضح|أوضح|واضح/i.test(comment) ||
      /صوت|ضوء|buzzer|led|sound|light/i.test(comment))
  ) {
    const emphasizeAudioLight = /صوت|ضوء|buzzer|led|sound|light/i.test(comment);
    const revised = isDoorAlarmProject(corpus)
      ? buildDoorAlarmShortDescription(input.locale, emphasizeAudioLight)
      : isSoilMoistureProject(corpus)
        ? buildSoilMoistureShortDescription(
            input.locale,
            typeof current === 'string' && current.trim().length > 0
              ? current.trim()
              : input.projectShortDescription,
          )
        : typeof current === 'string' && current.trim().length > 0
          ? input.locale === 'ar'
            ? `${current.trim().split(/\s+/).slice(0, Math.max(8, Math.floor(current.trim().split(/\s+/).length * 0.7))).join(' ')}.`
            : `${current.trim().split(/\s+/).slice(0, Math.max(10, Math.floor(current.trim().split(/\s+/).length * 0.7))).join(' ')}.`
          : input.projectShortDescription;

    if (
      typeof revised === 'string' &&
      !areScalarsMateriallyIdentical(revised, current) &&
      !areScalarsMateriallyIdentical(revised, input.comment)
    ) {
      return {
        replyType: 'REVISED_SUGGESTION',
        assistantText:
          input.locale === 'ar'
            ? `إليك وصفًا أقصر وأوضح:\n\n${revised}`
            : `Here is a shorter, clearer description:\n\n${revised}`,
        suggestion: { value: revised },
      };
    }
  }

  if (
    input.stage === 'SHORT_DESCRIPTION' &&
    (comment.includes('larger') ||
      comment.includes('comprehensive') ||
      comment.includes('bigger') ||
      comment.includes('أكبر') ||
      comment.includes('شامل'))
  ) {
    const base =
      typeof current === 'string' && current.trim().length > 0
        ? current.trim()
        : input.projectShortDescription;
    const revised = isSoilMoistureProject(corpus)
      ? buildSoilMoistureShortDescription(input.locale, base)
      : isDoorAlarmProject(corpus)
        ? buildDoorAlarmShortDescription(input.locale, false)
        : `${base} ${input.locale === 'ar' ? 'مع شرح أوضح للمبتدئين.' : 'with clearer beginner-friendly detail.'}`;
    return {
      replyType: 'REVISED_SUGGESTION',
      assistantText:
        input.locale === 'ar'
          ? `إليك وصفًا مختصرًا أكثر اكتمالًا:\n\n${revised}`
          : `Here is a more complete short description:\n\n${revised}`,
      suggestion: { value: revised },
    };
  }

  if (
    input.stage === 'FULL_DESCRIPTION' &&
    (comment.includes('larger') ||
      comment.includes('comprehensive') ||
      comment.includes('detail') ||
      comment.includes('أكبر') ||
      comment.includes('شامل') ||
      comment.includes('تفصيل'))
  ) {
    const base =
      typeof current === 'string' && current.trim().length > 0
        ? current.trim()
        : input.projectDescription ?? input.projectShortDescription;
    const revised =
      input.locale === 'ar'
        ? `${base}\n\nسيبني المتعلم دائرة تنبيه بسيطة، يضبط عتبة الجفاف، ويختبر التنبيه خطوة بخطوة مع شرح واضح لكل توصيلة وقرار تصميمي.`
        : `${base}\n\nThe learner will build a simple alert circuit, tune the dryness threshold, and test the warning step by step with clear wiring and design decisions explained along the way.`;
    return {
      replyType: 'REVISED_SUGGESTION',
      assistantText:
        input.locale === 'ar'
          ? `إليك وصفًا كاملاً أكثر تفصيلاً:\n\n${revised}`
          : `Here is a fuller description:\n\n${revised}`,
      suggestion: { value: revised },
    };
  }

  if (input.stage === 'TITLE') {
    return {
      replyType: 'FOLLOW_UP_QUESTION',
      assistantText:
        input.locale === 'ar'
          ? 'هل تريد عنوانًا أقصر أم أكثر وصفًا؟'
          : 'Would you like a shorter title or a more descriptive one?',
    };
  }

  return {
    replyType: 'FOLLOW_UP_QUESTION',
    assistantText:
      input.locale === 'ar'
        ? 'ما الجزء الذي تريد تعديله تحديدًا في هذا الاقتراح؟'
        : 'Which part of this suggestion would you like to change specifically?',
  };
};

const assertRevisionDoesNotEchoLearner = (input: SequentialDiscussionContext, value: string | number) => {
  const trimmed = input.comment.trim();
  if (!trimmed) {
    return;
  }
  if (areScalarsMateriallyIdentical(value, trimmed)) {
    throw new AppError(
      'Proposal cannot echo learner feedback.',
      502,
      'AI_PROVIDER_RESPONSE_INVALID',
    );
  }
  if (typeof value === 'string' && trimmed.length >= 16 && value.includes(trimmed)) {
    throw new AppError(
      'Proposal cannot include raw learner feedback.',
      502,
      'AI_PROVIDER_RESPONSE_INVALID',
    );
  }
};

const EXACT_START_PHRASES = new Set([
  'start',
  'begin',
  "let's start",
  'lets start',
  'yes',
  'okay',
  'ok',
  'go ahead',
  'ready',
  'ابدأ',
  'ابدا',
  'نبدأ',
  'نبدا',
  'يلا',
  'يلا نبدأ',
  'يلا نبدا',
  'تمام',
  'اه',
  'أيوه',
  'ايوه',
  'ماشي نبدأ',
  'ماشي نبدا',
  'خلينا نبدأ',
  'خلينا نبدا',
  'تمام نبدأ',
  'تمام نبدا',
]);

const AMBIGUOUS_AFFIRMATIVES = new Set([
  'yes',
  'yeah',
  'yep',
  'okay',
  'ok',
  'sure',
  'ready',
  'go',
  'go ahead',
  'تمام',
  'اه',
  'ايوه',
  'أيوه',
  'ماشي',
  'موافق',
  'حاضر',
]);

const containsExplicitStartToken = (normalized: string) => {
  const tokens = ['نبدأ', 'نبدا', 'ابدأ', 'ابدا', 'start', 'begin'];
  return tokens.some((token) => normalized.includes(token));
};

export const classifyOverviewStartIntent = async (
  comment: string,
  locale: AiLocale,
): Promise<OverviewStartIntent> => {
  if (startIntentOverride) {
    return startIntentOverride(comment, locale);
  }

  const normalized = normalizeDiscussionText(comment);
  if (!normalized) {
    return 'OTHER';
  }

  if (EXACT_START_PHRASES.has(normalized) || containsExplicitStartToken(normalized)) {
    return 'START';
  }

  if (AMBIGUOUS_AFFIRMATIVES.has(normalized)) {
    return 'START';
  }

  const provider = resolveAiChatProvider();
  if (provider === 'disabled' || provider === 'mock') {
    return 'OTHER';
  }

  return 'OTHER';
};

const toRealScalarInput = (input: SequentialDiscussionContext): RealAuthoringScalarInput => {
  const current = currentScalarValue(input.currentProposal);
  return {
    locale: input.locale,
    projectId: input.projectId ?? null,
    stage: input.stage,
    canonicalProject: {
      title: input.projectTitle,
      shortDescription: input.projectShortDescription,
      description: input.projectDescription,
      difficulty: input.projectDifficulty ?? null,
      estimatedMinutes: input.projectEstimatedMinutes ?? null,
    },
    currentProposal: {
      value: current ?? '',
    },
    learnerFeedback: input.comment,
    projectConstraints: input.projectConstraints ?? [],
    clarificationContext: input.clarificationContext ?? [],
    suggestAnother: input.suggestAnother ?? false,
    repairAttempt: input.repairAttempt,
    repairIssue: input.repairIssue ?? null,
    previousInvalidOutput: input.previousInvalidOutput ?? null,
  };
};

const mapRealScalarToDiscussionReply = (
  result: Awaited<ReturnType<typeof generateRealAuthoringScalarProposal>>['data'],
): SequentialDiscussionReply => {
  if (result.kind === 'FOLLOW_UP_QUESTION') {
    return {
      replyType: 'FOLLOW_UP_QUESTION',
      assistantText: result.explanation
        ? `${result.question}\n\n${result.explanation}`
        : result.question,
    };
  }

  return {
    replyType: 'REVISED_SUGGESTION',
    assistantText: result.explanation,
    suggestion: { value: result.value },
  };
};

const invokeConfiguredScalarDiscussion = async (
  input: SequentialDiscussionContext,
): Promise<SequentialDiscussionReply> => {
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

  if (resolvedProvider === 'mock') {
    return buildMockRevision(input);
  }

  const providerResult = await generateRealAuthoringScalarProposal(
    toRealScalarInput(input),
    resolvedProvider,
  );
  return mapRealScalarToDiscussionReply(providerResult.data);
};

export const generateSequentialStageDiscussion = async (
  input: SequentialDiscussionContext,
): Promise<NormalizedSequentialDiscussionReply> => {
  const raw = generatorOverride
    ? await generatorOverride(input)
    : await invokeConfiguredScalarDiscussion(input);

  const normalized = normalizeDiscussionReply(raw);
  if (isGenericDiscussionAcknowledgement(normalized.assistantText)) {
    throw new AppError(
      'Discussion response was too generic.',
      502,
      'AI_PROVIDER_RESPONSE_INVALID',
    );
  }
  if (normalized.replyType === 'REVISED_SUGGESTION') {
    assertRevisionDoesNotEchoLearner(input, normalized.suggestion.value);
  }
  validateDiscussionReplyForStage(input, normalized);
  return normalized;
};

export const generateAlternativeStageDiscussionWithRepair = async (
  input: SequentialDiscussionContext,
): Promise<NormalizedSequentialDiscussionReply> => {
  const current = currentScalarValue(input.currentProposal);

  const runAttempt = async (repairAttempt: boolean) => {
    const alternative = await generateSequentialStageDiscussion({
      ...input,
      comment: repairAttempt
        ? input.locale === 'ar'
          ? 'اقترح بديلًا مختلفًا ماديًا عن الاقتراح السابق.'
          : 'Suggest a materially different alternative from the previous proposal.'
        : '',
      suggestAnother: true,
      repairAttempt,
      repairIssue: repairAttempt
        ? 'Alternative must be materially different from the previous suggestion.'
        : input.repairIssue,
    });
    if (
      alternative.replyType === 'REVISED_SUGGESTION' &&
      areScalarsMateriallyIdentical(alternative.suggestion.value, current)
    ) {
      throw new AppError(
        input.locale === 'ar'
          ? 'أعاد المساعد نفس الاقتراح. صف التغيير الذي تريده.'
          : 'The assistant returned the same suggestion. Describe the change you want.',
        409,
        'AI_AUTHORING_NO_ALTERNATIVE',
      );
    }
    return alternative;
  };

  try {
    return await runAttempt(false);
  } catch (error) {
    if (input.repairAttempt || !(error instanceof AppError)) {
      throw error;
    }
    if (error.code !== 'AI_AUTHORING_NO_ALTERNATIVE') {
      throw error;
    }
    return runAttempt(true);
  }
};

export const generateSequentialStageDiscussionWithRepair = async (
  input: SequentialDiscussionContext,
): Promise<NormalizedSequentialDiscussionReply> => {
  try {
    return await generateSequentialStageDiscussion(input);
  } catch (error) {
    const details = error instanceof AppError
      ? (error.details as {
          violatedConstraint?: string;
          providerSchemaIssues?: unknown;
        } | undefined)
      : undefined;
    const violatedConstraint = error instanceof AppError
      ? formatAuthoringProviderSchemaRepairIssue(details?.providerSchemaIssues) ??
        details?.violatedConstraint ??
        error.message
      : null;

    if (input.repairAttempt || !violatedConstraint) {
      throw error;
    }

    return generateSequentialStageDiscussion({
      ...input,
      repairAttempt: true,
      repairIssue: violatedConstraint,
      violatedConstraint,
    });
  }
};

export const validateSequentialDiscussionReply = (
  reply: SequentialDiscussionReply,
): NormalizedSequentialDiscussionReply => {
  const parsed = sequentialDiscussionReplySchema.parse(reply);
  const normalized = normalizeDiscussionReply(parsed);
  if (isGenericDiscussionAcknowledgement(normalized.assistantText)) {
    throw new AppError(
      'Discussion response was too generic.',
      502,
      'AI_PROVIDER_RESPONSE_INVALID',
    );
  }
  return normalized;
};
