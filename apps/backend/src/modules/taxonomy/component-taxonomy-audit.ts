import { createHash } from 'node:crypto';

import {
  type ComponentConceptAssignmentRegistry,
  type ComponentConceptAssignmentResult,
} from './component-concept-assignment.js';
import {
  isValidTaxonomyCanonicalKey,
  normalizeTaxonomyAlias,
} from './taxonomy-normalization.js';

export const COMPONENT_TAXONOMY_AUDIT_SCHEMA_VERSION =
  'component-taxonomy-audit-v1' as const;
export const COMPONENT_TAXONOMY_AUDIT_INVENTORY_BOUNDARY_VERSION =
  'public-published-projects-v1' as const;
export const COMPONENT_TAXONOMY_AUDIT_MAX_APPLY_ELIGIBLE = 500 as const;
export const COMPONENT_TAXONOMY_AUDIT_DEFAULT_SAMPLE_LIMIT = 20 as const;

export const COMPONENT_ISSUE_CLASSIFICATIONS = [
  'READY',
  'AUTO_REPAIR_ELIGIBLE',
  'UNMAPPED',
  'AMBIGUOUS',
  'INACTIVE_CONCEPT',
  'WRONG_CONCEPT_TYPE',
  'MALFORMED_CANONICAL_KEY',
  'MULTIPLE_ASSIGNMENTS',
  'STALE_ASSIGNMENT',
] as const;

export type ComponentIssueClassification =
  (typeof COMPONENT_ISSUE_CLASSIFICATIONS)[number];

export type StoredComponentAssignment = {
  assignmentId?: string;
  conceptId: string;
  canonicalKey: string;
  conceptType: string;
  status: string;
};

export type AuditComponentInput = {
  projectId: string;
  componentId: string;
  componentName: string;
  materialType: string;
  isRequired: boolean;
  assignments: readonly StoredComponentAssignment[];
};

export type AuthoritativeSingletonTarget = {
  conceptId: string;
  canonicalKey: string;
};

export type AssignmentStructuralValidity = {
  canonicalKey: string;
  active: boolean;
  conceptTypeIsComponent: boolean;
  canonicalKeyWellFormed: boolean;
};

export type ComponentSemanticRow = {
  componentNameEvidenceHash: string;
  materialTypeEvidenceHash: string;
  isRequired: boolean;
  assignmentCanonicalKeys: string[];
  assignmentStructural: AssignmentStructuralValidity[];
  resolverStatus: ComponentConceptAssignmentResult['status'];
  resolverCanonicalKeys: string[];
  authoritativeSingletonValid: boolean;
  classification: ComponentIssueClassification;
};

export type ComponentAuditSample = {
  projectId: string;
  componentId: string;
  isRequired: boolean;
  componentNameEvidenceHash: string;
  materialTypeEvidenceHash: string;
  assignmentCanonicalKeys: string[];
  resolverStatus: ComponentConceptAssignmentResult['status'];
  resolverCanonicalKeys: string[];
  classification: ComponentIssueClassification;
};

export type BoundedIssueBucket<T> = {
  total: number;
  sampleLimit: number;
  truncated: boolean;
  samples: T[];
};

export type ComponentClassificationResult = {
  projectId: string;
  componentId: string;
  componentName: string;
  materialType: string;
  isRequired: boolean;
  classification: ComponentIssueClassification;
  resolverStatus: ComponentConceptAssignmentResult['status'];
  resolverCanonicalKeys: string[];
  assignmentCanonicalKeys: string[];
  authoritativeSingleton: AuthoritativeSingletonTarget | null;
  authoritativeSingletonValid: boolean;
  semantic: ComponentSemanticRow;
  sample: ComponentAuditSample;
};

const asciiCompare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const hashTaxonomyEvidence = (raw: string) =>
  `sha256:${createHash('sha256')
    .update(normalizeTaxonomyAlias(raw))
    .digest('hex')}`;

export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Canonical JSON cannot contain non-finite numbers.');
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort(asciiCompare)
      .map((key) => {
        if (value[key] === undefined) {
          throw new Error(`Canonical JSON cannot contain undefined at ${key}.`);
        }
        return `${JSON.stringify(key)}:${canonicalJson(value[key])}`;
      })
      .join(',')}}`;
  }
  throw new Error(`Unsupported canonical JSON value: ${typeof value}`);
};

export const stableContentHash = (value: unknown) =>
  `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;

