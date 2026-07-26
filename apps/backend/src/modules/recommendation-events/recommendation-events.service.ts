import { createHash, randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { NextFunction, Request, Response } from 'express';

import type {
  Prisma,
  RecommendationActionType,
  RecommendationAttributionType,
  RecommendationCacheState,
  RecommendationEntityType,
  RecommendationEligibilityResult,
  RecommendationEventSource,
  RecommendationOutboxEventKind,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { logger } from '../../observability/logger.js';
import { getRequestId } from '../../observability/request-context.js';
import { RECOMMENDATION_SCORER_VERSION } from '../../config/recommendation-scoring-version.js';
import {
  RecommendationEventOriginError,
  resolveRecommendationEventSource,
  type WritableRecommendationEventSource,
} from './recommendation-event-origin.js';

export const RECOMMENDATION_IMPRESSION_HEADER =
  'x-recommendation-impression-id';
export const RECOMMENDATION_SURFACE_HEADER = 'x-recommendation-surface';
export const RECOMMENDATION_ATTRIBUTION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_RECOMMENDATION_TRACE_ROWS = 512;
export const MAX_RECOMMENDATION_SCORE_COMPONENTS = 12;
export const MAX_RECOMMENDATION_OUTBOX_PAYLOAD_BYTES = 256 * 1024;
export const RECOMMENDATION_GENERATION_OUTBOX_SCHEMA_VERSION =
  'recommendation-generation-outbox-v1';
export const RECOMMENDATION_EXPOSURE_OUTBOX_SCHEMA_VERSION =
  'recommendation-exposure-outbox-v1';
export const RECOMMENDATION_ACTION_OUTBOX_SCHEMA_VERSION =
  'recommendation-action-outbox-v1';

export const RECOMMENDATION_ALGORITHM_NAME = 'deterministic-hybrid';
export const RECOMMENDATION_ALGORITHM_VERSION =
  `learner-home-v1:${RECOMMENDATION_SCORER_VERSION}`;
export const RECOMMENDATION_POLICY_VERSION = 'learner-home-policy-v1';

export const RECOMMENDATION_SURFACES = [
  'LEARNER_HOME',
  'LEARNER_HOME_SECTION',
] as const;

type EntityType = RecommendationEntityType;
type EventSource = RecommendationEventSource;
type WritableEventSource = WritableRecommendationEventSource;
type CacheState = RecommendationCacheState;

export class RecommendationOutboxIdentityConflictError extends Error {
  readonly code = 'outbox_identity_conflict' as const;
  readonly eventKind: RecommendationOutboxEventKind;
  readonly phase = 'enqueue' as const;
  readonly attemptedOrigin?: string;
  readonly storedOrigin?: string;
  readonly dedupeKeyPrefix?: string;

  constructor(input: {
    eventKind: RecommendationOutboxEventKind;
    attemptedOrigin?: string;
    storedOrigin?: string;
    deduplicationKey?: string;
  }) {
    super('Recommendation outbox identity conflict');
    this.name = 'RecommendationOutboxIdentityConflictError';
    this.eventKind = input.eventKind;
    this.attemptedOrigin = input.attemptedOrigin;
    this.storedOrigin = input.storedOrigin;
    this.dedupeKeyPrefix = input.deduplicationKey
      ? createHash('sha256')
          .update(input.deduplicationKey)
          .digest('hex')
          .slice(0, 12)
      : undefined;
  }
}

export type RecommendationCandidateTraceInput = {
  entityType: EntityType;
  entityId: string;
  surface: string;
  sectionKey?: string;
  candidateSource: string;
  eligibilityResult: RecommendationEligibilityResult;
  rankBeforeSelection?: number | null;
  finalScore?: number | null;
  scoreComponents?: Record<string, unknown> | null;
  exclusionReason?: string | null;
  selected?: boolean;
  eventSource?: EventSource;
};

export type RecommendationGenerationMetadata = {
  generationKey: string;
  learnerId: string;
  surface: string;
  algorithmName: string;
  algorithmVersion: string;
  policyVersion: string;
  generatedAt: Date;
  candidateCount: number;
  shownItemCount: number;
  generationDurationMs: number;
  generationCacheState: CacheState;
  candidateTraces: RecommendationCandidateTraceInput[];
  eventSource?: EventSource;
};

export type RecommendationExposureItem = {
  entityType: EntityType;
  entityId: string;
  sectionKey: string;
  position: number;
  score: number;
  reasons: string[];
};

export type RecommendationActionOutboxPayload = {
  schemaVersion: typeof RECOMMENDATION_ACTION_OUTBOX_SCHEMA_VERSION;
  actionId: string;
  learnerId: string;
  actionType: RecommendationActionType;
  entityType: EntityType;
  entityId: string;
  impressionId: string | null;
  sourceOperationId: string | null;
  occurredAt: string;
  eventSource: EventSource;
};

export type RecommendationActionPlan = {
  actionType: RecommendationActionType;
  entityType: EntityType;
  entityId: string;
  sourceOperationId: string;
};

const RECOMMENDATION_ACTION_TYPES: readonly RecommendationActionType[] = [
  'MATERIAL_VIEW',
  'MATERIAL_LIKE',
  'MATERIAL_UNLIKE',
  'RESERVATION_CREATED',
  'PROJECT_LIKE',
  'PROJECT_UNLIKE',
  'PROJECT_SAVE',
  'PROJECT_UNSAVE',
  'PROJECT_FOLLOW',
  'PROJECT_UNFOLLOW',
  'PROJECT_BUILD_STARTED',
  'PROJECT_BUILD_PROGRESS_UPDATED',
];

export type RecommendationOutboxTrace = {
  entityType: EntityType;
  entityId: string;
  surface: string;
  sectionKey: string | null;
  candidateSource: string;
  eligibilityResult: RecommendationEligibilityResult;
  rankBeforeSelection: number | null;
  finalScore: number | null;
  scoreComponents?: Record<string, unknown>;
  exclusionReason: string | null;
  selected: boolean;
  eventSource: EventSource;
};

export type RecommendationGenerationOutboxPayload = {
  schemaVersion: typeof RECOMMENDATION_GENERATION_OUTBOX_SCHEMA_VERSION;
  generationId: string;
  learnerId: string;
  surface: string;
  algorithmName: string;
  algorithmVersion: string;
  policyVersion: string;
  generatedAt: string;
  cacheState: CacheState;
  candidateCount: number;
  shownItemCount: number;
  generationDurationMs: number;
  persistedTraceCount: number;
  traceTruncated: boolean;
  candidateTraces: RecommendationOutboxTrace[];
  eventSource: EventSource;
};

export type RecommendationExposureOutboxImpression = {
  impressionId: string;
  entityType: EntityType;
  entityId: string;
  sectionKey: string;
  position: number;
  score: number;
  reasonCode: string;
};

export type RecommendationExposureOutboxPayload = {
  schemaVersion: typeof RECOMMENDATION_EXPOSURE_OUTBOX_SCHEMA_VERSION;
  exposureId: string;
  generationId: string;
  learnerId: string;
  surface: string;
  cacheState: CacheState;
  correlationId: string | null;
  exposedAt: string;
  candidateCount: number;
  shownItemCount: number;
  generationDurationMs: number;
  algorithmName: string;
  algorithmVersion: string;
  policyVersion: string;
  impressions: RecommendationExposureOutboxImpression[];
  eventSource: EventSource;
};

export type RecommendationOutboxEnqueueResult = {
  enqueued: boolean;
  exposureId?: string;
  impressionIds: Map<string, string>;
};

export type RecommendationAttributionHeaders = {
  impressionId?: string;
  surface?: string;
};

const isFiniteNumber = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value);

const boundedString = (value: string | null | undefined, max: number) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : undefined;
};

const firstHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const readRecommendationAttributionHeaders = (
  headers: IncomingHttpHeaders,
): RecommendationAttributionHeaders => ({
  impressionId: boundedString(
    firstHeaderValue(headers[RECOMMENDATION_IMPRESSION_HEADER]),
    128,
  ),
  surface: boundedString(
    firstHeaderValue(headers[RECOMMENDATION_SURFACE_HEADER]),
    100,
  ),
});

const reasonCodeFor = (reasons: string[]): string => {
  const normalized = reasons.map((reason) => reason.toLowerCase());

  if (normalized.some((reason) => reason.includes('saved project'))) {
    return 'SAVED_PROJECT_MATCH';
  }
  if (normalized.some((reason) => reason.includes('required component'))) {
    return 'PROJECT_COMPONENT_MATCH';
  }
  if (normalized.some((reason) => reason.includes('interest'))) {
    return 'INTEREST_MATCH';
  }
  if (
    normalized.some(
      (reason) =>
        reason.includes('recent activity') ||
        reason.includes('materials you liked') ||
        reason.includes('materials you reserved') ||
        reason.includes('building a'),
    )
  ) {
    return 'BEHAVIOR_MATCH';
  }
  if (normalized.some((reason) => reason.includes('near your saved location'))) {
    return 'LOCATION_MATCH';
  }
  if (normalized.some((reason) => reason.includes('free material'))) {
    return 'FREE_MATERIAL';
  }
  if (normalized.some((reason) => reason.includes('delivery'))) {
    return 'DELIVERY_AVAILABLE';
  }
  if (normalized.some((reason) => reason.includes('popular'))) {
    return 'POPULAR';
  }
  if (normalized.some((reason) => reason.includes('recently'))) {
    return 'RECENT';
  }
  if (normalized.some((reason) => reason.includes('saved by you'))) {
    return 'SAVED_BY_LEARNER';
  }
  if (normalized.some((reason) => reason.includes('continue') || reason.includes('ready'))) {
    return 'PROJECT_PROGRESS';
  }

  return 'BASELINE_RECOMMENDATION';
};

const validTrace = (trace: RecommendationCandidateTraceInput): boolean =>
  Boolean(
    boundedString(trace.entityId, 191) &&
      boundedString(trace.surface, 100) &&
      boundedString(trace.candidateSource, 100) &&
      (trace.rankBeforeSelection == null ||
        Number.isInteger(trace.rankBeforeSelection) &&
        trace.rankBeforeSelection > 0) &&
      (trace.finalScore == null || isFiniteNumber(trace.finalScore)),
  );

