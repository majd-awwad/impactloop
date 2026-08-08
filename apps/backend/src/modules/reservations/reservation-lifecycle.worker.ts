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

const LOCK_NAME = 'impactloop:reservation-lifecycle';

export class ReservationLifecycleWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private candidateCursor: { createdAt: Date; id: string } | null = null;

  constructor(
    private readonly intervalMs = Number.parseInt(
      process.env.RESERVATION_LIFECYCLE_INTERVAL_MS ?? '30000',
      10,
    ),
    private readonly batchSize = Number.parseInt(
      process.env.RESERVATION_LIFECYCLE_BATCH_SIZE ?? '100',
      10,
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
      logger.debug(
        {
          operation: 'reservation.lifecycle.batch',
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          candidateCount: candidates.length,
        },
        'Reservation lifecycle batch completed',
      );
    } catch (error) {
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
      this.running = false;
    }
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
