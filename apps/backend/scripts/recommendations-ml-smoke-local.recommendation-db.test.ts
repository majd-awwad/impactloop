import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildPortableLightFmV2Scorer,
  type LocalMlScoringInput,
  type PortableLightFmV2Scorer,
} from '../src/modules/recommendations/ml-lightfm-scorer.js';
import { stableOpaqueKey } from '../src/modules/recommendations/local-ml-training-snapshot.schema.js';
import type { PortableModelArtifactV2 } from '../src/modules/recommendations/ml-model-artifact.js';
import {
  getRecommendationMlRuntimeSnapshot,
  preloadRecommendationMlRuntime,
  resetRecommendationMlRuntimeForTests,
  setRecommendationMlRuntimeDependenciesForTests,
} from '../src/modules/recommendations/ml-runtime-state.service.js';
import {
  captureRecommendationFlags,
  applyRecommendationFlags,
  resetAllRecommendationTestStateForTests,
  withRecommendationTestIsolation,
} from '../src/modules/recommendations/recommendation-test-isolation.js';
import { prisma } from '../src/database/prisma.js';
import {
  installPrismaMutationGuard,
  resolveSmokeLearners,
  runLocalMlSmokeEvaluation,
  runtimeConfigForSmoke,
  SECTION_LIMITS_SMOKE,
  mlDecisionToken,
  extractSectionTokenFromActualStamp,
} from './recommendations-ml-smoke-local-helpers.js';
import {
  resolveMaterialCandidatePoolCap,
  resolveMaterialModeDecisionAndContext,
  type LearnerHomeLoadedContext,
  type LearnerHomeContext,
} from '../src/modules/learner-home/learner-home.service.js';
import * as learnerHomeRepository from '../src/modules/learner-home/learner-home.repository.js';
import {
  buildBehaviorAffinityProfile,
  hasLearnerActivity,
} from '../src/modules/learner-home/learner-home.affinity.js';
import {
  normalizeInterests,
} from '../src/modules/learner-home/learner-home.scoring.js';
import { RECOMMENDATION_SCORER_VERSION } from '../src/config/recommendation-scoring-version.js';

const requireDatabase = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const detail =
      error instanceof Error ? error.message.slice(0, 160) : 'unreachable';
    throw new Error(`DATABASE_UNAVAILABLE: ${detail}`);
  }
};

const fixtureArtifact = (
  domain: 'material' | 'project',
  candidateKeys: readonly string[],
): PortableModelArtifactV2 => {
  const dimension: 16 | 32 = domain === 'material' ? 16 : 32;
  const userEmbedding = Array<string>(dimension).fill('0');
  const itemEmbedding = Array<string>(dimension).fill('0');
  userEmbedding[0] = '1';
  itemEmbedding[0] = '1';
  const itemTokens =
    domain === 'material'
      ? [
          'material-condition:good',
          'material-delivery-allowed:true',
          'material-family:electronics',
          'material-is-free:false',
          'material-pickup-allowed:true',
        ]
      : [
          'component:dc-gear-motors',
          'project-difficulty:beginner',
          'project-topic:robotics',
        ];
  const keys =
    candidateKeys.length > 0 ? candidateKeys : [`${domain}-placeholder`];
  return {
    schemaVersion: 'impactloop-lightfm-portable-v2',
    domain,
    modelVersion: 'lm-06-local-lightfm-v1',
    featureContractId: 'recommendation-feature-token-contract-v3',
    featureContractVersion: '3.0.0',
    aggregationMode: 'weighted-sum',
    taxonomyFingerprint: 'a'.repeat(64),
    datasetContentHash: 'b'.repeat(64),
    featureMapping: {
      user: [{ token: 'interest:arduino', index: 0 }],
      item: itemTokens.map((token, index) => ({ token, index })),
    },
    featureMappingHash: 'c'.repeat(64),
    itemMapping: keys.map((candidateKey, index) => ({
      itemKey: stableOpaqueKey(domain, candidateKey),
      index,
    })),
    itemMappingHash: 'd'.repeat(64),
    trainingConfiguration: {
      randomSeed: 11,
      loss: 'warp',
      epochs: 10,
      noComponents: dimension,
      learningRate: '0.03',
      userAlpha: '0.000001',
      itemAlpha: '0.000001',
      numThreads: 1,
      interactionWeighting: 'unit-per-snapshot-event',
      duplicateInteractionAggregation: 'sum',
    },
    modelDimensions: {
      embeddingDimension: dimension,
      userFeatureCount: 1,
      itemFeatureCount: itemTokens.length,
      itemCount: keys.length,
    },
    modelComponents: {
      userFeatureEmbeddings: [userEmbedding],
      itemFeatureEmbeddings: itemTokens.map(() => [...itemEmbedding]),
      userFeatureBiases: ['0'],
      itemFeatureBiases: itemTokens.map(() => '0'),
    },
    semanticContentHash: (domain === 'material' ? 'e' : 'f').repeat(64),
    createdAt: '2026-07-26T00:00:00Z',
  };
};

