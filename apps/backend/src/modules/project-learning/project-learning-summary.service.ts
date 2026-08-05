import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

export const LEARNING_SUMMARY_SCHEMA_VERSION = 1;

export type LearningCheckProgressDto = {
  total: number;
  answered: number;
  correct: number;
  skipped: number;
  remaining: number;
  handled: number;
};

export type LearningSummaryConceptDto = {
  conceptKey: string;
  labelEn: string;
  labelAr: string;
};

export type BuildLearningSummaryDto = {
  schemaVersion: number;
  generatedAt: string;
  startCheck: LearningCheckProgressDto;
  stepChecks: LearningCheckProgressDto;
  finalCheck: LearningCheckProgressDto;
  understoodConcepts: LearningSummaryConceptDto[];
  reviewConcepts: LearningSummaryConceptDto[];
  uncheckedConceptCount: number;
  confidenceBefore: number | null;
  confidenceAfter: number | null;
  goalOutcome: string | null;
};

type AssignmentForSummary = {
  stage: string;
  status: string;
  answerAttempts: Array<{ isCorrect: boolean }>;
  question: {
    conceptKey: string;
    promptEn: string;
    promptAr: string;
  };
};

const emptyProgress = (): LearningCheckProgressDto => ({
  total: 0,
  answered: 0,
  correct: 0,
  skipped: 0,
  remaining: 0,
  handled: 0,
});

export const computeStageProgress = (
  assignments: AssignmentForSummary[],
): LearningCheckProgressDto => {
  const total = assignments.length;
  let answered = 0;
  let correct = 0;
  let skipped = 0;

  for (const assignment of assignments) {
    const hasAttempt = assignment.answerAttempts.length > 0;
    const hasCorrect = assignment.answerAttempts.some((attempt) => attempt.isCorrect);
    const isSkippedOnly =
      assignment.status === 'SKIPPED' && !hasAttempt;

    if (hasAttempt) {
      answered += 1;
    }
    if (hasCorrect) {
      correct += 1;
    }
    if (isSkippedOnly) {
      skipped += 1;
    }
  }

  const handled = answered + skipped;
  return {
    total,
    answered,
    correct,
    skipped,
    remaining: Math.max(0, total - handled),
    handled,
  };
};

const truncateLabel = (value: string, max = 80): string => {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
};

const CONCEPT_LABELS: Record<string, { en: string; ar: string }> = {
  component_purpose: { en: 'Component purpose', ar: 'غرض المكون' },
  safe_preparation: { en: 'Safe preparation', ar: 'التحضير الآمن' },
  materials_readiness: { en: 'Materials readiness', ar: 'جاهزية المواد' },
  component_role_application: {
    en: 'Component role',
    ar: 'دور المكون',
  },
  circuit_troubleshooting: {
    en: 'Build troubleshooting',
    ar: 'استكشاف أعطال البناء',
  },
  sequence_integrity: { en: 'Step sequence', ar: 'تسلسل الخطوات' },
  build_verification: { en: 'Build verification', ar: 'التحقق من البناء' },
  project_goal_basics: { en: 'Project goal', ar: 'هدف المشروع' },
  safety_first: { en: 'Safety first', ar: 'السلامة أولًا' },
  project_wrap_up: { en: 'Project wrap-up', ar: 'ختام المشروع' },
  material_purpose: { en: 'Material purpose', ar: 'غرض المادة' },
  troubleshooting_basics: {
    en: 'Troubleshooting basics',
    ar: 'أساسيات استكشاف الأعطال',
  },
  difficulty_awareness: {
    en: 'Difficulty awareness',
    ar: 'وعي بمستوى الصعوبة',
  },
};

const labelsForConceptKey = (
  conceptKey: string,
): { labelEn: string; labelAr: string } => {
  const known = CONCEPT_LABELS[conceptKey];
  if (known) {
    return { labelEn: known.en, labelAr: known.ar };
  }

  if (/^step_\d+_purpose$/.test(conceptKey)) {
    return {
      labelEn: 'Step purpose',
      labelAr: 'غرض الخطوة',
    };
  }

  if (/^step_\d+_verification$/.test(conceptKey)) {
    return {
      labelEn: 'Step verification',
      labelAr: 'التحقق من الخطوة',
    };
  }

  if (/^step_\d+_focus$/.test(conceptKey)) {
    return {
      labelEn: 'Step focus',
      labelAr: 'تركيز الخطوة',
    };
  }

  if (/^step_\d+_sequence$/.test(conceptKey)) {
    return {
      labelEn: 'Step sequence',
      labelAr: 'تسلسل الخطوة',
    };
  }

  const humanized = conceptKey
    .split('_')
    .filter((part) => part.length > 0 && !/^\d+$/.test(part))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return {
    labelEn: truncateLabel(humanized || conceptKey),
    labelAr: truncateLabel(humanized || conceptKey),
  };
};

