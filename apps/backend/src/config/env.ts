import dotenv from 'dotenv';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const envFilePath = process.env.IMPACTLOOP_BACKEND_ENV_FILE_PATH?.trim()
  ? path.resolve(process.env.IMPACTLOOP_BACKEND_ENV_FILE_PATH)
  : path.join(backendRoot, '.env');
const invitationsEnvFilePath = path.join(backendRoot, 'config/invitations.env');

const SENSITIVE_ENV_KEYS = new Set(['GEMINI_API_KEY', 'OPENAI_API_KEY']);

const formatTrackedEnvValue = (
  key: (typeof TRACKED_AI_ENV_KEYS)[number],
  value: string | null,
): string | null => {
  if (SENSITIVE_ENV_KEYS.has(key)) {
    return value ? '(set)' : null;
  }

  return value;
};
const TRACKED_AI_ENV_KEYS = [
  'AI_PROVIDER',
  'AI_CHAT_PROVIDER',
  'AI_CHAT_MODEL',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'OPENAI_API_KEY',
  'NODE_ENV',
] as const;

const snapshotTrackedAiEnv = (): Record<string, string | null> => {
  const snapshot: Record<string, string | null> = {};
  for (const key of TRACKED_AI_ENV_KEYS) {
    const value = process.env[key]?.trim();
    snapshot[key] = value ? value : null;
  }
  return snapshot;
};

const stripEmptyEnvOverrides = (parsed: dotenv.DotenvParseOutput | undefined): void => {
  if (!parsed) {
    return;
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string' && value.trim() === '') {
      delete process.env[key];
    }
  }
};

let lastBackendEnvDigest = '';

const digestEnvFile = (filePath: string): string | null => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
};

const resolveNodeEnv = (): string => process.env.NODE_ENV?.trim() || 'development';

export const shouldOverrideProcessEnvFromLocalFiles = (): boolean =>
  resolveNodeEnv() !== 'production';

export const bootstrapBackendEnvironment = (): void => {
  const override = shouldOverrideProcessEnvFromLocalFiles();

  const backendEnvResult = dotenv.config({
    path: envFilePath,
    override,
    quiet: true,
  });
  stripEmptyEnvOverrides(backendEnvResult.parsed);

  const invitationsEnvResult = dotenv.config({
    path: invitationsEnvFilePath,
    override,
    quiet: true,
  });
  stripEmptyEnvOverrides(invitationsEnvResult.parsed);

  lastBackendEnvDigest = digestEnvFile(envFilePath) ?? '';
};

const beforeEnvLoadSnapshot = snapshotTrackedAiEnv();
bootstrapBackendEnvironment();
const afterBackendEnvSnapshot = snapshotTrackedAiEnv();
const afterInvitationsEnvSnapshot = snapshotTrackedAiEnv();

export const backendEnvFilePath = envFilePath;
export const invitationsEnvFilePathExported = invitationsEnvFilePath;

export type AiProviderName = 'gemini' | 'mock' | 'disabled';
export type AiChatProviderName = 'openai' | 'gemini' | 'mock' | 'disabled';

export type EmailProviderName = 'mock' | 'smtp';

const parsePort = (value: string | undefined): number => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 4000;
};

const requireEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const PLACEHOLDER_API_KEYS = new Set([
  'your_key_here',
  'changeme',
  'replace_me',
  'insert_key_here',
  'your-gemini-api-key',
  'your_gemini_api_key',
  'your-openai-api-key',
  'your_openai_api_key',
  'sk-your-key-here',
]);

export const isUsableGeminiApiKey = (
  value: string | null | undefined,
): boolean => {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length < 20) {
    return false;
  }

  const normalized = trimmed.toLowerCase();
  if (PLACEHOLDER_API_KEYS.has(normalized)) {
    return false;
  }

  if (
    normalized.startsWith('your_') ||
    normalized.includes('replace') ||
    normalized.includes('example')
  ) {
    return false;
  }

  return true;
};

