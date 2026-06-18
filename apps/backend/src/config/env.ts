import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

dotenv.config({ path: path.join(backendRoot, '.env') });

export type AiProviderName = 'gemini' | 'mock' | 'disabled';

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
  passwordResetExpiresIn: process.env.PASSWORD_RESET_EXPIRES_IN ?? '1h',
  invitationExpiresIn: process.env.INVITATION_EXPIRES_IN ?? '7d',
  aiProvider: resolveAiProvider(),
  geminiApiKey: readGeminiApiKey(),
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
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
    envFilePath: path.join(backendRoot, '.env'),
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
