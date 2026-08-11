import { databasePool } from '../../database/prisma.js';
import { logger } from '../../observability/logger.js';
import type { PoolClient } from 'pg';

import { reconcileStaleFulfilledBuildSyncBatch } from '../material-requests/material-requests.build-sync-reconciliation.js';
import { expireStaleOpenMaterialRequestsBatch } from '../material-requests/material-requests.lifecycle-reconcile.repository.js';
import { reconcileUnavailableSuggestedMatchesBatch } from '../material-requests/material-requests.match-availability.js';
import { fulfillRequestFromCompletedReservation } from '../learner-material-requests/learner-material-requests.service.js';

const LOCK_NAME = 'impactloop:material-request-lifecycle';

/** Default: 5 minutes — OPEN TTL is days; worker is a safety sweeper. */
const DEFAULT_INTERVAL_MS = 300_000;

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export class MaterialRequestLifecycleWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private matchCursor: { createdAt: Date; id: string } | null = null;
  private buildSyncCursor: { updatedAt: Date; id: string } | null = null;

  constructor(
    private readonly intervalMs = parsePositiveInt(
      process.env.MATERIAL_REQUEST_LIFECYCLE_INTERVAL_MS,
      DEFAULT_INTERVAL_MS,
    ),
    private readonly batchSize = parsePositiveInt(
      process.env.MATERIAL_REQUEST_LIFECYCLE_BATCH_SIZE,
      100,
    ),
  ) {}

  start(): void {
    if (this.timer) return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const startedAt = performance.now();
    let lockClient: PoolClient | null = null;
    let lockAcquired = false;
    try {
      lockClient = await databasePool.connect();
      const lock = await lockClient.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
        [LOCK_NAME],
      );
      if (lock.rows[0]?.acquired !== true) return;
      lockAcquired = true;

      const expiredRequestCount = await expireStaleOpenMaterialRequestsBatch(
        this.batchSize,
      );

      let matchBatch = await reconcileUnavailableSuggestedMatchesBatch({
        batchSize: this.batchSize,
        cursor: this.matchCursor,
      });
      if (matchBatch.processed === 0 && this.matchCursor) {
        this.matchCursor = null;
        matchBatch = await reconcileUnavailableSuggestedMatchesBatch({
          batchSize: this.batchSize,
          cursor: null,
        });
      }
      this.matchCursor = matchBatch.nextCursor;

      let buildSyncBatch = await reconcileStaleFulfilledBuildSyncBatch(
        fulfillRequestFromCompletedReservation,
        {
          batchSize: Math.min(this.batchSize, 20),
          cursor: this.buildSyncCursor,
        },
      );
      if (buildSyncBatch.processed === 0 && this.buildSyncCursor) {
        this.buildSyncCursor = null;
        buildSyncBatch = await reconcileStaleFulfilledBuildSyncBatch(
          fulfillRequestFromCompletedReservation,
          {
            batchSize: Math.min(this.batchSize, 20),
            cursor: null,
          },
        );
      }
      this.buildSyncCursor = buildSyncBatch.nextCursor;

      const transitionCount =
        expiredRequestCount +
        matchBatch.marked.length +
        buildSyncBatch.repairedCount;

      if (transitionCount > 0) {
        logger.debug(
          {
            operation: 'materialRequest.lifecycle.batch',
            durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
            dueCount: transitionCount,
            processedCount:
              expiredRequestCount +
              matchBatch.processed +
              buildSyncBatch.processed,
            transitionCount,
            expiredRequestCount,
            matchProcessed: matchBatch.processed,
            matchMarked: matchBatch.marked.length,
            buildSyncProcessed: buildSyncBatch.processed,
            buildSyncRepaired: buildSyncBatch.repairedCount,
          },
          'Material request lifecycle batch completed',
        );
      }
    } catch (error) {
      logger.error(
        {
          operation: 'materialRequest.lifecycle.batch',
          err: { message: String(error) },
        },
        'Material request lifecycle batch failed',
      );
    } finally {
      if (lockClient) {
        if (lockAcquired) {
          try {
            await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [
              LOCK_NAME,
            ]);
          } catch (error) {
            logger.warn(
              {
                operation: 'materialRequest.lifecycle.unlock',
                err: { message: String(error) },
              },
              'Material request lifecycle advisory lock release failed',
            );
          }
        }
        lockClient.release();
      }
      this.running = false;
    }
  }
}
