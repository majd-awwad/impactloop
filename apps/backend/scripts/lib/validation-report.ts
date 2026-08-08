/**
 * Shared diagnostics, redaction, and CLI report formatting for production validators.
 */

export const MAX_DIAGNOSTICS = 32;

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

export const pushDiagnostic = (
  diagnostics: Diagnostic[],
  diagnostic: Diagnostic,
): void => {
  diagnostics.push(diagnostic);
};

/** Preserve fixed check order; stable secondary sort by code then field. */
export const stabilizeDiagnostics = (diagnostics: Diagnostic[]): Diagnostic[] =>
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

export const boundDiagnostics = (
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

export const finalizeValidationResult = (
  diagnostics: Diagnostic[],
): ValidationResult => {
  const ordered = stabilizeDiagnostics(diagnostics);
  const bounded = boundDiagnostics(ordered);
  return {
    ok: bounded.diagnostics.length === 0,
    diagnostics: bounded.diagnostics,
    truncated: bounded.truncated,
  };
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

export type HumanReportLabels = {
  pass: string;
  fail: string;
};

export const formatHumanReport = (
  result: ValidationResult,
  labels: HumanReportLabels,
): string => {
  const diagnostics = result.diagnostics.map(sanitizeDiagnostic);
  const lines: string[] = [];
  lines.push(result.ok ? labels.pass : labels.fail);
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

export const readEnv = (
  env: NodeJS.Dict<string>,
  key: string,
): string | undefined => {
  const value = env[key];
  return typeof value === "string" ? value : undefined;
};
