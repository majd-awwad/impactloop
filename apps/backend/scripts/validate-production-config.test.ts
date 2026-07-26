import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  formatHumanReport,
  formatJsonReport,
  loadAuthoritativeScorerVersionParser,
  mapExitCode,
  MAX_DIAGNOSTICS,
  parseCliArgs,
  redactSensitiveText,
  sanitizeErrorMessage,
  validateProductionConfig,
  validateProductionConfigSync,
  type DatabaseContractCheck,
  type Diagnostic,
  type ScorerVersionParser,
} from "./lib/production-config-validation.js";
import {
  createDatabaseContractCheck,
  runValidateProductionConfigCli,
} from "./validate-production-config.js";

const parseScorerVersion: ScorerVersionParser =
  await loadAuthoritativeScorerVersionParser();

const validateSync = (env: NodeJS.Dict<string>) =>
  validateProductionConfigSync(env, { parseScorerVersion });

const validReleaseAEnv = (): NodeJS.Dict<string> => ({
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://validator:secret@127.0.0.1:5432/impactloop_ci",
  RECOMMENDATION_SCORER_VERSION: "legacy-v1",
  RECOMMENDATION_ML_SHADOW_ENABLED: "false",
  RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED: "false",
  RECOMMENDATION_ML_PROJECT_SERVING_ENABLED: "false",
  RECOMMENDATION_OUTBOX_WORKER_ENABLED: "true",
  RECOMMENDATION_OUTBOX_WORKER_REQUIRED: "true",
  RECOMMENDATION_OUTBOX_POLL_INTERVAL_MS: "2000",
  RECOMMENDATION_OUTBOX_BATCH_SIZE: "10",
  RECOMMENDATION_OUTBOX_MAX_ATTEMPTS: "5",
  RECOMMENDATION_OUTBOX_LEASE_MS: "30000",
});

const codesOf = (diagnostics: Diagnostic[]): string[] =>
  diagnostics.map((diagnostic) => diagnostic.code);

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) &&
  process.env.IMPACTLOOP_CI_DATABASE === "1";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliModuleHref = pathToFileURL(
  path.join(backendRoot, "scripts/validate-production-config.ts"),
).href;

/**
 * Fresh Node process that imports the real CLI entry and calls
 * runValidateProductionConfigCli({ loadDotenv: false, env: process.env }).
 * Does not use any production dotenv bypass.
 */
const runValidatorChild = (
  args: string[],
  envOverrides: NodeJS.Dict<string>,
): Promise<{ code: number | null; stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "rp-00.4-validator-"));
    const harnessPath = path.join(tempDir, "harness.mts");
    writeFileSync(
      harnessPath,
      `
import { runValidateProductionConfigCli } from ${JSON.stringify(cliModuleHref)};

const args = JSON.parse(process.env.VALIDATOR_TEST_ARGV ?? "[]");

void runValidateProductionConfigCli(args, {
  loadDotenv: false,
  env: process.env,
}).then((exitCode) => {
  process.exit(exitCode);
});
`,
      "utf8",
    );

    const child = spawn(process.execPath, ["--import", "tsx", harnessPath], {
      cwd: backendRoot,
      env: {
        ...process.env,
        ...envOverrides,
        VALIDATOR_TEST_ARGV: JSON.stringify(args),
      },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      rmSync(tempDir, { recursive: true, force: true });
      reject(error);
    });
    child.on("close", (code) => {
      rmSync(tempDir, { recursive: true, force: true });
      resolve({ code, stdout, stderr });
    });
  });

test("valid Release A production configuration passes sync checks", () => {
  const result = validateSync(validReleaseAEnv());
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
});

test("unset NODE_ENV fails with ENV_MODE_MISSING", () => {
  const env = validReleaseAEnv();
  delete env.NODE_ENV;
  const result = validateSync(env);
  assert.equal(result.ok, false);
  assert.ok(codesOf(result.diagnostics).includes("ENV_MODE_MISSING"));
});

