import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

const adapter = new PrismaPg({ connectionString: env.databaseUrl });

/** Opt-in only: set PRISMA_QUERY_EVENTS=1 before process start for RP-03.5 SQL audits. */
const enableQueryEvents = process.env.PRISMA_QUERY_EVENTS === "1";

export const prisma = new PrismaClient({
  adapter,
  ...(enableQueryEvents
    ? { log: [{ emit: "event", level: "query" }] as const }
    : {}),
});
