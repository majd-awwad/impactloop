import type { Pool } from 'pg';

export type DatabaseHealthState =
  | 'STARTING'
  | 'HEALTHY'
  | 'FAILED'
  | 'STOPPED';

export type DatabaseHealthSnapshot = {
  state: DatabaseHealthState;
  effectiveState: DatabaseHealthState;
  startedAt: string | null;
  lastProbeStartedAt: string | null;
  lastProbeCompletedAt: string | null;
  lastSuccessfulProbeAt: string | null;
  lastFailureAt: string | null;
  lastFailureCode: string | null;
  consecutiveFailures: number;
  probeInFlight: boolean;
  probeIntervalMs: number;
  probeTimeoutMs: number;
  staleAfterMs: number;
  stale: boolean;
  reasonCodes: string[];
  ready: boolean;
};

export type DatabaseHealthProbeDeps = {
  now?: () => number;
  pool?: Pick<Pool, 'connect'>;
  probe?: () => Promise<void>;
};

const DEFAULT_PROBE_INTERVAL_MS = 5_000;
const DEFAULT_PROBE_TIMEOUT_MS = 2_000;
const CONSECUTIVE_FAILURE_THRESHOLD = 3;

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const deriveStaleAfterMs = (probeIntervalMs: number): number =>
  Math.max(probeIntervalMs * 3, 10_000);

export class DatabaseHealthProbe {
  private readonly now: () => number;
  private readonly pool: Pick<Pool, 'connect'> | null;
  private readonly probeImpl: () => Promise<void>;
  private readonly probeIntervalMs: number;
  private readonly probeTimeoutMs: number;
  private readonly staleAfterMs: number;
  private readonly startupGraceMs: number;
  private readonly consecutiveFailureThreshold: number;

  private timer: NodeJS.Timeout | null = null;
  private probeInFlight = false;
  private state: DatabaseHealthState = 'STARTING';
  private startedAtMs: number | null = null;
  private lastProbeStartedAtMs: number | null = null;
  private lastProbeCompletedAtMs: number | null = null;
  private lastSuccessfulProbeAtMs: number | null = null;
  private lastFailureAtMs: number | null = null;
  private lastFailureCode: string | null = null;
  private consecutiveFailures = 0;

  constructor(deps: DatabaseHealthProbeDeps = {}) {
    this.now = deps.now ?? Date.now;
    this.pool = deps.pool ?? null;
    this.probeIntervalMs = parsePositiveInt(
      process.env.DATABASE_HEALTH_PROBE_INTERVAL_MS,
      DEFAULT_PROBE_INTERVAL_MS,
    );
    this.probeTimeoutMs = parsePositiveInt(
      process.env.DATABASE_HEALTH_PROBE_TIMEOUT_MS,
      DEFAULT_PROBE_TIMEOUT_MS,
    );
    this.staleAfterMs = deriveStaleAfterMs(this.probeIntervalMs);
    this.startupGraceMs = this.staleAfterMs;
    this.consecutiveFailureThreshold = CONSECUTIVE_FAILURE_THRESHOLD;
    this.probeImpl =
      deps.probe ??
      (async () => {
        const pool = this.pool ?? (await import('../../database/prisma.js')).databasePool;
        const client = await pool.connect();
        let timeoutHandle: NodeJS.Timeout | undefined;
        try {
          await Promise.race([
            client.query('SELECT 1'),
            new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(
                () => reject(new Error('probe_timeout')),
                this.probeTimeoutMs,
              );
            }),
          ]);
        } finally {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          client.release();
        }
      });
  }

  start(): void {
    if (this.timer || this.state === 'STOPPED') {
      return;
    }
    this.startedAtMs = this.now();
    this.state = 'STARTING';
    void this.probeOnce();
    this.timer = setInterval(() => void this.probeOnce(), this.probeIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state = 'STOPPED';
  }

  async probeOnce(): Promise<void> {
    if (this.probeInFlight || this.state === 'STOPPED') {
      return;
    }

    this.probeInFlight = true;
    this.lastProbeStartedAtMs = this.now();
    try {
      await this.probeImpl();
      this.lastSuccessfulProbeAtMs = this.now();
      this.consecutiveFailures = 0;
      this.lastFailureCode = null;
      this.state = 'HEALTHY';
    } catch (error) {
      this.lastFailureAtMs = this.now();
      this.lastFailureCode =
        error instanceof Error && error.message === 'probe_timeout'
          ? 'probe_timeout'
          : 'probe_failed';
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= this.consecutiveFailureThreshold) {
        this.state = 'FAILED';
      } else if (this.lastSuccessfulProbeAtMs === null) {
        const nowMs = this.now();
        if (
          this.startedAtMs !== null &&
          nowMs - this.startedAtMs >= this.startupGraceMs
        ) {
          this.state = 'FAILED';
        }
      }
    } finally {
      this.lastProbeCompletedAtMs = this.now();
      this.probeInFlight = false;
      this.applyStaleIfNeeded(this.now());
    }
  }

  getHealthSnapshot(nowMs: number = this.now()): DatabaseHealthSnapshot {
    const { effectiveState, reasonCodes, stale, ready } =
      this.deriveEffective(nowMs);

    return {
      state: this.state,
      effectiveState,
      startedAt: this.toIso(this.startedAtMs),
      lastProbeStartedAt: this.toIso(this.lastProbeStartedAtMs),
      lastProbeCompletedAt: this.toIso(this.lastProbeCompletedAtMs),
      lastSuccessfulProbeAt: this.toIso(this.lastSuccessfulProbeAtMs),
      lastFailureAt: this.toIso(this.lastFailureAtMs),
      lastFailureCode: this.lastFailureCode,
      consecutiveFailures: this.consecutiveFailures,
      probeInFlight: this.probeInFlight,
      probeIntervalMs: this.probeIntervalMs,
      probeTimeoutMs: this.probeTimeoutMs,
      staleAfterMs: this.staleAfterMs,
      stale,
      reasonCodes,
      ready,
    };
  }

  private applyStaleIfNeeded(nowMs: number): void {
    if (this.state === 'STOPPED') {
      return;
    }
    if (this.isStale(nowMs)) {
      this.state = 'FAILED';
      this.lastFailureCode = 'probe_stale';
    }
  }

  private isStale(nowMs: number): boolean {
    if (
      this.probeInFlight &&
      this.lastProbeStartedAtMs !== null &&
      nowMs - this.lastProbeStartedAtMs > this.staleAfterMs
    ) {
      return true;
    }
    if (
      this.lastSuccessfulProbeAtMs !== null &&
      !this.probeInFlight &&
      nowMs - this.lastSuccessfulProbeAtMs > this.staleAfterMs &&
      this.state !== 'STARTING'
    ) {
      return true;
    }
    return false;
  }

  private deriveEffective(nowMs: number): {
    effectiveState: DatabaseHealthState;
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
        this.lastSuccessfulProbeAtMs === null
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
      reasonCodes.push('PROBE_STALE');
      return { effectiveState, reasonCodes, stale: true, ready: false };
    }

    if (this.state === 'FAILED') {
      reasonCodes.push(
        this.lastFailureCode === 'probe_timeout'
          ? 'PROBE_TIMEOUT'
          : this.lastFailureCode === 'probe_stale'
            ? 'PROBE_STALE'
            : this.consecutiveFailures >= this.consecutiveFailureThreshold
              ? 'CONSECUTIVE_PROBE_FAILURES'
              : 'PROBE_FAILED',
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
