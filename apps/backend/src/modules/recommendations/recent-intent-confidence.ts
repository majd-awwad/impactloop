import type { IntentMetadata, RecentIntentEvent } from './short-term-intent.js';

export type RecentIntentConfidence = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export type RecentIntentProfile = {
  confidence: RecentIntentConfidence;
  uniqueRecentMaterialCount: number;
  activeRecentLikeCount: number;
  strongActionCount: number;
  dominantEvidenceShare: number;
  dominantFeature?: string;
  newestEvidenceAgeDays?: number;
};

const DAY_MS = 86_400_000;
const ACTIVE_WINDOW_DAYS = 14;
const strongActions = new Set(['reservation', 'build_started']);

export const classifyRecentIntent = (
  events: RecentIntentEvent[],
  metadata: Map<string, IntentMetadata>,
  evaluationTimestamp: string,
): RecentIntentProfile => {
  const now = Date.parse(evaluationTimestamp);
  if (!Number.isFinite(now)) throw new Error('invalid_evaluation_timestamp');
  const ordered = [...events].sort((left, right) => left.timestampUtc.localeCompare(right.timestampUtc));
  const views = new Map<string, number>();
  const likes = new Map<string, boolean>();
  const strong = new Set<string>();
  const timestamps: number[] = [];

  for (const event of ordered) {
    const timestamp = Date.parse(event.timestampUtc);
    if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp > ACTIVE_WINDOW_DAYS * DAY_MS || !metadata.has(event.entityKey)) continue;
    if (event.actionType === 'view') views.set(event.entityKey, Math.min(2, (views.get(event.entityKey) ?? 0) + 1));
    else if (event.actionType === 'like') likes.set(event.entityKey, true);
    else if (event.actionType === 'unlike') likes.set(event.entityKey, false);
    else if (strongActions.has(event.actionType)) strong.add(event.entityKey);
    else continue;
    timestamps.push(timestamp);
  }

  const uniqueEntities = new Set([...views.keys(), ...[...likes].filter(([, active]) => active).map(([key]) => key), ...strong]);
  const featureVotes = new Map<string, number>();
  for (const entityKey of uniqueEntities) {
    const item = metadata.get(entityKey)!;
    const features = [`category:${item.categoryKey}`, ...item.conceptKeys.map((key) => `concept:${key}`)];
    for (const feature of new Set(features)) featureVotes.set(feature, (featureVotes.get(feature) ?? 0) + 1);
  }
  const dominant = [...featureVotes].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
  const dominantEvidenceShare = uniqueEntities.size > 0 ? (dominant?.[1] ?? 0) / uniqueEntities.size : 0;
  const activeRecentLikeCount = [...likes.values()].filter(Boolean).length;
  const uniqueRecentMaterialCount = views.size;
  const strongActionCount = strong.size;
  const newestEvidenceAgeDays = timestamps.length ? (now - Math.max(...timestamps)) / DAY_MS : undefined;
  const ageFactor = newestEvidenceAgeDays === undefined ? 0 : 0.5 ** (newestEvidenceAgeDays / 4);

  let confidence: RecentIntentConfidence = 'NONE';
  if (uniqueEntities.size > 0) confidence = 'LOW';
  if (dominantEvidenceShare >= 0.6 && (uniqueRecentMaterialCount >= 4 || (activeRecentLikeCount >= 1 && uniqueRecentMaterialCount >= 3)) && ageFactor >= 0.25) confidence = 'MEDIUM';
  if (dominantEvidenceShare >= 0.7 && ((uniqueRecentMaterialCount >= 8 && activeRecentLikeCount >= 2) || (strongActionCount >= 1 && uniqueRecentMaterialCount >= 3)) && ageFactor >= 0.5) confidence = 'HIGH';

  return { confidence, uniqueRecentMaterialCount, activeRecentLikeCount, strongActionCount, dominantEvidenceShare, dominantFeature: dominant?.[0], newestEvidenceAgeDays };
};