/**
 * Contained fixture scorer: READY artifacts still need a score() that tolerates
 * real Learner Home feature rows (sparse fixture vocabularies otherwise fail
 * with FEATURE_MAPPING_MISSING). Ranking remains deterministic and contained.
 */
const buildContainedFixtureScorer = (
  artifact: PortableModelArtifactV2,
  mutateRankedKeys?: (
    rankedCandidateKeys: readonly string[],
  ) => readonly string[],
): PortableLightFmV2Scorer => {
  const base = buildPortableLightFmV2Scorer(artifact);
  return {
    domain: base.domain,
    metadata: base.metadata,
    score: (input: LocalMlScoringInput) => {
      const unique: string[] = [];
      const seen = new Set<string>();
      for (const candidate of input.candidates) {
        if (seen.has(candidate.candidateKey)) continue;
        seen.add(candidate.candidateKey);
        unique.push(candidate.candidateKey);
      }
      // Reverse to prove ML reordering versus deterministic input order.
      const rankedBase = Object.freeze([...unique].reverse());
      const rankedCandidateKeys = Object.freeze(
        mutateRankedKeys ? [...mutateRankedKeys(rankedBase)] : [...rankedBase],
      );
      return Object.freeze({
        outcome: 'SCORED' as const,
        domain: artifact.domain,
        scored: Object.freeze(
          rankedCandidateKeys
            .filter((key) => seen.has(key))
            .map((candidateKey, index) =>
              Object.freeze({
                candidateKey,
                score: rankedCandidateKeys.length - index,
              }),
            ),
        ),
        rankedCandidateKeys,
        diagnostics: Object.freeze({
          candidateCount: input.candidates.length,
          duplicateCandidateCount: Math.max(
            0,
            input.candidates.length - unique.length,
          ),
          scoredCount: rankedCandidateKeys.filter((key) => seen.has(key)).length,
          missingMappingCount: 0,
          missingMappingKeySamples: Object.freeze([] as string[]),
          featureMappingMissingCount: 0,
        }),
      });
    },
  } as PortableLightFmV2Scorer;
};

const loadContext = async (userId: string): Promise<LearnerHomeContext> => {
  const materialPoolCap = resolveMaterialCandidatePoolCap({ kind: 'FULL_HOME' });
  const [rawInterests, savedLocation, projectContext] = await Promise.all([
    learnerHomeRepository.loadLearnerInterests(userId),
    learnerHomeRepository.loadDefaultSavedLocation(userId),
    learnerHomeRepository.loadLearnerHomeProjectContext(userId, 4),
  ]);
  const behavior = projectContext.behavior;
  const interests = normalizeInterests(rawInterests);
  const savedComponents = behavior.savedProjectComponents ?? [];
  const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);
  const materials = await learnerHomeRepository.loadMaterialCandidatesForLearner({
    interests,
    savedComponents,
    behavior,
    savedLocation,
    poolCap: materialPoolCap,
  });
  const projects = projectContext.projects;
  const savedProjectIds = new Set(
    projects.filter((project) => project.mapped.isSaved).map((project) => project.id),
  );
  const loaded: LearnerHomeLoadedContext = {
    interests,
    savedLocation,
    savedComponents,
    materials,
    projects,
    savedProjectItems: projectContext.savedProjects,
    inProgressBuilds: projectContext.inProgressBuilds,
    savedProjectIds,
    hasSavedProjects: projectContext.hasSavedProjects,
    behavior,
    behaviorAffinityProfile,
    hasActivity: hasLearnerActivity(behavior),
  };
  const { modeDecision, canonicalContext } =
    await resolveMaterialModeDecisionAndContext({
      requestedMaterialScoringMode: RECOMMENDATION_SCORER_VERSION,
      needsCanonicalMaterialScoring: true,
      materials: loaded.materials,
      behavior: loaded.behavior,
    });
  return { ...loaded, modeDecision, canonicalContext };
};

