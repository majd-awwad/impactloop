import { ZodError } from 'zod';

import {
  LEARNER_SUBMIT_COMPONENT_ROLES,
  MAX_COMPONENT_KEYWORDS,
  MAX_KEYWORD_LENGTH,
  MAX_SUBMIT_COMPONENTS,
  normalizeSubmitComponent,
  resolveSubmitMaterialType,
  type LearnerSubmitComponentRole,
} from '../learning-projects/learning-projects.submit-components.js';

import {
  aiAuthoringProposalProviderSchema,
  aiProjectAuthoringProposalBlockSchema,
  type AiAuthoringProposalProviderResult,
  type AiProjectAuthoringProposalBlock,
  type AiProjectAuthoringClarificationBlock,
} from './ai.content-blocks.js';
import type { AiLocale } from './ai.types.js';

export const MIN_PROPOSAL_COMPONENTS = 1;
export const MAX_PROPOSAL_COMPONENTS = 20;
export const MIN_PROPOSAL_STEPS = 3;
export const MAX_PROPOSAL_STEPS = 20;
export const MAX_PROPOSAL_ASSUMPTIONS = 10;
export const MAX_PROPOSAL_WARNINGS = 10;
export const MAX_PROPOSAL_SAFETY_NOTES = 10;

const AVAILABILITY_CLAIM_PATTERNS = [
  /\bavailable on impactloop\b/i,
  /\bin stock on impactloop\b/i,
  /\breserved on impactloop\b/i,
  /\bsupplier\b/i,
  /\breservation\b/i,
];

const cleanBoundedText = (value: string | undefined, maxLength: number) =>
  value?.replace(/\s+/g, ' ').trim().slice(0, maxLength) ?? '';

const normalizeKeywordArray = (
  componentName: string,
  keywords: string[] | undefined,
  alternativeKeywords: string[] | undefined,
) => {
  const normalized = new Set<string>();
  const addParts = (value: string) => {
    for (const part of value.split(/[,;\n]+/)) {
      const cleaned = part.trim().slice(0, MAX_KEYWORD_LENGTH);
      if (cleaned.length > 0) {
        normalized.add(cleaned);
      }
      if (normalized.size >= MAX_COMPONENT_KEYWORDS) {
        return;
      }
    }
  };

  if (componentName.trim().length > 0) {
    normalized.add(componentName.trim().slice(0, MAX_KEYWORD_LENGTH));
  }

  for (const keyword of keywords ?? []) {
    addParts(keyword);
    if (normalized.size >= MAX_COMPONENT_KEYWORDS) {
      break;
    }
  }

  const alternatives = new Set<string>();
  for (const keyword of alternativeKeywords ?? []) {
    for (const part of keyword.split(/[,;\n]+/)) {
      const cleaned = part.trim().slice(0, MAX_KEYWORD_LENGTH);
      if (cleaned.length > 0) {
        alternatives.add(cleaned);
      }
      if (alternatives.size >= MAX_COMPONENT_KEYWORDS) {
        break;
      }
    }
    if (alternatives.size >= MAX_COMPONENT_KEYWORDS) {
      break;
    }
  }

  return {
    searchKeywords: [...normalized].slice(0, MAX_COMPONENT_KEYWORDS),
    alternativeKeywords: [...alternatives].slice(0, MAX_COMPONENT_KEYWORDS),
  };
};

const normalizeDifficulty = (value: string) => {
  const upper = value.trim().toUpperCase();
  if (
    upper === 'BEGINNER' ||
    upper === 'INTERMEDIATE' ||
    upper === 'ADVANCED'
  ) {
    return upper as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  }
  return null;
};

const normalizeComponentRole = (
  value: string | undefined,
): LearnerSubmitComponentRole => {
  if (
    value &&
    LEARNER_SUBMIT_COMPONENT_ROLES.includes(value as LearnerSubmitComponentRole)
  ) {
    return value as LearnerSubmitComponentRole;
  }
  return 'REQUIRED_MATERIAL';
};

const normalizeIntegerLike = (value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  if (Number.isInteger(value)) {
    return value;
  }
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-9) {
    return rounded;
  }
  return value;
};

export type NormalizedAuthoringProposalProviderPayload = {
  project: AiAuthoringProposalProviderResult['project'];
  requiredComponents: Array<{
    componentName: string;
    materialType: string;
    quantity: number;
    unit: string;
    componentRole: LearnerSubmitComponentRole;
    isRequired: boolean;
    canBeSubstituted: boolean;
    searchKeywords: string[];
    alternativeKeywords: string[];
    notes?: string;
  }>;
  steps: Array<{ title: string; description: string }>;
  assumptions: string[];
  warnings: string[];
  safetyConsiderations: string[];
  assistantText: string;
};

