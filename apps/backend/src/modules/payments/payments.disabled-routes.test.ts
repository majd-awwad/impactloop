import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

describe('PAY-01B disabled mock routes', () => {
  test('mock routes are unavailable when payments are disabled', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'pay01b-disabled-'));
    const envFile = path.join(tempDir, '.env');
    const harness = path.join(tempDir, 'harness.mts');

    writeFileSync(
      envFile,
      [
        'NODE_ENV=development',
        'PAYMENT_PROVIDER=disabled',
        'DATABASE_URL=postgresql://postgres:123456@127.0.0.1:5433/impactloop?schema=public',
        'JWT_ACCESS_SECRET=test-access-secret-for-disabled-payments-01',
        'JWT_REFRESH_SECRET=test-refresh-secret-for-disabled-payments-01',
        'APP_PUBLIC_BASE_URL=http://127.0.0.1:4000',
      ].join('\n'),
    );

    writeFileSync(
      harness,
      `
import { createServer } from 'node:http';

const { createApp } = await import(${JSON.stringify(
        pathToFileURL(path.join(backendRoot, 'src/app.ts')).href,
      )});
const app = createApp({ recommendationEventOrigin: 'REAL' });
const server = createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('no port');
const base = 'http://127.0.0.1:' + address.port;

const webhook = await fetch(base + '/api/payments/webhooks/mock', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
const act = await fetch(base + '/api/payments/mock/checkout/x/act', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'success' }),
});

console.log('PAY01B_RESULT=' + JSON.stringify({ webhook: webhook.status, act: act.status }));
await new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
`,
    );

    try {
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', harness],
        {
          cwd: backendRoot,
          encoding: 'utf8',
          env: {
            ...process.env,
            NODE_ENV: 'development',
            PAYMENT_PROVIDER: 'disabled',
            IMPACTLOOP_BACKEND_ENV_FILE_PATH: envFile,
          },
          shell: false,
        },
      );
      assert.equal(
        result.status,
        0,
        `child failed:\n${result.stderr}\n${result.stdout}`,
      );
      const marker = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.startsWith('PAY01B_RESULT='));
      assert.ok(marker, result.stdout);
      const parsed = JSON.parse(marker.slice('PAY01B_RESULT='.length)) as {
        webhook: number;
        act: number;
      };
      assert.equal(parsed.webhook, 404);
      assert.equal(parsed.act, 404);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