const collectPoolIds = (context: LearnerHomeContext) => {
  // Map the full loaded candidate catalogs so LM-08's authoritative pools
  // cannot miss item mappings during fixture-backed runtime evaluation.
  const materialPool = [
    ...new Set(
      context.materials
        .map((material) => String(material.id ?? ''))
        .filter(Boolean),
    ),
  ];
  const projectPool = [
    ...new Set(
      context.projects
        .map((project) => String(project.id ?? ''))
        .filter(Boolean),
    ),
  ];
  return { materialPool, projectPool };
};

const preloadBothReady = async (
  materialKeys: readonly string[],
  projectKeys: readonly string[],
) => {
  resetRecommendationMlRuntimeForTests();
  setRecommendationMlRuntimeDependenciesForTests({
    getConfig: () =>
      runtimeConfigForSmoke({
        materialArtifactPath: 'fixtures/material-v2.json',
        projectArtifactPath: 'fixtures/project-v2.json',
      }),
    loadArtifact: async (_path, expectations) =>
      fixtureArtifact(
        expectations.expectedDomain,
        expectations.expectedDomain === 'material' ? materialKeys : projectKeys,
      ),
    buildScorer: buildContainedFixtureScorer,
    now: () => new Date('2026-07-23T00:00:00.000Z'),
  });
  return preloadRecommendationMlRuntime();
};

test(
  'ml-smoke-local db: three learners, both-ready requires ML_RANKED, stamps, append, dedup, stability, mutation guard',
  { timeout: 180_000 },
  async (t) => {
    await requireDatabase();
    await withRecommendationTestIsolation(async () => {
      const prior = captureRecommendationFlags();
      t.after(() => {
        applyRecommendationFlags(prior);
        resetRecommendationMlRuntimeForTests();
        resetAllRecommendationTestStateForTests();
      });

      const resolved = await resolveSmokeLearners();
      assert.equal(resolved.ok, true);
      if (!resolved.ok) return;
      assert.equal(resolved.learners.length, 3);

      const contexts = await Promise.all(
        resolved.learners.map((learner) => loadContext(learner.userId)),
      );
      const materialKeys = [
        ...new Set(
          contexts.flatMap((context) => collectPoolIds(context).materialPool),
        ),
      ];
      const projectKeys = [
        ...new Set(
          contexts.flatMap((context) => collectPoolIds(context).projectPool),
        ),
      ];
      assert.ok(materialKeys.length > 0);
      assert.ok(projectKeys.length > 0);

      const snapshot = await preloadBothReady(materialKeys, projectKeys);
      assert.equal(snapshot.mode, 'ML_LOCAL');
      assert.equal(snapshot.material.state, 'READY');
      assert.equal(snapshot.project.state, 'READY');

      const guard = installPrismaMutationGuard();
      try {
        const result = await runLocalMlSmokeEvaluation({
          assumeRuntimePreloaded: true,
          evaluationTimeUtc: '2026-07-23T00:00:00.000Z',
          skipDisconnect: true,
        });
        assert.equal(guard.mutations.length, 0, guard.mutations.join(','));
        assert.equal(result.report.runtimeMode, 'ML_LOCAL');
        assert.equal(result.exitCode, 0, result.report.hardFailures.join(';'));
        assert.equal(result.report.hardFailures.length, 0);

        const materialSections = result.report.sections.filter(
          (section) => section.domain === 'material',
        );
        const projectSections = result.report.sections.filter(
          (section) => section.domain === 'project',
        );
        assert.ok(
          materialSections.some((section) => section.status === 'ML_RANKED'),
        );
        assert.ok(
          projectSections.some((section) => section.status === 'ML_RANKED'),
        );

        for (const section of result.report.sections) {
          assert.equal(section.checks.containment, true);
          assert.equal(section.checks.uniqueness, true);
          assert.equal(section.checks.finiteScores, true);
          assert.equal(section.checks.limit, true);
          assert.equal(section.checks.domainSeparation, true);
          assert.equal(section.checks.stampTruthful, true);
          assert.equal(section.checks.mappedUnmappedAppend, true);
          assert.equal(section.checks.eligibility, true);
          assert.equal(section.checks.unknownKeysContained, true);
          assert.equal(section.checks.duplicateKeysContained, true);
          if (section.domain === 'material') {
            assert.equal(section.checks.crossSectionDedup, true);
          }
          assert.ok(
            section.boundedRankedIds.length <=
              SECTION_LIMITS_SMOKE[
                section.sectionKey as keyof typeof SECTION_LIMITS_SMOKE
              ],
          );
          const token = extractSectionTokenFromActualStamp(
            section.stamp,
            section.sectionKey as 'suggested_materials' | 'suggested_projects',
          );
          if (section.status === 'ML_RANKED') {
            assert.equal(token, 'ml-local');
          } else {
            assert.notEqual(token, 'ml-local');
          }
        }
        assert.doesNotMatch(JSON.stringify(result.report), /@learner\.com/);
      } finally {
        guard.restore();
      }
    });
  },
);

