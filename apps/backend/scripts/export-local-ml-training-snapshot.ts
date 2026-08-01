import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { prisma } from '../src/database/prisma.js';
import {
  LocalMlSnapshotInputError,
  LocalMlSnapshotInvariantError,
  parseEvaluationTimestamp,
  serializeLocalMlTrainingSnapshot,
  type LocalMlTrainingSnapshot,
} from '../src/modules/recommendations/local-ml-training-snapshot.schema.js';
import { buildLocalMlTrainingSnapshot } from '../src/modules/recommendations/local-ml-training-snapshot.js';
import {
  PrismaLocalMlSnapshotReader,
  type LocalMlSnapshotQueryStats,
} from '../src/modules/recommendations/local-ml-training-snapshot.repository.js';

type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export interface LocalMlSnapshotExportResult {
  snapshot: LocalMlTrainingSnapshot;
  queryStats: LocalMlSnapshotQueryStats;
}

export async function buildLocalMlSnapshotFromDatabase(
  evaluationTime: Date,
  client: PrismaClient = prisma,
): Promise<LocalMlSnapshotExportResult> {
  return client.$transaction(
    async (transaction: TransactionClient) => {
      await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const readOnlyRows = await transaction.$queryRawUnsafe<
        Array<{ transaction_read_only: string }>
      >('SHOW transaction_read_only');

      if (readOnlyRows[0]?.transaction_read_only !== 'on') {
        throw new LocalMlSnapshotInvariantError(
          'INVARIANT_READ_ONLY_TRANSACTION_NOT_ENFORCED',
          'The snapshot transaction did not enter read-only mode.',
        );
      }

      const source = await new PrismaLocalMlSnapshotReader(transaction).read(evaluationTime);
      return {
        snapshot: await buildLocalMlTrainingSnapshot({ evaluationTime, source }),
        queryStats: source.queryStats,
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}

interface CliOptions {
  evaluationTime: Date;
  outputPath: string;
}

function readOption(argv: readonly string[], name: string): string | undefined {
  const directIndex = argv.indexOf(name);
  if (directIndex >= 0) {
    const value = argv[directIndex + 1];
    if (!value || value.startsWith('--')) {
      throw new LocalMlSnapshotInputError(`${name} requires a value.`);
    }
    return value;
  }

  const prefix = `${name}=`;
  const inline = argv.find((argument) => argument.startsWith(prefix));
  return inline?.slice(prefix.length);
}

export function parseLocalMlSnapshotCli(argv: readonly string[]): CliOptions {
  const supported = new Set(['--evaluation-time', '--output']);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const optionName = argument?.split('=', 1)[0];
    if (!argument?.startsWith('--') || !optionName || !supported.has(optionName)) {
      throw new LocalMlSnapshotInputError(`Unsupported argument: ${argument ?? ''}`);
    }
    if (!argument.includes('=')) {
      index += 1;
    }
  }

  const evaluationValue = readOption(argv, '--evaluation-time');
  if (!evaluationValue) {
    throw new LocalMlSnapshotInputError('--evaluation-time is required.');
  }

  const evaluationTime = parseEvaluationTimestamp(evaluationValue);
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = resolve(scriptDirectory, '..', '..', '..');
  const defaultFilename = `snapshot-${evaluationTime.toISOString().replaceAll(':', '-')}.json`;
  const outputValue = readOption(argv, '--output');

  return {
    evaluationTime,
    outputPath: resolve(
      outputValue ??
        resolve(
          repositoryRoot,
          'ml',
          'recommendation',
          'generated',
          'local-ml-training-snapshots',
          defaultFilename,
        ),
    ),
  };
}

export async function writeSnapshotAtomically(
  outputPath: string,
  snapshot: LocalMlTrainingSnapshot,
): Promise<void> {
  const outputDirectory = dirname(outputPath);
  await mkdir(outputDirectory, { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;

  try {
    await writeFile(temporaryPath, serializeLocalMlTrainingSnapshot(snapshot), 'utf8');
    await rename(temporaryPath, outputPath);
  } finally {
    await unlink(temporaryPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    });
  }
}

async function main(): Promise<void> {
  const options = parseLocalMlSnapshotCli(process.argv.slice(2));
  const { snapshot } = await buildLocalMlSnapshotFromDatabase(options.evaluationTime);
  await writeSnapshotAtomically(options.outputPath, snapshot);

  const counts = snapshot.metadata.counts;
  process.stdout.write(
    [
      `Local ML snapshot written: ${options.outputPath}`,
      `Evaluation time: ${snapshot.metadata.evaluationTimestampUtc}`,
      `Semantic SHA-256: ${snapshot.hashes.semanticContent.value}`,
      `Exported users/items: ${counts.users.exported}/${counts.materialItems.exported}/${counts.projectItems.exported}`,
      `Exported interactions: ${counts.materialInteractions.exported + counts.projectInteractions.exported}`,
    ].join('\n') + '\n',
  );
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  main()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown snapshot export failure.';
      process.stderr.write(`Local ML snapshot export failed: ${message}\n`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
