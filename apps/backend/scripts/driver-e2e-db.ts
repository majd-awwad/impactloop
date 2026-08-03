/**
 * Shared disposable-database helpers for DR-05 Driver E2E.
 * Never targets the developer `impactloop` database for fixture writes.
 */
import pg from 'pg';

export const E2E_DATABASE_NAME = 'impactloop_driver_e2e';

const FORBIDDEN_DB_NAMES = new Set([
  'impactloop',
  'postgres',
  'template0',
  'template1',
]);

export function assertDisposableDatabaseName(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Disposable database name is required.');
  }
  if (FORBIDDEN_DB_NAMES.has(normalized)) {
    throw new Error(
      `Refusing disposable database name "${name}". Use a dedicated E2E database such as ${E2E_DATABASE_NAME}.`,
    );
  }
  if (/prod|production|staging/i.test(normalized)) {
    throw new Error(`Refusing production-like database name "${name}".`);
  }
  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    throw new Error(`Unsafe database name "${name}".`);
  }
}

export function requireLocalDatabaseUrl(sourceUrl: string) {
  const parsed = new URL(sourceUrl);
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('Driver E2E disposable DB setup is local PostgreSQL only.');
  }
  if (/prod|production/i.test(parsed.pathname)) {
    throw new Error('Refusing production-like DATABASE_URL pathname.');
  }
  return parsed;
}

