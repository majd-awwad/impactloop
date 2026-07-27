/**
 * RP-00.4 — Release A production configuration validation (pure).
 * Does not import env.ts, prisma.ts, server.ts, the outbox worker, or the
 * scorer-version module at top level (module init can throw on invalid env).
 */

export const MAX_DIAGNOSTICS = 32;

/** Bounds mirrored from env.ts / docs/recommendation/outbox.md (strict; no clamp). */
export const OUTBOX_POLL_INTERVAL_MS_BOUNDS = { min: 250, max: 60_000 } as const;
export const OUTBOX_BATCH_SIZE_BOUNDS = { min: 1, max: 100 } as const;
export const OUTBOX_MAX_ATTEMPTS_BOUNDS = { min: 1, max: 20 } as const;
export const OUTBOX_LEASE_MS_BOUNDS = { min: 1_000, max: 300_000 } as const;

export const DB_CONNECTION_TIMEOUT_MS = 5_000;
export const DB_STATEMENT_TIMEOUT_MS = 5_000;
export const DB_QUERY_TIMEOUT_MS = 5_000;

export type Diagnostic = {
  code: string;
  summary: string;
  field?: string;
};

export type ValidationResult = {
  ok: boolean;
  diagnostics: Diagnostic[];
  truncated: boolean;
};

export type CliParseResult =
  | { ok: true; json: boolean }
  | { ok: false; json: boolean; diagnostics: Diagnostic[] };

export type DbProbeResult = {
  ok: boolean;
  code?: string;
  summary?: string;
};

export type DatabaseContractCheck = {
  checkConnectivity: () => Promise<DbProbeResult>;
  checkOutboxContract: () => Promise<DbProbeResult>;
  checkEvidenceEligibilityContract: () => Promise<DbProbeResult>;
};

export type ScorerVersionParser = (value: string | undefined) => string;

export type ValidateProductionConfigOptions = {
  env?: NodeJS.Dict<string>;
  /** When omitted, DB probes are skipped (pure config validation). */
  database?: DatabaseContractCheck;
  skipDatabase?: boolean;
  /** Authoritative parser; loaded lazily by CLI when omitted. */
  parseScorerVersion?: ScorerVersionParser;
};

const TRUE_VALUES = new Set(["1", "true", "yes"]);
const FALSE_VALUES = new Set(["0", "false", "no"]);

/** Sensitive configuration key names (also used for KEY=value redaction). */
const SENSITIVE_KEY_PATTERN =
  /^(?:DATABASE_URL|SMTP_PASS|SMTP_USER|GEMINI_API_KEY|JWT_[A-Z0-9_]+)$|(?:SECRET|PASSWORD|TOKEN|CONNECTION)/i;

