import type {
  Prisma,
  ProjectBuildItemStatus,
  ProjectBuildStatus,
  ReservationStatus,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  getMaterialQuantityStates,
  type MaterialQuantityState,
} from '../reservations/reservations.quantity.js';

import {
  buildCandidateMatchHints,
  rankBuildMaterialCandidates,
  type BuildCandidateLearnerContext,
  type BuildCandidateMaterialInput,
} from './learning-projects.build-candidate-ranking.js';
import {
  buildAllocationPeersFromBuildItems,
  evaluateMaterialLinkCapacity,
  sumSelectedMaterialClaimsInBuild,
  unitsAreCompatible,
} from './learning-projects.build-material-allocation.js';
import {
  fetchRequiredComponentCandidateMaterialPool,
  loadLearnerCandidateContext,
} from './learning-projects.build-material-linking.js';
import { ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES } from './learning-projects.build-reservation.constants.js';
import {
  resolveBuildItemState,
  type BuildItemAcquisitionState,
  type BuildItemAllocationResult,
} from './learning-projects.build-item-state.js';
import {
  MATCH_TYPE_RANK,
  scoreMaterialAgainstComponent,
  type LearnerMaterialMatchType,
} from './learning-projects.material-component-matching.js';
import { isCoverageRequiredMaterialComponent } from './learning-projects.material-coverage.js';
import { projectBuildInclude } from './learning-projects.project-build.includes.js';
import * as learningProjectsRepository from './learning-projects.repository.js';

export const OPTIMIZER_CANDIDATE_CAP = 8;
export const OPTIMIZER_BEAM_WIDTH = 12;
export const OPTIMIZER_MAX_PLANS = 3;
export const OPTIMIZER_SUPPORTED_CURRENCY = 'NIS';

export type BuildItemPlannerClassification =
  | 'ALREADY_SATISFIED'
  | 'IN_PROGRESS'
  | 'ATTENTION'
  | 'OPTIMIZABLE';

export type BuildItemPlannerOutputState =
  | 'ALREADY_SATISFIED'
  | 'IN_PROGRESS'
  | 'ATTENTION'
  | 'PLANNED'
  | 'UNCOVERED';

export type UncoveredReason =
  | 'NO_ELIGIBLE_CANDIDATES'
  | 'INSUFFICIENT_AVAILABLE_QUANTITY'
  | 'INCOMPATIBLE_UNIT'
  | 'NO_AVAILABLE_MATERIAL'
  | 'NOT_OPTIMIZABLE';

export type OptimizerReasonTag =
  | 'EXACT_MATCH'
  | 'COMPATIBLE_MATCH'
  | 'APPROVED_ALTERNATIVE'
  | 'FREE'
  | 'SAME_CITY'
  | 'SAME_AREA'
  | 'SAME_PICKUP_AS_OTHER_ITEM'
  | 'SAME_SUPPLIER_AS_OTHER_ITEM'
  | 'ONLY_COMPATIBLE_OPTION';

export type OptimizerPlanPolicy = 'recommended' | 'cheapest' | 'fewest_pickups';

export type OptimizerPlanLabel =
  | 'BEST_OVERALL'
  | 'CHEAPEST'
  | 'FEWEST_PICKUP_LOCATIONS';

const POLICY_LABELS: Record<OptimizerPlanPolicy, OptimizerPlanLabel> = {
  recommended: 'BEST_OVERALL',
  cheapest: 'CHEAPEST',
  fewest_pickups: 'FEWEST_PICKUP_LOCATIONS',
};

const TERMINAL_FAILED_RESERVATION_STATUSES = new Set<ReservationStatus>([
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
]);

const CHECKLIST_SATISFIED_STATUSES = new Set<ProjectBuildItemStatus>([
  'ALREADY_OWNED',
  'AVAILABLE',
  'ALTERNATIVE',
]);

const isActiveLinkedReservationStatus = (status: ReservationStatus) =>
  ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES.some(
    (activeStatus) => activeStatus === status,
  );

const decimalToNumber = (value: Prisma.Decimal | null | undefined): number | null => {
  if (value == null) {
    return null;
  }

  return value.toNumber();
};

const normalizeArea = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? '';

const normalizeCity = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? '';

export type OptimizerPreparedCandidate = {
  materialId: string;
  title: string;
  matchType: LearnerMaterialMatchType;
  matchHints: string[];
  rank: number;
  requiredQuantity: number;
  unit: string;
  availableQuantity: number;
  isFree: boolean;
  unitPrice: number | null;
  lineSubtotal: number | null;
  currency: string;
  priceKnown: boolean;
  supplierProfileId: string | null;
  supplierKey: string;
  locationId: string;
  city: string;
  area: string | null;
  pickupAllowed: boolean;
  deliveryAllowed: boolean;
  matchQuality: number;
};

