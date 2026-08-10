import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, test } from 'node:test';

import {
  getAiChatDebugInfo,
  getAiPlatformDiagnostics,
  getAiPriceSuggestionDebugInfo,
} from '../config/env.js';
import {
  resetLoggerForTests,
  setLoggerDestinationForTests,
  setLoggerLevelForTests,
} from './logger.js';
import {
  assertNoSecretValuesInDiagnostics,
  buildAiChatReadyContext,
  buildAiPriceSuggestionReadyContext,
  logAiStartupConfig,
  logPaymentStartupConfig,
  logRecommendationOutboxStartupConfig,
} from './startup-logging.js';
import { env } from '../config/env.js';

type ParsedLog = Record<string, unknown>;

const PINO_LEVEL_NAMES: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

const logLevelName = (entry: ParsedLog): string =>
  typeof entry.level === 'number'
    ? (PINO_LEVEL_NAMES[entry.level] ?? String(entry.level))
    : String(entry.level ?? 'unknown');

const createLogCapture = () => {
  const lines: string[] = [];
  const stream = new PassThrough();

  stream.on('data', (chunk) => {
    lines.push(chunk.toString());
  });

  setLoggerDestinationForTests(stream);
  resetLoggerForTests();

  return {
    parseAll(): ParsedLog[] {
      return lines
        .flatMap((line) => line.split('\n'))
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          try {
            return JSON.parse(line) as ParsedLog;
          } catch {
            return { message: line };
          }
        });
    },
    clear() {
      lines.length = 0;
    },
  };
};

describe('startup logging hygiene', () => {
  let capture: ReturnType<typeof createLogCapture>;

  beforeEach(() => {
    capture = createLogCapture();
  });

  afterEach(() => {
    setLoggerDestinationForTests(null);
    resetLoggerForTests();
  });

  test('AI readiness summary includes provider/model and never includes API key values', () => {
    const priceDebug = getAiPriceSuggestionDebugInfo();
    const chatDebug = getAiChatDebugInfo();
    const priceContext = buildAiPriceSuggestionReadyContext(priceDebug);
    const chatContext = buildAiChatReadyContext(chatDebug);

    assert.equal(typeof priceContext.provider, 'string');
    assert.equal(typeof priceContext.model, 'string');
    assert.equal(typeof chatContext.provider, 'string');
    assert.equal(typeof chatContext.model, 'string');

    const knownSecrets = [
      process.env.GEMINI_API_KEY ?? '',
      process.env.OPENAI_API_KEY ?? '',
      env.geminiApiKey ?? '',
      env.openaiApiKey ?? '',
    ].filter((value) => value.trim().length >= 8);

    assertNoSecretValuesInDiagnostics(priceContext, knownSecrets);
    assertNoSecretValuesInDiagnostics(chatContext, knownSecrets);
    assertNoSecretValuesInDiagnostics(getAiPlatformDiagnostics(), knownSecrets);
    assertNoSecretValuesInDiagnostics(chatDebug.envOverrides, knownSecrets);

    for (const override of chatDebug.envOverrides) {
      if (override.key === 'GEMINI_API_KEY' || override.key === 'OPENAI_API_KEY') {
        assert.ok(
          override.previous === null || override.previous === '(set)',
          'sensitive env override previous must be redacted',
        );
        assert.ok(
          override.current === null || override.current === '(set)',
          'sensitive env override current must be redacted',
        );
      }
    }
  });

  test('mock payment fallback warning remains when development secrets are used', () => {
    setLoggerLevelForTests('info');
    capture.clear();
    logPaymentStartupConfig();
    const entries = capture.parseAll();

    if (!env.paymentUsedDevelopmentSecretFallback) {
      assert.equal(
        entries.filter((entry) => entry.operation === 'payments.mock_secrets_fallback')
          .length,
        0,
      );
      return;
    }

    const warning = entries.find(
      (entry) => entry.operation === 'payments.mock_secrets_fallback',
    );
    assert.ok(warning, 'expected payments.mock_secrets_fallback warning');
    assert.equal(logLevelName(warning!), 'warn');
    assert.match(String(warning!.message), /development-only mock payment secret/i);
    assert.equal(
      JSON.stringify(warning).includes(String(env.paymentMockWebhookSecret ?? '')),
      false,
    );
    assert.equal(
      JSON.stringify(warning).includes(
        String(env.paymentMockCheckoutTokenSecret ?? ''),
      ),
      false,
    );
  });

  test('recommendation outbox disabled state remains visible at INFO', () => {
    setLoggerLevelForTests('info');
    capture.clear();
    logRecommendationOutboxStartupConfig();
    const entries = capture.parseAll();

    if (env.recommendationOutboxWorkerEnabled) {
      const enabled = entries.find(
        (entry) => entry.operation === 'recommendation.outbox.enabled',
      );
      assert.ok(enabled);
      assert.equal(logLevelName(enabled!), 'info');
      return;
    }

    if (env.recommendationOutboxWorkerRequired) {
      const requiredDisabled = entries.find(
        (entry) =>
          entry.operation === 'recommendation.outbox.required_but_disabled',
      );
      assert.ok(requiredDisabled);
      assert.equal(logLevelName(requiredDisabled!), 'warn');
      return;
    }

    const disabled = entries.find(
      (entry) => entry.operation === 'recommendation.outbox.disabled',
    );
    assert.ok(disabled, 'expected recommendation.outbox.disabled');
    assert.equal(logLevelName(disabled!), 'info');
    assert.equal(disabled!.required, false);
    assert.equal(
      entries.some(
        (entry) =>
          entry.operation === 'recommendation.outbox.diagnostics' &&
          logLevelName(entry) === 'info',
      ),
      false,
      'outbox tuning diagnostics must not appear at INFO',
    );
  });

  test('detailed AI diagnostics stay at DEBUG when logger is INFO', () => {
    setLoggerLevelForTests('info');
    capture.clear();
    logAiStartupConfig();
    const entries = capture.parseAll();

    const infoOps = entries
      .filter((entry) => logLevelName(entry) === 'info')
      .map((entry) => entry.operation);
    assert.ok(
      infoOps.includes('ai.price_suggestion.ready') ||
        entries.some(
          (entry) =>
            entry.operation === 'ai.price_suggestion.ready' &&
            logLevelName(entry) === 'warn',
        ),
    );
    assert.ok(
      infoOps.includes('ai.chat.ready') ||
        entries.some(
          (entry) =>
            entry.operation === 'ai.chat.ready' && logLevelName(entry) === 'warn',
        ),
    );

    assert.equal(
      entries.some(
        (entry) =>
          entry.operation === 'ai.chat.diagnostics' &&
          logLevelName(entry) === 'info',
      ),
      false,
    );
    assert.equal(
      entries.some(
        (entry) =>
          entry.operation === 'ai.platform.diagnostics' &&
          logLevelName(entry) === 'info',
      ),
      false,
    );
    assert.equal(
      entries.some(
        (entry) =>
          typeof entry.message === 'string' &&
          entry.message.includes('Env overrides detected'),
      ),
      false,
    );
    assert.equal(
      entries.some(
        (entry) =>
          typeof entry.diagnosticsSummary === 'string' &&
          entry.diagnosticsSummary.length > 0,
      ),
      false,
      'startup INFO must not include large diagnosticsSummary dumps',
    );

    const knownSecrets = [
      process.env.GEMINI_API_KEY ?? '',
      process.env.OPENAI_API_KEY ?? '',
    ].filter((value) => value.trim().length >= 8);
    assertNoSecretValuesInDiagnostics(entries, knownSecrets);
  });
});
