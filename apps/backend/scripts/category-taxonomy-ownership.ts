import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildCategoryTaxonomyOwnershipReport,
  type CategoryOwnershipAuditInput,
  type CategoryOwnershipConcept,
  type CategoryOwnershipReport,
  type LegacyBackfillExpectation,
  type PersistedCategoryOwnership,
} from '../src/modules/taxonomy/category-taxonomy-ownership.js';

export type CategoryOwnershipCliOptions = {
  json: boolean;
};

export type CategoryOwnershipAuditReadClient = {
  category: {
    findMany: () => Promise<CategoryOwnershipAuditInput[]>;
  };
  taxonomyConcept: {
    findMany: () => Promise<CategoryOwnershipConcept[]>;
  };
  $disconnect: () => Promise<void>;
};

export type CategoryOwnershipAuditExecution = {
  exitCode: 0 | 1;
  report: CategoryOwnershipReport;
};

export class CategoryOwnershipCliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoryOwnershipCliUsageError';
  }
}

export const CATEGORY_OWNERSHIP_CLI_USAGE =
  'Usage (npm 11 workspaces): npm run taxonomy:category-ownership -- -- --check [--json]';

export const parseCategoryOwnershipCliArgs = (
  args: readonly string[],
): CategoryOwnershipCliOptions => {
  const allowed = new Set(['--check', '--json']);
  const seen = new Set<string>();

  for (const arg of args) {
    if (!arg.startsWith('--')) {
      throw new CategoryOwnershipCliUsageError(`Positional argument is not allowed: ${arg}`);
    }
    if (!allowed.has(arg)) {
      throw new CategoryOwnershipCliUsageError(`Unknown or forbidden flag: ${arg}`);
    }
    if (seen.has(arg)) {
      throw new CategoryOwnershipCliUsageError(`Duplicate flag: ${arg}`);
    }
    seen.add(arg);
  }

  if (!seen.has('--check')) {
    throw new CategoryOwnershipCliUsageError('The --check flag is required.');
  }

  return { json: seen.has('--json') };
};

const formatLegacyExpectation = (
  expectation: LegacyBackfillExpectation | null,
) => {
  if (!expectation) {
    return 'none';
  }
  return `${expectation.resolution.toLowerCase()}: ${expectation.matches
    .map(({ canonicalKey }) => canonicalKey)
    .join(', ')}`;
};

const formatPersistedOwnership = (
  ownership: PersistedCategoryOwnership,
) => {
  if (!ownership) {
    return 'null';
  }
  if (!ownership.concept) {
    return `${ownership.conceptId ?? 'null'} (unresolved)`;
  }
  return `${ownership.concept.canonicalKey} [id=${ownership.conceptId ?? 'null'}, type=${ownership.concept.conceptType}, status=${ownership.concept.status}]`;
};

export const renderCategoryOwnershipTextReport = (
  report: CategoryOwnershipReport,
) => {
  const lines = [
    'Category taxonomy ownership audit',
    `Generated: ${report.generatedAt}`,
    '',
  ];

  for (const row of report.categories) {
    lines.push(
      `${row.category.nameEn} (${row.category.id})`,
      `  category: type=${row.category.categoryType}, active=${row.category.isActive}, parentId=${row.category.parentId ?? 'null'}`,
      `  labels: en=${row.category.nameEn}; ar=${row.category.nameAr}`,
      `  usage: materials=${row.category.materialCount}, learningProjects=${row.category.learningProjectCount}, requiredComponents=${row.category.requiredComponentCount}`,
      `  requiredRoles: ${row.requiredRoles.join(', ')}`,
      `  legacyBackfillExpectation.materialFamily: ${formatLegacyExpectation(row.legacyBackfillExpectation.materialFamily)}`,
      `  legacyBackfillExpectation.projectTopic: ${formatLegacyExpectation(row.legacyBackfillExpectation.projectTopic)}`,
      `  persistedOwnership.materialFamily: ${formatPersistedOwnership(row.persistedOwnership.materialFamily)}`,
      `  persistedOwnership.projectTopic: ${formatPersistedOwnership(row.persistedOwnership.projectTopic)}`,
      `  readinessStatus: ${row.readinessStatus}`,
      `  issues: ${row.issues.length === 0 ? 'none' : row.issues.map(({ code, role, detail }) => `${code}${role ? `(${role})` : ''}: ${detail}`).join(' | ')}`,
      '',
    );
  }

  lines.push(
    'Summary',
    `  totalCategories: ${report.summary.totalCategories}`,
    `  activeCategories: ${report.summary.activeCategories}`,
    `  readyActiveCategories: ${report.summary.readyActiveCategories}`,
    `  notReadyActiveCategories: ${report.summary.notReadyActiveCategories}`,
    `  inactiveCategories: ${report.summary.inactiveCategories}`,
    `  allActiveReady: ${report.summary.allActiveReady}`,
    `Result: ${report.resultCode}`,
  );

  return `${lines.join('\n')}\n`;
};

