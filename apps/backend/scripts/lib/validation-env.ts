import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  sanitizeErrorMessage,
  type DbProbeResult,
} from "./validation-report.js";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const envFilePath = path.join(backendRoot, ".env");
const invitationsEnvFilePath = path.join(backendRoot, "config/invitations.env");

export const DB_CONNECTION_TIMEOUT_MS = 5_000;
export const DB_STATEMENT_TIMEOUT_MS = 5_000;
export const DB_QUERY_TIMEOUT_MS = 5_000;

const stripEmptyEnvOverrides = (
  parsed: dotenv.DotenvParseOutput | undefined,
): void => {
  if (!parsed) {
    return;
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string" && value.trim() === "") {
      delete process.env[key];
    }
  }
};

export const loadValidatorEnvFiles = (): void => {
  dotenv.config({ path: envFilePath, override: true, quiet: true });
  const invitationsEnvResult = dotenv.config({
    path: invitationsEnvFilePath,
    override: true,
    quiet: true,
  });
  stripEmptyEnvOverrides(invitationsEnvResult.parsed);
};

const failedProbe = (code: string, error: unknown): DbProbeResult => ({
  ok: false,
  code,
  summary: sanitizeErrorMessage(error),
});

export type DatabaseConnectivityCheck = {
  checkConnectivity: () => Promise<DbProbeResult>;
};

export const createDatabaseConnectivityCheck = (
  connectionString: string,
): {
  database: DatabaseConnectivityCheck;
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

  const database: DatabaseConnectivityCheck = {
    checkConnectivity: async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { ok: true };
      } catch (error) {
        return failedProbe("DATABASE_CONNECTIVITY_FAILED", error);
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
