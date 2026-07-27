import type { IntentMetadata } from './short-term-intent.js';

export const PROJECT_RECENT_CONFIG = {
  historyWindowDays: 21,
  burstWindowHours: 72,
  halfLifeDays: 5,
  saveWeight: 1.8,
  likeWeight: 1,
  followWeight: 0.9,
  strongActionWeight: 2.5,
  repeatedEventCap: 1,
  recentScoreThreshold: 0.04,
  recentPool: 20,
  intentFeatureCap: 4,
} as const;

export type ProjectRecentIntentEvent = { entityKey: string; actionType: string; timestampUtc: string };

export type ProjectRecentIntentConfidence = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export type ProjectRecentIntentConfidenceSource =
  | 'NONE'
  | 'INSUFFICIENT_COHERENCE'
  | 'SAVE_LIKE_BURST'
  | 'FOLLOW_SUPPORTED_BURST'
  | 'STRONG_ACTION_BURST'
  | 'MULTI_SIGNAL_BURST';

export type ProjectRecentIntentProfile = {
  confidence: ProjectRecentIntentConfidence;
  confidenceSource: ProjectRecentIntentConfidenceSource;
  burstWindowHours: number;
  recentHistoryDistinctProjectCount: number;
  burstDistinctProjectCount: number;
  burstActiveSaveCount: number;
  burstActiveLikeCount: number;
  burstActiveFollowCount: number;
  burstStrongActionCount: number;
  burstDominantConceptShare: number;
  fullHistoryDominantConceptShare: number;
  dominantFeature?: string;
  newestEvidenceAgeDays?: number;
  rejectedCounts: {
    unmappedCategory: number;
    unmappedConcept: number;
    stale: number;
    reversed: number;
    duplicateOrCapped: number;
    invalidAction: number;
  };
};

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const STRONG_ACTIONS = new Set(['build_started', 'build_progress']);
const ACTIVE_POSITIVE_ACTIONS = new Set(['project_save', 'like', 'project_follow', ...STRONG_ACTIONS]);
const REVERSAL_ACTIONS = new Set(['unlike', 'unsave', 'unfollow']);
const INVALID_ACTIONS = new Set([
  'build_failed',
  'build_cancelled',
  'reservation',
  'reservation_pending',
  'reservation_cancelled',
  'view',
]);

export const isProjectRecentIntentEvent = (actionType: string): boolean =>
  ACTIVE_POSITIVE_ACTIONS.has(actionType) || REVERSAL_ACTIONS.has(actionType);

type ActiveState = { active: boolean; kind: string; timestamp: number };

type Projection = {
  saves: Map<string, boolean>;
  likes: Map<string, boolean>;
  follows: Map<string, boolean>;
  strong: Set<string>;
  entities: Set<string>;
  conceptShare: number;
  dominantConceptShare: number;
  dominantShare: number;
  dominantFeature?: string;
  newestAgeDays?: number;
};

const actionWeight = (kind: string): number => {
  if (STRONG_ACTIONS.has(kind)) return PROJECT_RECENT_CONFIG.strongActionWeight;
  if (kind === 'project_save') return PROJECT_RECENT_CONFIG.saveWeight;
  if (kind === 'like') return PROJECT_RECENT_CONFIG.likeWeight;
  if (kind === 'project_follow') return PROJECT_RECENT_CONFIG.followWeight;
  return 0;
};

const hasMappedConcepts = (item: IntentMetadata | undefined): item is IntentMetadata =>
  Boolean(item?.categoryKey && item.conceptKeys.length > 0);

const matchesDominantFeature = (
  metadata: Map<string, IntentMetadata>,
  entityKey: string,
  feature?: string,
): boolean => {
  const item = metadata.get(entityKey);
  if (!item || !feature) return false;
  if (feature.startsWith('category:')) return feature === `category:${item.categoryKey}`;
  if (feature.startsWith('concept:')) return item.conceptKeys.some((key) => feature === `concept:${key}`);
  if (feature.startsWith('component:')) {
    return item.componentConceptKeys.some((key) => feature === `component:${key}`);
  }
  return false;
};

const dominantFeatureForItem = (item: IntentMetadata): string | undefined => {
  const concept = [...new Set(item.conceptKeys)].sort()[0];
  if (concept) return `concept:${concept}`;
  const component = [...new Set(item.componentConceptKeys)].sort()[0];
  if (component) return `component:${component}`;
  if (item.categoryKey) return `category:${item.categoryKey}`;
  return undefined;
};