test(
  'ml-smoke-local db: mutation guard catches transaction-client writes',
  { timeout: 60_000 },
  async () => {
    await requireDatabase();
    const guard = installPrismaMutationGuard();
    try {
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            await tx.recommendationEventOutbox.create({
              data: {
                id: 'smoke-guard-should-fail',
                eventType: 'RECOMMENDATION_GENERATION',
                payload: {},
              } as never,
            });
          }),
        /SMOKE_MUTATION_GUARD:tx\./,
      );
      assert.ok(guard.mutations.some((entry) => entry.startsWith('tx.')));
    } finally {
      guard.restore();
    }
  },
);

test(
  'ml-smoke-local db: partial-domain artifact isolation keeps unaffected domain on ML',
  { timeout: 120_000 },
  async (t) => {
    await requireDatabase();
    await withRecommendationTestIsolation(async () => {
      const prior = captureRecommendationFlags();
      t.after(() => {
        applyRecommendationFlags(prior);
        resetRecommendationMlRuntimeForTests();
        resetAllRecommendationTestStateForTests();
      });

      const resolved = await resolveSmokeLearners();
      assert.equal(resolved.ok, true);
      if (!resolved.ok) return;
      const context = await loadContext(resolved.learners[0]!.userId);
      const pools = collectPoolIds(context);

      resetRecommendationMlRuntimeForTests();
      setRecommendationMlRuntimeDependenciesForTests({
        getConfig: () =>
          runtimeConfigForSmoke({
            materialArtifactPath: 'fixtures/material-v2.json',
            projectArtifactPath: '',
          }),
        loadArtifact: async (_path, expectations) => {
          if (expectations.expectedDomain === 'project') {
            throw Object.assign(new Error('missing'), { code: 'ENOENT' });
          }
          return fixtureArtifact('material', pools.materialPool);
        },
        buildScorer: buildContainedFixtureScorer,
      });
      const materialOnly = await preloadRecommendationMlRuntime();
      assert.equal(materialOnly.material.state, 'READY');
      assert.equal(materialOnly.project.state, 'NOT_READY');

      const materialOnlyResult = await runLocalMlSmokeEvaluation({
        assumeRuntimePreloaded: true,
        allowPartialDomainReadiness: true,
        evaluationTimeUtc: '2026-07-23T00:00:00.000Z',
        skipDisconnect: true,
      });
      const materialSections = materialOnlyResult.report.sections.filter(
        (section) => section.domain === 'material',
      );
      const projectSections = materialOnlyResult.report.sections.filter(
        (section) => section.domain === 'project',
      );
      assert.ok(
        materialSections.some((section) => section.status === 'ML_RANKED'),
      );
      for (const section of projectSections) {
        assert.notEqual(section.status, 'ML_RANKED');
        assert.notEqual(
          extractSectionTokenFromActualStamp(
            section.stamp,
            'suggested_projects',
          ),
          'ml-local',
        );
      }

      resetRecommendationMlRuntimeForTests();
      setRecommendationMlRuntimeDependenciesForTests({
        getConfig: () =>
          runtimeConfigForSmoke({
            materialArtifactPath: '',
            projectArtifactPath: 'fixtures/project-v2.json',
          }),
        loadArtifact: async (_path, expectations) => {
          if (expectations.expectedDomain === 'material') {
            throw Object.assign(new Error('missing'), { code: 'ENOENT' });
          }
          return fixtureArtifact('project', pools.projectPool);
        },
        buildScorer: buildContainedFixtureScorer,
      });
      const projectOnly = await preloadRecommendationMlRuntime();
      assert.equal(projectOnly.material.state, 'NOT_READY');
      assert.equal(projectOnly.project.state, 'READY');

      const projectOnlyResult = await runLocalMlSmokeEvaluation({
        assumeRuntimePreloaded: true,
        allowPartialDomainReadiness: true,
        evaluationTimeUtc: '2026-07-23T00:00:00.000Z',
        skipDisconnect: true,
      });
      assert.ok(
        projectOnlyResult.report.sections.some(
          (section) =>
            section.domain === 'project' && section.status === 'ML_RANKED',
        ),
      );
      for (const section of projectOnlyResult.report.sections.filter(
        (row) => row.domain === 'material',
      )) {
        assert.notEqual(section.status, 'ML_RANKED');
        assert.notEqual(
          extractSectionTokenFromActualStamp(
            section.stamp,
            'suggested_materials',
          ),
          'ml-local',
        );
      }
    });
  },
);