const isCanonicalKeyWellFormed = (canonicalKey: string) =>
  isValidTaxonomyCanonicalKey(canonicalKey)
  && canonicalKey.startsWith('component:');

const structuralIssueForAssignment = (
  assignment: StoredComponentAssignment,
): Extract<
  ComponentIssueClassification,
  | 'MALFORMED_CANONICAL_KEY'
  | 'WRONG_CONCEPT_TYPE'
  | 'INACTIVE_CONCEPT'
> | null => {
  if (!isCanonicalKeyWellFormed(assignment.canonicalKey)) {
    return 'MALFORMED_CANONICAL_KEY';
  }
  if (assignment.conceptType !== 'COMPONENT') {
    return 'WRONG_CONCEPT_TYPE';
  }
  if (assignment.status !== 'ACTIVE') {
    return 'INACTIVE_CONCEPT';
  }
  return null;
};

const toStructuralValidity = (
  assignment: StoredComponentAssignment,
): AssignmentStructuralValidity => ({
  canonicalKey: assignment.canonicalKey,
  active: assignment.status === 'ACTIVE',
  conceptTypeIsComponent: assignment.conceptType === 'COMPONENT',
  canonicalKeyWellFormed: isCanonicalKeyWellFormed(assignment.canonicalKey),
});

export const compareAssignmentStructural = (
  left: AssignmentStructuralValidity,
  right: AssignmentStructuralValidity,
): number => asciiCompare(canonicalJson(left), canonicalJson(right));

/**
 * Total order over every field of ComponentSemanticRow.
 * Ordering key is the canonical JSON of the complete semantic row (no DB IDs).
 */
export const compareSemanticRows = (
  left: ComponentSemanticRow,
  right: ComponentSemanticRow,
): number => asciiCompare(canonicalJson(left), canonicalJson(right));

/**
 * Authoritative singleton target from RP-02.6B resolver result + registry status.
 */
export const extractAuthoritativeSingleton = (
  resolver: ComponentConceptAssignmentResult,
  registry: ComponentConceptAssignmentRegistry,
): AuthoritativeSingletonTarget | null => {
  if (resolver.status !== 'READY' || resolver.assignments.length !== 1) {
    return null;
  }
  const assignment = resolver.assignments[0]!;
  if (assignment.conceptType !== 'COMPONENT') {
    return null;
  }
  if (!isCanonicalKeyWellFormed(assignment.canonicalKey)) {
    return null;
  }
  const concept = registry.concepts.find(
    (entry) => entry.id === assignment.conceptId,
  );
  if (!concept || concept.status !== 'ACTIVE') {
    return null;
  }
  if (concept.conceptType !== 'COMPONENT') {
    return null;
  }
  if (!isCanonicalKeyWellFormed(concept.canonicalKey)) {
    return null;
  }
  return {
    conceptId: assignment.conceptId,
    canonicalKey: concept.canonicalKey,
  };
};

const distinctConceptIds = (
  assignments: readonly StoredComponentAssignment[],
): string[] =>
  [...new Set(assignments.map((row) => row.conceptId))].sort(asciiCompare);

const setsEqual = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/**
 * First-match-wins classification per RP-02.7 locked precedence.
 */