const projectEvidence = (
  events: ProjectRecentIntentEvent[],
  metadata: Map<string, IntentMetadata>,
  now: number,
  windowMs: number,
  candidateUniverse: ReadonlySet<string> | undefined,
  rejectedCounts?: ProjectRecentIntentProfile['rejectedCounts'],
): Projection => {
  const saves = new Map<string, boolean>();
  const likes = new Map<string, boolean>();
  const follows = new Map<string, boolean>();
  const strong = new Set<string>();
  const actionCounts = new Map<string, number>();
  const timestamps: number[] = [];

  for (const event of events) {
    if (INVALID_ACTIONS.has(event.actionType)) {
      if (rejectedCounts) rejectedCounts.invalidAction += 1;
      continue;
    }
    if (!isProjectRecentIntentEvent(event.actionType)) continue;

    const timestamp = Date.parse(event.timestampUtc);
    const age = now - timestamp;
    if (!Number.isFinite(timestamp) || age < 0 || age > windowMs) {
      if (rejectedCounts) rejectedCounts.stale += 1;
      continue;
    }

    const item = metadata.get(event.entityKey);
    if (!item || (candidateUniverse && !candidateUniverse.has(event.entityKey))) {
      if (rejectedCounts) {
        rejectedCounts.unmappedCategory += Number(!item);
        rejectedCounts.unmappedConcept += Number(!item);
      }
      continue;
    }
    if (rejectedCounts) {
      rejectedCounts.unmappedCategory += Number(!item.categoryKey);
      rejectedCounts.unmappedConcept += Number(item.conceptKeys.length === 0 && item.componentConceptKeys.length === 0);
    }
    if (!hasMappedConcepts(item)) continue;

    const dedupeKey = `${event.entityKey}:${event.actionType}`;
    const seen = actionCounts.get(dedupeKey) ?? 0;
    if (seen >= PROJECT_RECENT_CONFIG.repeatedEventCap) {
      if (rejectedCounts) rejectedCounts.duplicateOrCapped += 1;
      continue;
    }
    actionCounts.set(dedupeKey, seen + 1);

    if (REVERSAL_ACTIONS.has(event.actionType)) {
      if (event.actionType === 'unlike') {
        if (rejectedCounts && likes.get(event.entityKey) === true) rejectedCounts.reversed += 1;
        likes.set(event.entityKey, false);
      } else if (event.actionType === 'unsave') {
        if (rejectedCounts && saves.get(event.entityKey) === true) rejectedCounts.reversed += 1;
        saves.set(event.entityKey, false);
      } else if (event.actionType === 'unfollow') {
        if (rejectedCounts && follows.get(event.entityKey) === true) rejectedCounts.reversed += 1;
        follows.set(event.entityKey, false);
      }
      continue;
    }

    if (event.actionType === 'project_save') saves.set(event.entityKey, true);
    else if (event.actionType === 'like') likes.set(event.entityKey, true);
    else if (event.actionType === 'project_follow') follows.set(event.entityKey, true);
    else if (STRONG_ACTIONS.has(event.actionType)) strong.add(event.entityKey);

    timestamps.push(timestamp);
  }

  const entities = new Set<string>([
    ...[...saves].filter(([, active]) => active).map(([key]) => key),
    ...[...likes].filter(([, active]) => active).map(([key]) => key),
    ...[...follows].filter(([, active]) => active).map(([key]) => key),
    ...strong,
  ]);

  const conceptVotes = new Map<string, number>();
  const categoryVotes = new Map<string, number>();
  const componentVotes = new Map<string, number>();
  let totalWeight = 0;

  for (const entityKey of entities) {
    const item = metadata.get(entityKey)!;
    const contribution =
      (saves.get(entityKey) ? PROJECT_RECENT_CONFIG.saveWeight : 0) +
      (likes.get(entityKey) ? PROJECT_RECENT_CONFIG.likeWeight : 0) +
      (follows.get(entityKey) ? PROJECT_RECENT_CONFIG.followWeight : 0) +
      (strong.has(entityKey) ? PROJECT_RECENT_CONFIG.strongActionWeight : 0);
    totalWeight += contribution;
    if (item.categoryKey) categoryVotes.set(item.categoryKey, (categoryVotes.get(item.categoryKey) ?? 0) + contribution);
    for (const concept of new Set(item.conceptKeys)) {
      conceptVotes.set(concept, (conceptVotes.get(concept) ?? 0) + contribution);
    }
    for (const component of new Set(item.componentConceptKeys)) {
      componentVotes.set(component, (componentVotes.get(component) ?? 0) + contribution);
    }
  }

  const dominant = (
    prefix: 'category' | 'concept' | 'component',
    votes: Map<string, number>,
  ) => [...votes]
    .map(([key, value]) => [`${prefix}:${key}`, value] as const)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];

  const concept = dominant('concept', conceptVotes);
  const winners = [
    ...(dominant('category', categoryVotes) ? [dominant('category', categoryVotes)!] : []),
    ...(concept ? [concept] : []),
    ...(dominant('component', componentVotes) ? [dominant('component', componentVotes)!] : []),
  ];
  const winner = winners.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
  const conceptWeight = [...conceptVotes.values()].reduce((sum, value) => sum + value, 0);

  return {
    saves,
    likes,
    follows,
    strong,
    entities,
    conceptShare: totalWeight ? conceptWeight / totalWeight : 0,
    dominantConceptShare: totalWeight ? (concept?.[1] ?? 0) / totalWeight : 0,
    dominantShare: totalWeight ? (winner?.[1] ?? 0) / totalWeight : 0,
    dominantFeature: winner?.[0],
    newestAgeDays: timestamps.length ? (now - Math.max(...timestamps)) / DAY_MS : undefined,
  };
};

