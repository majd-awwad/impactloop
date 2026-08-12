import type { DatabaseHealthSnapshot } from './database-health.probe.js';
import type {
  RecommendationOutboxHealthSnapshot,
  RecommendationOutboxStopResult,
} from '../recommendation-events/recommendation-events.outbox.worker.js';
import {
  getRecommendationMlRuntimeSnapshot,
  type RecommendationMlRuntimeSnapshot,
} from '../recommendations/ml-runtime-state.service.js';
import type { ReservationLifecycleHealthSnapshot } from '../reservations/reservation-lifecycle.worker.js';

export type HealthStatus = {
  status: 'ok';
  uptime: number;
  timestamp: string;
};

export type RecommendationOutboxHealthProvider = {
  getSnapshot: (nowMs?: number) => RecommendationOutboxHealthSnapshot;
  markShutdownRequested?: () => void;
};

export type DatabaseHealthProvider = {
  getSnapshot: (nowMs?: number) => DatabaseHealthSnapshot;
};

export type ReservationLifecycleHealthProvider = {
  getSnapshot: (nowMs?: number) => ReservationLifecycleHealthSnapshot;
};

/**
 * Informational ML recommendation health. Never contributes to `ready`.
 * Application readiness stays independent of ML domain READY/fallback.
 */
export type RecommendationMlHealthSummary = {
  mode: RecommendationMlRuntimeSnapshot['mode'];
  material: {
    state: RecommendationMlRuntimeSnapshot['material']['state'];
    failureCode?: string;
    modelVersion?: string;
    schemaVersion?: string;
    aggregationMode?: string;
  };
  project: {
    state: RecommendationMlRuntimeSnapshot['project']['state'];
    failureCode?: string;
    modelVersion?: string;
    schemaVersion?: string;
    aggregationMode?: string;
  };
  /** True when ML_PRIMARY and both domains READY. */
  mlServingCapable: boolean;
  /** True when ML_PRIMARY but at least one domain is not READY. */
  mlDegraded: boolean;
};

export type ReadinessStatus = {
  ready: boolean;
  recommendationOutbox: RecommendationOutboxHealthSnapshot | null;
  database: DatabaseHealthSnapshot | null;
  reservationLifecycle: ReservationLifecycleHealthSnapshot | null;
  /** Presentational only — does not affect `ready`. */
  recommendationMl: RecommendationMlHealthSummary;
  reasonCodes: string[];
};

export const buildRecommendationMlHealthSummary = (
  snapshot: RecommendationMlRuntimeSnapshot = getRecommendationMlRuntimeSnapshot(),
): RecommendationMlHealthSummary => {
  const summarize = (
    domain: RecommendationMlRuntimeSnapshot['material'],
  ): RecommendationMlHealthSummary['material'] => ({
    state: domain.state,
    ...(domain.failureCode ? { failureCode: domain.failureCode } : {}),
    ...(domain.modelVersion ? { modelVersion: domain.modelVersion } : {}),
    ...(domain.schemaVersion ? { schemaVersion: domain.schemaVersion } : {}),
    ...(domain.aggregationMode
      ? { aggregationMode: domain.aggregationMode }
      : {}),
  });

  const mlPrimary = snapshot.mode === 'ML_PRIMARY';
  const bothReady =
    snapshot.material.state === 'READY' && snapshot.project.state === 'READY';
  const anyNotReady =
    snapshot.material.state !== 'READY' || snapshot.project.state !== 'READY';

  return {
    mode: snapshot.mode,
    material: summarize(snapshot.material),
    project: summarize(snapshot.project),
    mlServingCapable: mlPrimary && bothReady,
    mlDegraded: mlPrimary && anyNotReady,
  };
};

export type ReadinessAwareShutdownDeps = {
  stopWorker: (timeoutMs: number) => Promise<RecommendationOutboxStopResult>;
  closeHttp: () => Promise<void>;
  disconnectDb: () => Promise<void>;
  markWorkerStopped: () => void;
  onHardExit: (code: number) => void;
  stopTimeoutMs: number;
  beginShutdown: () => void;
};

