/**
 * Focused safety tests for disposable Driver E2E database helpers.
 * Does not touch a live PostgreSQL instance.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  assertDisposableDatabaseName,
  assertSourceDatabaseIdleForTemplateClone,
  prepareTemplateClone,
  terminateDatabaseConnections,
} from './driver-e2e-db.js';

type QueryCall = { sql: string; params?: unknown[] };

class FakeAdmin {
  readonly calls: QueryCall[] = [];
  connectionsByDb = new Map<string, Array<Record<string, unknown>>>();
  created: string[] = [];
  dropped: string[] = [];

  async query(sql: string, params?: unknown[]) {
    this.calls.push({ sql, params });
    if (sql.includes('pg_stat_activity') && !sql.includes('pg_terminate_backend')) {
      const db = String(params?.[0] ?? '');
      return { rows: this.connectionsByDb.get(db) ?? [] };
    }
    if (sql.includes('pg_terminate_backend')) {
      return { rows: [] };
    }
    if (/^\s*DROP DATABASE/i.test(sql)) {
      const match = sql.match(/"([^"]+)"/);
      if (match) this.dropped.push(match[1]!);
      return { rows: [] };
    }
    if (/^\s*CREATE DATABASE/i.test(sql)) {
      const match = sql.match(/"([^"]+)"/);
      if (match) this.created.push(match[1]!);
      return { rows: [] };
    }
    return { rows: [] };
  }
}

describe('driver-e2e-db safety', () => {
  test('A: source DB with zero active connections permits cloning', async () => {
    const admin = new FakeAdmin();
    admin.connectionsByDb.set('impactloop', []);
    await prepareTemplateClone(admin, {
      sourceDb: 'impactloop',
      e2eDatabaseName: 'impactloop_driver_e2e',
    });
    assert.deepEqual(admin.created, ['impactloop_driver_e2e']);
    assert.ok(admin.dropped.includes('impactloop_driver_e2e'));
  });

  test('B: source DB with active connections fails safely', async () => {
    const admin = new FakeAdmin();
    admin.connectionsByDb.set('impactloop', [
      {
        pid: 42,
        application_name: 'node',
        usename: 'postgres',
        state: 'idle',
      },
    ]);
    await assert.rejects(
      () =>
        prepareTemplateClone(admin, {
          sourceDb: 'impactloop',
          e2eDatabaseName: 'impactloop_driver_e2e',
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Cannot CREATE DATABASE/);
        assert.match(error.message, /local Backend/);
        assert.match(error.message, /Prisma Studio/);
        assert.match(error.message, /pid=42/);
        return true;
      },
    );
    assert.equal(admin.created.length, 0);
  });

  test('C: harness never calls pg_terminate_backend for sourceDb', async () => {
    const admin = new FakeAdmin();
    admin.connectionsByDb.set('impactloop', []);
    await prepareTemplateClone(admin, {
      sourceDb: 'impactloop',
      e2eDatabaseName: 'impactloop_driver_e2e',
    });
    const terminateCalls = admin.calls.filter((call) =>
      call.sql.includes('pg_terminate_backend'),
    );
    assert.ok(terminateCalls.length >= 1);
    for (const call of terminateCalls) {
      assert.notEqual(call.params?.[0], 'impactloop');
    }

    await assert.rejects(
      () => terminateDatabaseConnections(admin, 'impactloop'),
      /Refusing disposable database name "impactloop"/,
    );
  });

  test('D: existing disposable E2E connections may still be terminated', async () => {
    const admin = new FakeAdmin();
    admin.connectionsByDb.set('impactloop', []);
    await prepareTemplateClone(admin, {
      sourceDb: 'impactloop',
      e2eDatabaseName: 'impactloop_driver_e2e',
    });
    const terminateCalls = admin.calls.filter((call) =>
      call.sql.includes('pg_terminate_backend'),
    );
    assert.ok(
      terminateCalls.some((call) => call.params?.[0] === 'impactloop_driver_e2e'),
    );
  });

  test('E: forbidden DB names remain blocked', async () => {
    assert.throws(() => assertDisposableDatabaseName('impactloop'), /Refusing/);
    assert.throws(() => assertDisposableDatabaseName('postgres'), /Refusing/);
    assert.throws(
      () => assertDisposableDatabaseName('impactloop_production'),
      /production-like/,
    );
    await assert.rejects(
      () =>
        prepareTemplateClone(new FakeAdmin(), {
          sourceDb: 'impactloop',
          e2eDatabaseName: 'impactloop',
        }),
      /Refusing/,
    );
  });

  test('assertSourceDatabaseIdleForTemplateClone allows empty activity', async () => {
    const admin = new FakeAdmin();
    await assertSourceDatabaseIdleForTemplateClone(admin, 'impactloop');
  });
});
