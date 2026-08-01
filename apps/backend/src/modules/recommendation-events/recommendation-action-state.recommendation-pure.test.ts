import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  RecommendationToggleReplayConflictError,
  reduceRecommendationToggleState,
  type RecommendationToggleTransition,
} from './recommendation-action-state.js';

const identity = {
  learnerId: 'learner-1',
  entityType: 'MATERIAL' as const,
  entityId: 'material-1',
  family: 'LIKE' as const,
};

const transition = (
  partial: Partial<RecommendationToggleTransition> &
    Pick<RecommendationToggleTransition, 'actionType' | 'sourceOperationId'>,
): RecommendationToggleTransition => ({
  learnerId: identity.learnerId,
  entityType: identity.entityType,
  entityId: identity.entityId,
  eventSource: 'TEST',
  impressionId: null,
  ...partial,
});

describe('recommendation-action-state reducer', () => {
  test('positive transition reconstructs active', () => {
    const result = reduceRecommendationToggleState(identity, [
      transition({ actionType: 'MATERIAL_LIKE', sourceOperationId: 'k1' }),
    ]);
    assert.equal(result.state, 'active');
  });

  test('positive then reversal reconstructs inactive using input order only', () => {
    const result = reduceRecommendationToggleState(identity, [
      transition({
        actionType: 'MATERIAL_LIKE',
        sourceOperationId: 'k1',
        eventSource: 'TEST',
      }),
      transition({
        actionType: 'MATERIAL_UNLIKE',
        sourceOperationId: 'k2',
        eventSource: 'TEST',
      }),
    ]);
    assert.equal(result.state, 'inactive');
  });

  test('like then unlike then like reconstructs active by sequence order', () => {
    const result = reduceRecommendationToggleState(identity, [
      transition({ actionType: 'MATERIAL_LIKE', sourceOperationId: 'k1' }),
      transition({ actionType: 'MATERIAL_UNLIKE', sourceOperationId: 'k2' }),
      transition({ actionType: 'MATERIAL_LIKE', sourceOperationId: 'k3' }),
    ]);
    assert.equal(result.state, 'active');
  });

  test('input order is authoritative; reversing the sequence reverses reconstructed state', () => {
    const like = transition({
      actionType: 'MATERIAL_LIKE',
      sourceOperationId: 'k1',
    });
    const unlike = transition({
      actionType: 'MATERIAL_UNLIKE',
      sourceOperationId: 'k2',
    });
    assert.equal(
      reduceRecommendationToggleState(identity, [like, unlike]).state,
      'inactive',
    );
    assert.equal(
      reduceRecommendationToggleState(identity, [unlike, like]).state,
      'active',
    );
  });

  test('duplicate replay of the same positive transition does not change state twice', () => {
    const result = reduceRecommendationToggleState(identity, [
      transition({ actionType: 'MATERIAL_LIKE', sourceOperationId: 'k1' }),
      transition({ actionType: 'MATERIAL_LIKE', sourceOperationId: 'k1' }),
    ]);
    assert.equal(result.state, 'active');
  });

  test('duplicate replay of the same reversal does not change state twice', () => {
    const result = reduceRecommendationToggleState(identity, [
      transition({ actionType: 'MATERIAL_LIKE', sourceOperationId: 'k1' }),
      transition({ actionType: 'MATERIAL_UNLIKE', sourceOperationId: 'k2' }),
      transition({ actionType: 'MATERIAL_UNLIKE', sourceOperationId: 'k2' }),
    ]);
    assert.equal(result.state, 'inactive');
  });

  test('conflicting replay of the same sourceOperationId is rejected', () => {
    assert.throws(
      () =>
        reduceRecommendationToggleState(identity, [
          transition({ actionType: 'MATERIAL_LIKE', sourceOperationId: 'k1' }),
          transition({
            actionType: 'MATERIAL_UNLIKE',
            sourceOperationId: 'k1',
          }),
        ]),
      RecommendationToggleReplayConflictError,
    );
  });

  test('foreign actor entity or family does not affect reconstruction', () => {
    const result = reduceRecommendationToggleState(identity, [
      transition({ actionType: 'MATERIAL_LIKE', sourceOperationId: 'k1' }),
      {
        ...transition({ actionType: 'MATERIAL_UNLIKE', sourceOperationId: 'k2' }),
        learnerId: 'other-learner',
      },
      {
        ...transition({ actionType: 'MATERIAL_UNLIKE', sourceOperationId: 'k3' }),
        entityId: 'other-material',
      },
      {
        actionType: 'PROJECT_SAVE',
        learnerId: identity.learnerId,
        entityType: 'PROJECT',
        entityId: 'project-1',
        sourceOperationId: 'k4',
        eventSource: 'TEST',
      },
    ]);
    assert.equal(result.state, 'active');
  });

  test('legacy or directionless evidence is not treated as current-state transition', () => {
    const result = reduceRecommendationToggleState(identity, [
      transition({
        actionType: 'MATERIAL_VIEW',
        sourceOperationId: 'legacy-1',
      }),
      transition({
        actionType: 'UNKNOWN_LEGACY',
        sourceOperationId: 'legacy-2',
      }),
    ]);
    assert.equal(result.state, 'unknown');
  });

  test('repeated views remain observations before and between toggle transitions', () => {
    const result = reduceRecommendationToggleState(identity, [
      transition({ actionType: 'MATERIAL_VIEW', sourceOperationId: 'view-1' }),
      transition({ actionType: 'MATERIAL_VIEW', sourceOperationId: 'view-2' }),
      transition({ actionType: 'MATERIAL_LIKE', sourceOperationId: 'like-1' }),
      transition({ actionType: 'MATERIAL_VIEW', sourceOperationId: 'view-3' }),
      transition({ actionType: 'MATERIAL_UNLIKE', sourceOperationId: 'unlike-1' }),
      transition({ actionType: 'MATERIAL_VIEW', sourceOperationId: 'view-4' }),
    ]);

    assert.equal(result.state, 'inactive');
  });

  test('empty sequence is inactive', () => {
    assert.equal(reduceRecommendationToggleState(identity, []).state, 'inactive');
  });

  test('project save family reconstructs after unsave and reactivation', () => {
    const projectIdentity = {
      learnerId: 'learner-1',
      entityType: 'PROJECT' as const,
      entityId: 'project-1',
      family: 'SAVE' as const,
    };
    const result = reduceRecommendationToggleState(projectIdentity, [
      {
        actionType: 'PROJECT_SAVE',
        learnerId: 'learner-1',
        entityType: 'PROJECT',
        entityId: 'project-1',
        sourceOperationId: 's1',
        eventSource: 'TEST',
      },
      {
        actionType: 'PROJECT_UNSAVE',
        learnerId: 'learner-1',
        entityType: 'PROJECT',
        entityId: 'project-1',
        sourceOperationId: 's2',
        eventSource: 'TEST',
      },
      {
        actionType: 'PROJECT_SAVE',
        learnerId: 'learner-1',
        entityType: 'PROJECT',
        entityId: 'project-1',
        sourceOperationId: 's3',
        eventSource: 'TEST',
      },
    ]);
    assert.equal(result.state, 'active');
  });
});
