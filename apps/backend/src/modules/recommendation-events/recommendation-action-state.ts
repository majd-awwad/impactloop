export type RecommendationToggleFamily = 'LIKE' | 'SAVE' | 'FOLLOW';

export type RecommendationToggleEntityType = 'MATERIAL' | 'PROJECT';

export type RecommendationToggleState = 'active' | 'inactive' | 'unknown';

export type RecommendationToggleActionType =
  | 'MATERIAL_LIKE'
  | 'MATERIAL_UNLIKE'
  | 'PROJECT_LIKE'
  | 'PROJECT_UNLIKE'
  | 'PROJECT_SAVE'
  | 'PROJECT_UNSAVE'
  | 'PROJECT_FOLLOW'
  | 'PROJECT_UNFOLLOW';

export type RecommendationToggleTransition = {
  actionType: string;
  learnerId: string;
  entityType: string;
  entityId: string;
  sourceOperationId: string;
  eventSource?: string | null;
  impressionId?: string | null;
};

export type RecommendationToggleIdentity = {
  learnerId: string;
  entityType: RecommendationToggleEntityType;
  entityId: string;
  family: RecommendationToggleFamily;
};

export class RecommendationToggleReplayConflictError extends Error {
  readonly code = 'toggle_replay_conflict' as const;

  constructor(message = 'Conflicting toggle transition replay') {
    super(message);
    this.name = 'RecommendationToggleReplayConflictError';
  }
}

const ACTIVE_BY_FAMILY: Record<
  RecommendationToggleFamily,
  ReadonlySet<string>
> = {
  LIKE: new Set(['MATERIAL_LIKE', 'PROJECT_LIKE']),
  SAVE: new Set(['PROJECT_SAVE']),
  FOLLOW: new Set(['PROJECT_FOLLOW']),
};

const INACTIVE_BY_FAMILY: Record<
  RecommendationToggleFamily,
  ReadonlySet<string>
> = {
  LIKE: new Set(['MATERIAL_UNLIKE', 'PROJECT_UNLIKE']),
  SAVE: new Set(['PROJECT_UNSAVE']),
  FOLLOW: new Set(['PROJECT_UNFOLLOW']),
};

export const toggleFamilyForActionType = (
  actionType: string,
): RecommendationToggleFamily | null => {
  if (ACTIVE_BY_FAMILY.LIKE.has(actionType) || INACTIVE_BY_FAMILY.LIKE.has(actionType)) {
    return 'LIKE';
  }
  if (ACTIVE_BY_FAMILY.SAVE.has(actionType) || INACTIVE_BY_FAMILY.SAVE.has(actionType)) {
    return 'SAVE';
  }
  if (
    ACTIVE_BY_FAMILY.FOLLOW.has(actionType) ||
    INACTIVE_BY_FAMILY.FOLLOW.has(actionType)
  ) {
    return 'FOLLOW';
  }
  return null;
};

export const toggleResultingStateForActionType = (
  actionType: string,
): 'active' | 'inactive' | null => {
  const family = toggleFamilyForActionType(actionType);
  if (!family) {
    return null;
  }
  if (ACTIVE_BY_FAMILY[family].has(actionType)) {
    return 'active';
  }
  if (INACTIVE_BY_FAMILY[family].has(actionType)) {
    return 'inactive';
  }
  return null;
};

const transitionFingerprint = (
  transition: RecommendationToggleTransition,
): string =>
  [
    transition.learnerId,
    transition.entityType,
    transition.entityId,
    transition.actionType,
    transition.eventSource ?? '',
    transition.sourceOperationId,
    transition.impressionId ?? '',
  ].join('|');

/**
 * Pure reconstruction helper. Consumes an already-validated authoritative
 * sequence in caller-supplied order and does not invent ordering.
 */
export const reduceRecommendationToggleState = (
  identity: RecommendationToggleIdentity,
  transitions: readonly RecommendationToggleTransition[],
): { state: RecommendationToggleState } => {
  let state: RecommendationToggleState = 'inactive';
  let sawAuthoritative = false;
  const seenByOperation = new Map<string, string>();

  for (const transition of transitions) {
    if (
      transition.learnerId !== identity.learnerId ||
      transition.entityType !== identity.entityType ||
      transition.entityId !== identity.entityId
    ) {
      continue;
    }

    const family = toggleFamilyForActionType(transition.actionType);
    if (family !== identity.family) {
      if (family == null) {
        // Directionless / non-toggle evidence for this identity is ignored for
        // current-state reconstruction and must not invent active/inactive.
        continue;
      }
      continue;
    }

    const resulting = toggleResultingStateForActionType(transition.actionType);
    if (!resulting) {
      continue;
    }

    const fingerprint = transitionFingerprint(transition);
    const prior = seenByOperation.get(transition.sourceOperationId);
    if (prior !== undefined) {
      if (prior !== fingerprint) {
        throw new RecommendationToggleReplayConflictError();
      }
      continue;
    }
    seenByOperation.set(transition.sourceOperationId, fingerprint);

    state = resulting;
    sawAuthoritative = true;
  }

  if (!sawAuthoritative) {
    const onlyLegacyOrEmpty = transitions.every((transition) => {
      if (
        transition.learnerId !== identity.learnerId ||
        transition.entityType !== identity.entityType ||
        transition.entityId !== identity.entityId
      ) {
        return true;
      }
      return toggleFamilyForActionType(transition.actionType) !== identity.family;
    });
    if (
      onlyLegacyOrEmpty &&
      transitions.some(
        (transition) =>
          transition.learnerId === identity.learnerId &&
          transition.entityType === identity.entityType &&
          transition.entityId === identity.entityId &&
          toggleFamilyForActionType(transition.actionType) == null,
      )
    ) {
      return { state: 'unknown' };
    }
  }

  return { state };
};
