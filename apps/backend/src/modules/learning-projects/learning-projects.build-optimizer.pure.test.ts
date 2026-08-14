import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildPlanSignature,
  canAllocateCandidateInPlan,
  comparePlanMetrics,
  mergeEquivalentOptimizerPlans,
  resolvePlanMetrics,
  runBoundedBeamSearch,
  type BeamAssignment,
  type OptimizerPreparedCandidate,
} from './learning-projects.build-optimizer.js';

const candidate = (
  overrides: Partial<OptimizerPreparedCandidate> & {
    materialId: string;
    locationId: string;
    supplierKey: string;
  },
): OptimizerPreparedCandidate => ({
  materialId: overrides.materialId,
  title: overrides.title ?? overrides.materialId,
  matchType: overrides.matchType ?? 'EXACT',
  matchHints: overrides.matchHints ?? [],
  rank: overrides.rank ?? 0,
  requiredQuantity: overrides.requiredQuantity ?? 1,
  unit: overrides.unit ?? 'piece',
  availableQuantity: overrides.availableQuantity ?? 10,
  isFree: overrides.isFree ?? false,
  unitPrice: overrides.unitPrice ?? 10,
  lineSubtotal: overrides.lineSubtotal ?? 10,
  currency: overrides.currency ?? 'NIS',
  priceKnown: overrides.priceKnown ?? true,
  supplierProfileId: overrides.supplierProfileId ?? overrides.supplierKey,
  supplierKey: overrides.supplierKey,
  locationId: overrides.locationId,
  city: overrides.city ?? 'Ramallah',
  area: overrides.area ?? 'Al Bireh',
  pickupAllowed: overrides.pickupAllowed ?? true,
  deliveryAllowed: overrides.deliveryAllowed ?? false,
  matchQuality: overrides.matchQuality ?? 3,
});

const assignment = (
  buildItemId: string,
  material: OptimizerPreparedCandidate,
): BeamAssignment => ({
  buildItemId,
  candidate: material,
});

