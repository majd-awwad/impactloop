import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { ACTIVE_HOLD_STATUSES } from '../reservations/reservations.quantity.js';

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
) => {
  if (!material) {
    return null;
  }

  const isPubliclyAvailable = material.status === 'AVAILABLE';

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
    availabilityWarning: isPubliclyAvailable
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

  const component = buildItem.requiredComponent;

  if (component.componentRole === 'TOOL') {
    return {
      itemId: buildItem.id,
      componentId: component.id,
      searchTerm: component.componentName.trim(),
      items: [],
    };
  }

  const searchTerms = buildCandidateSearchTerms(component);
  const searchTerm = buildCandidateSearchTerm(component);
  const learner = await loadLearnerCandidateContext(input.learnerId);

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
    itemId: buildItem.id,
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