test(
  'ml-smoke-local db: isolated scorer failure falls back without claiming ML',
  { timeout: 120_000 },
  async (t) => {
    await requireDatabase();
    await withRecommendationTestIsolation(async () => {
      t.after(() => {
        resetRecommendationMlRuntimeForTests();
        resetAllRecommendationTestStateForTests();
      });
      const resolved = await resolveSmokeLearners();
      assert.equal(resolved.ok, true);
      if (!resolved.ok) return;
      const context = await loadContext(resolved.learners[0]!.userId);
      const pools = collectPoolIds(context);
      resetRecommendationMlRuntimeForTests();
      setRecommendationMlRuntimeDependenciesForTests({
        getConfig: () =>
          runtimeConfigForSmoke({
            materialArtifactPath: 'fixtures/material-v2.json',
            projectArtifactPath: 'fixtures/project-v2.json',
          }),
        loadArtifact: async (_path, expectations) =>
          fixtureArtifact(
            expectations.expectedDomain,
            expectations.expectedDomain === 'material'
              ? pools.materialPool
              : pools.projectPool,
          ),
        buildScorer: (artifact) => {
          if (artifact.domain === 'material') {
            return {
              ...buildContainedFixtureScorer(artifact),
              score: () => {
                throw new Error('injected_material_scorer_failure');
              },
            } as ReturnType<typeof buildContainedFixtureScorer>;
          }
          return buildContainedFixtureScorer(artifact);
        },
      });
      await preloadRecommendationMlRuntime();
      assert.equal(getRecommendationMlRuntimeSnapshot().material.state, 'READY');
      assert.equal(getRecommendationMlRuntimeSnapshot().project.state, 'READY');

      const result = await runLocalMlSmokeEvaluation({
        assumeRuntimePreloaded: true,
        allowPartialDomainReadiness: true,
        evaluationTimeUtc: '2026-07-23T00:00:00.000Z',
        skipDisconnect: true,
      });
      const material = result.report.sections.filter(
        (row) => row.domain === 'material',
      );
      const project = result.report.sections.filter(
        (row) => row.domain === 'project',
      );
      assert.ok(material.every((row) => row.status !== 'ML_RANKED'));
      assert.ok(
        material.every(
          (row) =>
            extractSectionTokenFromActualStamp(
              row.stamp,
              'suggested_materials',
            ) !== 'ml-local',
        ),
      );
      assert.ok(
        project.some((row) => row.status === 'ML_RANKED'),
        'unaffected project domain must continue ML_RANKED',
      );
      for (const row of material) {
        assert.equal(mlDecisionToken(row.status) !== 'ml-local', true);
      }
    });
  },
);