const prepareTraces = (
  traces: RecommendationCandidateTraceInput[],
  generationKey: string,
  defaultEventSource: WritableEventSource,
) =>
  traces
    .filter(validTrace)
    .slice(0, MAX_RECOMMENDATION_TRACE_ROWS)
    .map((trace, index) => ({
      id: createHash('sha256')
        .update(`${generationKey}:${index}`)
        .digest('hex')
        .slice(0, 32),
      generationId: '',
      entityType: trace.entityType,
      entityId: trace.entityId.trim(),
      surface: trace.surface.trim(),
      sectionKey: boundedString(trace.sectionKey, 100) ?? null,
      candidateSource: trace.candidateSource.trim(),
      eligibilityResult: trace.eligibilityResult,
      rankBeforeSelection: trace.rankBeforeSelection ?? null,
      finalScore: trace.finalScore ?? null,
      ...(trace.scoreComponents
        ? {
            scoreComponents: trace.scoreComponents as Prisma.InputJsonValue,
          }
        : {}),
      exclusionReason: boundedString(trace.exclusionReason, 191) ?? null,
      selected: trace.selected === true,
      eventSource: trace.eventSource
        ? resolveRecommendationEventSource(trace.eventSource)
        : defaultEventSource,
    }));

const prepareExposureItems = (items: RecommendationExposureItem[]) =>
  items.flatMap((item) => {
    if (
      !boundedString(item.entityId, 191) ||
      !boundedString(item.sectionKey, 100) ||
      !Number.isInteger(item.position) ||
      item.position <= 0 ||
      !isFiniteNumber(item.score)
    ) {
      return [];
    }

    return [
      {
        ...item,
        entityId: item.entityId.trim(),
        sectionKey: item.sectionKey.trim(),
        reasonCode: reasonCodeFor(item.reasons),
      },
    ];
  });

const prepareScoreComponents = (
  scoreComponents: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined => {
  if (!scoreComponents) {
    return undefined;
  }

  const bounded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(scoreComponents)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, MAX_RECOMMENDATION_SCORE_COMPONENTS)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      bounded[key.slice(0, 64)] = value;
    } else if (
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      bounded[key.slice(0, 64)] = value;
    }
  }

  return Object.keys(bounded).length > 0 ? bounded : undefined;
};

const outboxTraceFor = (
  trace: RecommendationCandidateTraceInput,
  defaultEventSource: WritableEventSource,
): RecommendationOutboxTrace | null => {
  if (!validTrace(trace)) {
    return null;
  }

  const scoreComponents = prepareScoreComponents(trace.scoreComponents);

  return {
    entityType: trace.entityType,
    entityId: trace.entityId.trim(),
    surface: trace.surface.trim(),
    sectionKey: boundedString(trace.sectionKey, 100) ?? null,
    candidateSource: trace.candidateSource.trim(),
    eligibilityResult: trace.eligibilityResult,
    rankBeforeSelection: trace.rankBeforeSelection ?? null,
    finalScore: trace.finalScore ?? null,
    ...(scoreComponents ? { scoreComponents } : {}),
    exclusionReason: boundedString(trace.exclusionReason, 191) ?? null,
    selected: trace.selected === true,
    eventSource: trace.eventSource
      ? resolveRecommendationEventSource(trace.eventSource)
      : defaultEventSource,
  };
};

const payloadByteLength = (payload: unknown): number =>
  Buffer.byteLength(JSON.stringify(payload));

const buildGenerationOutboxPayload = (
  generation: RecommendationGenerationMetadata,
  eventSource: WritableEventSource,
): RecommendationGenerationOutboxPayload | null => {
  const sourceTraces = generation.candidateTraces;
  const traces = sourceTraces
    .map((trace) => outboxTraceFor(trace, eventSource))
    .filter((trace): trace is RecommendationOutboxTrace => trace !== null)
    .slice(0, MAX_RECOMMENDATION_TRACE_ROWS);
  const traceTruncated = traces.length !== sourceTraces.length;
  const payload: RecommendationGenerationOutboxPayload = {
    schemaVersion: RECOMMENDATION_GENERATION_OUTBOX_SCHEMA_VERSION,
    generationId: generation.generationKey,
    learnerId: generation.learnerId,
    surface: generation.surface,
    algorithmName: generation.algorithmName,
    algorithmVersion: generation.algorithmVersion,
    policyVersion: generation.policyVersion,
    generatedAt: generation.generatedAt.toISOString(),
    cacheState: generation.generationCacheState,
    candidateCount: Math.max(0, Math.trunc(generation.candidateCount)),
    shownItemCount: Math.max(0, Math.trunc(generation.shownItemCount)),
    generationDurationMs: Math.max(0, Math.trunc(generation.generationDurationMs)),
    persistedTraceCount: traces.length,
    traceTruncated,
    candidateTraces: traces,
    eventSource,
  };

  while (
    payloadByteLength(payload) > MAX_RECOMMENDATION_OUTBOX_PAYLOAD_BYTES &&
    payload.candidateTraces.length > 0
  ) {
    payload.candidateTraces.pop();
    payload.persistedTraceCount = payload.candidateTraces.length;
    payload.traceTruncated = true;
  }

  return payloadByteLength(payload) <= MAX_RECOMMENDATION_OUTBOX_PAYLOAD_BYTES
    ? payload
    : null;
};