const coherentEntityKeys = (
  projection: Projection,
  metadata: Map<string, IntentMetadata>,
): Set<string> => new Set(
  [...projection.entities].filter((entityKey) => matchesDominantFeature(metadata, entityKey, projection.dominantFeature)),
);

export const classifyProjectRecentIntent = (
  events: ProjectRecentIntentEvent[],
  metadata: Map<string, IntentMetadata>,
  evaluationTimestamp: string,
  candidateUniverse?: ReadonlySet<string>,
): ProjectRecentIntentProfile => {
  const now = Date.parse(evaluationTimestamp);
  if (!Number.isFinite(now)) throw new Error('invalid_evaluation_timestamp');

  const ordered = [...events]
    .sort((left, right) => left.timestampUtc.localeCompare(right.timestampUtc));
  const rejectedCounts = {
    unmappedCategory: 0,
    unmappedConcept: 0,
    stale: 0,
    reversed: 0,
    duplicateOrCapped: 0,
    invalidAction: events.filter((event) => INVALID_ACTIONS.has(event.actionType)).length,
  };
  const projectEvents = ordered.filter((event) => isProjectRecentIntentEvent(event.actionType));
  const history = projectEvidence(
    projectEvents,
    metadata,
    now,
    PROJECT_RECENT_CONFIG.historyWindowDays * DAY_MS,
    candidateUniverse,
    rejectedCounts,
  );
  const burst = projectEvidence(
    projectEvents,
    metadata,
    now,
    PROJECT_RECENT_CONFIG.burstWindowHours * HOUR_MS,
    candidateUniverse,
  );

  const burstCoherent = coherentEntityKeys(burst, metadata);
  const burstSaves = [...burst.saves].filter(([key, active]) => active && burstCoherent.has(key)).length;
  const burstLikes = [...burst.likes].filter(([key, active]) => active && burstCoherent.has(key)).length;
  const burstFollows = [...burst.follows].filter(([key, active]) => active && burstCoherent.has(key)).length;
  const burstStrong = [...burst.strong].filter((key) => burstCoherent.has(key)).length;
  const burstStrongSignals = burstSaves + burstLikes + burstStrong;
  const burstAgeFactor = burst.newestAgeDays === undefined ? 0 : 0.5 ** (burst.newestAgeDays / PROJECT_RECENT_CONFIG.halfLifeDays);

  let confidence: ProjectRecentIntentConfidence = history.entities.size ? 'LOW' : 'NONE';
  let confidenceSource: ProjectRecentIntentConfidenceSource = history.entities.size
    ? 'INSUFFICIENT_COHERENCE'
    : 'NONE';

  const mediumReady =
    burst.entities.size >= 2 &&
    burst.dominantShare >= 0.6 &&
    burstAgeFactor >= 0.25 &&
    burstStrongSignals >= 2;

  const highReady =
    burst.entities.size >= 2 &&
    burst.dominantShare >= 0.65 &&
    burstAgeFactor >= 0.3 &&
    (
      (burstStrong >= 1 && burstStrongSignals >= 2) ||
      (burstSaves + burstLikes >= 4 && burst.entities.size >= 3) ||
      (burstSaves + burstLikes + burstFollows >= 5 && burst.entities.size >= 3)
    );

  if (mediumReady) {
    confidence = 'MEDIUM';
    confidenceSource = burstStrong >= 1
      ? 'STRONG_ACTION_BURST'
      : burstFollows >= 2
        ? 'FOLLOW_SUPPORTED_BURST'
        : 'SAVE_LIKE_BURST';
  }
  if (highReady) {
    confidence = 'HIGH';
    confidenceSource = burstStrong >= 1
      ? 'STRONG_ACTION_BURST'
      : burstSaves + burstLikes >= 3
        ? 'MULTI_SIGNAL_BURST'
        : 'SAVE_LIKE_BURST';
  }

  return {
    confidence,
    confidenceSource,
    burstWindowHours: PROJECT_RECENT_CONFIG.burstWindowHours,
    recentHistoryDistinctProjectCount: history.entities.size,
    burstDistinctProjectCount: burst.entities.size,
    burstActiveSaveCount: [...burst.saves.values()].filter(Boolean).length,
    burstActiveLikeCount: [...burst.likes.values()].filter(Boolean).length,
    burstActiveFollowCount: [...burst.follows.values()].filter(Boolean).length,
    burstStrongActionCount: burst.strong.size,
    burstDominantConceptShare: burst.dominantConceptShare,
    fullHistoryDominantConceptShare: history.dominantConceptShare,
    dominantFeature: burst.dominantFeature,
    newestEvidenceAgeDays: burst.newestAgeDays,
    rejectedCounts,
  };
};

