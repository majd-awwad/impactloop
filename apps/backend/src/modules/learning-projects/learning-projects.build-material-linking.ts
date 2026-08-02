import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { ACTIVE_HOLD_STATUSES, getMaterialQuantityState } from '../reservations/reservations.quantity.js';

import {
  buildCandidateMatchHints,
  rankBuildMaterialCandidates,
  type BuildCandidateComponentInput,
  type BuildCandidateLearnerContext,
  type BuildCandidateMaterialInput,
} from './learning-projects.build-candidate-ranking.js';
import * as learningProjectsRepository from './learning-projects.repository.js';

const CANDIDATE_LIMIT = 10;
const CANDIDATE_POOL_LIMIT = 60;

const LINKABLE_MATERIAL_STATUSES = ['AVAILABLE'] as const;

const TERMINAL_RESERVATION_STATUSES = new Set([
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
]);

const linkedMaterialSelect = {
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
} satisfies Prisma.MaterialSelect;

const linkedReservationSelect = {
  id: true,
  status: true,
  materialId: true,
} satisfies Prisma.ReservationSelect;

type LinkedMaterialRecord = Prisma.MaterialGetPayload<{
  select: typeof linkedMaterialSelect;
}>;

type LinkedReservationRecord = Prisma.ReservationGetPayload<{
  select: typeof linkedReservationSelect;
}>;

const decimalToNumber = (value: Prisma.Decimal | null | undefined): number | null => {
  if (value == null) {
    return null;
  }

  return value.toNumber();
};

const resolveSupplierName = (material: LinkedMaterialRecord) =>
  material.supplierProfile?.publicName ??
  material.supplierProfile?.user.displayName ??
  material.owner.displayName ??
  null;

const resolvePrimaryImageUrl = (material: LinkedMaterialRecord) => {
  const cover = material.images.find((image) => image.isCover);
  return cover?.imageUrl ?? material.images[0]?.imageUrl ?? null;
};

const resolvePublicSupplierVerified = (
  verificationStatus: string | null | undefined,
) => {
  if (!verificationStatus) {
    return false;
  }

  const normalized = verificationStatus.trim().toUpperCase();
  return normalized === 'APPROVED' || normalized === 'NOT_REQUIRED';
};

export const mapLinkedMaterialSummary = (
  material: LinkedMaterialRecord | null | undefined,
  options?: {
    linkedReservationStatus?: string | null;
  },
) => {
  if (!material) {
    return null;
  }

  const isPubliclyAvailable = material.status === 'AVAILABLE';
  const isAcquired = options?.linkedReservationStatus === 'COMPLETED';

  return {
    id: material.id,
    title: material.title,
    imageUrl: resolvePrimaryImageUrl(material),
    category: {
      id: material.category.id,
      nameEn: material.category.nameEn,
      nameAr: material.category.nameAr,
    },
    condition: material.condition,
    status: material.status,
    isPubliclyAvailable,
    availabilityWarning:
      isPubliclyAvailable || isAcquired
        ? null
        : 'This linked material is no longer available on the platform.',
    isFree: material.isFree,
    price: decimalToNumber(material.price),
    currency: material.currency,
    supplierName: resolveSupplierName(material),
    supplierType: material.supplierProfile?.supplierType ?? null,
    supplierVerified: resolvePublicSupplierVerified(
      material.supplierProfile?.verificationStatus,
    ),
    city: material.location.city,
    area: material.location.area,
    pickupAllowed: material.pickupAllowed,
    deliveryAllowed: material.deliveryAllowed,
  };
};

export const mapLinkedReservationSummary = (
  reservation: LinkedReservationRecord | null | undefined,
) => {
  if (!reservation) {
    return null;
  }

  const needsAction = TERMINAL_RESERVATION_STATUSES.has(reservation.status);

  return {
    id: reservation.id,
    status: reservation.status,
    materialId: reservation.materialId,
    needsAction,
    statusLabel: formatReservationStatusLabel(reservation.status),
  };
};

const formatReservationStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'Reservation pending — waiting for supplier';
    case 'AWAITING_LEARNER_CONFIRMATION':
      return 'Awaiting your confirmation';
    case 'AWAITING_SUPPLIER_CONFIRMATION':
      return 'Awaiting supplier confirmation';
    case 'ACCEPTED':
      return 'Accepted — pickup or delivery in progress';
    case 'COMPLETED':
      return 'Ready for build — material acquired';
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
    case 'NO_SHOW':
    case 'FULFILLMENT_FAILED':
      return 'Reservation ended — choose another option';
    case 'AWAITING_RESOLUTION':
      return 'Awaiting resolution';
    default:
      return status
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
};

const BUILD_ITEM_READY_STATUSES = new Set([
  'ALREADY_OWNED',
  'AVAILABLE',
  'ALTERNATIVE',
]);

export const resolveBuildItemStepUnlockReadiness = (input: {
  status: string;
  linkedReservation?: LinkedReservationRecord | null;
  linkedMaterial?: LinkedMaterialRecord | null;
}) => {
  if (input.linkedReservation?.status === 'COMPLETED') {
    return {
      isReadyForStepUnlock: true,
    };
  }

  if (input.status === 'ALREADY_OWNED') {
    return {
      isReadyForStepUnlock: true,
    };
  }

  return {
    isReadyForStepUnlock: false,
  };
};

