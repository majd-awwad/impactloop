import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { TAXONOMY_CONCEPT_SEEDS } from './taxonomy-foundation.data.js';
import {
  createEmptyComponentConceptLifecycleDiagnostics,
  diffComponentConceptAssignments,
  recordComponentConceptDiagnosticSample,
  resolveComponentConceptAssignments,
  toComponentConceptIds,
  type ComponentConceptAssignmentRegistry,
  type ComponentConceptAssignmentRegistryConcept,
  type ComponentConceptLifecycleDiagnostics,
  type ComponentConceptReviewedMapping,
} from './component-concept-assignment.js';
import {
  isValidTaxonomyCanonicalKey,
  normalizeTaxonomyAlias,
} from './taxonomy-normalization.js';

type TaxonomyWriteClient = typeof prisma | Prisma.TransactionClient;

export const COMPONENT_CONCEPT_ASSIGNMENT_INTERNAL_MESSAGE =
  'Component concept assignment failed due to an internal error.';

const throwInternalAssignmentError = (reason: string): never => {
  throw new AppError(
    COMPONENT_CONCEPT_ASSIGNMENT_INTERNAL_MESSAGE,
    500,
    'INTERNAL_ERROR',
    { reason },
  );
};

const reviewedFoundationComponentMappings = (): {
  nameMappings: ComponentConceptReviewedMapping[];
  typeMappings: ComponentConceptReviewedMapping[];
  targetCanonicalKeys: string[];
} => {
  const nameMappings: ComponentConceptReviewedMapping[] = [];
  const typeMappings: ComponentConceptReviewedMapping[] = [];
  const targetCanonicalKeys = new Set<string>();

  for (const seed of TAXONOMY_CONCEPT_SEEDS) {
    if (seed.conceptType !== 'COMPONENT') {
      continue;
    }
    targetCanonicalKeys.add(seed.canonicalKey);
    for (const rule of seed.mappingRules) {
      if (rule.provenance !== 'REVIEWED') {
        continue;
      }
      for (const value of rule.componentNameValues ?? []) {
        nameMappings.push({
          value,
          canonicalKey: seed.canonicalKey,
          provenance: 'REVIEWED',
          source: rule.source,
        });
      }
      for (const value of rule.componentTypeValues ?? []) {
        typeMappings.push({
          value,
          canonicalKey: seed.canonicalKey,
          provenance: 'REVIEWED',
          source: rule.source,
        });
      }
    }
  }

  return {
    nameMappings,
    typeMappings,
    targetCanonicalKeys: [...targetCanonicalKeys].sort(),
  };
};

const projectLoadedConcepts = (
  concepts: readonly {
    id: string;
    canonicalKey: string;
    conceptType: string;
    status: string;
    aliases: readonly {
      normalizedAlias: string;
      source: string;
      isActive: boolean;
    }[];
  }[],
): ComponentConceptAssignmentRegistryConcept[] =>
  concepts.map((concept) => ({
    id: concept.id,
    canonicalKey: concept.canonicalKey,
    conceptType:
      concept.conceptType as ComponentConceptAssignmentRegistryConcept['conceptType'],
    status:
      concept.status as ComponentConceptAssignmentRegistryConcept['status'],
    aliases: concept.aliases.map((alias) => ({
      normalizedAlias: alias.normalizedAlias,
      source: alias.source,
      isActive: alias.isActive,
    })),
  }));

const collectExactCanonicalKeysFromEvidence = (
  components: readonly { componentName: string; materialType: string }[],
): string[] => {
  const keys = new Set<string>();
  for (const component of components) {
    for (const value of [component.componentName, component.materialType]) {
      const trimmed = value.trim();
      if (
        trimmed.includes(':')
        && (
          isValidTaxonomyCanonicalKey(trimmed)
          || /^(interest|material-family|material-form|project-topic|component):/u
            .test(trimmed)
        )
      ) {
        keys.add(trimmed);
      }
    }
  }
  return [...keys];
};