export const computeBuildLearningSummaryFromAssignments = (input: {
  learningGoal?: string | null;
  confidenceBefore: number | null;
  confidenceAfter: number | null;
  goalOutcome: string | null;
  assignments: AssignmentForSummary[];
  generatedAt?: Date;
}): BuildLearningSummaryDto => {
  const startAssignments = input.assignments.filter((item) => item.stage === 'START');
  const stepAssignments = input.assignments.filter((item) => item.stage === 'STEP');
  const finalAssignments = input.assignments.filter((item) => item.stage === 'FINAL');

  const learningAssignments = [...stepAssignments, ...finalAssignments];
  const byConcept = new Map<
    string,
    {
      conceptKey: string;
      labelEn: string;
      labelAr: string;
      hasCorrect: boolean;
      handled: boolean;
    }
  >();

  for (const assignment of learningAssignments) {
    const conceptKey = assignment.question.conceptKey.trim();
    if (!conceptKey) {
      continue;
    }

    const hasAttempt = assignment.answerAttempts.length > 0;
    const hasCorrect = assignment.answerAttempts.some((attempt) => attempt.isCorrect);
    const isSkippedOnly = assignment.status === 'SKIPPED' && !hasAttempt;
    const handled = hasAttempt || isSkippedOnly;

    const existing = byConcept.get(conceptKey);
    if (!existing) {
      const labels = labelsForConceptKey(conceptKey);
      byConcept.set(conceptKey, {
        conceptKey,
        labelEn: labels.labelEn,
        labelAr: labels.labelAr,
        hasCorrect,
        handled,
      });
      continue;
    }

    existing.hasCorrect = existing.hasCorrect || hasCorrect;
    existing.handled = existing.handled || handled;
  }

  const understoodConcepts: LearningSummaryConceptDto[] = [];
  const reviewConcepts: LearningSummaryConceptDto[] = [];
  let uncheckedConceptCount = 0;

  for (const concept of byConcept.values()) {
    if (concept.hasCorrect) {
      understoodConcepts.push({
        conceptKey: concept.conceptKey,
        labelEn: concept.labelEn,
        labelAr: concept.labelAr,
      });
      continue;
    }

    if (concept.handled) {
      reviewConcepts.push({
        conceptKey: concept.conceptKey,
        labelEn: concept.labelEn,
        labelAr: concept.labelAr,
      });
      continue;
    }

    uncheckedConceptCount += 1;
  }

  understoodConcepts.sort((left, right) =>
    left.conceptKey.localeCompare(right.conceptKey),
  );
  reviewConcepts.sort((left, right) =>
    left.conceptKey.localeCompare(right.conceptKey),
  );

  return {
    schemaVersion: LEARNING_SUMMARY_SCHEMA_VERSION,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    startCheck: computeStageProgress(startAssignments),
    stepChecks: computeStageProgress(stepAssignments),
    finalCheck: computeStageProgress(finalAssignments),
    understoodConcepts,
    reviewConcepts,
    uncheckedConceptCount,
    confidenceBefore: input.confidenceBefore,
    confidenceAfter: input.confidenceAfter,
    goalOutcome: input.goalOutcome,
  };
};

export const computeBuildLearningSummary = async (
  sessionId: string,
): Promise<BuildLearningSummaryDto | null> => {
  const session = await prisma.projectBuildLearningSession.findUnique({
    where: { id: sessionId },
    include: {
      assignments: {
        include: {
          question: {
            select: {
              conceptKey: true,
              promptEn: true,
              promptAr: true,
            },
          },
          answerAttempts: {
            select: { isCorrect: true },
            orderBy: { attemptNumber: 'asc' },
          },
        },
        orderBy: [
          { stage: 'asc' },
          { orderScopeKey: 'asc' },
          { displayOrder: 'asc' },
        ],
      },
    },
  });

  if (!session) {
    return null;
  }

  return computeBuildLearningSummaryFromAssignments({
    learningGoal: session.learningGoal,
    confidenceBefore: session.confidenceBefore,
    confidenceAfter: session.confidenceAfter,
    goalOutcome: session.goalOutcome,
    assignments: session.assignments,
  });
};

export const persistBuildLearningSummary = async (
  sessionId: string,
): Promise<BuildLearningSummaryDto | null> => {
  const summary = await computeBuildLearningSummary(sessionId);
  if (!summary) {
    return null;
  }

  await prisma.projectBuildLearningSession.update({
    where: { id: sessionId },
    data: {
      learningSummary: summary as unknown as Prisma.InputJsonValue,
    },
  });

  return summary;
};

export const resolveLearningSummaryForSession = async (
  session: {
    id: string;
    learningSummary: Prisma.JsonValue | null;
  },
): Promise<BuildLearningSummaryDto | null> => {
  if (
    session.learningSummary &&
    typeof session.learningSummary === 'object' &&
    !Array.isArray(session.learningSummary) &&
    (session.learningSummary as { schemaVersion?: unknown }).schemaVersion ===
      LEARNING_SUMMARY_SCHEMA_VERSION
  ) {
    return session.learningSummary as BuildLearningSummaryDto;
  }

  return computeBuildLearningSummary(session.id);
};
