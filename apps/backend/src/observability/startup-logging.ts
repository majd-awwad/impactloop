import {
  env,
  getAiChatDebugInfo,
  getAiPriceSuggestionDebugInfo,
  getEmailInvitationDebugInfo,
  getSmtpConfigurationErrors,
} from '../config/env.js';
import type { RecommendationMlRuntimeSnapshot } from '../modules/recommendations/ml-runtime-state.service.js';
import { logger } from './logger.js';

const SECRET_VALUE_MARKERS = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'PAYMENT_MOCK_WEBHOOK_SECRET',
  'PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET',
] as const;

/** Ensures diagnostic payloads never include raw secret values. */
export const assertNoSecretValuesInDiagnostics = (
  diagnostics: unknown,
  knownSecretValues: readonly string[] = [],
): void => {
  const serialized = JSON.stringify(diagnostics) ?? '';

  for (const marker of SECRET_VALUE_MARKERS) {
    // Key names as labels are fine; reject patterns that look like assigned secret values.
    if (new RegExp(`${marker}\\s*[:=]\\s*[^"\\s,}\\]]+`, 'i').test(serialized)) {
      throw new Error(`Diagnostic payload appears to include ${marker} value`);
    }
  }

  for (const secret of knownSecretValues) {
    const trimmed = secret.trim();
    if (trimmed.length >= 8 && serialized.includes(trimmed)) {
      throw new Error('Diagnostic payload appears to include a raw secret value');
    }
  }
};

export const buildAiPriceSuggestionReadyContext = (
  debug: ReturnType<typeof getAiPriceSuggestionDebugInfo>,
) => ({
  operation: 'ai.price_suggestion.ready' as const,
  provider: debug.aiProvider,
  model: debug.geminiModel,
  operational: debug.operational,
});

export const buildAiChatReadyContext = (
  debug: ReturnType<typeof getAiChatDebugInfo>,
) => ({
  operation: 'ai.chat.ready' as const,
  provider: debug.aiChatProvider,
  model: debug.aiChatModel,
  operational: debug.operational,
  ...(debug.devMockFallbackEnabled
    ? { fallbackReason: 'dev_mock_fallback_enabled' as const }
    : {}),
});

export const buildEmailReadyContext = (
  debug: ReturnType<typeof getEmailInvitationDebugInfo>,
) => ({
  operation: 'email.ready' as const,
  provider: debug.emailProvider,
});

export const buildRecommendationMlReadyContext = (
  snapshot: RecommendationMlRuntimeSnapshot,
) => ({
  operation: 'recommendation.ml.ready' as const,
  mode: snapshot.mode,
  materialItems: snapshot.material.artifactItemCount ?? 0,
  projectItems: snapshot.project.artifactItemCount ?? 0,
  materialModel: snapshot.material.modelVersion ?? null,
  projectModel: snapshot.project.modelVersion ?? null,
  materialState: snapshot.material.state,
  projectState: snapshot.project.state,
});

export const logPaymentStartupConfig = (): void => {
  if (!env.paymentUsedDevelopmentSecretFallback) {
    return;
  }

  logger.warn(
    {
      operation: 'payments.mock_secrets_fallback',
      provider: env.paymentProvider,
      mode: env.paymentProviderMode,
    },
    'Using development-only mock payment secret fallback(s). Set distinct PAYMENT_MOCK_* secrets in .env for non-local work. Secret values are not logged.',
  );
};

export const logAiStartupConfig = (): void => {
  const priceDebug = getAiPriceSuggestionDebugInfo();
  const chatDebug = getAiChatDebugInfo();

  const priceContext = buildAiPriceSuggestionReadyContext(priceDebug);
  if (priceDebug.operational) {
    logger.info(priceContext, 'AI pricing provider ready');
  } else {
    logger.warn(priceContext, 'AI pricing provider unavailable');
  }

  if (priceDebug.rawGeminiApiKeyPresent && priceDebug.geminiApiKeyRejectedAsPlaceholder) {
    logger.warn(
      {
        operation: 'ai.price_suggestion.config_warning',
        provider: priceDebug.aiProvider,
        reason: 'gemini_key_rejected_as_placeholder',
      },
      'Gemini key present but rejected (placeholder/invalid format)',
    );
  }

  logger.debug(
    {
      operation: 'ai.price_suggestion.diagnostics',
      provider: priceDebug.aiProvider,
      model: priceDebug.geminiModel,
      operational: priceDebug.operational,
      geminiKeyConfigured: priceDebug.geminiApiKeyConfigured,
      explicitProvider: priceDebug.explicitProvider,
    },
    'AI pricing startup diagnostics',
  );

  const chatContext = buildAiChatReadyContext(chatDebug);
  if (chatDebug.operational) {
    logger.info(chatContext, 'AI chat provider ready');
  } else {
    logger.warn(chatContext, 'AI chat provider unavailable');
  }

  for (const warning of chatDebug.configurationWarnings) {
    logger.warn(
      {
        operation: 'ai.chat.config_warning',
        provider: chatDebug.aiChatProvider,
        reason: warning,
      },
      'AI chat configuration warning',
    );
  }

  logger.debug(
    {
      operation: 'ai.chat.diagnostics',
      provider: chatDebug.aiChatProvider,
      model: chatDebug.aiChatModel,
      operational: chatDebug.operational,
      geminiKeyConfigured: chatDebug.geminiApiKeyConfigured,
      openaiKeyConfigured: chatDebug.openaiApiKeyConfigured,
      openaiBaseHost: chatDebug.openaiBaseHost,
      openaiJsonMode: chatDebug.openaiJsonMode,
      isOpenRouter: chatDebug.isOpenRouter,
      devMockFallbackEnabled: chatDebug.devMockFallbackEnabled,
      overrideCount: chatDebug.envOverrides.length,
      warningCount: chatDebug.configurationWarnings.length,
    },
    'AI chat startup diagnostics',
  );

  // Full override lists / fingerprints are intentionally omitted from routine
  // DEBUG startup output (development defaults to LOG_LEVEL=debug).
};