export const resolveBuildItemReadiness = (input: {
  status: string;
  linkedReservation?: LinkedReservationRecord | null;
  linkedMaterial?: LinkedMaterialRecord | null;
}) => {
  if (input.linkedReservation?.status === 'COMPLETED') {
    return {
      isReadyForBuild: true,
      readinessLabel: 'Ready for build — material acquired',
    };
  }

  if (BUILD_ITEM_READY_STATUSES.has(input.status)) {
    const label =
      input.status === 'ALREADY_OWNED'
        ? 'Marked as already owned'
        : input.status === 'ALTERNATIVE'
          ? 'Alternative accepted'
          : 'Marked as available';

    return {
      isReadyForBuild: true,
      readinessLabel: label,
    };
  }

  if (input.linkedReservation) {
    const reservationStatus = input.linkedReservation.status;

    if (
      ACTIVE_HOLD_STATUSES.includes(
        reservationStatus as (typeof ACTIVE_HOLD_STATUSES)[number],
      ) ||
      reservationStatus === 'AWAITING_RESOLUTION'
    ) {
      return {
        isReadyForBuild: false,
        readinessLabel: 'Reservation in progress — not ready yet',
      };
    }

    if (TERMINAL_RESERVATION_STATUSES.has(reservationStatus)) {
      return {
        isReadyForBuild: false,
        readinessLabel: 'Linked reservation needs attention',
      };
    }
  }

  if (input.linkedMaterial) {
    return {
      isReadyForBuild: false,
      readinessLabel: 'Material selected — reserve or acquire it before building',
    };
  }

  if (input.status === 'RESERVED') {
    return {
      isReadyForBuild: false,
      readinessLabel: 'Marked reserved — acquire the material to mark ready',
    };
  }

  return {
    isReadyForBuild: false,
    readinessLabel: 'Still missing',
  };
};

