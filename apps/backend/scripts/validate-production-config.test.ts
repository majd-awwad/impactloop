import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAppProductionHumanReport,
  formatJsonReport,
  validateAppProductionPreflight,
  validateAppProductionPreflightSync,
} from "./lib/app-production-preflight.js";
import {
  mapExitCode,
  parseCliArgs,
  redactSensitiveText,
  sanitizeErrorMessage,
} from "./lib/validation-report.js";
import { runValidateProductionConfigCli } from "./validate-production-config.js";

const strongAccessSecret = "prod-grade-jwt-access-secret-value-01";
const strongRefreshSecret = "prod-grade-jwt-refresh-secret-value-02";
const strongHandoverSecret = "prod-grade-handover-code-secret-val";

const validProductionEnv = (): NodeJS.Dict<string> => ({
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://validator:secret@127.0.0.1:5432/impactloop_ci",
  JWT_ACCESS_SECRET: strongAccessSecret,
  JWT_REFRESH_SECRET: strongRefreshSecret,
  HANDOVER_CODE_SECRET: strongHandoverSecret,
  CORS_ORIGIN: "https://app.example.com",
  APP_PUBLIC_BASE_URL: "https://app.example.com",
  EMAIL_PROVIDER: "smtp",
  SMTP_HOST: "smtp.example.com",
  SMTP_USER: "smtp-user@example.com",
  SMTP_PASS: "smtp-pass-value-min-length-ok",
  SMTP_FROM: "ImpactLoop <no-reply@example.com>",
  PAYMENT_PROVIDER: "disabled",
  LOG_PRETTY: "false",
  MOCK_EMAIL_LOG_LINKS: "false",
  AI_CHAT_DEV_MOCK_FALLBACK_ENABLED: "false",
  ZOOM_INTEGRATION_MODE: "disabled",
});

const codesOf = (diagnostics: Array<{ code: string }>): string[] =>
  diagnostics.map((diagnostic) => diagnostic.code);

