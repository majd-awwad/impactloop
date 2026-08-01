import {
  buildInterestMatchReason,
  getInterestSearchTermsForKey,
  matchInterestKeyAgainstHaystack,
  normalizeInterestToken,
  normalizeText,
  isCustomInterestKey,
  resolveInterestKey,
  resolveTermToInterestKey,
} from './learner-interest-taxonomy.js';
import type {
  LearnerAffinityProfile,
  LearnerBehaviorContext,
  LearnerBehaviorMaterialSignal,
  LearnerBehaviorProjectSignal,
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
} from './learner-home.types.js';

export const AFFINITY_PROFILE_BOOSTS = {
  explicitInterest: 1.0,
  reservedMaterial: 0.7,
  savedProject: 0.5,
  inProgressBuild: 0.5,
  likedMaterial: 0.55,
  likedMaterialTag: 0.2,
  likedProject: 0.3,
  followedProject: 0.25,
  viewedMaterial: 0.08,
  buildComponent: 0.25,
} as const;

export const BEHAVIOR_SCORE_WEIGHTS = {
  reservedSimilar: 35,
  savedRelatedProject: 30,
  continuedBuild: 28,
  likedSimilar: 28,
  viewedSimilar: 10,
  affinityMatchMax: 25,
} as const;

export const LIKED_SIMILARITY_SCORE_WEIGHTS = {
  taxonomyTerm: 12,
  tagOverlap: 8,
  specificMaterialType: 6,
  minScoreForMatch: 10,
} as const;

export const VIEW_AFFINITY_CAP_PER_MATERIAL = 3;

export const AFFINITY_RELEVANCE_THRESHOLD = 0.25;

const canonicalizeAffinityTerm = (rawTerm: string) => resolveTermToInterestKey(rawTerm);

const resolveCategoryAffinitySources = (
  categoryNameEn: string,
  categoryNameAr: string,
) => {
  const enKey = canonicalizeAffinityTerm(categoryNameEn);
  const arKey = canonicalizeAffinityTerm(categoryNameAr);
  const trimmedEn = categoryNameEn.trim();
  const trimmedAr = categoryNameAr.trim();

  if (!trimmedAr || !arKey) {
    return [trimmedEn, trimmedAr].filter((value) => value.length > 0);
  }

  if (!enKey || arKey === enKey) {
    return [trimmedEn, trimmedAr].filter((value) => value.length > 0);
  }

  // Mismatched bilingual category labels: trust English for affinity extraction.
  return trimmedEn ? [trimmedEn] : [];
};

const tokenizeAffinitySource = (value: string) =>
  normalizeInterestToken(value)
    .split(/[\s,;/|]+/)
    .filter((token) => token.length >= 2);

export const extractAffinityTermsFromMaterial = (
  signal: Pick<
    LearnerBehaviorMaterialSignal,
    | 'title'
    | 'description'
    | 'materialType'
    | 'categoryNameEn'
    | 'categoryNameAr'
    | 'tags'
  >,
) => {
  const terms = new Set<string>();
  const sources = [
    signal.title,
    signal.description,
    signal.materialType,
    ...resolveCategoryAffinitySources(
      signal.categoryNameEn,
      signal.categoryNameAr,
    ),
    ...signal.tags,
  ];

  for (const source of sources) {
    const canonicalWhole = canonicalizeAffinityTerm(source);
    if (canonicalWhole) {
      terms.add(canonicalWhole);
    }

    for (const token of tokenizeAffinitySource(source)) {
      const canonical = canonicalizeAffinityTerm(token);
      if (canonical) {
        terms.add(canonical);
      }
    }
  }

  return [...terms];
};