test(
  'ml-smoke-local db: unknown scorer keys diagnosed but contained; duplicate keys fall back truthfully',
  { timeout: 180_000 },
  async (t) => {
    await requireDatabase();
    await withRecommendationTestIsolation(async () => {
      t.after(() => {
        resetRecommendationMlRuntimeForTests();
        resetAllRecommendationTestStateForTests();
      });
      const resolved = await resolveSmokeLearners();
      assert.equal(resolved.ok, true);
      if (!resolved.ok) return;
      const context = await loadContext(resolved.learners[0]!.userId);
      const pools = collectPoolIds(context);

      resetRecommendationMlRuntimeForTests();
      setRecommendationMlRuntimeDependenciesForTests({
        getConfig: () =>
          runtimeConfigForSmoke({
            materialArtifactPath: 'fixtures/material-v2.json',
            projectArtifactPath: 'fixtures/project-v2.json',
          }),
        loadArtifact: async (_path, expectations) =>
          fixtureArtifact(
            expectations.expectedDomain,
            expectations.expectedDomain === 'material'
              ? pools.materialPool
              : pools.projectPool,
          ),
        buildScorer: (artifact) => {
          if (artifact.domain !== 'material') {
            return buildContainedFixtureScorer(artifact);
          }
          return buildContainedFixtureScorer(artifact, (ranked) => [
            '__smoke_unknown_key__',
            ...ranked,
          ]);
        },
      });
      await preloadRecommendationMlRuntime();
      const unknownResult = await runLocalMlSmokeEvaluation({
        assumeRuntimePreloaded: true,
        evaluationTimeUtc: '2026-07-23T00:00:00.000Z',
        skipDisconnect: true,
      });
      const materialUnknown = unknownResult.report.sections.filter(
        (row) => row.domain === 'material',
      );
      assert.ok(materialUnknown.length > 0);
      for (const row of materialUnknown) {
        assert.equal(row.checks.unknownKeysContained, true);
        assert.equal(row.checks.containment, true);
        assert.ok(
          row.status === 'ML_RANKED' || row.status === 'FALLBACK_FAILED',
        );
      }

      resetRecommendationMlRuntimeForTests();
      setRecommendationMlRuntimeDependenciesForTests({
        getConfig: () =>
          runtimeConfigForSmoke({
            materialArtifactPath: 'fixtures/material-v2.json',
            projectArtifactPath: 'fixtures/project-v2.json',
          }),
        loadArtifact: async (_path, expectations) =>
          fixtureArtifact(
            expectations.expectedDomain,
            expectations.expectedDomain === 'material'
              ? pools.materialPool
              : pools.projectPool,
          ),
        buildScorer: (artifact) => {
          if (artifact.domain !== 'material') {
            return buildContainedFixtureScorer(artifact);
          }
          return buildContainedFixtureScorer(artifact, (ranked) => {
            const first = ranked[0];
            if (!first) return ranked;
            return [first, first, ...ranked.slice(1)];
          });
        },
      });
      await preloadRecommendationMlRuntime();
      const duplicateResult = await runLocalMlSmokeEvaluation({
        assumeRuntimePreloaded: true,
        allowPartialDomainReadiness: true,
        evaluationTimeUtc: '2026-07-23T00:00:00.000Z',
        skipDisconnect: true,
      });
      const materialDup = duplicateResult.report.sections.filter(
        (row) => row.domain === 'material',
      );
      assert.ok(materialDup.every((row) => row.status !== 'ML_RANKED'));
      for (const row of materialDup) {
        assert.equal(row.checks.duplicateKeysContained, true);
        assert.equal(row.checks.uniqueness, true);
        assert.notEqual(
          extractSectionTokenFromActualStamp(row.stamp, 'suggested_materials'),
          'ml-local',
        );
      }
      assert.ok(
        duplicateResult.report.sections.some(
          (row) =>
            row.domain === 'project' && row.status === 'ML_RANKED',
        ),
        'unaffected project domain must continue ML_RANKED',
      );
    });
  },
);

test(
  'ml-smoke-local db: missing artifacts hard-fail',
  { timeout: 60_000 },
  async (t) => {
    await requireDatabase();
    await withRecommendationTestIsolation(async () => {
      t.after(() => {
        resetRecommendationMlRuntimeForTests();
        resetAllRecommendationTestStateForTests();
      });
      const tempRoot = await mkdtemp(join(tmpdir(), 'lm09-smoke-'));
      t.after(async () => {
        await rm(tempRoot, { recursive: true, force: true });
      });
      const invalidMaterial = join(tempRoot, 'material-invalid.json');
      const invalidProject = join(tempRoot, 'project-missing.json');
      await writeFile(invalidMaterial, '{not-json', 'utf8');

      resetRecommendationMlRuntimeForTests();
      setRecommendationMlRuntimeDependenciesForTests({
        getConfig: () =>
          runtimeConfigForSmoke({
            materialArtifactPath: invalidMaterial,
            projectArtifactPath: invalidProject,
          }),
      });
      const snapshot = await preloadRecommendationMlRuntime();
      assert.notEqual(snapshot.material.state, 'READY');
      assert.notEqual(snapshot.project.state, 'READY');

      const result = await runLocalMlSmokeEvaluation({
        assumeRuntimePreloaded: true,
        evaluationTimeUtc: '2026-07-23T00:00:00.000Z',
        skipDisconnect: true,
      });
      assert.equal(result.exitCode, 1);
      assert.ok(result.report.hardFailures.length > 0);
    });
  },
);

test('ml-smoke-local db: disconnect prisma after suite helpers', async () => {
  await prisma.$disconnect();
});
