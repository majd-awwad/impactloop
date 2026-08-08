/**
 * RP-00.4 — Recommendation Release A configuration validation (pure).
 * Does not import env.ts, prisma.ts, server.ts, the outbox worker, or the
 * scorer-version module at top level (module init can throw on invalid env).
 */

import {
  finalizeValidationResult,
  formatHumanReport,
  formatJsonReport,
  pushDiagnostic,
  readEnv,
  type Diagnostic,
  type ValidationResult,
} from "./validation-report.js";

/** Bounds mirrored from env.ts / docs/recommendation/outbox.md (strict; no clamp). */
export const OUTBOX_POLL_INTERVAL_MS_BOUNDS = { min: 250, max: 60_000 } as const;
export const OUTBOX_BATCH_SIZE_BOUNDS = { min: 1, max: 100 } as const;
export const OUTBOX_MAX_ATTEMPTS_BOUNDS = { min: 1, max: 20 } as const;
export const OUTBOX_LEASE_MS_BOUNDS = { min: 1_000, max: 300_000 } as const;

export type ScorerVersionParser = (value: string | undefined) => string;

export type DatabaseContractCheck = {
  checkConnectivity: () => Promise<{
    ok: boolean;
    code?: string;
    summary?: string;
  }>;
  checkOutboxContract: () => Promise<{
    ok: boolean;
    code?: string;
    summary?: string;
  }>;
  checkEvidenceEligibilityContract: () => Promise<{
    ok: boolean;
    code?: string;
    summary?: string;
  }>;
};

export type ValidateRecommendationReleaseConfigOptions = {
  env?: NodeJS.Dict<string>;
  /** When omitted, DB probes are skipped (pure config validation). */
  database?: DatabaseContractCheck;
  skipDatabase?: boolean;
  /** Authoritative parser; loaded lazily by CLI when omitted. */
  parseScorerVersion?: ScorerVersionParser;
};

const TRUE_VALUES = new Set(["1", "true", "yes"]);
const FALSE_VALUES = new Set(["0", "false", "no"]);

let cachedScorerParser: ScorerVersionParser | undefined;
let scorerParserLoad: Promise<ScorerVersionParser> | undefined;

/**
 * Lazily load the repository-authoritative scorer parser without letting
 * recommendation-scoring-version.ts module init throw on the real process env.
 */
export const loadAuthoritativeScorerVersionParser =
  async (): Promise<ScorerVersionParser> => {
    if (cachedScorerParser) {
      return cachedScorerParser;
    }
    if (!scorerParserLoad) {
      scorerParserLoad = (async () => {
        const prior = process.env.RECOMMENDATION_SCORER_VERSION;
        const hadOwn = Object.prototype.hasOwnProperty.call(
          process.env,
          "RECOMMENDATION_SCORER_VERSION",
        );
        try {
          delete process.env.RECOMMENDATION_SCORER_VERSION;
          const mod = await import(
            "../../src/config/recommendation-scoring-version.js"
          );
          cachedScorerParser = mod.parseRecommendationScorerVersion;
          return cachedScorerParser;
        } finally {
          if (hadOwn && prior !== undefined) {
            process.env.RECOMMENDATION_SCORER_VERSION = prior;
          } else {
            delete process.env.RECOMMENDATION_SCORER_VERSION;
          }
        }
      })();
    }
    return scorerParserLoad;
  };

type StrictBooleanResult =
  | { ok: true; value: boolean }
  | { ok: false; invalid: true };

export const parseStrictBoolean = (
  value: string | undefined,
  fallback: boolean,
): StrictBooleanResult => {
  if (value === undefined) {
    return { ok: true, value: fallback };
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "") {
    return { ok: true, value: fallback };
  }
  if (TRUE_VALUES.has(normalized)) {
    return { ok: true, value: true };
  }
  if (FALSE_VALUES.has(normalized)) {
    return { ok: true, value: false };
  }
  return { ok: false, invalid: true };
};

type StrictIntegerResult =
  | { ok: true; value: number | undefined }
  | { ok: false; invalid: true };

export const parseStrictBoundedInteger = (
  value: string | undefined,
  minimum: number,
  maximum: number,
): StrictIntegerResult => {
  if (value === undefined || value.trim() === "") {
    return { ok: true, value: undefined };
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    return { ok: false, invalid: true };
  }
  return { ok: true, value: parsed };
};

export const RECOMMENDATION_RELEASE_HUMAN_REPORT_LABELS = {
  pass: "PASS — Recommendation Release A configuration is safe",
  fail: "FAIL — Recommendation Release A configuration is unsafe",
} as const;

export const formatRecommendationReleaseHumanReport = (
  result: ValidationResult,
): string =>
  formatHumanReport(result, RECOMMENDATION_RELEASE_HUMAN_REPORT_LABELS);

