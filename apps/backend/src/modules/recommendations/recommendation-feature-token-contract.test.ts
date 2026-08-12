import assert from 'node:assert/strict';
import { readFile, rm, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TAXONOMY_CONCEPT_SEEDS } from '../taxonomy/taxonomy-foundation.data.js';
import { normalizeTaxonomyAlias } from '../taxonomy/taxonomy-normalization.js';
import {
  RecommendationFeatureTokenContractLoadError,
  RecommendationFeatureTokenContractValidationError,
  computeTaxonomyVocabularyFingerprint,
  loadRecommendationFeatureTokenContract,
  parseRecommendationFeatureTokenContract,
  resolveRecommendationFeatureTokenContractUrl,
  validateCanonicalFeatureToken,
  validatePortableFeatureRow,
  type ContractLoadErrorCode,
  type PortableFeatureOccurrence,
  type RecommendationFeatureTokenContract,
} from './recommendation-feature-token-contract.js';

const loadErrorCode = async (
  promise: Promise<unknown>,
  expected: ContractLoadErrorCode,
): Promise<void> => {
  await assert.rejects(promise, (error: unknown) => {
    if (!(error instanceof RecommendationFeatureTokenContractLoadError)) {
      return false;
    }
    assert.equal(error.code, expected);
    return true;
  });
};

test('loads the authoritative contract explicitly and by source-relative default', async () => {
  const defaultUrl = resolveRecommendationFeatureTokenContractUrl();
  const byDefault = await loadRecommendationFeatureTokenContract();
  const byUrl = await loadRecommendationFeatureTokenContract(defaultUrl);
  const byAbsolutePath = await loadRecommendationFeatureTokenContract(
    fileURLToPath(defaultUrl),
  );

  assert.equal(byDefault.contractId, 'recommendation-feature-token-contract-v3');
  assert.equal(byDefault.contractVersion, '3.0.0');
  assert.deepEqual(byUrl, byDefault);
  assert.deepEqual(byAbsolutePath, byDefault);
  assert.equal(byDefault.status.runtimeActivation, 'INACTIVE');
  assert.equal(byDefault.aggregation.selectedMode, null);
  assert.equal(byDefault.aggregation.portableActivationAllowed, false);
});

test('default URL has the same repository-relative result from src and dist layouts', () => {
  const sourceModuleUrl = new URL(
    './recommendation-feature-token-contract.js',
    import.meta.url,
  );
  const distModuleUrl = new URL(
    sourceModuleUrl.href.replace('/src/', '/dist/'),
  );

  assert.equal(
    resolveRecommendationFeatureTokenContractUrl(sourceModuleUrl).href,
    resolveRecommendationFeatureTokenContractUrl(distModuleUrl).href,
  );
});

