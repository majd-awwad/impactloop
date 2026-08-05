import type { ProjectLearningPackGeneratorProvider } from './project-learning-pack-generator.provider.types.js';
import { MockProjectLearningPackGeneratorProvider } from './project-learning-pack-generator.mock.provider.js';
import { LocalDeterministicProjectLearningPackGeneratorProvider } from './project-learning-pack-generator.local.provider.js';
import { GeminiProjectLearningPackGeneratorProvider } from './project-learning-pack-generator.provider.js';
import {
  isAiChatProviderOperational,
  resolveAiChatProvider,
} from '../../config/env.js';
import { logger } from '../../observability/logger.js';

export const PROJECT_LEARNING_GENERATOR_MODE_ENV =
  'PROJECT_LEARNING_GENERATOR_MODE';

export type ProjectLearningGeneratorMode =
  | 'gemini'
  | 'local_deterministic'
  | 'auto';

let providerOverride: ProjectLearningPackGeneratorProvider | null = null;

export const setProjectLearningPackGeneratorForTests = (
  provider: ProjectLearningPackGeneratorProvider | null,
) => {
  providerOverride = provider;
};

const readRequestedGeneratorMode = (): string =>
  process.env[PROJECT_LEARNING_GENERATOR_MODE_ENV]?.trim().toLowerCase() ?? '';

/**
 * Local deterministic generation is active only in development with an
 * explicit env flag. Production and automated tests never enable it.
 */
export const isProjectLearningLocalDeterministicMode = (): boolean => {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  return readRequestedGeneratorMode() === 'local_deterministic';
};

export const resolveProjectLearningGeneratorMode = (): ProjectLearningGeneratorMode => {
  const requested = readRequestedGeneratorMode();

  if (requested === 'local_deterministic') {
    if (process.env.NODE_ENV === 'production') {
      logger.warn(
        {
          event: 'project_learning_local_deterministic_ignored_in_production',
        },
        'PROJECT_LEARNING_GENERATOR_MODE=local_deterministic is ignored in production.',
      );
      return 'auto';
    }

    if (process.env.NODE_ENV !== 'development') {
      return 'auto';
    }

    return 'local_deterministic';
  }

  if (requested === 'gemini') {
    return 'gemini';
  }

  return 'auto';
};

export const getProjectLearningPackGenerator =
  (): ProjectLearningPackGeneratorProvider => {
    if (providerOverride) {
      return providerOverride;
    }

    if (process.env.NODE_ENV === 'test') {
      return new MockProjectLearningPackGeneratorProvider();
    }

    const mode = resolveProjectLearningGeneratorMode();
    if (mode === 'local_deterministic') {
      return new LocalDeterministicProjectLearningPackGeneratorProvider();
    }

    const chatProvider = resolveAiChatProvider();
    if (chatProvider === 'gemini' && isAiChatProviderOperational(chatProvider)) {
      return new GeminiProjectLearningPackGeneratorProvider();
    }

    // Non-production fallback remains the existing mock provider for tests/dev
    // without an explicit local_deterministic mode. Production must not invent
    // a silent Gemini replacement beyond configured providers.
    if (process.env.NODE_ENV === 'production') {
      return new GeminiProjectLearningPackGeneratorProvider();
    }

    return new MockProjectLearningPackGeneratorProvider();
  };
