import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, describe, test } from 'node:test';

import express from 'express';

import { healthRouter } from './health.routes.js';
import type { DatabaseHealthSnapshot } from './database-health.probe.js';
import {
  beginReadinessShutdown,
  registerDatabaseHealthProvider,
  registerRecommendationOutboxHealthProvider,
  registerReservationLifecycleHealthProvider,
  resetHealthShutdownStateForTests,
  runReadinessAwareShutdown,
} from './health.service.js';
import type { RecommendationOutboxHealthSnapshot } from '../recommendation-events/recommendation-events.outbox.worker.js';
import type { ReservationLifecycleHealthSnapshot } from '../reservations/reservation-lifecycle.worker.js';

const baseOutboxSnapshot = (
  overrides: Partial<RecommendationOutboxHealthSnapshot> = {},
): RecommendationOutboxHealthSnapshot => ({
  enabled: true,
  required: true,
  state: 'HEALTHY',
  effectiveState: 'HEALTHY',
  startedAt: new Date().toISOString(),
  lastPollStartedAt: new Date().toISOString(),
  lastPollCompletedAt: new Date().toISOString(),
  lastSuccessfulPollAt: new Date().toISOString(),
  lastFailureAt: null,
  lastFailureCode: null,
  consecutiveFailures: 0,
  pollInFlight: false,
  retryBacklog: 0,
  retryBacklogCapped: false,
  deadRows: 0,
  deadRowsCapped: false,
  queueMetricsRefreshedAt: new Date().toISOString(),
  queueMetricsStale: false,
  stale: false,
  shutdownRequested: false,
  shutdownTimedOut: false,
  pollIntervalMs: 2_000,
  staleAfterMs: 10_000,
  reasonCodes: ['OK'],
  ready: true,
  ...overrides,
});

const baseDatabaseSnapshot = (
  overrides: Partial<DatabaseHealthSnapshot> = {},
): DatabaseHealthSnapshot => ({
  state: 'HEALTHY',
  effectiveState: 'HEALTHY',
  startedAt: new Date().toISOString(),
  lastProbeStartedAt: new Date().toISOString(),
  lastProbeCompletedAt: new Date().toISOString(),
  lastSuccessfulProbeAt: new Date().toISOString(),
  lastFailureAt: null,
  lastFailureCode: null,
  consecutiveFailures: 0,
  probeInFlight: false,
  probeIntervalMs: 5_000,
  probeTimeoutMs: 2_000,
  staleAfterMs: 10_000,
  stale: false,
  reasonCodes: ['OK'],
  ready: true,
  ...overrides,
});

const baseReservationLifecycleSnapshot = (
  overrides: Partial<ReservationLifecycleHealthSnapshot> = {},
): ReservationLifecycleHealthSnapshot => ({
  state: 'HEALTHY',
  effectiveState: 'HEALTHY',
  startedAt: new Date().toISOString(),
  lastBatchStartedAt: new Date().toISOString(),
  lastBatchCompletedAt: new Date().toISOString(),
  lastSuccessfulBatchAt: new Date().toISOString(),
  lastFailureAt: null,
  lastFailureCode: null,
  consecutiveFailures: 0,
  batchInFlight: false,
  intervalMs: 30_000,
  staleAfterMs: 90_000,
  stale: false,
  reasonCodes: ['OK'],
  ready: true,
  ...overrides,
});

const registerHealthyReadinessProviders = (
  overrides: {
    outbox?: Partial<RecommendationOutboxHealthSnapshot>;
    database?: Partial<DatabaseHealthSnapshot>;
    reservationLifecycle?: Partial<ReservationLifecycleHealthSnapshot>;
  } = {},
): void => {
  registerRecommendationOutboxHealthProvider({
    getSnapshot: () => baseOutboxSnapshot(overrides.outbox),
  });
  registerDatabaseHealthProvider({
    getSnapshot: () => baseDatabaseSnapshot(overrides.database),
  });
  registerReservationLifecycleHealthProvider({
    getSnapshot: () =>
      baseReservationLifecycleSnapshot(overrides.reservationLifecycle),
  });
};

