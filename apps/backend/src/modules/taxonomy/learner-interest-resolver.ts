import {
  isValidTaxonomyCanonicalKey,
  normalizeTaxonomyAlias,
} from './taxonomy-normalization.js';

export const TAXONOMY_ALIAS_SOURCE = {
  REVIEWED_EXPLICIT: 'phase-2b-reviewed-vocabulary',
  REVIEWED_LABEL_EN: 'phase-2b-reviewed-vocabulary.canonical-label-en',
  REVIEWED_LABEL_AR: 'phase-2b-reviewed-vocabulary.canonical-label-ar',
} as const;

export type LearnerInterestConceptType =
  | 'INTEREST'
  | 'MATERIAL_FAMILY'
  | 'MATERIAL_FORM'
  | 'PROJECT_TOPIC'
  | 'COMPONENT';

export type LearnerInterestConceptStatus = 'ACTIVE' | 'INACTIVE';

export type LearnerInterestRegistryAlias = {
  id: string;
  alias: string;
  normalizedAlias: string;
  language: 'EN' | 'AR';
  aliasType:
    | 'CANONICAL'
    | 'EXPLICIT'
    | 'LEGACY'
    | 'ABBREVIATION'
    | 'TRANSLATION';
  source: string;
  isActive: boolean;
};

export type LearnerInterestRegistryLegacyKey = {
  id: string;
  learnerInterestKey: string;
};

export type LearnerInterestRegistryConcept = {
  id: string;
  canonicalKey: string;
  conceptType: LearnerInterestConceptType;
  status: LearnerInterestConceptStatus;
  labelEn: string;
  labelAr: string;
  aliases: readonly LearnerInterestRegistryAlias[];
  learnerInterests: readonly LearnerInterestRegistryLegacyKey[];
};

export type LearnerInterestResolutionStatus =
  | 'NO_INTERESTS'
  | 'FULLY_MAPPED'
  | 'PARTIALLY_MAPPED'
  | 'UNMAPPED_INTERESTS';

export type LearnerInterestMatchSource =
  | 'CANONICAL_KEY'
  | 'LEGACY_BARE_KEY'
  | 'REVIEWED_ALIAS'
  | 'REVIEWED_LABEL';

export type LearnerInterestUnmappedReason =
  | 'INVALID_INPUT'
  | 'UNKNOWN_INTEREST'
  | 'CUSTOM_UNMAPPED'
  | 'AMBIGUOUS_MAPPING'
  | 'INACTIVE_TARGET'
  | 'WRONG_CONCEPT_TYPE';

export type LearnerInterestMappedInput = {
  rawInput: string;
  normalizedInput: string;
  canonicalKey: string;
  matchSource: LearnerInterestMatchSource;
};

export type LearnerInterestUnmappedInput = {
  rawInput: string;
  normalizedInput: string;
  reason: LearnerInterestUnmappedReason;
};

export type LearnerInterestResolution = {
  status: LearnerInterestResolutionStatus;
  inputCount: number;
  meaningfulInputCount: number;
  uniqueInputCount: number;
  mappedInputCount: number;
  unmappedInputCount: number;
  canonicalKeys: string[];
  mapped: LearnerInterestMappedInput[];
  unmapped: LearnerInterestUnmappedInput[];
};

type ConceptIndex = Map<string, LearnerInterestRegistryConcept[]>;

type CandidateResolution =
  | { status: 'MAPPED'; concept: LearnerInterestRegistryConcept }
  | { status: 'NO_MATCH' }
  | { status: 'UNMAPPED'; reason: LearnerInterestUnmappedReason };

const CUSTOM_INTEREST_PREFIX = 'custom:';

const appendCandidate = (
  index: ConceptIndex,
  key: string,
  concept: LearnerInterestRegistryConcept,
) => {
  const existing = index.get(key) ?? [];
  existing.push(concept);
  index.set(key, existing);
};

const uniqueConcepts = (
  candidates: readonly LearnerInterestRegistryConcept[],
) => [
  ...new Map(
    candidates
      .slice()
      .sort((left, right) =>
        left.canonicalKey.localeCompare(right.canonicalKey) ||
        left.id.localeCompare(right.id))
      .map((concept) => [concept.canonicalKey, concept]),
  ).values(),
];