export const extractAffinityTermsFromProject = (
  signal: Pick<
    LearnerBehaviorProjectSignal,
    | 'title'
    | 'shortDescription'
    | 'categoryNameEn'
    | 'categoryNameAr'
    | 'tags'
    | 'components'
  >,
) => {
  const terms = new Set<string>();
  const sources = [
    signal.title,
    signal.shortDescription,
    ...resolveCategoryAffinitySources(
      signal.categoryNameEn,
      signal.categoryNameAr,
    ),
    ...signal.tags,
  ];

  for (const source of sources) {
    const canonicalWhole = canonicalizeAffinityTerm(source);
    if (canonicalWhole) {
      terms.add(canonicalWhole);
    }

    for (const token of tokenizeAffinitySource(source)) {
      const canonical = canonicalizeAffinityTerm(token);
      if (canonical) {
        terms.add(canonical);
      }
    }
  }

  for (const component of signal.components) {
    for (const term of extractAffinityTermsFromMaterial({
      title: component.componentName,
      description: '',
      materialType: component.materialType,
      categoryNameEn: component.categoryNameEn ?? '',
      categoryNameAr: component.categoryNameEn ?? '',
      tags: [],
    })) {
      terms.add(term);
    }
  }

  return [...terms];
};

const addTermsToProfile = (
  profile: LearnerAffinityProfile,
  terms: string[],
  weight: number,
) => {
  for (const term of terms) {
    profile.set(term, (profile.get(term) ?? 0) + weight);
  }
};

export const buildBehaviorAffinityProfile = (
  behavior: LearnerBehaviorContext,
): LearnerAffinityProfile => {
  const profile: LearnerAffinityProfile = new Map();

  for (const material of behavior.reservedMaterials) {
    addTermsToProfile(
      profile,
      extractAffinityTermsFromMaterial(material),
      AFFINITY_PROFILE_BOOSTS.reservedMaterial,
    );
  }

  for (const project of behavior.savedProjects) {
    addTermsToProfile(
      profile,
      extractAffinityTermsFromProject(project),
      AFFINITY_PROFILE_BOOSTS.savedProject,
    );
  }

  for (const project of behavior.inProgressBuildProjects) {
    addTermsToProfile(
      profile,
      extractAffinityTermsFromProject(project),
      AFFINITY_PROFILE_BOOSTS.inProgressBuild,
    );
    for (const component of project.components) {
      addTermsToProfile(
        profile,
        extractAffinityTermsFromMaterial({
          title: component.componentName,
          description: '',
          materialType: component.materialType,
          categoryNameEn: component.categoryNameEn ?? '',
          categoryNameAr: component.categoryNameEn ?? '',
          tags: [],
        }),
        AFFINITY_PROFILE_BOOSTS.buildComponent,
      );
    }
  }

  for (const material of behavior.likedMaterials) {
    addTermsToProfile(
      profile,
      extractAffinityTermsFromMaterial(material),
      AFFINITY_PROFILE_BOOSTS.likedMaterial,
    );

    for (const tag of material.tags) {
      const canonical = canonicalizeAffinityTerm(tag);
      if (canonical) {
        profile.set(
          canonical,
          (profile.get(canonical) ?? 0) + AFFINITY_PROFILE_BOOSTS.likedMaterialTag,
        );
      }
    }
  }

  for (const project of behavior.likedProjects) {
    addTermsToProfile(
      profile,
      extractAffinityTermsFromProject(project),
      AFFINITY_PROFILE_BOOSTS.likedProject,
    );
  }

  for (const project of behavior.followedProjects) {
    addTermsToProfile(
      profile,
      extractAffinityTermsFromProject(project),
      AFFINITY_PROFILE_BOOSTS.followedProject,
    );
  }

  const viewedCounts = new Map<string, number>();
  for (const material of behavior.viewedMaterials) {
    const currentCount = viewedCounts.get(material.materialId) ?? 0;
    if (currentCount >= VIEW_AFFINITY_CAP_PER_MATERIAL) {
      continue;
    }

    viewedCounts.set(material.materialId, currentCount + 1);
    addTermsToProfile(
      profile,
      extractAffinityTermsFromMaterial(material),
      AFFINITY_PROFILE_BOOSTS.viewedMaterial,
    );
  }

  return profile;
};