export function databaseUrlFor(sourceUrl: string, databaseName: string) {
  assertDisposableDatabaseName(databaseName);
  const url = new URL(sourceUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

export function adminDatabaseUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  url.pathname = '/postgres';
  return url.toString();
}

export function sourceDatabaseName(sourceUrl: string) {
  return decodeURIComponent(new URL(sourceUrl).pathname.replace(/^\//, ''));
}

async function withClient<T>(
  connectionString: string,
  fn: (client: pg.Client) => Promise<T>,
) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export type ActiveDatabaseConnection = {
  pid: number;
  application_name: string | null;
  usename: string | null;
  state: string | null;
};

/** Query-only: never terminates backends. */
export async function listActiveDatabaseConnections(
  admin: Pick<pg.Client, 'query'>,
  databaseName: string,
): Promise<ActiveDatabaseConnection[]> {
  const result = await admin.query<ActiveDatabaseConnection>(
    `SELECT pid, application_name, usename, state
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [databaseName],
  );
  return result.rows;
}

/**
 * Refuses TEMPLATE clone while the source/developer DB has open clients.
 * Does not call pg_terminate_backend for the source database.
 */
export async function assertSourceDatabaseIdleForTemplateClone(
  admin: Pick<pg.Client, 'query'>,
  sourceDb: string,
) {
  const active = await listActiveDatabaseConnections(admin, sourceDb);
  if (active.length === 0) return;

  const summary = active
    .slice(0, 8)
    .map((row) => {
      const app = row.application_name?.trim() || 'unknown-app';
      const user = row.usename?.trim() || 'unknown-user';
      const state = row.state?.trim() || 'unknown-state';
      return `pid=${row.pid} app=${app} user=${user} state=${state}`;
    })
    .join('; ');

  throw new Error(
    [
      `Cannot CREATE DATABASE … TEMPLATE "${sourceDb}" while ${active.length} client connection(s) are still open.`,
      'PostgreSQL requires an exclusive lock on the template database.',
      'Stop these local clients, then retry:',
      '  - local Backend (npm run dev / tsx src/server.ts)',
      '  - Prisma Studio',
      '  - psql / DBeaver / other database GUI clients',
      `Active connections: ${summary}`,
    ].join('\n'),
  );
}

/**
 * Terminate backends for a disposable E2E database only.
 * Callers must pass an already-validated disposable name (never source/impactloop).
 */
export async function terminateDatabaseConnections(
  admin: Pick<pg.Client, 'query'>,
  databaseName: string,
) {
  assertDisposableDatabaseName(databaseName);
  await admin.query(
    `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [databaseName],
  );
}

/**
 * Orchestrates DROP/CREATE for TEMPLATE clone without terminating source DB clients.
 * Exported for focused unit tests with a fake admin client.
 */
export async function prepareTemplateClone(
  admin: Pick<pg.Client, 'query'>,
  input: { sourceDb: string; e2eDatabaseName: string },
) {
  const e2eName = input.e2eDatabaseName;
  assertDisposableDatabaseName(e2eName);
  if (input.sourceDb.trim().toLowerCase() === e2eName.toLowerCase()) {
    throw new Error('Source and disposable database names must differ.');
  }

  // Disposable E2E connections may be terminated so DROP/CREATE can proceed.
  await terminateDatabaseConnections(admin, e2eName);
  await admin.query(`DROP DATABASE IF EXISTS "${e2eName}"`);

  // Never terminate the source/developer database — fail closed if busy.
  await assertSourceDatabaseIdleForTemplateClone(admin, input.sourceDb);
  await admin.query(
    `CREATE DATABASE "${e2eName}" TEMPLATE "${input.sourceDb}"`,
  );
}

/**
 * Creates a disposable DB by cloning the current local schema via TEMPLATE.
 *
 * Limitation: a full empty `prisma migrate deploy` chain may be blocked by
 * older unrelated migrations in this repository. TEMPLATE clone preserves
 * PostGIS + current applied migrations from the developer DB without mutating
 * developer rows. Source DB clients are never auto-terminated; stop them first.
 */
export async function createDisposableDatabaseFromTemplate(input: {
  sourceUrl: string;
  e2eDatabaseName?: string;
}) {
  const source = requireLocalDatabaseUrl(input.sourceUrl);
  const sourceDb = sourceDatabaseName(source.toString());
  const e2eName = input.e2eDatabaseName ?? E2E_DATABASE_NAME;
  assertDisposableDatabaseName(e2eName);
  if (sourceDb.toLowerCase() === e2eName.toLowerCase()) {
    throw new Error('Source and disposable database names must differ.');
  }

  await withClient(adminDatabaseUrl(input.sourceUrl), async (admin) => {
    await prepareTemplateClone(admin, {
      sourceDb,
      e2eDatabaseName: e2eName,
    });
  });

  const e2eUrl = databaseUrlFor(input.sourceUrl, e2eName);
  const health = await withClient(e2eUrl, async (client) => {
    const postgis = await client.query(
      `SELECT extname FROM pg_extension WHERE extname = 'postgis'`,
    );
    const waitingIndex = await client.query(
      `SELECT indexname FROM pg_indexes
       WHERE indexname = 'deliveries_waiting_unassigned_requested_at_id_idx'`,
    );
    const gist = await client.query(
      `SELECT indexname FROM pg_indexes
       WHERE indexname = 'locations_geography_gist_idx'`,
    );
    return {
      postgis: (postgis.rowCount ?? 0) > 0,
      waitingIndex: (waitingIndex.rowCount ?? 0) > 0,
      gistIndex: (gist.rowCount ?? 0) > 0,
    };
  });

  if (!health.postgis) {
    throw new Error('Disposable E2E database is missing PostGIS.');
  }

  return {
    e2eDatabaseName: e2eName,
    e2eDatabaseUrl: e2eUrl,
    sourceDatabaseName: sourceDb,
    limitation:
      'Created via CREATE DATABASE ... TEMPLATE of the local developer DB schema. Empty migrate-deploy chain was not used because older unrelated migrations may block a fresh empty deploy in this repository. Source DB clients are never auto-terminated.',
    health,
  };
}

export async function dropDisposableDatabase(input: {
  sourceUrl: string;
  e2eDatabaseName?: string;
}) {
  const e2eName = input.e2eDatabaseName ?? E2E_DATABASE_NAME;
  assertDisposableDatabaseName(e2eName);
  requireLocalDatabaseUrl(input.sourceUrl);

  await withClient(adminDatabaseUrl(input.sourceUrl), async (admin) => {
    await terminateDatabaseConnections(admin, e2eName);
    await admin.query(`DROP DATABASE IF EXISTS "${e2eName}"`);
  });
}
