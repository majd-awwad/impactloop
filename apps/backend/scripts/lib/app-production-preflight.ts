/**
 * Whole-application production preflight (pure).
 * Validates core API configuration without importing env.ts (module init can throw).
 */

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveHandoverCodeSecretConfig } from "../../src/config/handover-code-secret.env.js";
import { resolveJwtSecretsConfig } from "../../src/config/jwt-secrets.env.js";
import { BUILD_COMPLETION_UPLOADS_DIR } from "../../src/modules/learning-projects/build-completion-uploads.storage.js";
import { resolvePaymentRuntimeConfig } from "../../src/modules/payments/payments.env.js";
import { PROFILE_UPLOADS_DIR } from "../../src/modules/uploads/profile-uploads.storage.js";
import { UPLOAD_TEMP_DIR } from "../../src/modules/uploads/secure-upload.js";
import { MATERIAL_UPLOADS_DIR } from "../../src/modules/uploads/uploads.storage.js";
import { SUPPLIER_VERIFICATION_UPLOADS_DIR } from "../../src/modules/uploads/verification-uploads.storage.js";
import {
  finalizeValidationResult,
  formatHumanReport,
  formatJsonReport,
  pushDiagnostic,
  readEnv,
  sanitizeErrorMessage,
  type Diagnostic,
  type ValidationResult,
} from "./validation-report.js";
import type { DatabaseConnectivityCheck } from "./validation-env.js";

const TRUE_VALUES = new Set(["1", "true", "yes"]);
const FALSE_VALUES = new Set(["0", "false", "no"]);

const RECOMMENDATION_ML_RUNTIME_MODES = new Set([
  "DETERMINISTIC",
  "SHADOW",
  "ML_PRIMARY",
]);

/**
 * Production ML runtime validation.
 * Unset mode resolves to ML_PRIMARY at runtime; when explicitly ML_PRIMARY (or unset),
 * require non-empty artifact paths so deployments are not silently "ML-ready" without models.
 */
const validateRecommendationMlRuntimeMode = (
  env: NodeJS.Dict<string>,
  diagnostics: Diagnostic[],
): void => {
  const rawMode = readEnv(env, "RECOMMENDATION_ML_RUNTIME_MODE")?.trim() ?? "";
  const mode = rawMode.length > 0 ? rawMode : "ML_PRIMARY";

  if (rawMode.length > 0 && !RECOMMENDATION_ML_RUNTIME_MODES.has(rawMode)) {
    pushDiagnostic(diagnostics, {
      code: "RECOMMENDATION_ML_RUNTIME_INVALID",
      summary:
        "RECOMMENDATION_ML_RUNTIME_MODE must be DETERMINISTIC, SHADOW, or ML_PRIMARY",
      field: "RECOMMENDATION_ML_RUNTIME_MODE",
    });
    return;
  }

  if (mode === "ML_PRIMARY") {
    const materialPath =
      readEnv(env, "RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH")?.trim() ?? "";
    const projectPath =
      readEnv(env, "RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH")?.trim() ?? "";
    if (!materialPath) {
      pushDiagnostic(diagnostics, {
        code: "RECOMMENDATION_ML_MATERIAL_ARTIFACT_MISSING",
        summary:
          "ML_PRIMARY requires RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH in production",
        field: "RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH",
      });
    }
    if (!projectPath) {
      pushDiagnostic(diagnostics, {
        code: "RECOMMENDATION_ML_PROJECT_ARTIFACT_MISSING",
        summary:
          "ML_PRIMARY requires RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH in production",
        field: "RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH",
      });
    }
  }

  const staleMaterialServing =
    readEnv(env, "RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED")?.trim() ?? "";
  const staleProjectServing =
    readEnv(env, "RECOMMENDATION_ML_PROJECT_SERVING_ENABLED")?.trim() ?? "";
  if (staleMaterialServing.length > 0 || staleProjectServing.length > 0) {
    pushDiagnostic(diagnostics, {
      code: "RECOMMENDATION_ML_SERVING_FLAGS_REMOVED",
      summary:
        "RECOMMENDATION_ML_*_SERVING_ENABLED flags are removed; use RECOMMENDATION_ML_RUNTIME_MODE=ML_PRIMARY|DETERMINISTIC|SHADOW",
      field: "RECOMMENDATION_ML_RUNTIME_MODE",
    });
  }
};

export type ValidateAppProductionPreflightOptions = {
  env?: NodeJS.Dict<string>;
  database?: DatabaseConnectivityCheck;
  skipDatabase?: boolean;
  /** When false, skip filesystem upload directory probes. */
  checkUploadDirectories?: boolean;
};

export const APP_PRODUCTION_HUMAN_REPORT_LABELS = {
  pass: "PASS — Production application configuration is safe",
  fail: "FAIL — Production application configuration is unsafe",
} as const;