const resolveCandidates = (
  candidates: readonly LearnerInterestRegistryConcept[],
): CandidateResolution => {
  const unique = uniqueConcepts(candidates);
  if (unique.length === 0) {
    return { status: 'NO_MATCH' };
  }

  const interests = unique.filter(({ conceptType }) => conceptType === 'INTEREST');
  if (interests.length > 1) {
    return { status: 'UNMAPPED', reason: 'AMBIGUOUS_MAPPING' };
  }
  if (interests.length === 1) {
    const concept = interests[0]!;
    return concept.status === 'ACTIVE'
      ? { status: 'MAPPED', concept }
      : { status: 'UNMAPPED', reason: 'INACTIVE_TARGET' };
  }

  return { status: 'UNMAPPED', reason: 'WRONG_CONCEPT_TYPE' };
};

const buildIndexes = (registry: readonly LearnerInterestRegistryConcept[]) => {
  const canonical = new Map<string, LearnerInterestRegistryConcept[]>();
  const legacy = new Map<string, LearnerInterestRegistryConcept[]>();
  const reviewedAlias = new Map<string, LearnerInterestRegistryConcept[]>();
  const reviewedLabel = new Map<string, LearnerInterestRegistryConcept[]>();

  for (const concept of registry) {
    appendCandidate(canonical, concept.canonicalKey, concept);
    for (const mapping of concept.learnerInterests) {
      appendCandidate(legacy, mapping.learnerInterestKey, concept);
    }
    for (const alias of concept.aliases) {
      if (!alias.isActive) {
        continue;
      }
      if (alias.source === TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT) {
        appendCandidate(reviewedAlias, alias.normalizedAlias, concept);
      } else if (
        alias.source === TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN ||
        alias.source === TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_AR
      ) {
        appendCandidate(reviewedLabel, alias.normalizedAlias, concept);
      }
    }
  }

  return { canonical, legacy, reviewedAlias, reviewedLabel };
};

const mappedInput = (
  rawInput: string,
  normalizedInput: string,
  source: LearnerInterestMatchSource,
  candidate: CandidateResolution,
): LearnerInterestMappedInput | null => {
  if (candidate.status !== 'MAPPED') {
    return null;
  }
  return {
    rawInput,
    normalizedInput,
    canonicalKey: candidate.concept.canonicalKey,
    matchSource: source,
  };
};

