import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Prisma } from '../src/generated/prisma/client.js';
import {
  createEmptyComponentConceptLifecycleDiagnostics,
  diffComponentConceptAssignments,
  resolveComponentConceptAssignments,
  type ComponentConceptAssignmentRegistry,
  type ComponentConceptAssignmentResult,
} from '../src/modules/taxonomy/component-concept-assignment.js';
import {
  loadComponentAssignmentRegistry,
  syncProjectComponentConceptAssignments,
} from '../src/modules/taxonomy/component-concept-assignment.repository.js';
import {
  accumulateComponentClassification,
  buildComponentTaxonomyAuditReport,
  classifyComponentTaxonomyAssignment,
  collectApplyEligibleCandidates,
  COMPONENT_TAXONOMY_AUDIT_DEFAULT_SAMPLE_LIMIT,
  COMPONENT_TAXONOMY_AUDIT_MAX_APPLY_ELIGIBLE,
  createComponentTaxonomyAuditAccumulator,
  evaluateApplyEligibleBound,
  PUBLIC_PROJECT_WHERE,
  renderComponentTaxonomyAuditTextReport,
  selectComponentAuditExitCode,
  type ApplyEligibleCandidate,
  type AuditComponentInput,
  type ComponentAuditExitCode,
  type ComponentClassificationResult,
  type ComponentTaxonomyAuditReport,
  type ComponentTaxonomyAuditWrites,
  type StoredComponentAssignment,
} from '../src/modules/taxonomy/component-taxonomy-audit.js';
import {
  isRetryableSerializableConflict,
} from '../src/utils/transaction-retry.js';

export type ComponentTaxonomyAuditCliOptions = {
  json: boolean;
  check: boolean;
  apply: boolean;
  sampleLimit: number;
  batchSize: number;
  timeoutMs: number;
  help: boolean;
};

export class ComponentTaxonomyAuditCliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComponentTaxonomyAuditCliUsageError';
  }
}

export class ComponentTaxonomyAuditPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComponentTaxonomyAuditPreconditionError';
  }
}

export const COMPONENT_TAXONOMY_AUDIT_CLI_USAGE =
  'Usage: node --import tsx scripts/component-taxonomy-audit.ts --check|--apply [--json] [--sample-limit <n>] [--batch-size <n>] [--timeout-ms <n>] [--help]\n';

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 300_000;
const MAX_SAMPLE_LIMIT = 100;

const parsePositiveInt = (
  raw: string,
  flag: string,
  min: number,
  max: number,
): number => {
  if (!/^\d+$/.test(raw)) {
    throw new ComponentTaxonomyAuditCliUsageError(
      `${flag} requires a positive integer.`,
    );
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ComponentTaxonomyAuditCliUsageError(
      `${flag} must be an integer between ${min} and ${max}.`,
    );
  }
  return value;
};

export const parseComponentTaxonomyAuditCliArgs = (
  args: readonly string[],
): ComponentTaxonomyAuditCliOptions => {
  const allowedFlags = new Set([
    '--json',
    '--check',
    '--apply',
    '--sample-limit',
    '--batch-size',
    '--timeout-ms',
    '--help',
  ]);
  const seen = new Set<string>();
  let sampleLimit = COMPONENT_TAXONOMY_AUDIT_DEFAULT_SAMPLE_LIMIT;
  let batchSize = DEFAULT_BATCH_SIZE;
  let timeoutMs = DEFAULT_TIMEOUT_MS;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith('--')) {
      throw new ComponentTaxonomyAuditCliUsageError(
        `Positional argument is not allowed: ${arg}`,
      );
    }
    if (!allowedFlags.has(arg)) {
      throw new ComponentTaxonomyAuditCliUsageError(
        `Unknown or forbidden flag: ${arg}`,
      );
    }
    if (seen.has(arg)) {
      throw new ComponentTaxonomyAuditCliUsageError(`Duplicate flag: ${arg}`);
    }
    seen.add(arg);

    if (arg === '--sample-limit') {
      const raw = args[index + 1];
      if (raw === undefined || raw.startsWith('--')) {
        throw new ComponentTaxonomyAuditCliUsageError(
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
        throw new ComponentTaxonomyAuditCliUsageError(
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
        throw new ComponentTaxonomyAuditCliUsageError(
          '--timeout-ms requires a value.',
        );
      }
      timeoutMs = parsePositiveInt(raw, '--timeout-ms', 1, MAX_TIMEOUT_MS);
      index += 1;
      continue;
    }
  }

  if (seen.has('--help')) {
    return {
      json: seen.has('--json'),
      check: false,
      apply: false,
      sampleLimit,
      batchSize,
      timeoutMs,
      help: true,
    };
  }

  const check = seen.has('--check');
  const apply = seen.has('--apply');
  if (check === apply) {
    throw new ComponentTaxonomyAuditCliUsageError(
      'Exactly one of --check or --apply is required.',
    );
  }

  return {
    json: seen.has('--json'),
    check,
    apply,
    sampleLimit,
    batchSize,
    timeoutMs,
    help: false,
  };
};