const readGeminiApiKey = (): string | null => {
  const raw = process.env.GEMINI_API_KEY?.trim();
  if (!raw) {
    return null;
  }

  const unquoted =
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
      ? raw.slice(1, -1).trim()
      : raw;

  return isUsableGeminiApiKey(unquoted) ? unquoted : null;
};

export const isUsableOpenAiApiKey = (
  value: string | null | undefined,
): boolean => {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length < 20) {
    return false;
  }

  const normalized = trimmed.toLowerCase();
  if (PLACEHOLDER_API_KEYS.has(normalized)) {
    return false;
  }

  if (
    normalized.startsWith('your_') ||
    normalized.includes('replace') ||
    normalized.includes('example') ||
    normalized.includes('changeme')
  ) {
    return false;
  }

  return true;
};

export const getConfiguredGeminiApiKey = (): string | null => {
  reloadDevEnvFromDisk();
  return readGeminiApiKey();
};

export const getGeminiApiKeyLast4 = (): string | null => {
  const key = readGeminiApiKey();
  if (!key) {
    return null;
  }

  return key.slice(-4);
};

export const getGeminiApiKeyFingerprint = (): string | null => {
  const key = readGeminiApiKey();
  if (!key) {
    return null;
  }

  return createHash('sha256').update(key).digest('hex').slice(0, 8);
};

export const isAiChatDevMockFallbackEnabled = (): boolean => {
  reloadDevEnvFromDisk();
  return parseBoolean(process.env.AI_CHAT_DEV_MOCK_FALLBACK_ENABLED, false);
};

const readOpenAiApiKey = (): string | null => {
  const raw = process.env.OPENAI_API_KEY?.trim();
  return isUsableOpenAiApiKey(raw) ? raw! : null;
};

export const getConfiguredOpenAiApiKey = (): string | null => readOpenAiApiKey();

export const GEMINI_CHAT_MODEL_FALLBACKS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
] as const;

const reloadDevEnvFromDisk = (): void => {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_TEST_CONTEXT) {
    return;
  }

  const digest = digestEnvFile(envFilePath);
  if (!digest || digest === lastBackendEnvDigest) {
    return;
  }

  bootstrapBackendEnvironment();
};

const readAiChatModel = (provider: AiChatProviderName): string => {
  if (provider === 'openai') {
    return (
      process.env.OPENAI_MODEL?.trim() ||
      process.env.AI_CHAT_MODEL?.trim() ||
      'gpt-4o-mini'
    );
  }

  return process.env.AI_CHAT_MODEL?.trim() || 'gemini-3.1-flash-lite';
};

export const getResolvedAiChatModel = (): string => {
  reloadDevEnvFromDisk();
  return readAiChatModel(resolveAiChatProvider());
};

export const getGeminiChatModelCandidates = (): string[] => {
  const primary = getResolvedAiChatModel();
  const fallbacks = GEMINI_CHAT_MODEL_FALLBACKS.filter((model) => model !== primary);
  return [primary, ...fallbacks];
};

const readExplicitAiProvider = (): AiProviderName | null => {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (raw === 'gemini' || raw === 'mock' || raw === 'disabled') {
    return raw;
  }

  return null;
};

export const resolveAiProvider = (): AiProviderName => {
  const explicit = readExplicitAiProvider();
  if (explicit) {
    return explicit;
  }

  if (readGeminiApiKey()) {
    return 'gemini';
  }

  if ((process.env.NODE_ENV ?? 'development') !== 'production') {
    return 'mock';
  }

  return 'disabled';
};

const readExplicitAiChatProvider = (): AiChatProviderName | null => {
  const raw = process.env.AI_CHAT_PROVIDER?.trim().toLowerCase();
  if (
    raw === 'openai' ||
    raw === 'gemini' ||
    raw === 'mock' ||
    raw === 'disabled'
  ) {
    return raw;
  }

  return null;
};

let resolvedAiChatProviderTestOverride: AiChatProviderName | null = null;

export const setResolvedAiChatProviderForTests = (
  provider: AiChatProviderName | null,
): void => {
  resolvedAiChatProviderTestOverride = provider;
};

