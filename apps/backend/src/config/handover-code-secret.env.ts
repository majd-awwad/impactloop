/**
 * Pure handover confirmation code secret configuration (no process side effects).
 * Used by env.ts and focused configuration tests.
 */

import { isKnownJwtSecretPlaceholder } from './jwt-secrets.env.js';

export const HANDOVER_DEV_CODE_SECRET_FALLBACK =
  'dev-handover-code-secret-change-me';

const HANDOVER_MIN_SECRET_LENGTH = 24;

export type HandoverCodeSecretConfig = {
  handoverCodeSecret: string;
};

const isProductionRuntime = (env: NodeJS.Dict<string>): boolean =>
  (env.NODE_ENV ?? '').trim() === 'production';

const assertStrongHandoverCodeSecret = (
  label: string,
  value: string,
  options: { production: boolean; allowDevFallback: boolean },
): void => {
  if (!value || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  if (!options.allowDevFallback && isKnownJwtSecretPlaceholder(value)) {
    throw new Error(
      `${label} must not use a known placeholder or example value.`,
    );
  }

  if (options.production && value.length < HANDOVER_MIN_SECRET_LENGTH) {
    throw new Error(
      `${label} must be at least ${HANDOVER_MIN_SECRET_LENGTH} characters.`,
    );
  }
};

const assertDistinctFromJwtSecrets = (
  handoverCodeSecret: string,
  env: NodeJS.Dict<string>,
): void => {
  const accessSecret = env.JWT_ACCESS_SECRET?.trim();
  const refreshSecret = env.JWT_REFRESH_SECRET?.trim();

  if (accessSecret && handoverCodeSecret === accessSecret) {
    throw new Error(
      'HANDOVER_CODE_SECRET must be distinct from JWT_ACCESS_SECRET.',
    );
  }

  if (refreshSecret && handoverCodeSecret === refreshSecret) {
    throw new Error(
      'HANDOVER_CODE_SECRET must be distinct from JWT_REFRESH_SECRET.',
    );
  }
};

export const resolveHandoverCodeSecretConfig = (
  env: NodeJS.Dict<string> = process.env,
): HandoverCodeSecretConfig => {
  const production = isProductionRuntime(env);
  const secretRaw = env.HANDOVER_CODE_SECRET?.trim();

  let handoverCodeSecret: string;

  if (production) {
    if (!secretRaw) {
      throw new Error('HANDOVER_CODE_SECRET is required in production.');
    }

    assertStrongHandoverCodeSecret('HANDOVER_CODE_SECRET', secretRaw, {
      production: true,
      allowDevFallback: false,
    });
    handoverCodeSecret = secretRaw;
  } else {
    const secret = secretRaw || HANDOVER_DEV_CODE_SECRET_FALLBACK;

    assertStrongHandoverCodeSecret('HANDOVER_CODE_SECRET', secret, {
      production: false,
      allowDevFallback: secret === HANDOVER_DEV_CODE_SECRET_FALLBACK,
    });
    handoverCodeSecret = secret;
  }

  assertDistinctFromJwtSecrets(handoverCodeSecret, env);

  return { handoverCodeSecret };
};
