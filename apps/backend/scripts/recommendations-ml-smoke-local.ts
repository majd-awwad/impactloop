import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { prisma } from '../src/database/prisma.js';
import {
  parseSmokeArgs,
  runLocalMlSmokeEvaluation,
  toJsonReport,
} from './recommendations-ml-smoke-local-helpers.js';

export const main = async (argv: readonly string[] = process.argv.slice(2)) => {
  try {
    const args = parseSmokeArgs(argv);
    const result = await runLocalMlSmokeEvaluation({
      evaluationTimeUtc: args.evaluationTimeUtc,
      materialArtifactPath: args.materialArtifactPath,
      projectArtifactPath: args.projectArtifactPath,
    });
    if (args.json) {
      process.stdout.write(toJsonReport(result.report));
    } else {
      process.stdout.write(`${result.humanText}\n`);
    }
    process.exitCode = result.exitCode;
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 400) : 'unknown_error';
    process.stdout.write(
      `LM-09 local ML smoke: FAIL\nhardFailures:\n  - CRASH:${message}\n`,
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

const isMainModule =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1]!)).href;

if (isMainModule) {
  await main();
}
