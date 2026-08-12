import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createEmptyAffinityProfile,
  createEmptyBehaviorContext,
} from './learner-home.affinity.js';
import type { RecommendationScorerVersion } from '../../config/recommendation-scoring-version.js';
import {
  algorithmVersionForMlHomeForTests,
  assembleLearnerHomeCachedEnvelope,
  buildLearnerHomeCacheKey,
  type LearnerHomeLoadedContext,
} from './learner-home.service.js';
import type {
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
  LearnerHomeResponse,
} from './learner-home.types.js';
import type {
  LearnerHomeMlOrderingDecision,
  LearnerHomeMlOrderingStatus,
} from './learner-home.ml-ordering.js';

const material = (id: string, index: number): LearnerHomeMaterialCandidate => ({
  id,
  ownerId: `owner-${index}`,
  title: `Electronics material ${index}`,
  description: 'Electronics learning component',
  materialType: 'Electronics component',
  categoryId: 'cat-electronics',
  categoryNameEn: 'Electronics',
  categoryNameAr: 'الكترونيات',
  status: 'AVAILABLE',
  isFree: false,
  deliveryAllowed: true,
  pickupAllowed: true,
  viewsCount: 20 - index,
  likesCount: 10 - index,
  city: 'Ramallah',
  area: null,
  tags: ['electronics'],
  createdAt: new Date(Date.UTC(2026, 6, 20 - index)),
  availableQuantity: 2,
  mapped: {
    id,
    title: `Electronics material ${index}`,
    condition: 'GOOD',
  },
});

const project = (id: string, index: number): LearnerHomeProjectCandidate => ({
  id,
  title: `Electronics project ${index}`,
  shortDescription: 'Build an electronics project',
  difficulty: 'BEGINNER',
  estimatedDurationMinutes: 30,
  coverImageUrl: null,
  categoryId: 'cat-electronics',
  categoryNameEn: 'Electronics',
  categoryNameAr: 'الكترونيات',
  tags: ['electronics'],
  createdAt: new Date(Date.UTC(2026, 6, 20 - index)),
  likesCount: 20 - index,
  savesCount: 2,
  reviewCount: 1,
  reviewAverage: 4,
  requiredComponents: [],
  mapped: {
    id,
    title: `Electronics project ${index}`,
    isSaved: false,
  },
});

const loaded = (): LearnerHomeLoadedContext => ({
  interests: ['electronics'],
  savedLocation: { city: null, area: null },
  savedComponents: [],
  materials: Array.from({ length: 6 }, (_, index) => material(`m-${index}`, index)),
  projects: Array.from({ length: 6 }, (_, index) => project(`p-${index}`, index)),
  savedProjectItems: [],
  inProgressBuilds: [],
  savedProjectIds: new Set(),
  hasSavedProjects: false,
  behavior: createEmptyBehaviorContext(),
  behaviorAffinityProfile: createEmptyAffinityProfile(),
  hasActivity: false,
});

const decision = (
  domain: 'material' | 'project',
  status: LearnerHomeMlOrderingStatus,
  overrides: Partial<LearnerHomeMlOrderingDecision['diagnostics']> = {},
): LearnerHomeMlOrderingDecision => ({
  domain,
  runtimeMode: 'ML_PRIMARY',
  status,
  ...(status === 'FALLBACK_NOT_READY' ? { reasonCode: 'RUNTIME_NOT_READY' } : {}),
  diagnostics: {
    candidateCount: 6,
    scoredCount: status === 'ML_RANKED' ? 5 : 0,
    retryCount: 0,
    unmappedCandidateCount: 0,
    omittedMappedCandidateCount: 0,
    unknownRankedKeyCount: 0,
    duplicateRankedKeyCount: 0,
    opaqueKeySamples: [],
    ...overrides,
  },
});

const sectionIds = (
  response: LearnerHomeResponse,
  key: 'suggested_materials' | 'suggested_projects',
): string[] => response.sections
  .find((section) => section.key === key)!
  .items.map((item) => String(
    item.type === 'material' ? item.material.id : item.type === 'project' ? item.project.id : '',
  ));

