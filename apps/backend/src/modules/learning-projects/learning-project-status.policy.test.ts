import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  LearningProjectStatus,
  ProjectBuildStatus,
} from '../../generated/prisma/client.js';

import {
  ACTIVE_PROJECT_BUILD_STATUSES,
  EDITABLE_LEARNING_PROJECT_SUBMISSION_STATUSES,
  RESUBMITTABLE_LEARNING_PROJECT_STATUSES,
  SUBMITTABLE_LEARNING_PROJECT_STATUSES,
  isActiveProjectBuildStatus,
  isLearningProjectResubmittable,
  isLearningProjectSubmissionEditable,
  isLearningProjectSubmittable,
} from './learning-project-status.policy.js';

describe('learning project status policy', () => {
  test('defines learner submission actions from one status policy', () => {
    assert.deepEqual(EDITABLE_LEARNING_PROJECT_SUBMISSION_STATUSES, [
      'DRAFT',
      'CHANGES_REQUESTED',
      'PENDING_REVIEW',
    ]);
    assert.deepEqual(SUBMITTABLE_LEARNING_PROJECT_STATUSES, ['DRAFT']);
    assert.deepEqual(RESUBMITTABLE_LEARNING_PROJECT_STATUSES, [
      'CHANGES_REQUESTED',
    ]);

    for (const status of Object.values(LearningProjectStatus)) {
      assert.equal(
        isLearningProjectSubmissionEditable(status),
        EDITABLE_LEARNING_PROJECT_SUBMISSION_STATUSES.includes(
          status as (typeof EDITABLE_LEARNING_PROJECT_SUBMISSION_STATUSES)[number],
        ),
      );
      assert.equal(
        isLearningProjectSubmittable(status),
        status === 'DRAFT',
      );
      assert.equal(
        isLearningProjectResubmittable(status),
        status === 'CHANGES_REQUESTED',
      );
    }
  });

  test('defines active build statuses from one status policy', () => {
    assert.deepEqual(ACTIVE_PROJECT_BUILD_STATUSES, [
      'IN_PROGRESS',
      'PAUSED',
    ]);

    for (const status of Object.values(ProjectBuildStatus)) {
      assert.equal(
        isActiveProjectBuildStatus(status),
        status === 'IN_PROGRESS' || status === 'PAUSED',
      );
    }
  });
});