const buildExposureOutboxPayload = (input: {
  generation: RecommendationGenerationMetadata;
  cacheState: CacheState;
  correlationId?: string;
  items: RecommendationExposureItem[];
  eventSource: WritableEventSource;
}): {
  payload: RecommendationExposureOutboxPayload;
  impressionIds: Map<string, string>;
} => {
  const exposureId = randomUUID();
  const impressionIds = new Map<string, string>();
  const items = prepareExposureItems(input.items);
  const impressions = items.map((item) => {
    const key = `${item.entityType}:${item.entityId}:${item.sectionKey}:${item.position}`;
    const impressionId = randomUUID();
    impressionIds.set(key, impressionId);
    return {
      impressionId,
      entityType: item.entityType,
      entityId: item.entityId,
      sectionKey: item.sectionKey,
      position: item.position,
      score: item.score,
      reasonCode: item.reasonCode,
    };
  });

  return {
    payload: {
      schemaVersion: RECOMMENDATION_EXPOSURE_OUTBOX_SCHEMA_VERSION,
      exposureId,
      generationId: input.generation.generationKey,
      learnerId: input.generation.learnerId,
      surface: input.generation.surface,
      cacheState: input.cacheState,
      correlationId: boundedString(input.correlationId, 191) ?? null,
      exposedAt: new Date().toISOString(),
      candidateCount: Math.max(0, Math.trunc(input.generation.candidateCount)),
      shownItemCount: impressions.length,
      generationDurationMs: Math.max(
        0,
        Math.trunc(input.generation.generationDurationMs),
      ),
      algorithmName: input.generation.algorithmName,
      algorithmVersion: input.generation.algorithmVersion,
      policyVersion: input.generation.policyVersion,
      impressions,
      eventSource: input.eventSource,
    },
    impressionIds,
  };
};

const writeFailureContext = (input: {
  learnerId?: string;
  correlationId?: string;
  phase: string;
}) => ({
  operation: 'recommendation.telemetry.write_failed',
  learnerHomeScope: input.phase,
  ...(input.learnerId ? { userId: input.learnerId } : {}),
  ...(input.correlationId ? { requestId: input.correlationId } : {}),
});

const isUniqueConstraintError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002',
  );

const canonicalJson = (value: unknown): string => {
  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') {
      return input;
    }
    if (Array.isArray(input)) {
      return input.map(normalize);
    }
    const record = input as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = normalize(record[key]);
    }
    return sorted;
  };
  return JSON.stringify(normalize(value));
};

const readOutboxPayload = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const readPayloadEventSource = (payload: unknown): string | undefined => {
  const record = readOutboxPayload(payload);
  return typeof record?.eventSource === 'string' ? record.eventSource : undefined;
};

const conflictLogFields = (error: RecommendationOutboxIdentityConflictError) => ({
  conflictCode: error.code,
  eventKind: error.eventKind,
  phase: error.phase,
  ...(error.attemptedOrigin ? { attemptedOrigin: error.attemptedOrigin } : {}),
  ...(error.storedOrigin ? { storedOrigin: error.storedOrigin } : {}),
  ...(error.dedupeKeyPrefix ? { dedupeKeyPrefix: error.dedupeKeyPrefix } : {}),
});

const impressionIdsFromExposurePayload = (
  payload: RecommendationExposureOutboxPayload,
): Map<string, string> => {
  const impressionIds = new Map<string, string>();
  for (const item of payload.impressions) {
    impressionIds.set(
      `${item.entityType}:${item.entityId}:${item.sectionKey}:${item.position}`,
      item.impressionId,
    );
  }
  return impressionIds;
};

const generationIdentityFingerprint = (
  payload: RecommendationGenerationOutboxPayload,
): string =>
  canonicalJson({
    schemaVersion: payload.schemaVersion,
    generationId: payload.generationId,
    learnerId: payload.learnerId,
    surface: payload.surface,
    algorithmName: payload.algorithmName,
    algorithmVersion: payload.algorithmVersion,
    policyVersion: payload.policyVersion,
    generatedAt: payload.generatedAt,
    cacheState: payload.cacheState,
    candidateCount: payload.candidateCount,
    shownItemCount: payload.shownItemCount,
    generationDurationMs: payload.generationDurationMs,
    persistedTraceCount: payload.persistedTraceCount,
    traceTruncated: payload.traceTruncated,
    eventSource: payload.eventSource,
    candidateTraces: payload.candidateTraces.map((trace) => ({
      entityType: trace.entityType,
      entityId: trace.entityId,
      surface: trace.surface,
      sectionKey: trace.sectionKey,
      candidateSource: trace.candidateSource,
      eligibilityResult: trace.eligibilityResult,
      rankBeforeSelection: trace.rankBeforeSelection,
      finalScore: trace.finalScore,
      ...(trace.scoreComponents ? { scoreComponents: trace.scoreComponents } : {}),
      exclusionReason: trace.exclusionReason,
      selected: trace.selected,
      eventSource: trace.eventSource,
    })),
  });

const exposureIdentityFingerprint = (
  payload: RecommendationExposureOutboxPayload,
): string =>
  canonicalJson({
    schemaVersion: payload.schemaVersion,
    generationId: payload.generationId,
    learnerId: payload.learnerId,
    surface: payload.surface,
    cacheState: payload.cacheState,
    correlationId: payload.correlationId,
    candidateCount: payload.candidateCount,
    shownItemCount: payload.shownItemCount,
    generationDurationMs: payload.generationDurationMs,
    algorithmName: payload.algorithmName,
    algorithmVersion: payload.algorithmVersion,
    policyVersion: payload.policyVersion,
    eventSource: payload.eventSource,
    impressions: [...payload.impressions]
      .map((item) => ({
        entityType: item.entityType,
        entityId: item.entityId,
        sectionKey: item.sectionKey,
        position: item.position,
        score: item.score,
        reasonCode: item.reasonCode,
      }))
      .sort((left, right) =>
        left.position !== right.position
          ? left.position - right.position
          : left.sectionKey.localeCompare(right.sectionKey),
      ),
  });