export const formatAppProductionHumanReport = (result: ValidationResult): string =>
  formatHumanReport(result, APP_PRODUCTION_HUMAN_REPORT_LABELS);

const parseStrictBoolean = (
  value: string | undefined,
  fallback = false,
): boolean | "invalid" => {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_VALUES.has(normalized)) {
    return false;
  }
  return "invalid";
};

const parseCorsOrigins = (raw: string | undefined): string[] =>
  (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const isLocalhostOrigin = (origin: string): boolean => {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
};

const collectSmtpConfigurationErrors = (env: NodeJS.Dict<string>): string[] => {
  const errors: string[] = [];
  if (!readEnv(env, "SMTP_HOST")?.trim()) {
    errors.push("SMTP_HOST is not configured");
  }
  if (!readEnv(env, "SMTP_USER")?.trim()) {
    errors.push("SMTP_USER is not configured");
  }
  if (!readEnv(env, "SMTP_PASS")?.trim()) {
    errors.push("SMTP_PASS is not configured");
  }
  if (!readEnv(env, "SMTP_FROM")?.trim()) {
    errors.push("SMTP_FROM is not configured");
  }
  return errors;
};

const validateZoomConfiguration = (
  env: NodeJS.Dict<string>,
  diagnostics: Diagnostic[],
): void => {
  const rawMode = readEnv(env, "ZOOM_INTEGRATION_MODE")?.trim().toLowerCase() ?? "fake";
  if (rawMode !== "fake" && rawMode !== "real" && rawMode !== "disabled") {
    pushDiagnostic(diagnostics, {
      code: "ZOOM_INTEGRATION_MODE_INVALID",
      summary: "ZOOM_INTEGRATION_MODE must be fake, real, or disabled",
      field: "ZOOM_INTEGRATION_MODE",
    });
    return;
  }

  if (rawMode !== "real") {
    return;
  }

  const requiredFields = [
    ["ZOOM_ACCOUNT_ID", "account ID"],
    ["ZOOM_CLIENT_ID", "client ID"],
    ["ZOOM_CLIENT_SECRET", "client secret"],
    ["ZOOM_HOST_USER_ID", "host user ID"],
  ] as const;

  for (const [field, label] of requiredFields) {
    if (!readEnv(env, field)?.trim()) {
      pushDiagnostic(diagnostics, {
        code: "ZOOM_CREDENTIAL_MISSING",
        summary: `Zoom ${label} is required when ZOOM_INTEGRATION_MODE=real`,
        field,
      });
    }
  }

  const parseHttpUrl = (value: string | undefined, field: string): void => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        pushDiagnostic(diagnostics, {
          code: "ZOOM_URL_INVALID",
          summary: `Zoom ${field} must use http or https`,
          field,
        });
      }
    } catch {
      pushDiagnostic(diagnostics, {
        code: "ZOOM_URL_INVALID",
        summary: `Zoom ${field} must be a valid URL`,
        field,
      });
    }
  };

  parseHttpUrl(
    readEnv(env, "ZOOM_API_BASE_URL") ?? "https://api.zoom.us/v2",
    "ZOOM_API_BASE_URL",
  );
  parseHttpUrl(
    readEnv(env, "ZOOM_TOKEN_URL") ?? "https://zoom.us/oauth/token",
    "ZOOM_TOKEN_URL",
  );
};

const validateUploadDirectoriesWritable = (diagnostics: Diagnostic[]): void => {
  const directories = [
    { field: "uploads/materials", directory: MATERIAL_UPLOADS_DIR },
    { field: "uploads/profiles", directory: PROFILE_UPLOADS_DIR },
    {
      field: "uploads/supplier-verification",
      directory: SUPPLIER_VERIFICATION_UPLOADS_DIR,
    },
    {
      field: "uploads/build-completion",
      directory: BUILD_COMPLETION_UPLOADS_DIR,
    },
    { field: "uploads/.tmp", directory: UPLOAD_TEMP_DIR },
  ];

  for (const entry of directories) {
    try {
      fs.mkdirSync(entry.directory, { recursive: true });
      const probePath = path.join(
        entry.directory,
        `.preflight-probe-${randomBytes(4).toString("hex")}`,
      );
      fs.writeFileSync(probePath, "ok");
      fs.unlinkSync(probePath);
    } catch (error) {
      pushDiagnostic(diagnostics, {
        code: "UPLOAD_DIRECTORY_NOT_WRITABLE",
        summary: sanitizeErrorMessage(error),
        field: entry.field,
      });
    }
  }
};

const runResolverCheck = (
  diagnostics: Diagnostic[],
  code: string,
  field: string,
  resolver: () => void,
): void => {
  try {
    resolver();
  } catch (error) {
    pushDiagnostic(diagnostics, {
      code,
      summary: sanitizeErrorMessage(error),
      field,
    });
  }
};

