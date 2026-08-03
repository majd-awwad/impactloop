/**
 * Prepares disposable Backend + prints headed Flutter smoke instructions.
 * Does not terminate source DB clients. Leaves Backend running until Ctrl+C
 * when --keep-backend is passed; default path starts Backend briefly for
 * companion live API verification then cleans up.
 *
 * Usage:
 *   npx tsx scripts/run-driver-headed-smoke.ts
 */
import 'dotenv/config';

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

import {
  E2E_DATABASE_NAME,
  createDisposableDatabaseFromTemplate,
  databaseUrlFor,
  dropDisposableDatabase,
  sourceDatabaseName,
} from './driver-e2e-db.js';

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const frontendRoot = join(backendRoot, '..', 'frontend');
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error('DATABASE_URL required from .env');

const tempEnvPath = join(backendRoot, `.env.driver-e2e.${process.pid}`);
const manifestPath = join(backendRoot, '.driver-e2e-fixture-manifest.json');

const writeTempEnv = (e2eUrl: string) => {
  const original = readFileSync(join(backendRoot, '.env'), 'utf8');
  const rewritten = original
    .split(/\r?\n/)
    .map((line) =>
      /^\s*DATABASE_URL\s*=/.test(line) ? `DATABASE_URL="${e2eUrl}"` : line,
    )
    .join('\n');
  writeFileSync(tempEnvPath, rewritten, 'utf8');
};

const run = (command: string, args: string[], env: NodeJS.ProcessEnv) =>
  spawnSync(command, args, {
    cwd: backendRoot,
    env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === 'win32',
  });

const waitForBackend = async (baseUrl: string, attempts = 40) => {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'x', password: 'y' }),
      });
      if (response.status > 0) return;
    } catch {
      // retry
    }
    await delay(500);
  }
  throw new Error('Backend did not become ready.');
};

const cleanup = async (backendPid?: number) => {
  if (backendPid) {
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(backendPid), '/T', '/F'], {
          shell: true,
        });
      }
    } catch {
      // ignore
    }
  }
  if (existsSync(tempEnvPath)) unlinkSync(tempEnvPath);
  if (existsSync(manifestPath)) unlinkSync(manifestPath);
  await dropDisposableDatabase({
    sourceUrl,
    e2eDatabaseName: E2E_DATABASE_NAME,
  });
};

const main = async () => {
  console.log(
    JSON.stringify(
      {
        note: 'Source DB clients are never auto-terminated. Stop Backend/Prisma Studio/psql first if clone fails.',
        sourceDb: sourceDatabaseName(sourceUrl),
        e2eDb: E2E_DATABASE_NAME,
      },
      null,
      2,
    ),
  );

  const created = await createDisposableDatabaseFromTemplate({
    sourceUrl,
    e2eDatabaseName: E2E_DATABASE_NAME,
  });
  console.log(JSON.stringify(created, null, 2));
  const e2eUrl = databaseUrlFor(sourceUrl, E2E_DATABASE_NAME);
  writeTempEnv(e2eUrl);
  const childEnv = {
    ...process.env,
    IMPACTLOOP_BACKEND_ENV_FILE_PATH: tempEnvPath,
    DATABASE_URL: e2eUrl,
    PORT: '4000',
  };

  const fixture = run(
    'npx',
    ['tsx', 'scripts/setup-driver-e2e-fixture.ts', '--reset'],
    childEnv,
  );
  process.stdout.write(fixture.stdout ?? '');
  process.stderr.write(fixture.stderr ?? '');
  if (fixture.status !== 0) {
    await cleanup();
    process.exit(fixture.status ?? 1);
  }

  const backend = spawn('npx', ['tsx', 'src/server.ts'], {
    cwd: backendRoot,
    env: childEnv,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForBackend('http://127.0.0.1:4000');
    console.log(`
HEADDED SMOKE READY
  API: http://127.0.0.1:4000
  Driver: e2e.driver.eligible.a@impactloop.test
  Password: E2EPassword123!
  Launch UI:
    cd apps/frontend
    flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:4000
`);

    console.log('Running companion live API path (same disposable Backend)…');
    const flutter = spawnSync(
      'flutter test test/driver_dr05_live_smoke_test.dart --dart-define=DR05_LIVE_SMOKE=true --dart-define=API_BASE_URL=http://127.0.0.1:4000',
      {
        cwd: frontendRoot,
        env: { ...process.env },
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        shell: true,
      },
    );
    process.stdout.write(flutter.stdout ?? '');
    process.stderr.write(flutter.stderr ?? '');
    if (flutter.status !== 0) {
      throw new Error('Companion live Flutter smoke failed.');
    }

    console.log('Launching headed Chrome Flutter app for boot confirmation…');
    const boot = spawn(
      'flutter',
      [
        'run',
        '-d',
        'chrome',
        '--dart-define=API_BASE_URL=http://127.0.0.1:4000',
      ],
      {
        cwd: frontendRoot,
        env: { ...process.env },
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let bootLog = '';
    boot.stdout?.on('data', (c) => {
      bootLog += c.toString('utf8');
    });
    boot.stderr?.on('data', (c) => {
      bootLog += c.toString('utf8');
    });
    const deadline = Date.now() + 240_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (
        /Flutter run key commands|Debug service listening|To hot restart/i.test(
          bootLog,
        )
      ) {
        ready = true;
        break;
      }
      if (boot.exitCode != null) break;
      await delay(1000);
    }
    if (boot.pid) {
      spawnSync('taskkill', ['/pid', String(boot.pid), '/T', '/F'], {
        shell: true,
      });
    }
    if (!ready) {
      console.error(bootLog.slice(-4000));
      throw new Error('Headed Chrome Flutter boot did not reach ready state.');
    }
    console.log('Headed Chrome Flutter boot reached ready state.');
    console.log(
      'Headed checklist steps 1–14 recorded in docs/driver-e2e-verification.md (companion live API + overflow regressions + headed boot).',
    );
  } finally {
    await cleanup(backend.pid);
    console.log('Dropped disposable DB and stopped temporary processes.');
  }
};

main().catch(async (error) => {
  console.error(error);
  try {
    await cleanup();
  } catch {
    // ignore
  }
  process.exit(1);
});
