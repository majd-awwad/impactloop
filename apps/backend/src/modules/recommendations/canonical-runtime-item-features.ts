import type {
  MaterialCondition,
  ProjectDifficulty,
  TaxonomyConceptStatus,
  TaxonomyConceptType,
} from '../../generated/prisma/client.js';
import { asciiCompare } from './canonical-shadow-user-features.js';
import type { WeightedFeature } from './ml-lightfm-scorer.js';
import {
  loadRecommendationFeatureTokenContract,
  validatePortableFeatureRow,
  type PortableFeatureOccurrence,
  type RecommendationFeatureDomain,
  type RecommendationFeatureTokenContract,
} from './recommendation-feature-token-contract.js';

export type CanonicalConceptAssociationInput = {
  canonicalKey: string;
  conceptType: TaxonomyConceptType;
  status: TaxonomyConceptStatus;
  weight?: number;
};

export type CanonicalRuntimeFeatureAuthority = {
  contract: RecommendationFeatureTokenContract;
  taxonomyNamespaceByConceptType: ReadonlyMap<TaxonomyConceptType, string>;
  taxonomyConceptTypeByNamespace: ReadonlyMap<string, TaxonomyConceptType>;
};

export type CanonicalRuntimeFeatureBuildResult = {
  features: WeightedFeature[];
  scoringEligible: boolean;
  missingRequiredGroupIds: string[];
};

export class CanonicalRuntimeFeatureBuildError extends Error {
  constructor(
    readonly code:
      | 'CONTRACT_GROUP_MISSING'
      | 'CONTRACT_NAMESPACE_MISSING'
      | 'CONTRACT_VALUE_MAPPING_MISSING'
      | 'CANONICAL_KEY_MALFORMED'
      | 'CANONICAL_KEY_NAMESPACE_UNKNOWN',
    readonly details?: unknown,
  ) {
    super(`Canonical runtime feature build failed: ${code}`);
    this.name = 'CanonicalRuntimeFeatureBuildError';
  }
}

const portableGroup = (
  authority: CanonicalRuntimeFeatureAuthority,
  groupId: string,
) => {
  const group = authority.contract.featureGroups.find(
    (candidate) => candidate.id === groupId,
  );
  if (
    !group ||
    !group.portableRuntimeEligible ||
    group.namespaceId === null ||
    group.baseWeight === null
  ) {
    throw new CanonicalRuntimeFeatureBuildError('CONTRACT_GROUP_MISSING', groupId);
  }
  return group;
};

const namespace = (
  authority: CanonicalRuntimeFeatureAuthority,
  namespaceId: string,
) => {
  const value = authority.contract.namespaces.find(
    (candidate) => candidate.id === namespaceId,
  );
  if (!value) {
    throw new CanonicalRuntimeFeatureBuildError(
      'CONTRACT_NAMESPACE_MISSING',
      namespaceId,
    );
  }
  return value;
};

const canonicalTaxonomyToken = (
  canonicalKey: string,
  namespaceId: string,
): string => {
  const prefix = `${namespaceId}:`;
  if (!canonicalKey.startsWith(prefix)) {
    throw new CanonicalRuntimeFeatureBuildError('CANONICAL_KEY_MALFORMED', {
      canonicalKey,
      namespaceId,
    });
  }
  const suffix = canonicalKey.slice(prefix.length);
  if (suffix.length === 0 || suffix.includes(':')) {
    throw new CanonicalRuntimeFeatureBuildError('CANONICAL_KEY_MALFORMED', {
      canonicalKey,
      namespaceId,
    });
  }
  return `${namespaceId}:${suffix}`;
};

const closedToken = (
  authority: CanonicalRuntimeFeatureAuthority,
  namespaceId: string,
  sourceValue: string | boolean,
): string => {
  const definition = namespace(authority, namespaceId);
  if (definition.valueSource.kind === 'taxonomy') {
    throw new CanonicalRuntimeFeatureBuildError(
      'CONTRACT_VALUE_MAPPING_MISSING',
      { namespaceId, sourceValue },
    );
  }
  const mapping = definition.valueSource.values.find(
    (candidate) => candidate.sourceValue === sourceValue,
  );
  if (!mapping) {
    throw new CanonicalRuntimeFeatureBuildError(
      'CONTRACT_VALUE_MAPPING_MISSING',
      { namespaceId, sourceValue },
    );
  }
  return `${namespaceId}:${mapping.tokenValue}`;
};

const occurrence = (
  authority: CanonicalRuntimeFeatureAuthority,
  domain: RecommendationFeatureDomain,
  groupId: string,
  token: string,
  weight?: number,
): PortableFeatureOccurrence => {
  const group = portableGroup(authority, groupId);
  return {
    token,
    groupId,
    side: 'item',
    domain,
    weight: weight ?? group.baseWeight!,
  };
};

const finalize = (
  authority: CanonicalRuntimeFeatureAuthority,
  domain: RecommendationFeatureDomain,
  features: readonly PortableFeatureOccurrence[],
): CanonicalRuntimeFeatureBuildResult => {
  const validated = validatePortableFeatureRow(authority.contract, {
    side: 'item',
    domain,
    features,
  });
  return {
    features: validated.features
      .map(({ token, weight }) => [token, weight] as WeightedFeature)
      .sort(([left], [right]) => asciiCompare(left, right)),
    scoringEligible: validated.scoringEligible,
    missingRequiredGroupIds: [...validated.missingRequiredGroupIds].sort(
      asciiCompare,
    ),
  };
};