export const recommendationExposureOutboxDeduplicationKey = (
  payload: RecommendationExposureOutboxPayload,
): string =>
  `exposure:${createHash('sha256')
    .update(exposureIdentityFingerprint(payload))
    .digest('hex')
    .slice(0, 40)}`;

const actionIdentityFingerprint = (
  payload: RecommendationActionOutboxPayload,
): string =>
  canonicalJson({
    schemaVersion: payload.schemaVersion,
    learnerId: payload.learnerId,
    actionType: payload.actionType,
    entityType: payload.entityType,
    entityId: payload.entityId,
    impressionId: payload.impressionId,
    sourceOperationId: payload.sourceOperationId,
    eventSource: payload.eventSource,
  });

const assertMatchingOutboxIdentity = (input: {
  eventKind: RecommendationOutboxEventKind;
  deduplicationKey: string;
  existingPayload: unknown;
  nextPayload: unknown;
}): void => {
  const existing = readOutboxPayload(input.existingPayload);
  const attemptedOrigin = readPayloadEventSource(input.nextPayload);
  const storedOrigin = readPayloadEventSource(input.existingPayload);
  if (!existing || storedOrigin == null) {
    throw new RecommendationOutboxIdentityConflictError({
      eventKind: input.eventKind,
      attemptedOrigin,
      storedOrigin,
      deduplicationKey: input.deduplicationKey,
    });
  }

  if (input.eventKind === 'RECOMMENDATION_GENERATION') {
    if (
      generationIdentityFingerprint(
        existing as unknown as RecommendationGenerationOutboxPayload,
      ) !==
      generationIdentityFingerprint(
        input.nextPayload as RecommendationGenerationOutboxPayload,
      )
    ) {
      throw new RecommendationOutboxIdentityConflictError({
        eventKind: input.eventKind,
        attemptedOrigin,
        storedOrigin,
        deduplicationKey: input.deduplicationKey,
      });
    }
    return;
  }

  if (input.eventKind === 'RECOMMENDATION_EXPOSURE') {
    if (
      exposureIdentityFingerprint(
        existing as unknown as RecommendationExposureOutboxPayload,
      ) !==
      exposureIdentityFingerprint(
        input.nextPayload as RecommendationExposureOutboxPayload,
      )
    ) {
      throw new RecommendationOutboxIdentityConflictError({
        eventKind: input.eventKind,
        attemptedOrigin,
        storedOrigin,
        deduplicationKey: input.deduplicationKey,
      });
    }
    return;
  }

  if (
    actionIdentityFingerprint(
      existing as unknown as RecommendationActionOutboxPayload,
    ) !==
    actionIdentityFingerprint(input.nextPayload as RecommendationActionOutboxPayload)
  ) {
    throw new RecommendationOutboxIdentityConflictError({
      eventKind: input.eventKind,
      attemptedOrigin,
      storedOrigin,
      deduplicationKey: input.deduplicationKey,
    });
  }
};