export const resolveLearnerInterests = (
  rawInterests: readonly string[] | null | undefined,
  registry: readonly LearnerInterestRegistryConcept[],
): LearnerInterestResolution => {
  const interests = rawInterests ?? [];
  const indexes = buildIndexes(registry);
  const mapped: LearnerInterestMappedInput[] = [];
  const unmapped: LearnerInterestUnmappedInput[] = [];
  const canonicalKeys: string[] = [];
  const emittedCanonicalKeys = new Set<string>();
  const uniqueInputs = new Set<string>();
  let meaningfulInputCount = 0;
  let meaningfulUnmappedCount = 0;

  const recordMapped = (value: LearnerInterestMappedInput) => {
    mapped.push(value);
    if (!emittedCanonicalKeys.has(value.canonicalKey)) {
      emittedCanonicalKeys.add(value.canonicalKey);
      canonicalKeys.push(value.canonicalKey);
    }
  };
  const recordUnmapped = (
    rawInput: string,
    normalizedInput: string,
    reason: LearnerInterestUnmappedReason,
    meaningful: boolean,
  ) => {
    unmapped.push({ rawInput, normalizedInput, reason });
    if (meaningful) {
      meaningfulUnmappedCount += 1;
    }
  };

  for (const rawInput of interests) {
    const trimmed = rawInput.trim();
    if (trimmed.length === 0) {
      recordUnmapped(rawInput, '', 'INVALID_INPUT', false);
      continue;
    }

    meaningfulInputCount += 1;
    const isCustom = trimmed.toLowerCase().startsWith(CUSTOM_INTEREST_PREFIX);
    const customSuffix = isCustom
      ? trimmed.slice(CUSTOM_INTEREST_PREFIX.length)
      : null;
    const normalized = normalizeTaxonomyAlias(customSuffix ?? trimmed);
    uniqueInputs.add(isCustom ? `custom:${normalized}` : `text:${normalized}`);

    if (normalized.length === 0) {
      recordUnmapped(rawInput, '', 'INVALID_INPUT', true);
      continue;
    }

    if (isCustom) {
      const aliasCandidate = resolveCandidates(indexes.reviewedAlias.get(normalized) ?? []);
      const resolved = mappedInput(
        rawInput,
        normalized,
        'REVIEWED_ALIAS',
        aliasCandidate,
      );
      if (resolved) {
        recordMapped(resolved);
      } else {
        recordUnmapped(
          rawInput,
          normalized,
          aliasCandidate.status === 'UNMAPPED'
            ? aliasCandidate.reason
            : 'CUSTOM_UNMAPPED',
          true,
        );
      }
      continue;
    }

    if (isValidTaxonomyCanonicalKey(trimmed)) {
      const candidate = resolveCandidates(indexes.canonical.get(trimmed) ?? []);
      const resolved = mappedInput(rawInput, trimmed, 'CANONICAL_KEY', candidate);
      if (resolved) {
        recordMapped(resolved);
        continue;
      }
      if (candidate.status === 'UNMAPPED') {
        recordUnmapped(
          rawInput,
          trimmed,
          candidate.reason,
          true,
        );
        continue;
      }
    }

    const legacyCandidate = resolveCandidates(indexes.legacy.get(trimmed) ?? []);
    const legacyResolved = mappedInput(
      rawInput,
      trimmed,
      'LEGACY_BARE_KEY',
      legacyCandidate,
    );
    if (legacyResolved) {
      recordMapped(legacyResolved);
      continue;
    }
    if (legacyCandidate.status === 'UNMAPPED') {
      recordUnmapped(rawInput, trimmed, legacyCandidate.reason, true);
      continue;
    }

    const aliasCandidate = resolveCandidates(indexes.reviewedAlias.get(normalized) ?? []);
    const aliasResolved = mappedInput(
      rawInput,
      normalized,
      'REVIEWED_ALIAS',
      aliasCandidate,
    );
    if (aliasResolved) {
      recordMapped(aliasResolved);
      continue;
    }
    if (
      aliasCandidate.status === 'UNMAPPED' &&
      aliasCandidate.reason !== 'WRONG_CONCEPT_TYPE'
    ) {
      recordUnmapped(rawInput, normalized, aliasCandidate.reason, true);
      continue;
    }

    const labelCandidate = resolveCandidates(indexes.reviewedLabel.get(normalized) ?? []);
    const labelResolved = mappedInput(
      rawInput,
      normalized,
      'REVIEWED_LABEL',
      labelCandidate,
    );
    if (labelResolved) {
      recordMapped(labelResolved);
      continue;
    }
    if (labelCandidate.status === 'UNMAPPED') {
      recordUnmapped(rawInput, normalized, labelCandidate.reason, true);
      continue;
    }
    if (aliasCandidate.status === 'UNMAPPED') {
      recordUnmapped(rawInput, normalized, aliasCandidate.reason, true);
      continue;
    }

    recordUnmapped(rawInput, normalized, 'UNKNOWN_INTEREST', true);
  }

  let status: LearnerInterestResolutionStatus;
  if (meaningfulInputCount === 0) {
    status = 'NO_INTERESTS';
  } else if (mapped.length === 0) {
    status = 'UNMAPPED_INTERESTS';
  } else if (meaningfulUnmappedCount > 0) {
    status = 'PARTIALLY_MAPPED';
  } else {
    status = 'FULLY_MAPPED';
  }

  return {
    status,
    inputCount: interests.length,
    meaningfulInputCount,
    uniqueInputCount: uniqueInputs.size,
    mappedInputCount: mapped.length,
    unmappedInputCount: unmapped.length,
    canonicalKeys,
    mapped,
    unmapped,
  };
};