/**
 * Safe normalizations applied before schema validation:
 * - trim and collapse whitespace on text fields;
 * - normalize exact difficulty enum casing;
 * - default omitted optional arrays to [];
 * - dedupe keyword arrays;
 * - remove empty optional notes;
 * - normalize integer-like estimatedMinutes and quantities when exact.
 */
export const normalizeAuthoringProposalProviderPayload = (
  raw: unknown,
): NormalizedAuthoringProposalProviderPayload => {
  const record =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const projectRecord =
    record.project && typeof record.project === 'object'
      ? (record.project as Record<string, unknown>)
      : {};

  const difficulty = normalizeDifficulty(String(projectRecord.difficulty ?? ''));
  if (!difficulty) {
    throw new Error('invalid difficulty');
  }

  const requiredComponents = Array.isArray(record.requiredComponents)
    ? record.requiredComponents
    : [];

  const steps = Array.isArray(record.steps) ? record.steps : [];

  return {
    project: {
      title: cleanBoundedText(String(projectRecord.title ?? ''), 200),
      shortDescription: cleanBoundedText(
        String(projectRecord.shortDescription ?? ''),
        500,
      ),
      description: cleanBoundedText(String(projectRecord.description ?? ''), 10000),
      difficulty,
      estimatedMinutes: normalizeIntegerLike(
        typeof projectRecord.estimatedMinutes === 'number'
          ? projectRecord.estimatedMinutes
          : typeof projectRecord.estimatedDurationMinutes === 'number'
            ? projectRecord.estimatedDurationMinutes
            : undefined,
      ),
    },
    requiredComponents: requiredComponents.map((entry) => {
      const component =
        entry && typeof entry === 'object'
          ? (entry as Record<string, unknown>)
          : {};
      const componentName = cleanBoundedText(
        String(component.componentName ?? component.name ?? ''),
        200,
      );
      const keywords = normalizeKeywordArray(
        componentName,
        Array.isArray(component.searchKeywords)
          ? component.searchKeywords.map((value) => String(value))
          : [],
        Array.isArray(component.alternativeKeywords)
          ? component.alternativeKeywords.map((value) => String(value))
          : [],
      );
      const normalized = normalizeSubmitComponent({
        name: componentName,
        quantity:
          typeof component.quantity === 'number' ? component.quantity : 1,
        unit:
          typeof component.unit === 'string' ? component.unit : undefined,
        notes: typeof component.notes === 'string' ? component.notes : undefined,
        isRequired:
          typeof component.isRequired === 'boolean'
            ? component.isRequired
            : true,
        componentRole: normalizeComponentRole(
          typeof component.componentRole === 'string'
            ? component.componentRole
            : undefined,
        ),
        materialType:
          typeof component.materialType === 'string'
            ? component.materialType
            : undefined,
        searchKeywords: keywords.searchKeywords,
        canBeSubstituted:
          typeof component.canBeSubstituted === 'boolean'
            ? component.canBeSubstituted
            : false,
      });

      return {
        componentName: normalized.name,
        materialType: resolveSubmitMaterialType(
          normalized.name,
          normalized.materialType,
        ),
        quantity: normalized.quantity,
        unit: normalized.unit,
        componentRole: normalized.componentRole,
        isRequired: normalized.isRequired,
        canBeSubstituted: normalized.canBeSubstituted,
        searchKeywords: normalized.searchKeywords,
        alternativeKeywords: keywords.alternativeKeywords,
        notes: normalized.notes,
      };
    }),
    steps: steps.map((entry) => {
      const step =
        entry && typeof entry === 'object'
          ? (entry as Record<string, unknown>)
          : {};
      return {
        title: cleanBoundedText(String(step.title ?? ''), 200),
        description: cleanBoundedText(String(step.description ?? ''), 5000),
      };
    }),
    assumptions: (Array.isArray(record.assumptions) ? record.assumptions : [])
      .map((value) => cleanBoundedText(String(value), 500))
      .filter((value) => value.length > 0)
      .slice(0, MAX_PROPOSAL_ASSUMPTIONS),
    warnings: (Array.isArray(record.warnings) ? record.warnings : [])
      .map((value) => cleanBoundedText(String(value), 500))
      .filter((value) => value.length > 0)
      .slice(0, MAX_PROPOSAL_WARNINGS),
    safetyConsiderations: (
      Array.isArray(record.safetyConsiderations)
        ? record.safetyConsiderations
        : []
    )
      .map((value) => cleanBoundedText(String(value), 500))
      .filter((value) => value.length > 0)
      .slice(0, MAX_PROPOSAL_SAFETY_NOTES),
    assistantText: cleanBoundedText(String(record.assistantText ?? ''), 4000),
  };
};