export type OptimizerItemContext = {
  buildItemId: string;
  requiredComponentId: string;
  componentName: string;
  requiredQuantity: number;
  requiredUnit: string;
  componentRole: string;
  isRequiredCoverage: boolean;
  classification: BuildItemPlannerClassification;
  acquisitionState: BuildItemAcquisitionState;
  allocationResult: BuildItemAllocationResult | null;
  candidates: OptimizerPreparedCandidate[];
  uncoveredReason: UncoveredReason | null;
};

export type BeamAssignment = {
  buildItemId: string;
  candidate: OptimizerPreparedCandidate;
};

export type BeamPlanState = {
  assignments: BeamAssignment[];
  plannedAllocationByMaterialId: Map<string, number>;
};

export type ResolvedPlanMetrics = {
  newlyPlannedComponents: number;
  priceUnknownCount: number;
  pickupLocationIds: Set<string>;
  supplierKeys: Set<string>;
  materialSubtotal: number;
  matchQuality: number;
  localityScore: number;
  signature: string;
};

type BuildItemRecord = Prisma.ProjectBuildGetPayload<{
  include: typeof projectBuildInclude;
}>['items'][number];

const toRankingMaterialInput = (
  material: {
    id: string;
    title: string;
    description: string;
    materialType: string;
    condition: string;
    isFree: boolean;
    price: Prisma.Decimal | null;
    pickupAllowed: boolean;
    deliveryAllowed: boolean;
    createdAt: Date;
    category: { id: string };
    location: { city: string; area: string | null };
    tags: Array<{ tag: string }>;
    supplierProfile: { verificationStatus: string | null } | null;
  },
  ownerCompletedHandovers: number,
  conceptCanonicalKeys: string[] = [],
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
  supplierVerified:
    material.supplierProfile?.verificationStatus === 'APPROVED' ||
    material.supplierProfile?.verificationStatus === 'NOT_REQUIRED',
  ownerCompletedHandovers,
  conceptCanonicalKeys,
});

export const classifyBuildItemForOptimizer = (input: {
  item: BuildItemRecord;
  component: BuildItemRecord['requiredComponent'];
  allocationWarning?: string | null;
  availableQuantity?: number | null;
  peerClaimsOnMaterial?: number;
}): BuildItemPlannerClassification => {
  const { item, component } = input;

  if (!isCoverageRequiredMaterialComponent(component)) {
    return 'ALREADY_SATISFIED';
  }

  if (CHECKLIST_SATISFIED_STATUSES.has(item.status)) {
    return 'ALREADY_SATISFIED';
  }

  const resolved = resolveBuildItemState({
    status: item.status,
    componentRole: component.componentRole,
    requiredQuantity: component.quantity.toNumber(),
    requiredUnit: component.unit,
    materialUnit: item.linkedMaterial?.unit ?? null,
    availableQuantity: input.availableQuantity ?? null,
    peerClaimsOnMaterial: input.peerClaimsOnMaterial ?? 0,
    linkedReservation: item.linkedReservation,
    linkedMaterial: item.linkedMaterial,
    allocationWarning: input.allocationWarning ?? null,
  });

  if (item.linkedMaterialId || item.linkedReservationId) {
    if (resolved.acquisitionState === 'needs_attention') {
      return 'ATTENTION';
    }

    if (item.linkedReservation?.status === 'COMPLETED') {
      return resolved.isReadyForBuild ? 'ALREADY_SATISFIED' : 'ATTENTION';
    }

    if (
      item.linkedReservation &&
      isActiveLinkedReservationStatus(item.linkedReservation.status)
    ) {
      return 'IN_PROGRESS';
    }

    if (
      item.linkedReservation &&
      TERMINAL_FAILED_RESERVATION_STATUSES.has(item.linkedReservation.status)
    ) {
      return 'ATTENTION';
    }

    if (item.linkedMaterialId) {
      if (
        resolved.allocationResult === 'insufficient_quantity' ||
        resolved.allocationResult === 'incompatible_unit' ||
        resolved.allocationResult === 'unknown_quantity' ||
        resolved.allocationResult === 'historical_conflict'
      ) {
        return 'ATTENTION';
      }

      return 'IN_PROGRESS';
    }
  }

  if (resolved.acquisitionState === 'needs_attention') {
    return 'ATTENTION';
  }

  return 'OPTIMIZABLE';
};

const resolveCandidatePricing = (input: {
  isFree: boolean;
  price: Prisma.Decimal | null;
  currency: string;
  requiredQuantity: number;
}) => {
  const currency = (input.currency || OPTIMIZER_SUPPORTED_CURRENCY).trim().toUpperCase();

  if (input.isFree) {
    return {
      currency,
      priceKnown: true,
      unitPrice: 0,
      lineSubtotal: 0,
    };
  }

  const unitPrice = decimalToNumber(input.price);
  if (currency !== OPTIMIZER_SUPPORTED_CURRENCY || unitPrice == null) {
    return {
      currency,
      priceKnown: false,
      unitPrice: null,
      lineSubtotal: null,
    };
  }

  return {
    currency,
    priceKnown: true,
    unitPrice,
    lineSubtotal: unitPrice * input.requiredQuantity,
  };
};

