import { createHash, randomUUID } from 'node:crypto';

import {
  Prisma,
  RecommendationOutboxEventKind,
  RecommendationOutboxStatus,
  type RecommendationCacheState,
  type RecommendationEntityType,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../observability/logger.js';
import {
  isPersistedRecommendationEventSource,
  type PersistedRecommendationEventSource,
} from './recommendation-event-origin.js';
import {
  MAX_RECOMMENDATION_OUTBOX_PAYLOAD_BYTES,
  MAX_RECOMMENDATION_SCORE_COMPONENTS,
  MAX_RECOMMENDATION_TRACE_ROWS,
  RECOMMENDATION_ACTION_OUTBOX_SCHEMA_VERSION,
  RECOMMENDATION_ATTRIBUTION_WINDOW_MS,
  RECOMMENDATION_EXPOSURE_OUTBOX_SCHEMA_VERSION,
  RECOMMENDATION_GENERATION_OUTBOX_SCHEMA_VERSION,
  RECOMMENDATION_SURFACES,
  type RecommendationActionOutboxPayload,
  type RecommendationExposureOutboxPayload,
  type RecommendationGenerationOutboxPayload,
  type RecommendationOutboxTrace,
} from './recommendation-events.service.js';

export type RecommendationOutboxWorkerConfig = {
  pollIntervalMs: number;
  batchSize: number;
  maxAttempts: number;
  leaseMs: number;
};

export type RecommendationOutboxWorkerState =
  | 'DISABLED'
  | 'STARTING'
  | 'HEALTHY'
  | 'DEGRADED'
  | 'FAILED'
  | 'STOPPING'
  | 'STOPPED';

export type RecommendationOutboxStopResult =
  | { outcome: 'completed' }
  | { outcome: 'timedOut'; inFlightStillRunning: true }
  | { outcome: 'inFlightStillRunning' };

export type RecommendationOutboxQueueMetrics = {
  retryBacklog: number | null;
  retryBacklogCapped: boolean | null;
  deadRows: number | null;
  deadRowsCapped: boolean | null;
  queueMetricsRefreshedAt: string | null;
  queueMetricsStale: boolean;
};

export type RecommendationOutboxHealthSnapshot = {
  enabled: boolean;
  required: boolean;
  state: RecommendationOutboxWorkerState;
  effectiveState: RecommendationOutboxWorkerState;
  startedAt: string | null;
  lastPollStartedAt: string | null;
  lastPollCompletedAt: string | null;
  lastSuccessfulPollAt: string | null;
  lastFailureAt: string | null;
  lastFailureCode: string | null;
  consecutiveFailures: number;
  pollInFlight: boolean;
  retryBacklog: number | null;
  retryBacklogCapped: boolean | null;
  deadRows: number | null;
  deadRowsCapped: boolean | null;
  queueMetricsRefreshedAt: string | null;
  queueMetricsStale: boolean;
  stale: boolean;
  shutdownRequested: boolean;
  shutdownTimedOut: boolean;
  pollIntervalMs: number;
  staleAfterMs: number;
  reasonCodes: string[];
  ready: boolean;
};

export type RecommendationOutboxWorkerDeps = {
  now?: () => number;
  schedule?: (ms: number, cb: () => void) => NodeJS.Timeout;
  clearSchedule?: (timer: NodeJS.Timeout) => void;
  processBatch?: () => Promise<number>;
  refreshQueueMetrics?: () => Promise<{
    retryBacklog: number;
    retryBacklogCapped: boolean;
    deadRows: number;
    deadRowsCapped: boolean;
  }>;
};

export type RecommendationOutboxWorkerOptions =
  Partial<RecommendationOutboxWorkerConfig> & {
    enabled?: boolean;
    required?: boolean;
    retryBacklogWarnThreshold?: number;
    deadWarnThreshold?: number;
    consecutiveFailureThreshold?: number;
    queueMetricsRefreshIntervalMs?: number;
    deps?: RecommendationOutboxWorkerDeps;
  };

export const RECOMMENDATION_OUTBOX_SHUTDOWN_WAIT_MS = 15_000;
export const RECOMMENDATION_OUTBOX_RETRY_BACKLOG_WARN_THRESHOLD = 100;
export const RECOMMENDATION_OUTBOX_DEAD_WARN_THRESHOLD = 1;
export const RECOMMENDATION_OUTBOX_CONSECUTIVE_FAILURE_THRESHOLD = 3;

export const deriveOutboxStaleAfterMs = (pollIntervalMs: number): number =>
  Math.max(pollIntervalMs * 3, 10_000);

export const deriveOutboxQueueMetricsRefreshIntervalMs = (
  pollIntervalMs: number,
): number => Math.max(30_000, pollIntervalMs * 15);

type ClaimedOutboxRecord = {
  id: string;
  event_kind: RecommendationOutboxEventKind;
  schema_version: string;
  deduplication_key: string;
  payload: unknown;
  status: RecommendationOutboxStatus;
  attempt_count: number;
  available_at: Date;
  locked_at: Date | null;
  lock_token: string | null;
  processed_at: Date | null;
  last_error_code: string | null;
  last_error_summary: string | null;
  created_at: Date;
  updated_at: Date;
};

const DEFAULT_CONFIG: RecommendationOutboxWorkerConfig = {
  pollIntervalMs: 2_000,
  batchSize: 10,
  maxAttempts: 5,
  leaseMs: 30_000,
};

const payloadByteLength = (payload: unknown): number =>
  Buffer.byteLength(JSON.stringify(payload));

const boundedErrorSummary = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').slice(0, 191);
};

class PoisonOutboxPayloadError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PoisonOutboxPayloadError';
    this.code = code;
  }
}

class RetryableOutboxError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RetryableOutboxError';
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const requiredString = (
  record: Record<string, unknown>,
  key: string,
  max = 191,
): string => {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new PoisonOutboxPayloadError(
      'invalid_string',
      `Invalid outbox field: ${key}`,
    );
  }
  return value;
};

const requiredFiniteNumber = (
  record: Record<string, unknown>,
  key: string,
): number => {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PoisonOutboxPayloadError(
      'invalid_number',
      `Invalid outbox field: ${key}`,
    );
  }
  return value;
};

const requiredNonNegativeInteger = (
  record: Record<string, unknown>,
  key: string,
): number => {
  const value = requiredFiniteNumber(record, key);
  if (!Number.isInteger(value) || value < 0) {
    throw new PoisonOutboxPayloadError(
      'invalid_integer',
      `Invalid outbox field: ${key}`,
    );
  }
  return value;
};

const requiredCacheState = (value: Record<string, unknown>): RecommendationCacheState => {
  if (
    value.cacheState !== 'MISS' &&
    value.cacheState !== 'HIT' &&
    value.cacheState !== 'SINGLE_FLIGHT' &&
    value.cacheState !== 'UNCACHED'
  ) {
    throw new PoisonOutboxPayloadError(
      'invalid_cache_state',
      'Unknown recommendation cache state',
    );
  }

  return value.cacheState as RecommendationCacheState;
};

