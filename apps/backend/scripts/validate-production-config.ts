/**
 * Whole-application production preflight CLI.
 * Read-only deployment gate for core API configuration (JWT, CORS, uploads,
 * payments, email, and related production settings).
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  formatAppProductionHumanReport,
  formatJsonReport,
  validateAppProductionPreflight,
} from "./lib/app-production-preflight.js";
import {
  createDatabaseConnectivityCheck,
  loadValidatorEnvFiles,
} from "./lib/validation-env.js";
import {
  mapExitCode,
  parseCliArgs,
  sanitizeErrorMessage,
  type ValidationResult,
} from "./lib/validation-report.js";

const emitReport = (result: ValidationResult, json: boolean): void => {
  const output = json ? formatJsonReport(result) : formatAppProductionHumanReport(result);
  if (result.ok) {
    console.log(output);
  } else {
    console.error(output);
  }
};

export const runValidateProductionConfigCli = async (
  argv: string[] = process.argv.slice(2),
  options: {
    env?: NodeJS.Dict<string>;
    loadDotenv?: boolean;
    checkUploadDirectories?: boolean;
    databaseFactory?: (
      connectionString: string,
    ) => {
      database: { checkConnectivity: () => Promise<{ ok: boolean; code?: string; summary?: string }> };
      cleanup: () => Promise<void>;
    };
  } = {},
): Promise<number> => {
  const parsedArgs = parseCliArgs(argv);
  if (!parsedArgs.ok) {
    emitReport(
      {
        ok: false,
        truncated: false,
        diagnostics: parsedArgs.diagnostics,
      },
      parsedArgs.json,
    );
    return mapExitCode({ invocationFailed: true });
  }

  if (options.loadDotenv !== false) {
    loadValidatorEnvFiles();
  }

  const env = options.env ?? process.env;
  const connectionString =
    typeof env.DATABASE_URL === "string" ? env.DATABASE_URL.trim() : "";

  let cleanup: (() => Promise<void>) | undefined;
  try {
    let database:
      | { checkConnectivity: () => Promise<{ ok: boolean; code?: string; summary?: string }> }
      | undefined;
    if (connectionString) {
      const factory = options.databaseFactory ?? createDatabaseConnectivityCheck;
      const created = factory(connectionString);
      database = created.database;
      cleanup = created.cleanup;
    }

    const result = await validateAppProductionPreflight({
      env,
      database,
      skipDatabase: !database,
      checkUploadDirectories: options.checkUploadDirectories,
    });

    emitReport(result, parsedArgs.json);
    return mapExitCode({ validationOk: result.ok });
  } catch (error) {
    emitReport(
      {
        ok: false,
        truncated: false,
        diagnostics: [
          {
            code: "VALIDATOR_INTERNAL_ERROR",
            summary: sanitizeErrorMessage(error),
          },
        ],
      },
      parsedArgs.json,
    );
    return mapExitCode({ internalError: true });
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }
};

const isMainModule = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;

if (isMainModule) {
  void runValidateProductionConfigCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