export const prepareOptimizableItemCandidates = (input: {
  pool: NonNullable<
    Awaited<ReturnType<typeof fetchRequiredComponentCandidateMaterialPool>>
  >;
  component: {
    id: string;
    projectId: string;
    componentName: string;
    materialType: string;
    categoryId: string | null;
    quantity: Prisma.Decimal;
    unit: string;
    canBeSubstituted: boolean;
    isRequired: boolean;
    componentRole: string;
    searchKeywords: Prisma.JsonValue | null;
    alternativeKeywords: Prisma.JsonValue | null;
    createdAt: Date;
  };
  componentPosition: number;
  requiredQuantity: number;
  requiredUnit: string;
  peerClaimsByMaterialId: Map<string, number>;
  quantityStates: Map<string, MaterialQuantityState | null>;
}): {
  candidates: OptimizerPreparedCandidate[];
  uncoveredReason: UncoveredReason | null;
} => {
  const eligible: Array<{
    material: (typeof input.pool.materials)[number];
    matchType: LearnerMaterialMatchType;
    rankingMaterial: BuildCandidateMaterialInput;
  }> = [];

  for (const material of input.pool.materials) {
    if (material.status !== 'AVAILABLE') {
      continue;
    }

    const quantityState = input.quantityStates.get(material.id);
    if (!quantityState) {
      continue;
    }

    const availableQuantity = decimalToNumber(quantityState.availableQuantity) ?? 0;
    if (availableQuantity <= 0) {
      continue;
    }

    if (!unitsAreCompatible(input.requiredUnit, material.unit)) {
      continue;
    }

    const peerClaims = input.peerClaimsByMaterialId.get(material.id) ?? 0;
    const capacity = evaluateMaterialLinkCapacity({
      availableQuantity,
      peerSelectedClaims: peerClaims,
      requiredQuantity: input.requiredQuantity,
    });
    if (!capacity.ok) {
      continue;
    }

    const conceptKeys = input.pool.materialConceptKeysById.get(material.id) ?? [];
    const scored = scoreMaterialAgainstComponent({
      material: {
        id: material.id,
        title: material.title,
        description: material.description,
        materialType: material.materialType,
        categoryId: material.category.id,
        tags: material.tags,
        conceptCanonicalKeys: conceptKeys,
      },
      component: {
        id: input.component.id,
        projectId: input.component.projectId,
        componentName: input.component.componentName,
        materialType: input.component.materialType,
        categoryId: input.component.categoryId,
        quantity: input.component.quantity,
        unit: input.component.unit,
        canBeSubstituted: input.component.canBeSubstituted,
        isRequired: input.component.isRequired,
        componentRole: input.component.componentRole as never,
        searchKeywords: input.component.searchKeywords,
        alternativeKeywords: input.component.alternativeKeywords,
        componentPosition: input.componentPosition,
        conceptCanonicalKeys: input.pool.rankingComponent.conceptCanonicalKeys,
        satisfiedByFormKeys: input.pool.rankingComponent.satisfiedByFormKeys,
      },
    });

    if (!scored) {
      continue;
    }

    const ownerCompletedHandovers =
      input.pool.ownerCompletedHandoversByOwnerId.get(material.ownerId) ?? 0;
    const rankingMaterial = toRankingMaterialInput(
      material,
      ownerCompletedHandovers,
      conceptKeys,
    );

    eligible.push({
      material,
      matchType: scored.matchType,
      rankingMaterial,
    });
  }

  if (eligible.length === 0) {
    return {
      candidates: [],
      uncoveredReason: 'NO_ELIGIBLE_CANDIDATES',
    };
  }

  const ranked = rankBuildMaterialCandidates(
    eligible.map((entry) => entry.rankingMaterial),
    input.pool.rankingComponent,
    input.pool.learner,
    OPTIMIZER_CANDIDATE_CAP,
  );

  const eligibleById = new Map(
    eligible.map((entry) => [entry.material.id, entry] as const),
  );

  const matchTypeByMaterialId = new Map(
    eligible.map((entry) => [entry.material.id, entry.matchType] as const),
  );

  const candidates: OptimizerPreparedCandidate[] = ranked.map(({ material, score }, index) => {
    const source = eligibleById.get(material.id)!.material;
    const matchType = matchTypeByMaterialId.get(material.id)!;
    const pricing = resolveCandidatePricing({
      isFree: source.isFree,
      price: source.price,
      currency: source.currency,
      requiredQuantity: input.requiredQuantity,
    });

    return {
      materialId: source.id,
      title: source.title,
      matchType,
      matchHints: buildCandidateMatchHints({
        material,
        component: input.pool.rankingComponent,
        learner: input.pool.learner,
        score,
      }),
      rank: index,
      requiredQuantity: input.requiredQuantity,
      unit: source.unit,
      availableQuantity:
        decimalToNumber(input.quantityStates.get(source.id)!.availableQuantity) ?? 0,
      isFree: source.isFree,
      unitPrice: pricing.unitPrice,
      lineSubtotal: pricing.lineSubtotal,
      currency: pricing.currency,
      priceKnown: pricing.priceKnown,
      supplierProfileId: source.supplierProfileId,
      supplierKey: source.supplierProfileId ?? source.ownerId,
      locationId: source.locationId,
      city: source.location.city,
      area: source.location.area,
      pickupAllowed: source.pickupAllowed,
      deliveryAllowed: source.deliveryAllowed,
      matchQuality: MATCH_TYPE_RANK[matchType],
    };
  });

  return {
    candidates,
    uncoveredReason: candidates.length === 0 ? 'NO_ELIGIBLE_CANDIDATES' : null,
  };
};