const assemble = (input: {
  materialStatus: LearnerHomeMlOrderingStatus;
  projectStatus: LearnerHomeMlOrderingStatus;
  reverseMaterial?: boolean;
  reverseProject?: boolean;
  rejectMaterial?: boolean;
  materialDiagnostics?: Partial<LearnerHomeMlOrderingDecision['diagnostics']>;
}) => assembleLearnerHomeCachedEnvelope({
  userId: 'learner-1',
  loaded: loaded(),
  requestedMaterialScoringMode: 'legacy-v1',
  startedAt: performance.now(),
  rankMaterialPool: async (_context, pool) => {
    if (input.rejectMaterial) throw new Error('material scorer failed');
    return {
      ordered: input.reverseMaterial ? [...pool].reverse() : [...pool],
      decision: decision('material', input.materialStatus, input.materialDiagnostics),
    };
  },
  rankProjectPool: async (_context, pool) => ({
    ordered: input.reverseProject ? [...pool].reverse() : [...pool],
    decision: decision('project', input.projectStatus),
  }),
});

test('deterministic fallbacks leave both suggested sections unchanged and truthfully stamped', async () => {
  const baseline = await assemble({
    materialStatus: 'FALLBACK_NOT_READY',
    projectStatus: 'FALLBACK_NOT_READY',
  });
  assert.deepEqual(sectionIds(baseline.response, 'suggested_materials'), ['m-0', 'm-1', 'm-2', 'm-3']);
  assert.deepEqual(sectionIds(baseline.response, 'suggested_projects'), ['p-0', 'p-1', 'p-2', 'p-3']);
  assert.equal(baseline.generation.algorithmName, 'deterministic-hybrid');
  assert.match(baseline.generation.algorithmVersion, /sm=fb-not-ready/);
  assert.match(baseline.generation.algorithmVersion, /sp=fb-not-ready/);
});

test('Material and Project readiness are independent', async () => {
  const materialReady = await assemble({
    materialStatus: 'ML_RANKED',
    projectStatus: 'FALLBACK_NOT_READY',
    reverseMaterial: true,
  });
  assert.deepEqual(sectionIds(materialReady.response, 'suggested_materials'), ['m-5', 'm-4', 'm-3', 'm-2']);
  assert.deepEqual(sectionIds(materialReady.response, 'suggested_projects'), ['p-0', 'p-1', 'p-2', 'p-3']);

  const projectReady = await assemble({
    materialStatus: 'FALLBACK_NOT_READY',
    projectStatus: 'ML_RANKED',
    reverseProject: true,
  });
  assert.deepEqual(sectionIds(projectReady.response, 'suggested_materials'), ['m-0', 'm-1', 'm-2', 'm-3']);
  assert.deepEqual(sectionIds(projectReady.response, 'suggested_projects'), ['p-5', 'p-4', 'p-3', 'p-2']);
});

test('both READY domains visibly follow their independent validated ordering', async () => {
  const envelope = await assemble({
    materialStatus: 'ML_RANKED',
    projectStatus: 'ML_RANKED',
    reverseMaterial: true,
    reverseProject: true,
  });
  assert.deepEqual(sectionIds(envelope.response, 'suggested_materials'), ['m-5', 'm-4', 'm-3', 'm-2']);
  assert.deepEqual(sectionIds(envelope.response, 'suggested_projects'), ['p-5', 'p-4', 'p-3', 'p-2']);
  assert.equal(envelope.generation.algorithmName, 'ml-primary-hybrid');
  assert.match(envelope.generation.algorithmVersion, /sm=ml-primary/);
  assert.match(envelope.generation.algorithmVersion, /sp=ml-primary/);
});

test('final visible material order matches ML scorer order after assembly/dedupe', async () => {
  const envelope = await assemble({
    materialStatus: 'ML_RANKED',
    projectStatus: 'FALLBACK_NOT_READY',
    reverseMaterial: true,
  });
  const visible = sectionIds(envelope.response, 'suggested_materials');
  // Mock scorer reversed pool [m-0..]; containment keeps relative ML order of survivors.
  assert.deepEqual(visible, ['m-5', 'm-4', 'm-3', 'm-2']);
  assert.equal(envelope.servingTruth.material.health, 'ML_SERVED');
  assert.equal(envelope.servingTruth.material.mlOwnedFinalOrder, true);
  assert.equal(envelope.generation.servingOutcomes?.material.status, 'ML_RANKED');
  assert.equal(envelope.generation.servingOutcomes?.project.status, 'FALLBACK_NOT_READY');
});

