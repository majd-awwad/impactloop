import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Prisma } from '../src/generated/prisma/client.js';
import {
  accumulateMaterialClassification,
  buildMaterialEvidenceAliasUniverse,
  buildMaterialTaxonomyAuditReport,
  classifyCatalogDesiredFailure,
  classifyMaterialTaxonomyAssignment,
  createMaterialTaxonomyAuditAccumulator,
  evaluateCheckGate,
  renderMaterialTaxonomyAuditTextReport,
  resolveDesiredMaterialAssignment,
  type AuditMaterialInput,
  type CategoryOwnershipForAudit,
  type MaterialTaxonomyAuditReport,
  type MaterialTypeCatalogCoverage,
} from '../src/modules/taxonomy/material-taxonomy-audit.js';
import { projectLoadedConceptsForAssignment } from '../src/modules/taxonomy/material-concept-assignment-publish.js';
import { TaxonomyFoundationRepository } from '../src/modules/taxonomy/taxonomy-foundation.repository.js';

export type MaterialTaxonomyAuditCliOptions = {
  json: boolean;
  check: boolean;
  sampleLimit: number;
  batchSize: number;
  timeoutMs: number;
  help: boolean;
};

export class MaterialTaxonomyAuditCliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaterialTaxonomyAuditCliUsageError';
  }
}

export const MATERIAL_TAXONOMY_AUDIT_CLI_USAGE =
  'Usage: npx tsx scripts/material-taxonomy-audit.ts [--json] [--check] [--sample-limit <n>] [--batch-size <n>] [--timeout-ms <n>] [--help]\n'
  + 'Package script: npm run taxonomy:material-audit -- [--json] [--check] ...';

const DEFAULT_SAMPLE_LIMIT = 20;
const MAX_SAMPLE_LIMIT = 100;
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 300_000;

const parsePositiveInt = (
  raw: string,
  flag: string,
  min: number,
  max: number,
): number => {
  if (!/^\d+$/.test(raw)) {
    throw new MaterialTaxonomyAuditCliUsageError(
      `${flag} requires a positive integer.`,
    );
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new MaterialTaxonomyAuditCliUsageError(
      `${flag} must be an integer between ${min} and ${max}.`,
    );
  }
  return value;
};

export const parseMaterialTaxonomyAuditCliArgs = (
  args: readonly string[],
): MaterialTaxonomyAuditCliOptions => {
  const allowedFlags = new Set([
    '--json',
    '--check',
    '--sample-limit',
    '--batch-size',
    '--timeout-ms',
    '--help',
  ]);
  const forbiddenWriteFlags = new Set([
    '--repair',
    '--apply',
    '--backfill',
    '--fix',
  ]);
  const seen = new Set<string>();
  let sampleLimit = DEFAULT_SAMPLE_LIMIT;
  let batchSize = DEFAULT_BATCH_SIZE;
  let timeoutMs = DEFAULT_TIMEOUT_MS;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith('--')) {
      throw new MaterialTaxonomyAuditCliUsageError(
        `Positional argument is not allowed: ${arg}`,
      );
    }
    if (forbiddenWriteFlags.has(arg)) {
      throw new MaterialTaxonomyAuditCliUsageError(
        `Write-related flag is forbidden: ${arg}`,
      );
    }
    if (!allowedFlags.has(arg)) {
      throw new MaterialTaxonomyAuditCliUsageError(
        `Unknown or forbidden flag: ${arg}`,
      );
    }
    if (seen.has(arg)) {
      throw new MaterialTaxonomyAuditCliUsageError(`Duplicate flag: ${arg}`);
    }
    seen.add(arg);

    if (arg === '--sample-limit') {
      const raw = args[index + 1];
      if (raw === undefined || raw.startsWith('--')) {
        throw new MaterialTaxonomyAuditCliUsageError(
          '--sample-limit requires a value.',
        );
      }
      sampleLimit = parsePositiveInt(raw, '--sample-limit', 1, MAX_SAMPLE_LIMIT);
      index += 1;
      continue;
    }
    if (arg === '--batch-size') {
      const raw = args[index + 1];
      if (raw === undefined || raw.startsWith('--')) {
        throw new MaterialTaxonomyAuditCliUsageError(
          '--batch-size requires a value.',
        );
      }
      batchSize = parsePositiveInt(raw, '--batch-size', 1, MAX_BATCH_SIZE);
      index += 1;
      continue;
    }
    if (arg === '--timeout-ms') {
      const raw = args[index + 1];
      if (raw === undefined || raw.startsWith('--')) {
        throw new MaterialTaxonomyAuditCliUsageError(
          '--timeout-ms requires a value.',
        );
      }
      timeoutMs = parsePositiveInt(raw, '--timeout-ms', 1, MAX_TIMEOUT_MS);
      index += 1;
    }
  }

  return {
    json: seen.has('--json'),
    check: seen.has('--check'),
    sampleLimit,
    batchSize,
    timeoutMs,
    help: seen.has('--help'),
  };
};