export const canAllocateCandidateInPlan = (input: {
  candidate: OptimizerPreparedCandidate;
  requiredQuantity: number;
  peerClaims: number;
  plannedAllocation: number;
  availableQuantity: number;
}) => {
  const totalNeeded =
    input.peerClaims + input.plannedAllocation + input.requiredQuantity;
  return totalNeeded <= input.availableQuantity;
};

export const comparePlanMetrics = (
  left: ResolvedPlanMetrics,
  right: ResolvedPlanMetrics,
  policy: OptimizerPlanPolicy,
): number => {
  const compareDesc = (leftValue: number, rightValue: number) => rightValue - leftValue;
  const compareAsc = (leftValue: number, rightValue: number) => leftValue - rightValue;

  const comparisons: Array<() => number> = [
    () =>
      compareDesc(left.newlyPlannedComponents, right.newlyPlannedComponents),
  ];

  if (policy === 'cheapest') {
    comparisons.push(
      () => compareAsc(left.priceUnknownCount, right.priceUnknownCount),
      () => compareAsc(left.materialSubtotal, right.materialSubtotal),
      () =>
        compareAsc(left.pickupLocationIds.size, right.pickupLocationIds.size),
      () => compareAsc(left.supplierKeys.size, right.supplierKeys.size),
    );
  } else if (policy === 'fewest_pickups') {
    comparisons.push(
      () =>
        compareAsc(left.pickupLocationIds.size, right.pickupLocationIds.size),
      () => compareAsc(left.supplierKeys.size, right.supplierKeys.size),
      () => compareAsc(left.priceUnknownCount, right.priceUnknownCount),
      () => compareAsc(left.materialSubtotal, right.materialSubtotal),
    );
  } else {
    comparisons.push(
      () => compareAsc(left.priceUnknownCount, right.priceUnknownCount),
      () =>
        compareAsc(left.pickupLocationIds.size, right.pickupLocationIds.size),
      () => compareAsc(left.supplierKeys.size, right.supplierKeys.size),
      () => compareAsc(left.materialSubtotal, right.materialSubtotal),
    );
  }

  comparisons.push(
    () => compareDesc(left.matchQuality, right.matchQuality),
    () => compareDesc(left.localityScore, right.localityScore),
    () => left.signature.localeCompare(right.signature),
  );

  for (const compare of comparisons) {
    const result = compare();
    if (result !== 0) {
      return result;
    }
  }

  return 0;
};

export const buildPlanSignature = (
  assignments: BeamAssignment[],
): string =>
  [...assignments]
    .sort((left, right) => left.buildItemId.localeCompare(right.buildItemId))
    .map((assignment) => `${assignment.buildItemId}:${assignment.candidate.materialId}`)
    .join('|');