export const resolveAiChatProvider = (): AiChatProviderName => {
  if (resolvedAiChatProviderTestOverride) {
    return resolvedAiChatProviderTestOverride;
  }

  reloadDevEnvFromDisk();

  const explicit = readExplicitAiChatProvider();
  if (explicit) {
    return explicit;
  }

  if (process.env.NODE_TEST_CONTEXT) {
    return 'mock';
  }

  const explicitPriceProvider = readExplicitAiProvider();
  if (explicitPriceProvider === 'gemini' && readGeminiApiKey()) {
    return 'gemini';
  }

  if (readGeminiApiKey()) {
    return 'gemini';
  }

  if (readOpenAiApiKey()) {
    return 'openai';
  }

  if ((process.env.NODE_ENV ?? 'development') !== 'production') {
    return 'mock';
  }

  return 'disabled';
};

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const readEmailProvider = (): EmailProviderName => {
  const raw = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  return raw === 'smtp' ? 'smtp' : 'mock';
};

export const getResolvedEmailProvider = (): EmailProviderName => readEmailProvider();

const readAppPublicBaseUrl = (): string => {
  const explicit = process.env.APP_PUBLIC_BASE_URL?.trim();
  return explicit ? explicit.replace(/\/$/, '') : '';
};

export const getAppPublicBaseUrl = (): string => readAppPublicBaseUrl();

export const isAppPublicBaseUrlConfigured = (): boolean =>
  Boolean(getAppPublicBaseUrl());

export const getSmtpConfigurationErrors = (): string[] => {
  const errors: string[] = [];

  if (!process.env.SMTP_HOST?.trim()) {
    errors.push('SMTP_HOST is not configured');
  }

  if (!process.env.SMTP_USER?.trim()) {
    errors.push('SMTP_USER is not configured');
  }

  if (!process.env.SMTP_PASS?.trim()) {
    errors.push('SMTP_PASS is not configured');
  }

  if (!process.env.SMTP_FROM?.trim()) {
    errors.push('SMTP_FROM is not configured');
  }

  return errors;
};

export const isSmtpConfigured = (): boolean =>
  getSmtpConfigurationErrors().length === 0;

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const LOG_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const parseLogLevel = (value: string | undefined, nodeEnv: string): string => {
  const normalized = value?.trim().toLowerCase();

  if (normalized && LOG_LEVELS.has(normalized)) {
    return normalized;
  }

  if (nodeEnv === 'test') {
    return 'silent';
  }

  if (nodeEnv === 'production') {
    return 'info';
  }

  return 'debug';
};

