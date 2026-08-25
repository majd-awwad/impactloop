import dotenv from 'dotenv';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseRecommendationScorerVersion,
  type RecommendationScorerVersion,
} from './recommendation-scoring-version.js';
import { resolveHandoverCodeSecretConfig } from './handover-code-secret.env.js';
import { resolveJwtSecretsConfig } from './jwt-secrets.env.js';
import { resolvePaymentRuntimeConfig } from '../modules/payments/payments.env.js';

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
  'AI_CHAT_TIMEOUT_MS',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_BASE_URL',
  'OPENAI_JSON_MODE',
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

const FORBIDDEN_DEVELOPMENT_DATABASE_NAME = 'impactloop';
const ALLOWED_AUTOMATED_TEST_DATABASE_NAMES = new Set([
  'impactloop_test',
  'impactloop_ci',
  // Disposable local Driver E2E database (scripts/run-driver-e2e.ts).
  'impactloop_driver_e2e',
]);

/**
 * True when this process is an automated Node test runtime.
 * Covers NODE_ENV=test (npm runners) and Node's built-in NODE_TEST_CONTEXT
 * (direct `node --test` / `node --import tsx --test` without a wrapper).
 */
export const isAutomatedTestRuntime = (
  envVars: NodeJS.ProcessEnv = process.env,
): boolean => {
  if ((envVars.NODE_ENV ?? '').trim() === 'test') {
    return true;
  }
  return Boolean(envVars.NODE_TEST_CONTEXT?.trim());
};

/**
 * Local .env may override inherited process env in development so edited keys
 * win. Never do that for production or automated tests — otherwise a local
 * `.env` with NODE_ENV=development / DATABASE_URL=…/impactloop clobbers the
 * test runner and routes DB-backed tests at the development database.
 */
export const shouldOverrideProcessEnvFromLocalFiles = (
  envVars: NodeJS.ProcessEnv = process.env,
): boolean => {
  const nodeEnv = envVars.NODE_ENV?.trim() || 'development';
  if (nodeEnv === 'production' || isAutomatedTestRuntime(envVars)) {
    return false;
  }
  return true;
};

const parseDatabaseNameFromUrl = (raw: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('TEST_DATABASE_URL is malformed and cannot be parsed as a URL.');
  }
  return decodeURIComponent(parsed.pathname.replace(/^\//, '').split('?')[0] ?? '');
};

export const assertAllowedAutomatedTestDatabaseUrl = (raw: string): void => {
  const databaseName = parseDatabaseNameFromUrl(raw);
  if (
    !databaseName ||
    databaseName === FORBIDDEN_DEVELOPMENT_DATABASE_NAME ||
    !ALLOWED_AUTOMATED_TEST_DATABASE_NAMES.has(databaseName)
  ) {
    throw new Error(
      'Refusing to run automated tests against the development database.\n' +
        'Configure TEST_DATABASE_URL with a dedicated test database ' +
        `(allowed names: ${[...ALLOWED_AUTOMATED_TEST_DATABASE_NAMES].join(', ')}).`,
    );
  }
};

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

export type AiProviderName = 'openai' | 'gemini' | 'mock' | 'disabled';
export type AiChatProviderName = 'openai' | 'gemini' | 'mock' | 'disabled';

export type EmailProviderName = 'mock' | 'smtp';

const parsePort = (value: string | undefined): number => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 4000;
};

/**
 * Development/production use DATABASE_URL.
 * Automated tests (NODE_ENV=test or NODE_TEST_CONTEXT) require TEST_DATABASE_URL
 * with no fallback, refuse the development database name `impactloop`, and
 * overwrite process.env.DATABASE_URL so Prisma/scripts cannot silently target
 * the development database.
 */