type ComponentRow = {
  id: string;
  projectId: string;
  componentName: string;
  materialType: string;
  isRequired: boolean;
  taxonomyConcepts: Array<{
    id: string;
    conceptId: string;
    concept: {
      id: string;
      canonicalKey: string;
      conceptType: string;
      status: string;
    };
  }>;
};

export type ComponentTaxonomyAuditTxClient = {
  learningProject: {
    count: (args: {
      where: typeof PUBLIC_PROJECT_WHERE;
    }) => Promise<number>;
    findMany: (args: {
      where: typeof PUBLIC_PROJECT_WHERE | { id: { in: string[] } } & typeof PUBLIC_PROJECT_WHERE;
      select: {
        id: true;
        requiredComponents: {
          where?: { id: { gt: string } };
          orderBy: { id: 'asc' };
          take?: number;
          select: {
            id: true;
            projectId: true;
            componentName: true;
            materialType: true;
            isRequired: true;
            taxonomyConcepts: {
              select: {
                id: true;
                conceptId: true;
                concept: {
                  select: {
                    id: true;
                    canonicalKey: true;
                    conceptType: true;
                    status: true;
                  };
                };
              };
              orderBy: Array<{ conceptId: 'asc' }>;
            };
          };
        };
      };
      orderBy: { id: 'asc' };
    }) => Promise<Array<{
      id: string;
      requiredComponents: ComponentRow[];
    }>>;
  };
  projectRequiredComponent: {
    findMany: (args: unknown) => Promise<ComponentRow[]>;
    findUnique: (args: unknown) => Promise<{
      id: string;
      projectId: string;
      componentName: string;
      materialType: string;
      isRequired: boolean;
      project: { id: string; status: string } | null;
      taxonomyConcepts: ComponentRow['taxonomyConcepts'];
    } | null>;
  };
  projectComponentConcept: {
    findMany: (args: unknown) => Promise<Array<{ id: string; componentId: string; conceptId: string }>>;
    deleteMany: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
  };
  taxonomyConcept: {
    findMany: (args: unknown) => Promise<unknown[]>;
  };
};

export type ComponentTaxonomyAuditClient = {
  $transaction: <T>(
    fn: (tx: ComponentTaxonomyAuditTxClient) => Promise<T>,
    options: {
      isolationLevel:
        | typeof Prisma.TransactionIsolationLevel.RepeatableRead
        | typeof Prisma.TransactionIsolationLevel.Serializable;
      timeout?: number;
      maxWait?: number;
    },
  ) => Promise<T>;
  $disconnect: () => Promise<void>;
};

