import type { ScoredCandidate } from './ml-lightfm-scorer.js';
import type { RecentIntentConfidence } from './recent-intent-confidence.js';

export const MATERIAL_FUSION_CONFIG = { recentScoreThreshold: 0.05, longTermPool: 100, recentPool: 30 } as const;

export type MaterialFusionResult = {
  ranking: ScoredCandidate[];
  qualifiedRecentCount: number;
  insertedTop5Count: number;
  insertedTop10Count: number;
  recentSlotsAllowedTop5: number;
  recentSlotsUsedTop5: number;
  recentSlotsAllowedTop10: number;
  recentSlotsUsedTop10: number;
  qualifiedRecent: Array<{ candidateKey: string; recentScore: number; recentRank: number }>;
  belowCandidateQualityThresholdCount: number;
  outsideCandidateUniverseCount: number;
};

export type MaterialFusionStageObserver = (
  stage: 'recent_candidate_qualification' | 'rank_fusion',
  phase: 'start' | 'complete',
  iterationCount: number,
) => void;

let iterationBudgetForTests: number | undefined;
export const setMaterialFusionIterationBudgetForTests = (value?: number): void => {
  iterationBudgetForTests = value;
};

export const fuseMaterialRankings = (
  longTerm: ScoredCandidate[],
  recentScores: Map<string, number>,
  confidence: RecentIntentConfidence,
  observeStage?: MaterialFusionStageObserver,
): MaterialFusionResult => {
  if (longTerm.some((value) => !Number.isFinite(value.score))) throw new Error('malformed_candidate_score');
  const allowed = new Set(longTerm.map((value) => value.candidateKey));
  if (allowed.size !== longTerm.length) throw new Error('duplicate_candidate');
  const outsideCandidateUniverseCount = [...recentScores].filter(([key]) => !allowed.has(key)).length;
  const belowCandidateQualityThresholdCount = [...recentScores].filter(([key, score]) => allowed.has(key) && (!Number.isFinite(score) || score < MATERIAL_FUSION_CONFIG.recentScoreThreshold)).length;
  const recent = [...recentScores]
    .filter(([key, score]) => allowed.has(key) && Number.isFinite(score) && score >= MATERIAL_FUSION_CONFIG.recentScoreThreshold)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MATERIAL_FUSION_CONFIG.recentPool);
  const maxTop5 = confidence === 'HIGH' ? 2 : confidence === 'MEDIUM' ? 1 : 0;
  const maxTop10 = confidence === 'HIGH' ? 3 : confidence === 'MEDIUM' ? 1 : 0;
  const qualifiedRecent = recent.map(([candidateKey, recentScore], index) => ({ candidateKey, recentScore, recentRank: index + 1 }));
  const result = (ranking: ScoredCandidate[], insertedTop5Count: number, insertedTop10Count: number): MaterialFusionResult => {
    return { ranking, qualifiedRecentCount: recent.length, insertedTop5Count, insertedTop10Count, recentSlotsAllowedTop5: maxTop5, recentSlotsUsedTop5: insertedTop5Count, recentSlotsAllowedTop10: maxTop10, recentSlotsUsedTop10: insertedTop10Count, qualifiedRecent, belowCandidateQualityThresholdCount, outsideCandidateUniverseCount };
  };
  observeStage?.('recent_candidate_qualification', 'start', 0);
  observeStage?.('recent_candidate_qualification', 'complete', qualifiedRecent.length);
  if (maxTop10 === 0 || recent.length === 0) {
    observeStage?.('rank_fusion', 'start', 0);
    observeStage?.('rank_fusion', 'complete', 0);
    return result([...longTerm], 0, 0);
  }

  const recentKeys = recent.map(([key]) => key);
  const selectedTop5 = recentKeys.slice(0, maxTop5);
  const selectedTop10 = recentKeys.slice(maxTop5, maxTop10);
  const reserved = new Set([...selectedTop5, ...selectedTop10]);
  const remaining = longTerm.filter((value) => !reserved.has(value.candidateKey));
  const fusedKeys: string[] = [];
  const takeLong = () => {
    const before = fusedKeys.length;
    const value = remaining.shift();
    if (!value) return false;
    fusedKeys.push(value.candidateKey);
    if (fusedKeys.length <= before) {
      throw new Error('material_shadow_iteration_bound');
    }
    return true;
  };
  const fillTo = (target: number) => {
    const boundedTarget = Math.min(target, longTerm.length);
    let iterations = 0;
    while (fusedKeys.length < boundedTarget) {
      iterations += 1;
      if (iterations > (iterationBudgetForTests ?? longTerm.length) || !takeLong()) {
        throw new Error('material_shadow_iteration_bound');
      }
    }
    return iterations;
  };
  observeStage?.('rank_fusion', 'start', 0);
  takeLong();
  if (selectedTop5[0]) fusedKeys.push(selectedTop5[0]);
  takeLong();
  if (selectedTop5[1]) fusedKeys.push(selectedTop5[1]);
  const top10ReservedCount = selectedTop10.length;
  const top5Target = Math.min(5, Math.max(0, longTerm.length - top10ReservedCount));
  const top5Iterations = fillTo(top5Target);
  for (const key of selectedTop10) fusedKeys.push(key);
  const top10Iterations = fillTo(Math.min(10, longTerm.length));
  fusedKeys.push(...remaining.map((value) => value.candidateKey));
  if (fusedKeys.length !== longTerm.length || new Set(fusedKeys).size !== longTerm.length) {
    throw new Error('material_shadow_iteration_bound');
  }
  observeStage?.('rank_fusion', 'complete', top5Iterations + top10Iterations);
  const scores = new Map(longTerm.map((value) => [value.candidateKey, value.score]));
  return result(fusedKeys.map((candidateKey) => ({ candidateKey, score: scores.get(candidateKey)! })), selectedTop5.length, selectedTop5.length + selectedTop10.length);
};
