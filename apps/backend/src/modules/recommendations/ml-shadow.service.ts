import { createHash } from 'node:crypto';

import { env } from '../../config/env.js';
import { logger } from '../../observability/logger.js';
import { combineNormalizedScores, scorePortableLightFm, type WeightedFeature } from './ml-lightfm-scorer.js';
import { loadPortableModelArtifact, type PortableModelArtifact } from './ml-model-artifact.js';
import { buildShortTermIntent, recentItemScore, SHORT_TERM_CONFIG, type RecentIntentEvent } from './short-term-intent.js';
import { classifyRecentIntent, type RecentIntentConfidence } from './recent-intent-confidence.js';
import { fuseMaterialRankings } from './material-rank-fusion.js';

export type ShadowCandidate = { candidateKey: string; categoryId: string; categoryLabel: string; conceptKeys?: string[]; componentConceptKeys?: string[]; condition?: string; isFree?: boolean; pickupAllowed?: boolean; deliveryAllowed?: boolean; difficulty?: string };
export type ShadowComparisonInput<T> = { response: T; domain: 'material' | 'project'; interests: string[]; candidates: ShadowCandidate[]; recentEntityMetadata?: Array<ShadowCandidate & { entityKey: string }>; currentSections?: Array<{ sectionKey: string; candidateKeys: string[] }>; activeCandidateKeys: string[]; currentTopKeys: string[]; recentEvents: RecentIntentEvent[]; evaluationTimestamp: string };
export type ShadowFeatureCoverage = { activeUserFeatures: number; zeroFeatureUser: boolean; itemFeatureTotal: number; itemsOnlyCategory: number; itemsWithoutApprovedFeatures: number; categoryCovered: number; conceptCovered: number; conditionCovered: number; freeCovered: number; pickupCovered: number; deliveryCovered: number; difficultyCovered: number; componentCovered: number };
export type ShadowDiagnostics = { status: 'DISABLED' | 'SCORED' | 'FALLBACK'; fallbackReason?: string; candidateCount: number; top5Overlap?: number; top10Overlap?: number; rankCorrelation?: number; duplicateCurrentCount?: number; deduplicatedCurrentCount?: number; sectionDiagnostics?: Array<{ sectionKey: string; candidatePoolSize: number; top5Overlap: number; top10Overlap: number; fusedTop5Keys?: string[]; fusedTop10Keys?: string[] }>; recentEventInputCount?: number; recentEvidenceCount?: number; recentChannelApplied?: boolean; recentConfidence?: RecentIntentConfidence; recentUniqueMaterialCount?: number; recentActiveLikeCount?: number; recentStrongActionCount?: number; recentCoherence?: number; qualifiedRecentCandidateCount?: number; fusionDurationMs?: number; scoringDurationMs?: number; artifactVersion?: string; missingFeatureCount?: number; featureCoverage?: ShadowFeatureCoverage; currentTop5Keys?: string[]; shadowTop5Keys?: string[]; linearBlendTop5Keys?: string[] };

type ShadowObserver = (diagnostics: ShadowDiagnostics & { domain: 'material' | 'project' }) => void;
let observer: ShadowObserver | undefined;
let artifactLoadCount = 0;
export const setMlShadowObserverForTests = (value?: ShadowObserver) => { observer = value; };
export const getMlArtifactCacheStatsForTests = () => ({ entries: cache.size, artifactLoadCount });

const cache = new Map<string, Promise<PortableModelArtifact>>();
const safeMaterialFusion = (...args: Parameters<typeof fuseMaterialRankings>) => {
  try { return { ...fuseMaterialRankings(...args), fallbackReason: undefined as string | undefined }; }
  catch (error) { return { ranking: [...args[0]], qualifiedRecentCount: 0, insertedTop5Count: 0, insertedTop10Count: 0, fallbackReason: error instanceof Error ? error.message : 'fusion_error' }; }
};
const artifact = (path: string, domain: 'material' | 'project') => {
  const key = `${domain}:${path}`; let value = cache.get(key);
  if (!value) { artifactLoadCount += 1; value = loadPortableModelArtifact(path, domain); cache.set(key, value); }
  return value;
};
export const clearMlArtifactCacheForTests = () => { cache.clear(); artifactLoadCount = 0; };