export const buildLearnerAffinityProfile = (input: {
  interests: string[];
  behavior: LearnerBehaviorContext;
}): LearnerAffinityProfile => {
  const profile = buildBehaviorAffinityProfile(input.behavior);

  for (const interest of input.interests) {
    const normalized = resolveInterestKey(interest);
    if (!normalized || isCustomInterestKey(normalized)) {
      continue;
    }

    profile.set(normalized, (profile.get(normalized) ?? 0) + AFFINITY_PROFILE_BOOSTS.explicitInterest);
    for (const term of getInterestSearchTermsForKey(normalized)) {
      if (term.length >= 3) {
        const mapped = resolveTermToInterestKey(term);
        if (mapped) {
          profile.set(
            mapped,
            (profile.get(mapped) ?? 0) + AFFINITY_PROFILE_BOOSTS.explicitInterest * 0.35,
          );
        }
      }
    }
  }

  return profile;
};

export const hasMeaningfulBehaviorAffinity = (profile: LearnerAffinityProfile) =>
  [...profile.values()].some((weight) => weight >= AFFINITY_RELEVANCE_THRESHOLD);

export const hasMeaningfulAffinityProfile = hasMeaningfulBehaviorAffinity;

export const getAffinityProfileTerms = (profile: LearnerAffinityProfile) =>
  [...profile.entries()]
    .filter(([, weight]) => weight >= AFFINITY_RELEVANCE_THRESHOLD)
    .sort((left, right) => right[1] - left[1])
    .map(([term]) => term);

export const matchesAffinityProfile = (
  haystack: string,
  profile: LearnerAffinityProfile,
): string[] => {
  const matchedTerms: string[] = [];

  for (const [term, weight] of profile.entries()) {
    if (weight < AFFINITY_RELEVANCE_THRESHOLD) {
      continue;
    }

    if (matchInterestKeyAgainstHaystack(haystack, term)) {
      matchedTerms.push(term);
    }
  }

  return matchedTerms;
};

const GENERIC_BROAD_INTEREST_KEYS = new Set(['electronics']);

/** Taxonomy terms too broad to justify liked-material similarity on their own. */
const LIKED_SIMILARITY_WEAK_SHARED_TERMS = new Set([
  'electronics',
  'art_crafts',
  'audio_media',
  'woodworking',
]);

export const isQualifiedLikedSimilaritySharedTerm = (term: string) =>
  !LIKED_SIMILARITY_WEAK_SHARED_TERMS.has(term);

const GENERIC_MATERIAL_TYPES = new Set([
  'general',
  'misc',
  'other',
  'electronics',
  'electronics components',
  'components',
]);

const materialSignalFromCandidate = (
  material: Pick<
    LearnerHomeMaterialCandidate,
    | 'title'
    | 'description'
    | 'materialType'
    | 'categoryNameEn'
    | 'categoryNameAr'
    | 'tags'
  >,
): LearnerBehaviorMaterialSignal => ({
  materialId: 'candidate',
  title: material.title,
  description: material.description,
  materialType: material.materialType,
  categoryNameEn: material.categoryNameEn,
  categoryNameAr: material.categoryNameAr,
  tags: material.tags,
});

const getSpecificMaterialTags = (
  signal: Pick<
    LearnerBehaviorMaterialSignal,
    'tags' | 'categoryNameEn' | 'categoryNameAr' | 'materialType'
  >,
) =>
  signal.tags.filter((tag) => {
    const normalizedTag = normalizeText(tag);
    return (
      normalizedTag.length >= 3 &&
      normalizedTag !== normalizeText(signal.categoryNameEn) &&
      normalizedTag !== normalizeText(signal.categoryNameAr) &&
      normalizedTag !== normalizeText(signal.materialType)
    );
  });

const getSpecificAffinityTerms = (
  signal: Pick<
    LearnerBehaviorMaterialSignal,
    | 'title'
    | 'description'
    | 'materialType'
    | 'categoryNameEn'
    | 'categoryNameAr'
    | 'tags'
  >,
  options: { includeDescription?: boolean } = {},
) => {
  const includeDescription = options.includeDescription ?? true;
  const sourceSignal = includeDescription
    ? signal
    : { ...signal, description: '' };
  const terms = new Set<string>();

  for (const term of extractAffinityTermsFromMaterial(sourceSignal)) {
    if (!GENERIC_BROAD_INTEREST_KEYS.has(term)) {
      terms.add(term);
    }
  }

  for (const token of tokenizeAffinitySource(signal.title)) {
    if (token.length >= 4) {
      const canonical = canonicalizeAffinityTerm(token);
      if (canonical && !GENERIC_BROAD_INTEREST_KEYS.has(canonical)) {
        terms.add(canonical);
      }
    }
  }

  return terms;
};

