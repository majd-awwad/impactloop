export type LearnerProfileCompletionStep =
  | 'display_name'
  | 'phone'
  | 'learning_basics'
  | 'interests'
  | 'bio'
  | 'saved_location';

export type LearnerProfileCompletionSummary = {
  completedSteps: number;
  totalSteps: 6;
  percentage: number;
  missingSteps: LearnerProfileCompletionStep[];
};

export type LearnerJourneySummary = {
  activeReservationsCount: number;
  completedReservationsCount: number;
  savedProjectsCount: number;
  followedProjectsCount: number;
  activeBuildsCount: number;
  completedBuildsCount: number;
};

export type LearnerBuildProgressSummary = {
  completedSteps: number;
  totalSteps: number;
  percentage: number;
};

export type LearnerContinueProjectSummary = {
  projectId: string;
  buildId: string;
  title: string;
  imageUrl: string | null;
  lastActivityAt: string;
  progress: LearnerBuildProgressSummary;
};

export type LearnerProfileSummary = {
  profileCompletion: LearnerProfileCompletionSummary;
  journey: LearnerJourneySummary;
  continueProject: LearnerContinueProjectSummary | null;
};
