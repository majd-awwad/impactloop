import type { ScoredCandidate } from './ml-lightfm-scorer.js';
import type { RecentIntentConfidence } from './recent-intent-confidence.js';

export const MATERIAL_FUSION_CONFIG = { recentScoreThreshold: 0.05, longTermPool: 100, recentPool: 30 } as const;

export type MaterialFusionResult = {
  ranking: ScoredCandidate[];
  qualifiedRecentCount: number;
  insertedTop5Count: number;
  insertedTop10Count: number;
};

export const fuseMaterialRankings = (
  longTerm: ScoredCandidate[],
  recentScores: Map<string, number>,
  confidence: RecentIntentConfidence,
): MaterialFusionResult => {
  if (longTerm.some((value) => !Number.isFinite(value.score))) throw new Error('malformed_candidate_score');
  const allowed = new Set(longTerm.map((value) => value.candidateKey));
  if (allowed.size !== longTerm.length) throw new Error('duplicate_candidate');
  const recent = [...recentScores]
    .filter(([key, score]) => allowed.has(key) && Number.isFinite(score) && score >= MATERIAL_FUSION_CONFIG.recentScoreThreshold)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MATERIAL_FUSION_CONFIG.recentPool);
  const maxTop5 = confidence === 'HIGH' ? 2 : confidence === 'MEDIUM' ? 1 : 0;
  const maxTop10 = confidence === 'HIGH' ? 3 : confidence === 'MEDIUM' ? 1 : 0;
  if (maxTop10 === 0 || recent.length === 0) return { ranking: [...longTerm], qualifiedRecentCount: recent.length, insertedTop5Count: 0, insertedTop10Count: 0 };

  const recentKeys = recent.map(([key]) => key);
  const selectedTop5 = recentKeys.slice(0, maxTop5);
  const selectedTop10 = recentKeys.slice(maxTop5, maxTop10);
  const reserved = new Set([...selectedTop5, ...selectedTop10]);
  const remaining = longTerm.filter((value) => !reserved.has(value.candidateKey));
  const fusedKeys: string[] = [];
  const takeLong = () => { const value = remaining.shift(); if (value) fusedKeys.push(value.candidateKey); };
  takeLong();
  if (selectedTop5[0]) fusedKeys.push(selectedTop5[0]);
  takeLong();
  if (selectedTop5[1]) fusedKeys.push(selectedTop5[1]);
  while (fusedKeys.length < 5) takeLong();
  for (const key of selectedTop10) fusedKeys.push(key);
  while (fusedKeys.length < 10) takeLong();
  fusedKeys.push(...remaining.map((value) => value.candidateKey));
  const scores = new Map(longTerm.map((value) => [value.candidateKey, value.score]));
  return { ranking: fusedKeys.map((candidateKey) => ({ candidateKey, score: scores.get(candidateKey)! })), qualifiedRecentCount: recent.length, insertedTop5Count: selectedTop5.length, insertedTop10Count: selectedTop5.length + selectedTop10.length };
};