const hasSpecificCategoryMatch = (
  left: Pick<LearnerBehaviorMaterialSignal, 'categoryNameEn' | 'categoryNameAr'>,
  right: Pick<LearnerBehaviorMaterialSignal, 'categoryNameEn' | 'categoryNameAr'>,
) => {
  const leftCategory = normalizeText(left.categoryNameEn || left.categoryNameAr);
  const rightCategory = normalizeText(
    right.categoryNameEn || right.categoryNameAr,
  );

  return (
    leftCategory.length >= 4 &&
    rightCategory.length >= 4 &&
    leftCategory === rightCategory &&
    !GENERIC_MATERIAL_TYPES.has(leftCategory)
  );
};

const formatLikedMaterialLabel = (signal: LearnerBehaviorMaterialSignal) => {
  for (const token of tokenizeAffinitySource(signal.title)) {
    const canonical = canonicalizeAffinityTerm(token);
    if (canonical && !GENERIC_BROAD_INTEREST_KEYS.has(canonical)) {
      if (canonical === 'arduino') {
        return 'Arduino';
      }
      if (canonical === 'fabric_textiles') {
        return 'Fabric';
      }

      return token.charAt(0).toUpperCase() + token.slice(1);
    }
  }

  for (const tag of getSpecificMaterialTags(signal)) {
    const canonical = canonicalizeAffinityTerm(tag);
    if (canonical === 'arduino') {
      return 'Arduino';
    }
    if (canonical === 'fabric_textiles') {
      return 'Fabric';
    }
  }

  return null;
};

export type LikedMaterialSimilarityMatch = {
  score: number;
  reason: string | null;
  isExactLikedItem: boolean;
  matchedLikedMaterial: LearnerBehaviorMaterialSignal | null;
  sharedTerms: string[];
};

export const scoreMaterialSimilarityToLikedMaterials = (input: {
  material: LearnerHomeMaterialCandidate;
  likedMaterials: LearnerBehaviorMaterialSignal[];
}): LikedMaterialSimilarityMatch => {
  if (input.likedMaterials.length === 0) {
    return {
      score: 0,
      reason: null,
      isExactLikedItem: false,
      matchedLikedMaterial: null,
      sharedTerms: [],
    };
  }

  const candidateSignal = materialSignalFromCandidate(input.material);
  const candidateTerms = getSpecificAffinityTerms(candidateSignal, {
    includeDescription: false,
  });
  const candidateTags = new Set(
    getSpecificMaterialTags(candidateSignal).map((tag) => normalizeText(tag)),
  );

  let bestScore = 0;
  let bestReason: string | null = null;
  let bestSignal: LearnerBehaviorMaterialSignal | null = null;
  let bestSharedTerms: string[] = [];
  let isExactLikedItem = false;

  for (const liked of input.likedMaterials) {
    if (liked.materialId === input.material.id) {
      isExactLikedItem = true;
      continue;
    }

    const likedTerms = getSpecificAffinityTerms(liked, {
      includeDescription: false,
    });
    const likedTags = new Set(
      getSpecificMaterialTags(liked).map((tag) => normalizeText(tag)),
    );
    const sharedTerms = new Set<string>();
    let score = 0;
    let hasTagOverlap = false;

    for (const tag of candidateTags) {
      if (likedTags.has(tag)) {
        hasTagOverlap = true;
        sharedTerms.add(tag);
        score += LIKED_SIMILARITY_SCORE_WEIGHTS.tagOverlap;
      }
    }

    for (const term of candidateTerms) {
      if (likedTerms.has(term)) {
        sharedTerms.add(term);
        score += LIKED_SIMILARITY_SCORE_WEIGHTS.taxonomyTerm;
      }
    }

    const hasCategoryMatch = hasSpecificCategoryMatch(candidateSignal, liked);

    const materialType = normalizeText(input.material.materialType);
    const likedMaterialType = normalizeText(liked.materialType);
    if (
      materialType.length >= 4 &&
      materialType === likedMaterialType &&
      !GENERIC_MATERIAL_TYPES.has(materialType)
    ) {
      score += LIKED_SIMILARITY_SCORE_WEIGHTS.specificMaterialType;
    }

    const hasQualifiedOverlap =
      hasTagOverlap ||
      hasCategoryMatch ||
      [...sharedTerms].some(isQualifiedLikedSimilaritySharedTerm);

    if (
      !hasQualifiedOverlap ||
      score < LIKED_SIMILARITY_SCORE_WEIGHTS.minScoreForMatch ||
      sharedTerms.size === 0
    ) {
      continue;
    }

    score = Math.min(BEHAVIOR_SCORE_WEIGHTS.likedSimilar, score);
    const label = formatLikedMaterialLabel(liked);
    const reason = label
      ? `Similar to your liked ${label} materials`
      : 'Similar to materials you liked';

    if (score > bestScore) {
      bestScore = score;
      bestReason = reason;
      bestSignal = liked;
      bestSharedTerms = [...sharedTerms];
    }
  }

  return {
    score: bestScore,
    reason: bestReason,
    isExactLikedItem,
    matchedLikedMaterial: bestSignal,
    sharedTerms: bestSharedTerms,
  };
};