const parseDate = (record: Record<string, unknown>, key: string): Date => {
  const raw = requiredString(record, key, 64);
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    throw new PoisonOutboxPayloadError(
      'invalid_date',
      `Invalid outbox field: ${key}`,
    );
  }
  return parsed;
};

const requiredPersistedEventSource = (
  value: Record<string, unknown>,
  field = 'eventSource',
): PersistedRecommendationEventSource => {
  const raw = value[field];
  if (raw === undefined || raw === null) {
    throw new PoisonOutboxPayloadError(
      'missing_event_source',
      'Outbox payload eventSource is required',
    );
  }
  if (!isPersistedRecommendationEventSource(raw)) {
    throw new PoisonOutboxPayloadError(
      'invalid_event_source',
      'Outbox payload eventSource is unsupported',
    );
  }
  return raw;
};

const assertExistingEventSourceCompatible = (
  existing: string | null | undefined,
  incoming: PersistedRecommendationEventSource,
  entity: string,
): void => {
  if (existing == null) {
    throw new PoisonOutboxPayloadError(
      'materialized_origin_conflict',
      `${entity} is missing stored eventSource`,
    );
  }
  if (existing !== incoming) {
    throw new PoisonOutboxPayloadError(
      'materialized_origin_conflict',
      `${entity} eventSource conflict`,
    );
  }
};

const validateTrace = (value: unknown): RecommendationOutboxTrace => {
  if (!isRecord(value)) {
    throw new PoisonOutboxPayloadError('invalid_trace', 'Trace is not an object');
  }

  const entityType = requiredString(value, 'entityType', 32);
  if (entityType !== 'MATERIAL' && entityType !== 'PROJECT') {
    throw new PoisonOutboxPayloadError('invalid_entity_type', 'Unknown trace entity type');
  }

  const rank = value.rankBeforeSelection;
  if (rank !== null && rank !== undefined) {
    if (typeof rank !== 'number' || !Number.isInteger(rank) || rank <= 0) {
      throw new PoisonOutboxPayloadError('invalid_rank', 'Invalid trace rank');
    }
  }

  const finalScore = value.finalScore;
  if (finalScore !== null && finalScore !== undefined) {
    if (typeof finalScore !== 'number' || !Number.isFinite(finalScore)) {
      throw new PoisonOutboxPayloadError('invalid_score', 'Invalid trace score');
    }
  }

  const scoreComponents = value.scoreComponents;
  if (scoreComponents !== undefined && scoreComponents !== null) {
    if (!isRecord(scoreComponents) || Object.keys(scoreComponents).length > MAX_RECOMMENDATION_SCORE_COMPONENTS) {
      throw new PoisonOutboxPayloadError(
        'invalid_score_components',
        'Score components exceed the bounded limit',
      );
    }
  }

  return {
    entityType: entityType as RecommendationEntityType,
    entityId: requiredString(value, 'entityId'),
    surface: requiredString(value, 'surface', 100),
    sectionKey:
      value.sectionKey === null
        ? null
        : requiredString(value, 'sectionKey', 100),
    candidateSource: requiredString(value, 'candidateSource', 100),
    eligibilityResult:
      value.eligibilityResult === 'ELIGIBLE' ? 'ELIGIBLE' : 'EXCLUDED',
    rankBeforeSelection: (rank as number | null | undefined) ?? null,
    finalScore: (finalScore as number | null | undefined) ?? null,
    ...(scoreComponents ? { scoreComponents } : {}),
    exclusionReason:
      value.exclusionReason === null
        ? null
        : requiredString(value, 'exclusionReason'),
    selected: value.selected === true,
    eventSource: requiredPersistedEventSource(value),
  };
};

const validateGenerationPayload = (
  value: unknown,
): RecommendationGenerationOutboxPayload => {
  if (!isRecord(value)) {
    throw new PoisonOutboxPayloadError('invalid_payload', 'Generation payload is not an object');
  }
  if (value.schemaVersion !== RECOMMENDATION_GENERATION_OUTBOX_SCHEMA_VERSION) {
    throw new PoisonOutboxPayloadError('unsupported_schema_version', 'Unsupported generation payload version');
  }

  const traces = value.candidateTraces;
  if (!Array.isArray(traces) || traces.length > MAX_RECOMMENDATION_TRACE_ROWS) {
    throw new PoisonOutboxPayloadError('trace_limit_exceeded', 'Generation trace limit exceeded');
  }

  return {
    schemaVersion: RECOMMENDATION_GENERATION_OUTBOX_SCHEMA_VERSION,
    generationId: requiredString(value, 'generationId'),
    learnerId: requiredString(value, 'learnerId'),
    surface: requiredString(value, 'surface', 100),
    algorithmName: requiredString(value, 'algorithmName', 100),
    algorithmVersion: requiredString(value, 'algorithmVersion', 100),
    policyVersion: requiredString(value, 'policyVersion', 100),
    generatedAt: requiredString(value, 'generatedAt', 64),
    cacheState: requiredCacheState(value),
    candidateCount: requiredNonNegativeInteger(value, 'candidateCount'),
    shownItemCount: requiredNonNegativeInteger(value, 'shownItemCount'),
    generationDurationMs: requiredNonNegativeInteger(value, 'generationDurationMs'),
    persistedTraceCount: requiredNonNegativeInteger(value, 'persistedTraceCount'),
    traceTruncated: value.traceTruncated === true,
    candidateTraces: traces.map(validateTrace),
    eventSource: requiredPersistedEventSource(value),
  };
};

