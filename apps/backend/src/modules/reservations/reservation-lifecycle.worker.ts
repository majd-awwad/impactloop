import { databasePool } from '../../database/prisma.js';
import { logger } from '../../observability/logger.js';
import type { PoolClient } from 'pg';

import { syncDueDriverTimeRemindersForActiveAssignments } from '../notifications/driver-notification-events.service.js';
import { autoFinalizeDueProjectHelpSessionsBatch } from '../project-help-sessions/project-help-session-auto-finalization.service.js';
import { expireDuePendingReservationsBatch } from './reservations.pending-expiry.repository.js';
import { expireDueMissedPickupsBatch } from './reservations.missed-pickup-expiry.repository.js';
import { escalateDueNoDriverDeliveriesBatch } from './reservations.no-driver-auto-escalation.repository.js';
import { escalateDueAssignedDriverPickupsBatch } from './reservations.stale-assigned-driver-auto-escalation.repository.js';
import { expireDueDeliveryRetriesBatch } from '../delivery-returns/delivery-returns.service.js';

const LOCK_NAME = 'impactloop:reservation-lifecycle';
const CONSECUTIVE_FAILURE_THRESHOLD = 3;

/** Default: 5 minutes — expiry/escalation deadlines are measured in hours/days. */
const DEFAULT_LIFECYCLE_INTERVAL_MS = 300_000;
/** Default: 1 minute — driver reminder lookahead is 15 minutes. */
const DEFAULT_REMINDER_INTERVAL_MS = 60_000;

export type ReservationLifecycleWorkerState =
  | 'STARTING'
  | 'HEALTHY'
  | 'FAILED'
  | 'STOPPED';

export type ReservationLifecycleHealthSnapshot = {
  state: ReservationLifecycleWorkerState;
  effectiveState: ReservationLifecycleWorkerState;
  startedAt: string | null;
  lastBatchStartedAt: string | null;
  lastBatchCompletedAt: string | null;
  lastSuccessfulBatchAt: string | null;
  lastFailureAt: string | null;
  lastFailureCode: string | null;
  consecutiveFailures: number;
  batchInFlight: boolean;
  intervalMs: number;
  reminderIntervalMs: number;
  staleAfterMs: number;
  stale: boolean;
  reasonCodes: string[];
  ready: boolean;
};

export type ReservationLifecycleBatchResult = {
  dueCount: number;
  processedCount: number;
  transitionCount: number;
  pendingExpired: number;
  missedPickupExpired: number;
  noDriverEscalated: number;
  assignedDriverEscalated: number;
  deliveryRetriesExpired: number;
  projectHelpSessionsAutoCompleted: number;
  durationMs: number;
};

export type ReservationReminderBatchResult = {
  dueCount: number;
  reminderDeliveryCount: number;
  durationMs: number;
};