export const parseAuthoringProposalProviderPayload = (input: {
  raw: unknown;
  provider: string;
  attempt: number;
}) => {
  try {
    const normalized = normalizeAuthoringProposalProviderPayload(input.raw);
    return aiAuthoringProposalProviderSchema.parse(normalized);
  } catch (error) {
    recordAuthoringProposalValidationDiagnostic({
      provider: input.provider,
      attempt: input.attempt,
      stage: 'schema',
      issues: [
        {
          code: 'schema_invalid',
          message:
            error instanceof ZodError
              ? error.issues.map((issue) => issue.message).join('; ')
              : error instanceof Error
                ? error.message
                : 'Invalid proposal payload',
        },
      ],
    });
    throw error;
  }
};

export type AuthoringProposalQualityContext = {
  locale: AiLocale;
  ideaText: string;
  categoryName: string | null;
  draftDifficulty: string | null;
  clarification: AiProjectAuthoringClarificationBlock;
  recentAuthoringAnswers: string[];
};

export type AuthoringProposalQualityResult =
  | { ok: true; warnings: string[] }
  | { ok: false; reason: string; issues: string[] };

const corpusFromContext = (context: AuthoringProposalQualityContext) =>
  [
    context.ideaText,
    context.clarification.summary,
    ...context.clarification.knownFacts.map((fact) => `${fact.label} ${fact.value}`),
    ...context.clarification.assumptions,
    ...context.recentAuthoringAnswers,
  ]
    .join('\n')
    .toLowerCase();

const containsConstraint = (corpus: string, patterns: RegExp[]) =>
  patterns.some((pattern) => pattern.test(corpus));

const majorComponents = (
  components: NormalizedAuthoringProposalProviderPayload['requiredComponents'],
) =>
  components
    .filter((component) => component.isRequired)
    .map((component) => component.componentName.trim().toLowerCase())
    .filter((name) => name.length > 0);

const stepCorpus = (
  steps: NormalizedAuthoringProposalProviderPayload['steps'],
) => steps.map((step) => `${step.title} ${step.description}`.toLowerCase()).join('\n');

const referencesComponent = (haystack: string, componentName: string) => {
  const tokens = componentName
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06ff]+/i)
    .filter((token) => token.length > 2);
  if (tokens.length === 0) {
    return haystack.includes(componentName.toLowerCase());
  }
  return tokens.some((token) => haystack.includes(token));
};

export const validateAuthoringProposalQuality = (
  proposal: NormalizedAuthoringProposalProviderPayload,
  context: AuthoringProposalQualityContext,
): AuthoringProposalQualityResult => {
  const issues: string[] = [];
  const warnings: string[] = [...proposal.warnings];
  const corpus = corpusFromContext(context);
  const stepsText = stepCorpus(proposal.steps);
  const majors = majorComponents(proposal.requiredComponents);

  if (proposal.requiredComponents.length < MIN_PROPOSAL_COMPONENTS) {
    issues.push('At least one required component is needed.');
  }

  if (proposal.requiredComponents.length > MAX_PROPOSAL_COMPONENTS) {
    issues.push('Too many required components.');
  }

  if (proposal.steps.length < MIN_PROPOSAL_STEPS) {
    issues.push(`At least ${MIN_PROPOSAL_STEPS} steps are required.`);
  }

  if (proposal.steps.length > MAX_PROPOSAL_STEPS) {
    issues.push('Too many proposal steps.');
  }

  const componentKeys = new Set<string>();
  for (const component of proposal.requiredComponents) {
    const key = component.componentName.trim().toLowerCase();
    if (key.length === 0) {
      issues.push('Component name is required.');
      continue;
    }
    if (componentKeys.has(key)) {
      issues.push(`Duplicate component name: ${component.componentName}`);
    }
    componentKeys.add(key);
  }

  const stepSignatures = new Set<string>();
  for (const step of proposal.steps) {
    const signature = `${step.title.trim().toLowerCase()}|${step.description
      .trim()
      .toLowerCase()}`;
    if (stepSignatures.has(signature)) {
      issues.push('Duplicate proposal steps are not allowed.');
      break;
    }
    stepSignatures.add(signature);
  }

  if (majors.length > 0) {
    const referencedInSteps = majors.filter((component) =>
      referencesComponent(stepsText, component),
    );
    if (referencedInSteps.length === 0) {
      issues.push('Steps should use the listed major components.');
    }
  }

  const availabilityCorpus = [
    proposal.project.title,
    proposal.project.shortDescription,
    proposal.project.description,
    ...proposal.requiredComponents.map((component) => component.notes ?? ''),
    ...proposal.steps.map((step) => `${step.title} ${step.description}`),
    ...proposal.assumptions,
  ].join('\n');

  if (AVAILABILITY_CLAIM_PATTERNS.some((pattern) => pattern.test(availabilityCorpus))) {
    issues.push('Proposal must not claim platform availability or supplier data.');
  }

  if (
    containsConstraint(corpus, [/\bno pump\b/i, /\bwithout (a )?pump\b/i, /\bno water pump\b/i]) &&
    [...proposal.requiredComponents, ...proposal.steps].some((entry) => {
      const text = JSON.stringify(entry).toLowerCase();
      return text.includes('pump');
    })
  ) {
    issues.push('Learner constraint forbids a pump but proposal includes one.');
  }

  if (
    context.draftDifficulty === 'BEGINNER' &&
    proposal.project.difficulty === 'ADVANCED'
  ) {
    warnings.push(
      context.locale === 'ar'
        ? 'اقترح المساعد صعوبة متقدمة لمشروع مبتدئ.'
        : 'The assistant proposed advanced difficulty for a beginner-scoped idea.',
    );
  }

  if (
    context.draftDifficulty &&
    context.draftDifficulty !== proposal.project.difficulty
  ) {
    warnings.push(
      context.locale === 'ar'
        ? `صعوبة المسودة الحالية (${context.draftDifficulty}) تختلف عن الصعوبة المقترحة (${proposal.project.difficulty}).`
        : `Draft difficulty (${context.draftDifficulty}) differs from proposed difficulty (${proposal.project.difficulty}).`,
    );
  }

  if (issues.length > 0) {
    return { ok: false, reason: 'quality_policy', issues };
  }

  return { ok: true, warnings };
};

