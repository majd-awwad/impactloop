import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const envFilePath = path.join(backendRoot, '.env');
const invitationsEnvFilePath = path.join(backendRoot, 'config/invitations.env');

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

dotenv.config({ path: envFilePath, override: true });
const invitationsEnvResult = dotenv.config({
  path: invitationsEnvFilePath,
  override: true,
});
stripEmptyEnvOverrides(invitationsEnvResult.parsed);

export const backendEnvFilePath = envFilePath;
export const invitationsEnvFilePathExported = invitationsEnvFilePath;

export type AiProviderName = 'gemini' | 'mock' | 'disabled';

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
  return isUsableGeminiApiKey(raw) ? raw! : null;
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

const parseSmtpPort = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 587;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
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
  geminiApiKey: readGeminiApiKey(),
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
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

  return Boolean(env.geminiApiKey);
};

export const getAiPriceSuggestionDebugInfo = () => {
  const rawKeyPresent = Boolean(process.env.GEMINI_API_KEY?.trim());
  const explicitProvider = process.env.AI_PROVIDER?.trim() ?? null;

  return {
    envFilePath: backendEnvFilePath,
    aiProvider: env.aiProvider,
    explicitProvider,
    geminiApiKeyConfigured: Boolean(env.geminiApiKey),
    rawGeminiApiKeyPresent: rawKeyPresent,
    geminiApiKeyRejectedAsPlaceholder:
      rawKeyPresent && !Boolean(env.geminiApiKey),
    geminiModel: env.geminiModel,
    operational: isAiProviderOperational(),
  };
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