const parseSmtpPort = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 587;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  serviceName: process.env.SERVICE_NAME?.trim() || 'impactloop-api',
  logLevel: parseLogLevel(process.env.LOG_LEVEL, process.env.NODE_ENV ?? 'development'),
  logPretty:
    (process.env.NODE_ENV ?? 'development') === 'development' &&
    parseBoolean(process.env.LOG_PRETTY, true),
  mockEmailLogLinks: parseBoolean(process.env.MOCK_EMAIL_LOG_LINKS, false),
  port: parsePort(process.env.PORT),
  corsOrigins: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  passwordResetExpiresIn: process.env.PASSWORD_RESET_EXPIRES_IN ?? '30m',
  invitationExpiresIn: process.env.INVITATION_EXPIRES_IN ?? '7d',
  emailProvider: readEmailProvider(),
  appPublicBaseUrl: readAppPublicBaseUrl(),
  smtpHost: process.env.SMTP_HOST?.trim() || '',
  smtpPort: parseSmtpPort(process.env.SMTP_PORT),
  smtpSecure: parseBoolean(process.env.SMTP_SECURE, false),
  smtpUser: process.env.SMTP_USER?.trim() || '',
  smtpPass: process.env.SMTP_PASS?.trim() || '',
  smtpFrom:
    process.env.SMTP_FROM?.trim() || '',
  aiProvider: resolveAiProvider(),
  aiChatProvider: resolveAiChatProvider(),
  geminiApiKey: readGeminiApiKey(),
  openaiApiKey: readOpenAiApiKey(),
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
  openaiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
  aiChatModel: readAiChatModel(resolveAiChatProvider()),
  aiChatTimeoutMs: parsePositiveInt(process.env.AI_CHAT_TIMEOUT_MS, 30_000),
  aiChatMaxOutputTokens: parsePositiveInt(
    process.env.AI_CHAT_MAX_OUTPUT_TOKENS,
    1024,
  ),
  aiChatMaxMessageLength: parsePositiveInt(
    process.env.AI_CHAT_MAX_MESSAGE_LENGTH,
    4_000,
  ),
  aiChatMaxHistoryMessages: parsePositiveInt(
    process.env.AI_CHAT_MAX_HISTORY_MESSAGES,
    20,
  ),
  aiChatRateLimitPerUser: parsePositiveInt(
    process.env.AI_CHAT_RATE_LIMIT_PER_USER,
    30,
  ),
  aiChatRateLimitWindowMs: parsePositiveInt(
    process.env.AI_CHAT_RATE_LIMIT_WINDOW_MS,
    60 * 60 * 1000,
  ),
  aiChatMaxConversationsPerHour: parsePositiveInt(
    process.env.AI_CHAT_MAX_CONVERSATIONS_PER_HOUR,
    20,
  ),
  aiChatProcessingStaleMs: parsePositiveInt(
    process.env.AI_CHAT_PROCESSING_STALE_MS,
    120_000,
  ),
  aiChatClassifierConfidenceThreshold: Number(
    process.env.AI_CHAT_CLASSIFIER_CONFIDENCE_THRESHOLD ?? '0.7',
  ),
  aiWebSearchEnabled: parseBoolean(process.env.AI_WEB_SEARCH_ENABLED, false),
  aiWebSearchProvider:
    process.env.AI_WEB_SEARCH_PROVIDER?.trim().toLowerCase() || 'mock',
  aiWebSearchModel:
    process.env.AI_WEB_SEARCH_MODEL?.trim() || 'gemini-2.0-flash',
  aiWebSearchMaxResults: parsePositiveInt(process.env.AI_WEB_SEARCH_MAX_RESULTS, 5),
  aiWebSearchTimeoutMs: parsePositiveInt(
    process.env.AI_WEB_SEARCH_TIMEOUT_MS,
    8_000,
  ),
  nominatimBaseUrl:
    process.env.NOMINATIM_BASE_URL?.trim() ||
    'https://nominatim.openstreetmap.org',
  nominatimUserAgent:
    process.env.NOMINATIM_USER_AGENT?.trim() ||
    'ImpactLoop/1.0 (supplier profile reverse geocoding)',
};

export const isAiProviderOperational = (): boolean => {
  if (env.aiProvider === 'disabled') {
    return false;
  }

  if (env.aiProvider === 'mock') {
    return true;
  }

  return Boolean(getConfiguredGeminiApiKey());
};

export const isAiChatProviderOperational = (
  provider: AiChatProviderName = resolveAiChatProvider(),
): boolean => {
  if (provider === 'disabled') {
    return false;
  }

  if (provider === 'mock') {
    return true;
  }

  if (provider === 'openai') {
    return Boolean(getConfiguredOpenAiApiKey());
  }

  return Boolean(getConfiguredGeminiApiKey());
};

export const getAiChatDebugInfo = () => {
  const aiChatProvider = resolveAiChatProvider();

  return {
    envFilePath: backendEnvFilePath,
    invitationsEnvFilePath: invitationsEnvFilePathExported,
    aiChatProvider,
    explicitChatProvider: process.env.AI_CHAT_PROVIDER?.trim() ?? null,
    aiChatModel: readAiChatModel(aiChatProvider),
    openaiApiKeyConfigured: Boolean(env.openaiApiKey),
    openaiModel: env.openaiModel,
    geminiApiKeyConfigured: Boolean(getConfiguredGeminiApiKey()),
    geminiApiKeyFingerprint: getGeminiApiKeyFingerprint(),
    devMockFallbackEnabled: isAiChatDevMockFallbackEnabled(),
    geminiModel: env.geminiModel,
    operational: isAiChatProviderOperational(aiChatProvider),
    maxHistoryMessages: env.aiChatMaxHistoryMessages,
    maxMessageLength: env.aiChatMaxMessageLength,
    envOverrides: collectAiEnvOverrideDiagnostics(),
    configurationWarnings: collectAiConfigurationWarnings(),
  };
};