const validateExposurePayload = (
  value: unknown,
): RecommendationExposureOutboxPayload => {
  if (!isRecord(value)) {
    throw new PoisonOutboxPayloadError('invalid_payload', 'Exposure payload is not an object');
  }
  if (value.schemaVersion !== RECOMMENDATION_EXPOSURE_OUTBOX_SCHEMA_VERSION) {
    throw new PoisonOutboxPayloadError('unsupported_schema_version', 'Unsupported exposure payload version');
  }

  const rawImpressions = value.impressions;
  if (!Array.isArray(rawImpressions) || rawImpressions.length > 512) {
    throw new PoisonOutboxPayloadError('impression_limit_exceeded', 'Exposure impression limit exceeded');
  }

  const impressions = rawImpressions.map((raw) => {
    if (!isRecord(raw)) {
      throw new PoisonOutboxPayloadError('invalid_impression', 'Impression is not an object');
    }
    const entityType = requiredString(raw, 'entityType', 32);
    if (entityType !== 'MATERIAL' && entityType !== 'PROJECT') {
      throw new PoisonOutboxPayloadError('invalid_entity_type', 'Unknown impression entity type');
    }
    const position = requiredNonNegativeInteger(raw, 'position');
    if (position <= 0) {
      throw new PoisonOutboxPayloadError('invalid_position', 'Impression position must be positive');
    }
    return {
      impressionId: requiredString(raw, 'impressionId', 128),
      entityType: entityType as RecommendationEntityType,
      entityId: requiredString(raw, 'entityId'),
      sectionKey: requiredString(raw, 'sectionKey', 100),
      position,
      score: requiredFiniteNumber(raw, 'score'),
      reasonCode: requiredString(raw, 'reasonCode', 64),
    };
  });

  return {
    schemaVersion: RECOMMENDATION_EXPOSURE_OUTBOX_SCHEMA_VERSION,
    exposureId: requiredString(value, 'exposureId'),
    generationId: requiredString(value, 'generationId'),
    learnerId: requiredString(value, 'learnerId'),
    surface: requiredString(value, 'surface', 100),
    cacheState: requiredCacheState(value),
    correlationId:
      value.correlationId === null
        ? null
        : requiredString(value, 'correlationId'),
    exposedAt: requiredString(value, 'exposedAt', 64),
    candidateCount: requiredNonNegativeInteger(value, 'candidateCount'),
    shownItemCount: requiredNonNegativeInteger(value, 'shownItemCount'),
    generationDurationMs: requiredNonNegativeInteger(value, 'generationDurationMs'),
    algorithmName: requiredString(value, 'algorithmName', 100),
    algorithmVersion: requiredString(value, 'algorithmVersion', 100),
    policyVersion: requiredString(value, 'policyVersion', 100),
    impressions,
    eventSource: requiredPersistedEventSource(value),
  };
};

const actionTypeForEntity: Record<'MATERIAL' | 'PROJECT', readonly string[]> = {
  MATERIAL: ['MATERIAL_VIEW', 'MATERIAL_LIKE', 'MATERIAL_UNLIKE', 'RESERVATION_CREATED'],
  PROJECT: [
    'PROJECT_LIKE',
    'PROJECT_UNLIKE',
    'PROJECT_SAVE',
    'PROJECT_UNSAVE',
    'PROJECT_FOLLOW',
    'PROJECT_UNFOLLOW',
    'PROJECT_BUILD_STARTED',
    'PROJECT_BUILD_PROGRESS_UPDATED',
  ],
};

const validateActionPayload = (
  value: unknown,
): RecommendationActionOutboxPayload => {
  if (!isRecord(value)) {
    throw new PoisonOutboxPayloadError('invalid_payload', 'Action payload is not an object');
  }
  if (value.schemaVersion !== RECOMMENDATION_ACTION_OUTBOX_SCHEMA_VERSION) {
    throw new PoisonOutboxPayloadError('unsupported_schema_version', 'Unsupported action payload version');
  }

  const entityType = requiredString(value, 'entityType', 32);
  if (entityType !== 'MATERIAL' && entityType !== 'PROJECT') {
    throw new PoisonOutboxPayloadError('invalid_entity_type', 'Unknown action entity type');
  }
  const actionType = requiredString(value, 'actionType', 64);
  if (!actionTypeForEntity[entityType].includes(actionType)) {
    throw new PoisonOutboxPayloadError('invalid_action_type', 'Action type is not supported for entity type');
  }

  return {
    schemaVersion: RECOMMENDATION_ACTION_OUTBOX_SCHEMA_VERSION,
    actionId: requiredString(value, 'actionId', 128),
    learnerId: requiredString(value, 'learnerId'),
    actionType: actionType as RecommendationActionOutboxPayload['actionType'],
    entityType: entityType as RecommendationActionOutboxPayload['entityType'],
    entityId: requiredString(value, 'entityId'),
    impressionId:
      value.impressionId === null || value.impressionId === undefined
        ? null
        : requiredString(value, 'impressionId', 128),
    sourceOperationId:
      value.sourceOperationId === null || value.sourceOperationId === undefined
        ? null
        : requiredString(value, 'sourceOperationId'),
    occurredAt: requiredString(value, 'occurredAt', 64),
    eventSource: requiredPersistedEventSource(value),
  };
};

const validatePayloadSize = (payload: unknown): void => {
  if (payloadByteLength(payload) > MAX_RECOMMENDATION_OUTBOX_PAYLOAD_BYTES) {
    throw new PoisonOutboxPayloadError(
      'payload_too_large',
      'Outbox payload exceeds the bounded size',
    );
  }
};

export const recoverStaleRecommendationOutbox = async (
  leaseMs: number,
): Promise<number> => {
  const staleBefore = new Date(Date.now() - Math.max(1_000, leaseMs));
  const result = await prisma.recommendationEventOutbox.updateMany({
    where: {
      status: 'PROCESSING',
      lockedAt: { lt: staleBefore },
    },
    data: {
      status: 'RETRY',
      availableAt: new Date(),
      lockedAt: null,
      lockToken: null,
    },
  });
  return result.count;
};

