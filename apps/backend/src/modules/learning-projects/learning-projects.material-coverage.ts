import type {
  Prisma,
  ProjectBuildItemStatus,
  ProjectComponentRole,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import {
  getMaterialQuantityStates,
  type MaterialQuantityState,
} from '../reservations/reservations.quantity.js';

import {
  evaluateMaterialLinkCapacity,
  unitsAreCompatible,
} from './learning-projects.build-material-allocation.js';
import { resolveBuildItemReadiness } from './learning-projects.build-item-state.js';
import {
  parseJsonStringArray,
  scoreMaterialAgainstComponent,
  type MaterialForComponentMatching,
} from './learning-projects.material-component-matching.js';
import {
  findMaterialIdsByConceptIds,
  loadComponentTaxonomyContexts,
  loadMaterialTaxonomyContexts,
} from './project-material-taxonomy-context.js';

const PUBLIC_COVERAGE_MATERIAL_STATUSES = ['AVAILABLE'] as const;
const COVERAGE_CANDIDATE_POOL_LIMIT = 60;

export type ComponentPublicAvailabilityStatus =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'MISSING'
  | 'UNKNOWN';

export type MaterialCoverageLevel = 'FULL' | 'MOST' | 'SOME' | 'NONE' | 'UNKNOWN';

export type MaterialAvailabilityFilter = 'ANY' | 'FULL' | 'MOST' | 'SOME' | 'NONE';

export type LearningProjectsBrowseSort =
  | 'DEFAULT'
  | 'MOST_AVAILABLE'
  | 'SHORTEST_DURATION'
  | 'EASIEST'
  | 'MOST_POPULAR'
  | 'NEWEST';

export type ProjectMaterialCoverageSummary = {
  totalRequiredComponents: number;
  availableComponents: number;
  partialComponents: number;
  missingComponents: number;
  unknownComponents: number;
  availabilityRatio: number;
  coverageLevel: MaterialCoverageLevel;
};

export type ProjectComponentCoverageItem = {
  componentId: string;
  componentName: string;
  availabilityStatus: ComponentPublicAvailabilityStatus;
};

export type ProjectPersonalBuildReadiness = {
  buildId: string;
  buildStatus: 'IN_PROGRESS' | 'COMPLETED';
  readyComponents: number;
  totalRequiredComponents: number;
  needsMaterialComponents: number;
  readinessRatio: number;
};

export type ProjectMaterialCoverageResult = {
  materialCoverage: ProjectMaterialCoverageSummary;
  componentCoverage: ProjectComponentCoverageItem[];
  personalBuildReadiness: ProjectPersonalBuildReadiness | null;
};

export const EMPTY_COVERAGE_SUMMARY: ProjectMaterialCoverageSummary = Object.freeze({
  totalRequiredComponents: 0,
  availableComponents: 0,
  partialComponents: 0,
  missingComponents: 0,
  unknownComponents: 0,
  availabilityRatio: 0,
  coverageLevel: 'UNKNOWN',
});

/** True when coverage must run before filter/sort/pagination to preserve semantics. */
export const requiresCoverageBeforePagination = (input: {
  availability?: MaterialAvailabilityFilter | null;
  sort?: LearningProjectsBrowseSort | null;
}) => {
  const availability = input.availability ?? 'ANY';
  const sort = input.sort ?? 'DEFAULT';

  if (availability !== 'ANY') {
    return true;
  }

  return sort === 'MOST_AVAILABLE';
};

type CoverageComponentRecord = {
  id: string;
  projectId: string;
  componentName: string;
  materialType: string;
  categoryId: string | null;
  quantity: Prisma.Decimal;
  unit: string;
  componentRole: ProjectComponentRole;
  isRequired: boolean;
  canBeSubstituted: boolean;
  searchKeywords: Prisma.JsonValue | null;
  alternativeKeywords: Prisma.JsonValue | null;
  createdAt: Date;
};

const coverageComponentSelect = {
  id: true,
  projectId: true,
  componentName: true,
  materialType: true,
  categoryId: true,
  quantity: true,
  unit: true,
  componentRole: true,
  isRequired: true,
  canBeSubstituted: true,
  searchKeywords: true,
  alternativeKeywords: true,
  createdAt: true,
} satisfies Prisma.ProjectRequiredComponentSelect;

const coverageMaterialSelect = {
  id: true,
  title: true,
  description: true,
  materialType: true,
  unit: true,
  categoryId: true,
  tags: {
    select: {
      tag: true,
    },
  },
} satisfies Prisma.MaterialSelect;

type CoverageMaterialRecord = Prisma.MaterialGetPayload<{
  select: typeof coverageMaterialSelect;
}>;

type CoverageEvaluationContext = {
  candidateMaterialsByKey: Map<string, Promise<CoverageMaterialRecord[]>>;
  pendingQuantityMaterialIds: Set<string>;
  quantityStateByMaterialId: Map<string, MaterialQuantityState | null>;
};

const decimalToNumber = (value: Prisma.Decimal): number => value.toNumber();

export const isCoverageRequiredMaterialComponent = (component: {
  componentRole: ProjectComponentRole | string;
  isRequired: boolean;
}) => {
  if (component.componentRole === 'TOOL') {
    return false;
  }

  if (component.componentRole === 'OPTIONAL_MATERIAL') {
    return false;
  }

  return component.isRequired;
};

const buildCoverageSearchTerms = (component: {
  componentName: string;
  materialType: string;
  searchKeywords: Prisma.JsonValue | null;
  alternativeKeywords: Prisma.JsonValue | null;
}) => {
  const terms = new Set<string>();
  const name = component.componentName.trim();
  if (name.length > 0) {
    terms.add(name);
  }

  for (const keyword of parseJsonStringArray(component.searchKeywords)) {
    terms.add(keyword);
  }

  for (const keyword of parseJsonStringArray(component.alternativeKeywords)) {
    terms.add(keyword);
  }

  const materialType = component.materialType.trim();
  const normalizedType = materialType.toLowerCase();
  if (
    materialType.length > 0 &&
    normalizedType !== 'general' &&
    normalizedType !== 'unspecified'
  ) {
    terms.add(materialType);
  }

  return [...terms];
};

const buildPublicCoverageMaterialWhere = (input: {
  categoryId: string | null;
  searchTerms: string[];
}): Prisma.MaterialWhereInput => {
  const where: Prisma.MaterialWhereInput = {
    status: { in: [...PUBLIC_COVERAGE_MATERIAL_STATUSES] },
    category: {
      isActive: true,
      categoryType: {
        in: ['MATERIAL', 'BOTH'],
      },
    },
  };

  if (input.categoryId) {
    where.categoryId = input.categoryId;
  } else if (input.searchTerms.length > 0) {
    where.OR = input.searchTerms.flatMap((term) => [
      {
        title: {
          contains: term,
          mode: 'insensitive' as const,
        },
      },
      {
        description: {
          contains: term,
          mode: 'insensitive' as const,
        },
      },
      {
        materialType: {
          contains: term,
          mode: 'insensitive' as const,
        },
      },
      {
        tags: {
          some: {
            tag: {
              contains: term,
              mode: 'insensitive' as const,
            },
          },
        },
      },
    ]);
  }

  return where;
};

const buildCoverageCandidateCacheKey = (where: Prisma.MaterialWhereInput) =>
  JSON.stringify(where);

const toMatchingMaterial = (
  material: CoverageMaterialRecord,
  conceptCanonicalKeys: string[] = [],
): MaterialForComponentMatching => ({
  id: material.id,
  title: material.title,
  description: material.description,
  materialType: material.materialType,
  categoryId: material.categoryId,
  tags: material.tags,
  conceptCanonicalKeys,
});

const toScoredComponentInput = (
  component: CoverageComponentRecord,
  componentPosition: number,
  taxonomy?: {
    conceptCanonicalKeys: string[];
    satisfiedByFormKeys: string[];
  },
) => ({
  id: component.id,
  projectId: component.projectId,
  componentName: component.componentName,
  materialType: component.materialType,
  categoryId: component.categoryId,
  quantity: component.quantity,
  unit: component.unit,
  canBeSubstituted: component.canBeSubstituted,
  componentRole: component.componentRole,
  isRequired: component.isRequired,
  searchKeywords: component.searchKeywords,
  alternativeKeywords: component.alternativeKeywords,
  componentPosition,
  conceptCanonicalKeys: taxonomy?.conceptCanonicalKeys,
  satisfiedByFormKeys: taxonomy?.satisfiedByFormKeys,
});

const fetchPublicCoverageCandidateMaterials = async (
  where: Prisma.MaterialWhereInput,
  context?: CoverageEvaluationContext,
) => {
  if (!context) {
    return prisma.material.findMany({
      where,
      select: coverageMaterialSelect,
      take: COVERAGE_CANDIDATE_POOL_LIMIT,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  const cacheKey = buildCoverageCandidateCacheKey(where);
  const cached = context.candidateMaterialsByKey.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = prisma.material.findMany({
    where,
    select: coverageMaterialSelect,
    take: COVERAGE_CANDIDATE_POOL_LIMIT,
    orderBy: {
      createdAt: 'desc',
    },
  });
  context.candidateMaterialsByKey.set(cacheKey, pending);
  return pending;
};

const ensureCoverageQuantityStates = async (
  context: CoverageEvaluationContext,
) => {
  const missingIds = [...context.pendingQuantityMaterialIds].filter(
    (materialId) => !context.quantityStateByMaterialId.has(materialId),
  );

  if (missingIds.length === 0) {
    return;
  }

  const states = await getMaterialQuantityStates(prisma, missingIds);
  for (const materialId of missingIds) {
    context.quantityStateByMaterialId.set(
      materialId,
      states.get(materialId) ?? null,
    );
  }
  context.pendingQuantityMaterialIds.clear();
};

const collectCompatibleCoverageMaterials = async (
  component: CoverageComponentRecord,
  componentPosition: number,
  context: CoverageEvaluationContext,
): Promise<CoverageMaterialRecord[]> => {
  if (!isCoverageRequiredMaterialComponent(component)) {
    return [];
  }

  const requiredQuantity = decimalToNumber(component.quantity);
  const requiredUnit = component.unit?.trim() ?? '';

  if (requiredQuantity <= 0 || requiredUnit.length === 0) {
    return [];
  }

  const componentTaxonomy = (
    await loadComponentTaxonomyContexts([component.id])
  ).get(component.id);

  const searchTerms = buildCoverageSearchTerms(component);
  let materials = await fetchPublicCoverageCandidateMaterials(
    buildPublicCoverageMaterialWhere({
      categoryId: component.categoryId,
      searchTerms,
    }),
    context,
  );

  if (materials.length === 0 && searchTerms.length > 0) {
    materials = await fetchPublicCoverageCandidateMaterials(
      buildPublicCoverageMaterialWhere({
        categoryId: null,
        searchTerms,
      }),
      context,
    );
  }

  if (materials.length === 0 && component.categoryId) {
    materials = await fetchPublicCoverageCandidateMaterials(
      buildPublicCoverageMaterialWhere({
        categoryId: component.categoryId,
        searchTerms: [],
      }),
      context,
    );
  }

  // Expand pool with concept-compatible materials (may cross category).
  const conceptMaterialIds = await findMaterialIdsByConceptIds(
    componentTaxonomy?.satisfiedByFormConceptIds ?? [],
    COVERAGE_CANDIDATE_POOL_LIMIT,
  );
  if (conceptMaterialIds.length > 0) {
    const existingIds = new Set(materials.map((material) => material.id));
    const missingIds = conceptMaterialIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      const conceptMaterials = await fetchPublicCoverageCandidateMaterials(
        {
          id: { in: missingIds },
          status: { in: [...PUBLIC_COVERAGE_MATERIAL_STATUSES] },
          category: {
            isActive: true,
            categoryType: { in: ['MATERIAL', 'BOTH'] },
          },
        },
        context,
      );
      materials = [...materials, ...conceptMaterials].slice(
        0,
        COVERAGE_CANDIDATE_POOL_LIMIT,
      );
    }
  }

  const materialTaxonomy = await loadMaterialTaxonomyContexts(
    materials.map((material) => material.id),
  );

  const scoredMaterialEntries = materials
    .map((material) => ({
      material,
      scored: scoreMaterialAgainstComponent({
        material: toMatchingMaterial(
          material,
          materialTaxonomy.get(material.id)?.conceptCanonicalKeys ?? [],
        ),
        component: toScoredComponentInput(component, componentPosition, {
          conceptCanonicalKeys: componentTaxonomy?.conceptCanonicalKeys ?? [],
          satisfiedByFormKeys: componentTaxonomy?.satisfiedByFormKeys ?? [],
        }),
      }),
    }))
    .filter(
      (
        entry,
      ): entry is {
        material: CoverageMaterialRecord;
        scored: NonNullable<ReturnType<typeof scoreMaterialAgainstComponent>>;
      } => entry.scored != null,
    );

  const compatibleEntries = scoredMaterialEntries.filter((entry) =>
    unitsAreCompatible(requiredUnit, entry.material.unit),
  );

  for (const entry of compatibleEntries) {
    if (!context.quantityStateByMaterialId.has(entry.material.id)) {
      context.pendingQuantityMaterialIds.add(entry.material.id);
    }
  }

  return compatibleEntries.map((entry) => entry.material);
};

const resolveComponentAvailabilityFromCompatibleMaterials = (
  compatibleMaterials: CoverageMaterialRecord[],
  requiredQuantity: number,
  context: CoverageEvaluationContext,
): ComponentPublicAvailabilityStatus => {
  if (compatibleMaterials.length === 0) {
    return 'MISSING';
  }

  for (const material of compatibleMaterials) {
    const quantityState = context.quantityStateByMaterialId.get(material.id);
    if (!quantityState) {
      continue;
    }

    const capacity = evaluateMaterialLinkCapacity({
      availableQuantity: decimalToNumber(quantityState.availableQuantity),
      peerSelectedClaims: 0,
      requiredQuantity,
    });

    if (capacity.ok) {
      return 'AVAILABLE';
    }
  }

  return 'PARTIAL';
};

export const evaluateComponentPublicAvailability = async (
  component: CoverageComponentRecord,
  componentPosition: number,
  context: CoverageEvaluationContext = {
    candidateMaterialsByKey: new Map(),
    pendingQuantityMaterialIds: new Set(),
    quantityStateByMaterialId: new Map(),
  },
): Promise<ComponentPublicAvailabilityStatus> => {
  if (!isCoverageRequiredMaterialComponent(component)) {
    return 'UNKNOWN';
  }

  const requiredQuantity = decimalToNumber(component.quantity);
  const requiredUnit = component.unit?.trim() ?? '';

  if (requiredQuantity <= 0 || requiredUnit.length === 0) {
    return 'UNKNOWN';
  }

  const compatibleMaterials = await collectCompatibleCoverageMaterials(
    component,
    componentPosition,
    context,
  );

  if (compatibleMaterials.length === 0) {
    return 'MISSING';
  }

  await ensureCoverageQuantityStates(context);

  return resolveComponentAvailabilityFromCompatibleMaterials(
    compatibleMaterials,
    requiredQuantity,
    context,
  );
};

export const summarizeMaterialCoverage = (
  componentCoverage: ProjectComponentCoverageItem[],
): ProjectMaterialCoverageSummary => {
  const totalRequiredComponents = componentCoverage.length;
  let availableComponents = 0;
  let partialComponents = 0;
  let missingComponents = 0;
  let unknownComponents = 0;

  for (const component of componentCoverage) {
    switch (component.availabilityStatus) {
      case 'AVAILABLE':
        availableComponents += 1;
        break;
      case 'PARTIAL':
        partialComponents += 1;
        break;
      case 'MISSING':
        missingComponents += 1;
        break;
      case 'UNKNOWN':
        unknownComponents += 1;
        break;
    }
  }

  const availabilityRatio =
    totalRequiredComponents === 0
      ? 0
      : availableComponents / totalRequiredComponents;

  let coverageLevel: MaterialCoverageLevel;

  if (totalRequiredComponents === 0) {
    coverageLevel = 'UNKNOWN';
  } else if (unknownComponents === totalRequiredComponents) {
    coverageLevel = 'UNKNOWN';
  } else if (
    availableComponents === totalRequiredComponents &&
    totalRequiredComponents > 0
  ) {
    coverageLevel = 'FULL';
  } else if (availabilityRatio >= 0.5 && availabilityRatio < 1) {
    coverageLevel = 'MOST';
  } else if (availabilityRatio > 0 && availabilityRatio < 0.5) {
    coverageLevel = 'SOME';
  } else {
    // availabilityRatio === 0 with at least one evaluated component.
    // PARTIAL-only projects land here (partial does not increase ratio).
    coverageLevel = 'NONE';
  }

  return {
    totalRequiredComponents,
    availableComponents,
    partialComponents,
    missingComponents,
    unknownComponents,
    availabilityRatio,
    coverageLevel,
  };
};

export const isPersonallyReadyBuildItem = (input: {
  status: ProjectBuildItemStatus;
  acquisitionState: string;
  allocationResult: string | null;
  allocationWarning?: string | null;
}) => {
  if (input.status === 'ALREADY_OWNED') {
    return true;
  }

  if (input.allocationWarning) {
    return false;
  }

  return (
    input.acquisitionState === 'acquired' &&
    input.allocationResult === 'sufficient'
  );
};

type BuildItemForPersonalReadiness = {
  id: string;
  status: ProjectBuildItemStatus;
  requiredComponent: CoverageComponentRecord;
  linkedMaterial: Parameters<typeof resolveBuildItemReadiness>[0]['linkedMaterial'];
  linkedReservation: Parameters<typeof resolveBuildItemReadiness>[0]['linkedReservation'];
};

export const summarizePersonalBuildReadiness = (input: {
  buildId: string;
  buildStatus: 'IN_PROGRESS' | 'COMPLETED';
  items: BuildItemForPersonalReadiness[];
  allocationByItemId: Map<
    string,
    {
      requiredQuantity: number;
      requiredUnit: string;
      componentRole: string;
      materialUnit: string | null;
      availableQuantity: number | null;
      peerClaimsOnMaterial: number;
      allocationWarning: string | null;
    }
  >;
}): ProjectPersonalBuildReadiness | null => {
  const requiredItems = input.items.filter((item) =>
    isCoverageRequiredMaterialComponent(item.requiredComponent),
  );

  if (requiredItems.length === 0) {
    return null;
  }

  let readyComponents = 0;

  for (const item of requiredItems) {
    const allocation = input.allocationByItemId.get(item.id);
    const readiness = resolveBuildItemReadiness({
      status: item.status,
      componentRole: allocation?.componentRole,
      requiredQuantity: allocation?.requiredQuantity,
      requiredUnit: allocation?.requiredUnit,
      materialUnit: allocation?.materialUnit,
      availableQuantity: allocation?.availableQuantity,
      peerClaimsOnMaterial: allocation?.peerClaimsOnMaterial,
      allocationWarning: allocation?.allocationWarning,
      linkedReservation: item.linkedReservation,
      linkedMaterial: item.linkedMaterial,
    });

    if (
      isPersonallyReadyBuildItem({
        status: item.status,
        acquisitionState: readiness.acquisitionState,
        allocationResult: readiness.allocationResult,
        allocationWarning: allocation?.allocationWarning,
      })
    ) {
      readyComponents += 1;
    }
  }

  const totalRequiredComponents = requiredItems.length;

  return {
    buildId: input.buildId,
    buildStatus: input.buildStatus,
    readyComponents,
    totalRequiredComponents,
    needsMaterialComponents: totalRequiredComponents - readyComponents,
    readinessRatio:
      totalRequiredComponents === 0
        ? 0
        : readyComponents / totalRequiredComponents,
  };
};

const loadCoverageComponentsForProjects = async (projectIds: string[]) => {
  if (projectIds.length === 0) {
    return [] as CoverageComponentRecord[];
  }

  return prisma.projectRequiredComponent.findMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
    select: coverageComponentSelect,
    orderBy: [{ projectId: 'asc' }, { createdAt: 'asc' }],
  });
};

export const attachPersonalBuildReadiness = async (input: {
  results: Map<string, ProjectMaterialCoverageResult>;
  learnerId: string;
  projectIds: string[];
}) => {
  const personalProjectIds = [...new Set(input.projectIds)];
  if (personalProjectIds.length === 0) {
    return input.results;
  }

  const builds = await prisma.projectBuild.findMany({
    where: {
      projectId: {
        in: personalProjectIds,
      },
      learnerId: input.learnerId,
      status: 'IN_PROGRESS',
    },
    select: {
      id: true,
      projectId: true,
      status: true,
      items: {
        select: {
          id: true,
          status: true,
          requiredComponent: {
            select: coverageComponentSelect,
          },
          linkedMaterial: {
            select: {
              id: true,
              title: true,
              condition: true,
              status: true,
              isFree: true,
              price: true,
              currency: true,
              pickupAllowed: true,
              deliveryAllowed: true,
              ownerId: true,
              materialType: true,
              unit: true,
              category: {
                select: {
                  id: true,
                  nameEn: true,
                  nameAr: true,
                },
              },
              location: {
                select: {
                  city: true,
                  area: true,
                },
              },
              images: {
                orderBy: [{ isCover: 'desc' as const }, { sortOrder: 'asc' as const }],
                take: 1,
                select: {
                  imageUrl: true,
                  isCover: true,
                },
              },
              supplierProfile: {
                select: {
                  publicName: true,
                  supplierType: true,
                  verificationStatus: true,
                  user: {
                    select: {
                      displayName: true,
                    },
                  },
                },
              },
              owner: {
                select: {
                  displayName: true,
                },
              },
            },
          },
          linkedReservation: {
            select: {
              id: true,
              status: true,
              materialId: true,
              quantityRequested: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  const latestBuildByProjectId = new Map<string, (typeof builds)[number]>();
  for (const build of builds) {
    if (!latestBuildByProjectId.has(build.projectId)) {
      latestBuildByProjectId.set(build.projectId, build);
    }
  }

  const { resolveBuildItemAllocationContext } = await import(
    './learning-projects.build-material-allocation.js'
  );

  for (const [projectId, build] of latestBuildByProjectId.entries()) {
    const coverage = input.results.get(projectId);
    if (!coverage) {
      continue;
    }

    const allocationContexts = await resolveBuildItemAllocationContext(prisma, {
      buildStatus: build.status,
      items: build.items.map((item) => ({
        id: item.id,
        status: item.status,
        requiredComponentId: item.requiredComponent.id,
        linkedMaterialId: item.linkedMaterial?.id ?? null,
        linkedReservationId: item.linkedReservation?.id ?? null,
        requiredComponent: item.requiredComponent,
        linkedMaterial: item.linkedMaterial,
        linkedReservation: item.linkedReservation,
      })),
    });

    const allocationByItemId = new Map(
      allocationContexts.map((context) => [context.itemId, context]),
    );

    coverage.personalBuildReadiness = summarizePersonalBuildReadiness({
      buildId: build.id,
      buildStatus:
        build.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
      items: build.items.map((item) => ({
        id: item.id,
        status: item.status,
        requiredComponent: item.requiredComponent,
        linkedMaterial: item.linkedMaterial,
        linkedReservation: item.linkedReservation,
      })),
      allocationByItemId,
    });
  }

  return input.results;
};

export const batchComputeProjectMaterialCoverage = async (input: {
  projectIds: string[];
  learnerId?: string;
  personalReadinessProjectIds?: string[];
}): Promise<Map<string, ProjectMaterialCoverageResult>> => {
  const uniqueProjectIds = [...new Set(input.projectIds)];
  const results = new Map<string, ProjectMaterialCoverageResult>();

  if (uniqueProjectIds.length === 0) {
    return results;
  }

  const components = await loadCoverageComponentsForProjects(uniqueProjectIds);
  const componentsByProjectId = new Map<string, CoverageComponentRecord[]>();

  for (const component of components) {
    const bucket = componentsByProjectId.get(component.projectId) ?? [];
    bucket.push(component);
    componentsByProjectId.set(component.projectId, bucket);
  }

  const context: CoverageEvaluationContext = {
    candidateMaterialsByKey: new Map(),
    pendingQuantityMaterialIds: new Set(),
    quantityStateByMaterialId: new Map(),
  };

  type PendingComponentEvaluation = {
    projectId: string;
    component: CoverageComponentRecord;
    index: number;
    compatibleMaterials: CoverageMaterialRecord[] | null;
    earlyStatus: ComponentPublicAvailabilityStatus | null;
  };

  const pendingEvaluations: PendingComponentEvaluation[] = [];
  const componentAvailabilityCache = new Map<
    string,
    ComponentPublicAvailabilityStatus
  >();

  for (const projectId of uniqueProjectIds) {
    const projectComponents = (componentsByProjectId.get(projectId) ?? []).filter(
      (component) => isCoverageRequiredMaterialComponent(component),
    );

    for (const [index, component] of projectComponents.entries()) {
      if (componentAvailabilityCache.has(component.id)) {
        continue;
      }

      const requiredQuantity = decimalToNumber(component.quantity);
      const requiredUnit = component.unit?.trim() ?? '';
      if (requiredQuantity <= 0 || requiredUnit.length === 0) {
        componentAvailabilityCache.set(component.id, 'UNKNOWN');
        continue;
      }

      const compatibleMaterials = await collectCompatibleCoverageMaterials(
        component,
        index,
        context,
      );

      if (compatibleMaterials.length === 0) {
        componentAvailabilityCache.set(component.id, 'MISSING');
        continue;
      }

      pendingEvaluations.push({
        projectId,
        component,
        index,
        compatibleMaterials,
        earlyStatus: null,
      });
    }
  }

  await ensureCoverageQuantityStates(context);

  for (const pending of pendingEvaluations) {
    if (componentAvailabilityCache.has(pending.component.id)) {
      continue;
    }

    const requiredQuantity = decimalToNumber(pending.component.quantity);
    const status = resolveComponentAvailabilityFromCompatibleMaterials(
      pending.compatibleMaterials ?? [],
      requiredQuantity,
      context,
    );
    componentAvailabilityCache.set(pending.component.id, status);
  }

  for (const projectId of uniqueProjectIds) {
    const projectComponents = (componentsByProjectId.get(projectId) ?? []).filter(
      (component) => isCoverageRequiredMaterialComponent(component),
    );

    const componentCoverage: ProjectComponentCoverageItem[] =
      projectComponents.map((component) => {
        const requiredQuantity = decimalToNumber(component.quantity);
        const requiredUnit = component.unit?.trim() ?? '';
        const fallbackStatus: ComponentPublicAvailabilityStatus =
          requiredQuantity <= 0 || requiredUnit.length === 0
            ? 'UNKNOWN'
            : 'MISSING';

        return {
          componentId: component.id,
          componentName: component.componentName,
          availabilityStatus:
            componentAvailabilityCache.get(component.id) ?? fallbackStatus,
        };
      });

    results.set(projectId, {
      materialCoverage: summarizeMaterialCoverage(componentCoverage),
      componentCoverage,
      personalBuildReadiness: null,
    });
  }

  if (!input.learnerId) {
    return results;
  }

  const personalProjectIds = input.personalReadinessProjectIds ?? input.projectIds;
  return attachPersonalBuildReadiness({
    results,
    learnerId: input.learnerId,
    projectIds: personalProjectIds,
  });
};

export const matchesMaterialAvailabilityFilter = (
  summary: ProjectMaterialCoverageSummary,
  filter: MaterialAvailabilityFilter,
) => {
  switch (filter) {
    case 'ANY':
      return true;
    case 'FULL':
      return summary.coverageLevel === 'FULL';
    case 'MOST':
      return summary.coverageLevel === 'MOST';
    case 'SOME':
      return summary.coverageLevel === 'SOME';
    case 'NONE':
      return summary.coverageLevel === 'NONE';
    default:
      return true;
  }
};

const DIFFICULTY_RANK: Record<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED', number> =
  {
    BEGINNER: 0,
    INTERMEDIATE: 1,
    ADVANCED: 2,
  };

export type BrowseProjectSortEntry = {
  id: string;
  createdAt: Date;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedDurationMinutes: number | null;
  coverage: ProjectMaterialCoverageSummary;
  likesCount: number;
};

const compareProjectIds = (leftId: string, rightId: string) =>
  leftId.localeCompare(rightId);

export const compareBrowseProjectsForSort = (
  left: BrowseProjectSortEntry,
  right: BrowseProjectSortEntry,
  sort: LearningProjectsBrowseSort,
): number => {
  switch (sort) {
    case 'MOST_AVAILABLE': {
      const ratioDelta =
        right.coverage.availabilityRatio - left.coverage.availabilityRatio;
      if (ratioDelta !== 0) {
        return ratioDelta;
      }

      const availableDelta =
        right.coverage.availableComponents - left.coverage.availableComponents;
      if (availableDelta !== 0) {
        return availableDelta;
      }

      const partialDelta =
        right.coverage.partialComponents - left.coverage.partialComponents;
      if (partialDelta !== 0) {
        return partialDelta;
      }

      const likesDelta = right.likesCount - left.likesCount;
      if (likesDelta !== 0) {
        return likesDelta;
      }

      return compareProjectIds(left.id, right.id);
    }
    case 'SHORTEST_DURATION': {
      const leftDuration = left.estimatedDurationMinutes;
      const rightDuration = right.estimatedDurationMinutes;
      const leftKnown = leftDuration != null && leftDuration > 0;
      const rightKnown = rightDuration != null && rightDuration > 0;

      if (leftKnown && rightKnown) {
        const durationDelta = leftDuration - rightDuration;
        if (durationDelta !== 0) {
          return durationDelta;
        }
      } else if (leftKnown !== rightKnown) {
        return leftKnown ? -1 : 1;
      }

      const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();
      if (createdAtDelta !== 0) {
        return createdAtDelta;
      }

      return compareProjectIds(left.id, right.id);
    }
    case 'EASIEST': {
      const difficultyDelta =
        DIFFICULTY_RANK[left.difficulty] - DIFFICULTY_RANK[right.difficulty];
      if (difficultyDelta !== 0) {
        return difficultyDelta;
      }

      const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();
      if (createdAtDelta !== 0) {
        return createdAtDelta;
      }

      return compareProjectIds(left.id, right.id);
    }
    case 'MOST_POPULAR': {
      const likesDelta = right.likesCount - left.likesCount;
      if (likesDelta !== 0) {
        return likesDelta;
      }

      const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();
      if (createdAtDelta !== 0) {
        return createdAtDelta;
      }

      return compareProjectIds(left.id, right.id);
    }
    case 'NEWEST': {
      const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();
      if (createdAtDelta !== 0) {
        return createdAtDelta;
      }

      return compareProjectIds(left.id, right.id);
    }
    case 'DEFAULT':
    default: {
      const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();
      if (createdAtDelta !== 0) {
        return createdAtDelta;
      }

      return compareProjectIds(left.id, right.id);
    }
  }
};

export const sortBrowseProjects = (
  entries: BrowseProjectSortEntry[],
  sort: LearningProjectsBrowseSort,
) =>
  [...entries].sort((left, right) =>
    compareBrowseProjectsForSort(left, right, sort),
  );

export const paginateBrowseResults = <T>(
  items: T[],
  page: number,
  limit: number,
) => {
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const skip = (page - 1) * limit;
  const pageItems = skip >= total ? [] : items.slice(skip, skip + limit);

  return {
    items: pageItems,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};
