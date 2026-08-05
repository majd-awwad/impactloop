import { AppError } from '../../utils/app-error.js';

export type LearningAccessRole =
  | 'LEARNER'
  | 'ADMIN'
  | 'SUPPLIER'
  | 'DRIVER'
  | 'UNKNOWN';

export const canLearnerAccessLearningSession = (input: {
  learnerId: string;
  sessionLearnerId: string;
}): boolean => input.learnerId === input.sessionLearnerId;

export const canAdminReadLearningSession = (role: LearningAccessRole): boolean =>
  role === 'ADMIN';

export const canAdminMutateLearningSession = (
  _role: LearningAccessRole,
): boolean => false;

export const assertLearnerCanAccessLearningSession = (input: {
  learnerId: string;
  sessionLearnerId: string;
}) => {
  if (!canLearnerAccessLearningSession(input)) {
    throw new AppError('Learning session not found.', 404, 'LEARNING_SESSION_NOT_FOUND');
  }
};

export const assertRoleCanReadLearningSession = (input: {
  role: LearningAccessRole;
  learnerId: string;
  sessionLearnerId: string;
}) => {
  if (canLearnerAccessLearningSession(input)) {
    return;
  }

  if (canAdminReadLearningSession(input.role)) {
    return;
  }

  throw new AppError('Learning session not found.', 404, 'LEARNING_SESSION_NOT_FOUND');
};

export const assertRoleCanMutateLearningSession = (input: {
  role: LearningAccessRole;
  learnerId: string;
  sessionLearnerId: string;
}) => {
  if (!canLearnerAccessLearningSession(input)) {
    throw new AppError('Learning session not found.', 404, 'LEARNING_SESSION_NOT_FOUND');
  }

  if (input.role !== 'LEARNER') {
    throw new AppError('Learning session not found.', 404, 'LEARNING_SESSION_NOT_FOUND');
  }
};

export const assertSupplierOrDriverCannotAccessLearningSession = (
  role: LearningAccessRole,
) => {
  if (role === 'SUPPLIER' || role === 'DRIVER') {
    throw new AppError('Learning session not found.', 404, 'LEARNING_SESSION_NOT_FOUND');
  }
};

export const assertAdminMutationNotAllowed = (role: LearningAccessRole) => {
  if (role === 'ADMIN' && !canAdminMutateLearningSession(role)) {
    throw new AppError(
      'Admin learning sessions are read-only.',
      403,
      'LEARNING_SESSION_ADMIN_READ_ONLY',
    );
  }
};
