import { SHORT_TERM_CONFIG, type IntentMetadata, type RecentIntentEvent } from './short-term-intent.js';

export type RecentIntentConfidence = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export type RecentIntentConfidenceSource = 'NONE' | 'VIEW_BURST' | 'LIKE_SUPPORTED_BURST' | 'MULTI_LIKE_BURST' | 'STRONG_ACTION_BURST' | 'INSUFFICIENT_COHERENCE';

export type RecentIntentProfile = {
  confidence: RecentIntentConfidence;
  confidenceSource: RecentIntentConfidenceSource;
  burstWindowHours: number;
  uniqueRecentMaterialCount: number;
  uniqueRecentViewCount: number;
  activeRecentLikeCount: number;
  strongActionCount: number;
  burstUniqueMaterialCount: number;
  burstUniqueViewCount: number;
  burstActiveLikeCount: number;
  burstStrongActionCount: number;
  dominantEvidenceShare: number;
  dominantCategoryShare: number;
  dominantConceptShare: number;
  fullHistoryDominantCategoryShare: number;
  fullHistoryDominantConceptShare: number;
  dominantFeature?: string;
  newestEvidenceAgeDays?: number;
  rejectedCounts: { unmappedCategory: number; unmappedConcept: number; stale: number; reversed: number; duplicateOrCapped: number };
};

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const ACTIVE_WINDOW_DAYS = 14;
export const BURST_WINDOW_HOURS = 24;
const strongActions = new Set(['reservation', 'build_started']);

type Projection = {
  views: Map<string, number>;
  likes: Map<string, boolean>;
  strong: Set<string>;
  entities: Set<string>;
  categoryShare: number;
  conceptShare: number;
  dominantShare: number;
  dominantFeature?: string;
  newestAgeDays?: number;
};

const projectEvidence = (
  events: RecentIntentEvent[], metadata: Map<string, IntentMetadata>, now: number, windowMs: number,
  candidateUniverse: ReadonlySet<string> | undefined, rejectedCounts?: RecentIntentProfile['rejectedCounts'],
): Projection => {
  const views = new Map<string, number>(); const likes = new Map<string, boolean>(); const strong = new Set<string>(); const timestamps: number[] = [];
  for (const event of events) {
    const timestamp = Date.parse(event.timestampUtc); const age = now - timestamp;
    if (!Number.isFinite(timestamp) || age < 0 || age > windowMs) { if (rejectedCounts) rejectedCounts.stale += 1; continue; }
    const item = metadata.get(event.entityKey);
    if (!item || (candidateUniverse && !candidateUniverse.has(event.entityKey))) { if (rejectedCounts) { rejectedCounts.unmappedCategory += Number(!item); rejectedCounts.unmappedConcept += Number(!item); } continue; }
    if (rejectedCounts) { rejectedCounts.unmappedCategory += Number(!item.categoryKey); rejectedCounts.unmappedConcept += Number(item.conceptKeys.length === 0); }
    if (event.actionType === 'view') { const count = views.get(event.entityKey) ?? 0; if (rejectedCounts && count >= SHORT_TERM_CONFIG.repeatedViewCap) rejectedCounts.duplicateOrCapped += 1; views.set(event.entityKey, Math.min(SHORT_TERM_CONFIG.repeatedViewCap, count + 1)); }
    else if (event.actionType === 'like') { if (rejectedCounts && likes.get(event.entityKey) === true) rejectedCounts.duplicateOrCapped += 1; likes.set(event.entityKey, true); }
    else if (event.actionType === 'unlike') { if (rejectedCounts) likes.get(event.entityKey) === true ? rejectedCounts.reversed += 1 : rejectedCounts.duplicateOrCapped += 1; likes.set(event.entityKey, false); }
    else if (strongActions.has(event.actionType)) { if (rejectedCounts && strong.has(event.entityKey)) rejectedCounts.duplicateOrCapped += 1; strong.add(event.entityKey); }
    else continue;
    timestamps.push(timestamp);
  }
  const entities = new Set([...views.keys(), ...[...likes].filter(([, active]) => active).map(([key]) => key), ...strong]);
  const categoryVotes = new Map<string, number>(); const conceptVotes = new Map<string, number>(); let totalWeight = 0;
  for (const entityKey of entities) {
    const item = metadata.get(entityKey)!;
    const contribution = (views.has(entityKey) ? SHORT_TERM_CONFIG.viewWeight : 0) + (likes.get(entityKey) ? SHORT_TERM_CONFIG.activeLikeWeight : 0) + (strong.has(entityKey) ? SHORT_TERM_CONFIG.strongActionWeight : 0);
    totalWeight += contribution;
    if (item.categoryKey) categoryVotes.set(item.categoryKey, (categoryVotes.get(item.categoryKey) ?? 0) + contribution);
    for (const concept of new Set(item.conceptKeys)) conceptVotes.set(concept, (conceptVotes.get(concept) ?? 0) + contribution);
  }
  const dominant = (prefix: 'category' | 'concept', votes: Map<string, number>) => [...votes].map(([key, value]) => [`${prefix}:${key}`, value] as const).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const category = dominant('category', categoryVotes); const concept = dominant('concept', conceptVotes);
  const winners = [...(category ? [category] : []), ...(concept ? [concept] : [])];
  const winner = winners.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { views, likes, strong, entities, categoryShare: totalWeight ? (category?.[1] ?? 0) / totalWeight : 0, conceptShare: totalWeight ? (concept?.[1] ?? 0) / totalWeight : 0, dominantShare: totalWeight ? (winner?.[1] ?? 0) / totalWeight : 0, dominantFeature: winner?.[0], newestAgeDays: timestamps.length ? (now - Math.max(...timestamps)) / DAY_MS : undefined };
};