const parseSearchKeywords = (value: Prisma.JsonValue | null | undefined) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const buildCandidateSearchTerms = (component: {
  componentName: string;
  materialType: string;
  searchKeywords: Prisma.JsonValue | null;
  alternativeKeywords?: Prisma.JsonValue | null;
}) => {
  const terms = new Set<string>();
  const name = component.componentName.trim();
  if (name.length > 0) {
    terms.add(name);
  }

  for (const keyword of parseSearchKeywords(component.searchKeywords)) {
    terms.add(keyword);
  }

  for (const keyword of parseSearchKeywords(component.alternativeKeywords)) {
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

const buildCandidateSearchTerm = (component: {
  componentName: string;
  materialType: string;
  searchKeywords: Prisma.JsonValue | null;
  alternativeKeywords?: Prisma.JsonValue | null;
}) => buildCandidateSearchTerms(component).join(' ');

const candidateMaterialSelect = {
  id: true,
  title: true,
  description: true,
  materialType: true,
  condition: true,
  status: true,
  isFree: true,
  price: true,
  currency: true,
  pickupAllowed: true,
  deliveryAllowed: true,
  ownerId: true,
  createdAt: true,
  category: linkedMaterialSelect.category,
  location: linkedMaterialSelect.location,
  images: linkedMaterialSelect.images,
  supplierProfile: linkedMaterialSelect.supplierProfile,
  owner: linkedMaterialSelect.owner,
  tags: {
    select: {
      tag: true,
    },
  },
} satisfies Prisma.MaterialSelect;

type CandidateMaterialRecord = Prisma.MaterialGetPayload<{
  select: typeof candidateMaterialSelect;
}>;

const buildEligibleCandidateWhere = (input: {
  learnerId: string;
  categoryId: string | null;
  searchTerms: string[];
}): Prisma.MaterialWhereInput => {
  const where: Prisma.MaterialWhereInput = {
    status: { in: [...LINKABLE_MATERIAL_STATUSES] },
    ownerId: { not: input.learnerId },
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

const buildTextFallbackCandidateWhere = (input: {
  learnerId: string;
  searchTerms: string[];
}): Prisma.MaterialWhereInput => ({
  status: { in: [...LINKABLE_MATERIAL_STATUSES] },
  ownerId: { not: input.learnerId },
  category: {
    isActive: true,
    categoryType: {
      in: ['MATERIAL', 'BOTH'],
    },
  },
  OR: input.searchTerms.flatMap((term) => [
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
  ]),
});

const loadLearnerCandidateContext = async (
  learnerId: string,
): Promise<BuildCandidateLearnerContext> => {
  const savedLocation = await prisma.userSavedLocation.findFirst({
    where: { userId: learnerId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    select: {
      location: {
        select: {
          city: true,
          area: true,
        },
      },
    },
  });

  return {
    city: savedLocation?.location.city ?? null,
    area: savedLocation?.location.area ?? null,
  };
};

const loadOwnerCompletedHandoverCounts = async (ownerIds: string[]) => {
  if (ownerIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await prisma.reservation.groupBy({
    by: ['ownerId'],
    where: {
      ownerId: { in: ownerIds },
      status: 'COMPLETED',
    },
    _count: {
      id: true,
    },
  });

  return new Map(rows.map((row) => [row.ownerId, row._count.id]));
};

const toRankingMaterialInput = (
  material: CandidateMaterialRecord,
  ownerCompletedHandovers: number,
): BuildCandidateMaterialInput => ({
  id: material.id,
  title: material.title,
  description: material.description,
  materialType: material.materialType,
  condition: material.condition,
  isFree: material.isFree,
  price: decimalToNumber(material.price),
  pickupAllowed: material.pickupAllowed,
  deliveryAllowed: material.deliveryAllowed,
  createdAt: material.createdAt,
  categoryId: material.category.id,
  city: material.location.city,
  area: material.location.area,
  tags: material.tags.map((entry) => entry.tag),
  supplierVerified: resolvePublicSupplierVerified(
    material.supplierProfile?.verificationStatus,
  ),
  ownerCompletedHandovers,
});

const toRankingComponentInput = (
  component: {
    categoryId: string | null;
    componentName: string;
    materialType: string;
    searchKeywords: Prisma.JsonValue | null;
    alternativeKeywords?: Prisma.JsonValue | null;
  },
  searchTerms: string[],
): BuildCandidateComponentInput => ({
  categoryId: component.categoryId,
  componentName: component.componentName,
  materialType: component.materialType,
  searchKeywords: parseSearchKeywords(component.searchKeywords),
  alternativeKeywords: parseSearchKeywords(component.alternativeKeywords),
  searchTerms,
});

const mapRankedCandidateItems = (input: {
  materials: CandidateMaterialRecord[];
  component: {
    categoryId: string | null;
    componentName: string;
    materialType: string;
    searchKeywords: Prisma.JsonValue | null;
    alternativeKeywords?: Prisma.JsonValue | null;
  };
  searchTerms: string[];
  learner: BuildCandidateLearnerContext;
  ownerCompletedHandoversByOwnerId: Map<string, number>;
}) => {
  const rankingComponent = toRankingComponentInput(
    input.component,
    input.searchTerms,
  );
  const rankingMaterials = input.materials.map((material) =>
    toRankingMaterialInput(
      material,
      input.ownerCompletedHandoversByOwnerId.get(material.ownerId) ?? 0,
    ),
  );
  const ranked = rankBuildMaterialCandidates(
    rankingMaterials,
    rankingComponent,
    input.learner,
    CANDIDATE_LIMIT,
  );

  const materialById = new Map(input.materials.map((material) => [material.id, material]));

  return ranked.map(({ material, score }) => {
    const record = materialById.get(material.id)!;

    return {
      ...mapLinkedMaterialSummary(record)!,
      relevance: score.relevance,
      matchHints: buildCandidateMatchHints({
        material,
        component: rankingComponent,
        learner: input.learner,
        score,
      }),
    };
  });
};

const fetchCandidateMaterials = async (where: Prisma.MaterialWhereInput) =>
  prisma.material.findMany({
    where,
    select: candidateMaterialSelect,
    take: CANDIDATE_POOL_LIMIT,
  });

type RequiredComponentForMatching = {
  id: string;
  componentRole: string;
  categoryId: string | null;
  componentName: string;
  materialType: string;
  searchKeywords: Prisma.JsonValue | null;
  alternativeKeywords?: Prisma.JsonValue | null;
};

const listMaterialCandidatesForRequiredComponent = async (input: {
  learnerId: string;
  component: RequiredComponentForMatching;
  preloadedLearner?: BuildCandidateLearnerContext;
}) => {
  const component = input.component;

  if (component.componentRole === 'TOOL') {
    return {
      componentId: component.id,
      searchTerm: component.componentName.trim(),
      items: [],
    };
  }

  const searchTerms = buildCandidateSearchTerms(component);
  const searchTerm = buildCandidateSearchTerm(component);
  const learner =
    input.preloadedLearner ?? (await loadLearnerCandidateContext(input.learnerId));

  let materials = await fetchCandidateMaterials(
    buildEligibleCandidateWhere({
      learnerId: input.learnerId,
      categoryId: component.categoryId,
      searchTerms,
    }),
  );

  if (materials.length === 0 && searchTerms.length > 0) {
    materials = await fetchCandidateMaterials(
      buildTextFallbackCandidateWhere({
        learnerId: input.learnerId,
        searchTerms,
      }),
    );
  }

  if (materials.length === 0 && component.categoryId) {
    materials = await fetchCandidateMaterials(
      buildEligibleCandidateWhere({
        learnerId: input.learnerId,
        categoryId: component.categoryId,
        searchTerms: [],
      }),
    );
  }

  const ownerCompletedHandoversByOwnerId = await loadOwnerCompletedHandoverCounts(
    [...new Set(materials.map((material) => material.ownerId))],
  );

  return {
    componentId: component.id,
    searchTerm,
    items: mapRankedCandidateItems({
      materials,
      component,
      searchTerms,
      learner,
      ownerCompletedHandoversByOwnerId,
    }),
  };
};

export const getRequiredComponentMaterialCandidates = async (input: {
  projectId: string;
  learnerId: string;
  componentId: string;
}) => {
  const component = await prisma.projectRequiredComponent.findFirst({
    where: {
      id: input.componentId,
      projectId: input.projectId,
      project: {
        status: 'PUBLISHED',
        category: {
          isActive: true,
          categoryType: {
            in: ['PROJECT', 'BOTH'],
          },
        },
      },
    },
    select: {
      id: true,
      componentRole: true,
      categoryId: true,
      componentName: true,
      materialType: true,
      searchKeywords: true,
      alternativeKeywords: true,
    },
  });

  if (!component) {
    throw new AppError('Required component not found', 404, 'NOT_FOUND');
  }

  return listMaterialCandidatesForRequiredComponent({
    learnerId: input.learnerId,
    component,
  });
};

export const getBuildItemMaterialCandidates = async (input: {
  projectId: string;
  learnerId: string;
  itemId: string;
}) => {
  const buildItem = await learningProjectsRepository.findLearnerBuildItem({
    projectId: input.projectId,
    learnerId: input.learnerId,
    itemId: input.itemId,
  });

  if (!buildItem) {
    throw new AppError('Project build item not found', 404, 'NOT_FOUND');
  }

  const matched = await listMaterialCandidatesForRequiredComponent({
    learnerId: input.learnerId,
    component: buildItem.requiredComponent,
  });

  return {
    itemId: buildItem.id,
    componentId: matched.componentId,
    searchTerm: matched.searchTerm,
    items: matched.items,
  };
};

export const linkBuildItemMaterial = async (input: {
  projectId: string;
  learnerId: string;
  itemId: string;
  materialId: string;
}) => {
  const buildItem = await learningProjectsRepository.findLearnerBuildItem({
    projectId: input.projectId,
    learnerId: input.learnerId,
    itemId: input.itemId,
  });

  if (!buildItem) {
    throw new AppError('Project build item not found', 404, 'NOT_FOUND');
  }

  const material = await prisma.material.findFirst({
    where: {
      id: input.materialId,
      status: { in: [...LINKABLE_MATERIAL_STATUSES] },
      category: {
        isActive: true,
        categoryType: {
          in: ['MATERIAL', 'BOTH'],
        },
      },
    },
    select: linkedMaterialSelect,
  });

  if (!material) {
    throw new AppError(
      'Material is not available for linking',
      400,
      'MATERIAL_NOT_AVAILABLE',
    );
  }

  if (material.ownerId === input.learnerId) {
    throw new AppError(
      'You cannot link your own material listing to a build checklist item',
      400,
      'OWN_MATERIAL',
    );
  }

  const build = await learningProjectsRepository.linkBuildItemMaterial({
    projectId: input.projectId,
    learnerId: input.learnerId,
    itemId: input.itemId,
    materialId: input.materialId,
  });

  if (!build) {
    throw new AppError('Project build item not found', 404, 'NOT_FOUND');
  }

  return build;
};

export const unlinkBuildItemMaterial = async (input: {
  projectId: string;
  learnerId: string;
  itemId: string;
}) => {
  const buildItem = await learningProjectsRepository.findLearnerBuildItem({
    projectId: input.projectId,
    learnerId: input.learnerId,
    itemId: input.itemId,
  });

  if (!buildItem) {
    throw new AppError('Project build item not found', 404, 'NOT_FOUND');
  }

  if (buildItem.linkedReservationId) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: buildItem.linkedReservationId },
      select: { status: true },
    });

    const activeStatuses = [
      ...ACTIVE_HOLD_STATUSES,
      'AWAITING_RESOLUTION',
    ] as const;

    if (
      reservation &&
      activeStatuses.includes(
        reservation.status as (typeof activeStatuses)[number],
      )
    ) {
      throw new AppError(
        'Cannot unlink while a linked reservation is still active. Cancel or complete the reservation first.',
        409,
        'ACTIVE_LINKED_RESERVATION',
      );
    }
  }

  const build = await learningProjectsRepository.unlinkBuildItemMaterial({
    projectId: input.projectId,
    learnerId: input.learnerId,
    itemId: input.itemId,
    clearReservationLink: true,
  });

  if (!build) {
    throw new AppError('Project build item not found', 404, 'NOT_FOUND');
  }

  return build;
};

const SUPPORTED_BUDGET_CURRENCY = 'NIS';

export type ProjectBudgetComponentStatus =
  | 'SELECTED'
  | 'NO_AVAILABLE_MATCH'
  | 'INSUFFICIENT_QUANTITY'
  | 'PRICE_UNAVAILABLE'
  | 'UNSUPPORTED_CURRENCY'
  | 'UNIT_ASSUMPTION_REQUIRED';

export type ProjectBudgetEstimateStatus =
  | 'COMPLETE'
  | 'PARTIAL'
  | 'ZERO_COST_AVAILABLE_MATERIALS';

export type ProjectBudgetComponentLine = {
  componentId: string;
  componentName: string;
  requiredQuantity: number;
  requiredUnit: string | null;
  status: ProjectBudgetComponentStatus;
  selectedMaterialId: string | null;
  selectedMaterialTitle: string | null;
  isFree: boolean | null;
  unitPrice: number | null;
  effectiveComponentCost: number | null;
  allocatedQuantity: number | null;
  availableQuantity: number | null;
  listingUnit: string | null;
  alternativesCount: number;
  matchEvidence: string | null;
  assumptionNote: string | null;
};

export type ProjectMaterialBudgetEstimate = {
  projectId: string;
  projectTitle: string;
  projectImageUrl: string | null;
  categoryLabel: string | null;
  difficulty: string | null;
  estimateStatus: ProjectBudgetEstimateStatus;
  estimatedSubtotalNis: number;
  currency: 'NIS';
  requiredComponentCount: number;
  pricedComponentCount: number;
  missingComponentCount: number;
  unpricedComponentCount: number;
  quantityAssumptionWarning: string | null;
  deliveryExcludedNotice: string;
  components: ProjectBudgetComponentLine[];
};

const normalizeBudgetUnit = (value: string | null | undefined): string => {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return '';
  }

  if (normalized.endsWith('ies')) {
    return `${normalized.slice(0, -3)}y`;
  }

  if (normalized.endsWith('s') && normalized.length > 3) {
    return normalized.slice(0, -1);
  }

  return normalized;
};

const unitsAreCompatible = (requiredUnit: string, listingUnit: string): boolean => {
  const left = normalizeBudgetUnit(requiredUnit);
  const right = normalizeBudgetUnit(listingUnit);
  if (!left || !right) {
    return false;
  }

  return left === right;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

type BudgetCandidateRecord = NonNullable<ReturnType<typeof mapLinkedMaterialSummary>> & {
  matchRank: number;
  matchEvidence: string | null;
  relevance: number;
};

const MIN_BUDGET_MATCH_RELEVANCE = 270;
// Applied only inside estimateProjectMaterialBudget when choosing the cheapest
// priced candidate. Shared candidate listing for Build Guide and availability
// is unchanged.

const loadBudgetCandidateRecords = async (input: {
  learnerId: string;
  component: RequiredComponentForMatching & {
    quantity: Prisma.Decimal;
    unit: string;
    isRequired: boolean;
    componentName: string;
  };
  preloadedLearner?: BuildCandidateLearnerContext;
}): Promise<BudgetCandidateRecord[]> => {
  if (!input.component.isRequired) {
    return [];
  }

  const matched = await listMaterialCandidatesForRequiredComponent({
    learnerId: input.learnerId,
    component: input.component,
    preloadedLearner: input.preloadedLearner,
  });

  return matched.items.map((item, index) => ({
    ...item,
    matchRank: index,
    matchEvidence: item.matchHints?.[0] ?? null,
    relevance: item.relevance ?? 0,
  }));
};

const evaluateBudgetCandidate = async (input: {
  candidate: BudgetCandidateRecord;
  requiredQuantity: number;
  requiredUnit: string;
  allocatedFromListing: number;
}): Promise<{
  status: ProjectBudgetComponentStatus;
  effectiveComponentCost: number | null;
  allocatedQuantity: number | null;
  availableQuantity: number | null;
  listingUnit: string | null;
  unitPrice: number | null;
  assumptionNote: string | null;
}> => {
  const quantityState = await getMaterialQuantityState(prisma, input.candidate.id);
  const material = await prisma.material.findUnique({
    where: { id: input.candidate.id },
    select: {
      unit: true,
      currency: true,
      isFree: true,
      price: true,
      status: true,
    },
  });

  if (!quantityState || !material || material.status !== 'AVAILABLE') {
    return {
      status: 'NO_AVAILABLE_MATCH',
      effectiveComponentCost: null,
      allocatedQuantity: null,
      availableQuantity: null,
      listingUnit: null,
      unitPrice: null,
      assumptionNote: null,
    };
  }

  const currency = (material.currency || SUPPORTED_BUDGET_CURRENCY).trim().toUpperCase();
  if (currency !== SUPPORTED_BUDGET_CURRENCY) {
    return {
      status: 'UNSUPPORTED_CURRENCY',
      effectiveComponentCost: null,
      allocatedQuantity: null,
      availableQuantity: decimalToNumber(quantityState.availableQuantity),
      listingUnit: material.unit,
      unitPrice: null,
      assumptionNote: null,
    };
  }

  const availableQuantity = decimalToNumber(quantityState.availableQuantity) ?? 0;
  const remainingAllocatable = Math.max(0, availableQuantity - input.allocatedFromListing);
  if (remainingAllocatable <= 0) {
    return {
      status: 'INSUFFICIENT_QUANTITY',
      effectiveComponentCost: null,
      allocatedQuantity: null,
      availableQuantity,
      listingUnit: material.unit,
      unitPrice: material.isFree ? 0 : decimalToNumber(material.price),
      assumptionNote: null,
    };
  }

  if (!material.isFree && (material.price == null || decimalToNumber(material.price) == null)) {
    return {
      status: 'PRICE_UNAVAILABLE',
      effectiveComponentCost: null,
      allocatedQuantity: null,
      availableQuantity,
      listingUnit: material.unit,
      unitPrice: null,
      assumptionNote: null,
    };
  }

  const unitPrice = material.isFree ? 0 : decimalToNumber(material.price) ?? 0;
  if (!material.isFree && unitPrice <= 0) {
    return {
      status: 'PRICE_UNAVAILABLE',
      effectiveComponentCost: null,
      allocatedQuantity: null,
      availableQuantity,
      listingUnit: material.unit,
      unitPrice: null,
      assumptionNote: null,
    };
  }

  if (unitsAreCompatible(input.requiredUnit, material.unit)) {
    if (remainingAllocatable < input.requiredQuantity) {
      return {
        status: 'INSUFFICIENT_QUANTITY',
        effectiveComponentCost: null,
        allocatedQuantity: null,
        availableQuantity,
        listingUnit: material.unit,
        unitPrice,
        assumptionNote: null,
      };
    }

    return {
      status: 'SELECTED',
      effectiveComponentCost: roundMoney(unitPrice * input.requiredQuantity),
      allocatedQuantity: input.requiredQuantity,
      availableQuantity,
      listingUnit: material.unit,
      unitPrice,
      assumptionNote: null,
    };
  }

  if (remainingAllocatable < 1) {
    return {
      status: 'INSUFFICIENT_QUANTITY',
      effectiveComponentCost: null,
      allocatedQuantity: null,
      availableQuantity,
      listingUnit: material.unit,
      unitPrice,
      assumptionNote: null,
    };
  }

  return {
    status: 'UNIT_ASSUMPTION_REQUIRED',
    effectiveComponentCost: roundMoney(unitPrice),
    allocatedQuantity: 1,
    availableQuantity,
    listingUnit: material.unit,
    unitPrice,
    assumptionNote:
      'Estimated using one available listing because the required and listing units cannot be converted safely.',
  };
};

export type BudgetEstimatePreloadedProject = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  difficulty: string;
  category: {
    nameEn: string;
    nameAr: string;
  };
  requiredComponents: Array<{
    id: string;
    componentRole: string;
    categoryId: string | null;
    componentName: string;
    materialType: string;
    searchKeywords: Prisma.JsonValue | null;
    alternativeKeywords?: Prisma.JsonValue | null;
    quantity: Prisma.Decimal;
    unit: string;
    isRequired: boolean;
  }>;
};

const budgetEstimateProjectSelect = {
  id: true,
  title: true,
  coverImageUrl: true,
  difficulty: true,
  category: {
    select: {
      nameEn: true,
      nameAr: true,
    },
  },
  requiredComponents: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      componentRole: true,
      categoryId: true,
      componentName: true,
      materialType: true,
      searchKeywords: true,
      alternativeKeywords: true,
      quantity: true,
      unit: true,
      isRequired: true,
    },
  },
} satisfies Prisma.LearningProjectSelect;