let outboxHealthProvider: RecommendationOutboxHealthProvider | null = null;
let databaseHealthProvider: DatabaseHealthProvider | null = null;
let reservationLifecycleHealthProvider: ReservationLifecycleHealthProvider | null =
  null;
let shutdownRequested = false;

export const getHealthStatus = (): HealthStatus => ({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
});

export const registerRecommendationOutboxHealthProvider = (
  provider: RecommendationOutboxHealthProvider | null,
): void => {
  outboxHealthProvider = provider;
};

export const registerDatabaseHealthProvider = (
  provider: DatabaseHealthProvider | null,
): void => {
  databaseHealthProvider = provider;
};

export const registerReservationLifecycleHealthProvider = (
  provider: ReservationLifecycleHealthProvider | null,
): void => {
  reservationLifecycleHealthProvider = provider;
};

export const beginReadinessShutdown = (): void => {
  shutdownRequested = true;
  outboxHealthProvider?.markShutdownRequested?.();
};

export const isReadinessShutdownRequested = (): boolean => shutdownRequested;

export const resetHealthShutdownStateForTests = (): void => {
  shutdownRequested = false;
  outboxHealthProvider = null;
  databaseHealthProvider = null;
  reservationLifecycleHealthProvider = null;
};

const collectContributorReadiness = (
  snapshot: { ready: boolean; reasonCodes: string[] } | null,
  missingReasonCode: string,
): { ready: boolean; reasonCodes: string[] } => {
  if (!snapshot) {
    return { ready: false, reasonCodes: [missingReasonCode] };
  }
  return {
    ready: snapshot.ready,
    reasonCodes: snapshot.reasonCodes,
  };
};

export const getReadinessStatus = (nowMs: number = Date.now()): ReadinessStatus => {
  const outboxSnapshot = outboxHealthProvider?.getSnapshot(nowMs) ?? null;
  const databaseSnapshot = databaseHealthProvider?.getSnapshot(nowMs) ?? null;
  const reservationLifecycleSnapshot =
    reservationLifecycleHealthProvider?.getSnapshot(nowMs) ?? null;

  const outbox = collectContributorReadiness(
    outboxSnapshot,
    'OUTBOX_HEALTH_PROVIDER_MISSING',
  );
  const database = collectContributorReadiness(
    databaseSnapshot,
    'DATABASE_HEALTH_PROVIDER_MISSING',
  );
  const reservationLifecycle = collectContributorReadiness(
    reservationLifecycleSnapshot,
    'RESERVATION_LIFECYCLE_HEALTH_PROVIDER_MISSING',
  );

  const reasonCodes = Array.from(
    new Set([
      ...outbox.reasonCodes,
      ...database.reasonCodes,
      ...reservationLifecycle.reasonCodes,
      ...(shutdownRequested ? ['SHUTDOWN_IN_PROGRESS'] : []),
    ]),
  );

  const ready =
    !shutdownRequested &&
    outbox.ready &&
    database.ready &&
    reservationLifecycle.ready;

  return {
    ready,
    recommendationOutbox: outboxSnapshot,
    database: databaseSnapshot,
    reservationLifecycle: reservationLifecycleSnapshot,
    recommendationMl: buildRecommendationMlHealthSummary(),
    reasonCodes,
  };
};

/**
 * Readiness-first shutdown coordinator.
 * Tests inject fakes; production wires server.close / prisma.$disconnect / process.exit.
 */
export const runReadinessAwareShutdown = async (
  deps: ReadinessAwareShutdownDeps,
): Promise<void> => {
  deps.beginShutdown();

  const stopResult = await deps.stopWorker(deps.stopTimeoutMs);

  if (
    stopResult.outcome === 'timedOut' ||
    stopResult.outcome === 'inFlightStillRunning'
  ) {
    // Initiate close so the listener stops accepting, but do not await draining.
    let closing: Promise<unknown> = Promise.resolve();
    try {
      closing = Promise.resolve(deps.closeHttp());
    } catch {
      closing = Promise.resolve();
    }
    void closing.catch(() => undefined);
    deps.onHardExit(1);
    return;
  }

  await deps.closeHttp();
  await deps.disconnectDb();
  deps.markWorkerStopped();
};