export const classifyComponentTaxonomyAssignment = (input: {
  component: AuditComponentInput;
  resolver: ComponentConceptAssignmentResult;
  registry: ComponentConceptAssignmentRegistry;
}): ComponentClassificationResult => {
  const { component, resolver, registry } = input;
  const assignments = [...component.assignments];
  const assignmentCount = assignments.length;
  const currentIds = distinctConceptIds(assignments);
  const singleton = extractAuthoritativeSingleton(resolver, registry);
  const authoritativeSingletonValid = singleton !== null;
  const expectedIds = singleton ? [singleton.conceptId] : [];
  const identical = setsEqual(currentIds, expectedIds);

  let classification: ComponentIssueClassification;

  if (assignmentCount > 1 && !authoritativeSingletonValid) {
    classification = 'MULTIPLE_ASSIGNMENTS';
  } else if (authoritativeSingletonValid && !identical) {
    classification = 'AUTO_REPAIR_ELIGIBLE';
  } else if (authoritativeSingletonValid && identical) {
    classification = 'READY';
  } else if (resolver.status === 'READY' && !authoritativeSingletonValid) {
    classification = 'UNMAPPED';
  } else if (assignmentCount > 1) {
    classification = 'MULTIPLE_ASSIGNMENTS';
  } else if (assignmentCount === 1) {
    classification =
      structuralIssueForAssignment(assignments[0]!) ?? 'STALE_ASSIGNMENT';
  } else if (resolver.status === 'AMBIGUOUS') {
    classification = 'AMBIGUOUS';
  } else {
    classification = 'UNMAPPED';
  }

  const assignmentCanonicalKeys = [
    ...new Set(assignments.map((row) => row.canonicalKey)),
  ].sort(asciiCompare);
  const resolverCanonicalKeys = [...resolver.canonicalKeys].sort(asciiCompare);
  const componentNameEvidenceHash = hashTaxonomyEvidence(component.componentName);
  const materialTypeEvidenceHash = hashTaxonomyEvidence(component.materialType);
  const assignmentStructural = assignments
    .map(toStructuralValidity)
    .sort(compareAssignmentStructural);

  const semantic: ComponentSemanticRow = {
    componentNameEvidenceHash,
    materialTypeEvidenceHash,
    isRequired: component.isRequired,
    assignmentCanonicalKeys,
    assignmentStructural,
    resolverStatus: resolver.status,
    resolverCanonicalKeys,
    authoritativeSingletonValid,
    classification,
  };

  const sample: ComponentAuditSample = {
    projectId: component.projectId,
    componentId: component.componentId,
    isRequired: component.isRequired,
    componentNameEvidenceHash,
    materialTypeEvidenceHash,
    assignmentCanonicalKeys,
    resolverStatus: resolver.status,
    resolverCanonicalKeys,
    classification,
  };

  return {
    projectId: component.projectId,
    componentId: component.componentId,
    componentName: component.componentName,
    materialType: component.materialType,
    isRequired: component.isRequired,
    classification,
    resolverStatus: resolver.status,
    resolverCanonicalKeys,
    assignmentCanonicalKeys,
    authoritativeSingleton: singleton,
    authoritativeSingletonValid,
    semantic,
    sample,
  };
};

const CLASSIFICATION_RANK: Record<ComponentIssueClassification, number> = {
  MULTIPLE_ASSIGNMENTS: 0,
  AUTO_REPAIR_ELIGIBLE: 1,
  UNMAPPED: 2,
  AMBIGUOUS: 3,
  MALFORMED_CANONICAL_KEY: 4,
  WRONG_CONCEPT_TYPE: 5,
  INACTIVE_CONCEPT: 6,
  STALE_ASSIGNMENT: 7,
  READY: 8,
};

export const compareSamples = (
  left: ComponentAuditSample,
  right: ComponentAuditSample,
): number =>
  CLASSIFICATION_RANK[left.classification]
    - CLASSIFICATION_RANK[right.classification]
  || Number(right.isRequired) - Number(left.isRequired)
  || asciiCompare(left.componentNameEvidenceHash, right.componentNameEvidenceHash)
  || asciiCompare(left.materialTypeEvidenceHash, right.materialTypeEvidenceHash)
  || asciiCompare(left.componentId, right.componentId);

const insertBounded = <T>(
  items: T[],
  item: T,
  limit: number,
  compare: (a: T, b: T) => number,
) => {
  items.push(item);
  items.sort(compare);
  if (items.length > limit) {
    items.length = limit;
  }
};

const blankClassificationCounts = (): Record<
  ComponentIssueClassification,
  number
> =>
  Object.fromEntries(
    COMPONENT_ISSUE_CLASSIFICATIONS.map((code) => [code, 0]),
  ) as Record<ComponentIssueClassification, number>;