export type MaterialTaxonomyAuditTxClient = {
  material: {
    findMany: (args: {
      where: { id: { gt: string } };
      orderBy: { id: 'asc' };
      take: number;
      select: {
        id: true;
        status: true;
        categoryId: true;
        materialType: true;
        title: true;
        updatedAt: true;
      };
    }) => Promise<Array<{
      id: string;
      status: AuditMaterialInput['status'];
      categoryId: string;
      materialType: string;
      title: string;
      updatedAt: Date;
    }>>;
  };
  materialConcept: {
    findMany: (args: {
      where: { materialId: { in: string[] } };
      select: {
        materialId: true;
        conceptId: true;
        createdAt: true;
        concept: {
          select: {
            id: true;
            canonicalKey: true;
            conceptType: true;
            status: true;
          };
        };
      };
      orderBy: Array<{ materialId: 'asc' } | { conceptId: 'asc' }>;
    }) => Promise<Array<{
      materialId: string;
      conceptId: string;
      createdAt: Date;
      concept: {
        id: string;
        canonicalKey: string;
        conceptType: string;
        status: string;
      };
    }>>;
  };
  category: {
    findMany: (args: {
      select: {
        id: true;
        categoryType: true;
        isActive: true;
        materialFamilyConceptId: true;
        materialFamilyConcept: {
          select: {
            id: true;
            canonicalKey: true;
            conceptType: true;
            status: true;
          };
        };
      };
      orderBy: { id: 'asc' };
    }) => Promise<CategoryOwnershipForAudit[]>;
  };
  materialType: {
    findMany: (args: {
      where: { isActive: true };
      select: {
        id: true;
        normalizedName: true;
        _count: {
          select: {
            materials: true;
            priceRules: true;
          };
        };
        priceRules: {
          where: {
            isActive: true;
            status: 'ACTIVE';
            currency: 'NIS';
          };
          select: { id: true };
          take: number;
        };
      };
    }) => Promise<Array<{
      id: string;
      normalizedName: string;
      _count: { materials: number; priceRules: number };
      priceRules: Array<{ id: string }>;
    }>>;
  };
};

export type MaterialTaxonomyAuditClient = {
  $transaction: <T>(
    fn: (tx: MaterialTaxonomyAuditTxClient) => Promise<T>,
    options: {
      isolationLevel: typeof Prisma.TransactionIsolationLevel.RepeatableRead;
      timeout: number;
      maxWait: number;
    },
  ) => Promise<T>;
  $disconnect: () => Promise<void>;
};

export type MaterialTaxonomyAuditExecution = {
  exitCode: 0 | 1 | 3;
  report: MaterialTaxonomyAuditReport | null;
};

const emptyCatalog = (): MaterialTypeCatalogCoverage => ({
  totalActive: 0,
  withAtLeastOneMaterial: 0,
  withActivePaidPriceRule: 0,
  resolveToReviewedForm: 0,
  resolveFamilyOnly: 0,
  ambiguous: 0,
  invalidOrMissingTarget: 0,
});