export const buildProjectRecentIntent = (
  events: ProjectRecentIntentEvent[],
  metadata: Map<string, IntentMetadata>,
  evaluationTimestamp: string,
) => {
  const now = Date.parse(evaluationTimestamp);
  if (!Number.isFinite(now)) throw new Error('invalid_evaluation_timestamp');

  const active = new Map<string, ActiveState>();
  const directScores = new Map<string, number>();
  const intent = new Map<string, number>();
  let evidenceCount = 0;

  const addIntent = (key: string, value: number) => {
    intent.set(key, Math.min(PROJECT_RECENT_CONFIG.intentFeatureCap, (intent.get(key) ?? 0) + value));
  };

  const addDirect = (entityKey: string, value: number) => {
    directScores.set(entityKey, Math.min(PROJECT_RECENT_CONFIG.intentFeatureCap, (directScores.get(entityKey) ?? 0) + value));
  };

  for (const event of [...events]
    .filter((value) => isProjectRecentIntentEvent(value.actionType))
    .sort((left, right) => left.timestampUtc.localeCompare(right.timestampUtc))) {
    const timestamp = Date.parse(event.timestampUtc);
    if (!Number.isFinite(timestamp) || timestamp > now) continue;
    const age = now - timestamp;
    if (age > PROJECT_RECENT_CONFIG.historyWindowDays * DAY_MS) continue;

    const item = metadata.get(event.entityKey);
    if (!hasMappedConcepts(item)) continue;

    if (REVERSAL_ACTIONS.has(event.actionType)) {
      active.set(event.entityKey, { active: false, kind: event.actionType, timestamp });
      continue;
    }
    if (['project_save', 'like', 'project_follow', ...STRONG_ACTIONS].includes(event.actionType)) {
      active.set(event.entityKey, { active: true, kind: event.actionType, timestamp });
    }

    const weight = actionWeight(event.actionType);
    if (weight <= 0) continue;

    const decay = 0.5 ** (Math.max(0, age) / DAY_MS / PROJECT_RECENT_CONFIG.halfLifeDays);
    evidenceCount += 1;
    addDirect(event.entityKey, weight * decay);
    addIntent(`category:${item.categoryKey}`, weight * decay);
    for (const concept of item.conceptKeys) addIntent(`concept:${concept}`, weight * decay);
    for (const component of item.componentConceptKeys) addIntent(`component:${component}`, weight * decay);
  }

  for (const [entityKey, state] of active) {
    if (!state.active) continue;
    const item = metadata.get(entityKey);
    if (!hasMappedConcepts(item)) continue;
    const age = now - state.timestamp;
    if (age > PROJECT_RECENT_CONFIG.historyWindowDays * DAY_MS) continue;

    evidenceCount += 1;
    const base = actionWeight(state.kind);
    const decay = 0.5 ** (Math.max(0, age) / DAY_MS / PROJECT_RECENT_CONFIG.halfLifeDays);
    const value = base * decay;
    addDirect(entityKey, value);
    addIntent(`category:${item.categoryKey}`, value);
    for (const concept of item.conceptKeys) addIntent(`concept:${concept}`, value);
    for (const component of item.componentConceptKeys) addIntent(`component:${component}`, value);
  }

  return { intent, directScores, evidenceCount };
};

export const projectRecentItemScore = (
  candidateKey: string,
  item: IntentMetadata,
  intent: Map<string, number>,
  directScores: Map<string, number>,
): number => {
  const direct = directScores.get(candidateKey) ?? 0;
  const featureValues = [
    intent.get(`category:${item.categoryKey}`) ?? 0,
    ...item.conceptKeys.map((key) => intent.get(`concept:${key}`) ?? 0),
    ...item.componentConceptKeys.map((key) => intent.get(`component:${key}`) ?? 0),
  ];
  const similarity = featureValues.reduce((sum, value) => sum + value, 0) /
    (PROJECT_RECENT_CONFIG.intentFeatureCap * Math.max(1, featureValues.length));
  const blended = Math.max(direct / PROJECT_RECENT_CONFIG.intentFeatureCap, similarity);
  const score = Math.min(1, blended);
  return Number.isFinite(score) ? score : 0;
};

export const projectDominantFeatureForMetadata = dominantFeatureForItem;