test("unsupported NODE_ENV fails with ENV_MODE_UNSUPPORTED", () => {
  const env = validReleaseAEnv();
  env.NODE_ENV = "development";
  const result = validateSync(env);
  assert.ok(codesOf(result.diagnostics).includes("ENV_MODE_UNSUPPORTED"));
});

test("unknown NODE_ENV fails with ENV_MODE_UNSUPPORTED", () => {
  const env = validReleaseAEnv();
  env.NODE_ENV = "staging";
  const result = validateSync(env);
  assert.ok(codesOf(result.diagnostics).includes("ENV_MODE_UNSUPPORTED"));
});

test("accepted legacy-v1 champion passes; unset defaults to legacy-v1", () => {
  const explicit = validateSync(validReleaseAEnv());
  assert.equal(explicit.ok, true);

  const env = validReleaseAEnv();
  delete env.RECOMMENDATION_SCORER_VERSION;
  const unset = validateSync(env);
  assert.equal(unset.ok, true);
});

test("unsupported and unknown champions fail", () => {
  const canonical = validReleaseAEnv();
  canonical.RECOMMENDATION_SCORER_VERSION = "canonical-taxonomy-v3";
  assert.ok(
    codesOf(validateSync(canonical).diagnostics).includes(
      "CHAMPION_UNSUPPORTED_FOR_RELEASE_A",
    ),
  );

  const normalized = validReleaseAEnv();
  normalized.RECOMMENDATION_SCORER_VERSION = "normalized-interests-v2";
  assert.ok(
    codesOf(validateSync(normalized).diagnostics).includes(
      "CHAMPION_UNSUPPORTED_FOR_RELEASE_A",
    ),
  );

  const unknown = validReleaseAEnv();
  unknown.RECOMMENDATION_SCORER_VERSION = "not-a-champion";
  assert.ok(
    codesOf(validateSync(unknown).diagnostics).includes("CHAMPION_UNKNOWN"),
  );
});

test("canonical taxonomy is not newly required", () => {
  const env = validReleaseAEnv();
  delete env.RECOMMENDATION_SCORER_VERSION;
  const result = validateSync(env);
  assert.equal(result.ok, true);
  assert.equal(
    codesOf(result.diagnostics).includes("CHAMPION_UNSUPPORTED_FOR_RELEASE_A"),
    false,
  );
});

test("ML material and project serving enabled fail", () => {
  const material = validReleaseAEnv();
  material.RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED = "true";
  assert.ok(
    codesOf(validateSync(material).diagnostics).includes(
      "ML_MATERIAL_SERVING_ENABLED",
    ),
  );

  const project = validReleaseAEnv();
  project.RECOMMENDATION_ML_PROJECT_SERVING_ENABLED = "yes";
  assert.ok(
    codesOf(validateSync(project).diagnostics).includes(
      "ML_PROJECT_SERVING_ENABLED",
    ),
  );
});

test("unsafe combined serving and shadow fails", () => {
  const env = validReleaseAEnv();
  env.RECOMMENDATION_ML_SHADOW_ENABLED = "true";
  env.RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED = "true";
  const codes = codesOf(validateSync(env).diagnostics);
  assert.ok(codes.includes("ML_MATERIAL_SERVING_ENABLED"));
  assert.ok(codes.includes("ML_SHADOW_WITH_SERVING_UNSAFE"));
});

test("shadow enabled with serving disabled is accepted", () => {
  const env = validReleaseAEnv();
  env.RECOMMENDATION_ML_SHADOW_ENABLED = "true";
  const result = validateSync(env);
  assert.equal(result.ok, true);
});

test("worker required but disabled fails", () => {
  const env = validReleaseAEnv();
  env.RECOMMENDATION_OUTBOX_WORKER_ENABLED = "false";
  env.RECOMMENDATION_OUTBOX_WORKER_REQUIRED = "true";
  assert.ok(
    codesOf(validateSync(env).diagnostics).includes(
      "OUTBOX_WORKER_REQUIRED_BUT_DISABLED",
    ),
  );
});

