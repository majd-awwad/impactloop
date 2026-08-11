/**
 * Orchestrates disposable DR-05 Driver E2E:
 * 1) clone local schema → impactloop_driver_e2e
 * 2) write temp env file (does not mutate .env)
 * 3) load fixture
 * 4) run lifecycle tests
 * 5) optional live Flutter smoke against disposable Backend
 * 6) drop DB + temp artifacts (unless --keep / --keep-on-fail)
 *
 * Usage:
 *   npx tsx scripts/run-driver-e2e.ts
 *   npx tsx scripts/run-driver-e2e.ts --live-flutter
 *   npx tsx scripts/run-driver-e2e.ts --keep
 *   npx tsx scripts/run-driver-e2e.ts --keep-on-fail
 */
import 'dotenv/config';

import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
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
const keep = process.argv.includes('--keep');
const keepOnFail = process.argv.includes('--keep-on-fail');
const liveFlutter = process.argv.includes('--live-flutter');
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error('DATABASE_URL required from .env');

const sourceDb = sourceDatabaseName(sourceUrl);
if (sourceDb === E2E_DATABASE_NAME) {
  throw new Error('Refusing to use disposable DB as source.');
}

const tempEnvPath = join(backendRoot, `.env.driver-e2e.${process.pid}`);
const manifestPath = join(backendRoot, '.driver-e2e-fixture-manifest.json');
const resultsPath = join(backendRoot, '.driver-e2e-results.json');
const flutterEvidencePath = join(
  frontendRoot,
  'tool',
  '.dr05_live_smoke_evidence.txt',
);

const writeTempEnv = (e2eUrl: string) => {
  const original = readFileSync(join(backendRoot, '.env'), 'utf8');
  const rewritten = original
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*DATABASE_URL\s*=/.test(line)) {
        return `DATABASE_URL="${e2eUrl}"`;
      }
      if (/^\s*TEST_DATABASE_URL\s*=/.test(line)) {
        return `TEST_DATABASE_URL="${e2eUrl}"`;
      }
      if (/^\s*NODE_ENV\s*=/.test(line)) {
        return 'NODE_ENV=test';
      }
      return line;
    })
    .join('\n');
  const withDatabaseUrl = /^\s*DATABASE_URL\s*=/m.test(rewritten)
    ? rewritten
    : `${rewritten}\nDATABASE_URL="${e2eUrl}"\n`;
  const withTestDatabaseUrl = /^\s*TEST_DATABASE_URL\s*=/m.test(withDatabaseUrl)
    ? withDatabaseUrl
    : `${withDatabaseUrl}\nTEST_DATABASE_URL="${e2eUrl}"\n`;
  const withNodeEnv = /^\s*NODE_ENV\s*=/m.test(withTestDatabaseUrl)
    ? withTestDatabaseUrl
    : `${withTestDatabaseUrl}\nNODE_ENV=test\n`;
  writeFileSync(tempEnvPath, withNodeEnv, 'utf8');
};

const run = (command: string, args: string[], env: NodeJS.ProcessEnv) =>
  spawnSync(command, args, {
    cwd: backendRoot,
    env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === 'win32',
  });

const runFrontend = (command: string, args: string[], env: NodeJS.ProcessEnv) =>
  spawnSync(command, args, {
    cwd: frontendRoot,
    env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === 'win32',
  });

const cleanupArtifacts = async (dropDb: boolean) => {
  if (existsSync(tempEnvPath)) unlinkSync(tempEnvPath);
  if (existsSync(manifestPath)) unlinkSync(manifestPath);
  if (existsSync(flutterEvidencePath)) unlinkSync(flutterEvidencePath);
  if (dropDb) {
    await dropDisposableDatabase({
      sourceUrl,
      e2eDatabaseName: E2E_DATABASE_NAME,
    });
  }
};

const waitForBackend = async (baseUrl: string, attempts = 40) => {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'x', password: 'y' }),
      });
      // Any HTTP response means the server is listening.
      if (response.status > 0) return;
    } catch {
      // retry
    }
    await delay(500);
  }
  throw new Error('Backend did not become ready for live Flutter smoke.');
};