export const resolveDatabaseUrl = (
  envVars: NodeJS.ProcessEnv = process.env,
): string => {
  if (isAutomatedTestRuntime(envVars)) {
    // Align Node's direct --test context with the rest of the stack.
    envVars.NODE_ENV = 'test';
    const testDatabaseUrl = envVars.TEST_DATABASE_URL?.trim();
    if (!testDatabaseUrl) {
      throw new Error(
        'Missing required environment variable: TEST_DATABASE_URL. ' +
          'Automated tests must not use DATABASE_URL. ' +
          'Configure TEST_DATABASE_URL with a dedicated test database ' +
          '(e.g. impactloop_test or impactloop_ci).',
      );
    }
    assertAllowedAutomatedTestDatabaseUrl(testDatabaseUrl);
    envVars.DATABASE_URL = testDatabaseUrl;
    return testDatabaseUrl;
  }

  const databaseUrl = envVars.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }
  return databaseUrl;
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

export const getConfiguredOpenAiApiKey = (): string | null => {
  reloadDevEnvFromDisk();
  return readOpenAiApiKey();
};

export const isOpenRouterBaseUrl = (baseUrl: string | null | undefined): boolean => {
  if (!baseUrl?.trim()) {
    return false;
  }

  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === 'openrouter.ai' || hostname.endsWith('.openrouter.ai');
  } catch {
    return false;
  }
};

export const getOpenAiBaseUrl = (): string | null => {
  reloadDevEnvFromDisk();
  const raw = process.env.OPENAI_BASE_URL?.trim();
  return raw ? raw.replace(/\/+$/, '') : null;
};

export const isOpenAiCompatibleJsonModeEnabled = (
  baseUrl: string | null = getOpenAiBaseUrl(),
): boolean => {
  const explicit = process.env.OPENAI_JSON_MODE?.trim().toLowerCase();
  if (explicit === 'true' || explicit === '1') {
    return true;
  }
  if (explicit === 'false' || explicit === '0') {
    return false;
  }

  // OpenRouter free models often reject response_format=json_object.
  if (isOpenRouterBaseUrl(baseUrl)) {
    return false;
  }

  return true;
};