export const validateRecommendationReleaseConfigSync = (
  env: NodeJS.Dict<string> = process.env,
  deps: { parseScorerVersion: ScorerVersionParser },
): ValidationResult => {
  const diagnostics: Diagnostic[] = [];
  const parseScorerVersion = deps.parseScorerVersion;

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
      summary:
        "NODE_ENV must be production for Recommendation Release A deployment",
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

  const scorerRaw = readEnv(env, "RECOMMENDATION_SCORER_VERSION");
  try {
    const parsed = parseScorerVersion(scorerRaw);
    if (parsed !== "legacy-v1") {
      pushDiagnostic(diagnostics, {
        code: "CHAMPION_UNSUPPORTED_FOR_RELEASE_A",
        summary:
          "Release A accepts only legacy-v1; canonical-taxonomy-v3 remains opt-in in runtime code but is not accepted by this deploy gate",
        field: "RECOMMENDATION_SCORER_VERSION",
      });
    }
  } catch {
    pushDiagnostic(diagnostics, {
      code: "CHAMPION_UNKNOWN",
      summary: "RECOMMENDATION_SCORER_VERSION is unknown or invalid",
      field: "RECOMMENDATION_SCORER_VERSION",
    });
  }

  const materialServing = parseStrictBoolean(
    readEnv(env, "RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED"),
    false,
  );
  const projectServing = parseStrictBoolean(
    readEnv(env, "RECOMMENDATION_ML_PROJECT_SERVING_ENABLED"),
    false,
  );
  const shadow = parseStrictBoolean(
    readEnv(env, "RECOMMENDATION_ML_SHADOW_ENABLED"),
    false,
  );

  if (!materialServing.ok) {
    pushDiagnostic(diagnostics, {
      code: "FLAG_BOOLEAN_INVALID",
      summary:
        "RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED must be unset or one of: 1, true, yes, 0, false, no",
      field: "RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED",
    });
  }
  if (!projectServing.ok) {
    pushDiagnostic(diagnostics, {
      code: "FLAG_BOOLEAN_INVALID",
      summary:
        "RECOMMENDATION_ML_PROJECT_SERVING_ENABLED must be unset or one of: 1, true, yes, 0, false, no",
      field: "RECOMMENDATION_ML_PROJECT_SERVING_ENABLED",
    });
  }
  if (!shadow.ok) {
    pushDiagnostic(diagnostics, {
      code: "FLAG_BOOLEAN_INVALID",
      summary:
        "RECOMMENDATION_ML_SHADOW_ENABLED must be unset or one of: 1, true, yes, 0, false, no",
      field: "RECOMMENDATION_ML_SHADOW_ENABLED",
    });
  }

  const materialEnabled = materialServing.ok && materialServing.value;
  const projectEnabled = projectServing.ok && projectServing.value;
  const shadowEnabled = shadow.ok && shadow.value;

  if (materialEnabled) {
    pushDiagnostic(diagnostics, {
      code: "ML_MATERIAL_SERVING_ENABLED",
      summary: "ML material serving must be disabled for Release A",
      field: "RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED",
    });
  }
  if (projectEnabled) {
    pushDiagnostic(diagnostics, {
      code: "ML_PROJECT_SERVING_ENABLED",
      summary: "ML project serving must be disabled for Release A",
      field: "RECOMMENDATION_ML_PROJECT_SERVING_ENABLED",
    });
  }
  if (shadowEnabled && (materialEnabled || projectEnabled)) {
    pushDiagnostic(diagnostics, {
      code: "ML_SHADOW_WITH_SERVING_UNSAFE",
      summary:
        "Shadow must not be combined with ML serving flags for Release A",
      field: "RECOMMENDATION_ML_SHADOW_ENABLED",
    });
  }

  const workerEnabled = parseStrictBoolean(
    readEnv(env, "RECOMMENDATION_OUTBOX_WORKER_ENABLED"),
    false,
  );
  const requiredDefault = (nodeEnvRaw?.trim() ?? "development") === "production";
  const workerRequired = parseStrictBoolean(
    readEnv(env, "RECOMMENDATION_OUTBOX_WORKER_REQUIRED"),
    requiredDefault,
  );

  if (!workerEnabled.ok) {
    pushDiagnostic(diagnostics, {
      code: "FLAG_BOOLEAN_INVALID",
      summary:
        "RECOMMENDATION_OUTBOX_WORKER_ENABLED must be unset or one of: 1, true, yes, 0, false, no",
      field: "RECOMMENDATION_OUTBOX_WORKER_ENABLED",
    });
  }
  if (!workerRequired.ok) {
    pushDiagnostic(diagnostics, {
      code: "FLAG_BOOLEAN_INVALID",
      summary:
        "RECOMMENDATION_OUTBOX_WORKER_REQUIRED must be unset or one of: 1, true, yes, 0, false, no",
      field: "RECOMMENDATION_OUTBOX_WORKER_REQUIRED",
    });
  }

  if (
    workerEnabled.ok &&
    workerRequired.ok &&
    workerRequired.value &&
    !workerEnabled.value
  ) {
    pushDiagnostic(diagnostics, {
      code: "OUTBOX_WORKER_REQUIRED_BUT_DISABLED",
      summary:
        "Outbox worker is required but disabled; readiness would fail for this deployment",
      field: "RECOMMENDATION_OUTBOX_WORKER_ENABLED",
    });
  }

  const poll = parseStrictBoundedInteger(
    readEnv(env, "RECOMMENDATION_OUTBOX_POLL_INTERVAL_MS"),
    OUTBOX_POLL_INTERVAL_MS_BOUNDS.min,
    OUTBOX_POLL_INTERVAL_MS_BOUNDS.max,
  );
  if (!poll.ok) {
    pushDiagnostic(diagnostics, {
      code: "OUTBOX_POLL_INTERVAL_INVALID",
      summary: `RECOMMENDATION_OUTBOX_POLL_INTERVAL_MS must be an integer between ${OUTBOX_POLL_INTERVAL_MS_BOUNDS.min} and ${OUTBOX_POLL_INTERVAL_MS_BOUNDS.max}`,
      field: "RECOMMENDATION_OUTBOX_POLL_INTERVAL_MS",
    });
  }

  const batch = parseStrictBoundedInteger(
    readEnv(env, "RECOMMENDATION_OUTBOX_BATCH_SIZE"),
    OUTBOX_BATCH_SIZE_BOUNDS.min,
    OUTBOX_BATCH_SIZE_BOUNDS.max,
  );
  if (!batch.ok) {
    pushDiagnostic(diagnostics, {
      code: "OUTBOX_BATCH_SIZE_INVALID",
      summary: `RECOMMENDATION_OUTBOX_BATCH_SIZE must be an integer between ${OUTBOX_BATCH_SIZE_BOUNDS.min} and ${OUTBOX_BATCH_SIZE_BOUNDS.max}`,
      field: "RECOMMENDATION_OUTBOX_BATCH_SIZE",
    });
  }

  const attempts = parseStrictBoundedInteger(
    readEnv(env, "RECOMMENDATION_OUTBOX_MAX_ATTEMPTS"),
    OUTBOX_MAX_ATTEMPTS_BOUNDS.min,
    OUTBOX_MAX_ATTEMPTS_BOUNDS.max,
  );
  if (!attempts.ok) {
    pushDiagnostic(diagnostics, {
      code: "OUTBOX_MAX_ATTEMPTS_INVALID",
      summary: `RECOMMENDATION_OUTBOX_MAX_ATTEMPTS must be an integer between ${OUTBOX_MAX_ATTEMPTS_BOUNDS.min} and ${OUTBOX_MAX_ATTEMPTS_BOUNDS.max}`,
      field: "RECOMMENDATION_OUTBOX_MAX_ATTEMPTS",
    });
  }

  const lease = parseStrictBoundedInteger(
    readEnv(env, "RECOMMENDATION_OUTBOX_LEASE_MS"),
    OUTBOX_LEASE_MS_BOUNDS.min,
    OUTBOX_LEASE_MS_BOUNDS.max,
  );
  if (!lease.ok) {
    pushDiagnostic(diagnostics, {
      code: "OUTBOX_LEASE_MS_INVALID",
      summary: `RECOMMENDATION_OUTBOX_LEASE_MS must be an integer between ${OUTBOX_LEASE_MS_BOUNDS.min} and ${OUTBOX_LEASE_MS_BOUNDS.max}`,
      field: "RECOMMENDATION_OUTBOX_LEASE_MS",
    });
  }

  return finalizeValidationResult(diagnostics);
};

export const validateRecommendationReleaseConfig = async (
  options: ValidateRecommendationReleaseConfigOptions = {},
): Promise<ValidationResult> => {
  const env = options.env ?? process.env;
  const parseScorerVersion =
    options.parseScorerVersion ??
    (await loadAuthoritativeScorerVersionParser());
  const syncResult = validateRecommendationReleaseConfigSync(env, {
    parseScorerVersion,
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
  } else {
    const outbox = await options.database.checkOutboxContract();
    if (!outbox.ok) {
      pushDiagnostic(diagnostics, {
        code: outbox.code ?? "DATABASE_OUTBOX_CONTRACT_MISSING",
        summary:
          outbox.summary ??
          "recommendation_event_outbox table is missing or not queryable",
      });
    }

    const eligibility =
      await options.database.checkEvidenceEligibilityContract();
    if (!eligibility.ok) {
      pushDiagnostic(diagnostics, {
        code:
          eligibility.code ?? "DATABASE_EVIDENCE_ELIGIBILITY_CONTRACT_MISSING",
        summary:
          eligibility.summary ??
          "users.recommendation_evidence_eligibility column is missing or not queryable",
      });
    }
  }

  return finalizeValidationResult(diagnostics);
};

export { formatJsonReport };
