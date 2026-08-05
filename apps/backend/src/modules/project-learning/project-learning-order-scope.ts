import type { ProjectLearningQuestionStage } from '../../generated/prisma/client.js';

export const PROJECT_LEARNING_START_SCOPE_KEY = '__START__';
export const PROJECT_LEARNING_FINAL_SCOPE_KEY = '__FINAL__';

export const resolveProjectLearningOrderScopeKey = (input: {
  stage: ProjectLearningQuestionStage;
  projectStepId?: string | null;
}): string => {
  if (input.stage === 'START') {
    return PROJECT_LEARNING_START_SCOPE_KEY;
  }

  if (input.stage === 'FINAL') {
    return PROJECT_LEARNING_FINAL_SCOPE_KEY;
  }

  if (!input.projectStepId?.trim()) {
    throw new Error('STEP questions require a project step id.');
  }

  return input.projectStepId.trim();
};
