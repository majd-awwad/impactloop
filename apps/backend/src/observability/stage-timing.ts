import { logger } from './logger.js';

export const measureRequestStage = async <T>(
  stage: string,
  operation: () => Promise<T>,
): Promise<T> => {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    logger.debug(
      {
        operation: 'http.request.stage',
        stage,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      },
      'Request stage completed',
    );
  }
};