test("invalid poll, retry, batch, and lease values fail", () => {
  const poll = validReleaseAEnv();
  poll.RECOMMENDATION_OUTBOX_POLL_INTERVAL_MS = "100";
  assert.ok(
    codesOf(validateSync(poll).diagnostics).includes(
      "OUTBOX_POLL_INTERVAL_INVALID",
    ),
  );

  const batch = validReleaseAEnv();
  batch.RECOMMENDATION_OUTBOX_BATCH_SIZE = "abc";
  assert.ok(
    codesOf(validateSync(batch).diagnostics).includes(
      "OUTBOX_BATCH_SIZE_INVALID",
    ),
  );

  const attempts = validReleaseAEnv();
  attempts.RECOMMENDATION_OUTBOX_MAX_ATTEMPTS = "99";
  assert.ok(
    codesOf(validateSync(attempts).diagnostics).includes(
      "OUTBOX_MAX_ATTEMPTS_INVALID",
    ),
  );

  const lease = validReleaseAEnv();
  lease.RECOMMENDATION_OUTBOX_LEASE_MS = "500";
  assert.ok(
    codesOf(validateSync(lease).diagnostics).includes(
      "OUTBOX_LEASE_MS_INVALID",
    ),
  );
});

test("malformed boolean flags fail closed", () => {
  const env = validReleaseAEnv();
  env.RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED = "maybe";
  assert.ok(
    codesOf(validateSync(env).diagnostics).includes("FLAG_BOOLEAN_INVALID"),
  );
});

test("optional artifact paths are not required", () => {
  const env = validReleaseAEnv();
  env.RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH = "";
  env.RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH = "";
  env.RECOMMENDATION_ML_SHADOW_ENABLED = "true";
  const result = validateSync(env);
  assert.equal(result.ok, true);
});

test("missing DATABASE_URL fails", () => {
  const env = validReleaseAEnv();
  delete env.DATABASE_URL;
  assert.ok(
    codesOf(validateSync(env).diagnostics).includes("DATABASE_URL_MISSING"),
  );
});

test("diagnostic ordering follows fixed check sequence", () => {
  const env: NodeJS.Dict<string> = {
    NODE_ENV: "development",
    RECOMMENDATION_SCORER_VERSION: "not-a-champion",
    RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED: "true",
    RECOMMENDATION_OUTBOX_WORKER_ENABLED: "false",
    RECOMMENDATION_OUTBOX_WORKER_REQUIRED: "true",
  };
  const codes = codesOf(validateSync(env).diagnostics);
  const envModeIndex = codes.indexOf("ENV_MODE_UNSUPPORTED");
  const dbUrlIndex = codes.indexOf("DATABASE_URL_MISSING");
  const championIndex = codes.indexOf("CHAMPION_UNKNOWN");
  const servingIndex = codes.indexOf("ML_MATERIAL_SERVING_ENABLED");
  const workerIndex = codes.indexOf("OUTBOX_WORKER_REQUIRED_BUT_DISABLED");
  assert.ok(envModeIndex >= 0);
  assert.ok(dbUrlIndex > envModeIndex);
  assert.ok(championIndex > dbUrlIndex);
  assert.ok(servingIndex > championIndex);
  assert.ok(workerIndex > servingIndex);
});

test("diagnostic count is bounded", () => {
  const env: NodeJS.Dict<string> = { NODE_ENV: "production" };
  env.RECOMMENDATION_SCORER_VERSION = "x";
  env.RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED = "maybe";
  env.RECOMMENDATION_ML_PROJECT_SERVING_ENABLED = "maybe";
  env.RECOMMENDATION_ML_SHADOW_ENABLED = "maybe";
  env.RECOMMENDATION_OUTBOX_WORKER_ENABLED = "maybe";
  env.RECOMMENDATION_OUTBOX_WORKER_REQUIRED = "maybe";
  env.RECOMMENDATION_OUTBOX_POLL_INTERVAL_MS = "x";
  env.RECOMMENDATION_OUTBOX_BATCH_SIZE = "x";
  env.RECOMMENDATION_OUTBOX_MAX_ATTEMPTS = "x";
  env.RECOMMENDATION_OUTBOX_LEASE_MS = "x";

  const result = validateSync(env);
  assert.ok(result.diagnostics.length <= MAX_DIAGNOSTICS);
});

