import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

export const WRITABLE_RECOMMENDATION_EVENT_SOURCES = [
  'REAL',
  'DEMO_SEED',
  'TEST',
  'LOAD_TEST',
  'SYNTHETIC',
] as const;

export const PERSISTED_RECOMMENDATION_EVENT_SOURCES = [
  ...WRITABLE_RECOMMENDATION_EVENT_SOURCES,
  'LEGACY_UNCLASSIFIED',
] as const;

export type WritableRecommendationEventSource =
  (typeof WRITABLE_RECOMMENDATION_EVENT_SOURCES)[number];

export type PersistedRecommendationEventSource =
  (typeof PERSISTED_RECOMMENDATION_EVENT_SOURCES)[number];

export class RecommendationEventOriginError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RecommendationEventOriginError';
    this.code = code;
  }
}

const originStorage = new AsyncLocalStorage<WritableRecommendationEventSource>();

export const isWritableRecommendationEventSource = (
  value: unknown,
): value is WritableRecommendationEventSource =>
  typeof value === 'string' &&
  (WRITABLE_RECOMMENDATION_EVENT_SOURCES as readonly string[]).includes(value);

export const isPersistedRecommendationEventSource = (
  value: unknown,
): value is PersistedRecommendationEventSource =>
  typeof value === 'string' &&
  (PERSISTED_RECOMMENDATION_EVENT_SOURCES as readonly string[]).includes(value);

export const runWithRecommendationEventOrigin = <T>(
  origin: WritableRecommendationEventSource,
  fn: () => T,
): T => {
  if (!isWritableRecommendationEventSource(origin)) {
    throw new RecommendationEventOriginError(
      'invalid_event_source',
      'Recommendation event origin is not writable',
    );
  }
  return originStorage.run(origin, fn);
};

export const getRecommendationEventOrigin = ():
  | WritableRecommendationEventSource
  | undefined => originStorage.getStore();

export const resolveRecommendationEventSource = (
  explicit?: unknown,
): WritableRecommendationEventSource => {
  if (explicit !== undefined && explicit !== null) {
    if (explicit === 'LEGACY_UNCLASSIFIED') {
      throw new RecommendationEventOriginError(
        'legacy_event_source_not_writable',
        'LEGACY_UNCLASSIFIED cannot be authored',
      );
    }
    if (!isWritableRecommendationEventSource(explicit)) {
      throw new RecommendationEventOriginError(
        'invalid_event_source',
        'Unsupported recommendation event origin',
      );
    }
    return explicit;
  }

  const fromContext = getRecommendationEventOrigin();
  if (fromContext) {
    return fromContext;
  }

  throw new RecommendationEventOriginError(
    'event_source_required',
    'Recommendation event origin is required',
  );
};

export const bindRecommendationEventOriginMiddleware = (
  origin: WritableRecommendationEventSource,
) => {
  if (!isWritableRecommendationEventSource(origin)) {
    throw new RecommendationEventOriginError(
      'invalid_event_source',
      'Application recommendation event origin is invalid',
    );
  }

  return (_req: Request, _res: Response, next: NextFunction): void => {
    runWithRecommendationEventOrigin(origin, () => {
      next();
    });
  };
};

export const isProductionEvidenceEventSource = (
  value: unknown,
): value is 'REAL' => value === 'REAL';