export const estimateProjectMaterialBudget = async (input: {
  projectId: string;
  learnerId: string;
  candidateLimitPerComponent?: number;
  preloadedLearnerContext?: BuildCandidateLearnerContext;
  preloadedProject?: BudgetEstimatePreloadedProject;
}): Promise<ProjectMaterialBudgetEstimate> => {
  const project =
    input.preloadedProject ??
    (await prisma.learningProject.findFirst({
      where: {
        id: input.projectId,
        status: 'PUBLISHED',
        hiddenAt: null,
        archivedAt: null,
        category: {
          isActive: true,
          categoryType: {
            in: ['PROJECT', 'BOTH'],
          },
        },
      },
      select: budgetEstimateProjectSelect,
    }));

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  const requiredComponents = project.requiredComponents.filter(
    (component) => component.isRequired !== false,
  );

  const deliveryExcludedNotice =
    'This estimate covers currently available ImpactLoop materials only. Delivery, tools, and unavailable components are not included.';

  if (requiredComponents.length === 0) {
    return {
      projectId: project.id,
      projectTitle: project.title,
      projectImageUrl: project.coverImageUrl,
      categoryLabel: project.category.nameEn,
      difficulty: project.difficulty,
      estimateStatus: 'PARTIAL',
      estimatedSubtotalNis: 0,
      currency: 'NIS',
      requiredComponentCount: 0,
      pricedComponentCount: 0,
      missingComponentCount: 0,
      unpricedComponentCount: 0,
      quantityAssumptionWarning: null,
      deliveryExcludedNotice,
      components: [],
    };
  }

  const allocatedByMaterialId = new Map<string, number>();
  const lines: ProjectBudgetComponentLine[] = [];
  const preloadedLearner =
    input.preloadedLearnerContext ??
    (await loadLearnerCandidateContext(input.learnerId));

  for (const component of requiredComponents) {
    const requiredQuantity = decimalToNumber(component.quantity) ?? 1;
    const candidates = await loadBudgetCandidateRecords({
      learnerId: input.learnerId,
      component,
      preloadedLearner,
    });
    const candidateLimit = Math.min(input.candidateLimitPerComponent ?? 10, 10);
    const boundedCandidates = candidates.slice(0, candidateLimit);

    const scored: Array<{
      candidate: BudgetCandidateRecord;
      evaluation: Awaited<ReturnType<typeof evaluateBudgetCandidate>>;
    }> = [];

    for (const candidate of boundedCandidates) {
      const evaluation = await evaluateBudgetCandidate({
        candidate,
        requiredQuantity,
        requiredUnit: component.unit,
        allocatedFromListing: allocatedByMaterialId.get(candidate.id) ?? 0,
      });
      if (
        evaluation.status === 'SELECTED' ||
        evaluation.status === 'UNIT_ASSUMPTION_REQUIRED'
      ) {
        scored.push({ candidate, evaluation });
      }
    }

    const qualifiedScored = scored.filter(
      (entry) => entry.candidate.relevance >= MIN_BUDGET_MATCH_RELEVANCE,
    );
    const selectionPool = qualifiedScored.length > 0 ? qualifiedScored : scored;

    selectionPool.sort((left, right) => {
      const leftCost = left.evaluation.effectiveComponentCost ?? Number.POSITIVE_INFINITY;
      const rightCost = right.evaluation.effectiveComponentCost ?? Number.POSITIVE_INFINITY;
      if (leftCost !== rightCost) {
        return leftCost - rightCost;
      }

      const leftFree = left.candidate.isFree ? 0 : 1;
      const rightFree = right.candidate.isFree ? 0 : 1;
      if (leftFree !== rightFree) {
        return leftFree - rightFree;
      }

      if (left.candidate.matchRank !== right.candidate.matchRank) {
        return left.candidate.matchRank - right.candidate.matchRank;
      }

      const leftAvailable = left.evaluation.availableQuantity ?? 0;
      const rightAvailable = right.evaluation.availableQuantity ?? 0;
      if (leftAvailable !== rightAvailable) {
        return rightAvailable - leftAvailable;
      }

      return left.candidate.id.localeCompare(right.candidate.id);
    });

    const selected = selectionPool[0];
    if (!selected) {
      lines.push({
        componentId: component.id,
        componentName: component.componentName,
        requiredQuantity,
        requiredUnit: component.unit,
        status: 'NO_AVAILABLE_MATCH',
        selectedMaterialId: null,
        selectedMaterialTitle: null,
        isFree: null,
        unitPrice: null,
        effectiveComponentCost: null,
        allocatedQuantity: null,
        availableQuantity: null,
        listingUnit: null,
        alternativesCount: 0,
        matchEvidence: null,
        assumptionNote: null,
      });
      continue;
    }

    if (selected.evaluation.allocatedQuantity != null) {
      const previous = allocatedByMaterialId.get(selected.candidate.id) ?? 0;
      allocatedByMaterialId.set(
        selected.candidate.id,
        previous + selected.evaluation.allocatedQuantity,
      );
    }

    lines.push({
      componentId: component.id,
      componentName: component.componentName,
      requiredQuantity,
      requiredUnit: component.unit,
      status: selected.evaluation.status,
      selectedMaterialId: selected.candidate.id,
      selectedMaterialTitle: selected.candidate.title,
      isFree: selected.candidate.isFree,
      unitPrice: selected.evaluation.unitPrice,
      effectiveComponentCost: selected.evaluation.effectiveComponentCost,
      allocatedQuantity: selected.evaluation.allocatedQuantity,
      availableQuantity: selected.evaluation.availableQuantity,
      listingUnit: selected.evaluation.listingUnit,
      alternativesCount: Math.max(0, scored.length - 1),
      matchEvidence: selected.candidate.matchEvidence,
      assumptionNote: selected.evaluation.assumptionNote,
    });
  }

  const pricedLines = lines.filter(
    (line) =>
      line.status === 'SELECTED' || line.status === 'UNIT_ASSUMPTION_REQUIRED',
  );
  const missingComponentCount = lines.filter(
    (line) => line.status === 'NO_AVAILABLE_MATCH',
  ).length;
  const unpricedComponentCount = lines.filter(
    (line) =>
      line.status === 'PRICE_UNAVAILABLE' || line.status === 'UNSUPPORTED_CURRENCY',
  ).length;
  const estimatedSubtotalNis = roundMoney(
    pricedLines.reduce((sum, line) => sum + (line.effectiveComponentCost ?? 0), 0),
  );
  const quantityAssumptionWarning = lines.some((line) => line.assumptionNote)
    ? 'Some component costs use a documented listing-level assumption because units could not be converted safely.'
    : null;

  const allCovered =
    lines.length > 0 &&
    lines.every(
      (line) => line.status === 'SELECTED' || line.status === 'UNIT_ASSUMPTION_REQUIRED',
    );
  const estimateStatus: ProjectBudgetEstimateStatus = allCovered
    ? estimatedSubtotalNis === 0
      ? 'ZERO_COST_AVAILABLE_MATERIALS'
      : 'COMPLETE'
    : 'PARTIAL';

  return {
    projectId: project.id,
    projectTitle: project.title,
    projectImageUrl: project.coverImageUrl,
    categoryLabel: project.category.nameEn,
    difficulty: project.difficulty,
    estimateStatus,
    estimatedSubtotalNis,
    currency: 'NIS',
    requiredComponentCount: lines.length,
    pricedComponentCount: pricedLines.length,
    missingComponentCount,
    unpricedComponentCount,
    quantityAssumptionWarning,
    deliveryExcludedNotice,
    components: lines,
  };
};