test("human and JSON formatting are secret-safe and useful", () => {
  const result = validateSync({
    NODE_ENV: "development",
    DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/db",
  });
  const human = formatHumanReport(result);
  const json = formatJsonReport(result);
  assert.match(human, /FAIL/);
  assert.match(human, /ENV_MODE_UNSUPPORTED/);
  const parsed = JSON.parse(json) as {
    ok: boolean;
    diagnostics: Array<{ code: string }>;
  };
  assert.equal(parsed.ok, false);
  assert.ok(parsed.diagnostics.some((d) => d.code === "ENV_MODE_UNSUPPORTED"));
  assert.equal(human.includes("postgresql://user:pass"), false);
  assert.equal(json.includes("postgresql://user:pass"), false);
});

test("exit-code mapping distinguishes success, config failure, and invocation failure", () => {
  assert.equal(mapExitCode({ validationOk: true }), 0);
  assert.equal(mapExitCode({ validationOk: false }), 1);
  assert.equal(mapExitCode({ invocationFailed: true }), 2);
  assert.equal(mapExitCode({ internalError: true }), 2);
});

test("unknown CLI arguments fail closed and retain --json mode", () => {
  const parsed = parseCliArgs(["--json", "--unexpected"]);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.json, true);
    assert.equal(parsed.diagnostics[0]?.code, "CLI_UNKNOWN_ARGUMENT");
    assert.equal(parsed.diagnostics[0]?.summary.includes("--unexpected"), false);
  }
  assert.deepEqual(parseCliArgs(["--json"]), { ok: true, json: true });
  assert.deepEqual(parseCliArgs([]), { ok: true, json: false });
});

test("secret redaction removes nested error secrets from human and JSON output", () => {
  const message = sanitizeErrorMessage(
    new Error("connect failed", {
      cause: new Error(
        "unable to reach postgresql://alice:s3cret@db.internal:5432/impactloop",
      ),
    }),
  );
  assert.equal(message.includes("s3cret"), false);
  assert.equal(message.includes("postgresql://"), false);
  assert.match(message, /\[REDACTED\]/);

  const nestedResult = {
    ok: false,
    truncated: false,
    diagnostics: [
      {
        code: "DATABASE_CONNECTIVITY_FAILED",
        summary: message,
      },
    ],
  };
  const human = formatHumanReport(nestedResult);
  const json = formatJsonReport(nestedResult);
  assert.equal(human.includes("s3cret"), false);
  assert.equal(json.includes("s3cret"), false);
});

test("secret redaction covers key/value secrets outside URLs", () => {
  const raw =
    "startup failed DATABASE_URL=postgresql://u:p@h/db JWT_ACCESS_SECRET=super-secret-value SMTP_PASS=mail-pass GEMINI_API_KEY=AIzaSySecretTokenValue";
  const redacted = redactSensitiveText(raw);
  assert.equal(redacted.includes("super-secret-value"), false);
  assert.equal(redacted.includes("mail-pass"), false);
  assert.equal(redacted.includes("AIzaSySecretTokenValue"), false);
  assert.equal(redacted.includes("postgresql://u:p@h/db"), false);

  const result = {
    ok: false,
    truncated: false,
    diagnostics: [{ code: "VALIDATOR_INTERNAL_ERROR", summary: raw }],
  };
  assert.equal(formatHumanReport(result).includes("super-secret-value"), false);
  assert.equal(formatJsonReport(result).includes("super-secret-value"), false);
  assert.equal(formatHumanReport(result).includes("mail-pass"), false);
  assert.equal(formatJsonReport(result).includes("AIzaSySecretTokenValue"), false);
});