const collectAiEnvOverrideDiagnostics = () => {
  const overrides: Array<{
    key: string;
    source: 'apps/backend/.env' | 'config/invitations.env';
    previous: string | null;
    current: string | null;
  }> = [];

  for (const key of TRACKED_AI_ENV_KEYS) {
    if (beforeEnvLoadSnapshot[key] !== afterBackendEnvSnapshot[key]) {
      overrides.push({
        key,
        source: 'apps/backend/.env',
        previous: formatTrackedEnvValue(key, beforeEnvLoadSnapshot[key]),
        current: formatTrackedEnvValue(key, afterBackendEnvSnapshot[key]),
      });
    }

    if (afterBackendEnvSnapshot[key] !== afterInvitationsEnvSnapshot[key]) {
      overrides.push({
        key,
        source: 'config/invitations.env',
        previous: formatTrackedEnvValue(key, afterBackendEnvSnapshot[key]),
        current: formatTrackedEnvValue(key, afterInvitationsEnvSnapshot[key]),
      });
    }
  }

  return overrides;
};

const collectAiConfigurationWarnings = (): string[] => {
  const warnings: string[] = [];
  const explicitChatProvider = process.env.AI_CHAT_PROVIDER?.trim().toLowerCase();
  const resolvedChatProvider = resolveAiChatProvider();
  const chatOperational = isAiChatProviderOperational(resolvedChatProvider);

  if (explicitChatProvider === 'gemini' && resolvedChatProvider !== 'gemini') {
    warnings.push(
      'AI_CHAT_PROVIDER=gemini was requested but chat resolved to a different provider.',
    );
  }

  if (explicitChatProvider === 'gemini' && !chatOperational) {
    warnings.push(
      'AI_CHAT_PROVIDER=gemini is set but the chat provider is not operational. Check GEMINI_API_KEY.',
    );
  }

  if (
    explicitChatProvider === 'gemini' &&
    !process.env.AI_CHAT_MODEL?.trim()
  ) {
    warnings.push(
      'AI_CHAT_MODEL is unset while AI_CHAT_PROVIDER=gemini. Chat defaults to gemini-3.1-flash-lite.',
    );
  }

  if (process.env.AI_CHAT_MODEL?.trim() === 'gemini-2.5-flash') {
    warnings.push(
      'AI_CHAT_MODEL=gemini-2.5-flash is unavailable for many Google AI accounts. Prefer AI_CHAT_MODEL=gemini-3.1-flash-lite for chat.',
    );
  }

  if (process.env.AI_CHAT_MODEL?.trim() === 'gemini-2.5-flash-lite') {
    warnings.push(
      'AI_CHAT_MODEL=gemini-2.5-flash-lite is unavailable for many new Google AI accounts. Prefer AI_CHAT_MODEL=gemini-3.1-flash-lite for chat.',
    );
  }

  const rawGeminiKey = process.env.GEMINI_API_KEY?.trim() ?? '';
  if (rawGeminiKey.startsWith('AIza') && rawGeminiKey.length < 39) {
    warnings.push(
      'GEMINI_API_KEY looks unusually short for a Google AI Studio key. Gemini requests may fail with API_KEY_INVALID.',
    );
  }

  if (
    resolvedChatProvider === 'mock' &&
    explicitChatProvider !== 'mock' &&
    !explicitChatProvider
  ) {
    warnings.push(
      'AI chat resolved to mock because no explicit AI_CHAT_PROVIDER or usable Gemini/OpenAI key was detected.',
    );
  }

  if (
    explicitChatProvider &&
    explicitChatProvider !== 'mock' &&
    resolvedChatProvider === 'mock'
  ) {
    warnings.push(
      `AI_CHAT_PROVIDER=${explicitChatProvider} was requested but chat resolved to mock.`,
    );
  }

  return warnings;
};