export type ComponentTaxonomyAuditAccumulator = {
  sampleLimit: number;
  classifications: ComponentClassificationResult[];
  /** Exact PUBLIC_PROJECT_WHERE project count; not inferred from components. */
  activePublishedProjects: number;
  zeroAssignments: number;
  exactlyOneAssignment: number;
  multipleAssignments: number;
  inactiveConceptAssignments: number;
  nonComponentConceptAssignments: number;
  malformedComponentCanonicalKeyAssignments: number;
  assignmentsInconsistentWithResolver: number;
  ambiguousResolverResults: number;
  unmappedResolverResults: number;
  sampleBuckets: Map<ComponentIssueClassification, ComponentAuditSample[]>;
  sampleTotals: Map<ComponentIssueClassification, number>;
};

export const createComponentTaxonomyAuditAccumulator = (
  sampleLimit: number,
): ComponentTaxonomyAuditAccumulator => ({
  sampleLimit,
  classifications: [],
  activePublishedProjects: 0,
  zeroAssignments: 0,
  exactlyOneAssignment: 0,
  multipleAssignments: 0,
  inactiveConceptAssignments: 0,
  nonComponentConceptAssignments: 0,
  malformedComponentCanonicalKeyAssignments: 0,
  assignmentsInconsistentWithResolver: 0,
  ambiguousResolverResults: 0,
  unmappedResolverResults: 0,
  sampleBuckets: new Map(),
  sampleTotals: new Map(),
});

export const accumulateComponentClassification = (
  acc: ComponentTaxonomyAuditAccumulator,
  component: AuditComponentInput,
  classified: ComponentClassificationResult,
): void => {
  acc.classifications.push(classified);

  const count = component.assignments.length;
  if (count === 0) {
    acc.zeroAssignments += 1;
  } else if (count === 1) {
    acc.exactlyOneAssignment += 1;
  } else {
    acc.multipleAssignments += 1;
  }

  for (const assignment of component.assignments) {
    if (assignment.status !== 'ACTIVE') {
      acc.inactiveConceptAssignments += 1;
    }
    if (assignment.conceptType !== 'COMPONENT') {
      acc.nonComponentConceptAssignments += 1;
    }
    if (!isCanonicalKeyWellFormed(assignment.canonicalKey)) {
      acc.malformedComponentCanonicalKeyAssignments += 1;
    }
  }

  if (classified.resolverStatus === 'AMBIGUOUS') {
    acc.ambiguousResolverResults += 1;
  }
  if (classified.resolverStatus === 'UNMAPPED') {
    acc.unmappedResolverResults += 1;
  }

  const singleton = classified.authoritativeSingleton;
  const currentIds = distinctConceptIds(component.assignments);
  const expectedIds = singleton ? [singleton.conceptId] : [];
  if (!setsEqual(currentIds, expectedIds)) {
    if (singleton || component.assignments.length > 0) {
      acc.assignmentsInconsistentWithResolver += 1;
    }
  }

  const total = (acc.sampleTotals.get(classified.classification) ?? 0) + 1;
  acc.sampleTotals.set(classified.classification, total);
  const bucket = acc.sampleBuckets.get(classified.classification) ?? [];
  insertBounded(bucket, classified.sample, acc.sampleLimit, compareSamples);
  acc.sampleBuckets.set(classified.classification, bucket);
};

export type RequiredCoverage = {
  validRequiredComponents: number;
  numerator: number;
  denominator: number;
  percentage: number;
};

export const calculateRequiredCoverage = (
  classifications: readonly ComponentClassificationResult[],
): RequiredCoverage => {
  const required = classifications.filter((row) => row.isRequired);
  const validRequiredComponents = required.filter(
    (row) => row.classification === 'READY',
  ).length;
  const denominator = required.length;
  const percentage =
    denominator === 0
      ? 100
      : Number(((validRequiredComponents / denominator) * 100).toFixed(4));
  return {
    validRequiredComponents,
    numerator: validRequiredComponents,
    denominator,
    percentage,
  };
};

export const evaluateRequiredGate = (
  coverage: RequiredCoverage,
  classifications: readonly ComponentClassificationResult[],
): boolean => {
  if (coverage.percentage !== 100 || coverage.numerator !== coverage.denominator) {
    return false;
  }
  return !classifications.some(
    (row) => row.isRequired && row.classification !== 'READY',
  );
};

export type ComponentTaxonomyAuditWrites = {
  attempted: number;
  applied: number;
  noopIdentical: number;
  abortedPrecondition: number;
  skippedOverLimit: boolean;
};