export const resolvePlanMetrics = (input: {
  assignments: BeamAssignment[];
  learner: BuildCandidateLearnerContext;
}): ResolvedPlanMetrics => {
  const pickupLocationIds = new Set<string>();
  const supplierKeys = new Set<string>();
  let materialSubtotal = 0;
  let priceUnknownCount = 0;
  let matchQuality = 0;
  let localityScore = 0;

  const locationCounts = new Map<string, number>();
  const supplierCounts = new Map<string, number>();

  for (const assignment of input.assignments) {
    const candidate = assignment.candidate;
    pickupLocationIds.add(candidate.locationId);
    supplierKeys.add(candidate.supplierKey);
    locationCounts.set(
      candidate.locationId,
      (locationCounts.get(candidate.locationId) ?? 0) + 1,
    );
    supplierCounts.set(
      candidate.supplierKey,
      (supplierCounts.get(candidate.supplierKey) ?? 0) + 1,
    );
    matchQuality += candidate.matchQuality;

    if (!candidate.priceKnown) {
      priceUnknownCount += 1;
    } else {
      materialSubtotal += candidate.lineSubtotal ?? 0;
    }

    if (
      normalizeCity(input.learner.city) &&
      normalizeCity(candidate.city) === normalizeCity(input.learner.city)
    ) {
      localityScore += 1;
    }
    if (
      normalizeCity(input.learner.city) &&
      normalizeArea(input.learner.area) &&
      normalizeCity(candidate.city) === normalizeCity(input.learner.city) &&
      normalizeArea(candidate.area) === normalizeArea(input.learner.area)
    ) {
      localityScore += 1;
    }
  }

  return {
    newlyPlannedComponents: input.assignments.length,
    priceUnknownCount,
    pickupLocationIds,
    supplierKeys,
    materialSubtotal,
    matchQuality,
    localityScore,
    signature: buildPlanSignature(input.assignments),
  };
};

export const runBoundedBeamSearch = (input: {
  optimizableItems: Array<{
    buildItemId: string;
    requiredQuantity: number;
    candidates: OptimizerPreparedCandidate[];
    peerClaimsByMaterialId: Map<string, number>;
    availableQuantityByMaterialId: Map<string, number>;
  }>;
  policy: OptimizerPlanPolicy;
  learner: BuildCandidateLearnerContext;
  beamWidth?: number;
}): BeamPlanState => {
  const beamWidth = input.beamWidth ?? OPTIMIZER_BEAM_WIDTH;
  let beam: BeamPlanState[] = [
    {
      assignments: [],
      plannedAllocationByMaterialId: new Map(),
    },
  ];

  for (const item of input.optimizableItems) {
    const nextBeam: BeamPlanState[] = [];

    for (const state of beam) {
      nextBeam.push({
        assignments: [...state.assignments],
        plannedAllocationByMaterialId: new Map(state.plannedAllocationByMaterialId),
      });

      for (const candidate of item.candidates) {
        const peerClaims = item.peerClaimsByMaterialId.get(candidate.materialId) ?? 0;
        const plannedAllocation =
          state.plannedAllocationByMaterialId.get(candidate.materialId) ?? 0;
        const availableQuantity =
          item.availableQuantityByMaterialId.get(candidate.materialId) ?? 0;

        if (
          !canAllocateCandidateInPlan({
            candidate,
            requiredQuantity: item.requiredQuantity,
            peerClaims,
            plannedAllocation,
            availableQuantity,
          })
        ) {
          continue;
        }

        const plannedAllocationByMaterialId = new Map(
          state.plannedAllocationByMaterialId,
        );
        plannedAllocationByMaterialId.set(
          candidate.materialId,
          plannedAllocation + item.requiredQuantity,
        );

        nextBeam.push({
          assignments: [
            ...state.assignments,
            {
              buildItemId: item.buildItemId,
              candidate,
            },
          ],
          plannedAllocationByMaterialId,
        });
      }
    }

    nextBeam.sort((left, right) => {
      const leftMetrics = resolvePlanMetrics({
        assignments: left.assignments,
        learner: input.learner,
      });
      const rightMetrics = resolvePlanMetrics({
        assignments: right.assignments,
        learner: input.learner,
      });
      return comparePlanMetrics(leftMetrics, rightMetrics, input.policy);
    });

    beam = nextBeam.slice(0, beamWidth);
  }

  return (
    beam[0] ?? {
      assignments: [],
      plannedAllocationByMaterialId: new Map(),
    }
  );
};

const matchTypeToReasonTag = (
  matchType: LearnerMaterialMatchType,
): OptimizerReasonTag => {
  switch (matchType) {
    case 'EXACT':
      return 'EXACT_MATCH';
    case 'COMPATIBLE':
      return 'COMPATIBLE_MATCH';
    case 'ALTERNATIVE':
      return 'APPROVED_ALTERNATIVE';
  }
};

export const buildReasonTagsForPlannedItem = (input: {
  candidate: OptimizerPreparedCandidate;
  learner: BuildCandidateLearnerContext;
  otherPlannedCandidates: OptimizerPreparedCandidate[];
  onlyCompatibleOption: boolean;
}): OptimizerReasonTag[] => {
  const tags = new Set<OptimizerReasonTag>();
  tags.add(matchTypeToReasonTag(input.candidate.matchType));

  if (input.candidate.isFree) {
    tags.add('FREE');
  }

  if (
    normalizeCity(input.learner.city) &&
    normalizeCity(input.candidate.city) === normalizeCity(input.learner.city)
  ) {
    tags.add('SAME_CITY');
  }

  if (
    normalizeCity(input.learner.city) &&
    normalizeArea(input.learner.area) &&
    normalizeCity(input.candidate.city) === normalizeCity(input.learner.city) &&
    normalizeArea(input.candidate.area) === normalizeArea(input.learner.area)
  ) {
    tags.add('SAME_AREA');
  }

  if (
    input.otherPlannedCandidates.some(
      (other) => other.locationId === input.candidate.locationId,
    )
  ) {
    tags.add('SAME_PICKUP_AS_OTHER_ITEM');
  }

  if (
    input.otherPlannedCandidates.some(
      (other) => other.supplierKey === input.candidate.supplierKey,
    )
  ) {
    tags.add('SAME_SUPPLIER_AS_OTHER_ITEM');
  }

  if (input.onlyCompatibleOption) {
    tags.add('ONLY_COMPATIBLE_OPTION');
  }

  return [...tags];
};

