import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const runHarness = (input: {
  nodeEnv: string;
  inheritedGeminiKey: string;
  fileGeminiKey: string;
  aiChatProvider?: string;
}) => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'impactloop-env-bootstrap-'));
  const envFilePath = path.join(tempDir, '.env');
  const lines = [`GEMINI_API_KEY=${input.fileGeminiKey}`];
  if (input.aiChatProvider) {
    lines.push(`AI_CHAT_PROVIDER=${input.aiChatProvider}`);
  }
  writeFileSync(envFilePath, `${lines.join('\n')}\n`, 'utf8');

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgresql://postgres:password@127.0.0.1:5432/impactloop?schema=public',
    JWT_ACCESS_SECRET:
      process.env.JWT_ACCESS_SECRET && process.env.JWT_ACCESS_SECRET.length >= 128
        ? process.env.JWT_ACCESS_SECRET
        : 'x'.repeat(128),
    JWT_REFRESH_SECRET:
      process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length >= 128
        ? process.env.JWT_REFRESH_SECRET
        : 'y'.repeat(128),
    HANDOVER_CODE_SECRET:
      process.env.HANDOVER_CODE_SECRET && process.env.HANDOVER_CODE_SECRET.length >= 32
        ? process.env.HANDOVER_CODE_SECRET
        : 'z'.repeat(32),
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER?.trim() || 'disabled',
    NODE_ENV: input.nodeEnv,
    GEMINI_API_KEY: input.inheritedGeminiKey,
    IMPACTLOOP_BACKEND_ENV_FILE_PATH: envFilePath,
    AI_CHAT_DEV_MOCK_FALLBACK_ENABLED: 'false',
    ...(input.aiChatProvider ? { AI_CHAT_PROVIDER: input.aiChatProvider } : {}),
  };
  // Harness simulates app/dev/prod bootstraps, not an automated test process.
  delete childEnv.NODE_TEST_CONTEXT;

  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      path.join(backendRoot, 'src/config/env.bootstrap.harness.ts'),
    ],
    {
      cwd: backendRoot,
      env: childEnv,
      encoding: 'utf8',
    },
  );

  rmSync(tempDir, { recursive: true, force: true });

  if (result.status !== 0) {
    throw new Error(
      `Harness failed (${result.status}): ${result.stderr || result.stdout}`,
    );
  }

  return JSON.parse(result.stdout.trim()) as {
    loadedKeyLast4: string | null;
    fingerprint: string | null;
    providerName: string;
    usesMockWrapper: boolean;
    stdoutContainsFullInheritedKey: boolean;
    stdoutContainsFullFileKey: boolean;
  };
};

describe('backend environment bootstrap', () => {
  test('development prefers apps/backend/.env over inherited process.env', () => {
    const inherited = 'stale-inherited-gemini-key-AAAA';
    const fileKey = 'fresh-from-local-dotenv-file-BBBB';
    const output = runHarness({
      nodeEnv: 'development',
      inheritedGeminiKey: inherited,
      fileGeminiKey: fileKey,
      aiChatProvider: 'gemini',
    });

    assert.equal(output.loadedKeyLast4, 'BBBB');
    assert.equal(output.providerName, 'gemini');
    assert.equal(output.usesMockWrapper, false);
    assert.equal(output.stdoutContainsFullInheritedKey, false);
    assert.equal(output.stdoutContainsFullFileKey, false);
    assert.ok(output.fingerprint);
    assert.equal(output.fingerprint!.length, 8);
  });

  test('production keeps inherited process.env over local .env', () => {
    const inherited = 'inherited-production-gemini-CCCC';
    const fileKey = 'file-should-not-win-gemini-DDDD';
    const output = runHarness({
      nodeEnv: 'production',
      inheritedGeminiKey: inherited,
      fileGeminiKey: fileKey,
      aiChatProvider: 'gemini',
    });

    assert.equal(output.loadedKeyLast4, 'CCCC');
    assert.equal(output.stdoutContainsFullInheritedKey, false);
    assert.equal(output.stdoutContainsFullFileKey, false);
  });
});
