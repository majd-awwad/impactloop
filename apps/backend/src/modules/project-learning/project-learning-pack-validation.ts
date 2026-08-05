import { AppError } from '../../utils/app-error.js';

import type { ProjectLearningCanonicalSnapshot } from './project-learning-snapshot.js';
import {
  generatedLearningPackSchema,
  type GeneratedLearningPack,
  type GeneratedLearningPackQuestion,
} from './project-learning-pack-generation.schema.js';
import { containsUnsafeProjectLearningMarkup } from './project-learning-text.js';

const CONCEPT_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

const FORBIDDEN_DISTRACTOR_PATTERN =
  /\b(skip all|ignore (required )?materials|ignore (the )?(project )?outcome|change (the )?step order randomly|discard learning|do nothing|choose anything|ignore safety|connect components arbitrarily|complete it only because|rush without checking materials)\b/i;

const STEP_TITLE_ONLY_CORRECT_PATTERN =
  /^(complete\s+step\s+\d+\b.*|اتبع\s*الخطوة|أكمل\s*الخطوة\s*\d+)/i;

const GENERIC_CONCEPT_KEYS = new Set([
  'concept',
  'question',
  'generic',
  'misc',
  'other',
  'test',
  'todo',
]);

const hasDuplicateValues = (values: string[]): boolean => {
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (seen.has(normalized)) {
      return true;
    }
    seen.add(normalized);
  }
  return false;
};

const validateQuestionSemantics = (
  question: GeneratedLearningPackQuestion,
  stepIds: Set<string>,
  stepsById: Map<string, { title: string; description: string }>,
) => {
  if (!CONCEPT_KEY_PATTERN.test(question.conceptKey)) {
    throw new AppError(
      'Generated concept key is invalid.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'conceptKey' },
    );
  }

  if (GENERIC_CONCEPT_KEYS.has(question.conceptKey)) {
    throw new AppError(
      'Generated concept key is too generic.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'conceptKey' },
    );
  }

  for (const field of [
    question.promptEn,
    question.promptAr,
    question.explanationEn,
    question.explanationAr,
    question.hintEn,
    question.hintAr,
  ]) {
    if (containsUnsafeProjectLearningMarkup(field)) {
      throw new AppError(
        'Generated question text contains unsupported markup.',
        422,
        'LEARNING_PACK_VALIDATION_FAILED',
        { field: 'markup' },
      );
    }
  }

  if (
    !question.explanationEn.trim() ||
    !question.explanationAr.trim()
  ) {
    throw new AppError(
      'Generated explanation must be present in English and Arabic.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'explanation' },
    );
  }

  if (question.stage === 'STEP') {
    if (!question.projectStepId) {
      throw new AppError(
        'STEP questions require a project step.',
        422,
        'LEARNING_PACK_VALIDATION_FAILED',
        { field: 'projectStepId' },
      );
    }
    if (!stepIds.has(question.projectStepId)) {
      throw new AppError(
        'Generated question references an unknown project step.',
        422,
        'LEARNING_PACK_VALIDATION_FAILED',
        { field: 'projectStepId' },
      );
    }
  } else if (question.projectStepId) {
    throw new AppError(
      'START and FINAL questions cannot reference a project step.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'projectStepId' },
    );
  }

  const optionKeys = question.options.map((option) => option.optionKey);
  if (new Set(optionKeys).size !== optionKeys.length) {
    throw new AppError(
      'Generated question contains duplicate option keys.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'optionKey' },
    );
  }

  if (!optionKeys.includes(question.correctOptionKey)) {
    throw new AppError(
      'Generated correct option key is invalid.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'correctOptionKey' },
    );
  }

  if (hasDuplicateValues(question.options.map((option) => option.textEn))) {
    throw new AppError(
      'Generated question contains duplicate English options.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'options.textEn' },
    );
  }

  if (hasDuplicateValues(question.options.map((option) => option.textAr))) {
    throw new AppError(
      'Generated question contains duplicate Arabic options.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'options.textAr' },
    );
  }

  for (const option of question.options) {
    if (!option.textEn.trim() || !option.textAr.trim()) {
      throw new AppError(
        'Generated options must be bilingual.',
        422,
        'LEARNING_PACK_VALIDATION_FAILED',
        { field: 'options.bilingual' },
      );
    }

    if (
      option.optionKey !== question.correctOptionKey &&
      FORBIDDEN_DISTRACTOR_PATTERN.test(`${option.textEn} ${option.textAr}`)
    ) {
      throw new AppError(
        'Generated distractor uses a forbidden abandon/ignore pattern.',
        422,
        'LEARNING_PACK_VALIDATION_FAILED',
        { field: 'options.distractor' },
      );
    }
  }

  const correctOption = question.options.find(
    (option) => option.optionKey === question.correctOptionKey,
  );
  if (!correctOption) {
    throw new AppError(
      'Generated correct option key is missing.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'correctOptionKey' },
    );
  }

  const duplicateCorrectText = question.options.some(
    (option) =>
      option.optionKey !== question.correctOptionKey &&
      (option.textEn.trim().toLowerCase() ===
        correctOption.textEn.trim().toLowerCase() ||
        option.textAr.trim().toLowerCase() ===
          correctOption.textAr.trim().toLowerCase()),
  );
  if (duplicateCorrectText) {
    throw new AppError(
      'Generated correct option text is duplicated by a distractor.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'correctOptionKey' },
    );
  }

  if (question.stage === 'STEP' && question.projectStepId) {
    const step = stepsById.get(question.projectStepId);
    if (step) {
      const title = step.title.trim().toLowerCase();
      const correctEn = correctOption.textEn.trim().toLowerCase();
      if (
        STEP_TITLE_ONLY_CORRECT_PATTERN.test(correctOption.textEn) ||
        correctEn === title ||
        correctEn === `complete ${title}` ||
        correctEn === `follow ${title}`
      ) {
        throw new AppError(
          'Generated correct answer must not only repeat the step title.',
          422,
          'LEARNING_PACK_VALIDATION_FAILED',
          { field: 'correctOptionKey' },
        );
      }

      const stepCorpus = `${step.title} ${step.description}`.toLowerCase();
      const promptCorpus = `${question.promptEn} ${question.explanationEn}`.toLowerCase();
      const sharesToken = stepCorpus
        .split(/[^a-z0-9\u0600-\u06ff]+/i)
        .filter((token) => token.length >= 4)
        .some((token) => promptCorpus.includes(token));
      if (step.description.trim().length > 0 && !sharesToken) {
        throw new AppError(
          'Generated STEP question is not clearly connected to step content.',
          422,
          'LEARNING_PACK_VALIDATION_FAILED',
          { field: 'STEP.content' },
        );
      }
    }
  }

  if (question.questionType === 'TRUE_FALSE' && question.options.length !== 2) {
    throw new AppError(
      'TRUE_FALSE questions must have exactly two options.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'options' },
    );
  }

  if (
    (question.questionType === 'MULTIPLE_CHOICE' ||
      question.questionType === 'BEST_ACTION') &&
    (question.options.length < 3 || question.options.length > 4)
  ) {
    throw new AppError(
      'Multiple-choice questions must have 3 or 4 options.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'options' },
    );
  }
};