export const getAiPriceSuggestionDebugInfo = () => {
  const rawKeyPresent = Boolean(process.env.GEMINI_API_KEY?.trim());
  const explicitProvider = process.env.AI_PROVIDER?.trim() ?? null;

  return {
    envFilePath: backendEnvFilePath,
    aiProvider: env.aiProvider,
    explicitProvider,
    geminiApiKeyConfigured: Boolean(getConfiguredGeminiApiKey()),
    rawGeminiApiKeyPresent: rawKeyPresent,
    geminiApiKeyRejectedAsPlaceholder:
      rawKeyPresent && !Boolean(env.geminiApiKey),
    geminiModel: env.geminiModel,
    operational: isAiProviderOperational(),
  };
};

export const getAiPlatformDiagnostics = () => {
  const chatProvider = resolveAiChatProvider();
  const explicitChatProvider = process.env.AI_CHAT_PROVIDER?.trim() ?? chatProvider;
  const explicitChatModel =
    process.env.AI_CHAT_MODEL?.trim() ?? readAiChatModel(chatProvider);

  return {
    AI_CHAT_PROVIDER: explicitChatProvider,
    AI_CHAT_MODEL: explicitChatModel,
    chatProvider,
    chatModel: readAiChatModel(chatProvider),
    devMockFallbackEnabled: isAiChatDevMockFallbackEnabled(),
    geminiKeyLoaded: Boolean(getConfiguredGeminiApiKey()),
    geminiKeyLast4: getGeminiApiKeyLast4(),
    geminiKeyFingerprint: getGeminiApiKeyFingerprint(),
    envPath: backendEnvFilePath,
    webSearchEnabled: env.aiWebSearchEnabled,
    webSearchProvider: env.aiWebSearchProvider,
    webSearchModel: env.aiWebSearchModel,
    priceSuggestionProvider: env.aiProvider,
    priceSuggestionModel: env.geminiModel,
  };
};

export const logAiPlatformDiagnostics = (): void => {
  if (env.nodeEnv === 'production') {
    return;
  }

  const diagnostics = getAiPlatformDiagnostics();
  console.log('[AI platform diagnostics]', JSON.stringify(diagnostics));
};

export const logAiPriceSuggestionStartupConfig = (): void => {
  if (env.nodeEnv === 'production') {
    return;
  }

  const debug = getAiPriceSuggestionDebugInfo();
  console.log('[AI price suggestion config]');
  console.log(`  env file: ${debug.envFilePath}`);
  console.log(`  AI provider: ${debug.aiProvider}`);
  if (debug.explicitProvider) {
    console.log(`  AI_PROVIDER env: ${debug.explicitProvider}`);
  }
  console.log(`  Gemini key configured: ${debug.geminiApiKeyConfigured}`);
  if (debug.rawGeminiApiKeyPresent && debug.geminiApiKeyRejectedAsPlaceholder) {
    console.log('  Gemini key present but rejected (placeholder/invalid format)');
  }
  console.log(`  Gemini model: ${debug.geminiModel}`);
  console.log(`  AI operational: ${debug.operational}`);

  const chatDebug = getAiChatDebugInfo();
  console.log('[AI chat config]');
  console.log(`  env file: ${chatDebug.envFilePath}`);
  console.log(`  invitations env file: ${chatDebug.invitationsEnvFilePath}`);
  console.log(`  AI chat provider: ${chatDebug.aiChatProvider}`);
  if (chatDebug.explicitChatProvider) {
    console.log(`  AI_CHAT_PROVIDER env: ${chatDebug.explicitChatProvider}`);
  }
  console.log(`  AI chat model: ${chatDebug.aiChatModel}`);
  console.log(`  devMockFallbackEnabled: ${chatDebug.devMockFallbackEnabled}`);
  console.log(`  geminiKeyLoaded: ${chatDebug.geminiApiKeyConfigured}`);
  if (chatDebug.geminiApiKeyFingerprint) {
    console.log(`  geminiKeyFingerprint: ${chatDebug.geminiApiKeyFingerprint}`);
  }
  console.log(`  OpenAI key configured: ${chatDebug.openaiApiKeyConfigured}`);
  console.log(`  AI chat operational: ${chatDebug.operational}`);

  if (chatDebug.envOverrides.length > 0) {
    console.log('  Env overrides detected:');
    for (const override of chatDebug.envOverrides) {
      console.log(
        `    - ${override.key} via ${override.source}: ${JSON.stringify(override.previous)} -> ${JSON.stringify(override.current)}`,
      );
    }
  }

  if (chatDebug.configurationWarnings.length > 0) {
    console.log('  Configuration warnings:');
    for (const warning of chatDebug.configurationWarnings) {
      console.log(`    - ${warning}`);
    }
  }

  console.log(
    '  Note: restart the backend after changing .env AI settings. File watchers reload code, not environment files.',
  );
};