const signalHaystackForMaterial = (signal: LearnerBehaviorMaterialSignal) =>
  normalizeText(
    [
      signal.title,
      signal.description,
      signal.materialType,
      ...signal.tags,
    ].join(' '),
  );

const isDirectMaterialSimilarity = (
  materialHaystack: string,
  signal: LearnerBehaviorMaterialSignal,
) => {
  const signalHaystack = signalHaystackForMaterial(signal);
  if (materialHaystack === signalHaystack) {
    return true;
  }

  const titleTokens = tokenizeAffinitySource(signal.title).filter(
    (token) => token.length >= 4,
  );
  if (
    titleTokens.some(
      (token) =>
        materialHaystack.includes(token) && signalHaystack.includes(token),
    )
  ) {
    return true;
  }

  return signal.tags.some((tag) => {
    const normalizedTag = normalizeText(tag);
    if (
      normalizedTag.length < 3 ||
      normalizedTag === normalizeText(signal.categoryNameEn) ||
      normalizedTag === normalizeText(signal.categoryNameAr) ||
      normalizedTag === normalizeText(signal.materialType)
    ) {
      return false;
    }

    return (
      materialHaystack.includes(normalizedTag) &&
      signalHaystack.includes(normalizedTag)
    );
  });
};

const materialMatchesSignal = (
  materialHaystack: string,
  signal: LearnerBehaviorMaterialSignal,
) => {
  if (isDirectMaterialSimilarity(materialHaystack, signal)) {
    return true;
  }

  return extractAffinityTermsFromMaterial(signal).some((term) =>
    Boolean(matchInterestKeyAgainstHaystack(materialHaystack, term)),
  );
};

const projectMatchesMaterial = (
  materialHaystack: string,
  project: LearnerBehaviorProjectSignal,
) =>
  extractAffinityTermsFromProject(project).some((term) =>
    Boolean(matchInterestKeyAgainstHaystack(materialHaystack, term)),
  );

export type MaterialBehaviorMatch = {
  score: number;
  reasons: string[];
  hasAffinityRelevance: boolean;
  hasBehaviorReason: boolean;
};

