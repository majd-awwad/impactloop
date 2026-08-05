import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildDeterministicLearningAssignmentsFromCandidates,
} from './project-learning-assignment-selection.js';
import {
  classifyProjectLearningQuestionQuality,
  computeQuestionQualityFromAssignments,
  QUESTION_QUALITY_MIN_SAMPLE,
} from './project-learning-question-quality.service.js';
import type { ProjectLearningPackRecord } from './project-learning-pack.repository.js';

const baseAssignment = (overrides: Partial<{
  id: string;
  status: string;
  hintViewedAt: Date | null;
  aiExplanationRequestedAt: Date | null;
  createdAt: Date;
  answerAttempts: Array<{ isCorrect: boolean; submittedAt: Date; attemptNumber: number }>;
  feedback: Array<{ clearedAt: Date | null }>;
}> = {}) => ({
  id: overrides.id ?? 'a1',
  questionId: 'q1',
  status: overrides.status ?? 'NOT_ATTEMPTED',
  hintViewedAt: overrides.hintViewedAt ?? null,
  aiExplanationRequestedAt: overrides.aiExplanationRequestedAt ?? null,
  createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
  answerAttempts: overrides.answerAttempts ?? [],
  feedback: overrides.feedback ?? [],
});

describe('project learning question quality LH-20', () => {
  test('new question with no assignments is INSUFFICIENT_DATA', () => {
    const metrics = computeQuestionQualityFromAssignments('q1', []);
    assert.equal(metrics.classification, 'INSUFFICIENT_DATA');
    assert.equal(metrics.assignmentCount, 0);
  });

  test('low sample size remains INSUFFICIENT_DATA', () => {
    const assignments = Array.from({ length: QUESTION_QUALITY_MIN_SAMPLE - 1 }, (_, i) =>
      baseAssignment({
        id: `a${i}`,
        status: 'ANSWERED',
        answerAttempts: [
          {
            isCorrect: false,
            attemptNumber: 1,
            submittedAt: new Date(),
          },
        ],
      }),
    );
    const metrics = computeQuestionQualityFromAssignments('q1', assignments);
    assert.equal(metrics.classification, 'INSUFFICIENT_DATA');
  });

  test('healthy usage classifies HEALTHY', () => {
    const assignments = Array.from({ length: 12 }, (_, i) =>
      baseAssignment({
        id: `a${i}`,
        status: 'ANSWERED',
        answerAttempts: [
          {
            isCorrect: true,
            attemptNumber: 1,
            submittedAt: new Date(),
          },
        ],
      }),
    );
    const metrics = computeQuestionQualityFromAssignments('q1', assignments);
    assert.equal(metrics.classification, 'HEALTHY');
    assert.equal(metrics.firstAttemptCorrectCount, 12);
    assert.equal(metrics.eventualCorrectCount, 12);
  });

  test('high unclear-report rate classifies NEEDS_REVIEW', () => {
    const assignments = Array.from({ length: 12 }, (_, i) =>
      baseAssignment({
        id: `a${i}`,
        status: 'ANSWERED',
        answerAttempts: [
          {
            isCorrect: true,
            attemptNumber: 1,
            submittedAt: new Date(),
          },
        ],
        feedback: i < 4 ? [{ clearedAt: null }] : [],
      }),
    );
    const metrics = computeQuestionQualityFromAssignments('q1', assignments);
    assert.equal(metrics.classification, 'NEEDS_REVIEW');
  });

  test('high skip rate classifies NEEDS_REVIEW', () => {
    const assignments = Array.from({ length: 12 }, (_, i) =>
      baseAssignment({
        id: `a${i}`,
        status: i < 8 ? 'SKIPPED' : 'ANSWERED',
        answerAttempts:
          i < 8
            ? []
            : [
                {
                  isCorrect: true,
                  attemptNumber: 1,
                  submittedAt: new Date(),
                },
              ],
      }),
    );
    const metrics = computeQuestionQualityFromAssignments('q1', assignments);
    assert.equal(metrics.classification, 'NEEDS_REVIEW');
  });

  test('very low eventual-correct rate classifies NEEDS_REVIEW', () => {
    const assignments = Array.from({ length: 12 }, (_, i) =>
      baseAssignment({
        id: `a${i}`,
        status: 'ANSWERED',
        answerAttempts: [
          {
            isCorrect: i === 0,
            attemptNumber: 1,
            submittedAt: new Date(),
          },
        ],
      }),
    );
    const metrics = computeQuestionQualityFromAssignments('q1', assignments);
    assert.equal(metrics.classification, 'NEEDS_REVIEW');
  });

  test('multiple severe signals may classify DEPRIORITIZED', () => {
    const classification = classifyProjectLearningQuestionQuality({
      assignmentCount: 20,
      handledCount: 20,
      skipRate: 0.65,
      hintRate: 0.8,
      eventualCorrectRate: 0.1,
      unclearReportRate: 0.45,
      firstAttemptCorrectRate: 0.05,
    });
    assert.equal(classification, 'DEPRIORITIZED');
  });

  test('difficult but understandable question is not automatically deprioritized', () => {
    const assignments = Array.from({ length: 12 }, (_, i) =>
      baseAssignment({
        id: `a${i}`,
        status: 'ANSWERED',
        hintViewedAt: new Date(),
        answerAttempts: [
          {
            isCorrect: false,
            attemptNumber: 1,
            submittedAt: new Date(),
          },
          {
            isCorrect: true,
            attemptNumber: 2,
            submittedAt: new Date(),
          },
        ],
      }),
    );
    const metrics = computeQuestionQualityFromAssignments('q1', assignments);
    assert.equal(metrics.classification, 'HEALTHY');
    assert.equal(metrics.firstAttemptCorrectCount, 0);
    assert.equal(metrics.eventualCorrectCount, 12);
    assert.equal(metrics.hintViewedCount, 12);
  });

  test('metrics never expose learner identity fields', () => {
    const metrics = computeQuestionQualityFromAssignments('q1', [
      baseAssignment({
        status: 'ANSWERED',
        answerAttempts: [
          { isCorrect: true, attemptNumber: 1, submittedAt: new Date() },
        ],
      }),
    ]);
    assert.ok(!('learnerId' in metrics));
    assert.ok(!('email' in metrics));
  });

  test('multiple answer attempts do not inflate assignment count', () => {
    const metrics = computeQuestionQualityFromAssignments('q1', [
      baseAssignment({
        status: 'ANSWERED',
        answerAttempts: [
          { isCorrect: false, attemptNumber: 1, submittedAt: new Date() },
          { isCorrect: true, attemptNumber: 2, submittedAt: new Date() },
        ],
      }),
    ]);
    assert.equal(metrics.assignmentCount, 1);
    assert.equal(metrics.answeredCount, 1);
    assert.equal(metrics.firstAttemptCorrectCount, 0);
    assert.equal(metrics.eventualCorrectCount, 1);
  });

  test('skip followed by answer uses final answered state', () => {
    const metrics = computeQuestionQualityFromAssignments('q1', [
      baseAssignment({
        status: 'ANSWERED',
        answerAttempts: [
          { isCorrect: true, attemptNumber: 1, submittedAt: new Date() },
        ],
      }),
    ]);
    assert.equal(metrics.skippedCount, 0);
    assert.equal(metrics.answeredCount, 1);
  });

  test('AI explanation request counted once per assignment', () => {
    const metrics = computeQuestionQualityFromAssignments('q1', [
      baseAssignment({
        status: 'ANSWERED',
        aiExplanationRequestedAt: new Date(),
        answerAttempts: [
          { isCorrect: false, attemptNumber: 1, submittedAt: new Date() },
        ],
      }),
    ]);
    assert.equal(metrics.aiExplanationRequestedCount, 1);
  });

  test('quality-aware STEP selection prefers HEALTHY over NEEDS_REVIEW', () => {
    const pack = {
      id: 'pack',
      projectId: 'project',
      versionNumber: 1,
      contentHash: 'hash',
      status: 'READY',
      questions: [
        {
          id: 'q-review',
          stage: 'STEP',
          projectStepId: 'step-1',
          orderScopeKey: 'step:step-1',
          packDisplayOrder: 1,
        },
        {
          id: 'q-healthy',
          stage: 'STEP',
          projectStepId: 'step-1',
          orderScopeKey: 'step:step-1',
          packDisplayOrder: 2,
        },
      ],
    } as unknown as ProjectLearningPackRecord;

    const selected = buildDeterministicLearningAssignmentsFromCandidates({
      pack,
      buildId: 'build-1',
      projectStepIds: ['step-1'],
      qualityByQuestionId: {
        'q-review': 'NEEDS_REVIEW',
        'q-healthy': 'HEALTHY',
      },
    });

    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.questionId, 'q-healthy');
  });

  test('only available STEP question is still assigned when review recommended', () => {
    const pack = {
      id: 'pack',
      projectId: 'project',
      versionNumber: 1,
      contentHash: 'hash',
      status: 'READY',
      questions: [
        {
          id: 'q-only',
          stage: 'STEP',
          projectStepId: 'step-1',
          orderScopeKey: 'step:step-1',
          packDisplayOrder: 1,
        },
      ],
    } as unknown as ProjectLearningPackRecord;

    const selected = buildDeterministicLearningAssignmentsFromCandidates({
      pack,
      buildId: 'build-1',
      projectStepIds: ['step-1'],
      qualityByQuestionId: {
        'q-only': 'DEPRIORITIZED',
      },
    });

    assert.equal(selected[0]?.questionId, 'q-only');
  });

  test('same build receives stable STEP selection within quality class', () => {
    const pack = {
      id: 'pack',
      projectId: 'project',
      versionNumber: 1,
      contentHash: 'hash',
      status: 'READY',
      questions: [
        {
          id: 'q-a',
          stage: 'STEP',
          projectStepId: 'step-1',
          orderScopeKey: 'step:step-1',
          packDisplayOrder: 1,
        },
        {
          id: 'q-b',
          stage: 'STEP',
          projectStepId: 'step-1',
          orderScopeKey: 'step:step-1',
          packDisplayOrder: 2,
        },
      ],
    } as unknown as ProjectLearningPackRecord;

    const first = buildDeterministicLearningAssignmentsFromCandidates({
      pack,
      buildId: 'build-stable',
      projectStepIds: ['step-1'],
      qualityByQuestionId: {
        'q-a': 'HEALTHY',
        'q-b': 'HEALTHY',
      },
    });
    const second = buildDeterministicLearningAssignmentsFromCandidates({
      pack,
      buildId: 'build-stable',
      projectStepIds: ['step-1'],
      qualityByQuestionId: {
        'q-a': 'HEALTHY',
        'q-b': 'HEALTHY',
      },
    });
    assert.deepEqual(first, second);
  });

  test('rates never divide by zero', () => {
    const metrics = computeQuestionQualityFromAssignments('q1', []);
    assert.equal(metrics.handledRate, null);
    assert.equal(metrics.skipRate, null);
    assert.equal(metrics.hintRate, null);
    assert.equal(metrics.firstAttemptCorrectRate, null);
    assert.equal(metrics.eventualCorrectRate, null);
    assert.equal(metrics.unclearReportRate, null);
  });
});