test('final visible project order preserves ML relative order under unsaved/saved policy', async () => {
  const withSaved = (): LearnerHomeLoadedContext => {
    const base = loaded();
    return {
      ...base,
      savedProjectIds: new Set(['p-5', 'p-4']),
      hasSavedProjects: true,
      projects: base.projects.map((row, index) => ({
        ...row,
        mapped: {
          ...row.mapped,
          isSaved: index === 5 || index === 4,
        },
      })),
    };
  };

  const envelope = await assembleLearnerHomeCachedEnvelope({
    userId: 'learner-ml-local-saved',
    loaded: withSaved(),
    requestedMaterialScoringMode: 'legacy-v1' as RecommendationScorerVersion,
    rankMaterialPool: async (_context, pool) => ({
      ordered: [...pool],
      decision: decision('material', 'FALLBACK_NOT_READY'),
    }),
    rankProjectPool: async (_context, pool) => ({
      ordered: [...pool].reverse(),
      decision: decision('project', 'ML_RANKED'),
    }),
  });

  const visible = sectionIds(envelope.response, 'suggested_projects');
  // Unsaved-first: reversed ML order among unsaved (p-3,p-2,...) then saved fill.
  assert.ok(visible.length > 0);
  assert.equal(envelope.mlOrdering.project.status, 'ML_RANKED');
  // Relative order of unsaved survivors must follow reverse scorer order.
  const unsavedVisible = visible.filter((id) => id !== 'p-5' && id !== 'p-4');
  for (let i = 1; i < unsavedVisible.length; i += 1) {
    const prev = Number(unsavedVisible[i - 1]!.slice(2));
    const next = Number(unsavedVisible[i]!.slice(2));
    assert.ok(prev > next, `expected descending ML unsaved order, got ${unsavedVisible.join(',')}`);
  }
});

test('an unexpected Material rejection cannot cancel a valid Project ordering', async () => {
  const envelope = await assemble({
    materialStatus: 'ML_RANKED',
    projectStatus: 'ML_RANKED',
    rejectMaterial: true,
    reverseProject: true,
  });
  assert.deepEqual(sectionIds(envelope.response, 'suggested_materials'), ['m-0', 'm-1', 'm-2', 'm-3']);
  assert.deepEqual(sectionIds(envelope.response, 'suggested_projects'), ['p-5', 'p-4', 'p-3', 'p-2']);
  assert.equal(envelope.mlOrdering.material.status, 'FALLBACK_FAILED');
  assert.equal(envelope.mlOrdering.material.reasonCode, 'SCORER_EXCEPTION');
  assert.equal(envelope.mlOrdering.project.status, 'ML_RANKED');
});

test('partial material mapping retains diagnostics, deterministic append, and section limit', async () => {
  const envelope = await assemble({
    materialStatus: 'ML_RANKED',
    projectStatus: 'FALLBACK_NOT_READY',
    reverseMaterial: true,
    materialDiagnostics: {
      retryCount: 1,
      unmappedCandidateCount: 2,
      opaqueKeySamples: ['opaque-a', 'opaque-b'],
    },
  });
  assert.equal(sectionIds(envelope.response, 'suggested_materials').length, 4);
  assert.equal(envelope.mlOrdering.material.status, 'ML_RANKED');
  assert.equal(envelope.mlOrdering.material.diagnostics.unmappedCandidateCount, 2);
  assert.deepEqual(envelope.mlOrdering.material.diagnostics.opaqueKeySamples, ['opaque-a', 'opaque-b']);
});

