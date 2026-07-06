import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { ACTIVE_HOLD_STATUSES } from '../reservations/reservations.quantity.js';

import * as learningProjectsRepository from './learning-projects.repository.js';

const CANDIDATE_LIMIT = 10;

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
      return 'Awaiting supplier response';
    case 'AWAITING_LEARNER_CONFIRMATION':
      return 'Awaiting your confirmation';
    case 'AWAITING_SUPPLIER_CONFIRMATION':
      return 'Awaiting supplier confirmation';
    case 'ACCEPTED':
      return 'Accepted — pickup or delivery in progress';
    case 'COMPLETED':
      return 'Completed';
    case 'REJECTED':
      return 'Rejected — choose another option';
    case 'CANCELLED':
      return 'Cancelled';
    case 'EXPIRED':
      return 'Expired — choose another option';
    case 'NO_SHOW':
      return 'No-show reported';
    case 'FULFILLMENT_FAILED':
      return 'Fulfillment failed';
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

export const resolveBuildItemReadiness = (input: {
  status: string;
  linkedReservation?: LinkedReservationRecord | null;
  linkedMaterial?: LinkedMaterialRecord | null;
}) => {
  if (input.linkedReservation?.status === 'COMPLETED') {
    return {
      isReadyForBuild: true,
      readinessLabel: 'Reservation completed',
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
}) => {
  const terms = new Set<string>();
  const name = component.componentName.trim();
  if (name.length > 0) {
    terms.add(name);
  }

  for (const keyword of parseSearchKeywords(component.searchKeywords)) {
    terms.add(keyword);
  }

  const materialType = component.materialType.trim();
  if (materialType.length > 0 && materialType.toLowerCase() !== 'general') {
    terms.add(materialType);
  }

  return [...terms];
};

const buildCandidateSearchTerm = (component: {
  componentName: string;
  materialType: string;
  searchKeywords: Prisma.JsonValue | null;
}) => buildCandidateSearchTerms(component).join(' ');

const computeMatchHints = (input: {
  material: {
    categoryId: string;
    title: string;
    materialType: string;
    description: string;
  };
  component: {
    categoryId: string | null;
    componentName: string;
    materialType: string;
    searchKeywords: Prisma.JsonValue | null;
  };
  searchTerm: string;
}) => {
  const hints = new Set<string>();
  const normalizedSearch = input.searchTerm.toLowerCase();
  const normalizedName = input.component.componentName.toLowerCase();

  if (
    input.component.categoryId &&
    input.material.categoryId === input.component.categoryId
  ) {
    hints.add('Category match');
  }

  if (
    normalizedName.length > 0 &&
    input.material.title.toLowerCase().includes(normalizedName)
  ) {
    hints.add('Name match');
  } else if (
    normalizedSearch.length > 0 &&
    (input.material.title.toLowerCase().includes(normalizedSearch) ||
      input.material.description.toLowerCase().includes(normalizedSearch))
  ) {
    hints.add('Name match');
  }

  const keywords = parseSearchKeywords(input.component.searchKeywords);
  if (
    keywords.some((keyword) =>
      `${input.material.title} ${input.material.description} ${input.material.materialType}`
        .toLowerCase()
        .includes(keyword.toLowerCase()),
    )
  ) {
    hints.add('Keyword match');
  }

  const componentType = input.component.materialType.trim().toLowerCase();
  const materialType = input.material.materialType.trim().toLowerCase();
  if (
    componentType.length > 0 &&
    componentType !== 'general' &&
    (materialType.includes(componentType) || componentType.includes(materialType))
  ) {
    hints.add('Material type match');
  }

  if (hints.size === 0) {
    hints.add('Possible option');
  }

  return [...hints];
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

  const component = buildItem.requiredComponent;
  const searchTerms = buildCandidateSearchTerms(component);
  const searchTerm = buildCandidateSearchTerm(component);
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

  if (component.categoryId) {
    where.categoryId = component.categoryId;
  } else if (searchTerms.length > 0) {
    where.OR = searchTerms.flatMap((term) => [
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

  const materials = await prisma.material.findMany({
    where,
    select: {
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
      category: linkedMaterialSelect.category,
      location: linkedMaterialSelect.location,
      images: linkedMaterialSelect.images,
      supplierProfile: linkedMaterialSelect.supplierProfile,
      owner: linkedMaterialSelect.owner,
    },
    orderBy: [{ createdAt: 'desc' }],
    take: CANDIDATE_LIMIT,
  });

  if (materials.length === 0 && searchTerms.length > 0) {
    const textFallbackMaterials = await prisma.material.findMany({
      where: {
        status: { in: [...LINKABLE_MATERIAL_STATUSES] },
        ownerId: { not: input.learnerId },
        category: {
          isActive: true,
          categoryType: {
            in: ['MATERIAL', 'BOTH'],
          },
        },
        OR: searchTerms.flatMap((term) => [
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
        ]),
      },
      select: {
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
        category: linkedMaterialSelect.category,
        location: linkedMaterialSelect.location,
        images: linkedMaterialSelect.images,
        supplierProfile: linkedMaterialSelect.supplierProfile,
        owner: linkedMaterialSelect.owner,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: CANDIDATE_LIMIT,
    });

    return {
      itemId: buildItem.id,
      componentId: component.id,
      searchTerm,
      items: textFallbackMaterials.map((material) => ({
        ...mapLinkedMaterialSummary(material)!,
        matchHints: computeMatchHints({
          material: {
            categoryId: material.category.id,
            title: material.title,
            materialType: material.materialType,
            description: material.description,
          },
          component,
          searchTerm,
        }),
      })),
    };
  }

  if (materials.length === 0 && component.categoryId) {
    const fallbackMaterials = await prisma.material.findMany({
      where: {
        status: { in: [...LINKABLE_MATERIAL_STATUSES] },
        ownerId: { not: input.learnerId },
        categoryId: component.categoryId,
        category: {
          isActive: true,
          categoryType: {
            in: ['MATERIAL', 'BOTH'],
          },
        },
      },
      select: {
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
        category: linkedMaterialSelect.category,
        location: linkedMaterialSelect.location,
        images: linkedMaterialSelect.images,
        supplierProfile: linkedMaterialSelect.supplierProfile,
        owner: linkedMaterialSelect.owner,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: CANDIDATE_LIMIT,
    });

    return {
      itemId: buildItem.id,
      componentId: component.id,
      searchTerm,
      items: fallbackMaterials.map((material) => ({
        ...mapLinkedMaterialSummary(material)!,
        matchHints: computeMatchHints({
          material: {
            categoryId: material.category.id,
            title: material.title,
            materialType: material.materialType,
            description: material.description,
          },
          component,
          searchTerm,
        }),
      })),
    };
  }

  return {
    itemId: buildItem.id,
    componentId: component.id,
    searchTerm,
    items: materials.map((material) => ({
      ...mapLinkedMaterialSummary(material)!,
      matchHints: computeMatchHints({
        material: {
          categoryId: material.category.id,
          title: material.title,
          materialType: material.materialType,
          description: material.description,
        },
        component,
        searchTerm,
      }),
    })),
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