const CONNECTION_STRING_PATTERN =
  /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|https?):\/\/[^\s"'`]+/gi;

const USERINFO_IN_URL_PATTERN = /:\/\/[^/@\s]+:[^/@\s]+@/g;

const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b((?:DATABASE_URL|SMTP_PASS|SMTP_USER|GEMINI_API_KEY|JWT_[A-Z0-9_]+|[A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|CONNECTION)[A-Z0-9_]*)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;

const JWT_LIKE_PATTERN =
  /\b(?:Bearer\s+)?[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

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
          // Neutralize so module-level RECOMMENDATION_SCORER_VERSION init cannot throw.
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

export const redactSensitiveText = (value: string): string => {
  let redacted = value.replace(SENSITIVE_ASSIGNMENT_PATTERN, "$1[REDACTED]");
  redacted = redacted.replace(CONNECTION_STRING_PATTERN, "[REDACTED]");
  redacted = redacted.replace(USERINFO_IN_URL_PATTERN, "://[REDACTED]@");
  redacted = redacted.replace(JWT_LIKE_PATTERN, "[REDACTED]");
  return redacted;
};

export const isSensitiveEnvKey = (key: string): boolean =>
  SENSITIVE_KEY_PATTERN.test(key);

export const sanitizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const parts = [error.message];
    let current: unknown = error.cause;
    let depth = 0;
    while (current instanceof Error && depth < 5) {
      parts.push(current.message);
      current = current.cause;
      depth += 1;
    }
    return redactSensitiveText(parts.join(" | "));
  }
  return redactSensitiveText(String(error));
};

const sanitizeDiagnostic = (diagnostic: Diagnostic): Diagnostic => {
  const sanitized: Diagnostic = {
    code: diagnostic.code,
    summary: redactSensitiveText(diagnostic.summary),
  };
  if (diagnostic.field !== undefined) {
    sanitized.field = redactSensitiveText(diagnostic.field);
  }
  return sanitized;
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

const pushDiagnostic = (
  diagnostics: Diagnostic[],
  diagnostic: Diagnostic,
): void => {
  diagnostics.push(diagnostic);
};

/** Preserve fixed check order; stable secondary sort by code then field. */
const stabilizeDiagnostics = (diagnostics: Diagnostic[]): Diagnostic[] =>
  diagnostics
    .map((diagnostic, index) => ({ diagnostic, index }))
    .sort((left, right) => {
      if (left.diagnostic.code === right.diagnostic.code) {
        const fieldCmp = (left.diagnostic.field ?? "").localeCompare(
          right.diagnostic.field ?? "",
        );
        if (fieldCmp !== 0) {
          return fieldCmp;
        }
      }
      return left.index - right.index;
    })
    .map(({ diagnostic }) => diagnostic);

const boundDiagnostics = (
  diagnostics: Diagnostic[],
): { diagnostics: Diagnostic[]; truncated: boolean } => {
  if (diagnostics.length <= MAX_DIAGNOSTICS) {
    return { diagnostics, truncated: false };
  }
  const kept = diagnostics.slice(0, MAX_DIAGNOSTICS - 1);
  kept.push({
    code: "DIAGNOSTICS_TRUNCATED",
    summary: `Diagnostic count exceeded ${MAX_DIAGNOSTICS}; remaining findings omitted`,
  });
  return { diagnostics: kept, truncated: true };
};

export const parseCliArgs = (argv: string[]): CliParseResult => {
  const json = argv.includes("--json");
  const unknownArgs = argv.filter((arg) => arg !== "--json");
  if (unknownArgs.length > 0) {
    return {
      ok: false,
      json,
      diagnostics: [
        {
          code: "CLI_UNKNOWN_ARGUMENT",
          summary: "Unknown CLI argument",
        },
      ],
    };
  }
  return { ok: true, json };
};

export const mapExitCode = (input: {
  invocationFailed?: boolean;
  internalError?: boolean;
  validationOk?: boolean;
}): number => {
  if (input.invocationFailed || input.internalError) {
    return 2;
  }
  if (input.validationOk === false) {
    return 1;
  }
  return 0;
};

export const formatHumanReport = (result: ValidationResult): string => {
  const diagnostics = result.diagnostics.map(sanitizeDiagnostic);
  const lines: string[] = [];
  lines.push(
    result.ok
      ? "PASS — Release A production configuration is safe"
      : "FAIL — Release A production configuration is unsafe",
  );
  if (diagnostics.length === 0) {
    lines.push("No diagnostics.");
  } else {
    lines.push(`Diagnostics (${diagnostics.length}):`);
    for (const diagnostic of diagnostics) {
      const field = diagnostic.field ? ` [${diagnostic.field}]` : "";
      lines.push(`- ${diagnostic.code}${field}: ${diagnostic.summary}`);
    }
  }
  if (result.truncated) {
    lines.push("Note: diagnostic list was truncated.");
  }
  return lines.join("\n");
};

export const formatJsonReport = (result: ValidationResult): string => {
  const diagnostics = result.diagnostics.map(sanitizeDiagnostic);
  return JSON.stringify(
    {
      ok: result.ok,
      truncated: result.truncated,
      diagnostics: diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        summary: diagnostic.summary,
        ...(diagnostic.field ? { field: diagnostic.field } : {}),
      })),
    },
    null,
    2,
  );
};

const readEnv = (
  env: NodeJS.Dict<string>,
  key: string,
): string | undefined => {
  const value = env[key];
  return typeof value === "string" ? value : undefined;
};

export const validateProductionConfigSync = (
  env: NodeJS.Dict<string> = process.env,
  deps: { parseScorerVersion: ScorerVersionParser },
): ValidationResult => {
  const diagnostics: Diagnostic[] = [];
  const parseScorerVersion = deps.parseScorerVersion;

  // 1. Environment mode (explicit production required)
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
      summary: `NODE_ENV must be production for Release A deployment; received a non-production value`,
      field: "NODE_ENV",
    });
  }

  // 2. DATABASE_URL presence (never print value)
  const databaseUrl = readEnv(env, "DATABASE_URL");
  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    pushDiagnostic(diagnostics, {
      code: "DATABASE_URL_MISSING",
      summary: "DATABASE_URL is required and must be non-empty",
      field: "DATABASE_URL",
    });
  }

  // 3. Deterministic champion — Release A accepts only legacy-v1
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

  // 4. ML serving / shadow flags
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

  // Artifact paths are optional for Release A — no existence checks.

  // 5. Outbox worker configuration
  const workerEnabled = parseStrictBoolean(
    readEnv(env, "RECOMMENDATION_OUTBOX_WORKER_ENABLED"),
    false,
  );
  const requiredDefault =
    (nodeEnvRaw?.trim() ?? "development") === "production";
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

  const ordered = stabilizeDiagnostics(diagnostics);
  const bounded = boundDiagnostics(ordered);
  return {
    ok: bounded.diagnostics.length === 0,
    diagnostics: bounded.diagnostics,
    truncated: bounded.truncated,
  };
};

export const validateProductionConfig = async (
  options: ValidateProductionConfigOptions = {},
): Promise<ValidationResult> => {
  const env = options.env ?? process.env;
  const parseScorerVersion =
    options.parseScorerVersion ??
    (await loadAuthoritativeScorerVersionParser());
  const syncResult = validateProductionConfigSync(env, { parseScorerVersion });

  if (options.skipDatabase || !options.database) {
    return syncResult;
  }

  // Skip live DB probes when DATABASE_URL is already known missing.
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

  const ordered = stabilizeDiagnostics(diagnostics);
  const bounded = boundDiagnostics(ordered);
  return {
    ok: bounded.diagnostics.length === 0,
    diagnostics: bounded.diagnostics,
    truncated: bounded.truncated,
  };
};
