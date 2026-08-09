/**
 * Pure JWT signing secret configuration (no process side effects).
 * Used by env.ts and focused configuration tests.
 */

export const JWT_DEV_ACCESS_FALLBACK = "dev-access-secret-change-me";
export const JWT_DEV_REFRESH_FALLBACK = "dev-refresh-secret-change-me";

/**
 * Minimum length of a JWT secret.
 * This is a security measure to prevent using weak secrets.
 * The length is 128 characters to match the recommended length for JWT secrets by the JWT specification.
 */
const JWT_MIN_SECRET_LENGTH = 128;

const KNOWN_JWT_PLACEHOLDER_SECRETS = new Set([
  JWT_DEV_ACCESS_FALLBACK,
  JWT_DEV_REFRESH_FALLBACK,
  "change-me-access-secret",
  "change-me-refresh-secret",
  "change-me",
  "changeme",
  "replace_me",
  "secret",
  "password",
]);

export type JwtSecretsConfig = {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
};

const isProductionRuntime = (env: NodeJS.Dict<string>): boolean =>
  (env.NODE_ENV ?? "").trim() === "production";

export const isKnownJwtSecretPlaceholder = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }

  const normalized = trimmed.toLowerCase();
  if (KNOWN_JWT_PLACEHOLDER_SECRETS.has(normalized)) {
    return true;
  }
  if (KNOWN_JWT_PLACEHOLDER_SECRETS.has(trimmed)) {
    return true;
  }
  if (normalized.includes("change-me") || normalized.includes("changeme")) {
    return true;
  }
  if (normalized.includes("replace_me") || normalized.includes("your-")) {
    return true;
  }

  return false;
};

const assertStrongJwtSecret = (
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

  if (options.production && value.length < JWT_MIN_SECRET_LENGTH) {
    throw new Error(
      `${label} must be at least ${JWT_MIN_SECRET_LENGTH} characters.`,
    );
  }
};

export const resolveJwtSecretsConfig = (
  env: NodeJS.Dict<string> = process.env,
): JwtSecretsConfig => {
  const production = isProductionRuntime(env);
  const accessRaw = env.JWT_ACCESS_SECRET?.trim();
  const refreshRaw = env.JWT_REFRESH_SECRET?.trim();

  let jwtAccessSecret: string;
  let jwtRefreshSecret: string;

  if (production) {
    if (!accessRaw) {
      throw new Error("JWT_ACCESS_SECRET is required in production.");
    }
    if (!refreshRaw) {
      throw new Error("JWT_REFRESH_SECRET is required in production.");
    }

    assertStrongJwtSecret("JWT_ACCESS_SECRET", accessRaw, {
      production: true,
      allowDevFallback: false,
    });
    assertStrongJwtSecret("JWT_REFRESH_SECRET", refreshRaw, {
      production: true,
      allowDevFallback: false,
    });
    jwtAccessSecret = accessRaw;
    jwtRefreshSecret = refreshRaw;
  } else {
    const access = accessRaw || JWT_DEV_ACCESS_FALLBACK;
    const refresh = refreshRaw || JWT_DEV_REFRESH_FALLBACK;

    assertStrongJwtSecret("JWT_ACCESS_SECRET", access, {
      production: false,
      allowDevFallback: access === JWT_DEV_ACCESS_FALLBACK,
    });
    assertStrongJwtSecret("JWT_REFRESH_SECRET", refresh, {
      production: false,
      allowDevFallback: refresh === JWT_DEV_REFRESH_FALLBACK,
    });
    jwtAccessSecret = access;
    jwtRefreshSecret = refresh;
  }

  if (jwtAccessSecret === jwtRefreshSecret) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct.",
    );
  }

  return { jwtAccessSecret, jwtRefreshSecret };
};