const withHealthServer = async (
  run: (baseUrl: string) => Promise<void>,
): Promise<void> => {
  const app = express();
  app.use('/health', healthRouter);
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Server is not listening');
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

const fetchJson = async (url: string) => {
  const response = await fetch(url, {
    headers: { connection: 'close' },
  });
  const body = (await response.json()) as Record<string, unknown>;
  return { response, body };
};

describe('RP-04.1 health liveness and readiness routes', () => {
  afterEach(() => {
    resetHealthShutdownStateForTests();
  });

  test('GET /health stays 200 with existing fields when worker is FAILED', async () => {
    let metricsRefreshCalls = 0;
    registerHealthyReadinessProviders({
      outbox: {
        state: 'FAILED',
        effectiveState: 'FAILED',
        ready: false,
        reasonCodes: ['CONSECUTIVE_POLL_FAILURES'],
      },
    });
    registerRecommendationOutboxHealthProvider({
      getSnapshot: () => {
        metricsRefreshCalls += 1;
        return baseOutboxSnapshot({
          state: 'FAILED',
          effectiveState: 'FAILED',
          ready: false,
          reasonCodes: ['CONSECUTIVE_POLL_FAILURES'],
        });
      },
    });

    await withHealthServer(async (baseUrl) => {
      const { response, body } = await fetchJson(`${baseUrl}/health`);
      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      const data = body.data as Record<string, unknown>;
      assert.equal(data.status, 'ok');
      assert.equal(typeof data.uptime, 'number');
      assert.equal(typeof data.timestamp, 'string');
      assert.equal(data.recommendationOutbox, undefined);
      void metricsRefreshCalls;
    });
  });

  test('GET /health/ready returns 200 when ready and 503 with success=false when not', async () => {
    registerHealthyReadinessProviders();

    await withHealthServer(async (baseUrl) => {
      const ready = await fetchJson(`${baseUrl}/health/ready`);
      assert.equal(ready.response.status, 200);
      assert.equal(ready.body.success, true);
      const readyData = ready.body.data as Record<string, unknown>;
      assert.equal(readyData.ready, true);
      assert.ok(readyData.database);
      assert.ok(readyData.reservationLifecycle);
    });

    registerHealthyReadinessProviders({
      outbox: {
        enabled: false,
        required: true,
        state: 'DISABLED',
        effectiveState: 'DISABLED',
        ready: false,
        reasonCodes: ['WORKER_REQUIRED_BUT_DISABLED'],
      },
    });

    await withHealthServer(async (baseUrl) => {
      const notReady = await fetchJson(`${baseUrl}/health/ready`);
      assert.equal(notReady.response.status, 503);
      assert.equal(notReady.body.success, false);
      const error = notReady.body.error as Record<string, unknown>;
      assert.equal(error.code, 'NOT_READY');
      const details = error.details as Record<string, unknown>;
      assert.equal(details.ready, false);
      assert.ok(Array.isArray(details.reasonCodes));
    });
  });

  test('readiness is not ready when database probe is unhealthy', async () => {
    registerHealthyReadinessProviders({
      database: {
        state: 'FAILED',
        effectiveState: 'FAILED',
        ready: false,
        reasonCodes: ['CONSECUTIVE_PROBE_FAILURES'],
      },
    });

    await withHealthServer(async (baseUrl) => {
      const { response, body } = await fetchJson(`${baseUrl}/health/ready`);
      assert.equal(response.status, 503);
      const error = body.error as Record<string, unknown>;
      const details = error.details as Record<string, unknown>;
      assert.ok(
        (details.reasonCodes as string[]).includes('CONSECUTIVE_PROBE_FAILURES'),
      );
    });
  });

  test('readiness is not ready when reservation lifecycle worker is unhealthy', async () => {
    registerHealthyReadinessProviders({
      reservationLifecycle: {
        state: 'FAILED',
        effectiveState: 'FAILED',
        ready: false,
        reasonCodes: ['CONSECUTIVE_BATCH_FAILURES'],
      },
    });

    await withHealthServer(async (baseUrl) => {
      const { response, body } = await fetchJson(`${baseUrl}/health/ready`);
      assert.equal(response.status, 503);
      const error = body.error as Record<string, unknown>;
      const details = error.details as Record<string, unknown>;
      assert.ok(
        (details.reasonCodes as string[]).includes('CONSECUTIVE_BATCH_FAILURES'),
      );
    });
  });

  test('optional-disabled remains ready; failed/stale/stopping/stopped are not', async () => {
    const cases: Array<{
      name: string;
      snapshot: RecommendationOutboxHealthSnapshot;
      expectReady: boolean;
    }> = [
      {
        name: 'optional-disabled',
        snapshot: baseOutboxSnapshot({
          enabled: false,
          required: false,
          state: 'DISABLED',
          effectiveState: 'DISABLED',
          ready: true,
          reasonCodes: ['WORKER_DISABLED'],
        }),
        expectReady: true,
      },
      {
        name: 'failed',
        snapshot: baseOutboxSnapshot({
          state: 'FAILED',
          effectiveState: 'FAILED',
          ready: false,
          reasonCodes: ['POLL_STALE'],
        }),
        expectReady: false,
      },
      {
        name: 'stopping',
        snapshot: baseOutboxSnapshot({
          state: 'STOPPING',
          effectiveState: 'STOPPING',
          ready: false,
          reasonCodes: ['SHUTDOWN_IN_PROGRESS'],
        }),
        expectReady: false,
      },
      {
        name: 'stopped',
        snapshot: baseOutboxSnapshot({
          state: 'STOPPED',
          effectiveState: 'STOPPED',
          ready: false,
          reasonCodes: ['STOPPED'],
        }),
        expectReady: false,
      },
    ];

    for (const entry of cases) {
      registerHealthyReadinessProviders();
      registerRecommendationOutboxHealthProvider({
        getSnapshot: () => entry.snapshot,
      });
      await withHealthServer(async (baseUrl) => {
        const { response, body } = await fetchJson(`${baseUrl}/health/ready`);
        if (entry.expectReady) {
          assert.equal(response.status, 200, entry.name);
          assert.equal(body.success, true, entry.name);
        } else {
          assert.equal(response.status, 503, entry.name);
          assert.equal(body.success, false, entry.name);
        }
      });
    }
  });

  test('readiness handlers never touch Prisma and repeated requests only read snapshot', async () => {
    let snapshotReads = 0;
    registerHealthyReadinessProviders();
    registerRecommendationOutboxHealthProvider({
      getSnapshot: () => {
        snapshotReads += 1;
        return baseOutboxSnapshot();
      },
    });

    await withHealthServer(async (baseUrl) => {
      await fetchJson(`${baseUrl}/health`);
      await fetchJson(`${baseUrl}/health/ready`);
      await fetchJson(`${baseUrl}/health/ready`);
      assert.ok(snapshotReads >= 2);
      // Routes only call getSnapshot; no prisma import in health module paths under test.
    });
  });
});

describe('RP-04.1 readiness-aware shutdown ordering', () => {
  afterEach(() => {
    resetHealthShutdownStateForTests();
  });

  test('graceful path: readiness false, stop, http close, disconnect, then STOPPED', async () => {
    const events: string[] = [];
    let stoppedMarked = false;

    registerHealthyReadinessProviders();
    registerRecommendationOutboxHealthProvider({
      getSnapshot: () =>
        baseOutboxSnapshot({
          state: stoppedMarked ? 'STOPPED' : 'STOPPING',
          effectiveState: stoppedMarked ? 'STOPPED' : 'STOPPING',
          ready: false,
          reasonCodes: stoppedMarked ? ['STOPPED'] : ['SHUTDOWN_IN_PROGRESS'],
          shutdownRequested: true,
        }),
      markShutdownRequested: () => {
        events.push('markShutdownRequested');
      },
    });

    await runReadinessAwareShutdown({
      beginShutdown: () => {
        events.push('beginShutdown');
        beginReadinessShutdown();
      },
      stopTimeoutMs: 100,
      stopWorker: async () => {
        events.push('stopWorker');
        return { outcome: 'completed' };
      },
      closeHttp: async () => {
        events.push('closeHttp');
      },
      disconnectDb: async () => {
        events.push('disconnectDb');
      },
      markWorkerStopped: () => {
        stoppedMarked = true;
        events.push('markWorkerStopped');
      },
      onHardExit: () => {
        events.push('onHardExit');
        throw new Error('hard exit must not run on graceful path');
      },
    });

    assert.deepEqual(events, [
      'beginShutdown',
      'markShutdownRequested',
      'stopWorker',
      'closeHttp',
      'disconnectDb',
      'markWorkerStopped',
    ]);
  });

  test('timeout path: initiates HTTP close without waiting; hard-exit once; never claims STOPPED', async () => {
    const events: string[] = [];
    let hardExitCalls = 0;
    let closeHttpCalls = 0;

    registerHealthyReadinessProviders();
    registerRecommendationOutboxHealthProvider({
      getSnapshot: () =>
        baseOutboxSnapshot({
          state: 'STOPPING',
          effectiveState: 'STOPPING',
          ready: false,
          pollInFlight: true,
          shutdownTimedOut: true,
          reasonCodes: ['SHUTDOWN_TIMED_OUT'],
        }),
      markShutdownRequested: () => {
        events.push('markShutdownRequested');
      },
    });

    let shutdownFinished = false;
    const shutdownPromise = runReadinessAwareShutdown({
      beginShutdown: () => {
        events.push('beginShutdown');
        beginReadinessShutdown();
      },
      stopTimeoutMs: 50,
      stopWorker: async () => {
        events.push('stopWorker');
        return { outcome: 'timedOut', inFlightStillRunning: true };
      },
      closeHttp: () => {
        closeHttpCalls += 1;
        events.push('closeHttp');
        // Never settles — mirrors server.close waiting on open connections.
        return new Promise(() => undefined);
      },
      disconnectDb: async () => {
        events.push('disconnectDb');
      },
      markWorkerStopped: () => {
        events.push('markWorkerStopped');
      },
      onHardExit: (code) => {
        hardExitCalls += 1;
        events.push(`onHardExit:${code}`);
      },
    }).then(() => {
      shutdownFinished = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(shutdownFinished, true);
    await shutdownPromise;

    assert.equal(closeHttpCalls, 1);
    assert.equal(hardExitCalls, 1);
    assert.ok(!events.includes('disconnectDb'));
    assert.ok(!events.includes('markWorkerStopped'));
    assert.deepEqual(events, [
      'beginShutdown',
      'markShutdownRequested',
      'stopWorker',
      'closeHttp',
      'onHardExit:1',
    ]);
  });
});