const toAuditComponent = (row: ComponentRow): AuditComponentInput => ({
  projectId: row.projectId,
  componentId: row.id,
  componentName: row.componentName,
  materialType: row.materialType,
  isRequired: row.isRequired,
  assignments: row.taxonomyConcepts.map(
    (link): StoredComponentAssignment => ({
      assignmentId: link.id,
      conceptId: link.conceptId,
      canonicalKey: link.concept.canonicalKey,
      conceptType: link.concept.conceptType,
      status: link.concept.status,
    }),
  ),
});

const componentSelect = {
  id: true,
  projectId: true,
  componentName: true,
  materialType: true,
  isRequired: true,
  taxonomyConcepts: {
    select: {
      id: true,
      conceptId: true,
      concept: {
        select: {
          id: true,
          canonicalKey: true,
          conceptType: true,
          status: true,
        },
      },
    },
    orderBy: [{ conceptId: 'asc' as const }],
  },
};

const loadInventoryComponents = async (
  tx: ComponentTaxonomyAuditTxClient,
  batchSize: number,
): Promise<ComponentRow[]> => {
  const rows: ComponentRow[] = [];
  let cursor: string | null = null;
  for (;;) {
    const batch = await tx.projectRequiredComponent.findMany({
      where: {
        ...(cursor ? { id: { gt: cursor } } : {}),
        project: { is: PUBLIC_PROJECT_WHERE },
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: componentSelect,
    });
    if (batch.length === 0) {
      break;
    }
    rows.push(...(batch as ComponentRow[]));
    cursor = batch[batch.length - 1]!.id;
    if (batch.length < batchSize) {
      break;
    }
  }
  return rows;
};

export type ComponentTaxonomyResolveOverride = (
  input: { componentName: string; materialType: string },
  registry: ComponentConceptAssignmentRegistry,
) => ComponentConceptAssignmentResult | undefined;

const classifyInventory = async (
  tx: ComponentTaxonomyAuditTxClient,
  components: ComponentRow[],
  sampleLimit: number,
  resolveOverride?: ComponentTaxonomyResolveOverride,
) => {
  const accumulator = createComponentTaxonomyAuditAccumulator(sampleLimit);
  if (components.length === 0) {
    return accumulator;
  }

  // Process in deterministic component-id order; registry loads per batch.
  const ordered = [...components].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  const batchSize = 100;
  for (let offset = 0; offset < ordered.length; offset += batchSize) {
    const batch = ordered.slice(offset, offset + batchSize);
    const registry = await loadComponentAssignmentRegistry(
      tx as never,
      batch.map((row) => ({
        id: row.id,
        componentName: row.componentName,
        materialType: row.materialType,
      })),
    );

    for (const row of batch) {
      const component = toAuditComponent(row);
      const resolveInput = {
        componentName: row.componentName,
        materialType: row.materialType,
      };
      const resolver =
        resolveOverride?.(resolveInput, registry)
        ?? resolveComponentConceptAssignments(resolveInput, registry);
      const classified = classifyComponentTaxonomyAssignment({
        component,
        resolver,
        registry,
      });
      accumulateComponentClassification(accumulator, component, classified);
    }
  }

  return accumulator;
};

export const runComponentTaxonomyAuditSnapshot = async (input: {
  client: ComponentTaxonomyAuditClient;
  options: ComponentTaxonomyAuditCliOptions;
  mode: 'check' | 'apply';
  generatedAt?: string;
  writes?: ComponentTaxonomyAuditWrites;
  applyFailureCode?: ComponentTaxonomyAuditReport['applyFailureCode'];
  resolveOverride?: ComponentTaxonomyResolveOverride;
}): Promise<{
  report: ComponentTaxonomyAuditReport;
  eligible: ApplyEligibleCandidate[];
  classifications: ComponentClassificationResult[];
}> => {
  return input.client.$transaction(
    async (tx) => {
      const activePublishedProjects = await tx.learningProject.count({
        where: PUBLIC_PROJECT_WHERE,
      });
      const components = await loadInventoryComponents(tx, input.options.batchSize);
      const accumulator = await classifyInventory(
        tx,
        components,
        input.options.sampleLimit,
        input.resolveOverride,
      );
      accumulator.activePublishedProjects = activePublishedProjects;
      const report = buildComponentTaxonomyAuditReport({
        generatedAt: input.generatedAt,
        mode: input.mode,
        outputMode: input.options.json ? 'json' : 'text',
        sampleLimit: input.options.sampleLimit,
        batchSize: input.options.batchSize,
        timeoutMs: input.options.timeoutMs,
        accumulator,
        writes: input.writes,
        applyFailureCode: input.applyFailureCode,
      });
      return {
        report,
        eligible: collectApplyEligibleCandidates(accumulator.classifications),
        classifications: accumulator.classifications,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: input.options.timeoutMs,
      maxWait: Math.min(10_000, input.options.timeoutMs),
    },
  );
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });

export type ComponentTaxonomyApplyHooks = {
  beforeTransaction?: (
    eligible: readonly ApplyEligibleCandidate[],
  ) => Promise<void> | void;
  maxAttempts?: number;
  /** Test seam: reshape eligible set after preflight (e.g. over-limit). */
  transformEligibleForApply?: (
    eligible: readonly ApplyEligibleCandidate[],
  ) => ApplyEligibleCandidate[];
  /** Test seam: override resolver result without changing RP-02.6B production. */
  resolveOverride?: ComponentTaxonomyResolveOverride;
};

const applyEligibleRepairs = async (input: {
  client: ComponentTaxonomyAuditClient;
  eligible: readonly ApplyEligibleCandidate[];
  timeoutMs: number;
  hooks?: ComponentTaxonomyApplyHooks;
}): Promise<ComponentTaxonomyAuditWrites> => {
  const writes: ComponentTaxonomyAuditWrites = {
    attempted: input.eligible.length,
    applied: 0,
    noopIdentical: 0,
    abortedPrecondition: 0,
    skippedOverLimit: false,
  };

  if (input.eligible.length === 0) {
    return writes;
  }

  const maxAttempts = input.hooks?.maxAttempts ?? 12;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (input.hooks?.beforeTransaction) {
        await input.hooks.beforeTransaction(input.eligible);
      }

      await input.client.$transaction(
        async (tx) => {
          const eligibleIds = input.eligible.map((row) => row.componentId);
          const rows = await tx.projectRequiredComponent.findMany({
            where: { id: { in: eligibleIds } },
            select: {
              ...componentSelect,
              project: {
                select: {
                  id: true,
                  status: true,
                  category: {
                    select: {
                      isActive: true,
                      categoryType: true,
                    },
                  },
                },
              },
            },
            orderBy: { id: 'asc' },
          });

          const byId = new Map(
            (rows as Array<
              ComponentRow & {
                project: {
                  id: string;
                  status: string;
                  category: { isActive: boolean; categoryType: string };
                };
              }
            >).map((row) => [row.id, row]),
          );

          const registry = await loadComponentAssignmentRegistry(
            tx as never,
            input.eligible.map((candidate) => {
              const row = byId.get(candidate.componentId);
              if (!row) {
                throw new ComponentTaxonomyAuditPreconditionError(
                  `Component missing during apply: ${candidate.componentId}`,
                );
              }
              return {
                id: row.id,
                componentName: row.componentName,
                materialType: row.materialType,
              };
            }),
          );

          for (const candidate of input.eligible) {
            const row = byId.get(candidate.componentId);
            if (!row) {
              throw new ComponentTaxonomyAuditPreconditionError(
                `Component missing during apply: ${candidate.componentId}`,
              );
            }

            const stillPublic =
              row.project.status === 'PUBLISHED'
              && row.project.category.isActive
              && (row.project.category.categoryType === 'PROJECT'
                || row.project.category.categoryType === 'BOTH');
            if (!stillPublic) {
              throw new ComponentTaxonomyAuditPreconditionError(
                `Project no longer public during apply: ${row.projectId}`,
              );
            }

            const resolveInput = {
              componentName: row.componentName,
              materialType: row.materialType,
            };
            const resolver =
              input.hooks?.resolveOverride?.(resolveInput, registry)
              ?? resolveComponentConceptAssignments(resolveInput, registry);
            const classified = classifyComponentTaxonomyAssignment({
              component: toAuditComponent(row),
              resolver,
              registry,
            });

            if (
              classified.classification !== 'AUTO_REPAIR_ELIGIBLE'
              || !classified.authoritativeSingleton
              || classified.authoritativeSingleton.conceptId
                !== candidate.expectedConceptId
              || classified.authoritativeSingleton.canonicalKey
                !== candidate.expectedCanonicalKey
            ) {
              throw new ComponentTaxonomyAuditPreconditionError(
                `Apply precondition mismatch for component ${candidate.componentId}`,
              );
            }

            const diagnostics = createEmptyComponentConceptLifecycleDiagnostics();
            const currentIds = row.taxonomyConcepts.map((link) => link.conceptId);
            const diff = diffComponentConceptAssignments(currentIds, [
              candidate.expectedConceptId,
            ]);
            await syncProjectComponentConceptAssignments(
              tx as never,
              row.id,
              [candidate.expectedConceptId],
              diagnostics,
            );

            if (diff.identical) {
              writes.noopIdentical += 1;
            } else {
              writes.applied += 1;
            }
          }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: input.timeoutMs,
          maxWait: Math.min(10_000, input.timeoutMs),
        },
      );

      return writes;
    } catch (error) {
      if (error instanceof ComponentTaxonomyAuditPreconditionError) {
        writes.abortedPrecondition = 1;
        writes.applied = 0;
        writes.noopIdentical = 0;
        throw error;
      }
      if (attempt < maxAttempts && isRetryableSerializableConflict(error)) {
        await sleep(attempt * 50);
        writes.applied = 0;
        writes.noopIdentical = 0;
        continue;
      }
      throw error;
    }
  }

  throw new Error('Unable to complete component taxonomy apply transaction.');
};