const deriveStaleAfterMs = (intervalMs: number): number =>
  Math.max(intervalMs * 3, 10_000);

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export class ReservationLifecycleWorker {
  private lifecycleTimer: NodeJS.Timeout | null = null;
  private reminderTimer: NodeJS.Timeout | null = null;
  private running = false;
  private state: ReservationLifecycleWorkerState = 'STARTING';
  private startedAtMs: number | null = null;
  private lastBatchStartedAtMs: number | null = null;
  private lastBatchCompletedAtMs: number | null = null;
  private lastSuccessfulBatchAtMs: number | null = null;
  private lastFailureAtMs: number | null = null;
  private lastFailureCode: string | null = null;
  private consecutiveFailures = 0;
  private readonly staleAfterMs: number;
  private readonly startupGraceMs: number;
  private readonly reminderIntervalMs: number;

  constructor(
    private readonly intervalMs = parsePositiveInt(
      process.env.RESERVATION_LIFECYCLE_INTERVAL_MS,
      DEFAULT_LIFECYCLE_INTERVAL_MS,
    ),
    private readonly batchSize = parsePositiveInt(
      process.env.RESERVATION_LIFECYCLE_BATCH_SIZE,
      100,
    ),
    reminderIntervalMs = parsePositiveInt(
      process.env.RESERVATION_LIFECYCLE_REMINDER_INTERVAL_MS,
      DEFAULT_REMINDER_INTERVAL_MS,
    ),
    private readonly now: () => number = Date.now,
  ) {
    this.reminderIntervalMs = reminderIntervalMs;
    this.staleAfterMs = deriveStaleAfterMs(this.intervalMs);
    this.startupGraceMs = this.staleAfterMs;
  }

  start(): void {
    if (this.lifecycleTimer || this.state === 'STOPPED') return;
    this.startedAtMs = this.now();
    this.state = 'STARTING';
    void (async () => {
      await this.runOnce();
      await this.runReminderOnce();
    })();
    this.lifecycleTimer = setInterval(
      () => void this.runOnce(),
      this.intervalMs,
    );
    this.lifecycleTimer.unref();
    this.reminderTimer = setInterval(
      () => void this.runReminderOnce(),
      this.reminderIntervalMs,
    );
    this.reminderTimer.unref();
  }

  stop(): void {
    if (this.lifecycleTimer) clearInterval(this.lifecycleTimer);
    if (this.reminderTimer) clearInterval(this.reminderTimer);
    this.lifecycleTimer = null;
    this.reminderTimer = null;
    this.state = 'STOPPED';
  }

  getHealthSnapshot(nowMs: number = this.now()): ReservationLifecycleHealthSnapshot {
    const { effectiveState, reasonCodes, stale, ready } =
      this.deriveEffective(nowMs);

    return {
      state: this.state,
      effectiveState,
      startedAt: this.toIso(this.startedAtMs),
      lastBatchStartedAt: this.toIso(this.lastBatchStartedAtMs),
      lastBatchCompletedAt: this.toIso(this.lastBatchCompletedAtMs),
      lastSuccessfulBatchAt: this.toIso(this.lastSuccessfulBatchAtMs),
      lastFailureAt: this.toIso(this.lastFailureAtMs),
      lastFailureCode: this.lastFailureCode,
      consecutiveFailures: this.consecutiveFailures,
      batchInFlight: this.running,
      intervalMs: this.intervalMs,
      reminderIntervalMs: this.reminderIntervalMs,
      staleAfterMs: this.staleAfterMs,
      stale,
      reasonCodes,
      ready,
    };
  }

  /**
   * Persistence sweep: due-only PENDING/missed-pickup expiry and delivery escalations.
   * Driver reminders use {@link runReminderOnce} on a separate cadence.
   */
  async runOnce(): Promise<ReservationLifecycleBatchResult | null> {
    if (this.running || this.state === 'STOPPED') return null;
    this.running = true;
    this.lastBatchStartedAtMs = this.now();
    const startedAt = performance.now();
    let lockClient: PoolClient | null = null;
    let lockAcquired = false;
    try {
      lockClient = await databasePool.connect();
      const lock = await lockClient.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
        [LOCK_NAME],
      );
      if (lock.rows[0]?.acquired !== true) {
        this.recordSuccessfulBatch();
        return null;
      }
      lockAcquired = true;

      const result = await this.executeDueLifecycleBatch();
      if (result.transitionCount > 0) {
        logger.debug(
          {
            operation: 'reservation.lifecycle.batch',
            durationMs: result.durationMs,
            dueCount: result.dueCount,
            processedCount: result.processedCount,
            transitionCount: result.transitionCount,
            pendingExpired: result.pendingExpired,
            missedPickupExpired: result.missedPickupExpired,
            noDriverEscalated: result.noDriverEscalated,
            assignedDriverEscalated: result.assignedDriverEscalated,
            deliveryRetriesExpired: result.deliveryRetriesExpired,
            projectHelpSessionsAutoCompleted:
              result.projectHelpSessionsAutoCompleted,
          },
          'Reservation lifecycle batch completed',
        );
      }
      this.recordSuccessfulBatch();
      return result;
    } catch (error) {
      this.recordFailedBatch('batch_failed');
      logger.error(
        {
          operation: 'reservation.lifecycle.batch',
          err: { message: String(error) },
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        },
        'Reservation lifecycle batch failed',
      );
      return null;
    } finally {
      await this.releaseLock(lockClient, lockAcquired);
      this.lastBatchCompletedAtMs = this.now();
      this.running = false;
      this.applyStaleIfNeeded(this.now());
    }
  }

  async runReminderOnce(): Promise<ReservationReminderBatchResult | null> {
    if (this.running || this.state === 'STOPPED') return null;
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
      if (lock.rows[0]?.acquired !== true) {
        return null;
      }
      lockAcquired = true;

      const { dueDeliveryCount } =
        await syncDueDriverTimeRemindersForActiveAssignments();
      const durationMs =
        Math.round((performance.now() - startedAt) * 100) / 100;
      const result: ReservationReminderBatchResult = {
        dueCount: dueDeliveryCount,
        reminderDeliveryCount: dueDeliveryCount,
        durationMs,
      };
      if (dueDeliveryCount > 0) {
        logger.debug(
          {
            operation: 'reservation.lifecycle.reminders',
            durationMs,
            dueCount: dueDeliveryCount,
            reminderCount: dueDeliveryCount,
          },
          'Reservation lifecycle reminder sync completed',
        );
      }
      return result;
    } catch (error) {
      logger.error(
        {
          operation: 'reservation.lifecycle.reminders',
          err: { message: String(error) },
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        },
        'Reservation lifecycle reminder sync failed',
      );
      return null;
    } finally {
      await this.releaseLock(lockClient, lockAcquired);
      this.running = false;
    }
  }

  private async executeDueLifecycleBatch(): Promise<ReservationLifecycleBatchResult> {
    const startedAt = performance.now();

    const pendingExpired = await expireDuePendingReservationsBatch(
      this.batchSize,
    );
    const missedPickupExpired = await expireDueMissedPickupsBatch(
      this.batchSize,
    );
    const noDriverEscalated = await escalateDueNoDriverDeliveriesBatch(
      this.batchSize,
    );
    const assignedDriverEscalated = await escalateDueAssignedDriverPickupsBatch(
      this.batchSize,
    );
    const deliveryRetriesExpired = await expireDueDeliveryRetriesBatch(
      this.batchSize,
      new Date(this.now()),
    );
    const projectHelpSessionsAutoFinalized =
      await autoFinalizeDueProjectHelpSessionsBatch(
        this.batchSize,
        new Date(this.now()),
      );

    const transitionCount =
      pendingExpired.length +
      missedPickupExpired.length +
      noDriverEscalated.length +
      assignedDriverEscalated.length +
      deliveryRetriesExpired.transitioned.length +
      projectHelpSessionsAutoFinalized.transitionCount;

    const dueCount =
      pendingExpired.length +
      missedPickupExpired.length +
      noDriverEscalated.length +
      assignedDriverEscalated.length +
      deliveryRetriesExpired.dueCount +
      projectHelpSessionsAutoFinalized.dueCount;

    return {
      dueCount,
      processedCount: dueCount,
      transitionCount,
      pendingExpired: pendingExpired.length,
      missedPickupExpired: missedPickupExpired.length,
      noDriverEscalated: noDriverEscalated.length,
      assignedDriverEscalated: assignedDriverEscalated.length,
      deliveryRetriesExpired: deliveryRetriesExpired.transitioned.length,
      projectHelpSessionsAutoCompleted:
        projectHelpSessionsAutoFinalized.transitionCount,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    };
  }

  private async releaseLock(
    lockClient: PoolClient | null,
    lockAcquired: boolean,
  ): Promise<void> {
    if (!lockClient) {
      return;
    }
    if (lockAcquired) {
      try {
        await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [
          LOCK_NAME,
        ]);
      } catch (error) {
        logger.warn(
          {
            operation: 'reservation.lifecycle.unlock',
            err: { message: String(error) },
          },
          'Reservation lifecycle advisory lock release failed',
        );
      }
    }
    lockClient.release();
  }

  private recordSuccessfulBatch(): void {
    this.lastSuccessfulBatchAtMs = this.now();
    this.consecutiveFailures = 0;
    this.lastFailureCode = null;
    this.state = 'HEALTHY';
  }

  private recordFailedBatch(code: string): void {
    this.lastFailureAtMs = this.now();
    this.lastFailureCode = code;
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
      this.state = 'FAILED';
      return;
    }
    if (
      this.lastSuccessfulBatchAtMs === null &&
      this.startedAtMs !== null &&
      this.now() - this.startedAtMs >= this.startupGraceMs
    ) {
      this.state = 'FAILED';
    }
  }

  private applyStaleIfNeeded(nowMs: number): void {
    if (this.state === 'STOPPED') {
      return;
    }
    if (this.isStale(nowMs)) {
      this.state = 'FAILED';
      this.lastFailureCode = 'batch_stale';
    }
  }

  private isStale(nowMs: number): boolean {
    if (
      this.running &&
      this.lastBatchStartedAtMs !== null &&
      nowMs - this.lastBatchStartedAtMs > this.staleAfterMs
    ) {
      return true;
    }
    if (
      this.lastSuccessfulBatchAtMs !== null &&
      !this.running &&
      nowMs - this.lastSuccessfulBatchAtMs > this.staleAfterMs &&
      this.state !== 'STARTING'
    ) {
      return true;
    }
    return false;
  }

  private deriveEffective(nowMs: number): {
    effectiveState: ReservationLifecycleWorkerState;
    reasonCodes: string[];
    stale: boolean;
    ready: boolean;
  } {
    const reasonCodes: string[] = [];
    let effectiveState = this.state;
    const stale = this.isStale(nowMs);

    if (this.state === 'STOPPED') {
      reasonCodes.push('STOPPED');
      return { effectiveState, reasonCodes, stale: false, ready: false };
    }

    if (this.state === 'STARTING') {
      if (
        this.startedAtMs !== null &&
        nowMs - this.startedAtMs >= this.startupGraceMs &&
        this.lastSuccessfulBatchAtMs === null
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
      reasonCodes.push('BATCH_STALE');
      return { effectiveState, reasonCodes, stale: true, ready: false };
    }

    if (this.state === 'FAILED') {
      reasonCodes.push(
        this.lastFailureCode === 'batch_stale'
          ? 'BATCH_STALE'
          : this.consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD
            ? 'CONSECUTIVE_BATCH_FAILURES'
            : 'BATCH_FAILED',
      );
      return { effectiveState, reasonCodes, stale: false, ready: false };
    }

    reasonCodes.push('OK');
    return { effectiveState, reasonCodes, stale: false, ready: true };
  }

  private toIso(value: number | null): string | null {
    return value === null ? null : new Date(value).toISOString();
  }
}
