import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  computeMaterialDemandMetrics,
  DEMAND_SCORE_WEIGHTS,
  foldMaterialReservationStatusCounts,
} from './supplier.material-demand-metrics.js';

describe('computeMaterialDemandMetrics', () => {
  test('no signals returns zero metrics', () => {
    const metrics = computeMaterialDemandMetrics({
      viewsCount: 0,
      likesCount: 0,
      pendingReservationsCount: 0,
      reservedReservationsCount: 0,
      completedReservationsCount: 0,
      reusedCount: 0,
    });

    assert.equal(metrics.activeRequestsCount, 0);
    assert.equal(metrics.completedReservationsCount, 0);
    assert.equal(metrics.demandScorePercent, 0);
    assert.equal(metrics.activeDemandScore, 0);
  });

  test('views and likes contribute to lifetime demand score', () => {
    const metrics = computeMaterialDemandMetrics({
      viewsCount: 1,
      likesCount: 1,
      pendingReservationsCount: 0,
      reservedReservationsCount: 0,
      completedReservationsCount: 0,
      reusedCount: 0,
    });

    assert.equal(metrics.activeRequestsCount, 0);
    assert.equal(metrics.demandScorePercent, 6);
  });

  test('pending reservation counts as active demand', () => {
    const metrics = computeMaterialDemandMetrics({
      viewsCount: 0,
      likesCount: 0,
      pendingReservationsCount: 1,
      reservedReservationsCount: 0,
      completedReservationsCount: 0,
      reusedCount: 0,
    });

    assert.equal(metrics.activeRequestsCount, 1);
    assert.equal(metrics.activeDemandScore, DEMAND_SCORE_WEIGHTS.pendingReservation);
    assert.equal(metrics.demandScorePercent, DEMAND_SCORE_WEIGHTS.pendingReservation);
  });

  test('accepted reservation counts as active demand', () => {
    const metrics = computeMaterialDemandMetrics({
      viewsCount: 0,
      likesCount: 0,
      pendingReservationsCount: 0,
      reservedReservationsCount: 1,
      completedReservationsCount: 0,
      reusedCount: 0,
    });

    assert.equal(metrics.activeRequestsCount, 1);
    assert.equal(metrics.activeDemandScore, DEMAND_SCORE_WEIGHTS.acceptedReservation);
    assert.equal(metrics.demandScorePercent, DEMAND_SCORE_WEIGHTS.acceptedReservation);
  });

  test('completed reservation contributes to lifetime score but not active demand', () => {
    const metrics = computeMaterialDemandMetrics({
      viewsCount: 1,
      likesCount: 1,
      pendingReservationsCount: 0,
      reservedReservationsCount: 0,
      completedReservationsCount: 1,
      reusedCount: 1,
    });

    assert.equal(metrics.activeRequestsCount, 0);
    assert.equal(metrics.completedReservationsCount, 1);
    assert.equal(metrics.demandScorePercent, 46);
    assert.equal(metrics.activeDemandScore, 0);
  });

  test('completed and pending reservations combine correctly', () => {
    const metrics = computeMaterialDemandMetrics({
      viewsCount: 0,
      likesCount: 0,
      pendingReservationsCount: 1,
      reservedReservationsCount: 0,
      completedReservationsCount: 1,
      reusedCount: 1,
    });

    assert.equal(metrics.activeRequestsCount, 1);
    assert.equal(
      metrics.demandScorePercent,
      DEMAND_SCORE_WEIGHTS.pendingReservation +
        DEMAND_SCORE_WEIGHTS.completedReservation,
    );
  });

  test('reusedCount is not double-counted when completed reservations exist', () => {
    const metrics = computeMaterialDemandMetrics({
      viewsCount: 0,
      likesCount: 0,
      pendingReservationsCount: 0,
      reservedReservationsCount: 0,
      completedReservationsCount: 1,
      reusedCount: 1,
    });

    assert.equal(metrics.demandScorePercent, DEMAND_SCORE_WEIGHTS.completedReservation);
  });

  test('reusedCount contributes when completed reservations are unavailable', () => {
    const metrics = computeMaterialDemandMetrics({
      viewsCount: 0,
      likesCount: 0,
      pendingReservationsCount: 0,
      reservedReservationsCount: 0,
      completedReservationsCount: 0,
      reusedCount: 1,
    });

    assert.equal(metrics.demandScorePercent, DEMAND_SCORE_WEIGHTS.completedReservation);
  });
});

describe('foldMaterialReservationStatusCounts', () => {
  test('groups pending, accepted, and completed statuses', () => {
    const counts = foldMaterialReservationStatusCounts([
      { status: 'PENDING', count: 1 },
      { status: 'AWAITING_SUPPLIER_CONFIRMATION', count: 1 },
      { status: 'ACCEPTED', count: 2 },
      { status: 'AWAITING_RESOLUTION', count: 1 },
      { status: 'COMPLETED', count: 3 },
      { status: 'REJECTED', count: 4 },
      { status: 'CANCELLED', count: 2 },
    ]);

    assert.equal(counts.pendingReservationsCount, 2);
    assert.equal(counts.reservedReservationsCount, 3);
    assert.equal(counts.completedReservationsCount, 3);
  });
});