test("injected diagnostics are sanitized at the output boundary", () => {
  const result = {
    ok: false,
    truncated: false,
    diagnostics: [
      {
        code: "DATABASE_CONNECTIVITY_FAILED",
        summary: "JWT_SECRET=injected-secret-value blew up",
        field: "DATABASE_URL=postgresql://x:y@host/db",
      },
    ],
  };
  const human = formatHumanReport(result);
  const json = formatJsonReport(result);
  assert.equal(human.includes("injected-secret-value"), false);
  assert.equal(json.includes("injected-secret-value"), false);
  assert.equal(human.includes("postgresql://x:y@host/db"), false);
  assert.equal(json.includes("postgresql://x:y@host/db"), false);
});

test("unknown CLI argument containing a secret is not echoed", async () => {
  const priorError = console.error;
  const chunks: string[] = [];
  console.error = (...args: unknown[]) => {
    chunks.push(args.map(String).join(" "));
  };
  try {
    const secretArg = "--token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";
    const code = await runValidateProductionConfigCli([secretArg], {
      loadDotenv: false,
      env: validReleaseAEnv(),
    });
    assert.equal(code, 2);
    const output = chunks.join("\n");
    assert.match(output, /CLI_UNKNOWN_ARGUMENT/);
    assert.equal(output.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), false);
    assert.equal(output.includes(secretArg), false);
  } finally {
    console.error = priorError;
  }
});

test("async validation appends injected DB probe diagnostics after config checks", async () => {
  const database: DatabaseContractCheck = {
    checkConnectivity: async () => ({
      ok: false,
      code: "DATABASE_CONNECTIVITY_FAILED",
      summary:
        "timeout talking to postgresql://alice:s3cret@127.0.0.1:5432/impactloop",
    }),
    checkOutboxContract: async () => ({ ok: true }),
    checkEvidenceEligibilityContract: async () => ({ ok: true }),
  };

  const result = await validateProductionConfig({
    env: validReleaseAEnv(),
    database,
    parseScorerVersion,
  });
  assert.equal(result.ok, false);
  const connectivity = result.diagnostics.find(
    (diagnostic) => diagnostic.code === "DATABASE_CONNECTIVITY_FAILED",
  );
  assert.ok(connectivity);
  const human = formatHumanReport(result);
  const json = formatJsonReport(result);
  assert.equal(human.includes("s3cret"), false);
  assert.equal(json.includes("s3cret"), false);
  assert.equal(human.includes("postgresql://"), false);
  assert.equal(json.includes("postgresql://"), false);
});

test("CLI unknown argument returns exit code 2", async () => {
  const priorError = console.error;
  const chunks: string[] = [];
  console.error = (...args: unknown[]) => {
    chunks.push(args.map(String).join(" "));
  };
  try {
    const code = await runValidateProductionConfigCli(["--nope"], {
      loadDotenv: false,
      env: validReleaseAEnv(),
    });
    assert.equal(code, 2);
    assert.match(chunks.join("\n"), /CLI_UNKNOWN_ARGUMENT/);
  } finally {
    console.error = priorError;
  }
});

test("CLI --json --unexpected emits JSON and exit code 2", async () => {
  const priorError = console.error;
  const chunks: string[] = [];
  console.error = (...args: unknown[]) => {
    chunks.push(args.map(String).join(" "));
  };
  try {
    const code = await runValidateProductionConfigCli(
      ["--json", "--unexpected"],
      {
        loadDotenv: false,
        env: validReleaseAEnv(),
      },
    );
    assert.equal(code, 2);
    const output = chunks.join("\n");
    assert.equal(output.includes("FAIL —"), false);
    const parsed = JSON.parse(output) as {
      ok: boolean;
      diagnostics: Array<{ code: string; summary: string }>;
    };
    assert.equal(parsed.ok, false);
    assert.equal(parsed.diagnostics[0]?.code, "CLI_UNKNOWN_ARGUMENT");
    assert.equal(output.includes("--unexpected"), false);
    assert.equal(output.toLowerCase().includes("at "), false);
  } finally {
    console.error = priorError;
  }
});