describe('learning-projects.build-optimizer pure', () => {
  test('coverage beats lower cost in recommended comparator', () => {
    const highCoverage = resolvePlanMetrics({
      assignments: [
        assignment('item-a', candidate({ materialId: 'm1', locationId: 'l1', supplierKey: 's1', lineSubtotal: 30 })),
        assignment('item-b', candidate({ materialId: 'm2', locationId: 'l2', supplierKey: 's2', isFree: true, unitPrice: 0, lineSubtotal: 0 })),
      ],
      learner: { city: 'Ramallah', area: 'Al Bireh' },
    });
    const lowCoverage = resolvePlanMetrics({
      assignments: [
        assignment('item-a', candidate({ materialId: 'm3', locationId: 'l3', supplierKey: 's3', lineSubtotal: 0, isFree: true, unitPrice: 0, lineSubtotal: 0 })),
      ],
      learner: { city: 'Ramallah', area: 'Al Bireh' },
    });

    assert.ok(
      comparePlanMetrics(highCoverage, lowCoverage, 'recommended') < 0,
      'higher coverage should rank first',
    );
  });

  test('cheapest and fewest pickups can choose different winners', () => {
    const cheapTwoStops = resolvePlanMetrics({
      assignments: [
        assignment('item-a', candidate({ materialId: 'm1', locationId: 'l1', supplierKey: 's1', lineSubtotal: 10 })),
        assignment('item-b', candidate({ materialId: 'm2', locationId: 'l2', supplierKey: 's2', isFree: true, unitPrice: 0, lineSubtotal: 0 })),
      ],
      learner: { city: 'Ramallah', area: null },
    });
    const expensiveOneStop = resolvePlanMetrics({
      assignments: [
        assignment('item-a', candidate({ materialId: 'm3', locationId: 'l9', supplierKey: 's9', lineSubtotal: 20 })),
        assignment('item-b', candidate({ materialId: 'm4', locationId: 'l9', supplierKey: 's9', lineSubtotal: 0, isFree: true, unitPrice: 0, lineSubtotal: 0 })),
      ],
      learner: { city: 'Ramallah', area: null },
    });

    assert.ok(
      comparePlanMetrics(cheapTwoStops, expensiveOneStop, 'cheapest') < 0,
      'cheapest should prefer lower subtotal at equal coverage',
    );
    assert.ok(
      comparePlanMetrics(expensiveOneStop, cheapTwoStops, 'fewest_pickups') < 0,
      'fewest pickups should prefer fewer locations at equal coverage',
    );
  });

  test('unknown price is not treated as zero in plan metrics', () => {
    const unknownPrice = resolvePlanMetrics({
      assignments: [
        assignment(
          'item-a',
          candidate({
            materialId: 'm-unknown',
            locationId: 'l1',
            supplierKey: 's1',
            priceKnown: false,
            unitPrice: null,
            lineSubtotal: null,
          }),
        ),
      ],
      learner: { city: null, area: null },
    });
    const knownPrice = resolvePlanMetrics({
      assignments: [
        assignment(
          'item-a',
          candidate({
            materialId: 'm-known',
            locationId: 'l2',
            supplierKey: 's2',
            priceKnown: true,
            unitPrice: 10,
            lineSubtotal: 10,
          }),
        ),
      ],
      learner: { city: null, area: null },
    });

    assert.equal(unknownPrice.materialSubtotal, 0);
    assert.equal(unknownPrice.priceUnknownCount, 1);
    assert.equal(knownPrice.materialSubtotal, 10);
    assert.ok(
      comparePlanMetrics(knownPrice, unknownPrice, 'cheapest') < 0,
      'known price should beat unknown at equal coverage',
    );
  });

  test('global quantity conflicts are prevented in beam search', () => {
    const shared = candidate({
      materialId: 'shared',
      locationId: 'l1',
      supplierKey: 's1',
      availableQuantity: 5,
      lineSubtotal: 5,
    });

    const result = runBoundedBeamSearch({
      optimizableItems: [
        {
          buildItemId: 'item-a',
          requiredQuantity: 3,
          candidates: [shared],
          peerClaimsByMaterialId: new Map([['shared', 0]]),
          availableQuantityByMaterialId: new Map([['shared', 5]]),
        },
        {
          buildItemId: 'item-b',
          requiredQuantity: 3,
          candidates: [shared],
          peerClaimsByMaterialId: new Map([['shared', 0]]),
          availableQuantityByMaterialId: new Map([['shared', 5]]),
        },
      ],
      policy: 'recommended',
      learner: { city: null, area: null },
      beamWidth: 12,
    });

    const sharedAssignments = result.assignments.filter(
      (entry) => entry.candidate.materialId === 'shared',
    );
    assert.ok(sharedAssignments.length <= 1);
  });

  test('shared material may serve multiple items within capacity', () => {
    const shared = candidate({
      materialId: 'shared',
      locationId: 'l1',
      supplierKey: 's1',
      availableQuantity: 6,
      lineSubtotal: 3,
    });

    const result = runBoundedBeamSearch({
      optimizableItems: [
        {
          buildItemId: 'item-a',
          requiredQuantity: 3,
          candidates: [shared],
          peerClaimsByMaterialId: new Map([['shared', 0]]),
          availableQuantityByMaterialId: new Map([['shared', 6]]),
        },
        {
          buildItemId: 'item-b',
          requiredQuantity: 3,
          candidates: [shared],
          peerClaimsByMaterialId: new Map([['shared', 0]]),
          availableQuantityByMaterialId: new Map([['shared', 6]]),
        },
      ],
      policy: 'recommended',
      learner: { city: null, area: null },
      beamWidth: 12,
    });

    assert.equal(result.assignments.length, 2);
    assert.ok(
      result.assignments.every((entry) => entry.candidate.materialId === 'shared'),
    );
  });

  test('canAllocateCandidateInPlan respects peer and planned allocations', () => {
    assert.equal(
      canAllocateCandidateInPlan({
        candidate: candidate({ materialId: 'm1', locationId: 'l1', supplierKey: 's1' }),
        requiredQuantity: 7,
        peerClaims: 4,
        plannedAllocation: 0,
        availableQuantity: 10,
      }),
      false,
    );
    assert.equal(
      canAllocateCandidateInPlan({
        candidate: candidate({ materialId: 'm1', locationId: 'l1', supplierKey: 's1' }),
        requiredQuantity: 4,
        peerClaims: 4,
        plannedAllocation: 3,
        availableQuantity: 10,
      }),
      false,
    );
    assert.equal(
      canAllocateCandidateInPlan({
        candidate: candidate({ materialId: 'm1', locationId: 'l1', supplierKey: 's1' }),
        requiredQuantity: 3,
        peerClaims: 4,
        plannedAllocation: 0,
        availableQuantity: 10,
      }),
      true,
    );
  });

  test('plan deduplication merges identical assignments', () => {
    const beam: BeamAssignment[] = [
      assignment('item-a', candidate({ materialId: 'm1', locationId: 'l1', supplierKey: 's1' })),
    ];

    const merged = mergeEquivalentOptimizerPlans([
      { key: 'recommended', labels: ['BEST_OVERALL'], beam: { assignments: beam, plannedAllocationByMaterialId: new Map() } },
      { key: 'cheapest', labels: ['CHEAPEST'], beam: { assignments: beam, plannedAllocationByMaterialId: new Map() } },
      { key: 'fewest_pickups', labels: ['FEWEST_PICKUP_LOCATIONS'], beam: { assignments: beam, plannedAllocationByMaterialId: new Map() } },
    ]);

    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0]?.labels, [
      'BEST_OVERALL',
      'CHEAPEST',
      'FEWEST_PICKUP_LOCATIONS',
    ]);
  });

  test('plan signature is deterministic', () => {
    const left = buildPlanSignature([
      assignment('b', candidate({ materialId: 'm2', locationId: 'l2', supplierKey: 's2' })),
      assignment('a', candidate({ materialId: 'm1', locationId: 'l1', supplierKey: 's1' })),
    ]);
    const right = buildPlanSignature([
      assignment('a', candidate({ materialId: 'm1', locationId: 'l1', supplierKey: 's1' })),
      assignment('b', candidate({ materialId: 'm2', locationId: 'l2', supplierKey: 's2' })),
    ]);

    assert.equal(left, right);
    assert.equal(left, 'a:m1|b:m2');
  });

  test('beam search output is deterministic', () => {
    const itemA = {
      buildItemId: 'item-a',
      requiredQuantity: 1,
      candidates: [
        candidate({ materialId: 'm-b', locationId: 'l2', supplierKey: 's2', rank: 1, lineSubtotal: 5 }),
        candidate({ materialId: 'm-a', locationId: 'l1', supplierKey: 's1', rank: 0, lineSubtotal: 10 }),
      ],
      peerClaimsByMaterialId: new Map<string, number>(),
      availableQuantityByMaterialId: new Map([
        ['m-a', 5],
        ['m-b', 5],
      ]),
    };

    const first = runBoundedBeamSearch({
      optimizableItems: [itemA],
      policy: 'recommended',
      learner: { city: null, area: null },
    });
    const second = runBoundedBeamSearch({
      optimizableItems: [itemA],
      policy: 'recommended',
      learner: { city: null, area: null },
    });

    assert.equal(
      buildPlanSignature(first.assignments),
      buildPlanSignature(second.assignments),
    );
  });
});
