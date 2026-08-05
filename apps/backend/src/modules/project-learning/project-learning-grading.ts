import { AppError } from '../../utils/app-error.js';

export type GradableProjectLearningQuestion = {
  correctOptionKey: string;
  options: Array<{ optionKey: string }>;
};

export const gradeProjectLearningAnswer = (
  question: GradableProjectLearningQuestion,
  selectedOptionKey: string,
): { isCorrect: boolean } => {
  const normalizedSelection = selectedOptionKey.trim();
  if (!normalizedSelection) {
    throw new AppError(
      'Select an answer option.',
      400,
      'LEARNING_ANSWER_OPTION_REQUIRED',
    );
  }

  const optionExists = question.options.some(
    (option) => option.optionKey === normalizedSelection,
  );
  if (!optionExists) {
    throw new AppError(
      'The selected answer option is invalid.',
      400,
      'LEARNING_ANSWER_OPTION_INVALID',
    );
  }

  return {
    isCorrect: question.correctOptionKey === normalizedSelection,
  };
};