export const claimRecommendationOutboxBatch = async (input: {
  workerId: string;
  batchSize: number;
  leaseMs: number;
}): Promise<ClaimedOutboxRecord[]> => {
  await recoverStaleRecommendationOutbox(input.leaseMs);

  const now = new Date();
  const lockToken = `${input.workerId}:${randomUUID()}`;
  const batchSize = Math.max(1, Math.min(100, Math.trunc(input.batchSize)));

  return prisma.$transaction((tx) =>
    tx.$queryRaw<ClaimedOutboxRecord[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "recommendation_event_outbox"
        WHERE ("status" = 'PENDING'::"RecommendationOutboxStatus"
          OR "status" = 'RETRY'::"RecommendationOutboxStatus")
          AND "available_at" <= ${now}
        ORDER BY
          CASE WHEN "event_kind" = 'RECOMMENDATION_GENERATION'::"RecommendationOutboxEventKind"
            THEN 0 ELSE 1 END,
          "created_at" ASC,
          "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      )
      UPDATE "recommendation_event_outbox" AS outbox
      SET "status" = 'PROCESSING'::"RecommendationOutboxStatus",
          "attempt_count" = outbox."attempt_count" + 1,
          "locked_at" = ${now},
          "lock_token" = ${lockToken},
          "updated_at" = ${now}
      FROM candidates
      WHERE outbox."id" = candidates."id"
      RETURNING outbox.*
    `),
  );
};

const traceIdFor = (generationId: string, index: number): string =>
  createHash('sha256')
    .update(`${generationId}:${index}`)
    .digest('hex')
    .slice(0, 32);

const materializeGeneration = async (
  payload: RecommendationGenerationOutboxPayload,
): Promise<void> => {
  const generatedAt = new Date(payload.generatedAt);
  if (!Number.isFinite(generatedAt.getTime())) {
    throw new PoisonOutboxPayloadError('invalid_date', 'Invalid generation date');
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.recommendationGeneration.findUnique({
      where: { id: payload.generationId },
      select: { eventSource: true },
    });
    if (existing) {
      assertExistingEventSourceCompatible(
        existing.eventSource,
        payload.eventSource,
        'generation',
      );
    }

    await tx.recommendationGeneration.upsert({
      where: { id: payload.generationId },
      create: {
        id: payload.generationId,
        generationKey: payload.generationId,
        learnerId: payload.learnerId,
        surface: payload.surface,
        algorithmName: payload.algorithmName,
        algorithmVersion: payload.algorithmVersion,
        policyVersion: payload.policyVersion,
        generatedAt,
        cacheState: payload.cacheState,
        candidateCount: payload.candidateCount,
        shownItemCount: payload.shownItemCount,
        generationDurationMs: payload.generationDurationMs,
        eventSource: payload.eventSource,
      },
      update: {},
    });

    if (payload.candidateTraces.length > 0) {
      const traces = payload.candidateTraces.map((trace, index) => ({
        id: traceIdFor(payload.generationId, index),
        generationId: payload.generationId,
        entityType: trace.entityType,
        entityId: trace.entityId,
        surface: trace.surface,
        sectionKey: trace.sectionKey,
        candidateSource: trace.candidateSource,
        eligibilityResult: trace.eligibilityResult,
        rankBeforeSelection: trace.rankBeforeSelection,
        finalScore: trace.finalScore,
        ...(trace.scoreComponents
          ? { scoreComponents: trace.scoreComponents as Prisma.InputJsonValue }
          : {}),
        exclusionReason: trace.exclusionReason,
        selected: trace.selected,
        eventSource: trace.eventSource,
      }));

      const existingTraces = await tx.recommendationCandidateTrace.findMany({
        where: { id: { in: traces.map((trace) => trace.id) } },
        select: { id: true, eventSource: true },
      });
      const existingById = new Map(
        existingTraces.map((row) => [row.id, row.eventSource] as const),
      );
      for (const trace of traces) {
        const existingOrigin = existingById.get(trace.id);
        if (existingOrigin !== undefined) {
          assertExistingEventSourceCompatible(
            existingOrigin,
            trace.eventSource,
            'candidate_trace',
          );
        }
      }

      await tx.recommendationCandidateTrace.createMany({
        data: traces,
        skipDuplicates: true,
      });
    }
  });
};

const materializeExposure = async (
  payload: RecommendationExposureOutboxPayload,
): Promise<void> => {
  const exposedAt = new Date(payload.exposedAt);
  if (!Number.isFinite(exposedAt.getTime())) {
    throw new PoisonOutboxPayloadError('invalid_date', 'Invalid exposure date');
  }

  await prisma.$transaction(async (tx) => {
    const generation = await tx.recommendationGeneration.findUnique({
      where: { id: payload.generationId },
      select: { id: true },
    });
    if (!generation) {
      throw new RetryableOutboxError(
        'generation_pending',
        'Generation event has not been materialized yet',
      );
    }

    const existingRequest = await tx.recommendationRequest.findUnique({
      where: { id: payload.exposureId },
      select: { eventSource: true },
    });
    if (existingRequest) {
      assertExistingEventSourceCompatible(
        existingRequest.eventSource,
        payload.eventSource,
        'exposure',
      );
    }

    await tx.recommendationRequest.upsert({
      where: { id: payload.exposureId },
      create: {
        id: payload.exposureId,
        learnerId: payload.learnerId,
        generationId: payload.generationId,
        surface: payload.surface,
        algorithmName: payload.algorithmName,
        algorithmVersion: payload.algorithmVersion,
        policyVersion: payload.policyVersion,
        cacheState: payload.cacheState,
        correlationId: payload.correlationId,
        candidateCount: payload.candidateCount,
        shownItemCount: payload.shownItemCount,
        generationDurationMs: payload.generationDurationMs,
        eventSource: payload.eventSource,
        createdAt: exposedAt,
      },
      update: {},
    });

    if (payload.impressions.length > 0) {
      const impressions = payload.impressions.map((impression) => ({
        id: impression.impressionId,
        requestId: payload.exposureId,
        learnerId: payload.learnerId,
        entityType: impression.entityType,
        entityId: impression.entityId,
        surface: payload.surface,
        sectionKey: impression.sectionKey,
        position: impression.position,
        score: impression.score,
        reasonCode: impression.reasonCode,
        algorithmName: payload.algorithmName,
        algorithmVersion: payload.algorithmVersion,
        shownAt: exposedAt,
        eventSource: payload.eventSource,
      }));

      const existingImpressions = await tx.recommendationImpression.findMany({
        where: {
          OR: [
            { id: { in: impressions.map((row) => row.id) } },
            {
              OR: impressions.map((row) => ({
                requestId: row.requestId,
                entityType: row.entityType,
                entityId: row.entityId,
                sectionKey: row.sectionKey,
                position: row.position,
              })),
            },
          ],
        },
        select: {
          id: true,
          requestId: true,
          entityType: true,
          entityId: true,
          sectionKey: true,
          position: true,
          eventSource: true,
        },
      });

      for (const existing of existingImpressions) {
        const match =
          impressions.find((row) => row.id === existing.id) ??
          impressions.find(
            (row) =>
              row.requestId === existing.requestId &&
              row.entityType === existing.entityType &&
              row.entityId === existing.entityId &&
              row.sectionKey === existing.sectionKey &&
              row.position === existing.position,
          );
        if (!match) {
          continue;
        }
        assertExistingEventSourceCompatible(
          existing.eventSource,
          match.eventSource,
          'impression',
        );
      }

      await tx.recommendationImpression.createMany({
        data: impressions,
        skipDuplicates: true,
      });
    }
  });
};

const pendingExposureContains = async (payload: RecommendationActionOutboxPayload): Promise<boolean> => {
  if (!payload.impressionId) {
    return false;
  }

  const pending = await prisma.recommendationEventOutbox.findMany({
    where: {
      eventKind: 'RECOMMENDATION_EXPOSURE',
      status: { in: ['PENDING', 'PROCESSING', 'RETRY'] },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: { payload: true },
  });

  return pending.some((row) => {
    const exposure = row.payload;
    if (!isRecord(exposure) || exposure.learnerId !== payload.learnerId) {
      return false;
    }
    const impressions = exposure.impressions;
    return (
      Array.isArray(impressions) &&
      impressions.some(
        (impression) =>
          isRecord(impression) &&
          impression.impressionId === payload.impressionId &&
          impression.entityType === payload.entityType &&
          impression.entityId === payload.entityId,
      )
    );
  });
};

const resolveActionImpression = async (
  payload: RecommendationActionOutboxPayload,
  actionAt: Date,
): Promise<{
  impressionId: string;
  attributionType: 'DIRECT' | 'ASSISTED';
} | null> => {
  const shownAfter = new Date(
    actionAt.getTime() - RECOMMENDATION_ATTRIBUTION_WINDOW_MS,
  );

  if (payload.impressionId) {
    const direct = await prisma.recommendationImpression.findFirst({
      where: {
        id: payload.impressionId,
        learnerId: payload.learnerId,
        entityType: payload.entityType,
        entityId: payload.entityId,
        surface: { in: [...RECOMMENDATION_SURFACES] },
        shownAt: { gte: shownAfter, lte: actionAt },
      },
      select: { id: true },
    });
    if (direct) {
      return { impressionId: direct.id, attributionType: 'DIRECT' };
    }

    if (await pendingExposureContains(payload)) {
      throw new RetryableOutboxError(
        'impression_not_ready',
        'IMPRESSION_NOT_READY',
      );
    }
  }

  const assisted = await prisma.recommendationImpression.findFirst({
    where: {
      learnerId: payload.learnerId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      surface: { in: [...RECOMMENDATION_SURFACES] },
      shownAt: { gte: shownAfter, lte: actionAt },
    },
    orderBy: [{ shownAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });

  return assisted
    ? { impressionId: assisted.id, attributionType: 'ASSISTED' }
    : null;
};

const materializeAction = async (
  payload: RecommendationActionOutboxPayload,
): Promise<void> => {
  const actionAt = new Date(payload.occurredAt);
  if (!Number.isFinite(actionAt.getTime())) {
    throw new PoisonOutboxPayloadError('invalid_date', 'Invalid action date');
  }

  const resolved = await resolveActionImpression(payload, actionAt);
  if (!resolved) {
    return;
  }

  const existingAction = await prisma.recommendationAction.findUnique({
    where: { id: payload.actionId },
    select: { eventSource: true },
  });
  if (existingAction) {
    assertExistingEventSourceCompatible(
      existingAction.eventSource,
      payload.eventSource,
      'action',
    );
  }

  await prisma.recommendationAction.upsert({
    where: { id: payload.actionId },
    create: {
      id: payload.actionId,
      impressionId: resolved.impressionId,
      learnerId: payload.learnerId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      actionType: payload.actionType,
      attributionType: resolved.attributionType,
      actionAt,
      sourceOperationId: payload.sourceOperationId,
      eventSource: payload.eventSource,
    },
    update: {},
  });
};

const completeOutboxRecord = async (row: ClaimedOutboxRecord): Promise<void> => {
  await prisma.recommendationEventOutbox.updateMany({
    where: {
      id: row.id,
      status: 'PROCESSING',
      lockToken: row.lock_token,
    },
    data: {
      status: 'PROCESSED',
      processedAt: new Date(),
      lockedAt: null,
      lockToken: null,
      lastErrorCode: null,
      lastErrorSummary: null,
    },
  });
};

const failOutboxRecord = async (
  row: ClaimedOutboxRecord,
  error: unknown,
  config: RecommendationOutboxWorkerConfig,
): Promise<void> => {
  const poison = error instanceof PoisonOutboxPayloadError;
  const retryable = error instanceof RetryableOutboxError || !poison;
  const dead = !retryable || row.attempt_count >= config.maxAttempts;
  const attempt = Math.max(1, row.attempt_count);
  const availableAt = new Date(
    Date.now() + Math.min(60_000, 1_000 * 2 ** Math.max(0, attempt - 1)),
  );

  await prisma.recommendationEventOutbox.updateMany({
    where: {
      id: row.id,
      status: 'PROCESSING',
      lockToken: row.lock_token,
    },
    data: {
      status: dead ? 'DEAD' : 'RETRY',
      availableAt,
      lockedAt: null,
      lockToken: null,
      lastErrorCode:
        error instanceof PoisonOutboxPayloadError || error instanceof RetryableOutboxError
          ? error.code
          : 'processing_failed',
      lastErrorSummary: boundedErrorSummary(error),
    },
  });

  logger.warn(
    {
      operation: 'recommendation.outbox.processing_failed',
      outboxId: row.id,
      dedupeKeyPrefix: createHash('sha256')
        .update(row.deduplication_key)
        .digest('hex')
        .slice(0, 12),
      attempt,
      status: dead ? 'DEAD' : 'RETRY',
      ...(error instanceof PoisonOutboxPayloadError || error instanceof RetryableOutboxError
        ? { conflictCode: error.code }
        : { conflictCode: 'processing_failed' }),
    },
    boundedErrorSummary(error),
  );
};

export const processRecommendationOutboxRecord = async (
  row: ClaimedOutboxRecord,
  config: RecommendationOutboxWorkerConfig = DEFAULT_CONFIG,
): Promise<void> => {
  try {
    validatePayloadSize(row.payload);
    if (row.event_kind === 'RECOMMENDATION_GENERATION') {
      if (row.schema_version !== RECOMMENDATION_GENERATION_OUTBOX_SCHEMA_VERSION) {
        throw new PoisonOutboxPayloadError('unsupported_schema_version', 'Unsupported generation schema version');
      }
      await materializeGeneration(validateGenerationPayload(row.payload));
    } else if (row.event_kind === 'RECOMMENDATION_EXPOSURE') {
      if (row.schema_version !== RECOMMENDATION_EXPOSURE_OUTBOX_SCHEMA_VERSION) {
        throw new PoisonOutboxPayloadError('unsupported_schema_version', 'Unsupported exposure schema version');
      }
      await materializeExposure(validateExposurePayload(row.payload));
    } else if (row.event_kind === 'RECOMMENDATION_ACTION') {
      if (row.schema_version !== RECOMMENDATION_ACTION_OUTBOX_SCHEMA_VERSION) {
        throw new PoisonOutboxPayloadError('unsupported_schema_version', 'Unsupported action schema version');
      }
      await materializeAction(validateActionPayload(row.payload));
    } else {
      throw new PoisonOutboxPayloadError('unsupported_event_kind', 'Unsupported recommendation outbox event kind');
    }

    await completeOutboxRecord(row);
  } catch (error) {
    await failOutboxRecord(row, error, config);
  }
};

export const refreshRecommendationOutboxQueueMetrics = async (input: {
  retryBacklogWarnThreshold: number;
  deadWarnThreshold: number;
}): Promise<{
  retryBacklog: number;
  retryBacklogCapped: boolean;
  deadRows: number;
  deadRowsCapped: boolean;
}> => {
  const retryTake = input.retryBacklogWarnThreshold + 1;
  const deadTake = input.deadWarnThreshold + 1;

  const [retryRows, deadRows] = await Promise.all([
    prisma.recommendationEventOutbox.findMany({
      where: { status: 'RETRY' },
      select: { id: true },
      take: retryTake,
      orderBy: { id: 'asc' },
    }),
    prisma.recommendationEventOutbox.findMany({
      where: { status: 'DEAD' },
      select: { id: true },
      take: deadTake,
      orderBy: { id: 'asc' },
    }),
  ]);

  return {
    retryBacklog: retryRows.length,
    retryBacklogCapped: retryRows.length === retryTake,
    deadRows: deadRows.length,
    deadRowsCapped: deadRows.length === deadTake,
  };
};

export class RecommendationOutboxWorker {
  readonly workerId = `recommendation-outbox-${randomUUID()}`;
  private readonly config: RecommendationOutboxWorkerConfig;
  private readonly enabledFlag: boolean;
  private readonly requiredFlag: boolean;
  private readonly retryBacklogWarnThreshold: number;
  private readonly deadWarnThreshold: number;
  private readonly consecutiveFailureThreshold: number;
  private readonly staleAfterMs: number;
  private readonly startupGraceMs: number;
  private readonly queueMetricsRefreshIntervalMs: number;
  private readonly now: () => number;
  private readonly scheduleFn: (ms: number, cb: () => void) => NodeJS.Timeout;
  private readonly clearScheduleFn: (timer: NodeJS.Timeout) => void;
  private readonly processBatchImpl: () => Promise<number>;
  private readonly refreshQueueMetricsImpl: () => Promise<{
    retryBacklog: number;
    retryBacklogCapped: boolean;
    deadRows: number;
    deadRowsCapped: boolean;
  }>;

  private storedState: RecommendationOutboxWorkerState;
  private running = false;
  private shutdownRequested = false;
  private shutdownTimedOut = false;
  private markedStopped = false;
  private timer: NodeJS.Timeout | null = null;
  private currentRun: Promise<void> | null = null;
  private pollInFlight = false;
  private metricsRefreshInFlight: Promise<void> | null = null;

  private startedAtMs: number | null = null;
  private lastPollStartedAtMs: number | null = null;
  private lastPollCompletedAtMs: number | null = null;
  private lastSuccessfulPollAtMs: number | null = null;
  private lastFailureAtMs: number | null = null;
  private lastFailureCode: string | null = null;
  private consecutiveFailures = 0;

  private retryBacklog: number | null = null;
  private retryBacklogCapped: boolean | null = null;
  private deadRows: number | null = null;
  private deadRowsCapped: boolean | null = null;
  private queueMetricsRefreshedAtMs: number | null = null;
  private queueMetricsStale = false;

  constructor(options: RecommendationOutboxWorkerOptions = {}) {
    const {
      enabled = false,
      required = false,
      retryBacklogWarnThreshold = RECOMMENDATION_OUTBOX_RETRY_BACKLOG_WARN_THRESHOLD,
      deadWarnThreshold = RECOMMENDATION_OUTBOX_DEAD_WARN_THRESHOLD,
      consecutiveFailureThreshold = RECOMMENDATION_OUTBOX_CONSECUTIVE_FAILURE_THRESHOLD,
      queueMetricsRefreshIntervalMs,
      deps = {},
      pollIntervalMs,
      batchSize,
      maxAttempts,
      leaseMs,
    } = options;

    this.config = {
      pollIntervalMs: pollIntervalMs ?? DEFAULT_CONFIG.pollIntervalMs,
      batchSize: batchSize ?? DEFAULT_CONFIG.batchSize,
      maxAttempts: maxAttempts ?? DEFAULT_CONFIG.maxAttempts,
      leaseMs: leaseMs ?? DEFAULT_CONFIG.leaseMs,
    };
    this.enabledFlag = enabled;
    this.requiredFlag = required;
    this.retryBacklogWarnThreshold = retryBacklogWarnThreshold;
    this.deadWarnThreshold = deadWarnThreshold;
    this.consecutiveFailureThreshold = consecutiveFailureThreshold;
    this.staleAfterMs = deriveOutboxStaleAfterMs(this.config.pollIntervalMs);
    this.startupGraceMs = this.staleAfterMs;
    this.queueMetricsRefreshIntervalMs =
      queueMetricsRefreshIntervalMs ??
      deriveOutboxQueueMetricsRefreshIntervalMs(this.config.pollIntervalMs);

    this.now = deps.now ?? Date.now;
    this.scheduleFn =
      deps.schedule ?? ((ms, cb) => setTimeout(cb, ms));
    this.clearScheduleFn = deps.clearSchedule ?? clearTimeout;
    this.processBatchImpl =
      deps.processBatch ?? (() => this.defaultProcessBatch());
    this.refreshQueueMetricsImpl =
      deps.refreshQueueMetrics ??
      (() =>
        refreshRecommendationOutboxQueueMetrics({
          retryBacklogWarnThreshold: this.retryBacklogWarnThreshold,
          deadWarnThreshold: this.deadWarnThreshold,
        }));

    this.storedState = enabled ? 'STARTING' : 'DISABLED';
  }

  get enabled(): boolean {
    return this.enabledFlag;
  }

  get required(): boolean {
    return this.requiredFlag;
  }

  get storedWorkerState(): RecommendationOutboxWorkerState {
    return this.storedState;
  }

  start(): void {
    if (
      this.markedStopped ||
      this.storedState === 'STOPPED' ||
      this.storedState === 'STOPPING' ||
      this.shutdownRequested
    ) {
      return;
    }
    if (!this.enabledFlag) {
      this.transitionTo('DISABLED', 'WORKER_DISABLED');
      return;
    }
    if (this.running) {
      return;
    }

    try {
      this.shutdownRequested = false;
      this.shutdownTimedOut = false;
      this.running = true;
      this.startedAtMs = this.now();
      this.transitionTo('STARTING', 'STARTUP_IN_PROGRESS');
      void this.loop();
    } catch (error) {
      this.running = false;
      this.lastFailureAtMs = this.now();
      this.lastFailureCode = 'start_failed';
      this.transitionTo('FAILED', 'START_FAILED');
      logger.error(
        {
          operation: 'recommendation.outbox.start_failed',
          workerId: this.workerId,
          component: 'recommendation-outbox-worker',
        },
        boundedErrorSummary(error),
      );
    }
  }

  async stop(
    timeoutMs: number = RECOMMENDATION_OUTBOX_SHUTDOWN_WAIT_MS,
  ): Promise<RecommendationOutboxStopResult> {
    if (this.markedStopped || this.storedState === 'STOPPED') {
      return { outcome: 'completed' };
    }

    this.shutdownRequested = true;
    this.running = false;
    this.transitionTo('STOPPING', 'SHUTDOWN_IN_PROGRESS');

    if (this.timer) {
      this.clearScheduleFn(this.timer);
      this.timer = null;
    }

    if (!this.currentRun) {
      return { outcome: 'completed' };
    }

    let settled = false;
    const inFlight = this.currentRun.finally(() => {
      settled = true;
    });

    const timedOut = await new Promise<boolean>((resolve) => {
      // Shutdown deadline uses real timers so it is independent of poll scheduling fakes.
      const timer = setTimeout(() => resolve(true), timeoutMs);
      void inFlight.then(() => {
        clearTimeout(timer);
        resolve(false);
      });
    });

    if (!timedOut && settled) {
      this.currentRun = null;
      this.pollInFlight = false;
      return { outcome: 'completed' };
    }

    if (!settled) {
      this.shutdownTimedOut = true;
      logger.error(
        {
          operation: 'recommendation.outbox.shutdown_timed_out',
          workerId: this.workerId,
          component: 'recommendation-outbox-worker',
          shutdownTimedOut: true,
          reasonCode: 'SHUTDOWN_TIMED_OUT',
        },
        'Outbox worker shutdown timed out with in-flight poll still running',
      );
      return { outcome: 'timedOut', inFlightStillRunning: true };
    }

    this.currentRun = null;
    this.pollInFlight = false;
    return { outcome: 'completed' };
  }

  /** Marks terminal STOPPED after HTTP close + Prisma disconnect on the graceful path. */
  markStopped(): void {
    this.markedStopped = true;
    this.running = false;
    this.pollInFlight = false;
    this.currentRun = null;
    this.transitionTo('STOPPED', 'STOPPED');
  }

  markShutdownRequested(): void {
    this.shutdownRequested = true;
  }

  getHealthSnapshot(nowMs: number = this.now()): RecommendationOutboxHealthSnapshot {
    const { effectiveState, reasonCodes, stale, ready } =
      this.deriveEffective(nowMs);

    return {
      enabled: this.enabledFlag,
      required: this.requiredFlag,
      state: this.storedState,
      effectiveState,
      startedAt: this.toIso(this.startedAtMs),
      lastPollStartedAt: this.toIso(this.lastPollStartedAtMs),
      lastPollCompletedAt: this.toIso(this.lastPollCompletedAtMs),
      lastSuccessfulPollAt: this.toIso(this.lastSuccessfulPollAtMs),
      lastFailureAt: this.toIso(this.lastFailureAtMs),
      lastFailureCode: this.lastFailureCode,
      consecutiveFailures: this.consecutiveFailures,
      pollInFlight: this.pollInFlight,
      retryBacklog: this.retryBacklog,
      retryBacklogCapped: this.retryBacklogCapped,
      deadRows: this.deadRows,
      deadRowsCapped: this.deadRowsCapped,
      queueMetricsRefreshedAt: this.toIso(this.queueMetricsRefreshedAtMs),
      queueMetricsStale: this.queueMetricsStale,
      stale,
      shutdownRequested: this.shutdownRequested,
      shutdownTimedOut: this.shutdownTimedOut,
      pollIntervalMs: this.config.pollIntervalMs,
      staleAfterMs: this.staleAfterMs,
      reasonCodes,
      ready,
    };
  }

  async processOnce(): Promise<number> {
    return this.processBatchImpl();
  }

  private async defaultProcessBatch(): Promise<number> {
    const rows = await claimRecommendationOutboxBatch({
      workerId: this.workerId,
      batchSize: this.config.batchSize,
      leaseMs: this.config.leaseMs,
    });
    for (const row of rows) {
      if (this.shutdownRequested) {
        break;
      }
      await processRecommendationOutboxRecord(row, this.config);
    }
    return rows.length;
  }

  private async loop(): Promise<void> {
    while (this.running && !this.shutdownRequested) {
      this.pollInFlight = true;
      this.lastPollStartedAtMs = this.now();
      let pollFailed = false;
      let failureCode: string | null = null;

      this.currentRun = this.processBatchImpl()
        .then(async () => {
          this.lastPollCompletedAtMs = this.now();
          this.lastSuccessfulPollAtMs = this.lastPollCompletedAtMs;
          this.consecutiveFailures = 0;
          this.lastFailureCode = null;
          this.applySuccessState();
          await this.maybeRefreshQueueMetrics();
        })
        .catch(async (error) => {
          pollFailed = true;
          failureCode = 'poll_failed';
          this.lastPollCompletedAtMs = this.now();
          this.lastFailureAtMs = this.lastPollCompletedAtMs;
          this.lastFailureCode = failureCode;
          this.consecutiveFailures += 1;
          logger.error(
            {
              operation: 'recommendation.outbox.poll_failed',
              workerId: this.workerId,
              component: 'recommendation-outbox-worker',
              consecutiveFailures: this.consecutiveFailures,
            },
            boundedErrorSummary(error),
          );
          this.applyFailureState();
          await this.maybeRefreshQueueMetrics();
        })
        .finally(() => {
          this.pollInFlight = false;
        });

      await this.currentRun;
      this.currentRun = null;
      void pollFailed;
      void failureCode;

      this.applyStoredStaleIfNeeded(this.now());

      if (this.running && !this.shutdownRequested) {
        await new Promise<void>((resolve) => {
          this.timer = this.scheduleFn(this.config.pollIntervalMs, () => {
            this.timer = null;
            resolve();
          });
        });
      }
    }
  }

  private applySuccessState(): void {
    if (
      this.storedState === 'STOPPING' ||
      this.storedState === 'STOPPED' ||
      this.storedState === 'DISABLED'
    ) {
      return;
    }
    if (this.hasWarnMetrics()) {
      this.transitionTo('DEGRADED', this.warnReasonCode());
      return;
    }
    this.transitionTo('HEALTHY', 'OK');
  }

  private applyFailureState(): void {
    if (
      this.storedState === 'STOPPING' ||
      this.storedState === 'STOPPED' ||
      this.storedState === 'DISABLED'
    ) {
      return;
    }
    if (this.consecutiveFailures >= this.consecutiveFailureThreshold) {
      this.transitionTo('FAILED', 'CONSECUTIVE_POLL_FAILURES');
      return;
    }
    if (this.lastSuccessfulPollAtMs !== null) {
      this.transitionTo('DEGRADED', 'TRANSIENT_POLL_FAILURE');
      return;
    }
    const nowMs = this.now();
    if (
      this.startedAtMs !== null &&
      nowMs - this.startedAtMs >= this.startupGraceMs
    ) {
      this.transitionTo('FAILED', 'STARTUP_GRACE_EXPIRED');
    }
  }

  private applyStoredStaleIfNeeded(nowMs: number): void {
    if (
      this.storedState === 'STOPPING' ||
      this.storedState === 'STOPPED' ||
      this.storedState === 'DISABLED' ||
      !this.enabledFlag
    ) {
      return;
    }
    if (this.isStale(nowMs)) {
      this.transitionTo('FAILED', 'POLL_STALE');
      return;
    }
    if (
      this.storedState === 'STARTING' &&
      this.startedAtMs !== null &&
      this.lastSuccessfulPollAtMs === null &&
      nowMs - this.startedAtMs >= this.startupGraceMs
    ) {
      this.transitionTo('FAILED', 'STARTUP_GRACE_EXPIRED');
    }
  }

  private isStale(nowMs: number): boolean {
    if (
      this.pollInFlight &&
      this.lastPollStartedAtMs !== null &&
      nowMs - this.lastPollStartedAtMs > this.staleAfterMs
    ) {
      return true;
    }
    if (
      this.lastSuccessfulPollAtMs !== null &&
      !this.pollInFlight &&
      nowMs - this.lastSuccessfulPollAtMs > this.staleAfterMs &&
      this.storedState !== 'STARTING'
    ) {
      return true;
    }
    return false;
  }

  private hasWarnMetrics(): boolean {
    const retryHigh =
      this.retryBacklogCapped === true ||
      (this.retryBacklog !== null &&
        this.retryBacklog >= this.retryBacklogWarnThreshold);
    const deadHigh =
      this.deadRowsCapped === true ||
      (this.deadRows !== null && this.deadRows >= this.deadWarnThreshold);
    return retryHigh || deadHigh || this.queueMetricsStale;
  }

  private warnReasonCode(): string {
    if (this.queueMetricsStale) {
      return 'BACKLOG_REFRESH_FAILED';
    }
    if (
      this.deadRowsCapped === true ||
      (this.deadRows !== null && this.deadRows >= this.deadWarnThreshold)
    ) {
      return 'DEAD_ROWS_PRESENT';
    }
    return 'RETRY_BACKLOG_HIGH';
  }

  private deriveEffective(nowMs: number): {
    effectiveState: RecommendationOutboxWorkerState;
    reasonCodes: string[];
    stale: boolean;
    ready: boolean;
  } {
    const reasonCodes: string[] = [];
    let effectiveState = this.storedState;
    const stale = this.isStale(nowMs);

    if (!this.enabledFlag) {
      effectiveState = 'DISABLED';
      if (this.requiredFlag) {
        reasonCodes.push('WORKER_REQUIRED_BUT_DISABLED');
      } else {
        reasonCodes.push('WORKER_DISABLED');
      }
      return {
        effectiveState,
        reasonCodes,
        stale: false,
        ready: !this.requiredFlag,
      };
    }

    if (this.storedState === 'STOPPING') {
      reasonCodes.push(
        this.shutdownTimedOut ? 'SHUTDOWN_TIMED_OUT' : 'SHUTDOWN_IN_PROGRESS',
      );
      return { effectiveState, reasonCodes, stale: false, ready: false };
    }

    if (this.storedState === 'STOPPED') {
      reasonCodes.push('STOPPED');
      return { effectiveState, reasonCodes, stale: false, ready: false };
    }

    if (this.storedState === 'STARTING') {
      if (
        this.startedAtMs !== null &&
        nowMs - this.startedAtMs >= this.startupGraceMs &&
        this.lastSuccessfulPollAtMs === null
      ) {
        effectiveState = 'FAILED';
        reasonCodes.push('STARTUP_GRACE_EXPIRED');
        return { effectiveState, reasonCodes, stale: false, ready: false };
      }
      reasonCodes.push('STARTUP_IN_PROGRESS');
      return { effectiveState, reasonCodes, stale: false, ready: false };
    }

    if (stale) {
      effectiveState = 'FAILED';
      reasonCodes.push('POLL_STALE');
      return { effectiveState, reasonCodes, stale: true, ready: false };
    }

    if (this.storedState === 'FAILED') {
      reasonCodes.push(
        this.lastFailureCode === 'poll_failed'
          ? 'CONSECUTIVE_POLL_FAILURES'
          : this.lastFailureCode?.toUpperCase() ?? 'FAILED',
      );
      return { effectiveState, reasonCodes, stale: false, ready: false };
    }

    if (this.storedState === 'DEGRADED') {
      reasonCodes.push(this.warnReasonCode());
      return { effectiveState, reasonCodes, stale: false, ready: true };
    }

    if (this.storedState === 'HEALTHY') {
      reasonCodes.push('OK');
      return { effectiveState, reasonCodes, stale: false, ready: true };
    }

    reasonCodes.push('STARTUP_IN_PROGRESS');
    return { effectiveState, reasonCodes, stale: false, ready: false };
  }

  private async maybeRefreshQueueMetrics(): Promise<void> {
    if (this.shutdownRequested) {
      return;
    }
    const nowMs = this.now();
    if (
      this.queueMetricsRefreshedAtMs !== null &&
      nowMs - this.queueMetricsRefreshedAtMs < this.queueMetricsRefreshIntervalMs
    ) {
      return;
    }
    if (this.metricsRefreshInFlight) {
      return;
    }

    this.metricsRefreshInFlight = (async () => {
      try {
        const metrics = await this.refreshQueueMetricsImpl();
        if (this.shutdownRequested) {
          return;
        }
        this.retryBacklog = metrics.retryBacklog;
        this.retryBacklogCapped = metrics.retryBacklogCapped;
        this.deadRows = metrics.deadRows;
        this.deadRowsCapped = metrics.deadRowsCapped;
        this.queueMetricsRefreshedAtMs = this.now();
        this.queueMetricsStale = false;
        // Never clear poll-failure degradation via metrics alone.
        if (
          this.consecutiveFailures === 0 &&
          (this.storedState === 'HEALTHY' || this.storedState === 'DEGRADED')
        ) {
          this.applySuccessState();
        }
      } catch {
        this.queueMetricsStale = true;
        // Throttle retries even on failure so we do not refresh every poll.
        this.queueMetricsRefreshedAtMs = this.now();
        if (
          this.storedState === 'HEALTHY' ||
          this.storedState === 'DEGRADED'
        ) {
          this.transitionTo('DEGRADED', 'BACKLOG_REFRESH_FAILED');
        }
      } finally {
        this.metricsRefreshInFlight = null;
      }
    })();

    await this.metricsRefreshInFlight;
  }

  private transitionTo(
    next: RecommendationOutboxWorkerState,
    reasonCode: string,
  ): void {
    if (this.storedState === next) {
      return;
    }
    const previous = this.storedState;
    this.storedState = next;
    logger.info(
      {
        operation: 'recommendation.outbox.state_transition',
        component: 'recommendation-outbox-worker',
        workerId: this.workerId,
        enabled: this.enabledFlag,
        required: this.requiredFlag,
        state: next,
        reasonCode,
        previousState: previous,
        consecutiveFailures: this.consecutiveFailures,
        retryBacklog: this.retryBacklog,
        deadRows: this.deadRows,
        pollIntervalMs: this.config.pollIntervalMs,
        staleAfterMs: this.staleAfterMs,
        batchSize: this.config.batchSize,
      },
      `Recommendation outbox worker ${previous} -> ${next}`,
    );
  }

  private toIso(ms: number | null): string | null {
    return ms === null ? null : new Date(ms).toISOString();
  }
}

export const recommendationOutboxWorkerDefaults = DEFAULT_CONFIG;