export const buildAuthoringProposalRepairIssue = (input: {
  schemaError?: string;
  quality?: Extract<AuthoringProposalQualityResult, { ok: false }>;
}) => {
  const issues = [
    ...(input.schemaError ? [input.schemaError] : []),
    ...(input.quality?.issues ?? []),
  ].slice(0, 12);

  return [
    'Fix the proposal JSON to satisfy ImpactLoop authoring proposal schema and quality rules.',
    'Do not include IDs, category IDs, step numbers, availability claims, supplier/reservation data, or external citations.',
    'Return strict JSON with keys: project, requiredComponents, steps, assumptions, warnings, safetyConsiderations, assistantText.',
    'Component names must be unique. Steps must be ordered, non-empty, and reference major components.',
    ...issues.map((issue) => `- ${issue}`),
  ].join('\n');
};

export const stampAuthoringProposalBlock = (input: {
  proposalId: string;
  baseUpdatedAt: string;
  clarificationMessageId: string;
  categoryDisplayName: string;
  providerPayload: NormalizedAuthoringProposalProviderPayload;
  extraWarnings?: string[];
  version?: number;
  parentProposalId?: string;
  revisionReviewStateId?: string;
}): AiProjectAuthoringProposalBlock => {
  const block = {
    type: 'project_authoring_proposal' as const,
    proposalId: input.proposalId,
    version: input.version ?? 1,
    parentProposalId: input.parentProposalId,
    revisionReviewStateId: input.revisionReviewStateId,
    baseUpdatedAt: input.baseUpdatedAt,
    clarificationMessageId: input.clarificationMessageId,
    status: 'PREVIEW' as const,
    categoryDisplayName: input.categoryDisplayName,
    project: input.providerPayload.project,
    requiredComponents: input.providerPayload.requiredComponents,
    steps: input.providerPayload.steps,
    assumptions: input.providerPayload.assumptions,
    warnings: [
      ...input.providerPayload.warnings,
      ...(input.extraWarnings ?? []),
    ].slice(0, MAX_PROPOSAL_WARNINGS),
    safetyConsiderations: input.providerPayload.safetyConsiderations,
  };

  return aiProjectAuthoringProposalBlockSchema.parse(block);
};

type ProposalDiagnostic = {
  provider: string;
  attempt: number;
  stage: 'schema' | 'quality' | 'server_policy';
  issues: Array<{ code: string; message: string }>;
};

let lastProposalDiagnostic: ProposalDiagnostic | null = null;

export const recordAuthoringProposalValidationDiagnostic = (
  diagnostic: ProposalDiagnostic,
) => {
  lastProposalDiagnostic = diagnostic;
};

export const getLastAuthoringProposalValidationDiagnosticForTests = () =>
  lastProposalDiagnostic;

export const resetAuthoringProposalValidationDiagnosticForTests = () => {
  lastProposalDiagnostic = null;
};
