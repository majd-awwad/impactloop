import type { ProjectLearningCanonicalSnapshot } from './project-learning-snapshot.js';
import type { GeneratedLearningPack } from './project-learning-pack-generation.schema.js';

export type ProjectLearningPackGeneratorInput = {
  snapshot: ProjectLearningCanonicalSnapshot;
  contentHash: string;
  promptVersion: string;
  generatorSchemaVersion: number;
};

export type ProjectLearningPackGeneratorResult = {
  provider: string;
  model: string | null;
  data: GeneratedLearningPack;
  latencyMs: number;
};

export interface ProjectLearningPackGeneratorProvider {
  readonly name: string;
  generateProjectLearningPack(
    input: ProjectLearningPackGeneratorInput,
  ): Promise<ProjectLearningPackGeneratorResult>;
}
