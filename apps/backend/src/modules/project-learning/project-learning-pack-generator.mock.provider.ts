import type {
  ProjectLearningPackGeneratorInput,
  ProjectLearningPackGeneratorProvider,
  ProjectLearningPackGeneratorResult,
} from './project-learning-pack-generator.provider.types.js';
import { buildLocalDeterministicLearningPack } from './project-learning-pack-generator.local.provider.js';

/**
 * Test/mock provider reuses the deterministic quality templates so schema +
 * semantic validation stay aligned with local development generation.
 */
export class MockProjectLearningPackGeneratorProvider
  implements ProjectLearningPackGeneratorProvider
{
  readonly name = 'mock';

  async generateProjectLearningPack(
    input: ProjectLearningPackGeneratorInput,
  ): Promise<ProjectLearningPackGeneratorResult> {
    return {
      provider: this.name,
      model: 'mock-learning-pack',
      data: buildLocalDeterministicLearningPack(input.snapshot),
      latencyMs: 5,
    };
  }
}