test('loader rejects relative, missing, unreadable, malformed, structural, and semantic sources', async () => {
  await loadErrorCode(
    loadRecommendationFeatureTokenContract('relative/contract.json'),
    'CONTRACT_LOAD_INVALID_SOURCE',
  );

  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'impactloop-feature-contract-'),
  );
  try {
    await loadErrorCode(
      loadRecommendationFeatureTokenContract(
        join(temporaryDirectory, 'missing.json'),
      ),
      'CONTRACT_LOAD_MISSING',
    );
    await loadErrorCode(
      loadRecommendationFeatureTokenContract(temporaryDirectory),
      'CONTRACT_LOAD_UNREADABLE',
    );

    const malformedPath = join(temporaryDirectory, 'malformed.json');
    await writeFile(malformedPath, '{', 'utf8');
    await loadErrorCode(
      loadRecommendationFeatureTokenContract(malformedPath),
      'CONTRACT_LOAD_MALFORMED_JSON',
    );

    const structuralPath = join(temporaryDirectory, 'structural.json');
    await writeFile(structuralPath, '{}', 'utf8');
    await loadErrorCode(
      loadRecommendationFeatureTokenContract(structuralPath),
      'CONTRACT_LOAD_STRUCTURALLY_INVALID',
    );

    const contractUrl = resolveRecommendationFeatureTokenContractUrl();
    const semantic = JSON.parse(
      await readFile(contractUrl, 'utf8'),
    ) as RecommendationFeatureTokenContract;
    semantic.taxonomyCompatibility.taxonomyVocabularyFingerprint = '0'.repeat(64);
    const semanticPath = join(temporaryDirectory, 'semantic.json');
    await writeFile(semanticPath, JSON.stringify(semantic), 'utf8');
    await loadErrorCode(
      loadRecommendationFeatureTokenContract(pathToFileURL(semanticPath)),
      'CONTRACT_LOAD_SEMANTICALLY_INVALID',
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('taxonomy vocabulary fingerprint covers only concept type and canonical key', () => {
  assert.equal(
    computeTaxonomyVocabularyFingerprint(),
    '14b855de18511235289cf33e4704693bd5d3887cb6e066d6abcd2a00ef08ed83',
  );

  const labelAndAliasOnlyChange = TAXONOMY_CONCEPT_SEEDS.map((seed, index) =>
    index === 0
      ? {
          ...seed,
          labelEn: 'Changed display label',
          labelAr: 'تسمية معدلة',
          aliases: [],
          mappingRules: [],
        }
      : seed,
  );
  assert.equal(
    computeTaxonomyVocabularyFingerprint(labelAndAliasOnlyChange),
    computeTaxonomyVocabularyFingerprint(),
  );

  const canonicalKeyChange = TAXONOMY_CONCEPT_SEEDS.map((seed, index) =>
    index === 0 ? { ...seed, canonicalKey: 'interest:changed-key' } : seed,
  );
  assert.notEqual(
    computeTaxonomyVocabularyFingerprint(canonicalKeyChange),
    computeTaxonomyVocabularyFingerprint(),
  );
});

test('contract derives complete enum and boolean vocabularies from JSON', async () => {
  const contract = await loadRecommendationFeatureTokenContract();
  const condition = contract.namespaces.find(
    (namespace) => namespace.id === 'material-condition',
  );
  const difficulty = contract.namespaces.find(
    (namespace) => namespace.id === 'project-difficulty',
  );
  assert.equal(condition?.valueSource.kind, 'enum');
  assert.equal(difficulty?.valueSource.kind, 'enum');
  if (condition?.valueSource.kind === 'enum') {
    assert.deepEqual(
      condition.valueSource.values.map((value) => value.sourceValue).sort(),
      ['GOOD', 'LIKE_NEW', 'NEEDS_REPAIR', 'NEW', 'USED'],
    );
  }
  if (difficulty?.valueSource.kind === 'enum') {
    assert.deepEqual(
      difficulty.valueSource.values.map((value) => value.sourceValue).sort(),
      ['ADVANCED', 'BEGINNER', 'INTERMEDIATE'],
    );
  }

  for (const namespace of contract.namespaces.filter(
    (candidate) => candidate.valueSource.kind === 'boolean',
  )) {
    assert.equal(namespace.valueSource.kind, 'boolean');
    if (namespace.valueSource.kind === 'boolean') {
      assert.deepEqual(
        namespace.valueSource.values
          .map((value) => value.sourceValue)
          .sort(),
        [false, true],
      );
    }
  }
});

test('all valid examples pass and every invalid example is rejected', async () => {
  const contract = await loadRecommendationFeatureTokenContract();
  for (const example of contract.validExamples) {
    assert.deepEqual(validateCanonicalFeatureToken(contract, example), example);
  }
  for (const example of contract.invalidExamples) {
    const { reason: _reason, ...occurrence } = example;
    assert.throws(
      () => validateCanonicalFeatureToken(contract, occurrence),
      RecommendationFeatureTokenContractValidationError,
    );
  }
});

test('Arabic alias normalization remains separate from canonical identity', async () => {
  const contract = await loadRecommendationFeatureTokenContract();
  assert.equal(normalizeTaxonomyAlias('أَرْدُوِينُو'), 'اردوينو');
  assert.doesNotThrow(() =>
    validateCanonicalFeatureToken(contract, {
      token: 'interest:arduino',
      groupId: 'user.declared-interest',
      side: 'user',
      domain: 'material',
      weight: 1,
    }),
  );
  for (const labelToken of ['interest:Arduino', 'interest:إلكترونيات']) {
    assert.throws(
      () =>
        validateCanonicalFeatureToken(contract, {
          token: labelToken,
          groupId: 'user.declared-interest',
          side: 'user',
          domain: 'material',
          weight: 1,
        }),
      RecommendationFeatureTokenContractValidationError,
    );
  }
});

test('portable rows deduplicate set features and report missing required groups', async () => {
  const contract = await loadRecommendationFeatureTokenContract();
  const materialFeatures: PortableFeatureOccurrence[] = [
    {
      token: 'material-family:electronics',
      groupId: 'material.family',
      side: 'item',
      domain: 'material',
      weight: 1,
    },
    {
      token: 'material-condition:needs-repair',
      groupId: 'material.condition',
      side: 'item',
      domain: 'material',
      weight: 1,
    },
    {
      token: 'material-is-free:false',
      groupId: 'material.is-free',
      side: 'item',
      domain: 'material',
      weight: 1,
    },
    {
      token: 'material-pickup-allowed:true',
      groupId: 'material.pickup-allowed',
      side: 'item',
      domain: 'material',
      weight: 1,
    },
    {
      token: 'material-delivery-allowed:false',
      groupId: 'material.delivery-allowed',
      side: 'item',
      domain: 'material',
      weight: 1,
    },
  ];

  const valid = validatePortableFeatureRow(contract, {
    side: 'item',
    domain: 'material',
    features: [...materialFeatures, materialFeatures[0]!],
  });
  assert.equal(valid.scoringEligible, true);
  assert.equal(valid.features.length, materialFeatures.length);

  const missing = validatePortableFeatureRow(contract, {
    side: 'user',
    domain: 'project',
    features: [],
  });
  assert.equal(missing.scoringEligible, false);
  assert.deepEqual(missing.missingRequiredGroupIds, [
    'user.declared-interest',
  ]);

  assert.throws(
    () =>
      validatePortableFeatureRow(contract, {
        side: 'item',
        domain: 'material',
        features: [
          ...materialFeatures,
          {
            token: 'material-condition:new',
            groupId: 'material.condition',
            side: 'item',
            domain: 'material',
            weight: 1,
          },
        ],
      }),
    RecommendationFeatureTokenContractValidationError,
  );
});

test('semantic validation is driven by parsed JSON invariants', async () => {
  const contract = await loadRecommendationFeatureTokenContract();

  const duplicateNamespace = structuredClone(contract);
  duplicateNamespace.namespaces.push(
    structuredClone(duplicateNamespace.namespaces[0]!),
  );
  assert.throws(
    () => parseRecommendationFeatureTokenContract(duplicateNamespace),
    RecommendationFeatureTokenContractValidationError,
  );

  const incompleteEnum = structuredClone(contract);
  const condition = incompleteEnum.namespaces.find(
    (namespace) => namespace.id === 'material-condition',
  );
  assert.equal(condition?.valueSource.kind, 'enum');
  if (condition?.valueSource.kind === 'enum') condition.valueSource.values.pop();
  assert.throws(
    () => parseRecommendationFeatureTokenContract(incompleteEnum),
    RecommendationFeatureTokenContractValidationError,
  );

  const portableIdentity = structuredClone(contract);
  const identity = portableIdentity.featureGroups.find(
    (group) => group.id === 'user.identity',
  );
  if (!identity) throw new Error('Expected user.identity feature group.');
  identity.portableRuntimeEligible = true;
  assert.throws(
    () => parseRecommendationFeatureTokenContract(portableIdentity),
    RecommendationFeatureTokenContractValidationError,
  );
});

test('contract helper exports validation only and no alias resolver', async () => {
  const contractModule = await import(
    './recommendation-feature-token-contract.js'
  );
  assert.equal('resolveTaxonomyAlias' in contractModule, false);
  assert.equal('resolveInterestKey' in contractModule, false);
});
