import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';

export type ProjectRecord = NonNullable<
  Awaited<ReturnType<typeof learningProjectsRepository.findMyLearningProjectSubmissionById>>
>;
