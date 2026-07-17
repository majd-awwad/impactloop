import { createHash, randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

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

export const RECOMMENDATION_ALGORITHM_NAME = 'deterministic-hybrid';
export const RECOMMENDATION_ALGORITHM_VERSION = 'learner-home-v1';
export const RECOMMENDATION_POLICY_VERSION = 'learner-home-policy-v1';

export const RECOMMENDATION_SURFACES = [
  'LEARNER_HOME',
  'LEARNER_HOME_SECTION',
] as const;

type EntityType = RecommendationEntityType;
type EventSource = RecommendationEventSource;
type CacheState = RecommendationCacheState;

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

export type RecommendationActionInput = {
  learnerId: string;
  actionType: RecommendationActionType;
  entityType: EntityType;
  entityId: string;
  impressionId?: string;
  surface?: string;
  sourceOperationId?: string;
  correlationId?: string;
  eventSource?: EventSource;
};

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
      eventSource: trace.eventSource ?? 'REAL',
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
    eventSource: trace.eventSource ?? 'REAL',
  };
};

const payloadByteLength = (payload: unknown): number =>
  Buffer.byteLength(JSON.stringify(payload));

const buildGenerationOutboxPayload = (
  generation: RecommendationGenerationMetadata,
): RecommendationGenerationOutboxPayload | null => {
  const sourceTraces = generation.candidateTraces;
  const traces = sourceTraces
    .map(outboxTraceFor)
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
    eventSource: generation.eventSource ?? 'REAL',
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
      eventSource: input.generation.eventSource ?? 'REAL',
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

export const enqueueRecommendationExposure = async (input: {
  generation: RecommendationGenerationMetadata;
  cacheState: CacheState;
  correlationId?: string;
  items: RecommendationExposureItem[];
  includeGeneration: boolean;
}): Promise<RecommendationOutboxEnqueueResult> => {
  try {
    const exposure = buildExposureOutboxPayload(input);
    const generation = input.includeGeneration
      ? buildGenerationOutboxPayload(input.generation)
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

  const rows = [
    ...(generation
      ? [
          {
            eventKind:
              'RECOMMENDATION_GENERATION' as RecommendationOutboxEventKind,
            schemaVersion: generation.schemaVersion,
            deduplicationKey: `generation:${generation.generationId}`,
            payload: generation as unknown as Prisma.InputJsonValue,
          },
        ]
      : []),
    {
      eventKind: 'RECOMMENDATION_EXPOSURE' as RecommendationOutboxEventKind,
      schemaVersion: exposure.payload.schemaVersion,
      deduplicationKey: `exposure:${exposure.payload.exposureId}`,
      payload: exposure.payload as unknown as Prisma.InputJsonValue,
    },
  ];

    await prisma.recommendationEventOutbox.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return {
      enqueued: true,
      exposureId: exposure.payload.exposureId,
      impressionIds: exposure.impressionIds,
    };
  } catch (error) {
    logger.warn(
      writeFailureContext({
        learnerId: input.generation.learnerId,
        correlationId: input.correlationId,
        phase: 'recommendation-outbox-enqueue',
      }),
      error instanceof Error
        ? error.message.slice(0, 191)
        : 'Recommendation outbox enqueue failed',
    );
    return { enqueued: false, impressionIds: new Map() };
  }
};

export const persistRecommendationExposure = async (input: {
  generation: RecommendationGenerationMetadata;
  cacheState: CacheState;
  correlationId?: string;
  items: RecommendationExposureItem[];
}): Promise<Map<string, string>> => {
  const items = prepareExposureItems(input.items);
  const impressionIds = new Map<string, string>();

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
          eventSource: input.generation.eventSource ?? 'REAL',
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
          eventSource: input.generation.eventSource ?? 'REAL',
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
            eventSource: input.generation.eventSource ?? 'REAL',
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

const findDirectImpression = async (input: {
  learnerId: string;
  impressionId: string;
  entityType: EntityType;
  entityId: string;
  surface?: string;
  now: Date;
}) => {
  if (!input.surface) {
    return null;
  }

  const shownAfter = new Date(
    input.now.getTime() - RECOMMENDATION_ATTRIBUTION_WINDOW_MS,
  );
  const impression = await prisma.recommendationImpression.findFirst({
    where: {
      id: input.impressionId,
      learnerId: input.learnerId,
      entityType: input.entityType,
      entityId: input.entityId,
      surface: input.surface,
      shownAt: { gte: shownAfter, lte: input.now },
    },
  });

  return impression;
};

const findAssistedImpression = async (input: {
  learnerId: string;
  entityType: EntityType;
  entityId: string;
  surface?: string;
  now: Date;
}) => {
  if (!input.surface || !RECOMMENDATION_SURFACES.includes(input.surface as (typeof RECOMMENDATION_SURFACES)[number])) {
    return null;
  }

  const shownAfter = new Date(
    input.now.getTime() - RECOMMENDATION_ATTRIBUTION_WINDOW_MS,
  );
  return prisma.recommendationImpression.findFirst({
    where: {
      learnerId: input.learnerId,
      entityType: input.entityType,
      entityId: input.entityId,
      surface: input.surface,
      shownAt: { gte: shownAfter, lte: input.now },
    },
    orderBy: { shownAt: 'desc' },
  });
};

export const recordRecommendationAction = async (
  input: RecommendationActionInput,
): Promise<{ attributed: boolean; attributionType?: RecommendationAttributionType }> => {
  const now = new Date();

  try {
    const impression = input.impressionId
      ? await findDirectImpression({
          learnerId: input.learnerId,
          impressionId: input.impressionId,
          entityType: input.entityType,
          entityId: input.entityId,
          surface: input.surface,
          now,
        })
      : await findAssistedImpression({
          learnerId: input.learnerId,
          entityType: input.entityType,
          entityId: input.entityId,
          surface: input.surface,
          now,
        });

    if (!impression) {
      return { attributed: false };
    }

    const attributionType: RecommendationAttributionType = input.impressionId
      ? 'DIRECT'
      : 'ASSISTED';

    await prisma.recommendationAction.create({
      data: {
        impressionId: impression.id,
        learnerId: input.learnerId,
        entityType: input.entityType,
        entityId: input.entityId,
        actionType: input.actionType,
        attributionType,
        actionAt: now,
        sourceOperationId: input.sourceOperationId ?? null,
        eventSource: input.eventSource ?? 'REAL',
      },
    });

    return { attributed: true, attributionType };
  } catch (error) {
    logger.error(
      writeFailureContext({
        learnerId: input.learnerId,
        correlationId: input.correlationId,
        phase: 'recommendation-action',
      }),
      error instanceof Error ? error.message : 'Recommendation action write failed',
    );
    return { attributed: false };
  }
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