export type ComponentTaxonomyAuditReport = {
  schemaVersion: typeof COMPONENT_TAXONOMY_AUDIT_SCHEMA_VERSION;
  generatedAt: string;
  inventoryBoundaryVersion: typeof COMPONENT_TAXONOMY_AUDIT_INVENTORY_BOUNDARY_VERSION;
  execution: {
    mode: 'check' | 'apply';
    outputMode: 'json' | 'text';
    sampleLimit: number;
    batchSize: number;
    timeoutMs: number;
    checkPassed: boolean;
  };
  inventory: {
    activePublishedProjects: number;
    totalPublishedComponents: number;
    requiredPublishedComponents: number;
    optionalPublishedComponents: number;
    assignmentCardinality: {
      zero: number;
      exactlyOne: number;
      multiple: number;
    };
    assignmentStructural: {
      inactiveConceptAssignments: number;
      nonComponentConceptAssignments: number;
      malformedComponentCanonicalKeyAssignments: number;
    };
    resolver: {
      assignmentsInconsistentWithResolver: number;
      autoRepairEligible: number;
      ambiguousResolverResults: number;
      unmappedResolverResults: number;
    };
  };
  requiredCoverage: RequiredCoverage;
  summary: {
    perClassificationCounts: Record<ComponentIssueClassification, number>;
    perClassificationCountsByRequired: {
      required: Record<ComponentIssueClassification, number>;
      optional: Record<ComponentIssueClassification, number>;
    };
    requiredInvalidCount: number;
    optionalUnresolvedCount: number;
    autoRepairEligibleCount: number;
  };
  samples: {
    byClassification: Record<
      ComponentIssueClassification,
      BoundedIssueBucket<ComponentAuditSample>
    >;
  };
  writes?: ComponentTaxonomyAuditWrites;
  applyFailureCode?: 'APPLY_ELIGIBLE_OVER_LIMIT' | 'APPLY_PRECONDITION_FAILED';
  contentHash: string;
};

const buildClassificationCounts = (
  classifications: readonly ComponentClassificationResult[],
): {
  all: Record<ComponentIssueClassification, number>;
  required: Record<ComponentIssueClassification, number>;
  optional: Record<ComponentIssueClassification, number>;
} => {
  const all = blankClassificationCounts();
  const required = blankClassificationCounts();
  const optional = blankClassificationCounts();
  for (const row of classifications) {
    all[row.classification] += 1;
    if (row.isRequired) {
      required[row.classification] += 1;
    } else {
      optional[row.classification] += 1;
    }
  }
  return { all, required, optional };
};

export const buildSemanticHashPayload = (input: {
  activePublishedProjects: number;
  requiredCoverage: RequiredCoverage;
  classificationCounts: {
    required: Record<ComponentIssueClassification, number>;
    optional: Record<ComponentIssueClassification, number>;
  };
  semanticRows: readonly ComponentSemanticRow[];
}) => {
  const sortedSemanticRows = [...input.semanticRows].sort(compareSemanticRows);
  return {
    schemaVersion: COMPONENT_TAXONOMY_AUDIT_SCHEMA_VERSION,
    inventoryBoundaryVersion: COMPONENT_TAXONOMY_AUDIT_INVENTORY_BOUNDARY_VERSION,
    activePublishedProjects: input.activePublishedProjects,
    requiredCoverage: input.requiredCoverage,
    classificationCounts: input.classificationCounts,
    sortedSemanticRows,
  };
};