const matches = (metadata: Map<string, IntentMetadata>, entityKey: string, feature?: string) => {
  const item = metadata.get(entityKey); if (!item || !feature) return false;
  return feature.startsWith('category:') ? feature === `category:${item.categoryKey}` : item.conceptKeys.some((key) => feature === `concept:${key}`);
};

export const classifyRecentIntent = (
  events: RecentIntentEvent[], metadata: Map<string, IntentMetadata>, evaluationTimestamp: string, candidateUniverse?: ReadonlySet<string>,
): RecentIntentProfile => {
  const now = Date.parse(evaluationTimestamp); if (!Number.isFinite(now)) throw new Error('invalid_evaluation_timestamp');
  const ordered = [...events].sort((left, right) => left.timestampUtc.localeCompare(right.timestampUtc));
  const rejectedCounts = { unmappedCategory: 0, unmappedConcept: 0, stale: 0, reversed: 0, duplicateOrCapped: 0 };
  const history = projectEvidence(ordered, metadata, now, ACTIVE_WINDOW_DAYS * DAY_MS, candidateUniverse, rejectedCounts);
  const burst = projectEvidence(ordered, metadata, now, BURST_WINDOW_HOURS * HOUR_MS, candidateUniverse);
  const coherentViews = [...burst.views.keys()].filter((key) => matches(metadata, key, burst.dominantFeature)).length;
  const coherentLikes = [...burst.likes].filter(([key, active]) => active && matches(metadata, key, burst.dominantFeature)).length;
  const coherentStrong = [...burst.strong].filter((key) => matches(metadata, key, burst.dominantFeature)).length;
  const burstLikes = [...burst.likes.values()].filter(Boolean).length; const burstAgeFactor = burst.newestAgeDays === undefined ? 0 : 0.5 ** (burst.newestAgeDays / SHORT_TERM_CONFIG.halfLifeDays);
  let confidence: RecentIntentConfidence = history.entities.size ? 'LOW' : 'NONE';
  let confidenceSource: RecentIntentConfidenceSource = history.entities.size ? 'INSUFFICIENT_COHERENCE' : 'NONE';
  if (burst.dominantShare >= .6 && burstAgeFactor >= .25 && coherentViews >= 4) { confidence = 'MEDIUM'; confidenceSource = 'VIEW_BURST'; }
  if (burst.dominantShare >= .6 && burstAgeFactor >= .25 && coherentLikes >= 1 && coherentViews >= 3) { confidence = 'MEDIUM'; confidenceSource = 'LIKE_SUPPORTED_BURST'; }
  if (burst.dominantShare >= .7 && burstAgeFactor >= .5 && coherentViews >= 8 && coherentLikes >= 2) { confidence = 'HIGH'; confidenceSource = 'VIEW_BURST'; }
  if (burst.dominantShare >= .7 && burstAgeFactor >= .5 && coherentLikes >= 5) { confidence = 'HIGH'; confidenceSource = 'MULTI_LIKE_BURST'; }
  if (burst.dominantShare >= .7 && burstAgeFactor >= .5 && coherentStrong >= 1 && coherentViews >= 3) { confidence = 'HIGH'; confidenceSource = 'STRONG_ACTION_BURST'; }
  return { confidence, confidenceSource, burstWindowHours: BURST_WINDOW_HOURS, uniqueRecentMaterialCount: history.entities.size, uniqueRecentViewCount: history.views.size, activeRecentLikeCount: [...history.likes.values()].filter(Boolean).length, strongActionCount: history.strong.size, burstUniqueMaterialCount: burst.entities.size, burstUniqueViewCount: burst.views.size, burstActiveLikeCount: burstLikes, burstStrongActionCount: burst.strong.size, dominantEvidenceShare: burst.dominantShare, dominantCategoryShare: burst.categoryShare, dominantConceptShare: burst.conceptShare, fullHistoryDominantCategoryShare: history.categoryShare, fullHistoryDominantConceptShare: history.conceptShare, dominantFeature: burst.dominantFeature, newestEvidenceAgeDays: burst.newestAgeDays, rejectedCounts };
};