export type BudgetComparisonMode = 'LT' | 'LTE';

export type ProjectsWithinBudgetMetrics = {
  candidateProjectsLoaded: number;
  projectsEvaluated: number;
  estimatorInvocationCount: number;
  maxConcurrency: number;
  totalDurationMs: number;
  perProjectDurationMs: number[];
  observedDatabaseQueryCount: number | null;
};

export type ProjectsWithinBudgetResultEntry = {
  estimate: ProjectMaterialBudgetEstimate;
  durationMs: number;
};

export type ProjectsWithinBudgetResult = {
  complete: ProjectsWithinBudgetResultEntry[];
  partial: ProjectsWithinBudgetResultEntry[];
  metrics: ProjectsWithinBudgetMetrics;
};

const DEFAULT_CANDIDATE_POOL_CAP = 12;
const MAX_ESTIMATOR_CONCURRENCY = 3;

const matchesBudgetBound = (input: {
  subtotalNis: number;
  maxBudgetNis: number;
  comparisonMode: BudgetComparisonMode;
}): boolean =>
  input.comparisonMode === 'LT'
    ? input.subtotalNis < input.maxBudgetNis
    : input.subtotalNis <= input.maxBudgetNis;

const BUDGET_CATEGORY_TOPIC_EXPANSIONS: Record<string, string[]> = {
  electronics: [
    'electronics',
    'robotics',
    'arduino',
    'إلكترونيات',
    'الكترونيات',
    'روبوتات',
    'أردوينو',
    'اردوينو',
  ],
  wood: ['wood', 'woodworking', 'خشب', 'نجارة'],
  fabric: ['fabric', 'textile', 'قماش', 'خياطة', 'نسيج'],
  plastic: ['plastic', 'بلاستيك'],
  metal: ['metal', 'معدن', 'معادن'],
};