export const buildComponentTaxonomyAuditReport = (input: {
  generatedAt?: string;
  mode: 'check' | 'apply';
  outputMode: 'json' | 'text';
  sampleLimit: number;
  batchSize: number;
  timeoutMs: number;
  accumulator: ComponentTaxonomyAuditAccumulator;
  writes?: ComponentTaxonomyAuditWrites;
  applyFailureCode?: ComponentTaxonomyAuditReport['applyFailureCode'];
}): ComponentTaxonomyAuditReport => {
  const acc = input.accumulator;
  const counts = buildClassificationCounts(acc.classifications);
  const requiredCoverage = calculateRequiredCoverage(acc.classifications);
  const checkPassed = evaluateRequiredGate(requiredCoverage, acc.classifications);
  const autoRepairEligibleCount = counts.all.AUTO_REPAIR_ELIGIBLE;
  const requiredInvalidCount = acc.classifications.filter(
    (row) => row.isRequired && row.classification !== 'READY',
  ).length;
  const optionalUnresolvedCount = acc.classifications.filter(
    (row) => !row.isRequired && row.classification !== 'READY',
  ).length;

  const byClassification = Object.fromEntries(
    COMPONENT_ISSUE_CLASSIFICATIONS.map((code) => {
      const samples = acc.sampleBuckets.get(code) ?? [];
      const total = acc.sampleTotals.get(code) ?? 0;
      return [
        code,
        {
          total,
          sampleLimit: input.sampleLimit,
          truncated: total > samples.length,
          samples,
        } satisfies BoundedIssueBucket<ComponentAuditSample>,
      ];
    }),
  ) as Record<
    ComponentIssueClassification,
    BoundedIssueBucket<ComponentAuditSample>
  >;

  const semanticRows = acc.classifications.map((row) => row.semantic);
  const contentHash = stableContentHash(
    buildSemanticHashPayload({
      activePublishedProjects: acc.activePublishedProjects,
      requiredCoverage,
      classificationCounts: {
        required: counts.required,
        optional: counts.optional,
      },
      semanticRows,
    }),
  );

  const requiredPublishedComponents = acc.classifications.filter(
    (row) => row.isRequired,
  ).length;
  const optionalPublishedComponents =
    acc.classifications.length - requiredPublishedComponents;

  return {
    schemaVersion: COMPONENT_TAXONOMY_AUDIT_SCHEMA_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    inventoryBoundaryVersion: COMPONENT_TAXONOMY_AUDIT_INVENTORY_BOUNDARY_VERSION,
    execution: {
      mode: input.mode,
      outputMode: input.outputMode,
      sampleLimit: input.sampleLimit,
      batchSize: input.batchSize,
      timeoutMs: input.timeoutMs,
      checkPassed,
    },
    inventory: {
      activePublishedProjects: acc.activePublishedProjects,
      totalPublishedComponents: acc.classifications.length,
      requiredPublishedComponents,
      optionalPublishedComponents,
      assignmentCardinality: {
        zero: acc.zeroAssignments,
        exactlyOne: acc.exactlyOneAssignment,
        multiple: acc.multipleAssignments,
      },
      assignmentStructural: {
        inactiveConceptAssignments: acc.inactiveConceptAssignments,
        nonComponentConceptAssignments: acc.nonComponentConceptAssignments,
        malformedComponentCanonicalKeyAssignments:
          acc.malformedComponentCanonicalKeyAssignments,
      },
      resolver: {
        assignmentsInconsistentWithResolver:
          acc.assignmentsInconsistentWithResolver,
        autoRepairEligible: autoRepairEligibleCount,
        ambiguousResolverResults: acc.ambiguousResolverResults,
        unmappedResolverResults: acc.unmappedResolverResults,
      },
    },
    requiredCoverage,
    summary: {
      perClassificationCounts: counts.all,
      perClassificationCountsByRequired: {
        required: counts.required,
        optional: counts.optional,
      },
      requiredInvalidCount,
      optionalUnresolvedCount,
      autoRepairEligibleCount,
    },
    samples: { byClassification },
    ...(input.writes ? { writes: input.writes } : {}),
    ...(input.applyFailureCode
      ? { applyFailureCode: input.applyFailureCode }
      : {}),
    contentHash,
  };
};