const categoryKey = (id: string) => createHash('sha256').update(`impactloop-category:${id}`).digest('hex');
const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const overlap = (left: string[], right: string[], k: number) => {
  const a = new Set(left.slice(0, k)); return right.slice(0, k).filter((value) => a.has(value)).length / Math.max(1, Math.min(k, left.length, right.length));
};
const privacyKey = (value: string) => createHash('sha256').update(`impactloop-shadow-diagnostic:${value}`).digest('hex').slice(0, 16);
const rankCorrelation = (left: string[], right: string[]) => {
  const rightRanks = new Map(right.map((key, index) => [key, index]));
  const common = left.filter((key) => rightRanks.has(key));
  if (common.length < 2) return undefined;
  const squared = common.reduce((sum, key, index) => sum + (index - rightRanks.get(key)!) ** 2, 0);
  return 1 - (6 * squared) / (common.length * (common.length ** 2 - 1));
};

const itemFeatures = (candidate: ShadowCandidate, domain: 'material' | 'project'): WeightedFeature[] => {
  const features: WeightedFeature[] = [[`category:${categoryKey(candidate.categoryId)}`, 1]];
  for (const value of candidate.conceptKeys ?? []) features.push([`concept:${value}`, 1]);
  if (domain === 'material') {
    if (candidate.condition) features.push([`condition:${candidate.condition}`, 1]);
    if (candidate.isFree !== undefined) features.push([`free:${Number(candidate.isFree)}`, 1]);
    if (candidate.pickupAllowed !== undefined) features.push([`pickup:${Number(candidate.pickupAllowed)}`, 1]);
    if (candidate.deliveryAllowed !== undefined) features.push([`delivery:${Number(candidate.deliveryAllowed)}`, 1]);
  } else {
    if (candidate.difficulty) features.push([`difficulty:${candidate.difficulty}`, 1]);
    for (const value of candidate.componentConceptKeys ?? []) features.push([`component:${value}`, 1]);
  }
  return features;
};