export const scoreMaterialBehaviorMatch = (input: {
  material: LearnerHomeMaterialCandidate;
  behaviorAffinityProfile: LearnerAffinityProfile;
  behavior: LearnerBehaviorContext;
}): MaterialBehaviorMatch => {
  const haystack = normalizeText(
    [
      input.material.title,
      input.material.description,
      input.material.materialType,
      input.material.categoryNameEn,
      input.material.categoryNameAr,
      ...input.material.tags,
    ].join(' '),
  );

  if (!hasLearnerActivity(input.behavior)) {
    return {
      score: 0,
      reasons: [],
      hasAffinityRelevance: false,
      hasBehaviorReason: false,
    };
  }

  const matchedAffinityTerms = matchesAffinityProfile(
    haystack,
    input.behaviorAffinityProfile,
  );
  const hasAffinityRelevance = matchedAffinityTerms.length > 0;

  let score = 0;
  const reasons: string[] = [];

  if (hasMeaningfulBehaviorAffinity(input.behaviorAffinityProfile) && matchedAffinityTerms.length > 0) {
    const topWeight = Math.max(
      ...matchedAffinityTerms.map(
        (term) => input.behaviorAffinityProfile.get(term) ?? 0,
      ),
    );
    score += Math.min(
      BEHAVIOR_SCORE_WEIGHTS.affinityMatchMax,
      Math.round(topWeight * 12),
    );
  }

  const reservedMatch = input.behavior.reservedMaterials.some((signal) =>
    materialMatchesSignal(haystack, signal),
  );
  if (reservedMatch) {
    score += BEHAVIOR_SCORE_WEIGHTS.reservedSimilar;
    reasons.push('Similar to materials you reserved');
  }

  const likedSimilarity = scoreMaterialSimilarityToLikedMaterials({
    material: input.material,
    likedMaterials: input.behavior.likedMaterials,
  });
  if (likedSimilarity.score > 0 && likedSimilarity.reason) {
    score += likedSimilarity.score;
    reasons.push(likedSimilarity.reason);
  }

  const viewedMatch = input.behavior.viewedMaterials.some((signal) =>
    isDirectMaterialSimilarity(haystack, signal),
  );
  if (viewedMatch && !reservedMatch && likedSimilarity.score === 0) {
    score += BEHAVIOR_SCORE_WEIGHTS.viewedSimilar;
    reasons.push('Matches your recent activity');
  }

  const savedProjectMatch = input.behavior.savedProjects.some((project) =>
    projectMatchesMaterial(haystack, project),
  );
  if (savedProjectMatch) {
    score += BEHAVIOR_SCORE_WEIGHTS.savedRelatedProject;
    reasons.push('Related to your saved projects');
  }

  const buildMatch = input.behavior.inProgressBuildProjects.find((project) =>
    projectMatchesMaterial(haystack, project),
  );
  if (buildMatch) {
    score += BEHAVIOR_SCORE_WEIGHTS.continuedBuild;
    const categoryLabel =
      buildMatch.categoryNameEn.trim() || buildMatch.title.trim() || 'project';
    reasons.push(`Because you are building a ${categoryLabel} project`);
  }

  return {
    score,
    reasons: [...new Set(reasons)].slice(0, 2),
    hasAffinityRelevance,
    hasBehaviorReason: reasons.length > 0,
  };
};

export type ProjectBehaviorMatch = {
  score: number;
  reasons: string[];
};