export const GEMINI_CHAT_MODEL_FALLBACKS = [
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

const reloadDevEnvFromDisk = (): void => {
  if (
    process.env.NODE_ENV === 'production' ||
    isAutomatedTestRuntime()
  ) {
    return;
  }

  const digest = digestEnvFile(envFilePath);
  if (!digest || digest === lastBackendEnvDigest) {
    return;
  }

  bootstrapBackendEnvironment();
};

/**
 * Canonical chat model: AI_CHAT_MODEL wins for all providers.
 * OPENAI_MODEL is a backward-compatible fallback only when AI_CHAT_MODEL is unset
 * and the resolved provider is openai/OpenAI-compatible.
 */
const readAiChatModel = (provider: AiChatProviderName): string => {
  const canonical = process.env.AI_CHAT_MODEL?.trim();
  if (canonical) {
    return canonical;
  }

  if (provider === 'openai') {
    return process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  }

  return 'gemini-2.0-flash';
};

export const getResolvedAiChatModel = (): string => {
  reloadDevEnvFromDisk();
  return readAiChatModel(resolveAiChatProvider());
};

export type AiChatRuntimeConfig = {
  provider: AiChatProviderName;
  model: string;
  geminiApiKey: string | null;
  openaiApiKey: string | null;
  openaiBaseUrl: string | null;
  openaiJsonMode: boolean;
  openaiBaseHost: string | null;
  isOpenRouter: boolean;
  timeoutMs: number;
  maxOutputTokens: number;
  modelCandidates: string[];
};

/** One coherent config snapshot per operation (single optional .env reload). */
export const getAiChatRuntimeConfig = (): AiChatRuntimeConfig => {
  reloadDevEnvFromDisk();
  const provider = resolveAiChatProvider();
  const model = readAiChatModel(provider);
  const openaiBaseUrl = (() => {
    const raw = process.env.OPENAI_BASE_URL?.trim();
    return raw ? raw.replace(/\/+$/, '') : null;
  })();
  let openaiBaseHost: string | null = null;
  try {
    openaiBaseHost = openaiBaseUrl ? new URL(openaiBaseUrl).host : null;
  } catch {
    openaiBaseHost = null;
  }

  const fallbacks =
    provider === 'gemini'
      ? GEMINI_CHAT_MODEL_FALLBACKS.filter((candidate) => candidate !== model)
      : [];

  return {
    provider,
    model,
    geminiApiKey: readGeminiApiKey(),
    openaiApiKey: readOpenAiApiKey(),
    openaiBaseUrl,
    openaiJsonMode: isOpenAiCompatibleJsonModeEnabled(openaiBaseUrl),
    openaiBaseHost,
    isOpenRouter: isOpenRouterBaseUrl(openaiBaseUrl),
    timeoutMs: readAiChatTimeoutMs(),
    maxOutputTokens: env.aiChatMaxOutputTokens,
    modelCandidates: [model, ...fallbacks],
  };
};

export const getGeminiChatModelCandidates = (): string[] => {
  reloadDevEnvFromDisk();
  // Gemini provider operations always use the Gemini fallback chain, even if
  // another chat provider is selected for the rest of the app (e.g. tests).
  const model = process.env.AI_CHAT_MODEL?.trim() || 'gemini-2.0-flash';
  const fallbacks = GEMINI_CHAT_MODEL_FALLBACKS.filter(
    (candidate) => candidate !== model,
  );
  return [model, ...fallbacks];
};

const readExplicitAiProvider = (): AiProviderName | null => {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
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

export const resolveAiProvider = (): AiProviderName => {
  const explicit = readExplicitAiProvider();
  if (explicit) {
    return explicit;
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

const DEFAULT_AI_CHAT_TIMEOUT_MS = 30_000;

export const readAiChatTimeoutMs = (): number =>
  parsePositiveInt(process.env.AI_CHAT_TIMEOUT_MS, DEFAULT_AI_CHAT_TIMEOUT_MS);

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

export type TrustProxySetting = boolean | number | string;

export const parseTrustProxy = (
  value: string | undefined,
): TrustProxySetting => {
  if (value === undefined || value.trim() === '') {
    return false;
  }

  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'false' || lower === '0') {
    return false;
  }

  // Prefer a single trusted hop over blanket proxy trust.
  if (lower === 'true') {
    return 1;
  }

  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber > 0) {
    return asNumber;
  }

  return trimmed;
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

const parseBoundedInteger = (
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, parsed));
};

export type RecommendationOutboxRuntimeConfig = {
  enabled: boolean;
  required: boolean;
  pollIntervalMs: number;
  batchSize: number;
  maxAttempts: number;
  leaseMs: number;
};

/**
 * Pure resolver for recommendation outbox runtime flags.
 * Accepts a plain env map so tests do not need module-cache re-imports.
 */
export const resolveRecommendationOutboxRuntimeConfig = (
  processEnv: NodeJS.Dict<string> = process.env,
): RecommendationOutboxRuntimeConfig => {
  const nodeEnv = processEnv.NODE_ENV ?? 'development';
  const requiredDefault = nodeEnv === 'production';

  return {
    enabled: parseBoolean(
      processEnv.RECOMMENDATION_OUTBOX_WORKER_ENABLED,
      false,
    ),
    required: parseBoolean(
      processEnv.RECOMMENDATION_OUTBOX_WORKER_REQUIRED,
      requiredDefault,
    ),
    pollIntervalMs: parseBoundedInteger(
      processEnv.RECOMMENDATION_OUTBOX_POLL_INTERVAL_MS,
      2_000,
      250,
      60_000,
    ),
    batchSize: parseBoundedInteger(
      processEnv.RECOMMENDATION_OUTBOX_BATCH_SIZE,
      10,
      1,
      100,
    ),
    maxAttempts: parseBoundedInteger(
      processEnv.RECOMMENDATION_OUTBOX_MAX_ATTEMPTS,
      5,
      1,
      20,
    ),
    leaseMs: parseBoundedInteger(
      processEnv.RECOMMENDATION_OUTBOX_LEASE_MS,
      30_000,
      1_000,
      300_000,
    ),
  };
};

const recommendationOutboxRuntime = resolveRecommendationOutboxRuntimeConfig();

export type RecommendationMlRuntimeMode =
  | 'DETERMINISTIC'
  | 'SHADOW'
  | 'ML_PRIMARY';

export type RecommendationMlRuntimeConfig = {
  mode: RecommendationMlRuntimeMode;
  explicitMode: boolean;
  materialArtifactPath: string;
  projectArtifactPath: string;
};

export type RecommendationMlRuntimeConfigErrorCode = 'INVALID_RUNTIME_MODE';

export class RecommendationMlRuntimeConfigError extends Error {
  readonly code: RecommendationMlRuntimeConfigErrorCode;

  constructor(code: RecommendationMlRuntimeConfigErrorCode, message: string) {
    super(message);
    this.name = 'RecommendationMlRuntimeConfigError';
    this.code = code;
  }
}

const recommendationMlRuntimeModes = new Set<RecommendationMlRuntimeMode>([
  'DETERMINISTIC',
  'SHADOW',
  'ML_PRIMARY',
]);

/**
 * Authoritative ML serving mode.
 * Unset → ML_PRIMARY (intended architecture; deterministic is fallback when ML is not READY).
 * Explicit DETERMINISTIC / SHADOW override for rollback and evaluation.
 * Legacy RECOMMENDATION_ML_SHADOW_ENABLED alone no longer selects the mode.
 */
export const resolveRecommendationMlRuntimeConfig = (
  processEnv: NodeJS.ProcessEnv,
): RecommendationMlRuntimeConfig => {
  const rawMode = processEnv.RECOMMENDATION_ML_RUNTIME_MODE?.trim() ?? '';
  const explicitMode = rawMode.length > 0;
  let mode: RecommendationMlRuntimeMode;

  if (!explicitMode) {
    mode = 'ML_PRIMARY';
  } else if (
    recommendationMlRuntimeModes.has(rawMode as RecommendationMlRuntimeMode)
  ) {
    mode = rawMode as RecommendationMlRuntimeMode;
  } else {
    throw new RecommendationMlRuntimeConfigError(
      'INVALID_RUNTIME_MODE',
      'RECOMMENDATION_ML_RUNTIME_MODE must be DETERMINISTIC, SHADOW, or ML_PRIMARY.',
    );
  }

  return {
    mode,
    explicitMode,
    materialArtifactPath:
      processEnv.RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH?.trim() ?? '',
    projectArtifactPath:
      processEnv.RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH?.trim() ?? '',
  };
};

const recommendationMlRuntime = resolveRecommendationMlRuntimeConfig(process.env);

const jwtSecrets = resolveJwtSecretsConfig(process.env);
const handoverCodeSecretConfig = resolveHandoverCodeSecretConfig(process.env);

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
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  rateLimitMaxEntries: parsePositiveInt(process.env.RATE_LIMIT_MAX_ENTRIES, 10_000),
  rateLimitSweepIntervalMs: parsePositiveInt(
    process.env.RATE_LIMIT_SWEEP_INTERVAL_MS,
    60_000,
  ),
  databaseUrl: resolveDatabaseUrl(),
  jwtAccessSecret: jwtSecrets.jwtAccessSecret,
  jwtRefreshSecret: jwtSecrets.jwtRefreshSecret,
  handoverCodeSecret: handoverCodeSecretConfig.handoverCodeSecret,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  passwordResetExpiresIn: process.env.PASSWORD_RESET_EXPIRES_IN ?? '30m',
  emailVerificationExpiresIn:
    process.env.EMAIL_VERIFICATION_EXPIRES_IN ?? '24h',
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
  openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim()?.replace(/\/+$/, '') || null,
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
  openaiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
  aiChatModel: readAiChatModel(resolveAiChatProvider()),
  get aiChatTimeoutMs() {
    return readAiChatTimeoutMs();
  },
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
  adminExportMaxRows: parsePositiveInt(process.env.ADMIN_EXPORT_MAX_ROWS, 10_000),
  adminExportChunkSize: parsePositiveInt(process.env.ADMIN_EXPORT_CHUNK_SIZE, 500),
  adminExportPdfMaxRows: parsePositiveInt(
    process.env.ADMIN_EXPORT_PDF_MAX_ROWS,
    500,
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
  recommendationScorerVersion: parseRecommendationScorerVersion(
    process.env.RECOMMENDATION_SCORER_VERSION,
  ) as RecommendationScorerVersion,
  recommendationMlRuntimeMode: recommendationMlRuntime.mode,
  recommendationMlRuntimeModeExplicit: recommendationMlRuntime.explicitMode,
  /** True when mode is SHADOW or ML_PRIMARY (side-path / concept hydration eligible). */
  recommendationMlShadowEnabled:
    recommendationMlRuntime.mode !== 'DETERMINISTIC',
  recommendationMlMaterialArtifactPath:
    recommendationMlRuntime.materialArtifactPath,
  recommendationMlProjectArtifactPath:
    recommendationMlRuntime.projectArtifactPath,
  recommendationOutboxWorkerEnabled: recommendationOutboxRuntime.enabled,
  recommendationOutboxWorkerRequired: recommendationOutboxRuntime.required,
  recommendationOutboxPollIntervalMs: recommendationOutboxRuntime.pollIntervalMs,
  recommendationOutboxBatchSize: recommendationOutboxRuntime.batchSize,
  recommendationOutboxMaxAttempts: recommendationOutboxRuntime.maxAttempts,
  recommendationOutboxLeaseMs: recommendationOutboxRuntime.leaseMs,
  nominatimBaseUrl:
    process.env.NOMINATIM_BASE_URL?.trim() ||
    'https://nominatim.openstreetmap.org',
  nominatimUserAgent:
    process.env.NOMINATIM_USER_AGENT?.trim() ||
    'ImpactLoop/1.0 (supplier profile reverse geocoding)',
  ...(() => {
    const payment = resolvePaymentRuntimeConfig(process.env);
    return {
      paymentProvider: payment.paymentProvider,
      paymentProviderMode: payment.paymentProviderMode,
      paymentMockRoutesEnabled: payment.paymentMockRoutesEnabled,
      paymentMockWebhookSecret: payment.paymentMockWebhookSecret,
      paymentMockCheckoutTokenSecret: payment.paymentMockCheckoutTokenSecret,
      paymentMockWebhookReplayWindowMs:
        payment.paymentMockWebhookReplayWindowMs,
      paymentMockCheckoutTtlMs: payment.paymentMockCheckoutTtlMs,
      paymentUsedDevelopmentSecretFallback:
        payment.usedDevelopmentSecretFallback,
    };
  })(),
};

export const isAiProviderOperational = (): boolean => {
  if (env.aiProvider === 'disabled') {
    return false;
  }

  if (env.aiProvider === 'mock') {
    return true;
  }

  if (env.aiProvider === 'openai') {
    return Boolean(getConfiguredOpenAiApiKey());
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
  const runtime = getAiChatRuntimeConfig();

  return {
    envFilePath: backendEnvFilePath,
    invitationsEnvFilePath: invitationsEnvFilePathExported,
    aiChatProvider: runtime.provider,
    explicitChatProvider: process.env.AI_CHAT_PROVIDER?.trim() ?? null,
    aiChatModel: runtime.model,
    openaiApiKeyConfigured: Boolean(runtime.openaiApiKey),
    openaiModel: process.env.OPENAI_MODEL?.trim() || null,
    openaiBaseHost: runtime.openaiBaseHost,
    openaiJsonMode: runtime.openaiJsonMode,
    isOpenRouter: runtime.isOpenRouter,
    chatTimeoutMs: runtime.timeoutMs,
    geminiApiKeyConfigured: Boolean(runtime.geminiApiKey),
    geminiApiKeyFingerprint: getGeminiApiKeyFingerprint(),
    devMockFallbackEnabled: isAiChatDevMockFallbackEnabled(),
    geminiModel: env.geminiModel,
    operational: isAiChatProviderOperational(runtime.provider),
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
      'AI_CHAT_MODEL is unset while AI_CHAT_PROVIDER=gemini. Chat defaults to gemini-2.0-flash.',
    );
  }

  if (
    explicitChatProvider === 'openai' &&
    !process.env.AI_CHAT_MODEL?.trim() &&
    process.env.OPENAI_MODEL?.trim()
  ) {
    warnings.push(
      'AI_CHAT_MODEL is unset; using OPENAI_MODEL as a backward-compatible fallback. Prefer setting AI_CHAT_MODEL as the canonical chat model.',
    );
  }

  if (
    process.env.AI_CHAT_MODEL?.trim() &&
    process.env.OPENAI_MODEL?.trim() &&
    process.env.AI_CHAT_MODEL.trim() !== process.env.OPENAI_MODEL.trim() &&
    (explicitChatProvider === 'openai' || resolvedChatProvider === 'openai')
  ) {
    warnings.push(
      'AI_CHAT_MODEL and OPENAI_MODEL differ; AI_CHAT_MODEL is canonical for chat and takes precedence.',
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
  const chatRuntime = getAiChatRuntimeConfig();
  const model =
    env.aiProvider === 'openai' ? chatRuntime.model : env.geminiModel;

  return {
    envFilePath: backendEnvFilePath,
    aiProvider: env.aiProvider,
    explicitProvider,
    geminiApiKeyConfigured: Boolean(getConfiguredGeminiApiKey()),
    rawGeminiApiKeyPresent: rawKeyPresent,
    geminiApiKeyRejectedAsPlaceholder:
      rawKeyPresent && !Boolean(env.geminiApiKey),
    geminiModel: env.geminiModel,
    openaiApiKeyConfigured: Boolean(chatRuntime.openaiApiKey),
    openaiBaseHost: chatRuntime.openaiBaseHost,
    isOpenRouter: chatRuntime.isOpenRouter,
    model,
    operational: isAiProviderOperational(),
  };
};

export const getAiPlatformDiagnostics = () => {
  const runtime = getAiChatRuntimeConfig();
  const chatProvider = runtime.provider;
  const explicitChatProvider = process.env.AI_CHAT_PROVIDER?.trim() ?? chatProvider;
  const explicitChatModel =
    process.env.AI_CHAT_MODEL?.trim() ?? runtime.model;

  return {
    AI_CHAT_PROVIDER: explicitChatProvider,
    AI_CHAT_MODEL: explicitChatModel,
    chatProvider,
    chatModel: runtime.model,
    chatModelCandidates: runtime.modelCandidates,
    openaiBaseHost: runtime.openaiBaseHost,
    openaiJsonMode: runtime.openaiJsonMode,
    isOpenRouter: runtime.isOpenRouter,
    chatTimeoutMs: runtime.timeoutMs,
    openaiModelConfigured: Boolean(process.env.OPENAI_MODEL?.trim()),
    openaiModelEffectiveOnlyIfChatModelUnset: !Boolean(
      process.env.AI_CHAT_MODEL?.trim(),
    ),
    devMockFallbackEnabled: isAiChatDevMockFallbackEnabled(),
    geminiKeyLoaded: Boolean(getConfiguredGeminiApiKey()),
    geminiKeyLast4: getGeminiApiKeyLast4(),
    geminiKeyFingerprint: getGeminiApiKeyFingerprint(),
    envPath: backendEnvFilePath,
    webSearchEnabled: env.aiWebSearchEnabled,
    webSearchProvider: env.aiWebSearchProvider,
    webSearchModel: env.aiWebSearchModel,
    priceSuggestionProvider: env.aiProvider,
    priceSuggestionModel: getAiPriceSuggestionDebugInfo().model,
  };
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
