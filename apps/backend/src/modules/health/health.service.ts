import type {
  RecommendationOutboxHealthSnapshot,
  RecommendationOutboxStopResult,
} from '../recommendation-events/recommendation-events.outbox.worker.js';

export type HealthStatus = {
  status: 'ok';
  uptime: number;
  timestamp: string;
};

export type RecommendationOutboxHealthProvider = {
  getSnapshot: (nowMs?: number) => RecommendationOutboxHealthSnapshot;
  markShutdownRequested?: () => void;
};

export type ReadinessStatus = {
  ready: boolean;
  recommendationOutbox: RecommendationOutboxHealthSnapshot | null;
  reasonCodes: string[];
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

export const beginReadinessShutdown = (): void => {
  shutdownRequested = true;
  outboxHealthProvider?.markShutdownRequested?.();
};

export const isReadinessShutdownRequested = (): boolean => shutdownRequested;

export const resetHealthShutdownStateForTests = (): void => {
  shutdownRequested = false;
  outboxHealthProvider = null;
};

export const getReadinessStatus = (nowMs: number = Date.now()): ReadinessStatus => {
  if (!outboxHealthProvider) {
    return {
      ready: false,
      recommendationOutbox: null,
      reasonCodes: ['OUTBOX_HEALTH_PROVIDER_MISSING'],
    };
  }

  const snapshot = outboxHealthProvider.getSnapshot(nowMs);
  const ready = shutdownRequested ? false : snapshot.ready;

  return {
    ready,
    recommendationOutbox: snapshot,
    reasonCodes: shutdownRequested
      ? Array.from(new Set([...snapshot.reasonCodes, 'SHUTDOWN_IN_PROGRESS']))
      : snapshot.reasonCodes,
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
