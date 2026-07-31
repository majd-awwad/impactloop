import type { ScoredCandidate } from './ml-lightfm-scorer.js';
import { PROJECT_RECENT_CONFIG, type ProjectRecentIntentConfidence } from './project-recent-intent.js';

export type ProjectFusionResult = {
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

let iterationBudgetForTests: number | undefined;
export const setProjectFusionIterationBudgetForTests = (value?: number): void => {
  iterationBudgetForTests = value;
};

const recentSlotsForConfidence = (confidence: ProjectRecentIntentConfidence) => {
  if (confidence === 'HIGH') return { top5: 2, top10: 3 };
  if (confidence === 'MEDIUM') return { top5: 1, top10: 1 };
  return { top5: 0, top10: 0 };
};

export const fuseProjectRankings = (
  longTerm: ScoredCandidate[],
  recentScores: Map<string, number>,
  confidence: ProjectRecentIntentConfidence,
): ProjectFusionResult => {
  if (longTerm.some((value) => !Number.isFinite(value.score))) throw new Error('malformed_candidate_score');
  const allowed = new Set(longTerm.map((value) => value.candidateKey));
  if (allowed.size !== longTerm.length) throw new Error('duplicate_candidate');

  const outsideCandidateUniverseCount = [...recentScores].filter(([key]) => !allowed.has(key)).length;
  const belowCandidateQualityThresholdCount = [...recentScores]
    .filter(([key, score]) => allowed.has(key) && (!Number.isFinite(score) || score < PROJECT_RECENT_CONFIG.recentScoreThreshold))
    .length;

  const recent = [...recentScores]
    .filter(([key, score]) => allowed.has(key) && Number.isFinite(score) && score >= PROJECT_RECENT_CONFIG.recentScoreThreshold)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, PROJECT_RECENT_CONFIG.recentPool);

  const maxTop5 = recentSlotsForConfidence(confidence).top5;
  const maxTop10 = recentSlotsForConfidence(confidence).top10;
  const qualifiedRecent = recent.map(([candidateKey, recentScore], index) => ({
    candidateKey,
    recentScore,
    recentRank: index + 1,
  }));

  const result = (
    ranking: ScoredCandidate[],
    insertedTop5Count: number,
    insertedTop10Count: number,
    recentSlotsUsedTop5: number,
    recentSlotsUsedTop10: number,
  ): ProjectFusionResult => ({
    ranking,
    qualifiedRecentCount: recent.length,
    insertedTop5Count,
    insertedTop10Count,
    recentSlotsAllowedTop5: maxTop5,
    recentSlotsUsedTop5,
    recentSlotsAllowedTop10: maxTop10,
    recentSlotsUsedTop10,
    qualifiedRecent,
    belowCandidateQualityThresholdCount,
    outsideCandidateUniverseCount,
  });

  if (maxTop10 === 0 || recent.length === 0) {
    return result([...longTerm], 0, 0, 0, 0);
  }

  const longTermTop5 = new Set(longTerm.slice(0, 5).map((value) => value.candidateKey));
  const longTermTop10 = new Set(longTerm.slice(0, 10).map((value) => value.candidateKey));
  const selectedTop5: string[] = [];
  const selectedTop10: string[] = [];
  let slotsUsedTop5 = 0;
  let slotsUsedTop10 = 0;

  for (const [candidateKey] of recent) {
    if (slotsUsedTop5 < maxTop5) {
      if (longTermTop5.has(candidateKey)) {
        slotsUsedTop5 += 1;
        continue;
      }
      if (!selectedTop5.includes(candidateKey)) {
        selectedTop5.push(candidateKey);
        slotsUsedTop5 += 1;
        continue;
      }
    }
    if (slotsUsedTop10 < maxTop10) {
      if (longTermTop10.has(candidateKey)) {
        slotsUsedTop10 += 1;
        continue;
      }
      if (!selectedTop5.includes(candidateKey) && !selectedTop10.includes(candidateKey)) {
        selectedTop10.push(candidateKey);
        slotsUsedTop10 += 1;
      }
    }
    if (slotsUsedTop5 >= maxTop5 && slotsUsedTop10 >= maxTop10) break;
  }

  if (selectedTop5.length === 0 && selectedTop10.length === 0 && slotsUsedTop5 === 0 && slotsUsedTop10 === 0) {
    return result([...longTerm], 0, 0, slotsUsedTop5, slotsUsedTop10);
  }

  const reserved = new Set([...selectedTop5, ...selectedTop10]);
  const remaining = longTerm.filter((value) => !reserved.has(value.candidateKey));
  const fusedKeys: string[] = [];
  const takeLong = () => {
    const before = fusedKeys.length;
    const value = remaining.shift();
    if (!value) return false;
    fusedKeys.push(value.candidateKey);
    if (fusedKeys.length <= before) {
      throw new Error('project_shadow_iteration_bound');
    }
    return true;
  };
  const fillTo = (target: number) => {
    const boundedTarget = Math.min(target, longTerm.length);
    let iterations = 0;
    while (fusedKeys.length < boundedTarget) {
      iterations += 1;
      if (iterations > (iterationBudgetForTests ?? longTerm.length) || !takeLong()) {
        throw new Error('project_shadow_iteration_bound');
      }
    }
    return iterations;
  };

  takeLong();
  if (selectedTop5[0]) fusedKeys.push(selectedTop5[0]);
  takeLong();
  if (selectedTop5[1]) fusedKeys.push(selectedTop5[1]);
  const top10ReservedCount = selectedTop10.length;
  const top5Target = Math.min(5, Math.max(0, longTerm.length - top10ReservedCount));
  fillTo(top5Target);
  for (const key of selectedTop10) fusedKeys.push(key);
  fillTo(Math.min(10, longTerm.length));
  fusedKeys.push(...remaining.map((value) => value.candidateKey));

  if (fusedKeys.length !== longTerm.length || new Set(fusedKeys).size !== longTerm.length) {
    throw new Error('project_shadow_iteration_bound');
  }

  const scores = new Map(longTerm.map((value) => [value.candidateKey, value.score]));
  return result(
    fusedKeys.map((candidateKey) => ({ candidateKey, score: scores.get(candidateKey)! })),
    selectedTop5.length,
    selectedTop5.length + selectedTop10.length,
    slotsUsedTop5,
    slotsUsedTop10,
  );
};