test("valid production application configuration passes sync checks", () => {
  const result = validateAppProductionPreflightSync(validProductionEnv(), {
    checkUploadDirectories: false,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
});

test("missing JWT secrets fail with JWT_SECRETS_INVALID", () => {
  const env = validProductionEnv();
  delete env.JWT_ACCESS_SECRET;
  const result = validateAppProductionPreflightSync(env, {
    checkUploadDirectories: false,
  });
  assert.equal(result.ok, false);
  assert.ok(codesOf(result.diagnostics).includes("JWT_SECRETS_INVALID"));
});

test("mock payment provider fails in production", () => {
  const env = validProductionEnv();
  env.PAYMENT_PROVIDER = "mock";
  env.PAYMENT_PROVIDER_MODE = "LOCAL";
  env.PAYMENT_MOCK_WEBHOOK_SECRET = "prod-grade-webhook-secret-value-001";
  env.PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET = "prod-grade-checkout-secret-value-002";
  const result = validateAppProductionPreflightSync(env, {
    checkUploadDirectories: false,
  });
  assert.ok(codesOf(result.diagnostics).includes("PAYMENT_CONFIG_INVALID"));
});

test("missing CORS origins fail", () => {
  const env = validProductionEnv();
  delete env.CORS_ORIGIN;
  const result = validateAppProductionPreflightSync(env, {
    checkUploadDirectories: false,
  });
  assert.ok(codesOf(result.diagnostics).includes("CORS_ORIGIN_MISSING"));
});

test("localhost-only CORS origins fail in production", () => {
  const env = validProductionEnv();
  env.CORS_ORIGIN = "http://localhost:3000,http://127.0.0.1:5173";
  const result = validateAppProductionPreflightSync(env, {
    checkUploadDirectories: false,
  });
  assert.ok(codesOf(result.diagnostics).includes("CORS_ORIGIN_LOCALHOST_ONLY"));
});

test("mock email provider fails in production", () => {
  const env = validProductionEnv();
  env.EMAIL_PROVIDER = "mock";
  const result = validateAppProductionPreflightSync(env, {
    checkUploadDirectories: false,
  });
  assert.ok(
    codesOf(result.diagnostics).includes("EMAIL_PROVIDER_MOCK_IN_PRODUCTION"),
  );
});

test("APP_PUBLIC_BASE_URL must be HTTPS in production", () => {
  const env = validProductionEnv();
  env.APP_PUBLIC_BASE_URL = "http://app.example.com";
  const result = validateAppProductionPreflightSync(env, {
    checkUploadDirectories: false,
  });
  assert.ok(
    codesOf(result.diagnostics).includes("APP_PUBLIC_BASE_URL_NOT_HTTPS"),
  );
});

test("LOG_PRETTY must be disabled in production", () => {
  const env = validProductionEnv();
  env.LOG_PRETTY = "true";
  const result = validateAppProductionPreflightSync(env, {
    checkUploadDirectories: false,
  });
  assert.ok(
    codesOf(result.diagnostics).includes("LOG_PRETTY_ENABLED_IN_PRODUCTION"),
  );
});

test("ML_LOCAL runtime mode is rejected outside development/test", () => {
  const env = validProductionEnv();
  env.RECOMMENDATION_ML_RUNTIME_MODE = "ML_LOCAL";
  const result = validateAppProductionPreflightSync(env, {
    checkUploadDirectories: false,
  });
  assert.ok(
    codesOf(result.diagnostics).includes("RECOMMENDATION_ML_RUNTIME_INVALID"),
  );
});

test("human and JSON formatting are secret-safe", () => {
  const env = validProductionEnv();
  delete env.JWT_ACCESS_SECRET;
  const result = validateAppProductionPreflightSync(env, {
    checkUploadDirectories: false,
  });
  const human = formatAppProductionHumanReport(result);
  const json = formatJsonReport(result);
  assert.match(human, /FAIL — Production application configuration is unsafe/);
  assert.match(human, /JWT_SECRETS_INVALID/);
  const parsed = JSON.parse(json) as {
    ok: boolean;
    diagnostics: Array<{ code: string }>;
  };
  assert.equal(parsed.ok, false);
  assert.ok(parsed.diagnostics.some((d) => d.code === "JWT_SECRETS_INVALID"));
});

test("async validation appends injected DB connectivity diagnostics", async () => {
  const result = await validateAppProductionPreflight({
    env: validProductionEnv(),
    checkUploadDirectories: false,
    database: {
      checkConnectivity: async () => ({
        ok: false,
        code: "DATABASE_CONNECTIVITY_FAILED",
        summary: sanitizeErrorMessage(
          new Error(
            "timeout talking to postgresql://alice:s3cret@127.0.0.1:5432/impactloop",
          ),
        ),
      }),
    },
  });
  assert.equal(result.ok, false);
  const human = formatAppProductionHumanReport(result);
  assert.equal(human.includes("s3cret"), false);
  assert.equal(human.includes("postgresql://"), false);
});

test("CLI unknown argument returns exit code 2", async () => {
  const priorError = console.error;
  console.error = () => {};
  try {
    const code = await runValidateProductionConfigCli(["--nope"], {
      loadDotenv: false,
      env: validProductionEnv(),
      checkUploadDirectories: false,
      databaseFactory: () => ({
        database: {
          checkConnectivity: async () => ({ ok: true }),
        },
        cleanup: async () => {},
      }),
    });
    assert.equal(code, 2);
  } finally {
    console.error = priorError;
  }
});

test("CLI reports config failure with exit code 1", async () => {
  const priorError = console.error;
  console.error = () => {};
  try {
    const env = validProductionEnv();
    env.PAYMENT_PROVIDER = "mock";
    const code = await runValidateProductionConfigCli([], {
      loadDotenv: false,
      env,
      checkUploadDirectories: false,
      databaseFactory: () => ({
        database: {
          checkConnectivity: async () => ({ ok: true }),
        },
        cleanup: async () => {},
      }),
    });
    assert.equal(code, 1);
  } finally {
    console.error = priorError;
  }
});

test("exit-code mapping distinguishes success, config failure, and invocation failure", () => {
  assert.equal(mapExitCode({ validationOk: true }), 0);
  assert.equal(mapExitCode({ validationOk: false }), 1);
  assert.equal(mapExitCode({ invocationFailed: true }), 2);
  assert.equal(mapExitCode({ internalError: true }), 2);
});

test("secret redaction covers key/value secrets outside URLs", () => {
  const raw =
    "startup failed DATABASE_URL=postgresql://u:p@h/db JWT_ACCESS_SECRET=super-secret-value";
  const redacted = redactSensitiveText(raw);
  assert.equal(redacted.includes("super-secret-value"), false);
  assert.equal(redacted.includes("postgresql://u:p@h/db"), false);
});

test("unknown CLI arguments fail closed and retain --json mode", () => {
  const parsed = parseCliArgs(["--json", "--unexpected"]);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.json, true);
    assert.equal(parsed.diagnostics[0]?.code, "CLI_UNKNOWN_ARGUMENT");
  }
});