export const runMlShadowComparison = async <T>(input: ShadowComparisonInput<T>): Promise<{ response: T; diagnostics: ShadowDiagnostics }> => {
  if (!env.recommendationMlShadowEnabled) return { response: input.response, diagnostics: { status: 'DISABLED', candidateCount: input.candidates.length } };
  const started = performance.now();
  try {
    if (input.candidates.length > 200) throw new Error('candidate_bound');
    const unique = new Set(input.candidates.map((value) => value.candidateKey));
    if (unique.size !== input.candidates.length) throw new Error('candidate_mismatch');
    const shadowKeys = [...unique].sort(); const activeKeys = [...new Set(input.activeCandidateKeys)].sort();
    if (shadowKeys.length !== activeKeys.length || shadowKeys.some((value, index) => value !== activeKeys[index])) throw new Error('candidate_mismatch');
    const path = input.domain === 'material' ? env.recommendationMlMaterialArtifactPath : env.recommendationMlProjectArtifactPath;
    if (!path) throw new Error('artifact_path_missing');
    const model = await artifact(path, input.domain);
    const labels = new Map(input.candidates.map((value) => [normalize(value.categoryLabel), categoryKey(value.categoryId)]));
    const userFeatures: WeightedFeature[] = [];
    for (const interest of input.interests) { const key = labels.get(normalize(interest)); if (key) userFeatures.push([`interest:${key}`, 1]); }
    const candidates = input.candidates.map((value) => ({ candidateKey: value.candidateKey, features: itemFeatures(value, input.domain) }));
    const longTerm = scorePortableLightFm(model, userFeatures, candidates);
    const metadata = new Map(input.candidates.map((value) => [value.candidateKey, { categoryKey: categoryKey(value.categoryId), conceptKeys: value.conceptKeys ?? [], componentConceptKeys: value.componentConceptKeys ?? [] }]));
    for (const value of input.recentEntityMetadata ?? []) metadata.set(value.entityKey, { categoryKey: categoryKey(value.categoryId), conceptKeys: value.conceptKeys ?? [], componentConceptKeys: value.componentConceptKeys ?? [] });
    const recent = buildShortTermIntent(input.recentEvents, metadata, input.evaluationTimestamp);
    const recentScores = new Map(input.candidates.map((value) => [value.candidateKey, recentItemScore(metadata.get(value.candidateKey)!, recent.intent)]));
    const combined = combineNormalizedScores(longTerm.scored, recentScores, SHORT_TERM_CONFIG.recentBlend);
    const linearBlendTop = combined.map((value) => value.candidateKey);
    const confidence = classifyRecentIntent(input.recentEvents, metadata, input.evaluationTimestamp);
    const fusionStarted = performance.now();
    const fusion = input.domain === 'material' ? safeMaterialFusion(longTerm.scored, recentScores, confidence.confidence) : undefined;
    if (fusion?.fallbackReason) logger.warn({ recommendationMlMaterialFusion: { fallbackReason: fusion.fallbackReason } }, 'material rank fusion fallback');
    const fusionDurationMs = performance.now() - fusionStarted;
    const shadowTop = fusion?.ranking.map((value) => value.candidateKey) ?? linearBlendTop;
    const deduplicatedCurrent = [...new Set(input.currentTopKeys)];
    const sectionDiagnostics = (input.currentSections ?? []).map((section) => {
      const current = [...new Set(section.candidateKeys)]; const allowed = new Set(current);
      const sectionLongTerm = longTerm.scored.filter((value) => allowed.has(value.candidateKey));
      const within = input.domain === 'material' && section.sectionKey === 'suggested_materials'
        ? safeMaterialFusion(sectionLongTerm, new Map([...recentScores].filter(([key]) => allowed.has(key))), confidence.confidence).ranking.map((value) => value.candidateKey)
        : sectionLongTerm.map((value) => value.candidateKey);
      return { sectionKey: section.sectionKey, candidatePoolSize: current.length, top5Overlap: overlap(current, within, 5), top10Overlap: overlap(current, within, 10), fusedTop5Keys: within.slice(0, 5).map(privacyKey), fusedTop10Keys: within.slice(0, 10).map(privacyKey) };
    });
    const itemFeatureCounts = input.candidates.map((value) => itemFeatures(value, input.domain).length);
    const diagnostics: ShadowDiagnostics = { status: 'SCORED', candidateCount: input.candidates.length, top5Overlap: overlap(deduplicatedCurrent, shadowTop, 5), top10Overlap: overlap(deduplicatedCurrent, shadowTop, 10), rankCorrelation: rankCorrelation(deduplicatedCurrent.slice(0, 10), shadowTop.slice(0, 10)), duplicateCurrentCount: input.currentTopKeys.length - deduplicatedCurrent.length, deduplicatedCurrentCount: deduplicatedCurrent.length, sectionDiagnostics, recentEventInputCount: input.recentEvents.length, recentEvidenceCount: recent.evidenceCount, recentChannelApplied: recent.evidenceCount > 0, recentConfidence: confidence.confidence, recentUniqueMaterialCount: confidence.uniqueRecentMaterialCount, recentActiveLikeCount: confidence.activeRecentLikeCount, recentStrongActionCount: confidence.strongActionCount, recentCoherence: confidence.dominantEvidenceShare, qualifiedRecentCandidateCount: fusion?.qualifiedRecentCount, fusionDurationMs, scoringDurationMs: performance.now() - started, artifactVersion: model.model_version, missingFeatureCount: longTerm.missingFeatures.length, currentTop5Keys: deduplicatedCurrent.slice(0, 5).map(privacyKey), shadowTop5Keys: shadowTop.slice(0, 5).map(privacyKey), linearBlendTop5Keys: linearBlendTop.slice(0, 5).map(privacyKey), featureCoverage: { activeUserFeatures: userFeatures.length, zeroFeatureUser: userFeatures.length === 0, itemFeatureTotal: itemFeatureCounts.reduce((sum, value) => sum + value, 0), itemsOnlyCategory: itemFeatureCounts.filter((value) => value === 1).length, itemsWithoutApprovedFeatures: itemFeatureCounts.filter((value) => value === 0).length, categoryCovered: input.candidates.filter((value) => Boolean(value.categoryId)).length, conceptCovered: input.candidates.filter((value) => (value.conceptKeys?.length ?? 0) > 0).length, conditionCovered: input.candidates.filter((value) => Boolean(value.condition)).length, freeCovered: input.candidates.filter((value) => value.isFree !== undefined).length, pickupCovered: input.candidates.filter((value) => value.pickupAllowed !== undefined).length, deliveryCovered: input.candidates.filter((value) => value.deliveryAllowed !== undefined).length, difficultyCovered: input.candidates.filter((value) => Boolean(value.difficulty)).length, componentCovered: input.candidates.filter((value) => (value.componentConceptKeys?.length ?? 0) > 0).length } };
    logger.info({ recommendationMlShadow: diagnostics, domain: input.domain }, 'recommendation ML shadow comparison');
    observer?.({ ...diagnostics, domain: input.domain });
    return { response: input.response, diagnostics };
  } catch (error) {
    const fallbackReason = error instanceof Error ? error.message : 'unknown_error';
    const diagnostics: ShadowDiagnostics = { status: 'FALLBACK', fallbackReason, candidateCount: input.candidates.length, scoringDurationMs: performance.now() - started };
    logger.warn({ recommendationMlShadow: diagnostics, domain: input.domain }, 'recommendation ML shadow fallback');
    observer?.({ ...diagnostics, domain: input.domain });
    return { response: input.response, diagnostics };
  }
};
