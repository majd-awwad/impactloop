import type { LearnerHomeMaterialCandidate } from './learner-home.types.js';
import type { MaterialScoreAudit } from './learner-home.ranking.js';
import {
  scoreSuggestedMaterial,
  type ScoredMaterialResult,
} from './learner-home.scoring.js';

export type MaterialScoreDebugResult = ScoredMaterialResult & {
  audit: MaterialScoreAudit;
};

export const auditSuggestedMaterialScore = (input: {
  material: LearnerHomeMaterialCandidate;
  interests: string[];
  savedComponents: Parameters<typeof scoreSuggestedMaterial>[0]['savedComponents'];
  savedLocation: Parameters<typeof scoreSuggestedMaterial>[0]['savedLocation'];
  behaviorAffinityProfile?: Parameters<typeof scoreSuggestedMaterial>[0]['behaviorAffinityProfile'];
  behavior?: Parameters<typeof scoreSuggestedMaterial>[0]['behavior'];
}): MaterialScoreDebugResult => {
  const result = scoreSuggestedMaterial({ ...input, includeAudit: true });

  if (!result.audit) {
    throw new Error('Expected scoring audit metadata to be present.');
  }

  return {
    score: result.score,
    reasons: result.reasons,
    tier: result.tier,
    hasPrimaryRelevance: result.hasPrimaryRelevance,
    fallbackOnly: result.fallbackOnly,
    audit: result.audit,
  };
};