export type ComponentTaxonomyAuditExecution = {
  exitCode: ComponentAuditExitCode;
  report: ComponentTaxonomyAuditReport | null;
};

export const executeComponentTaxonomyAudit = async (input: {
  client: ComponentTaxonomyAuditClient;
  args: readonly string[];
  write?: (output: string) => void;
  generatedAt?: string;
  applyHooks?: ComponentTaxonomyApplyHooks;
}): Promise<ComponentTaxonomyAuditExecution> => {
  const write = input.write ?? ((output: string) => process.stdout.write(output));

  try {
    const options = parseComponentTaxonomyAuditCliArgs(input.args);
    if (options.help) {
      write(`${COMPONENT_TAXONOMY_AUDIT_CLI_USAGE}\n`);
      return { exitCode: 0, report: null };
    }

    if (options.check) {
      const { report } = await runComponentTaxonomyAuditSnapshot({
        client: input.client,
        options,
        mode: 'check',
        generatedAt: input.generatedAt,
        resolveOverride: input.applyHooks?.resolveOverride,
      });
      write(
        options.json
          ? `${JSON.stringify(report, null, 2)}\n`
          : renderComponentTaxonomyAuditTextReport(report),
      );
      return {
        exitCode: selectComponentAuditExitCode({
          checkPassed: report.execution.checkPassed,
        }),
        report,
      };
    }

    // --apply
    const preflight = await runComponentTaxonomyAuditSnapshot({
      client: input.client,
      options,
      mode: 'apply',
      generatedAt: input.generatedAt,
      resolveOverride: input.applyHooks?.resolveOverride,
    });

    const eligible = input.applyHooks?.transformEligibleForApply
      ? input.applyHooks.transformEligibleForApply(preflight.eligible)
      : preflight.eligible;

    const bound = evaluateApplyEligibleBound(
      eligible.length,
      COMPONENT_TAXONOMY_AUDIT_MAX_APPLY_ELIGIBLE,
    );

    if (!bound.allowed) {
      const writes: ComponentTaxonomyAuditWrites = {
        attempted: 0,
        applied: 0,
        noopIdentical: 0,
        abortedPrecondition: 0,
        skippedOverLimit: true,
      };
      const overLimitReport: ComponentTaxonomyAuditReport = {
        ...preflight.report,
        execution: {
          ...preflight.report.execution,
          mode: 'apply',
          checkPassed: false,
        },
        writes,
        applyFailureCode: 'APPLY_ELIGIBLE_OVER_LIMIT',
        contentHash: preflight.report.contentHash,
      };
      write(
        options.json
          ? `${JSON.stringify(overLimitReport, null, 2)}\n`
          : renderComponentTaxonomyAuditTextReport(overLimitReport),
      );
      return {
        exitCode: selectComponentAuditExitCode({
          applyOverLimit: true,
          checkPassed: false,
        }),
        report: overLimitReport,
      };
    }

    let writes: ComponentTaxonomyAuditWrites;
    try {
      writes = await applyEligibleRepairs({
        client: input.client,
        eligible,
        timeoutMs: options.timeoutMs,
        hooks: input.applyHooks,
      });
    } catch (error) {
      if (error instanceof ComponentTaxonomyAuditPreconditionError) {
        const failedReport: ComponentTaxonomyAuditReport = {
          ...preflight.report,
          execution: {
            ...preflight.report.execution,
            mode: 'apply',
            checkPassed: false,
          },
          writes: {
            attempted: eligible.length,
            applied: 0,
            noopIdentical: 0,
            abortedPrecondition: 1,
            skippedOverLimit: false,
          },
          applyFailureCode: 'APPLY_PRECONDITION_FAILED',
        };
        write(
          options.json
            ? `${JSON.stringify(failedReport, null, 2)}\n`
            : renderComponentTaxonomyAuditTextReport(failedReport),
        );
        return {
          exitCode: selectComponentAuditExitCode({
            applyPreconditionFailed: true,
            checkPassed: false,
          }),
          report: failedReport,
        };
      }
      throw error;
    }

    const postflight = await runComponentTaxonomyAuditSnapshot({
      client: input.client,
      options,
      mode: 'apply',
      generatedAt: input.generatedAt,
      writes,
      resolveOverride: input.applyHooks?.resolveOverride,
    });

    write(
      options.json
        ? `${JSON.stringify(postflight.report, null, 2)}\n`
        : renderComponentTaxonomyAuditTextReport(postflight.report),
    );

    return {
      exitCode: selectComponentAuditExitCode({
        checkPassed: postflight.report.execution.checkPassed,
      }),
      report: postflight.report,
    };
  } finally {
    await input.client.$disconnect();
  }
};