export const logEmailInvitationStartupConfig = (): void => {
  const debug = getEmailInvitationDebugInfo();
  const context = buildEmailReadyContext(debug);

  logger.info(context, 'Email invitation provider ready');

  if (!debug.explicitAppPublicBaseUrl) {
    logger.warn(
      {
        operation: 'email.config_warning',
        provider: debug.emailProvider,
        reason: 'app_public_base_url_unset',
      },
      'APP_PUBLIC_BASE_URL is unset; invitation links will fail until it matches your Flutter web URL',
    );
  }

  if (debug.emailProvider === 'smtp') {
    const smtpErrors = getSmtpConfigurationErrors();
    for (const error of smtpErrors) {
      logger.warn(
        {
          operation: 'email.smtp.config_warning',
          provider: 'smtp',
          reason: error,
        },
        'SMTP invitation configuration incomplete',
      );
    }
  }

  logger.debug(
    {
      operation: 'email.diagnostics',
      provider: debug.emailProvider,
      appPublicBaseUrlConfigured: debug.explicitAppPublicBaseUrl,
      smtpConfigured:
        debug.smtpHostConfigured &&
        debug.smtpUserConfigured &&
        debug.smtpPassConfigured &&
        debug.smtpFromConfigured,
    },
    'Email invitation startup diagnostics',
  );
};

export const logRecommendationOutboxStartupConfig = (): void => {
  const enabled = env.recommendationOutboxWorkerEnabled;
  const required = env.recommendationOutboxWorkerRequired;

  logger.debug(
    {
      operation: 'recommendation.outbox.diagnostics',
      enabled,
      required,
      pollIntervalMs: env.recommendationOutboxPollIntervalMs,
      batchSize: env.recommendationOutboxBatchSize,
      maxAttempts: env.recommendationOutboxMaxAttempts,
      leaseMs: env.recommendationOutboxLeaseMs,
    },
    'Recommendation outbox startup diagnostics',
  );

  if (enabled) {
    logger.info(
      {
        operation: 'recommendation.outbox.enabled',
        enabled: true,
        required,
      },
      'Recommendation outbox worker enabled',
    );
    return;
  }

  if (required) {
    logger.warn(
      {
        operation: 'recommendation.outbox.required_but_disabled',
        enabled: false,
        required: true,
      },
      'Recommendation outbox worker required but disabled; readiness will remain not ready',
    );
    return;
  }

  logger.info(
    {
      operation: 'recommendation.outbox.disabled',
      enabled: false,
      required: false,
    },
    'Recommendation outbox worker disabled',
  );
};

export const logRecommendationMlRuntimeReady = (
  snapshot: RecommendationMlRuntimeSnapshot,
): void => {
  const context = buildRecommendationMlReadyContext(snapshot);
  const materialReady = snapshot.material.state === 'READY';
  const projectReady = snapshot.project.state === 'READY';
  const bothDisabled =
    snapshot.material.state === 'DISABLED' && snapshot.project.state === 'DISABLED';

  if (bothDisabled) {
    logger.info(context, 'Recommendation ML runtime disabled');
  } else if (materialReady || projectReady) {
    logger.info(context, 'Recommendation ML runtime ready');
  } else {
    logger.warn(context, 'Recommendation ML runtime not ready');
  }

  logger.debug(
    {
      operation: 'recommendation.ml.diagnostics',
      mode: snapshot.mode,
      materialItems: context.materialItems,
      projectItems: context.projectItems,
      materialModel: context.materialModel,
      projectModel: context.projectModel,
      materialState: context.materialState,
      projectState: context.projectState,
      featureSchemaVersion: snapshot.material.schemaVersion ?? null,
      artifactVersion: snapshot.material.modelVersion ?? null,
    },
    'Recommendation ML runtime diagnostics',
  );
};

export const logSmtpInvitationVerifyResult = (result: {
  ok: boolean;
  error?: string | null;
}): void => {
  if (result.ok) {
    logger.info(
      {
        operation: 'email.smtp.verify',
        provider: 'smtp',
        status: 'ok',
      },
      'SMTP invitation connection verify succeeded',
    );
    return;
  }

  logger.warn(
    {
      operation: 'email.smtp.verify',
      provider: 'smtp',
      status: 'failed',
      reason: result.error ?? 'unknown error',
    },
    'SMTP invitation connection verify failed',
  );
};

export const logServerListening = (input: {
  port: number;
  pid: number;
  poolMax: number;
}): void => {
  logger.info(
    {
      operation: 'server.listening',
      port: input.port,
      // pino-pretty ignores the reserved key "pid"; use processId instead.
      processId: input.pid,
      poolMax: input.poolMax,
    },
    'ImpactLoop API listening',
  );
};