export const loadComponentAssignmentRegistry = async (
  client: TaxonomyWriteClient,
  components: readonly {
    id: string;
    componentName: string;
    materialType: string;
  }[],
): Promise<ComponentConceptAssignmentRegistry> => {
  const foundation = reviewedFoundationComponentMappings();
  const componentIds = components.map(({ id }) => id);

  const currentAssignmentConceptIds =
    componentIds.length === 0
      ? []
      : (
          await client.projectComponentConcept.findMany({
            where: { componentId: { in: [...componentIds] } },
            select: { conceptId: true },
          })
        ).map(({ conceptId }) => conceptId);

  const exactEvidenceKeys = collectExactCanonicalKeysFromEvidence(components);
  const canonicalKeys = [
    ...new Set([...foundation.targetCanonicalKeys, ...exactEvidenceKeys]),
  ];
  const assignmentIds = [...new Set(currentAssignmentConceptIds)];

  const orFilters: Prisma.TaxonomyConceptWhereInput[] = [];
  if (canonicalKeys.length > 0) {
    orFilters.push({ canonicalKey: { in: canonicalKeys } });
  }
  if (assignmentIds.length > 0) {
    orFilters.push({ id: { in: assignmentIds } });
  }

  const concepts =
    orFilters.length === 0
      ? []
      : await client.taxonomyConcept.findMany({
          where: { OR: orFilters },
          select: {
            id: true,
            canonicalKey: true,
            conceptType: true,
            status: true,
            aliases: {
              select: {
                normalizedAlias: true,
                source: true,
                isActive: true,
              },
            },
          },
        });

  return {
    concepts: projectLoadedConcepts(concepts),
    componentNameMappings: foundation.nameMappings,
    componentTypeMappings: foundation.typeMappings,
  };
};

export type ComponentConceptAssignmentPersistenceDeps = {
  deleteAssignments: (
    client: TaxonomyWriteClient,
    componentId: string,
    conceptIds: readonly string[],
  ) => Promise<void>;
  createAssignment: (
    client: TaxonomyWriteClient,
    componentId: string,
    conceptId: string,
  ) => Promise<void>;
};

export const defaultComponentConceptAssignmentPersistenceDeps:
  ComponentConceptAssignmentPersistenceDeps = {
  deleteAssignments: async (client, componentId, conceptIds) => {
    await client.projectComponentConcept.deleteMany({
      where: {
        componentId,
        conceptId: { in: [...conceptIds] },
      },
    });
  },
  createAssignment: async (client, componentId, conceptId) => {
    await client.projectComponentConcept.create({
      data: { componentId, conceptId },
    });
  },
};

export const syncProjectComponentConceptAssignments = async (
  client: TaxonomyWriteClient,
  componentId: string,
  expectedConceptIds: readonly string[],
  diagnostics: ComponentConceptLifecycleDiagnostics,
  persistence: ComponentConceptAssignmentPersistenceDeps =
    defaultComponentConceptAssignmentPersistenceDeps,
): Promise<void> => {
  if (expectedConceptIds.length > 1) {
    return throwInternalAssignmentError('COMPONENT_CARDINALITY');
  }
  if (
    expectedConceptIds.length === 1
    && (!expectedConceptIds[0] || expectedConceptIds[0]!.trim().length === 0)
  ) {
    return throwInternalAssignmentError('COMPONENT_CONCEPT_ID_BLANK');
  }

  const currentRows = await client.projectComponentConcept.findMany({
    where: { componentId },
    select: { id: true, conceptId: true },
  });
  const currentConceptIds = currentRows.map((row) => row.conceptId);
  const diff = diffComponentConceptAssignments(
    currentConceptIds,
    expectedConceptIds,
  );

  if (diff.identical) {
    if (expectedConceptIds.length === 1) {
      diagnostics.summary.assignedCount += 1;
    } else {
      diagnostics.summary.unmappedCount += 1;
    }
    return;
  }

  if (diff.toDelete.length > 0) {
    await persistence.deleteAssignments(client, componentId, diff.toDelete);
    diagnostics.summary.staleRepairedCount += diff.toDelete.length;
    for (const conceptId of diff.toDelete) {
      recordComponentConceptDiagnosticSample(diagnostics, 'STALE_REPAIRED', {
        componentId,
        evidenceField: 'assignment.conceptId',
        normalizedValue: conceptId,
        candidateCanonicalKeys: [],
      });
    }
  }

  if (diff.toCreate.length > 0) {
    for (const conceptId of diff.toCreate) {
      await persistence.createAssignment(client, componentId, conceptId);
    }
    diagnostics.summary.missingRepairedCount += diff.toCreate.length;
    for (const conceptId of diff.toCreate) {
      recordComponentConceptDiagnosticSample(diagnostics, 'MISSING_REPAIRED', {
        componentId,
        evidenceField: 'assignment.conceptId',
        normalizedValue: conceptId,
        candidateCanonicalKeys: [],
      });
    }
  }

  if (expectedConceptIds.length === 1) {
    diagnostics.summary.assignedCount += 1;
  } else {
    diagnostics.summary.unmappedCount += 1;
  }
};

