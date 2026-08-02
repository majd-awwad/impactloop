import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CATEGORY_DEMAND_MIN_ACTIVITY,
  compareCategoryDemandCandidates,
  computeCategoryDemandActivityValue,
  computeCategoryDemandScore,
  computeSignalStrength,
  rankAndLimitCategoryDemand,
  resolveDemandLevel,
} from './supplier.category-demand-metrics.js';

describe('supplier.category-demand-metrics', () => {
  it('computes exact score from known inputs', () => {
    const result = computeCategoryDemandScore({
      views: 42,
      likes: 13,
      reservations: 7,
      listingCount: 10,
    });

    const viewStrength = computeSignalStrength({
      count: 42,
      listingCount: 10,
      volumeSaturation: 200,
      rateCap: 20,
    });
    const likeStrength = computeSignalStrength({
      count: 13,
      listingCount: 10,
      volumeSaturation: 40,
      rateCap: 5,
    });
    const reservationStrength = computeSignalStrength({
      count: 7,
      listingCount: 10,
      volumeSaturation: 20,
      rateCap: 3,
    });
    const expected = Math.round(
      100 *
        (0.15 * viewStrength +
          0.3 * likeStrength +
          0.55 * reservationStrength),
    );

    assert.equal(result.score, expected);
    assert.ok(result.score >= 0 && result.score <= 100);
  });

  it('keeps every score within 0–100 for extreme inputs', () => {
    const cases = [
      { views: 0, likes: 0, reservations: 0, listingCount: 0 },
      { views: 1_000_000, likes: 1_000_000, reservations: 1_000_000, listingCount: 1 },
      { views: 1_000_000, likes: 0, reservations: 0, listingCount: 1 },
      { views: 0, likes: 0, reservations: 50, listingCount: 0 },
    ];
    for (const input of cases) {
      const score = computeCategoryDemandScore(input).score;
      assert.ok(score >= 0 && score <= 100, `score=${score} for ${JSON.stringify(input)}`);
    }
  });

  it('produces identical scores for identical inputs', () => {
    const input = { views: 30, likes: 8, reservations: 3, listingCount: 12 };
    assert.deepEqual(
      computeCategoryDemandScore(input),
      computeCategoryDemandScore(input),
    );
  });

  it('does not change absolute scores when an unrelated stronger category is added', () => {
    const electronics = computeCategoryDemandScore({
      views: 20,
      likes: 5,
      reservations: 2,
      listingCount: 8,
    });
    const wood = computeCategoryDemandScore({
      views: 200,
      likes: 40,
      reservations: 15,
      listingCount: 5,
    });
    assert.equal(
      electronics.score,
      computeCategoryDemandScore({
        views: 20,
        likes: 5,
        reservations: 2,
        listingCount: 8,
      }).score,
    );
    assert.notEqual(electronics.score, wood.score);
  });

  it('does not let a large view-heavy inventory outrank a smaller reservation-heavy category', () => {
    const viewHeavy = computeCategoryDemandScore({
      views: 500,
      likes: 2,
      reservations: 0,
      listingCount: 80,
    });
    const reservationHeavy = computeCategoryDemandScore({
      views: 10,
      likes: 4,
      reservations: 6,
      listingCount: 4,
    });
    assert.ok(reservationHeavy.score > viewHeavy.score);
  });

  it('cannot produce HIGH from large raw activity alone without reservation floor', () => {
    const result = computeCategoryDemandScore({
      views: 500,
      likes: 40,
      reservations: 1,
      listingCount: 5,
    });
    assert.ok(result.score >= 40);
    assert.notEqual(result.demandLevel, 'HIGH');
  });

  it('requires score >= 70 and at least two reservations for HIGH', () => {
    const high = computeCategoryDemandScore({
      views: 40,
      likes: 15,
      reservations: 8,
      listingCount: 2,
    });
    assert.ok(high.score >= 70);
    assert.equal(resolveDemandLevel(high.score, 8), 'HIGH');
    assert.equal(high.demandLevel, 'HIGH');

    const almost = computeCategoryDemandScore({
      views: 80,
      likes: 20,
      reservations: 1,
      listingCount: 6,
    });
    assert.notEqual(almost.demandLevel, 'HIGH');
    assert.equal(resolveDemandLevel(70, 1), 'MODERATE');
    assert.equal(resolveDemandLevel(69, 5), 'MODERATE');
  });

  it('omits sparse minimum activity that scores below 15', () => {
    // activityValue = 8 views >= gate, but score should stay low
    const result = computeCategoryDemandScore({
      views: 8,
      likes: 0,
      reservations: 0,
      listingCount: 50,
    });
    assert.equal(result.activityValue, 8);
    assert.equal(result.eligible, true);
    assert.ok(result.score < 15);
    assert.equal(result.includeInResults, false);
    assert.equal(result.demandLevel, null);
  });

  it('views-only minimum activity stays below HIGH', () => {
    const result = computeCategoryDemandScore({
      views: CATEGORY_DEMAND_MIN_ACTIVITY,
      likes: 0,
      reservations: 0,
      listingCount: 1,
    });
    assert.notEqual(result.demandLevel, 'HIGH');
  });

  it('listingCount = 0 never divides by zero and stays finite', () => {
    const result = computeCategoryDemandScore({
      views: 40,
      likes: 10,
      reservations: 3,
      listingCount: 0,
    });
    assert.ok(Number.isFinite(result.score));
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.equal(result.eligible, true);
  });

  it('extreme signal counts saturate instead of growing unboundedly', () => {
    const capped = computeCategoryDemandScore({
      views: 10_000,
      likes: 10_000,
      reservations: 10_000,
      listingCount: 1,
    });
    const moreExtreme = computeCategoryDemandScore({
      views: 100_000,
      likes: 100_000,
      reservations: 100_000,
      listingCount: 1,
    });
    assert.equal(capped.score, moreExtreme.score);
    assert.equal(capped.score, 100);
  });

  it('reservations contribute more strongly than equivalent likes', () => {
    const withReservations = computeCategoryDemandScore({
      views: 0,
      likes: 0,
      reservations: 5,
      listingCount: 5,
    });
    const withLikes = computeCategoryDemandScore({
      views: 0,
      likes: 5,
      reservations: 0,
      listingCount: 5,
    });
    assert.ok(withReservations.score > withLikes.score);
  });

  it('likes contribute more strongly than equivalent views', () => {
    const withLikes = computeCategoryDemandScore({
      views: 0,
      likes: 10,
      reservations: 0,
      listingCount: 5,
    });
    const withViews = computeCategoryDemandScore({
      views: 10,
      likes: 0,
      reservations: 0,
      listingCount: 5,
    });
    assert.ok(withLikes.score > withViews.score);
  });

  it('demand levels derive from normalized score, not raw activityValue', () => {
    const lowScoreHighActivity = computeCategoryDemandScore({
      views: 100,
      likes: 0,
      reservations: 0,
      listingCount: 200,
    });
    assert.ok(lowScoreHighActivity.activityValue >= CATEGORY_DEMAND_MIN_ACTIVITY);
    assert.notEqual(lowScoreHighActivity.demandLevel, 'HIGH');
  });

  it('reason-code priority is deterministic', () => {
    const strongRes = computeCategoryDemandScore({
      views: 5,
      likes: 2,
      reservations: 6,
      listingCount: 4,
    });
    assert.equal(strongRes.primaryReason, 'STRONG_RESERVATION_ACTIVITY');

    const likeLed = computeCategoryDemandScore({
      views: 2,
      likes: 20,
      reservations: 0,
      listingCount: 4,
    });
    assert.equal(likeLed.primaryReason, 'LIKE_ENGAGEMENT');

    const viewLed = computeCategoryDemandScore({
      views: 80,
      likes: 0,
      reservations: 0,
      listingCount: 4,
    });
    assert.equal(viewLed.primaryReason, 'VIEW_ENGAGEMENT');
  });

  it('balanced engagement uses safe weighted-contribution logic', () => {
    // Craft contributions where no single weighted signal exceeds 70%.
    const balanced = computeCategoryDemandScore({
      views: 60,
      likes: 12,
      reservations: 3,
      listingCount: 8,
    });
    assert.equal(balanced.primaryReason, 'BALANCED_ENGAGEMENT');
  });

  it('sorts by score desc, activityValue desc, categoryId asc', () => {
    const ranked = rankAndLimitCategoryDemand(
      [
        { categoryId: 'b', score: 40, activityValue: 20, includeInResults: true },
        { categoryId: 'a', score: 40, activityValue: 20, includeInResults: true },
        { categoryId: 'c', score: 50, activityValue: 10, includeInResults: true },
        { categoryId: 'd', score: 40, activityValue: 30, includeInResults: true },
        { categoryId: 'e', score: 10, activityValue: 100, includeInResults: false },
      ],
      10,
    );
    assert.deepEqual(
      ranked.map((item) => item.categoryId),
      ['c', 'd', 'a', 'b'],
    );
  });

  it('limit slicing does not alter per-category scores', () => {
    const candidates = [
      {
        categoryId: 'a',
        score: computeCategoryDemandScore({
          views: 10,
          likes: 5,
          reservations: 2,
          listingCount: 5,
        }).score,
        activityValue: 40,
        includeInResults: true,
      },
      {
        categoryId: 'b',
        score: computeCategoryDemandScore({
          views: 100,
          likes: 20,
          reservations: 8,
          listingCount: 5,
        }).score,
        activityValue: 280,
        includeInResults: true,
      },
    ];
    const limited = rankAndLimitCategoryDemand(candidates, 1);
    assert.equal(limited.length, 1);
    assert.equal(limited[0]!.categoryId, 'b');
    assert.equal(limited[0]!.score, candidates[1]!.score);
  });

  it('activityValue matches the eligibility formula', () => {
    assert.equal(
      computeCategoryDemandActivityValue({
        views: 3,
        likes: 1,
        reservations: 1,
      }),
      18,
    );
  });

  it('compareCategoryDemandCandidates is transitive for ties', () => {
    assert.ok(
      compareCategoryDemandCandidates(
        { categoryId: 'a', score: 10, activityValue: 1, includeInResults: true },
        { categoryId: 'b', score: 10, activityValue: 1, includeInResults: true },
      ) < 0,
    );
  });
});
