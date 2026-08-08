/**
 * RP-00.4 — Recommendation Release A configuration validator CLI.
 * Read-only deployment gate for recommendation release settings.
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  formatJsonReport,
  formatRecommendationReleaseHumanReport,
  validateRecommendationReleaseConfig,
  type DatabaseContractCheck,
} from "./lib/recommendation-release-config-validation.js";
import {
  DB_CONNECTION_TIMEOUT_MS,
  DB_QUERY_TIMEOUT_MS,
  DB_STATEMENT_TIMEOUT_MS,
  loadValidatorEnvFiles,
} from "./lib/validation-env.js";
import {
  mapExitCode,
  parseCliArgs,
  sanitizeErrorMessage,
  type ValidationResult,
} from "./lib/validation-report.js";

const failedProbe = (code: string, error: unknown) => ({
  ok: false as const,
  code,
  summary: sanitizeErrorMessage(error),
});

export const createRecommendationDatabaseContractCheck = (
  connectionString: string,
): {
  database: DatabaseContractCheck;
  cleanup: () => Promise<void>;
} => {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
    statement_timeout: DB_STATEMENT_TIMEOUT_MS,
    query_timeout: DB_QUERY_TIMEOUT_MS,
    idleTimeoutMillis: 1_000,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const database: DatabaseContractCheck = {
    checkConnectivity: async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { ok: true };
      } catch (error) {
        return failedProbe("DATABASE_CONNECTIVITY_FAILED", error);
      }
    },
    checkOutboxContract: async () => {
      try {
        await prisma.$queryRaw`SELECT 1 FROM "recommendation_event_outbox" LIMIT 0`;
        return { ok: true };
      } catch (error) {
        return failedProbe("DATABASE_OUTBOX_CONTRACT_MISSING", error);
      }
    },
    checkEvidenceEligibilityContract: async () => {
      try {
        await prisma.$queryRaw`SELECT "recommendation_evidence_eligibility" FROM "users" LIMIT 0`;
        return { ok: true };
      } catch (error) {
        return failedProbe(
          "DATABASE_EVIDENCE_ELIGIBILITY_CONTRACT_MISSING",
          error,
        );
      }
    },
  };

  const cleanup = async (): Promise<void> => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore disconnect errors during cleanup
    }
    try {
      await pool.end();
    } catch {
      // ignore pool end errors during cleanup
    }
  };

  return { database, cleanup };
};

const emitReport = (result: ValidationResult, json: boolean): void => {
  const output = json
    ? formatJsonReport(result)
    : formatRecommendationReleaseHumanReport(result);
  if (result.ok) {
    console.log(output);
  } else {
    console.error(output);
  }
};

export const runValidateRecommendationReleaseConfigCli = async (
  argv: string[] = process.argv.slice(2),
  options: {
    env?: NodeJS.Dict<string>;
    loadDotenv?: boolean;
    databaseFactory?: (
      connectionString: string,
    ) => {
      database: DatabaseContractCheck;
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
    let database: DatabaseContractCheck | undefined;
    if (connectionString) {
      const factory =
        options.databaseFactory ?? createRecommendationDatabaseContractCheck;
      const created = factory(connectionString);
      database = created.database;
      cleanup = created.cleanup;
    }

    const result = await validateRecommendationReleaseConfig({
      env,
      database,
      skipDatabase: !database,
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
  void runValidateRecommendationReleaseConfigCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