const POLICY_ORDER: OptimizerPlanPolicy[] = [
  'recommended',
  'cheapest',
  'fewest_pickups',
];

export const mergeEquivalentOptimizerPlans = (
  plans: Array<{
    key: OptimizerPlanPolicy;
    labels: OptimizerPlanLabel[];
    beam: BeamPlanState;
  }>,
) => {
  const merged = new Map<
    string,
    {
      keys: OptimizerPlanPolicy[];
      labels: OptimizerPlanLabel[];
      beam: BeamPlanState;
    }
  >();

  for (const plan of plans) {
    const signature = buildPlanSignature(plan.beam.assignments);
    const existing = merged.get(signature);
    if (existing) {
      existing.keys.push(plan.key);
      for (const label of plan.labels) {
        if (!existing.labels.includes(label)) {
          existing.labels.push(label);
        }
      }
      continue;
    }

    merged.set(signature, {
      keys: [plan.key],
      labels: [...plan.labels],
      beam: plan.beam,
    });
  }

  return [...merged.values()]
    .map((entry) => ({
      ...entry,
      keys: [...entry.keys].sort(
        (left, right) =>
          POLICY_ORDER.indexOf(left) - POLICY_ORDER.indexOf(right),
      ),
      labels: [...entry.labels].sort((left, right) => left.localeCompare(right)),
    }))
    .slice(0, OPTIMIZER_MAX_PLANS);
};

const assertEligibleBuildStatus = (status: ProjectBuildStatus) => {
  if (status === 'ARCHIVED') {
    throw new AppError('This build is archived', 409, 'BUILD_ARCHIVED');
  }

  if (status === 'COMPLETED') {
    throw new AppError('This build is completed', 409, 'BUILD_COMPLETED');
  }

  if (status !== 'IN_PROGRESS' && status !== 'PAUSED') {
    throw new AppError('Project build not found', 404, 'NOT_FOUND');
  }
};

const sortOptimizableItems = (
  items: OptimizerItemContext[],
): OptimizerItemContext[] =>
  [...items].sort((left, right) => {
    if (left.candidates.length !== right.candidates.length) {
      return left.candidates.length - right.candidates.length;
    }

    if (left.requiredQuantity !== right.requiredQuantity) {
      return right.requiredQuantity - left.requiredQuantity;
    }

    return left.buildItemId.localeCompare(right.buildItemId);
  });