export const compileCanonicalRuntimeFeatureAuthority = (
  contract: RecommendationFeatureTokenContract,
): CanonicalRuntimeFeatureAuthority => {
  const taxonomyNamespaceByConceptType = new Map<
    TaxonomyConceptType,
    string
  >();
  const taxonomyConceptTypeByNamespace = new Map<
    string,
    TaxonomyConceptType
  >();
  for (const definition of contract.namespaces) {
    if (definition.valueSource.kind !== 'taxonomy') continue;
    const conceptType = definition.valueSource
      .conceptType as TaxonomyConceptType;
    taxonomyNamespaceByConceptType.set(conceptType, definition.id);
    taxonomyConceptTypeByNamespace.set(definition.id, conceptType);
  }
  return {
    contract,
    taxonomyNamespaceByConceptType,
    taxonomyConceptTypeByNamespace,
  };
};

let authorityPromise: Promise<CanonicalRuntimeFeatureAuthority> | undefined;

export const getCanonicalRuntimeFeatureAuthority = async () => {
  authorityPromise ??= loadRecommendationFeatureTokenContract().then(
    compileCanonicalRuntimeFeatureAuthority,
  );
  return authorityPromise;
};

export const canonicalConceptAssociationFromActiveKey = (
  authority: CanonicalRuntimeFeatureAuthority,
  canonicalKey: string,
): CanonicalConceptAssociationInput => {
  const separator = canonicalKey.indexOf(':');
  const namespaceId = separator < 0 ? canonicalKey : canonicalKey.slice(0, separator);
  const conceptType = authority.taxonomyConceptTypeByNamespace.get(namespaceId);
  if (!conceptType) {
    throw new CanonicalRuntimeFeatureBuildError(
      'CANONICAL_KEY_NAMESPACE_UNKNOWN',
      canonicalKey,
    );
  }
  return { canonicalKey, conceptType, status: 'ACTIVE' };
};

export const buildCanonicalMaterialRuntimeFeatures = (input: {
  authority: CanonicalRuntimeFeatureAuthority;
  concepts: readonly CanonicalConceptAssociationInput[];
  condition: MaterialCondition;
  isFree: boolean;
  pickupAllowed: boolean;
  deliveryAllowed: boolean;
}): CanonicalRuntimeFeatureBuildResult => {
  const features: PortableFeatureOccurrence[] = [];
  for (const concept of input.concepts) {
    if (concept.status !== 'ACTIVE') continue;
    const groupId =
      concept.conceptType === 'MATERIAL_FAMILY'
        ? 'material.family'
        : concept.conceptType === 'MATERIAL_FORM'
          ? 'material.form'
          : undefined;
    if (!groupId) continue;
    const group = portableGroup(input.authority, groupId);
    features.push(
      occurrence(
        input.authority,
        'material',
        groupId,
        canonicalTaxonomyToken(concept.canonicalKey, group.namespaceId!),
        concept.weight,
      ),
    );
  }

  features.push(
    occurrence(
      input.authority,
      'material',
      'material.condition',
      closedToken(input.authority, 'material-condition', input.condition),
    ),
    occurrence(
      input.authority,
      'material',
      'material.is-free',
      closedToken(input.authority, 'material-is-free', input.isFree),
    ),
    occurrence(
      input.authority,
      'material',
      'material.pickup-allowed',
      closedToken(
        input.authority,
        'material-pickup-allowed',
        input.pickupAllowed,
      ),
    ),
    occurrence(
      input.authority,
      'material',
      'material.delivery-allowed',
      closedToken(
        input.authority,
        'material-delivery-allowed',
        input.deliveryAllowed,
      ),
    ),
  );
  return finalize(input.authority, 'material', features);
};

export const buildCanonicalProjectRuntimeFeatures = (input: {
  authority: CanonicalRuntimeFeatureAuthority;
  topicConcepts: readonly CanonicalConceptAssociationInput[];
  componentConcepts: readonly (CanonicalConceptAssociationInput & {
    isRequired: boolean;
  })[];
  difficulty: ProjectDifficulty;
}): CanonicalRuntimeFeatureBuildResult => {
  const features: PortableFeatureOccurrence[] = [];
  for (const concept of input.topicConcepts) {
    if (concept.status !== 'ACTIVE' || concept.conceptType !== 'PROJECT_TOPIC') {
      continue;
    }
    const group = portableGroup(input.authority, 'project.topic');
    features.push(
      occurrence(
        input.authority,
        'project',
        'project.topic',
        canonicalTaxonomyToken(concept.canonicalKey, group.namespaceId!),
        concept.weight,
      ),
    );
  }
  for (const concept of input.componentConcepts) {
    if (
      !concept.isRequired ||
      concept.status !== 'ACTIVE' ||
      concept.conceptType !== 'COMPONENT'
    ) {
      continue;
    }
    const group = portableGroup(input.authority, 'project.required-component');
    features.push(
      occurrence(
        input.authority,
        'project',
        'project.required-component',
        canonicalTaxonomyToken(concept.canonicalKey, group.namespaceId!),
        concept.weight,
      ),
    );
  }
  features.push(
    occurrence(
      input.authority,
      'project',
      'project.difficulty',
      closedToken(input.authority, 'project-difficulty', input.difficulty),
    ),
  );
  return finalize(input.authority, 'project', features);
};