export const renderComponentTaxonomyAuditTextReport = (
  report: ComponentTaxonomyAuditReport,
): string => {
  const lines = [
    'Component taxonomy mapping audit (RP-02.7 / Gate A3)',
    `Generated: ${report.generatedAt}`,
    `Schema: ${report.schemaVersion}`,
    `Boundary: ${report.inventoryBoundaryVersion}`,
    '',
    `Mode: ${report.execution.mode}`,
    `Result: ${
      report.execution.checkPassed ? 'CHECK_PASS' : 'CHECK_FAIL'
    }`,
    `contentHash: ${report.contentHash}`,
    '',
    `Active published projects: ${report.inventory.activePublishedProjects}`,
    `Total components: ${report.inventory.totalPublishedComponents}`,
    `Required: ${report.inventory.requiredPublishedComponents}`,
    `Optional: ${report.inventory.optionalPublishedComponents}`,
    `Required coverage: ${report.requiredCoverage.numerator}/${report.requiredCoverage.denominator} (${report.requiredCoverage.percentage}%)`,
    `AUTO_REPAIR_ELIGIBLE: ${report.summary.autoRepairEligibleCount}`,
    `Required invalid: ${report.summary.requiredInvalidCount}`,
  ];
  if (report.applyFailureCode) {
    lines.push(`Apply failure: ${report.applyFailureCode}`);
  }
  if (report.writes) {
    lines.push(
      `Writes: attempted=${report.writes.attempted} applied=${report.writes.applied} noop=${report.writes.noopIdentical} aborted=${report.writes.abortedPrecondition} overLimit=${report.writes.skippedOverLimit}`,
    );
  }
  lines.push('', 'Classification counts:');
  for (const code of COMPONENT_ISSUE_CLASSIFICATIONS) {
    lines.push(`  ${code}: ${report.summary.perClassificationCounts[code]}`);
  }

  lines.push('', 'Bounded samples by classification:');
  for (const code of COMPONENT_ISSUE_CLASSIFICATIONS) {
    const bucket = report.samples.byClassification[code];
    if (!bucket || bucket.total === 0) {
      continue;
    }
    lines.push(
      `  ${code}: total=${bucket.total} shown=${bucket.samples.length} truncated=${bucket.truncated}`,
    );
    for (const sample of bucket.samples) {
      lines.push(
        `    projectId=${sample.projectId} componentId=${sample.componentId} isRequired=${sample.isRequired} nameHash=${sample.componentNameEvidenceHash} typeHash=${sample.materialTypeEvidenceHash} resolver=${sample.resolverStatus} resolverKeys=${sample.resolverCanonicalKeys.join(',') || '-'} assignmentKeys=${sample.assignmentCanonicalKeys.join(',') || '-'}`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
};

export type ApplyEligibleCandidate = {
  componentId: string;
  projectId: string;
  expectedConceptId: string;
  expectedCanonicalKey: string;
};

export const collectApplyEligibleCandidates = (
  classifications: readonly ComponentClassificationResult[],
): ApplyEligibleCandidate[] =>
  classifications
    .filter(
      (row) =>
        row.classification === 'AUTO_REPAIR_ELIGIBLE'
        && row.authoritativeSingleton !== null,
    )
    .map((row) => ({
      componentId: row.componentId,
      projectId: row.projectId,
      expectedConceptId: row.authoritativeSingleton!.conceptId,
      expectedCanonicalKey: row.authoritativeSingleton!.canonicalKey,
    }))
    .sort((a, b) => asciiCompare(a.componentId, b.componentId));

export const evaluateApplyEligibleBound = (
  eligibleCount: number,
  maxEligible: number = COMPONENT_TAXONOMY_AUDIT_MAX_APPLY_ELIGIBLE,
): { allowed: boolean; code?: 'APPLY_ELIGIBLE_OVER_LIMIT' } => {
  if (eligibleCount > maxEligible) {
    return { allowed: false, code: 'APPLY_ELIGIBLE_OVER_LIMIT' };
  }
  return { allowed: true };
};

export type ComponentAuditExitCode = 0 | 1 | 2 | 3 | 4;

export const selectComponentAuditExitCode = (input: {
  usageError?: boolean;
  runtimeError?: boolean;
  applyOverLimit?: boolean;
  applyPreconditionFailed?: boolean;
  checkPassed: boolean;
}): ComponentAuditExitCode => {
  if (input.usageError) {
    return 2;
  }
  if (input.applyPreconditionFailed) {
    return 4;
  }
  if (input.runtimeError || input.applyOverLimit) {
    return 3;
  }
  return input.checkPassed ? 0 : 1;
};

export const PUBLIC_PROJECT_WHERE = {
  status: 'PUBLISHED' as const,
  category: {
    isActive: true,
    categoryType: {
      in: ['PROJECT', 'BOTH'] as const,
    },
  },
};