export const validateAppProductionPreflightSync = (
  env: NodeJS.Dict<string> = process.env,
  options: { checkUploadDirectories?: boolean } = {},
): ValidationResult => {
  const diagnostics: Diagnostic[] = [];

  const nodeEnvRaw = readEnv(env, "NODE_ENV");
  if (nodeEnvRaw === undefined || nodeEnvRaw.trim() === "") {
    pushDiagnostic(diagnostics, {
      code: "ENV_MODE_MISSING",
      summary: "NODE_ENV must be explicitly set to production",
      field: "NODE_ENV",
    });
  } else if (nodeEnvRaw.trim() !== "production") {
    pushDiagnostic(diagnostics, {
      code: "ENV_MODE_UNSUPPORTED",
      summary: "NODE_ENV must be production for this preflight",
      field: "NODE_ENV",
    });
  }

  const databaseUrl = readEnv(env, "DATABASE_URL");
  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    pushDiagnostic(diagnostics, {
      code: "DATABASE_URL_MISSING",
      summary: "DATABASE_URL is required and must be non-empty",
      field: "DATABASE_URL",
    });
  }

  runResolverCheck(diagnostics, "JWT_SECRETS_INVALID", "JWT_ACCESS_SECRET", () =>
    resolveJwtSecretsConfig(env),
  );
  runResolverCheck(
    diagnostics,
    "HANDOVER_CODE_SECRET_INVALID",
    "HANDOVER_CODE_SECRET",
    () => resolveHandoverCodeSecretConfig(env),
  );
  runResolverCheck(
    diagnostics,
    "PAYMENT_CONFIG_INVALID",
    "PAYMENT_PROVIDER",
    () => resolvePaymentRuntimeConfig(env),
  );
  validateRecommendationMlRuntimeMode(env, diagnostics);

  const corsOrigins = parseCorsOrigins(readEnv(env, "CORS_ORIGIN"));
  if (corsOrigins.length === 0) {
    pushDiagnostic(diagnostics, {
      code: "CORS_ORIGIN_MISSING",
      summary:
        "CORS_ORIGIN must list at least one allowed browser origin in production",
      field: "CORS_ORIGIN",
    });
  } else {
    for (const origin of corsOrigins) {
      try {
        const parsed = new URL(origin);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          pushDiagnostic(diagnostics, {
            code: "CORS_ORIGIN_INVALID",
            summary: "Each CORS origin must use http or https",
            field: "CORS_ORIGIN",
          });
          break;
        }
      } catch {
        pushDiagnostic(diagnostics, {
          code: "CORS_ORIGIN_INVALID",
          summary: "Each CORS origin must be a valid URL",
          field: "CORS_ORIGIN",
        });
        break;
      }
    }

    if (
      corsOrigins.length > 0 &&
      corsOrigins.every((origin) => isLocalhostOrigin(origin))
    ) {
      pushDiagnostic(diagnostics, {
        code: "CORS_ORIGIN_LOCALHOST_ONLY",
        summary:
          "CORS_ORIGIN lists only localhost origins; production requires real browser origins",
        field: "CORS_ORIGIN",
      });
    }
  }

  const appPublicBaseUrl = readEnv(env, "APP_PUBLIC_BASE_URL")?.trim() ?? "";
  if (!appPublicBaseUrl) {
    pushDiagnostic(diagnostics, {
      code: "APP_PUBLIC_BASE_URL_MISSING",
      summary:
        "APP_PUBLIC_BASE_URL is required for invitation and password-reset links",
      field: "APP_PUBLIC_BASE_URL",
    });
  } else {
    try {
      const parsed = new URL(appPublicBaseUrl);
      if (parsed.protocol !== "https:") {
        pushDiagnostic(diagnostics, {
          code: "APP_PUBLIC_BASE_URL_NOT_HTTPS",
          summary: "APP_PUBLIC_BASE_URL must use HTTPS in production",
          field: "APP_PUBLIC_BASE_URL",
        });
      }
    } catch {
      pushDiagnostic(diagnostics, {
        code: "APP_PUBLIC_BASE_URL_INVALID",
        summary: "APP_PUBLIC_BASE_URL must be a valid URL",
        field: "APP_PUBLIC_BASE_URL",
      });
    }
  }

  const emailProvider =
    readEnv(env, "EMAIL_PROVIDER")?.trim().toLowerCase() ?? "mock";
  if (emailProvider !== "smtp") {
    pushDiagnostic(diagnostics, {
      code: "EMAIL_PROVIDER_MOCK_IN_PRODUCTION",
      summary: "EMAIL_PROVIDER must be smtp in production",
      field: "EMAIL_PROVIDER",
    });
  } else {
    const smtpErrors = collectSmtpConfigurationErrors(env);
    for (const error of smtpErrors) {
      pushDiagnostic(diagnostics, {
        code: "SMTP_CONFIGURATION_INCOMPLETE",
        summary: error,
        field: "EMAIL_PROVIDER",
      });
    }
  }

  const logPretty = parseStrictBoolean(readEnv(env, "LOG_PRETTY"), true);
  if (logPretty === "invalid") {
    pushDiagnostic(diagnostics, {
      code: "FLAG_BOOLEAN_INVALID",
      summary: "LOG_PRETTY must be unset or one of: 1, true, yes, 0, false, no",
      field: "LOG_PRETTY",
    });
  } else if (logPretty) {
    pushDiagnostic(diagnostics, {
      code: "LOG_PRETTY_ENABLED_IN_PRODUCTION",
      summary: "LOG_PRETTY must be false in production",
      field: "LOG_PRETTY",
    });
  }

  const mockEmailLinks = parseStrictBoolean(
    readEnv(env, "MOCK_EMAIL_LOG_LINKS"),
    false,
  );
  if (mockEmailLinks === "invalid") {
    pushDiagnostic(diagnostics, {
      code: "FLAG_BOOLEAN_INVALID",
      summary:
        "MOCK_EMAIL_LOG_LINKS must be unset or one of: 1, true, yes, 0, false, no",
      field: "MOCK_EMAIL_LOG_LINKS",
    });
  } else if (mockEmailLinks) {
    pushDiagnostic(diagnostics, {
      code: "MOCK_EMAIL_LOG_LINKS_ENABLED",
      summary: "MOCK_EMAIL_LOG_LINKS must be false in production",
      field: "MOCK_EMAIL_LOG_LINKS",
    });
  }

  const aiChatDevMockFallback = parseStrictBoolean(
    readEnv(env, "AI_CHAT_DEV_MOCK_FALLBACK_ENABLED"),
    false,
  );
  if (aiChatDevMockFallback === "invalid") {
    pushDiagnostic(diagnostics, {
      code: "FLAG_BOOLEAN_INVALID",
      summary:
        "AI_CHAT_DEV_MOCK_FALLBACK_ENABLED must be unset or one of: 1, true, yes, 0, false, no",
      field: "AI_CHAT_DEV_MOCK_FALLBACK_ENABLED",
    });
  } else if (aiChatDevMockFallback) {
    pushDiagnostic(diagnostics, {
      code: "AI_CHAT_DEV_MOCK_FALLBACK_ENABLED",
      summary: "AI_CHAT_DEV_MOCK_FALLBACK_ENABLED must be false in production",
      field: "AI_CHAT_DEV_MOCK_FALLBACK_ENABLED",
    });
  }

  const explicitAiChatProvider =
    readEnv(env, "AI_CHAT_PROVIDER")?.trim().toLowerCase() ?? "";
  if (explicitAiChatProvider === "mock") {
    pushDiagnostic(diagnostics, {
      code: "AI_CHAT_PROVIDER_MOCK_IN_PRODUCTION",
      summary: "AI_CHAT_PROVIDER=mock is not allowed in production",
      field: "AI_CHAT_PROVIDER",
    });
  }

  const explicitAiProvider = readEnv(env, "AI_PROVIDER")?.trim().toLowerCase() ?? "";
  if (explicitAiProvider === "mock") {
    pushDiagnostic(diagnostics, {
      code: "AI_PROVIDER_MOCK_IN_PRODUCTION",
      summary: "AI_PROVIDER=mock is not allowed in production",
      field: "AI_PROVIDER",
    });
  }

  validateZoomConfiguration(env, diagnostics);

  if (options.checkUploadDirectories !== false) {
    validateUploadDirectoriesWritable(diagnostics);
  }

  return finalizeValidationResult(diagnostics);
};

export const validateAppProductionPreflight = async (
  options: ValidateAppProductionPreflightOptions = {},
): Promise<ValidationResult> => {
  const env = options.env ?? process.env;
  const syncResult = validateAppProductionPreflightSync(env, {
    checkUploadDirectories: options.checkUploadDirectories,
  });

  if (options.skipDatabase || !options.database) {
    return syncResult;
  }

  const databaseUrl = readEnv(env, "DATABASE_URL");
  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    return syncResult;
  }

  const diagnostics = [...syncResult.diagnostics];
  const connectivity = await options.database.checkConnectivity();
  if (!connectivity.ok) {
    pushDiagnostic(diagnostics, {
      code: connectivity.code ?? "DATABASE_CONNECTIVITY_FAILED",
      summary: connectivity.summary ?? "Database connectivity check failed",
      field: "DATABASE_URL",
    });
  }

  return finalizeValidationResult(diagnostics);
};

export { formatJsonReport };
