import { env } from '../../config/env.js';
import { logger } from '../../observability/logger.js';

import type { LearnerHomeMaterialCandidate } from './learner-home.types.js';
import type { MaterialScoreAudit } from './learner-home.ranking.js';
import {
  scoreSuggestedMaterial,
  type ScoredMaterialResult,
} from './learner-home.scoring.js';

const isLearnerHomeProfilingEnabled = () =>
  env.nodeEnv === 'development' ||
  env.nodeEnv === 'test' ||
  env.logLevel === 'debug' ||
  env.logLevel === 'trace';

export type LearnerHomeProfiler = {
  time: <T>(step: string, fn: () => Promise<T> | T) => Promise<T>;
  mark: (step: string, fn: () => void) => void;
  record: (step: string, durationMs: number) => void;
  report: (context?: { userId?: string; scope?: string }) => void;
};

const isAggregateTimer = (step: string) => /^total(?:[A-Z_]|$)/.test(step);

/**
 * Full-operation timers are useful context but cannot identify work to optimize,
 * because they necessarily include every child timer.
 */
export const getSlowestActionableLearnerHomeStep = (
  timings: ReadonlyMap<string, number>,
) =>
  [...timings.entries()]
    .filter(([step]) => !isAggregateTimer(step))
    .sort((left, right) => right[1] - left[1])[0];

export const createLearnerHomeProfiler = (
  scope: string,
): LearnerHomeProfiler => {
  const timings = new Map<string, number>();

  const record = (step: string, durationMs: number) => {
    timings.set(step, (timings.get(step) ?? 0) + durationMs);
  };

  return {
    async time<T>(step: string, fn: () => Promise<T> | T): Promise<T> {
      const startedAt = performance.now();
      try {
        return await fn();
      } finally {
        record(step, performance.now() - startedAt);
      }
    },
    mark(step, fn) {
      const startedAt = performance.now();
      fn();
      record(step, performance.now() - startedAt);
    },
    record(step, durationMs) {
      record(step, durationMs);
    },
    report(context = {}) {
      if (!isLearnerHomeProfilingEnabled() || timings.size === 0) {
        return;
      }

      const entries = [...timings.entries()].sort(
        (left, right) => right[1] - left[1],
      );
      const slowest = getSlowestActionableLearnerHomeStep(timings);
      const timingsMs = Object.fromEntries(
        entries.map(([step, durationMs]) => [step, Math.round(durationMs)]),
      );

      logger.debug(
        {
          learnerHomeScope: context.scope ?? scope,
          ...(context.userId ? { userId: context.userId } : {}),
          timingsMs,
          slowestStep: slowest?.[0] ?? null,
          slowestStepMs: slowest ? Math.round(slowest[1]) : 0,
        },
        'learner-home step timings',
      );
    },
  };
};

export type MaterialScoreDebugResult = ScoredMaterialResult & {
  audit: MaterialScoreAudit;
};

export const auditSuggestedMaterialScore = (input: {
  material: LearnerHomeMaterialCandidate;
  interests: string[];
  savedComponents: Parameters<typeof scoreSuggestedMaterial>[0]['savedComponents'];
  savedLocation: Parameters<typeof scoreSuggestedMaterial>[0]['savedLocation'];
  behaviorAffinityProfile?: Parameters<typeof scoreSuggestedMaterial>[0]['behaviorAffinityProfile'];
  behavior?: Parameters<typeof scoreSuggestedMaterial>[0]['behavior'];
}): MaterialScoreDebugResult => {
  const result = scoreSuggestedMaterial({ ...input, includeAudit: true });

  if (!result.audit) {
    throw new Error('Expected scoring audit metadata to be present.');
  }

  return {
    score: result.score,
    reasons: result.reasons,
    tier: result.tier,
    hasPrimaryRelevance: result.hasPrimaryRelevance,
    fallbackOnly: result.fallbackOnly,
    audit: result.audit,
  };
};
