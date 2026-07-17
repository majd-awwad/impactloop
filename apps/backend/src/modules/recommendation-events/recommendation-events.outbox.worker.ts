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
    eventSource:
      value.eventSource === 'SYNTHETIC' ||
      value.eventSource === 'TEST' ||
      value.eventSource === 'LOAD_TEST'
        ? value.eventSource
        : 'REAL',
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
    eventSource:
      value.eventSource === 'SYNTHETIC' ||
      value.eventSource === 'TEST' ||
      value.eventSource === 'LOAD_TEST'
        ? value.eventSource
        : 'REAL',
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
    eventSource:
      value.eventSource === 'SYNTHETIC' ||
      value.eventSource === 'TEST' ||
      value.eventSource === 'LOAD_TEST'
        ? value.eventSource
        : 'REAL',
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
    eventSource:
      value.eventSource === 'SYNTHETIC' ||
      value.eventSource === 'TEST' ||
      value.eventSource === 'LOAD_TEST'
        ? value.eventSource
        : 'REAL',
  };
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
      await tx.recommendationCandidateTrace.createMany({
        data: payload.candidateTraces.map((trace, index) => ({
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
        })),
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
      await tx.recommendationImpression.createMany({
        data: payload.impressions.map((impression) => ({
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
        })),
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
      deduplicationKey: row.deduplication_key,
      attempt,
      status: dead ? 'DEAD' : 'RETRY',
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

export class RecommendationOutboxWorker {
  readonly workerId = `recommendation-outbox-${randomUUID()}`;
  private readonly config: RecommendationOutboxWorkerConfig;
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private currentRun: Promise<void> | null = null;

  constructor(config: Partial<RecommendationOutboxWorkerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    void this.loop();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.currentRun) {
      await this.currentRun;
    }
  }

  async processOnce(): Promise<number> {
    const rows = await claimRecommendationOutboxBatch({
      workerId: this.workerId,
      batchSize: this.config.batchSize,
      leaseMs: this.config.leaseMs,
    });
    for (const row of rows) {
      await processRecommendationOutboxRecord(row, this.config);
    }
    return rows.length;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      this.currentRun = this.processOnce()
        .then(() => undefined)
        .catch((error) => {
          logger.error(
            { operation: 'recommendation.outbox.poll_failed', workerId: this.workerId },
            boundedErrorSummary(error),
          );
        });
      await this.currentRun;
      this.currentRun = null;

      if (this.running) {
        await new Promise<void>((resolve) => {
          this.timer = setTimeout(() => {
            this.timer = null;
            resolve();
          }, this.config.pollIntervalMs);
        });
      }
    }
  }
}

export const recommendationOutboxWorkerDefaults = DEFAULT_CONFIG;