export const optimizeProjectBuildPlan = async (input: {
  projectId: string;
  learnerId: string;
}) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    input.projectId,
  );
  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  const build = await learningProjectsRepository.findProjectBuild(
    input.projectId,
    input.learnerId,
  );
  if (!build) {
    throw new AppError('Project build not found', 404, 'NOT_FOUND');
  }

  assertEligibleBuildStatus(build.status);

  const learner = await loadLearnerCandidateContext(input.learnerId);
  const peers = buildAllocationPeersFromBuildItems(build.items);
  const linkedMaterialIds = [
    ...new Set(
      build.items
        .map((item) => item.linkedMaterialId)
        .filter((materialId): materialId is string => materialId != null),
    ),
  ];
  const quantityStates = await getMaterialQuantityStates(prisma, linkedMaterialIds);

  const itemContexts: OptimizerItemContext[] = [];
  const optimizableItems: OptimizerItemContext[] = [];

  const componentPositionById = new Map(
    [...build.items]
      .sort(
        (left, right) =>
          left.requiredComponent.createdAt.getTime() -
          right.requiredComponent.createdAt.getTime(),
      )
      .map((item, index) => [item.requiredComponent.id, index] as const),
  );

  const allCandidateMaterialIds = new Set<string>();
  const optimizablePools: Array<{
    item: BuildItemRecord;
    pool: NonNullable<
      Awaited<ReturnType<typeof fetchRequiredComponentCandidateMaterialPool>>
    >;
  }> = [];

  for (const item of build.items) {
    const component = item.requiredComponent;
    const materialId = item.linkedMaterialId;
    const peerClaimsOnMaterial =
      materialId != null
        ? sumSelectedMaterialClaimsInBuild({
            materialId,
            peerItems: peers,
            excludeItemId: item.id,
          })
        : 0;
    const availableQuantity =
      item.linkedReservation?.status === 'COMPLETED'
        ? null
        : materialId != null
          ? decimalToNumber(quantityStates.get(materialId)?.availableQuantity ?? null)
          : null;

    const classification = classifyBuildItemForOptimizer({
      item,
      component,
      peerClaimsOnMaterial,
      availableQuantity,
    });

    const resolved = resolveBuildItemState({
      status: item.status,
      componentRole: component.componentRole,
      requiredQuantity: component.quantity.toNumber(),
      requiredUnit: component.unit,
      materialUnit: item.linkedMaterial?.unit ?? null,
      availableQuantity,
      peerClaimsOnMaterial,
      linkedReservation: item.linkedReservation,
      linkedMaterial: item.linkedMaterial,
    });

    const baseContext: OptimizerItemContext = {
      buildItemId: item.id,
      requiredComponentId: component.id,
      componentName: component.componentName,
      requiredQuantity: component.quantity.toNumber(),
      requiredUnit: component.unit,
      componentRole: component.componentRole,
      isRequiredCoverage: isCoverageRequiredMaterialComponent(component),
      classification,
      acquisitionState: resolved.acquisitionState,
      allocationResult: resolved.allocationResult,
      candidates: [],
      uncoveredReason: null,
    };

    if (classification === 'OPTIMIZABLE') {
      const pool = await fetchRequiredComponentCandidateMaterialPool({
        learnerId: input.learnerId,
        component: {
          id: component.id,
          componentRole: component.componentRole,
          categoryId: component.categoryId,
          componentName: component.componentName,
          materialType: component.materialType,
          searchKeywords: component.searchKeywords,
          alternativeKeywords: component.alternativeKeywords,
        },
        preloadedLearner: learner,
      });

      if (pool) {
        optimizablePools.push({ item, pool });
        for (const material of pool.materials) {
          allCandidateMaterialIds.add(material.id);
        }
      }
    }

    itemContexts.push(baseContext);
  }

  const candidateQuantityStates = await getMaterialQuantityStates(
    prisma,
    [...allCandidateMaterialIds],
  );

  for (const { item, pool } of optimizablePools) {
    const component = item.requiredComponent;
    const peerClaimsByMaterialId = new Map<string, number>();

    for (const materialId of pool.materials.map((material) => material.id)) {
      peerClaimsByMaterialId.set(
        materialId,
        sumSelectedMaterialClaimsInBuild({
          materialId,
          peerItems: peers,
          excludeItemId: item.id,
        }),
      );
    }

    const prepared = prepareOptimizableItemCandidates({
      pool,
      component: {
        id: component.id,
        projectId: build.projectId,
        componentName: component.componentName,
        materialType: component.materialType,
        categoryId: component.categoryId,
        quantity: component.quantity,
        unit: component.unit,
        canBeSubstituted: component.canBeSubstituted,
        isRequired: component.isRequired,
        componentRole: component.componentRole,
        searchKeywords: component.searchKeywords,
        alternativeKeywords: component.alternativeKeywords,
        createdAt: component.createdAt,
      },
      componentPosition: componentPositionById.get(component.id) ?? 0,
      requiredQuantity: component.quantity.toNumber(),
      requiredUnit: component.unit,
      peerClaimsByMaterialId,
      quantityStates: candidateQuantityStates,
    });

    const context = itemContexts.find((entry) => entry.buildItemId === item.id);
    if (!context) {
      continue;
    }

    context.candidates = prepared.candidates;
    context.uncoveredReason = prepared.uncoveredReason;
    optimizableItems.push(context);
  }

  const sortedOptimizableItems = sortOptimizableItems(optimizableItems);
  const beamItems = sortedOptimizableItems.map((item) => {
    const availableQuantityByMaterialId = new Map<string, number>();
    for (const candidate of item.candidates) {
      availableQuantityByMaterialId.set(
        candidate.materialId,
        candidate.availableQuantity,
      );
    }

    const peerClaimsByMaterialId = new Map<string, number>();
    for (const candidate of item.candidates) {
      peerClaimsByMaterialId.set(
        candidate.materialId,
        sumSelectedMaterialClaimsInBuild({
          materialId: candidate.materialId,
          peerItems: peers,
          excludeItemId: item.buildItemId,
        }),
      );
    }

    return {
      buildItemId: item.buildItemId,
      requiredQuantity: item.requiredQuantity,
      candidates: item.candidates,
      peerClaimsByMaterialId,
      availableQuantityByMaterialId,
    };
  });

  const policyPlans = (['recommended', 'cheapest', 'fewest_pickups'] as const).map(
    (policy) => ({
      key: policy,
      labels: [POLICY_LABELS[policy]],
      beam: runBoundedBeamSearch({
        optimizableItems: beamItems,
        policy,
        learner,
      }),
    }),
  );

  const mergedPlans = mergeEquivalentOptimizerPlans(policyPlans);

  const requiredComponents = itemContexts.filter((item) => item.isRequiredCoverage);
  const summary = {
    requiredComponents: requiredComponents.length,
    alreadySatisfied: requiredComponents.filter(
      (item) => item.classification === 'ALREADY_SATISFIED',
    ).length,
    inProgress: requiredComponents.filter(
      (item) => item.classification === 'IN_PROGRESS',
    ).length,
    attention: requiredComponents.filter(
      (item) => item.classification === 'ATTENTION',
    ).length,
    optimizable: requiredComponents.filter(
      (item) => item.classification === 'OPTIMIZABLE',
    ).length,
  };

  const plans = mergedPlans.map((plan) => {
    const assignmentByItemId = new Map(
      plan.beam.assignments.map((assignment) => [
        assignment.buildItemId,
        assignment.candidate,
      ]),
    );
    const plannedCandidates = plan.beam.assignments.map(
      (assignment) => assignment.candidate,
    );

    const items = itemContexts.map((item) => {
      const base = {
        buildItemId: item.buildItemId,
        requiredComponentId: item.requiredComponentId,
        componentName: item.componentName,
        requiredQuantity: item.requiredQuantity,
        requiredUnit: item.requiredUnit,
        acquisitionState: item.acquisitionState,
        allocationResult: item.allocationResult,
      };

      if (!item.isRequiredCoverage) {
        return {
          ...base,
          plannerState: 'ALREADY_SATISFIED' as const,
        };
      }

      if (item.classification === 'ALREADY_SATISFIED') {
        return {
          ...base,
          plannerState: 'ALREADY_SATISFIED' as const,
        };
      }

      if (item.classification === 'IN_PROGRESS') {
        return {
          ...base,
          plannerState: 'IN_PROGRESS' as const,
        };
      }

      if (item.classification === 'ATTENTION') {
        return {
          ...base,
          plannerState: 'ATTENTION' as const,
        };
      }

      const plannedCandidate = assignmentByItemId.get(item.buildItemId);
      if (plannedCandidate) {
        const otherPlanned = plannedCandidates.filter(
          (candidate) => candidate.materialId !== plannedCandidate.materialId,
        );
        return {
          ...base,
          plannerState: 'PLANNED' as const,
          candidate: {
            materialId: plannedCandidate.materialId,
            title: plannedCandidate.title,
            matchType: plannedCandidate.matchType,
            matchHints: plannedCandidate.matchHints,
            allocatedQuantity: item.requiredQuantity,
            unit: plannedCandidate.unit,
            availableQuantity: plannedCandidate.availableQuantity,
            isFree: plannedCandidate.isFree,
            unitPrice: plannedCandidate.unitPrice,
            lineSubtotal: plannedCandidate.lineSubtotal,
            currency: plannedCandidate.currency,
            priceKnown: plannedCandidate.priceKnown,
            supplierProfileId: plannedCandidate.supplierProfileId,
            locationId: plannedCandidate.locationId,
            city: plannedCandidate.city,
            area: plannedCandidate.area,
            pickupAllowed: plannedCandidate.pickupAllowed,
            deliveryAllowed: plannedCandidate.deliveryAllowed,
          },
          reasonTags: buildReasonTagsForPlannedItem({
            candidate: plannedCandidate,
            learner,
            otherPlannedCandidates: otherPlanned,
            onlyCompatibleOption: item.candidates.length === 1,
          }),
        };
      }

      return {
        ...base,
        plannerState: 'UNCOVERED' as const,
        uncoveredReason: item.uncoveredReason ?? 'NO_ELIGIBLE_CANDIDATES',
      };
    });

    const metrics = resolvePlanMetrics({
      assignments: plan.beam.assignments,
      learner,
    });

    const totalCoveredComponents =
      summary.alreadySatisfied +
      summary.inProgress +
      metrics.newlyPlannedComponents;

    return {
      key: plan.keys[0]!,
      labels: plan.labels,
      summary: {
        newlyPlannedComponents: metrics.newlyPlannedComponents,
        totalCoveredComponents,
        totalRequiredComponents: summary.requiredComponents,
        uncoveredComponents:
          summary.optimizable - metrics.newlyPlannedComponents,
        materialSubtotal: metrics.materialSubtotal,
        currency: OPTIMIZER_SUPPORTED_CURRENCY,
        priceUnknownCount: metrics.priceUnknownCount,
        supplierCount: metrics.supplierKeys.size,
        pickupLocationCount: metrics.pickupLocationIds.size,
        deliveryFeeIncluded: false,
      },
      items,
    };
  });

  return {
    buildId: build.id,
    projectId: build.projectId,
    generatedAt: new Date().toISOString(),
    advisory: true,
    summary,
    plans,
  };
};
