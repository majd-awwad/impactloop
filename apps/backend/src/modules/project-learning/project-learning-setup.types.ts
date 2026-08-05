import type { LearnerLearningSessionDto } from './project-learning.dto.js';

export type LearningSetupStatus =
  | 'READY'
  | 'PREPARING'
  | 'UNAVAILABLE'
  | 'NOT_REQUESTED';

export type LearningSetupMetadata = {
  status: LearningSetupStatus;
  sessionId: string | null;
  packVersion: number | null;
  startQuestionCount: number;
  reasonCode: string | null;
  retryAfterSeconds?: number | null;
  /** Learner may explicitly retry setup for this Build. */
  retryable?: boolean;
};

export type SetupLearningSessionResult =
  | {
      status: 'READY';
      session: LearnerLearningSessionDto;
      setup: LearningSetupMetadata;
    }
  | {
      status: 'PREPARING';
      setup: LearningSetupMetadata;
    }
  | {
      status: 'UNAVAILABLE';
      setup: LearningSetupMetadata;
    };
