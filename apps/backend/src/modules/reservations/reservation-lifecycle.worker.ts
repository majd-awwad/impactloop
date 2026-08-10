import { databasePool, prisma } from '../../database/prisma.js';
import { logger } from '../../observability/logger.js';
import type { PoolClient } from 'pg';
import { expireStalePendingReservationsForMaterials } from './reservations.service.js';
import { expireStaleMissedPickupsForOwner } from './reservations.missed-pickup-expiry.repository.js';
import { expireStalePendingReservationsForOwner } from './reservations.pending-expiry.repository.js';
import { escalateStaleNoDriverDeliveriesForOwner } from './reservations.no-driver-auto-escalation.repository.js';
import { escalateStaleAssignedDriverPickupsForOwner } from './reservations.stale-assigned-driver-auto-escalation.repository.js';
import { escalateStaleNoDriverDeliveriesForRequester } from './reservations.no-driver-auto-escalation.repository.js';
import { escalateStaleAssignedDriverPickupsForRequester } from './reservations.stale-assigned-driver-auto-escalation.repository.js';
import { syncDueDriverTimeRemindersForActiveAssignments } from '../notifications/driver-notification-events.service.js';

const LOCK_NAME = 'impactloop:reservation-lifecycle';
const CONSECUTIVE_FAILURE_THRESHOLD = 3;

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
  staleAfterMs: number;
  stale: boolean;
  reasonCodes: string[];
  ready: boolean;
};

const deriveStaleAfterMs = (intervalMs: number): number =>
  Math.max(intervalMs * 3, 10_000);

export class ReservationLifecycleWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private candidateCursor: { createdAt: Date; id: string } | null = null;
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

  constructor(
    private readonly intervalMs = Number.parseInt(
      process.env.RESERVATION_LIFECYCLE_INTERVAL_MS ?? '30000',
      10,
    ),
    private readonly batchSize = Number.parseInt(
      process.env.RESERVATION_LIFECYCLE_BATCH_SIZE ?? '100',
      10,
    ),
    private readonly now: () => number = Date.now,
  ) {
    this.staleAfterMs = deriveStaleAfterMs(this.intervalMs);
    this.startupGraceMs = this.staleAfterMs;
  }

  start(): void {
    if (this.timer || this.state === 'STOPPED') return;
    this.startedAtMs = this.now();
    this.state = 'STARTING';
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
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
      staleAfterMs: this.staleAfterMs,
      stale,
      reasonCodes,
      ready,
    };
  }

  async runOnce(): Promise<void> {
    if (this.running || this.state === 'STOPPED') return;
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
        return;
      }
      lockAcquired = true;

      let candidates = await this.findCandidatesAfterCursor();
      if (candidates.length === 0 && this.candidateCursor) {
        this.candidateCursor = null;
        candidates = await this.findCandidatesAfterCursor();
      }
      const lastCandidate = candidates.at(-1);
      this.candidateCursor = lastCandidate
        ? { createdAt: lastCandidate.createdAt, id: lastCandidate.id }
        : null;
      const materialIds = [...new Set(candidates.map((item) => item.materialId))];
      const requesterIds = [...new Set(candidates.map((item) => item.requesterId))];
      const ownerIds = [...new Set(candidates.map((item) => item.ownerId))];
      await expireStalePendingReservationsForMaterials(materialIds);
      for (const requesterId of requesterIds) {
        await escalateStaleNoDriverDeliveriesForRequester(requesterId);
        await escalateStaleAssignedDriverPickupsForRequester(requesterId);
      }
      for (const ownerId of ownerIds) {
        await expireStalePendingReservationsForOwner(ownerId);
        await expireStaleMissedPickupsForOwner(ownerId);
        await escalateStaleNoDriverDeliveriesForOwner(ownerId);
        await escalateStaleAssignedDriverPickupsForOwner(ownerId);
      }
      await syncDueDriverTimeRemindersForActiveAssignments();
      logger.debug(
        {
          operation: 'reservation.lifecycle.batch',
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          candidateCount: candidates.length,
        },
        'Reservation lifecycle batch completed',
      );
      this.recordSuccessfulBatch();
    } catch (error) {
      this.recordFailedBatch('batch_failed');
      logger.error(
        { operation: 'reservation.lifecycle.batch', err: { message: String(error) } },
        'Reservation lifecycle batch failed',
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
                operation: 'reservation.lifecycle.unlock',
                err: { message: String(error) },
              },
              'Reservation lifecycle advisory lock release failed',
            );
          }
        }
        lockClient.release();
      }
      this.lastBatchCompletedAtMs = this.now();
      this.running = false;
      this.applyStaleIfNeeded(this.now());
    }
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

  private findCandidatesAfterCursor() {
    const cursor = this.candidateCursor;
    return prisma.reservation.findMany({
      where: {
        status: {
          in: [
            'PENDING',
            'AWAITING_LEARNER_CONFIRMATION',
            'AWAITING_SUPPLIER_CONFIRMATION',
            'ACCEPTED',
            'AWAITING_RESOLUTION',
          ],
        },
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        createdAt: true,
        materialId: true,
        requesterId: true,
        ownerId: true,
      },
      take: this.batchSize,
      orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    });
  }
}