test("CLI reports config failure with exit code 1 without loading dotenv", async () => {
  const priorError = console.error;
  console.error = () => {};
  try {
    const env = validReleaseAEnv();
    env.RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED = "true";
    const code = await runValidateProductionConfigCli([], {
      loadDotenv: false,
      env,
      databaseFactory: () => ({
        database: {
          checkConnectivity: async () => ({ ok: true }),
          checkOutboxContract: async () => ({ ok: true }),
          checkEvidenceEligibilityContract: async () => ({ ok: true }),
        },
        cleanup: async () => {},
      }),
    });
    assert.equal(code, 1);
  } finally {
    console.error = priorError;
  }
});

test("child process: invalid champion yields CHAMPION_UNKNOWN without stack (human)", async () => {
  const result = await runValidatorChild([], {
    ...validReleaseAEnv(),
    RECOMMENDATION_SCORER_VERSION: "not-a-champion",
    // Avoid opening a real DB in the child.
    DATABASE_URL: "",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.code, 1);
  assert.match(output, /CHAMPION_UNKNOWN/);
  assert.match(output, /FAIL —/);
  assert.equal(output.includes("not-a-champion"), false);
  assert.equal(/\n\s*at\s+\S+/.test(output), false);
});

test("child process: invalid champion with --json yields valid JSON and exit 1", async () => {
  const result = await runValidatorChild(["--json"], {
    ...validReleaseAEnv(),
    RECOMMENDATION_SCORER_VERSION: "not-a-champion",
    DATABASE_URL: "",
  });
  const output = `${result.stdout}\n${result.stderr}`.trim();
  assert.equal(result.code, 1);
  assert.equal(output.includes("FAIL —"), false);
  const jsonText = result.stderr.trim() || result.stdout.trim();
  const parsed = JSON.parse(jsonText) as {
    ok: boolean;
    diagnostics: Array<{ code: string; summary: string }>;
  };
  assert.equal(parsed.ok, false);
  assert.ok(
    parsed.diagnostics.some((diagnostic) => diagnostic.code === "CHAMPION_UNKNOWN"),
  );
  assert.equal(jsonText.includes("not-a-champion"), false);
  assert.equal(/\n\s*at\s+\S/.test(jsonText), false);
});

test(
  "DB-backed read-only connectivity and contract probes succeed",
  { skip: !hasDatabase },
  async () => {
    const connectionString = process.env.DATABASE_URL!;
    const { database, cleanup } = createDatabaseContractCheck(connectionString);
    try {
      const connectivity = await database.checkConnectivity();
      assert.equal(connectivity.ok, true);
      const outbox = await database.checkOutboxContract();
      assert.equal(outbox.ok, true);
      const eligibility = await database.checkEvidenceEligibilityContract();
      assert.equal(eligibility.ok, true);

      const env = validReleaseAEnv();
      env.DATABASE_URL = connectionString;
      const result = await validateProductionConfig({
        env,
        database,
        parseScorerVersion,
      });
      assert.equal(result.ok, true);
    } finally {
      await cleanup();
    }
  },
);

test(
  "DB-backed failing connectivity is handled without leaking secrets",
  { skip: !hasDatabase },
  async () => {
    const database: DatabaseContractCheck = {
      checkConnectivity: async () => ({
        ok: false,
        code: "DATABASE_CONNECTIVITY_FAILED",
        summary: sanitizeErrorMessage(
          new Error(
            "connect ECONNREFUSED postgresql://impactloop:impactloop@127.0.0.1:1/impactloop_ci",
          ),
        ),
      }),
      checkOutboxContract: async () => ({ ok: true }),
      checkEvidenceEligibilityContract: async () => ({ ok: true }),
    };
    const result = await validateProductionConfig({
      env: validReleaseAEnv(),
      database,
      parseScorerVersion,
    });
    assert.equal(result.ok, false);
    const human = formatHumanReport(result);
    const json = formatJsonReport(result);
    assert.equal(human.includes("impactloop:impactloop"), false);
    assert.equal(json.includes("impactloop:impactloop"), false);
    assert.equal(human.includes("postgresql://"), false);
    assert.equal(json.includes("postgresql://"), false);
  },
);