export const validateGeneratedLearningPack = (
  raw: unknown,
  snapshot: ProjectLearningCanonicalSnapshot,
): GeneratedLearningPack => {
  const parsed = generatedLearningPackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      'Generated learning pack failed schema validation.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { issues: parsed.error.issues.map((issue) => issue.path.join('.')) },
    );
  }

  const pack = parsed.data;
  const stepIds = new Set(snapshot.steps.map((step) => step.id));
  const stepsById = new Map(
    snapshot.steps.map((step) => [
      step.id,
      { title: step.title, description: step.description },
    ]),
  );

  for (const question of pack.questions) {
    validateQuestionSemantics(question, stepIds, stepsById);
  }

  const startQuestions = pack.questions.filter((question) => question.stage === 'START');
  const finalQuestions = pack.questions.filter((question) => question.stage === 'FINAL');
  const stepQuestions = pack.questions.filter((question) => question.stage === 'STEP');

  if (startQuestions.length < 2 || startQuestions.length > 3) {
    throw new AppError(
      'Generated START question count is out of bounds.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'START.count' },
    );
  }

  if (finalQuestions.length < 3 || finalQuestions.length > 5) {
    throw new AppError(
      'Generated FINAL question count is out of bounds.',
      422,
      'LEARNING_PACK_VALIDATION_FAILED',
      { field: 'FINAL.count' },
    );
  }

  for (const step of snapshot.steps) {
    const questionsForStep = stepQuestions.filter(
      (question) => question.projectStepId === step.id,
    );
    if (questionsForStep.length < 1 || questionsForStep.length > 2) {
      throw new AppError(
        'Generated STEP question count is out of bounds for a project step.',
        422,
        'LEARNING_PACK_VALIDATION_FAILED',
        { field: 'STEP.count', stepId: step.id },
      );
    }
  }

  const scopeKeys = new Set<string>();
  for (const question of pack.questions) {
    const scopeKey =
      question.stage === 'STEP'
        ? `${question.stage}:${question.projectStepId}:${question.packDisplayOrder}`
        : `${question.stage}:${question.packDisplayOrder}`;
    if (scopeKeys.has(scopeKey)) {
      throw new AppError(
        'Generated question display order conflicts within a scope.',
        422,
        'LEARNING_PACK_VALIDATION_FAILED',
        { field: 'packDisplayOrder' },
      );
    }
    scopeKeys.add(scopeKey);
  }

  return pack;
};
