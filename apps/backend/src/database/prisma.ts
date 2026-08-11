import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";
import {
  assertAllowedAutomatedTestDatabaseUrl,
  env,
  isAutomatedTestRuntime,
} from "../config/env.js";
import { logger } from "../observability/logger.js";

const configuredPoolMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '', 10);
const poolMax = Number.isInteger(configuredPoolMax) && configuredPoolMax > 0
  ? configuredPoolMax
  : 10;

// Defense in depth: refuse development DB if a test process somehow reaches
// Prisma init with an unsafe connection string.
if (isAutomatedTestRuntime()) {
  assertAllowedAutomatedTestDatabaseUrl(env.databaseUrl);
}

export const databasePool = new Pool({
  connectionString: env.databaseUrl,
  max: poolMax,
  application_name: `impactloop-api:${process.pid}`,
});

const adapter = new PrismaPg(databasePool);

/** Opt-in only: set PRISMA_QUERY_EVENTS=1 before process start for RP-03.5 SQL audits. */
const enableQueryEvents = process.env.PRISMA_QUERY_EVENTS === "1";

export const prisma = new PrismaClient({
  adapter,
  ...(enableQueryEvents
    ? { log: [{ emit: "event", level: "query" }] as const }
    : {}),
});

export const getDatabasePoolSnapshot = () => ({
  poolTotal: databasePool.totalCount,
  poolIdle: databasePool.idleCount,
  poolWaiting: databasePool.waitingCount,
  poolMax,
});

if (enableQueryEvents) {
  const queryEventClient = prisma as unknown as {
    $on: (
      event: 'query',
      callback: (query: { duration: number }) => void,
    ) => void;
  };
  queryEventClient.$on('query', (event) => {
    logger.debug(
      {
        operation: 'database.query',
        durationMs: event.duration,
        ...getDatabasePoolSnapshot(),
      },
      'Prisma query completed',
    );
  });
}
