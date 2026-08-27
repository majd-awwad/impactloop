import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  WEAK_MATCH_SCORE_THRESHOLD,
  isWeakMatchScore,
} from './material-requests.lifecycle.js';

describe('material request weak-match classification', () => {
  test('category-only evidence is weak', () => {
    assert.equal(
      isWeakMatchScore({ rankingScore: WEAK_MATCH_SCORE_THRESHOLD }),
      true,
    );
  });

  test('semantic evidence above the category-only score is not weak', () => {
    assert.equal(
      isWeakMatchScore({ rankingScore: WEAK_MATCH_SCORE_THRESHOLD + 1 }),
      false,
    );
  });

  test('lower and absent evidence remain weak', () => {
    assert.equal(isWeakMatchScore({ rankingScore: 50 }), true);
    assert.equal(isWeakMatchScore({ rankingScore: 0 }), true);
  });
});