const expandBudgetCategoryTopicTerms = (category: string): string[] => {
  const normalized = category.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const expanded = BUDGET_CATEGORY_TOPIC_EXPANSIONS[normalized] ?? [category.trim()];
  return [...new Set(expanded.map((term) => term.trim()).filter((term) => term.length > 0))];
};

const buildBudgetCategoryTopicClauses = (
  category: string,
): Prisma.LearningProjectWhereInput[] => {
  const terms = expandBudgetCategoryTopicTerms(category);
  const clauses: Prisma.LearningProjectWhereInput[] = [];

  for (const term of terms) {
    clauses.push(
      {
        category: {
          nameEn: {
            contains: term,
            mode: 'insensitive',
          },
        },
      },
      {
        category: {
          nameAr: {
            contains: term,
            mode: 'insensitive',
          },
        },
      },
      {
        tags: {
          some: {
            tag: {
              contains: term,
              mode: 'insensitive',
            },
          },
        },
      },
      {
        title: {
          contains: term,
          mode: 'insensitive',
        },
      },
      {
        shortDescription: {
          contains: term,
          mode: 'insensitive',
        },
      },
      {
        description: {
          contains: term,
          mode: 'insensitive',
        },
      },
    );
  }

  return clauses;
};

const buildBudgetCandidateProjectWhere = (input: {
  category?: string;
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  query?: string;
  candidateProjectIds?: string[];
}): Prisma.LearningProjectWhereInput => {
  const andClauses: Prisma.LearningProjectWhereInput[] = [
    {
      status: 'PUBLISHED',
      hiddenAt: null,
      archivedAt: null,
      category: {
        isActive: true,
        categoryType: {
          in: ['PROJECT', 'BOTH'],
        },
      },
      requiredComponents: {
        some: {
          isRequired: true,
        },
      },
    },
  ];

  if (input.candidateProjectIds?.length) {
    andClauses.push({
      id: { in: input.candidateProjectIds.slice(0, DEFAULT_CANDIDATE_POOL_CAP) },
    });
  }

  if (input.difficulty) {
    andClauses.push({ difficulty: input.difficulty });
  }

  if (input.category?.trim()) {
    andClauses.push({
      OR: buildBudgetCategoryTopicClauses(input.category),
    });
  }

  if (input.query?.trim()) {
    andClauses.push({
      OR: [
        {
          title: {
            contains: input.query,
            mode: 'insensitive',
          },
        },
        {
          shortDescription: {
            contains: input.query,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: input.query,
            mode: 'insensitive',
          },
        },
      ],
    });
  }

  return { AND: andClauses };
};