export const getEmailInvitationDebugInfo = () => ({
  envFilePath: backendEnvFilePath,
  invitationsEnvFilePath: invitationsEnvFilePathExported,
  emailProvider: env.emailProvider,
  explicitEmailProvider: process.env.EMAIL_PROVIDER?.trim() ?? null,
  appPublicBaseUrl: env.appPublicBaseUrl,
  explicitAppPublicBaseUrl: isAppPublicBaseUrlConfigured(),
  smtpHostConfigured: Boolean(env.smtpHost),
  smtpPort: env.smtpPort,
  smtpSecure: env.smtpSecure,
  smtpUserConfigured: Boolean(env.smtpUser),
  smtpPassConfigured: Boolean(env.smtpPass),
  smtpFromConfigured: Boolean(process.env.SMTP_FROM?.trim()),
});

export const logEmailInvitationStartupConfig = (): void => {
  if (env.nodeEnv === 'production') {
    return;
  }

  const debug = getEmailInvitationDebugInfo();
  console.log('[Email invitation config]');
  console.log(`  env file: ${debug.envFilePath}`);
  console.log(`  invitations env file: ${debug.invitationsEnvFilePath}`);
  console.log(`  EMAIL provider: ${debug.emailProvider}`);
  if (debug.explicitEmailProvider) {
    console.log(`  EMAIL_PROVIDER env: ${debug.explicitEmailProvider}`);
  } else if (debug.emailProvider === 'mock') {
    console.log('  EMAIL_PROVIDER env: (unset, defaulting to mock)');
  }
  console.log(`  APP_PUBLIC_BASE_URL configured: ${debug.explicitAppPublicBaseUrl}`);
  if (debug.explicitAppPublicBaseUrl) {
    console.log(`  APP_PUBLIC_BASE_URL: ${debug.appPublicBaseUrl}`);
  } else {
    console.log('  APP_PUBLIC_BASE_URL: (unset)');
    console.log(
      '  Invitation links will fail until APP_PUBLIC_BASE_URL matches your Flutter web URL.',
    );
  }
  if (debug.emailProvider === 'smtp') {
    console.log(`  SMTP host configured: ${debug.smtpHostConfigured}`);
    console.log(`  SMTP port: ${debug.smtpPort}`);
    console.log(`  SMTP secure: ${debug.smtpSecure}`);
    console.log(`  SMTP user configured: ${debug.smtpUserConfigured}`);
    console.log(`  SMTP pass configured: ${debug.smtpPassConfigured}`);
    console.log(`  SMTP from configured: ${debug.smtpFromConfigured}`);
    const smtpErrors = getSmtpConfigurationErrors();
    if (smtpErrors.length > 0) {
      console.log('  SMTP configuration errors:');
      for (const error of smtpErrors) {
        console.log(`    - ${error}`);
      }
    }
  } else {
    console.log('  Mock provider: invitation links are logged to this console.');
  }
};