export const executeCategoryOwnershipAudit = async (input: {
  client: CategoryOwnershipAuditReadClient;
  args: readonly string[];
  write?: (output: string) => void;
  generatedAt?: string;
}): Promise<CategoryOwnershipAuditExecution> => {
  const write = input.write ?? ((output: string) => process.stdout.write(output));

  try {
    const options = parseCategoryOwnershipCliArgs(input.args);
    const [categories, taxonomyConcepts] = await Promise.all([
      input.client.category.findMany(),
      input.client.taxonomyConcept.findMany(),
    ]);
    const report = buildCategoryTaxonomyOwnershipReport({
      categories,
      taxonomyConcepts,
      generatedAt: input.generatedAt,
    });

    write(options.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : renderCategoryOwnershipTextReport(report));

    return {
      exitCode: report.summary.allActiveReady ? 0 : 1,
      report,
    };
  } finally {
    await input.client.$disconnect();
  }
};

const createProductionReadClient = async (): Promise<CategoryOwnershipAuditReadClient> => {
  const { prisma } = await import('../src/database/prisma.js');

  return {
    category: {
      findMany: async () => prisma.category.findMany({
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          categoryType: true,
          isActive: true,
          parentId: true,
          materialFamilyConceptId: true,
          projectTopicConceptId: true,
          materialFamilyConcept: {
            select: {
              id: true,
              canonicalKey: true,
              conceptType: true,
              status: true,
            },
          },
          projectTopicConcept: {
            select: {
              id: true,
              canonicalKey: true,
              conceptType: true,
              status: true,
            },
          },
          _count: {
            select: {
              materials: true,
              learningProjects: true,
              projectRequiredComponents: true,
            },
          },
        },
        orderBy: [
          { categoryType: 'asc' },
          { nameEn: 'asc' },
          { id: 'asc' },
        ],
      }),
    },
    taxonomyConcept: {
      findMany: async () => prisma.taxonomyConcept.findMany({
        select: {
          id: true,
          canonicalKey: true,
          conceptType: true,
          status: true,
        },
        orderBy: { canonicalKey: 'asc' },
      }),
    },
    $disconnect: async () => prisma.$disconnect(),
  };
};

export const runCategoryOwnershipCli = async (
  args: readonly string[] = process.argv.slice(2),
) => {
  const client = await createProductionReadClient();
  try {
    const execution = await executeCategoryOwnershipAudit({ client, args });
    return execution.exitCode;
  } catch (error) {
    if (error instanceof CategoryOwnershipCliUsageError) {
      process.stderr.write(`${error.message}\n${CATEGORY_OWNERSHIP_CLI_USAGE}\n`);
      return 2;
    }
    throw error;
  }
};

const invokedPath = process.argv[1];
const isDirectExecution = invokedPath
  ? pathToFileURL(resolve(invokedPath)).href === import.meta.url
  : false;

if (isDirectExecution) {
  void runCategoryOwnershipCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