const createProductionClient = async (): Promise<ComponentTaxonomyAuditClient> => {
  const { prisma } = await import('../src/database/prisma.js');
  return {
    $transaction: (fn, options) =>
      prisma.$transaction(
        (tx) => fn(tx as unknown as ComponentTaxonomyAuditTxClient),
        options,
      ),
    $disconnect: async () => prisma.$disconnect(),
  };
};

export const runComponentTaxonomyAuditCli = async (
  args: readonly string[] = process.argv.slice(2),
): Promise<number> => {
  try {
    const options = parseComponentTaxonomyAuditCliArgs(args);
    if (options.help) {
      process.stdout.write(`${COMPONENT_TAXONOMY_AUDIT_CLI_USAGE}\n`);
      return 0;
    }
    const client = await createProductionClient();
    const result = await executeComponentTaxonomyAudit({ client, args });
    return result.exitCode;
  } catch (error) {
    if (error instanceof ComponentTaxonomyAuditCliUsageError) {
      process.stderr.write(`${error.message}\n${COMPONENT_TAXONOMY_AUDIT_CLI_USAGE}\n`);
      return 2;
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 3;
  }
};

const isDirectRun = () => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
};

if (isDirectRun()) {
  runComponentTaxonomyAuditCli().then((code) => {
    process.exitCode = code;
  });
}