const compareBudgetSearchProjects = (
  left: ProjectsWithinBudgetResultEntry,
  right: ProjectsWithinBudgetResultEntry,
): number => {
  if (left.estimate.estimatedSubtotalNis !== right.estimate.estimatedSubtotalNis) {
    return left.estimate.estimatedSubtotalNis - right.estimate.estimatedSubtotalNis;
  }

  const titleCompare = left.estimate.projectTitle.localeCompare(
    right.estimate.projectTitle,
    undefined,
    { sensitivity: 'base' },
  );
  if (titleCompare !== 0) {
    return titleCompare;
  }

  return left.estimate.projectId.localeCompare(right.estimate.projectId);
};

const mapWithBoundedConcurrency = async <TItem, TResult>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> => {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  const runners = Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        break;
      }

      results[currentIndex] = await worker(items[currentIndex]!, currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
};

export const findProjectsWithinBudget = async (input: {
  learnerId: string;
  maxBudgetNis: number;
  comparisonMode: BudgetComparisonMode;
  category?: string;
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  query?: string;
  projectLimit?: number;
  includePartial?: boolean;
  candidateProjectIds?: string[];
  candidateLimitPerComponent?: number;
}): Promise<ProjectsWithinBudgetResult> => {
  const startedAt = Date.now();

  const projectLimit = Math.min(input.projectLimit ?? 8, 10);
    const candidateProjects = await prisma.learningProject.findMany({
      where: buildBudgetCandidateProjectWhere({
        category: input.category,
        difficulty: input.difficulty,
        query: input.query,
        candidateProjectIds: input.candidateProjectIds,
      }),
      select: budgetEstimateProjectSelect,
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      take: DEFAULT_CANDIDATE_POOL_CAP,
    });

    const preloadedLearnerContext = await loadLearnerCandidateContext(input.learnerId);
    const perProjectDurationMs: number[] = [];
    let estimatorInvocationCount = 0;

    const evaluated = await mapWithBoundedConcurrency(
      candidateProjects,
      MAX_ESTIMATOR_CONCURRENCY,
      async (project) => {
        const projectStartedAt = Date.now();
        estimatorInvocationCount += 1;
        const estimate = await estimateProjectMaterialBudget({
          projectId: project.id,
          learnerId: input.learnerId,
          candidateLimitPerComponent: input.candidateLimitPerComponent ?? 5,
          preloadedLearnerContext,
          preloadedProject: project,
        });
        const durationMs = Date.now() - projectStartedAt;
        perProjectDurationMs.push(durationMs);
        return { estimate, durationMs };
      },
    );

    const complete: ProjectsWithinBudgetResultEntry[] = [];
    const partial: ProjectsWithinBudgetResultEntry[] = [];

    for (const entry of evaluated) {
      const withinBudget = matchesBudgetBound({
        subtotalNis: entry.estimate.estimatedSubtotalNis,
        maxBudgetNis: input.maxBudgetNis,
        comparisonMode: input.comparisonMode,
      });
      if (!withinBudget) {
        continue;
      }

      if (
        entry.estimate.estimateStatus === 'COMPLETE' ||
        entry.estimate.estimateStatus === 'ZERO_COST_AVAILABLE_MATERIALS'
      ) {
        complete.push(entry);
        continue;
      }

      if (entry.estimate.estimateStatus === 'PARTIAL' && input.includePartial !== false) {
        partial.push(entry);
      }
    }

    complete.sort(compareBudgetSearchProjects);
    partial.sort(compareBudgetSearchProjects);

    return {
      complete: complete.slice(0, projectLimit),
      partial: partial.slice(0, projectLimit),
      metrics: {
        candidateProjectsLoaded: candidateProjects.length,
        projectsEvaluated: evaluated.length,
        estimatorInvocationCount,
        maxConcurrency: MAX_ESTIMATOR_CONCURRENCY,
        totalDurationMs: Date.now() - startedAt,
        perProjectDurationMs: [...perProjectDurationMs].sort((left, right) => left - right),
        observedDatabaseQueryCount: null,
      },
    };
};