test('cache key separates mode and independent Material/Project identities', () => {
  const key = (runtimeMode: 'DETERMINISTIC' | 'SHADOW' | 'ML_PRIMARY', material: string, project: string) =>
    buildLearnerHomeCacheKey({
      userId: 'learner-1',
      scorerVersion: 'legacy-v1',
      runtimeMode,
      materialRuntimeIdentity: material,
      projectRuntimeIdentity: project,
    });
  const local = key('ML_PRIMARY', 'material-a', 'project-a');
  assert.notEqual(local, key('DETERMINISTIC', 'material-a', 'project-a'));
  assert.notEqual(local, key('SHADOW', 'material-a', 'project-a'));
  assert.notEqual(local, key('ML_PRIMARY', 'material-b', 'project-a'));
  assert.notEqual(local, key('ML_PRIMARY', 'material-a', 'project-b'));
});

const SCORER_VERSIONS = [
  'legacy-v1',
  'normalized-interests-v2',
  'canonical-taxonomy-v3',
] as const satisfies readonly RecommendationScorerVersion[];

const mlHomeAlgorithmVersion = (input: {
  materialBase: RecommendationScorerVersion;
  projectBase: RecommendationScorerVersion;
  materialStatus: LearnerHomeMlOrderingStatus;
  projectStatus: LearnerHomeMlOrderingStatus;
  materialRuntimeMode?: LearnerHomeMlOrderingDecision['runtimeMode'];
  projectRuntimeMode?: LearnerHomeMlOrderingDecision['runtimeMode'];
}): string => {
  const materialDecision: LearnerHomeMlOrderingDecision = {
    ...decision('material', input.materialStatus),
    runtimeMode: input.materialRuntimeMode ?? 'ML_PRIMARY',
  };
  const projectDecision: LearnerHomeMlOrderingDecision = {
    ...decision('project', input.projectStatus),
    runtimeMode: input.projectRuntimeMode ?? 'ML_PRIMARY',
  };
  return algorithmVersionForMlHomeForTests(
    {
      modeDecision: {
        requestedMaterialScoringMode: input.materialBase,
        effectiveMaterialScoringMode: input.materialBase,
        effectiveProjectScoringMode: input.projectBase,
        fallbackCode: null,
        cacheable: true,
      },
    },
    materialDecision,
    projectDecision,
  );
};

const assertMlHomeAlgorithmVersion = (input: {
  materialBase: RecommendationScorerVersion;
  projectBase: RecommendationScorerVersion;
  materialStatus: LearnerHomeMlOrderingStatus;
  projectStatus: LearnerHomeMlOrderingStatus;
  materialToken: string;
  projectToken: string;
  materialRuntimeMode?: LearnerHomeMlOrderingDecision['runtimeMode'];
  projectRuntimeMode?: LearnerHomeMlOrderingDecision['runtimeMode'];
}) => {
  const algorithmVersion = mlHomeAlgorithmVersion(input);
  assert.ok(
    algorithmVersion.length <= 100,
    `algorithmVersion exceeds 100 chars (${algorithmVersion.length}): ${algorithmVersion}`,
  );
  assert.match(algorithmVersion, new RegExp(`(?:^|;)sm=${input.materialToken}(?:;|$)`));
  assert.match(algorithmVersion, new RegExp(`(?:^|;)sp=${input.projectToken}(?:;|$)`));
  if (input.materialBase === input.projectBase) {
    assert.match(
      algorithmVersion,
      new RegExp(`^learner-home-v1:base=${input.materialBase};`),
    );
    assert.doesNotMatch(algorithmVersion, /(?:^|;)m=/);
    assert.doesNotMatch(algorithmVersion, /(?:^|;)p=/);
  } else {
    assert.match(
      algorithmVersion,
      new RegExp(`^learner-home-v1:m=${input.materialBase};p=${input.projectBase};`),
    );
  }
  return algorithmVersion;
};