const main = async () => {
  console.log(
    JSON.stringify(
      {
        phase0: 'create disposable DB',
        sourceDb,
        e2eDb: E2E_DATABASE_NAME,
        liveFlutter,
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
    NODE_ENV: 'test',
    DATABASE_URL: e2eUrl,
    TEST_DATABASE_URL: e2eUrl,
  };

  console.log('Loading fixture…');
  const fixture = run(
    'npx',
    ['tsx', 'scripts/setup-driver-e2e-fixture.ts', '--reset'],
    childEnv,
  );
  process.stdout.write(fixture.stdout ?? '');
  process.stderr.write(fixture.stderr ?? '');
  if (fixture.status !== 0) {
    await cleanupArtifacts(!(keep || keepOnFail));
    process.exit(fixture.status ?? 1);
  }

  if (existsSync(manifestPath)) {
    copyFileSync(
      manifestPath,
      join(backendRoot, '.driver-e2e-fixture-manifest.last.json'),
    );
  }

  console.log('Running lifecycle tests…');
  const tests = run(
    'node',
    [
      '--import',
      'tsx',
      '--test',
      'scripts/driver-e2e-lifecycle.test.ts',
    ],
    childEnv,
  );
  process.stdout.write(tests.stdout ?? '');
  process.stderr.write(tests.stderr ?? '');

  let flutterStatus = 0;
  let backendChild: ReturnType<typeof spawn> | null = null;

  if (tests.status === 0 && liveFlutter) {
    // Reload fixture so Flutter smoke starts from a known board state after
    // mutating lifecycle tests.
    console.log('Reloading fixture for live Flutter smoke…');
    const reload = run(
      'npx',
      ['tsx', 'scripts/setup-driver-e2e-fixture.ts', '--reset'],
      childEnv,
    );
    process.stdout.write(reload.stdout ?? '');
    process.stderr.write(reload.stderr ?? '');
    if (reload.status !== 0) {
      flutterStatus = reload.status ?? 1;
    } else {
      console.log('Starting disposable Backend for Flutter smoke…');
      backendChild = spawn('npx', ['tsx', 'src/server.ts'], {
        cwd: backendRoot,
        env: {
          ...childEnv,
          PORT: childEnv.PORT ?? '4000',
        },
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      try {
        await waitForBackend('http://127.0.0.1:4000');
        console.log('Running live Flutter smoke…');
        const flutterCmd =
          'flutter test test/driver_dr05_live_smoke_test.dart ' +
          '--dart-define=DR05_LIVE_SMOKE=true ' +
          '--dart-define=API_BASE_URL=http://127.0.0.1:4000';
        const flutter = spawnSync(flutterCmd, {
          cwd: frontendRoot,
          env: { ...process.env },
          encoding: 'utf8',
          maxBuffer: 20 * 1024 * 1024,
          shell: true,
        });
        process.stdout.write(flutter.stdout ?? '');
        process.stderr.write(flutter.stderr ?? '');
        flutterStatus = flutter.status ?? 1;
        const flutterOut = `${flutter.stdout ?? ''}\n${flutter.stderr ?? ''}`;
        if (
          flutterStatus === 0 &&
          /DR05 live smoke skipped/.test(flutterOut)
        ) {
          console.error(
            'Live Flutter smoke ran in skip mode; dart-define not applied.',
          );
          flutterStatus = 1;
        }
        if (existsSync(flutterEvidencePath)) {
          console.log(readFileSync(flutterEvidencePath, 'utf8'));
        }

        if (flutterStatus === 0) {
          console.log('Booting Flutter app against disposable API (Chrome)…');
          const boot = spawn(
            'flutter',
            [
              'run',
              '-d',
              'chrome',
              '--web-browser-flag=--headless=new',
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
          const onData = (chunk: Buffer) => {
            bootLog += chunk.toString('utf8');
          };
          boot.stdout?.on('data', onData);
          boot.stderr?.on('data', onData);
          const bootDeadline = Date.now() + 240_000;
          let booted = false;
          while (Date.now() < bootDeadline) {
            if (
              /Flutter run key commands|A Dart VM Service on|Debug service listening|To hot restart/i.test(
                bootLog,
              )
            ) {
              booted = true;
              break;
            }
            if (boot.exitCode != null) break;
            await delay(1000);
          }
          try {
            if (boot.pid) {
              if (process.platform === 'win32') {
                spawnSync('taskkill', ['/pid', String(boot.pid), '/T', '/F'], {
                  shell: true,
                });
              } else {
                boot.kill('SIGTERM');
              }
            }
          } catch {
            // ignore
          }
          if (!booted) {
            console.error('Flutter app boot smoke did not reach ready state.');
            console.error(bootLog.slice(-4000));
            flutterStatus = 1;
          } else {
            console.log('Flutter app boot smoke reached ready state.');
          }
        }
      } finally {
        if (backendChild.pid) {
          try {
            if (process.platform === 'win32') {
              spawnSync(
                'taskkill',
                ['/pid', String(backendChild.pid), '/T', '/F'],
                { shell: true },
              );
            } else {
              backendChild.kill('SIGTERM');
            }
          } catch {
            // ignore
          }
        }
      }
    }
  }

  const passed = tests.status === 0 && flutterStatus === 0;
  writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        passed,
        lifecycleStatus: tests.status,
        flutterStatus: liveFlutter ? flutterStatus : null,
        limitation: created.limitation,
        e2eDatabaseName: E2E_DATABASE_NAME,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );

  const shouldDrop = passed ? !keep : !(keep || keepOnFail);
  await cleanupArtifacts(shouldDrop);
  if (!shouldDrop) {
    console.log(
      `Preserved disposable DB ${E2E_DATABASE_NAME} and/or artifacts for inspection.`,
    );
  } else {
    console.log(`Dropped ${E2E_DATABASE_NAME} and removed temp env/manifest.`);
  }

  if (existsSync(join(backendRoot, '.driver-e2e-fixture-manifest.last.json'))) {
    if (shouldDrop) {
      unlinkSync(join(backendRoot, '.driver-e2e-fixture-manifest.last.json'));
    }
  }
  if (shouldDrop && existsSync(resultsPath)) {
    unlinkSync(resultsPath);
  }

  process.exit(passed ? 0 : tests.status || flutterStatus || 1);
};

main().catch(async (error) => {
  console.error(error);
  try {
    await cleanupArtifacts(!(keep || keepOnFail));
  } catch {
    // ignore cleanup errors
  }
  process.exit(1);
});
