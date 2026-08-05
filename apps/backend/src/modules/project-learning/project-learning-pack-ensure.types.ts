export type EnsureLearningPackQuestionCounts = {
  start: number;
  step: number;
  final: number;
  total: number;
};

export type EnsureLearningPackReadyResult = {
  status: 'READY';
  packId: string;
  projectId: string;
  versionNumber: number;
  contentHash: string;
  questionCounts: EnsureLearningPackQuestionCounts;
};

export type EnsureLearningPackGeneratingResult = {
  status: 'GENERATING';
  packId: string;
  projectId: string;
  contentHash: string;
  retryAfterSeconds: number;
};

export type EnsureLearningPackFailedResult = {
  status: 'FAILED';
  packId: string;
  projectId: string;
  contentHash: string;
  errorCode: string;
  retryEligible: boolean;
};

export type EnsureLearningPackIneligibleResult = {
  status: 'INELIGIBLE';
  reasonCode: string;
};

export type EnsureLearningPackResult =
  | EnsureLearningPackReadyResult
  | EnsureLearningPackGeneratingResult
  | EnsureLearningPackFailedResult
  | EnsureLearningPackIneligibleResult;

export const countQuestionsByStage = (
  questions: Array<{ stage: 'START' | 'STEP' | 'FINAL' }>,
): EnsureLearningPackQuestionCounts => ({
  start: questions.filter((question) => question.stage === 'START').length,
  step: questions.filter((question) => question.stage === 'STEP').length,
  final: questions.filter((question) => question.stage === 'FINAL').length,
  total: questions.length,
});