test('full-Home ML algorithm versions stay within 100 chars for all supported bases and decisions', () => {
  const decisionCases: Array<{
    materialStatus: LearnerHomeMlOrderingStatus;
    projectStatus: LearnerHomeMlOrderingStatus;
    materialToken: string;
    projectToken: string;
  }> = [
    {
      materialStatus: 'ML_RANKED',
      projectStatus: 'ML_RANKED',
      materialToken: 'ml-primary',
      projectToken: 'ml-primary',
    },
    {
      materialStatus: 'FALLBACK_NOT_READY',
      projectStatus: 'FALLBACK_NOT_READY',
      materialToken: 'fb-not-ready',
      projectToken: 'fb-not-ready',
    },
    {
      materialStatus: 'FALLBACK_FAILED',
      projectStatus: 'FALLBACK_FAILED',
      materialToken: 'fb-failed',
      projectToken: 'fb-failed',
    },
    {
      materialStatus: 'ML_RANKED',
      projectStatus: 'FALLBACK_NOT_READY',
      materialToken: 'ml-primary',
      projectToken: 'fb-not-ready',
    },
    {
      materialStatus: 'FALLBACK_FAILED',
      projectStatus: 'ML_RANKED',
      materialToken: 'fb-failed',
      projectToken: 'ml-primary',
    },
    {
      materialStatus: 'ML_RANKED',
      projectStatus: 'DETERMINISTIC',
      materialToken: 'ml-primary',
      projectToken: 'deterministic',
    },
    {
      materialStatus: 'DETERMINISTIC',
      projectStatus: 'FALLBACK_NOT_READY',
      materialToken: 'deterministic',
      projectToken: 'fb-not-ready',
    },
  ];

  for (const base of SCORER_VERSIONS) {
    for (const decisionCase of decisionCases) {
      assertMlHomeAlgorithmVersion({
        materialBase: base,
        projectBase: base,
        ...decisionCase,
      });
    }
  }

  const mixedBases: Array<{
    materialBase: RecommendationScorerVersion;
    projectBase: RecommendationScorerVersion;
  }> = [
    { materialBase: 'canonical-taxonomy-v3', projectBase: 'legacy-v1' },
    { materialBase: 'normalized-interests-v2', projectBase: 'legacy-v1' },
    { materialBase: 'canonical-taxonomy-v3', projectBase: 'normalized-interests-v2' },
    { materialBase: 'normalized-interests-v2', projectBase: 'canonical-taxonomy-v3' },
    { materialBase: 'legacy-v1', projectBase: 'normalized-interests-v2' },
  ];

  for (const bases of mixedBases) {
    for (const decisionCase of decisionCases) {
      assertMlHomeAlgorithmVersion({
        ...bases,
        ...decisionCase,
      });
    }
  }

  const longestEqual = assertMlHomeAlgorithmVersion({
    materialBase: 'normalized-interests-v2',
    projectBase: 'normalized-interests-v2',
    materialStatus: 'FALLBACK_NOT_READY',
    projectStatus: 'FALLBACK_NOT_READY',
    materialToken: 'fb-not-ready',
    projectToken: 'fb-not-ready',
  });
  assert.equal(
    longestEqual,
    'learner-home-v1:base=normalized-interests-v2;sm=fb-not-ready;sp=fb-not-ready',
  );

  const longestMixed = assertMlHomeAlgorithmVersion({
    materialBase: 'normalized-interests-v2',
    projectBase: 'canonical-taxonomy-v3',
    materialStatus: 'DETERMINISTIC',
    projectStatus: 'DETERMINISTIC',
    materialToken: 'deterministic',
    projectToken: 'deterministic',
  });
  assert.equal(
    longestMixed,
    'learner-home-v1:m=normalized-interests-v2;p=canonical-taxonomy-v3;sm=deterministic;sp=deterministic',
  );
  assert.equal(longestMixed.length, 99);

  const nonMlLocal = algorithmVersionForMlHomeForTests(
    {
      modeDecision: {
        requestedMaterialScoringMode: 'normalized-interests-v2',
        effectiveMaterialScoringMode: 'normalized-interests-v2',
        effectiveProjectScoringMode: 'normalized-interests-v2',
        fallbackCode: null,
        cacheable: true,
      },
    },
    { ...decision('material', 'DETERMINISTIC'), runtimeMode: 'DETERMINISTIC' },
    { ...decision('project', 'SHADOW'), runtimeMode: 'SHADOW' },
  );
  assert.equal(nonMlLocal, 'learner-home-v1:normalized-interests-v2');
  assert.ok(nonMlLocal.length <= 100);
});