const reconcileComponentRows = async (
  client: TaxonomyWriteClient,
  components: Array<{
    id: string;
    componentName: string;
    materialType: string;
  }>,
  persistence: ComponentConceptAssignmentPersistenceDeps,
): Promise<ComponentConceptLifecycleDiagnostics> => {
  const diagnostics = createEmptyComponentConceptLifecycleDiagnostics();
  const ordered = [...components].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  diagnostics.summary.componentCount = ordered.length;

  if (ordered.length === 0) {
    return diagnostics;
  }

  const registry = await loadComponentAssignmentRegistry(client, ordered);

  for (const component of ordered) {
    const result = resolveComponentConceptAssignments(
      {
        componentName: component.componentName,
        materialType: component.materialType,
      },
      registry,
    );

    for (const item of result.unmatched) {
      recordComponentConceptDiagnosticSample(diagnostics, item.reason, {
        componentId: component.id,
        evidenceField: item.field,
        normalizedValue: item.normalizedValue || normalizeTaxonomyAlias(
          item.rawValue ?? '',
        ),
        candidateCanonicalKeys: item.candidateCanonicalKeys,
      });
    }

    let expectedConceptIds: string[];
    try {
      expectedConceptIds = toComponentConceptIds(result);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'COMPONENT_RESOLVE_FAILED';
      return throwInternalAssignmentError(reason);
    }

    await syncProjectComponentConceptAssignments(
      client,
      component.id,
      expectedConceptIds,
      diagnostics,
      persistence,
    );
  }

  return diagnostics;
};

export const reconcileProjectRequiredComponent = async (
  client: TaxonomyWriteClient,
  componentId: string,
  persistence: ComponentConceptAssignmentPersistenceDeps =
    defaultComponentConceptAssignmentPersistenceDeps,
): Promise<ComponentConceptLifecycleDiagnostics> => {
  const component = await client.projectRequiredComponent.findUnique({
    where: { id: componentId },
    select: {
      id: true,
      componentName: true,
      materialType: true,
    },
  });
  if (!component) {
    throw new AppError('Project component not found.', 404, 'NOT_FOUND');
  }
  return reconcileComponentRows(client, [component], persistence);
};

export const reconcileLearningProjectComponents = async (
  client: TaxonomyWriteClient,
  projectId: string,
  persistence: ComponentConceptAssignmentPersistenceDeps =
    defaultComponentConceptAssignmentPersistenceDeps,
): Promise<ComponentConceptLifecycleDiagnostics> => {
  const components = await client.projectRequiredComponent.findMany({
    where: { projectId },
    select: {
      id: true,
      componentName: true,
      materialType: true,
    },
    orderBy: { id: 'asc' },
  });
  return reconcileComponentRows(client, components, persistence);
};

export type ComponentConceptLifecycleDeps = {
  reconcileLearningProjectComponents: (
    client: TaxonomyWriteClient,
    projectId: string,
  ) => Promise<ComponentConceptLifecycleDiagnostics>;
  reconcileProjectRequiredComponent: (
    client: TaxonomyWriteClient,
    componentId: string,
  ) => Promise<ComponentConceptLifecycleDiagnostics>;
};

export const createComponentConceptLifecycleDeps = (
  persistence: ComponentConceptAssignmentPersistenceDeps =
    defaultComponentConceptAssignmentPersistenceDeps,
): ComponentConceptLifecycleDeps => ({
  reconcileLearningProjectComponents: (client, projectId) =>
    reconcileLearningProjectComponents(client, projectId, persistence),
  reconcileProjectRequiredComponent: (client, componentId) =>
    reconcileProjectRequiredComponent(client, componentId, persistence),
});

export const defaultComponentConceptLifecycleDeps: ComponentConceptLifecycleDeps =
  createComponentConceptLifecycleDeps();