export const scoreProjectBehaviorMatch = (input: {
  project: LearnerHomeProjectCandidate;
  behaviorAffinityProfile: LearnerAffinityProfile;
  behavior: LearnerBehaviorContext;
}): ProjectBehaviorMatch => {
  if (!hasLearnerActivity(input.behavior)) {
    return { score: 0, reasons: [] };
  }

  const haystack = normalizeText(
    [
      input.project.title,
      input.project.shortDescription,
      input.project.categoryNameEn,
      input.project.categoryNameAr,
      ...input.project.tags,
    ].join(' '),
  );

  let score = 0;
  const reasons: string[] = [];

  const savedMatch = input.behavior.savedProjects.some(
    (project) => project.projectId === input.project.id,
  );
  if (savedMatch) {
    score += BEHAVIOR_SCORE_WEIGHTS.savedRelatedProject;
    reasons.push('Related to your saved projects');
  }

  const likedMatch = input.behavior.likedProjects.some(
    (project) => project.projectId === input.project.id,
  );
  if (likedMatch) {
    score += BEHAVIOR_SCORE_WEIGHTS.likedSimilar;
    reasons.push('Based on projects you liked');
  }

  const followedMatch = input.behavior.followedProjects.some(
    (project) => project.projectId === input.project.id,
  );
  if (followedMatch) {
    score += BEHAVIOR_SCORE_WEIGHTS.viewedSimilar;
    reasons.push('Related to projects you follow');
  }

  const buildMatch = input.behavior.inProgressBuildProjects.find(
    (project) => project.projectId === input.project.id,
  );
  if (buildMatch) {
    score += BEHAVIOR_SCORE_WEIGHTS.continuedBuild;
    const categoryLabel =
      buildMatch.categoryNameEn.trim() || buildMatch.title.trim() || 'project';
    reasons.push(`Because you are building a ${categoryLabel} project`);
  }

  const matchedAffinityTerms = hasMeaningfulBehaviorAffinity(
    input.behaviorAffinityProfile,
  )
    ? matchesAffinityProfile(haystack, input.behaviorAffinityProfile)
    : [];

  if (matchedAffinityTerms.length > 0) {
    const topWeight = Math.max(
      ...matchedAffinityTerms.map(
        (term) => input.behaviorAffinityProfile.get(term) ?? 0,
      ),
    );
    score += Math.min(
      BEHAVIOR_SCORE_WEIGHTS.affinityMatchMax,
      Math.round(topWeight * 12),
    );

    if (
      reasons.length === 0 &&
      !savedMatch &&
      !likedMatch &&
      !followedMatch &&
      !buildMatch
    ) {
      if (input.behavior.likedProjects.length > 0) {
        reasons.push('Based on projects you liked');
      } else if (input.behavior.savedProjects.length > 0) {
        reasons.push('Related to your saved projects');
      } else if (input.behavior.followedProjects.length > 0) {
        reasons.push('Related to projects you follow');
      } else if (
        input.behavior.likedMaterials.length > 0 ||
        input.behavior.reservedMaterials.length > 0
      ) {
        reasons.push('Related to materials in your activity');
      } else if (input.behavior.viewedMaterials.length > 0) {
        reasons.push('Matches your recent activity');
      }
    }
  }

  const behaviorMaterialHaystacks = [
    ...input.behavior.likedMaterials,
    ...input.behavior.reservedMaterials,
    ...input.behavior.viewedMaterials,
  ].map((signal) =>
    normalizeText(
      [
        signal.title,
        signal.description,
        signal.materialType,
        signal.categoryNameEn,
        ...signal.tags,
      ].join(' '),
    ),
  );

  const hasComponentMaterialOverlap = input.project.requiredComponents.some(
    (component) => {
      const componentHaystack = normalizeText(
        [component.componentName, component.materialType, ...component.searchKeywords].join(
          ' ',
        ),
      );
      return behaviorMaterialHaystacks.some(
        (materialHaystack) =>
          materialHaystack.includes(normalizeText(component.componentName)) ||
          componentHaystack.split(' ').some(
            (token) => token.length >= 3 && materialHaystack.includes(token),
          ),
      );
    },
  );

  if (hasComponentMaterialOverlap) {
    score += BEHAVIOR_SCORE_WEIGHTS.likedSimilar;
    reasons.push('Related to materials in your activity');
  }

  return {
    score,
    reasons: [...new Set(reasons)].slice(0, 2),
  };
};

export const hasLearnerActivity = (behavior: LearnerBehaviorContext) =>
  behavior.likedMaterials.length > 0 ||
  behavior.viewedMaterials.length > 0 ||
  behavior.reservedMaterials.length > 0 ||
  behavior.savedProjects.length > 0 ||
  behavior.likedProjects.length > 0 ||
  behavior.followedProjects.length > 0 ||
  behavior.inProgressBuildProjects.length > 0;

export const createEmptyBehaviorContext = (): LearnerBehaviorContext => ({
  likedMaterials: [],
  viewedMaterials: [],
  reservedMaterials: [],
  savedProjects: [],
  likedProjects: [],
  followedProjects: [],
  inProgressBuildProjects: [],
});

export const createEmptyAffinityProfile = (): LearnerAffinityProfile => new Map();