const createOutboxRowIdempotent = async (
  tx: Prisma.TransactionClient,
  row: {
    eventKind: RecommendationOutboxEventKind;
    schemaVersion: string;
    deduplicationKey: string;
    payload: Prisma.InputJsonValue;
  },
): Promise<{ outcome: 'created' | 'idempotent'; payload: unknown }> => {
  const savepoint = `sp_${createHash('sha256')
    .update(row.deduplicationKey)
    .digest('hex')
    .slice(0, 24)}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    await tx.recommendationEventOutbox.create({ data: row });
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
    return { outcome: 'created', payload: row.payload };
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const existing = await tx.recommendationEventOutbox.findUnique({
      where: { deduplicationKey: row.deduplicationKey },
      select: { payload: true, eventKind: true },
    });
    if (!existing || existing.eventKind !== row.eventKind) {
      throw new RecommendationOutboxIdentityConflictError({
        eventKind: row.eventKind,
        attemptedOrigin: readPayloadEventSource(row.payload),
        storedOrigin: readPayloadEventSource(existing?.payload),
        deduplicationKey: row.deduplicationKey,
      });
    }
    assertMatchingOutboxIdentity({
      eventKind: row.eventKind,
      deduplicationKey: row.deduplicationKey,
      existingPayload: existing.payload,
      nextPayload: row.payload,
    });
    return { outcome: 'idempotent', payload: existing.payload };
  }
};

export const enqueueRecommendationExposure = async (input: {
  generation: RecommendationGenerationMetadata;
  cacheState: CacheState;
  correlationId?: string;
  items: RecommendationExposureItem[];
  includeGeneration: boolean;
}): Promise<RecommendationOutboxEnqueueResult> => {
  try {
    const eventSource = resolveRecommendationEventSource(
      input.generation.eventSource,
    );
    const exposure = buildExposureOutboxPayload({ ...input, eventSource });
    const generation = input.includeGeneration
      ? buildGenerationOutboxPayload(input.generation, eventSource)
      : null;

    if (input.includeGeneration && !generation) {
      logger.warn(
        writeFailureContext({
          learnerId: input.generation.learnerId,
          correlationId: input.correlationId,
          phase: 'recommendation-outbox-payload',
        }),
        'Recommendation generation outbox payload exceeded its bounded size',
      );
      return { enqueued: false, impressionIds: new Map() };
    }

    if (
      payloadByteLength(exposure.payload) >
      MAX_RECOMMENDATION_OUTBOX_PAYLOAD_BYTES
    ) {
      logger.warn(
        writeFailureContext({
          learnerId: input.generation.learnerId,
          correlationId: input.correlationId,
          phase: 'recommendation-outbox-payload',
        }),
        'Recommendation exposure outbox payload exceeded its bounded size',
      );
      return { enqueued: false, impressionIds: new Map() };
    }

    const exposureDeduplicationKey = recommendationExposureOutboxDeduplicationKey(
      exposure.payload,
    );
    let storedExposure = exposure.payload;

    await prisma.$transaction(async (tx) => {
      if (generation) {
        await createOutboxRowIdempotent(tx, {
          eventKind: 'RECOMMENDATION_GENERATION',
          schemaVersion: generation.schemaVersion,
          deduplicationKey: `generation:${generation.generationId}`,
          payload: generation as unknown as Prisma.InputJsonValue,
        });
      }
      const exposureResult = await createOutboxRowIdempotent(tx, {
        eventKind: 'RECOMMENDATION_EXPOSURE',
        schemaVersion: exposure.payload.schemaVersion,
        deduplicationKey: exposureDeduplicationKey,
        payload: exposure.payload as unknown as Prisma.InputJsonValue,
      });
      storedExposure =
        exposureResult.payload as RecommendationExposureOutboxPayload;
    });

    return {
      enqueued: true,
      exposureId: storedExposure.exposureId,
      impressionIds: impressionIdsFromExposurePayload(storedExposure),
    };
  } catch (error) {
    logger.warn(
      {
        ...writeFailureContext({
          phase: 'recommendation-outbox-enqueue',
        }),
        ...(error instanceof RecommendationOutboxIdentityConflictError
          ? conflictLogFields(error)
          : error instanceof RecommendationEventOriginError
            ? { conflictCode: 'origin_rejected' }
            : {}),
      },
      error instanceof RecommendationOutboxIdentityConflictError
        ? error.code
        : error instanceof Error
          ? error.message.slice(0, 191)
          : 'Recommendation outbox enqueue failed',
    );
    return { enqueued: false, impressionIds: new Map() };
  }
};

const responseData = (body: unknown): Record<string, unknown> | null => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  if (record.success !== true || !record.data || typeof record.data !== 'object') {
    return null;
  }

  return record.data as Record<string, unknown>;
};

const responseItemId = (body: unknown): string | undefined => {
  const data = responseData(body);
  return boundedString(data?.id as string | undefined, 191);
};

const requestHeader = (req: Request, name: string): string | undefined =>
  boundedString(req.headers[name.toLowerCase()] as string | undefined, 191);

const pathParam = (req: Request, name: string): string | undefined =>
  boundedString(req.params?.[name] as string | undefined, 191);

const sourceOperationIdFor = (req: Request, durableId?: string): string | undefined =>
  boundedString(durableId, 191) ??
  requestHeader(req, 'idempotency-key') ??
  boundedString(getRequestIdFromContext(), 191);

const getRequestIdFromContext = (): string | undefined => {
  try {
    return getRequestId();
  } catch {
    return undefined;
  }
};

const isLearnerRequest = (req: Request): boolean =>
  Boolean(req.auth?.roles.some((role) => role.toUpperCase() === 'LEARNER'));

const actionPlanFor = (
  req: Request,
  body: unknown,
): RecommendationActionPlan | null => {
  if (!isLearnerRequest(req) || req.path.length > 240 || !responseData(body)) {
    return null;
  }

  const method = req.method.toUpperCase();
  const requestPath = req.path.startsWith('/api/')
    ? req.path
    : `${req.baseUrl ?? ''}${req.path}`;
  const path = requestPath.replace(/\/$/, '');
  const projectId = pathParam(req, 'id');
  const materialId = pathParam(req, 'id');
  const sourceOperationId = (durableId?: string) =>
    sourceOperationIdFor(req, durableId);
  const plan = (
    actionType: RecommendationActionType,
    entityType: EntityType,
    entityId: string | undefined,
    durableId?: string,
  ): RecommendationActionPlan | null => {
    const source = sourceOperationId(durableId);
    const entity = boundedString(entityId, 191);
    return source && entity
      ? { actionType, entityType, entityId: entity, sourceOperationId: source }
      : null;
  };

  if (method === 'GET' && /^\/api\/materials\/[^/]+$/.test(path)) {
    return plan('MATERIAL_VIEW', 'MATERIAL', materialId);
  }

  if (
    /^\/api\/materials\/[^/]+\/like$/.test(path) &&
    (method === 'POST' || method === 'DELETE')
  ) {
    return plan(
      method === 'POST' ? 'MATERIAL_LIKE' : 'MATERIAL_UNLIKE',
      'MATERIAL',
      materialId,
    );
  }

  if (
    /^\/api\/learning-projects\/[^/]+\/(like|save|follow)$/.test(path) &&
    (method === 'POST' || method === 'DELETE')
  ) {
    const operation = path.split('/').at(-1);
    const actionType =
      operation === 'like'
        ? method === 'POST'
          ? 'PROJECT_LIKE'
          : 'PROJECT_UNLIKE'
        : operation === 'save'
          ? method === 'POST'
            ? 'PROJECT_SAVE'
            : 'PROJECT_UNSAVE'
          : method === 'POST'
            ? 'PROJECT_FOLLOW'
            : 'PROJECT_UNFOLLOW';
    return plan(actionType as RecommendationActionType, 'PROJECT', projectId);
  }

  if (
    method === 'POST' &&
    /^\/api\/learning-projects\/[^/]+\/builds\/start$/.test(path)
  ) {
    return plan(
      'PROJECT_BUILD_STARTED',
      'PROJECT',
      projectId,
      responseItemId(body),
    );
  }

  if (
    method === 'PATCH' &&
    /^\/api\/learning-projects\/[^/]+\/builds\/me\/items\/[^/]+$/.test(path)
  ) {
    const data = responseData(body);
    const itemId = boundedString(path.split('/').at(-1), 191);
    const updatedAt = boundedString(data?.updatedAt as string | undefined, 64);
    const buildId = responseItemId(body);
    const durableId =
      buildId && itemId && updatedAt
        ? `build:${buildId}:item:${itemId}:${updatedAt}`
        : undefined;
    return plan(
      'PROJECT_BUILD_PROGRESS_UPDATED',
      'PROJECT',
      projectId,
      durableId,
    );
  }

  if (method === 'POST' && /^\/api\/reservations$/.test(path)) {
    const data = responseData(body);
    const reservationId = responseItemId(body);
    const reservationMaterial = data?.material;
    const entityId =
      reservationMaterial && typeof reservationMaterial === 'object'
        ? boundedString(
            (reservationMaterial as Record<string, unknown>).id as string | undefined,
            191,
          )
        : undefined;
    return plan('RESERVATION_CREATED', 'MATERIAL', entityId, reservationId);
  }

  return null;
};

export const getRecommendationActionPlan = actionPlanFor;

export const enqueueRecommendationAction = async (input: {
  learnerId: string;
  plan: RecommendationActionPlan;
  headers: IncomingHttpHeaders;
  occurredAt?: Date;
  eventSource?: EventSource;
}): Promise<boolean> => {
  try {
    if (
      !boundedString(input.learnerId, 191) ||
      !RECOMMENDATION_ACTION_TYPES.includes(input.plan.actionType) ||
      !boundedString(input.plan.entityId, 191) ||
      !boundedString(input.plan.sourceOperationId, 191)
    ) {
      return false;
    }

    const eventSource = resolveRecommendationEventSource(input.eventSource);
    const payload: RecommendationActionOutboxPayload = {
      schemaVersion: RECOMMENDATION_ACTION_OUTBOX_SCHEMA_VERSION,
      actionId: randomUUID(),
      learnerId: input.learnerId,
      actionType: input.plan.actionType,
      entityType: input.plan.entityType,
      entityId: input.plan.entityId,
      impressionId:
        readRecommendationAttributionHeaders(input.headers).impressionId ?? null,
      sourceOperationId: input.plan.sourceOperationId,
      occurredAt: (input.occurredAt ?? new Date()).toISOString(),
      eventSource,
    };

    if (payloadByteLength(payload) > MAX_RECOMMENDATION_OUTBOX_PAYLOAD_BYTES) {
      return false;
    }

    await prisma.$transaction(async (tx) => {
      await createOutboxRowIdempotent(tx, {
        eventKind: 'RECOMMENDATION_ACTION',
        schemaVersion: payload.schemaVersion,
        deduplicationKey: `action:${payload.actionType}:${payload.sourceOperationId}`,
        payload: payload as unknown as Prisma.InputJsonValue,
      });
    });
    return true;
  } catch (error) {
    logger.warn(
      {
        ...writeFailureContext({
          phase: 'recommendation-action-outbox-enqueue',
        }),
        ...(error instanceof RecommendationOutboxIdentityConflictError
          ? conflictLogFields(error)
          : error instanceof RecommendationEventOriginError
            ? { conflictCode: 'origin_rejected' }
            : {}),
      },
      error instanceof RecommendationOutboxIdentityConflictError
        ? error.code
        : error instanceof Error
          ? error.message.slice(0, 191)
          : 'Recommendation action outbox enqueue failed',
    );
    return false;
  }
};

export const recommendationActionAttributionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const originalJson = res.json.bind(res);
  let actionCaptureAttempted = false;
  res.json = ((body: unknown) => {
    if (res.statusCode >= 400 || actionCaptureAttempted) {
      return originalJson(body);
    }

    const plan = actionPlanFor(req, body);
    if (!plan || !req.auth?.sub) {
      return originalJson(body);
    }
    actionCaptureAttempted = true;

    void enqueueRecommendationAction({
      learnerId: req.auth.sub,
      plan,
      headers: req.headers,
    }).finally(() => {
      originalJson(body);
    });
    return res;
  }) as Response['json'];
  next();
};

export const persistRecommendationExposure = async (input: {
  generation: RecommendationGenerationMetadata;
  cacheState: CacheState;
  correlationId?: string;
  items: RecommendationExposureItem[];
}): Promise<Map<string, string>> => {
  const items = prepareExposureItems(input.items);
  const impressionIds = new Map<string, string>();
  let eventSource: WritableEventSource;
  try {
    eventSource = resolveRecommendationEventSource(input.generation.eventSource);
  } catch (error) {
    logger.error(
      writeFailureContext({
        learnerId: input.generation.learnerId,
        correlationId: input.correlationId,
        phase: 'recommendation-exposure',
      }),
      error instanceof Error ? error.message : 'Recommendation origin required',
    );
    return new Map();
  }

  for (const item of items) {
    impressionIds.set(
      `${item.entityType}:${item.entityId}:${item.sectionKey}:${item.position}`,
      randomUUID(),
    );
  }

  const writeExposureTransaction = async (): Promise<void> => {
    await prisma.$transaction(async (tx) => {
      const generation = await tx.recommendationGeneration.upsert({
        where: { generationKey: input.generation.generationKey },
        create: {
          generationKey: input.generation.generationKey,
          learnerId: input.generation.learnerId,
          surface: input.generation.surface,
          algorithmName: input.generation.algorithmName,
          algorithmVersion: input.generation.algorithmVersion,
          policyVersion: input.generation.policyVersion,
          generatedAt: input.generation.generatedAt,
          cacheState: input.generation.generationCacheState,
          candidateCount: input.generation.candidateCount,
          shownItemCount: input.generation.shownItemCount,
          generationDurationMs: input.generation.generationDurationMs,
          eventSource,
        },
        update: {},
      });

      const existingTrace = await tx.recommendationCandidateTrace.findFirst({
        where: { generationId: generation.id },
        select: { id: true },
      });
      if (!existingTrace) {
        const traces = prepareTraces(
          input.generation.candidateTraces,
          input.generation.generationKey,
          eventSource,
        ).map((trace) => ({ ...trace, generationId: generation.id }));
        if (traces.length > 0) {
          await tx.recommendationCandidateTrace.createMany({
            data: traces,
            skipDuplicates: true,
          });
        }
      }

      const request = await tx.recommendationRequest.create({
        data: {
          learnerId: input.generation.learnerId,
          generationId: generation.id,
          surface: input.generation.surface,
          algorithmName: input.generation.algorithmName,
          algorithmVersion: input.generation.algorithmVersion,
          policyVersion: input.generation.policyVersion,
          cacheState: input.cacheState,
          correlationId: input.correlationId ?? null,
          candidateCount: input.generation.candidateCount,
          shownItemCount: items.length,
          generationDurationMs: input.generation.generationDurationMs,
          eventSource,
        },
      });

      if (items.length > 0) {
        await tx.recommendationImpression.createMany({
          data: items.map((item) => ({
            id: impressionIds.get(
              `${item.entityType}:${item.entityId}:${item.sectionKey}:${item.position}`,
            )!,
            requestId: request.id,
            learnerId: input.generation.learnerId,
            entityType: item.entityType,
            entityId: item.entityId,
            surface: input.generation.surface,
            sectionKey: item.sectionKey,
            position: item.position,
            score: item.score,
            reasonCode: item.reasonCode,
            algorithmName: input.generation.algorithmName,
            algorithmVersion: input.generation.algorithmVersion,
            shownAt: new Date(),
            eventSource,
          })),
        });
      }
    });
  };

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await writeExposureTransaction();
        break;
      } catch (error) {
        if (!isUniqueConstraintError(error) || attempt === 2) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
      }
    }
  } catch (error) {
    logger.error(
      writeFailureContext({
        learnerId: input.generation.learnerId,
        correlationId: input.correlationId,
        phase: 'recommendation-exposure',
      }),
      error instanceof Error ? error.message : 'Recommendation telemetry write failed',
    );
    return new Map();
  }

  return impressionIds;
};

export const getRecommendationImpressionId = (
  impressionIds: Map<string, string>,
  item: RecommendationExposureItem,
): string | undefined =>
  impressionIds.get(
    `${item.entityType}:${item.entityId}:${item.sectionKey}:${item.position}`,
  );

export const getRecommendationEntityId = (
  entityType: EntityType,
  value: Record<string, unknown>,
): string | null => {
  if (entityType === 'PROJECT') {
    const projectId = value.projectId;
    if (typeof projectId === 'string' && projectId.trim()) {
      return projectId;
    }
  }

  const raw = value.id;
  if (typeof raw === 'string' && raw.trim()) {
    return raw;
  }

  return null;
};

export const toRecommendationExposureItems = (response: {
  sections: Array<{
    key: string;
    items: Array<{
      type: string;
      score: number;
      reasons: string[];
      material?: Record<string, unknown>;
      project?: Record<string, unknown>;
      build?: Record<string, unknown>;
    }>;
  }>;
}): RecommendationExposureItem[] => {
  const items: RecommendationExposureItem[] = [];

  for (const section of response.sections) {
    section.items.forEach((item, index) => {
      const entityType: EntityType = item.type === 'material' ? 'MATERIAL' : 'PROJECT';
      const entity = item.material ?? item.project ?? item.build ?? {};
      const entityId = getRecommendationEntityId(entityType, entity);
      if (!entityId) {
        return;
      }

      items.push({
        entityType,
        entityId,
        sectionKey: section.key,
        position: index + 1,
        score: item.score,
        reasons: item.reasons,
      });
    });
  }

  return items;
};

export const attachRecommendationImpressionIds = (
  response: {
    sections: Array<{
      key: string;
      items: Array<Record<string, unknown>>;
    }>;
  },
  impressionIds: Map<string, string>,
): void => {
  for (const section of response.sections) {
    section.items.forEach((item, index) => {
      const type = item.type === 'material' ? 'MATERIAL' : 'PROJECT';
      const entity =
        (item.material as Record<string, unknown> | undefined) ??
        (item.project as Record<string, unknown> | undefined) ??
        (item.build as Record<string, unknown> | undefined);
      if (!entity) {
        return;
      }

      const entityId = getRecommendationEntityId(type, entity);
      if (!entityId) {
        return;
      }

      const impressionId = impressionIds.get(
        `${type}:${entityId}:${section.key}:${index + 1}`,
      );
      if (impressionId) {
        entity.recommendationImpressionId = impressionId;
      }
    });
  }
};

export const getRecommendationActionContext = (
  headers: IncomingHttpHeaders,
) => readRecommendationAttributionHeaders(headers);