const buildMaterialTypeCatalogCoverage = async (
  tx: MaterialTaxonomyAuditTxClient,
  concepts: ReturnType<typeof projectLoadedConceptsForAssignment>,
): Promise<MaterialTypeCatalogCoverage> => {
  const rows = await tx.materialType.findMany({
    where: { isActive: true },
    select: {
      id: true,
      normalizedName: true,
      _count: {
        select: {
          materials: true,
          priceRules: true,
        },
      },
      priceRules: {
        where: {
          isActive: true,
          status: 'ACTIVE',
          currency: 'NIS',
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  const catalog = emptyCatalog();
  catalog.totalActive = rows.length;

  for (const row of rows) {
    if (row._count.materials > 0) {
      catalog.withAtLeastOneMaterial += 1;
    }
    if (row.priceRules.length > 0) {
      catalog.withActivePaidPriceRule += 1;
    }

    // Family-only placeholder category for catalog-only form resolution.
    const probeCategory: CategoryOwnershipForAudit = {
      id: 'catalog-probe',
      categoryType: 'MATERIAL',
      isActive: true,
      materialFamilyConceptId: concepts.find(
        (concept) => concept.conceptType === 'MATERIAL_FAMILY' && concept.status === 'ACTIVE',
      )?.id ?? null,
      materialFamilyConcept: (() => {
        const family = concepts.find(
          (concept) =>
            concept.conceptType === 'MATERIAL_FAMILY' && concept.status === 'ACTIVE',
        );
        return family
          ? {
              id: family.id,
              canonicalKey: family.canonicalKey,
              conceptType: family.conceptType,
              status: family.status,
            }
          : null;
      })(),
    };

    if (probeCategory.materialFamilyConceptId === null) {
      catalog.invalidOrMissingTarget += 1;
      continue;
    }

    const desired = resolveDesiredMaterialAssignment({
      category: probeCategory,
      materialType: row.normalizedName,
      title: 'catalog-probe-title',
      concepts,
    });

    if (!desired.ok) {
      if (classifyCatalogDesiredFailure(desired) === 'ambiguous') {
        catalog.ambiguous += 1;
      } else {
        catalog.invalidOrMissingTarget += 1;
      }
      continue;
    }
    if (desired.form) {
      catalog.resolveToReviewedForm += 1;
    } else {
      catalog.resolveFamilyOnly += 1;
    }
  }

  return catalog;
};

export const runMaterialTaxonomyAudit = async (input: {
  client: MaterialTaxonomyAuditClient;
  options: MaterialTaxonomyAuditCliOptions;
  generatedAt?: string;
  taxonomyRepository?: TaxonomyFoundationRepository;
}): Promise<MaterialTaxonomyAuditReport> => {
  const taxonomyRepository =
    input.taxonomyRepository ?? new TaxonomyFoundationRepository();

  return input.client.$transaction(async (tx) => {
    const loadedConcepts =
      await taxonomyRepository.loadMaterialConceptAssignmentConcepts(
        tx as never,
      );
    const concepts = projectLoadedConceptsForAssignment(loadedConcepts);
    const aliasUniverse = buildMaterialEvidenceAliasUniverse(concepts);

    const categories = await tx.category.findMany({
      select: {
        id: true,
        categoryType: true,
        isActive: true,
        materialFamilyConceptId: true,
        materialFamilyConcept: {
          select: {
            id: true,
            canonicalKey: true,
            conceptType: true,
            status: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    const categoryById = new Map(
      categories.map((category) => [category.id, category]),
    );

    const materialTypeCatalog = await buildMaterialTypeCatalogCoverage(
      tx,
      concepts,
    );

    const accumulator = createMaterialTaxonomyAuditAccumulator(
      input.options.sampleLimit,
      aliasUniverse,
    );

    let cursor = '';
    for (;;) {
      const materials = await tx.material.findMany({
        where: { id: { gt: cursor } },
        orderBy: { id: 'asc' },
        take: input.options.batchSize,
        select: {
          id: true,
          status: true,
          categoryId: true,
          materialType: true,
          title: true,
          updatedAt: true,
        },
      });
      if (materials.length === 0) {
        break;
      }

      const materialIds = materials.map((row) => row.id);
      const conceptRows = await tx.materialConcept.findMany({
        where: { materialId: { in: materialIds } },
        select: {
          materialId: true,
          conceptId: true,
          createdAt: true,
          concept: {
            select: {
              id: true,
              canonicalKey: true,
              conceptType: true,
              status: true,
            },
          },
        },
        orderBy: [{ materialId: 'asc' }, { conceptId: 'asc' }],
      });

      const conceptsByMaterial = new Map<string, AuditMaterialInput['storedConcepts']>();
      for (const row of conceptRows) {
        const list = conceptsByMaterial.get(row.materialId) ?? [];
        list.push({
          conceptId: row.concept.id,
          canonicalKey: row.concept.canonicalKey,
          conceptType: row.concept.conceptType,
          status: row.concept.status,
          createdAt: row.createdAt.toISOString(),
        });
        conceptsByMaterial.set(row.materialId, list);
      }

      for (const row of materials) {
        const auditMaterial: AuditMaterialInput = {
          id: row.id,
          status: row.status,
          categoryId: row.categoryId,
          materialType: row.materialType,
          title: row.title,
          updatedAt: row.updatedAt,
          storedConcepts: conceptsByMaterial.get(row.id) ?? [],
        };
        const category = categoryById.get(row.categoryId) ?? null;
        const desired = resolveDesiredMaterialAssignment({
          category,
          materialType: row.materialType,
          title: row.title,
          concepts,
        });
        const classification = classifyMaterialTaxonomyAssignment({
          material: auditMaterial,
          desired,
        });
        accumulateMaterialClassification(
          accumulator,
          classification,
          row.materialType,
          row.title,
        );
      }

      cursor = materials[materials.length - 1]!.id;
      if (materials.length < input.options.batchSize) {
        break;
      }
    }

    return buildMaterialTaxonomyAuditReport({
      generatedAt: input.generatedAt,
      sampleLimit: input.options.sampleLimit,
      batchSize: input.options.batchSize,
      timeoutMs: input.options.timeoutMs,
      checkMode: input.options.check,
      outputMode: input.options.json ? 'json' : 'text',
      accumulator,
      concepts,
      materialTypeCatalog,
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    timeout: input.options.timeoutMs,
    maxWait: Math.min(10_000, input.options.timeoutMs),
  });
};

export const executeMaterialTaxonomyAudit = async (input: {
  client: MaterialTaxonomyAuditClient;
  args: readonly string[];
  write?: (output: string) => void;
  generatedAt?: string;
  taxonomyRepository?: TaxonomyFoundationRepository;
}): Promise<MaterialTaxonomyAuditExecution> => {
  const write = input.write ?? ((output: string) => process.stdout.write(output));

  try {
    const options = parseMaterialTaxonomyAuditCliArgs(input.args);
    if (options.help) {
      write(`${MATERIAL_TAXONOMY_AUDIT_CLI_USAGE}\n`);
      return { exitCode: 0, report: null };
    }

    const report = await runMaterialTaxonomyAudit({
      client: input.client,
      options,
      generatedAt: input.generatedAt,
      taxonomyRepository: input.taxonomyRepository,
    });

    write(
      options.json
        ? `${JSON.stringify(report, null, 2)}\n`
        : renderMaterialTaxonomyAuditTextReport(report),
    );

    if (options.check && !evaluateCheckGate(report)) {
      return { exitCode: 1, report };
    }
    return { exitCode: 0, report };
  } catch (error) {
    if (error instanceof MaterialTaxonomyAuditCliUsageError) {
      throw error;
    }
    throw error;
  } finally {
    await input.client.$disconnect();
  }
};

const createProductionClient = async (): Promise<MaterialTaxonomyAuditClient> => {
  const { prisma } = await import('../src/database/prisma.js');
  return {
    $transaction: (fn, options) =>
      prisma.$transaction(
        (tx) => fn(tx as unknown as MaterialTaxonomyAuditTxClient),
        options,
      ),
    $disconnect: async () => prisma.$disconnect(),
  };
};

export const runMaterialTaxonomyAuditCli = async (
  args: readonly string[] = process.argv.slice(2),
): Promise<number> => {
  try {
    const options = parseMaterialTaxonomyAuditCliArgs(args);
    if (options.help) {
      process.stdout.write(`${MATERIAL_TAXONOMY_AUDIT_CLI_USAGE}\n`);
      return 0;
    }

    const client = await createProductionClient();
    try {
      const execution = await executeMaterialTaxonomyAudit({ client, args });
      return execution.exitCode;
    } catch (error) {
      if (error instanceof MaterialTaxonomyAuditCliUsageError) {
        process.stderr.write(
          `${error.message}\n${MATERIAL_TAXONOMY_AUDIT_CLI_USAGE}\n`,
        );
        return 2;
      }
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Material taxonomy audit failed: ${message}\n`);
      return 3;
    }
  } catch (error) {
    if (error instanceof MaterialTaxonomyAuditCliUsageError) {
      process.stderr.write(
        `${error.message}\n${MATERIAL_TAXONOMY_AUDIT_CLI_USAGE}\n`,
      );
      return 2;
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Material taxonomy audit failed: ${message}\n`);
    return 3;
  }
};

const invokedPath = process.argv[1];
const isDirectExecution = invokedPath
  ? pathToFileURL(resolve(invokedPath)).href === import.meta.url
  : false;

if (isDirectExecution) {
  void runMaterialTaxonomyAuditCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Material taxonomy audit failed: ${message}\n`);
      process.exitCode = 3;
    });
}
