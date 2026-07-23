import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import {
  MaterialCondition,
  ProjectDifficulty,
} from '../../generated/prisma/client.js';
import {
  TAXONOMY_CONCEPT_SEEDS,
  type TaxonomyConceptSeed,
} from '../taxonomy/taxonomy-foundation.data.js';

const CONTRACT_RELATIVE_URL =
  '../../../../../contracts/recommendation/recommendation-feature-token-contract-v3.json';

const domainSchema = z.enum(['material', 'project']);
const featureSideSchema = z.enum(['user', 'item']);
const taxonomyValueSourceSchema = z
  .object({
    kind: z.literal('taxonomy'),
    conceptType: z.string().min(1),
  })
  .strict();
const enumValueSourceSchema = z
  .object({
    kind: z.literal('enum'),
    enumName: z.string().min(1),
    values: z
      .array(
        z
          .object({
            sourceValue: z.string().min(1),
            tokenValue: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
const booleanValueSourceSchema = z
  .object({
    kind: z.literal('boolean'),
    values: z
      .array(
        z
          .object({
            sourceValue: z.boolean(),
            tokenValue: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
const valueSourceSchema = z.discriminatedUnion('kind', [
  taxonomyValueSourceSchema,
  enumValueSourceSchema,
  booleanValueSourceSchema,
]);

const namespaceSchema = z
  .object({
    id: z.string().min(1),
    tokenPattern: z.string().min(1),
    valueSource: valueSourceSchema,
  })
  .strict();

const cardinalitySchema = z
  .object({
    minimum: z.number().int().nonnegative().nullable(),
    maximum: z.number().int().nonnegative().nullable(),
  })
  .strict();

const featureGroupSchema = z
  .object({
    id: z.string().min(1),
    side: featureSideSchema,
    domains: z.array(domainSchema).min(1),
    namespaceId: z.string().min(1).nullable(),
    cardinality: cardinalitySchema,
    requiredForScoring: z.boolean(),
    baseWeight: z.number().finite().nonnegative().nullable(),
    portableRuntimeEligible: z.boolean(),
    trainingSupport: z.enum([
      'SUPPORTED',
      'NOT_SUPPORTED',
      'WARM_EXPERIMENT_ONLY',
      'SYNTHETIC_EXPERIMENT_ONLY',
    ]),
    classification: z.enum([
      'SUPPORTED',
      'TRAINING_ONLY',
      'DEFERRED',
      'PROHIBITED',
    ]),
  })
  .strict();

const featureExampleSchema = z
  .object({
    token: z.string().min(1),
    groupId: z.string().min(1),
    side: featureSideSchema,
    domain: domainSchema,
    weight: z.number(),
  })
  .strict();

const invalidFeatureExampleSchema = featureExampleSchema.extend({
  reason: z.string().min(1),
});

const contractDocumentSchema = z
  .object({
    contractId: z.string().min(1),
    contractVersion: z.string().regex(/^\d+\.\d+\.\d+$/u),
    status: z
      .object({
        lifecycle: z.enum(['SPECIFICATION_ONLY']),
        runtimeActivation: z.enum(['INACTIVE']),
        aggregationBlocked: z.boolean(),
      })
      .strict(),
    supportedDomains: z.array(domainSchema).min(1),
    tokenGrammarVersion: z.string().min(1),
    taxonomyCompatibility: z
      .object({
        sourceId: z.string().min(1),
        sourceModule: z.string().min(1),
        membershipMode: z.enum(['EXACT_CANONICAL_KEY_AND_CONCEPT_TYPE']),
        fingerprintAlgorithm: z.enum(['SHA-256']),
        fingerprintSerialization: z.string().min(1),
        taxonomyVocabularyFingerprint: z.string().regex(/^[0-9a-f]{64}$/u),
      })
      .strict(),
    normalization: z
      .object({
        inputAliasResolution: z.enum(['OUTSIDE_CONTRACT_UNICODE_SAFE']),
        canonicalTokenIdentity: z.enum(['EXACT_AFTER_RESOLUTION']),
        vectorAggregation: z.enum(['CONTRACT_SELECTED_AFTER_VALIDATION']),
      })
      .strict(),
    namespaces: z.array(namespaceSchema).min(1),
    featureGroups: z.array(featureGroupSchema).min(1),
    weighting: z
      .object({
        portableBaseWeight: z.number().finite().nonnegative(),
        duplicateMode: z.enum(['SET_DEDUPLICATE']),
        conflictingDuplicateWeight: z.enum(['REJECT']),
        nonFiniteWeight: z.enum(['REJECT']),
        negativeWeight: z.enum(['REJECT']),
        declaredInterestWeighting: z.enum(['UNIFORM']),
      })
      .strict(),
    aggregation: z
      .object({
        status: z.enum(['PENDING_CONTROLLED_EXPERIMENT', 'SELECTED']),
        selectedMode: z
          .enum(['weighted-sum', 'weighted-mean', 'l1', 'l2'])
          .nullable(),
        candidateModes: z
          .array(z.enum(['weighted-sum', 'weighted-mean', 'l1', 'l2']))
          .min(1),
        scope: z.string().min(1),
        portableActivationAllowed: z.boolean(),
      })
      .strict(),
    unknownAndUnsupportedPolicy: z
      .object({
        unknownNamespace: z.enum(['REJECT']),
        unknownCanonicalTaxonomyKey: z.enum(['REJECT']),
        unknownClosedValue: z.enum(['REJECT']),
        unresolvedHumanInput: z.enum(['OUTSIDE_CONTRACT']),
        missingRequiredGroup: z.enum(['INELIGIBLE_FOR_PORTABLE_SCORING']),
        unsupportedPortableGroup: z.enum(['REJECT']),
        localizedLabelAsIdentity: z.enum(['REJECT']),
        generatedIdOrHashAsSemanticIdentity: z.enum(['REJECT']),
      })
      .strict(),
    deprecationPolicy: z
      .object({
        mode: z.enum(['REJECT_NO_AUTOMATIC_REWRITE']),
        deprecatedTokens: z.array(z.string()),
      })
      .strict(),
    legacyCompatibility: z
      .object({
        v3AcceptsLegacyArtifacts: z.boolean(),
        historicalArtifactVersions: z.array(z.string().min(1)),
        historicalFeatureSchemaVersions: z.array(z.string().min(1)),
        rejectedTokenPrefixes: z.array(z.string().min(1)),
      })
      .strict(),
    validExamples: z.array(featureExampleSchema).min(1),
    invalidExamples: z.array(invalidFeatureExampleSchema).min(1),
  })
  .strict();

export type RecommendationFeatureTokenContract = z.infer<
  typeof contractDocumentSchema
>;
export type RecommendationFeatureDomain = z.infer<typeof domainSchema>;
export type RecommendationFeatureSide = z.infer<typeof featureSideSchema>;
export type PortableFeatureOccurrence = z.infer<typeof featureExampleSchema>;

export type ContractValidationPhase = 'STRUCTURAL' | 'SEMANTIC';

export class RecommendationFeatureTokenContractValidationError extends Error {
  readonly phase: ContractValidationPhase;
  readonly details?: unknown;

  constructor(
    phase: ContractValidationPhase,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'RecommendationFeatureTokenContractValidationError';
    this.phase = phase;
    this.details = details;
  }
}

export type ContractLoadErrorCode =
  | 'CONTRACT_LOAD_INVALID_SOURCE'
  | 'CONTRACT_LOAD_MISSING'
  | 'CONTRACT_LOAD_UNREADABLE'
  | 'CONTRACT_LOAD_MALFORMED_JSON'
  | 'CONTRACT_LOAD_STRUCTURALLY_INVALID'
  | 'CONTRACT_LOAD_SEMANTICALLY_INVALID';

export class RecommendationFeatureTokenContractLoadError extends Error {
  readonly code: ContractLoadErrorCode;

  constructor(code: ContractLoadErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'RecommendationFeatureTokenContractLoadError';
    this.code = code;
  }
}

const semanticError = (message: string, details?: unknown): never => {
  throw new RecommendationFeatureTokenContractValidationError(
    'SEMANTIC',
    message,
    details,
  );
};

const assertUnique = (values: readonly string[], label: string): void => {
  const duplicates = values.filter(
    (value, index) => values.indexOf(value) !== index,
  );
  if (duplicates.length > 0) {
    semanticError(`${label}_duplicate`, [...new Set(duplicates)]);
  }
};

const asciiCompare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export const computeTaxonomyVocabularyFingerprint = (
  seeds: readonly TaxonomyConceptSeed[] = TAXONOMY_CONCEPT_SEEDS,
): string => {
  const serialized = [...seeds]
    .sort((left, right) => asciiCompare(left.canonicalKey, right.canonicalKey))
    .map((seed) => `${seed.conceptType}\t${seed.canonicalKey}`)
    .join('\n');

  return createHash('sha256').update(serialized, 'utf8').digest('hex');
};

const enumSources: Readonly<Record<string, readonly string[]>> = Object.freeze({
  MaterialCondition: Object.freeze(Object.values(MaterialCondition)),
  ProjectDifficulty: Object.freeze(Object.values(ProjectDifficulty)),
});

const validateNamespaceValueSources = (
  contract: RecommendationFeatureTokenContract,
): void => {
  const taxonomyTypesInFoundation = new Set<string>(
    TAXONOMY_CONCEPT_SEEDS.map((seed) => seed.conceptType),
  );
  const taxonomyTypesInContract = new Set<string>();

  for (const namespace of contract.namespaces) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(namespace.tokenPattern, 'u');
    } catch (error) {
      semanticError('namespace_token_pattern_invalid', {
        namespaceId: namespace.id,
        error,
      });
    }

    if (namespace.valueSource.kind === 'taxonomy') {
      const { conceptType } = namespace.valueSource;
      if (!taxonomyTypesInFoundation.has(conceptType)) {
        semanticError('taxonomy_concept_type_unknown', {
          namespaceId: namespace.id,
          conceptType,
        });
      }
      if (taxonomyTypesInContract.has(conceptType)) {
        semanticError('taxonomy_concept_type_duplicate', conceptType);
      }
      taxonomyTypesInContract.add(conceptType);

      const concepts = TAXONOMY_CONCEPT_SEEDS.filter(
        (seed) => seed.conceptType === conceptType,
      );
      if (
        concepts.length === 0 ||
        concepts.some(
          (seed) =>
            !seed.canonicalKey.startsWith(`${namespace.id}:`) ||
            !pattern.test(seed.canonicalKey),
        )
      ) {
        semanticError('taxonomy_namespace_does_not_match_foundation', {
          namespaceId: namespace.id,
          conceptType,
        });
      }
      continue;
    }

    const fullTokens = namespace.valueSource.values.map(
      (value) => `${namespace.id}:${value.tokenValue}`,
    );
    assertUnique(fullTokens, `${namespace.id}_token_value`);
    if (fullTokens.some((token) => !pattern.test(token))) {
      semanticError('closed_value_does_not_match_namespace_pattern', {
        namespaceId: namespace.id,
      });
    }

    if (namespace.valueSource.kind === 'enum') {
      const source = enumSources[namespace.valueSource.enumName];
      if (!source) {
        semanticError('enum_source_unknown', namespace.valueSource.enumName);
      }
      const declared = namespace.valueSource.values.map(
        (value) => value.sourceValue,
      );
      assertUnique(declared, `${namespace.id}_enum_source_value`);
      if (
        [...source].sort(asciiCompare).join('\n') !==
        [...declared].sort(asciiCompare).join('\n')
      ) {
        semanticError('enum_source_incomplete', {
          namespaceId: namespace.id,
          expected: source,
          declared,
        });
      }
      continue;
    }

    const declaredBooleans = namespace.valueSource.values.map(
      (value) => value.sourceValue,
    );
    if (
      declaredBooleans.length !== 2 ||
      !declaredBooleans.includes(true) ||
      !declaredBooleans.includes(false)
    ) {
      semanticError('boolean_source_incomplete', namespace.id);
    }
    for (const value of namespace.valueSource.values) {
      if (value.tokenValue !== String(value.sourceValue)) {
        semanticError('boolean_token_value_not_literal', {
          namespaceId: namespace.id,
          value,
        });
      }
    }
  }

  const foundationTypes = [...taxonomyTypesInFoundation].sort(asciiCompare);
  const contractTypes = [...taxonomyTypesInContract].sort(asciiCompare);
  if (foundationTypes.join('\n') !== contractTypes.join('\n')) {
    semanticError('taxonomy_concept_type_coverage_incomplete', {
      foundationTypes,
      contractTypes,
    });
  }
};

const validateFeatureGroups = (
  contract: RecommendationFeatureTokenContract,
): void => {
  const namespaceIds = new Set(
    contract.namespaces.map((namespace) => namespace.id),
  );
  const supportedDomains = new Set(contract.supportedDomains);
  const referencedNamespaces = new Set<string>();

  for (const group of contract.featureGroups) {
    assertUnique(group.domains, `${group.id}_domain`);
    if (group.domains.some((domain) => !supportedDomains.has(domain))) {
      semanticError('feature_group_domain_unsupported', group.id);
    }
    if (
      group.cardinality.minimum !== null &&
      group.cardinality.maximum !== null &&
      group.cardinality.minimum > group.cardinality.maximum
    ) {
      semanticError('feature_group_cardinality_invalid', group.id);
    }
    if (
      group.requiredForScoring &&
      (group.cardinality.minimum === null || group.cardinality.minimum < 1)
    ) {
      semanticError('required_feature_group_has_no_minimum', group.id);
    }

    if (group.namespaceId !== null) {
      if (!namespaceIds.has(group.namespaceId)) {
        semanticError('feature_group_namespace_unknown', group.id);
      }
      referencedNamespaces.add(group.namespaceId);
    }

    if (group.portableRuntimeEligible) {
      if (
        group.classification !== 'SUPPORTED' ||
        group.trainingSupport !== 'SUPPORTED' ||
        group.namespaceId === null ||
        group.baseWeight !== contract.weighting.portableBaseWeight
      ) {
        semanticError('portable_feature_group_policy_invalid', group.id);
      }
    } else if (group.namespaceId !== null || group.baseWeight !== null) {
      semanticError('non_portable_group_defines_portable_token', group.id);
    }

    if (
      group.classification === 'TRAINING_ONLY' &&
      group.portableRuntimeEligible
    ) {
      semanticError('training_only_group_marked_portable', group.id);
    }
    if (
      group.classification === 'DEFERRED' &&
      group.trainingSupport !== 'NOT_SUPPORTED'
    ) {
      semanticError('deferred_group_marked_training_supported', group.id);
    }
  }

  const unreferenced = [...namespaceIds].filter(
    (namespaceId) => !referencedNamespaces.has(namespaceId),
  );
  if (unreferenced.length > 0) {
    semanticError('namespace_unreferenced', unreferenced);
  }
};

const taxonomySeedByKey = new Map(
  TAXONOMY_CONCEPT_SEEDS.map((seed) => [seed.canonicalKey, seed]),
);

const validateOccurrenceInternal = (
  contract: RecommendationFeatureTokenContract,
  occurrence: PortableFeatureOccurrence,
): PortableFeatureOccurrence => {
  const group = contract.featureGroups.find(
    (candidate) => candidate.id === occurrence.groupId,
  );
  if (!group) return semanticError('feature_group_unknown', occurrence.groupId);
  if (
    !group.portableRuntimeEligible ||
    group.namespaceId === null ||
    group.baseWeight === null
  ) {
    semanticError('feature_group_not_portable', occurrence.groupId);
  }
  if (
    group.side !== occurrence.side ||
    !group.domains.includes(occurrence.domain)
  ) {
    semanticError('feature_occurrence_context_mismatch', occurrence);
  }
  if (
    !Number.isFinite(occurrence.weight) ||
    occurrence.weight < 0 ||
    occurrence.weight !== group.baseWeight ||
    occurrence.weight !== contract.weighting.portableBaseWeight
  ) {
    semanticError('feature_occurrence_weight_invalid', occurrence);
  }

  const namespace = contract.namespaces.find(
    (candidate) => candidate.id === group.namespaceId,
  );
  if (!namespace) {
    return semanticError('feature_namespace_missing', group.namespaceId);
  }
  if (!new RegExp(namespace.tokenPattern, 'u').test(occurrence.token)) {
    semanticError('feature_token_grammar_invalid', occurrence.token);
  }

  if (namespace.valueSource.kind === 'taxonomy') {
    const seed = taxonomySeedByKey.get(occurrence.token);
    if (!seed || seed.conceptType !== namespace.valueSource.conceptType) {
      semanticError('feature_token_taxonomy_membership_invalid', occurrence.token);
    }
    return occurrence;
  }

  const acceptedTokens = new Set(
    namespace.valueSource.values.map(
      (value) => `${namespace.id}:${value.tokenValue}`,
    ),
  );
  if (!acceptedTokens.has(occurrence.token)) {
    semanticError('feature_token_closed_value_invalid', occurrence.token);
  }
  return occurrence;
};

const validateExamples = (
  contract: RecommendationFeatureTokenContract,
): void => {
  const coveredGroups = new Set<string>();
  for (const example of contract.validExamples) {
    validateOccurrenceInternal(contract, example);
    coveredGroups.add(example.groupId);
  }

  const uncoveredPortableGroups = contract.featureGroups
    .filter(
      (group) => group.portableRuntimeEligible && !coveredGroups.has(group.id),
    )
    .map((group) => group.id);
  if (uncoveredPortableGroups.length > 0) {
    semanticError('portable_feature_group_has_no_valid_example', uncoveredPortableGroups);
  }

  for (const namespace of contract.namespaces) {
    if (namespace.valueSource.kind === 'taxonomy') continue;
    const expected = new Set(
      namespace.valueSource.values.map(
        (value) => `${namespace.id}:${value.tokenValue}`,
      ),
    );
    for (const example of contract.validExamples) expected.delete(example.token);
    if (expected.size > 0) {
      semanticError('closed_value_has_no_valid_example', {
        namespaceId: namespace.id,
        tokens: [...expected],
      });
    }
  }

  for (const example of contract.invalidExamples) {
    try {
      validateOccurrenceInternal(contract, example);
    } catch (error) {
      if (error instanceof RecommendationFeatureTokenContractValidationError) {
        continue;
      }
      throw error;
    }
    semanticError('invalid_example_was_accepted', example.token);
  }
};

const validateSemanticContract = (
  contract: RecommendationFeatureTokenContract,
): RecommendationFeatureTokenContract => {
  if (
    contract.contractId !== 'recommendation-feature-token-contract-v3' ||
    contract.contractVersion !== '3.0.0'
  ) {
    semanticError('contract_identity_invalid');
  }

  assertUnique(contract.supportedDomains, 'supported_domain');
  assertUnique(
    contract.namespaces.map((namespace) => namespace.id),
    'namespace_id',
  );
  assertUnique(
    contract.featureGroups.map((group) => group.id),
    'feature_group_id',
  );
  assertUnique(contract.aggregation.candidateModes, 'aggregation_candidate_mode');
  assertUnique(
    contract.legacyCompatibility.rejectedTokenPrefixes,
    'legacy_rejected_token_prefix',
  );

  if (
    contract.taxonomyCompatibility.taxonomyVocabularyFingerprint !==
    computeTaxonomyVocabularyFingerprint()
  ) {
    semanticError('taxonomy_vocabulary_fingerprint_mismatch');
  }
  if (
    contract.aggregation.status === 'PENDING_CONTROLLED_EXPERIMENT' &&
    (contract.aggregation.selectedMode !== null ||
      contract.aggregation.portableActivationAllowed ||
      !contract.status.aggregationBlocked)
  ) {
    semanticError('pending_aggregation_policy_invalid');
  }
  if (
    contract.aggregation.status === 'SELECTED' &&
    (contract.aggregation.selectedMode === null ||
      !contract.aggregation.candidateModes.includes(
        contract.aggregation.selectedMode,
      ))
  ) {
    semanticError('selected_aggregation_policy_invalid');
  }
  if (contract.legacyCompatibility.v3AcceptsLegacyArtifacts) {
    semanticError('legacy_artifacts_must_not_be_v3_compatible');
  }

  validateNamespaceValueSources(contract);
  validateFeatureGroups(contract);
  validateExamples(contract);
  return contract;
};

export const parseRecommendationFeatureTokenContract = (
  raw: unknown,
): RecommendationFeatureTokenContract => {
  const parsed = contractDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RecommendationFeatureTokenContractValidationError(
      'STRUCTURAL',
      'contract_structure_invalid',
      parsed.error.issues,
    );
  }
  return validateSemanticContract(parsed.data);
};

export const resolveRecommendationFeatureTokenContractUrl = (
  moduleUrl: string | URL = import.meta.url,
): URL => new URL(CONTRACT_RELATIVE_URL, moduleUrl);

const normalizeExplicitSource = (source: string | URL): URL => {
  if (source instanceof URL) {
    if (source.protocol !== 'file:') {
      throw new RecommendationFeatureTokenContractLoadError(
        'CONTRACT_LOAD_INVALID_SOURCE',
        'Contract source URL must use the file protocol.',
      );
    }
    return source;
  }
  if (!isAbsolute(source)) {
    throw new RecommendationFeatureTokenContractLoadError(
      'CONTRACT_LOAD_INVALID_SOURCE',
      'Contract source path must be absolute.',
    );
  }
  return pathToFileURL(source);
};

export const loadRecommendationFeatureTokenContract = async (
  source?: string | URL,
): Promise<RecommendationFeatureTokenContract> => {
  const contractUrl =
    source === undefined
      ? resolveRecommendationFeatureTokenContractUrl()
      : normalizeExplicitSource(source);

  let contents: string;
  try {
    contents = await readFile(contractUrl, 'utf8');
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : undefined;
    if (code === 'ENOENT') {
      throw new RecommendationFeatureTokenContractLoadError(
        'CONTRACT_LOAD_MISSING',
        `Recommendation feature-token contract is missing: ${contractUrl.href}`,
        error,
      );
    }
    throw new RecommendationFeatureTokenContractLoadError(
      'CONTRACT_LOAD_UNREADABLE',
      `Recommendation feature-token contract is unreadable: ${contractUrl.href}`,
      error,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(contents) as unknown;
  } catch (error) {
    throw new RecommendationFeatureTokenContractLoadError(
      'CONTRACT_LOAD_MALFORMED_JSON',
      `Recommendation feature-token contract contains malformed JSON: ${contractUrl.href}`,
      error,
    );
  }

  try {
    return parseRecommendationFeatureTokenContract(raw);
  } catch (error) {
    if (error instanceof RecommendationFeatureTokenContractValidationError) {
      throw new RecommendationFeatureTokenContractLoadError(
        error.phase === 'STRUCTURAL'
          ? 'CONTRACT_LOAD_STRUCTURALLY_INVALID'
          : 'CONTRACT_LOAD_SEMANTICALLY_INVALID',
        `Recommendation feature-token contract is ${error.phase.toLowerCase()}ly invalid: ${contractUrl.href}`,
        error,
      );
    }
    throw error;
  }
};

export const validateCanonicalFeatureToken = (
  contract: RecommendationFeatureTokenContract,
  occurrence: PortableFeatureOccurrence,
): PortableFeatureOccurrence => {
  const parsed = featureExampleSchema.safeParse(occurrence);
  if (!parsed.success) {
    throw new RecommendationFeatureTokenContractValidationError(
      'STRUCTURAL',
      'feature_occurrence_structure_invalid',
      parsed.error.issues,
    );
  }
  return validateOccurrenceInternal(contract, parsed.data);
};

export type PortableFeatureRowValidation = {
  features: PortableFeatureOccurrence[];
  scoringEligible: boolean;
  missingRequiredGroupIds: string[];
};

export const validatePortableFeatureRow = (
  contract: RecommendationFeatureTokenContract,
  context: {
    side: RecommendationFeatureSide;
    domain: RecommendationFeatureDomain;
    features: readonly PortableFeatureOccurrence[];
  },
): PortableFeatureRowValidation => {
  const deduplicated = new Map<string, PortableFeatureOccurrence>();
  const groupCounts = new Map<string, number>();

  for (const rawOccurrence of context.features) {
    if (
      rawOccurrence.side !== context.side ||
      rawOccurrence.domain !== context.domain
    ) {
      semanticError('feature_row_context_mismatch', rawOccurrence);
    }
    const occurrence = validateCanonicalFeatureToken(contract, rawOccurrence);
    const key = `${occurrence.groupId}\t${occurrence.token}`;
    const existing = deduplicated.get(key);
    if (existing) {
      if (existing.weight !== occurrence.weight) {
        semanticError('feature_duplicate_weight_conflict', occurrence);
      }
      continue;
    }
    deduplicated.set(key, occurrence);
    groupCounts.set(
      occurrence.groupId,
      (groupCounts.get(occurrence.groupId) ?? 0) + 1,
    );
  }

  const applicableGroups = contract.featureGroups.filter(
    (group) =>
      group.portableRuntimeEligible &&
      group.side === context.side &&
      group.domains.includes(context.domain),
  );
  const missingRequiredGroupIds: string[] = [];
  for (const group of applicableGroups) {
    const count = groupCounts.get(group.id) ?? 0;
    if (
      group.cardinality.maximum !== null &&
      count > group.cardinality.maximum
    ) {
      semanticError('feature_group_cardinality_exceeded', {
        groupId: group.id,
        count,
      });
    }
    if (
      group.requiredForScoring &&
      group.cardinality.minimum !== null &&
      count < group.cardinality.minimum
    ) {
      missingRequiredGroupIds.push(group.id);
    }
  }

  return {
    features: [...deduplicated.values()],
    scoringEligible: missingRequiredGroupIds.length === 0,
    missingRequiredGroupIds,
  };
};
