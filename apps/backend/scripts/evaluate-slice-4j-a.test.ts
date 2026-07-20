import assert from 'node:assert/strict';
import test from 'node:test';

import { env } from '../src/config/env.js';
import {
  applyRecommendationFlags,
  buildCaseMetrics,
  buildStableHash,
  captureRecommendationFlags,
  classifyReleaseReadiness,
  collectRequestObservations,
  computeTopKOverlap,
  countRequestFallbacks,
  createBaselineRequestProof,
  EVALUATION_MODES,
  evaluateArchetypeBehavior,
  evaluateSafetyInvariants,
  extractSectionMaterialIds,
  homeSectionsEqualExcept,
  overlapRatio,
  projectComponentCoverageKeys,
  redactReport,
  REQUIRED_REPORT_KEYS,
  resolveEvaluatedArchetype,
  responseSchemaKeys,
  schemasCompatible,
  selectLearnerArchetypes,
  summarizeDistribution,
  withRecommendationFlags,
  type LearnerFixtureRow,
  type ShadowObservation,
  type Slice4jAReport,
} from './evaluate-slice-4j-a-report.js';

const learner = (
  overrides: Partial<LearnerFixtureRow> & { id: string },
): LearnerFixtureRow => ({
  learnerProfile: { interests: ['arduino'] },
  _count: {
    materialLikes: 0,
    materialViews: 0,
    projectSaves: 0,
    projectLikes: 0,
    projectBuilds: 0,
  },
  projectSaves: [],
  projectLikes: [],
  materialLikes: [],
  materialViews: [],
  ...overrides,
});

const homeResponse = (sectionItems: Record<string, unknown[]>) => ({
  profileCompletion: {
    hasInterests: true,
    hasSavedLocation: false,
    hasSavedProjects: false,
    hasActivity: true,
  },
  sections: Object.entries(sectionItems).map(([key, items]) => ({
    key,
    title: key,
    items,
    emptyState: 'empty',
  })),
});

test('archetype selection is deterministic and covers expected predicates', () => {
  const learners: LearnerFixtureRow[] = [
    learner({ id: 'cold', learnerProfile: { interests: [] } }),
    learner({ id: 'profile', _count: { materialLikes: 0, materialViews: 0, projectSaves: 0, projectLikes: 0, projectBuilds: 0 } }),
    learner({
      id: 'material-coherent',
      _count: { materialLikes: 2, materialViews: 1, projectSaves: 0, projectLikes: 0, projectBuilds: 0 },
      materialLikes: [
        { material: { categoryId: 'cat-a' } },
        { material: { categoryId: 'cat-a' } },
      ],
      materialViews: [{ material: { categoryId: 'cat-b' } }],
    }),
    learner({
      id: 'material-scattered',
      materialLikes: [
        { material: { categoryId: 'c1' } },
        { material: { categoryId: 'c2' } },
        { material: { categoryId: 'c3' } },
        { material: { categoryId: 'c4' } },
      ],
      materialViews: [],
      _count: { materialLikes: 4, materialViews: 0, projectSaves: 0, projectLikes: 0, projectBuilds: 0 },
    }),
    learner({
      id: 'project-coherent',
      projectSaves: [{ projectId: 'p1' }, { projectId: 'p2' }],
      projectLikes: [{ projectId: 'p2' }],
      _count: { materialLikes: 0, materialViews: 0, projectSaves: 2, projectLikes: 1, projectBuilds: 0 },
    }),
    learner({
      id: 'project-scattered',
      projectSaves: [{ projectId: 'p1' }, { projectId: 'p2' }, { projectId: 'p3' }],
      projectLikes: [{ projectId: 'p4' }],
      _count: { materialLikes: 5, materialViews: 5, projectSaves: 3, projectLikes: 1, projectBuilds: 0 },
    }),
    learner({
      id: 'mixed',
      _count: { materialLikes: 0, materialViews: 2, projectSaves: 1, projectLikes: 0, projectBuilds: 1 },
    }),
    learner({ id: 'sparse', _count: { materialLikes: 1, materialViews: 0, projectSaves: 0, projectLikes: 0, projectBuilds: 0 } }),
  ];

  const first = selectLearnerArchetypes(learners, 'sparse');
  const second = selectLearnerArchetypes(learners, 'sparse');
  assert.deepEqual(first, second);
  assert.equal(first.find((entry) => entry.archetypeKey === 'cold_start')?.learnerId, 'cold');
  assert.equal(first.find((entry) => entry.archetypeKey === 'profile_only')?.learnerId, 'profile');
  assert.equal(
    first.find((entry) => entry.archetypeKey === 'sparse_candidates')?.archetypeStatus,
    'RESOLVED',
  );
});

test('mode definitions isolate material and project serving flags', () => {
  assert.equal(EVALUATION_MODES.C_material.materialServing, true);
  assert.equal(EVALUATION_MODES.C_material.projectServing, false);
  assert.equal(EVALUATION_MODES.D_project.materialServing, false);
  assert.equal(EVALUATION_MODES.D_project.projectServing, true);
  assert.equal(EVALUATION_MODES.A_baseline.shadow, false);
});

test('overlap helpers use hashed labels without exposing identifiers in metrics output', () => {
  assert.equal(overlapRatio(['a', 'b', 'c'], ['a', 'x', 'c'], 3), 2 / 3);
  const overlap = computeTopKOverlap(['material-1', 'material-2'], ['material-2', 'material-3'], 5);
  assert.ok(overlap >= 0 && overlap <= 1);
});

test('home and browse-all consistency checker compares section ordering', () => {
  const home = homeResponse({
    suggested_projects: [
      { type: 'project', score: 1, reasons: [], project: { id: 'p1' } },
      { type: 'project', score: 1, reasons: [], project: { id: 'p2' } },
    ],
  });
  const section = {
    key: 'suggested_projects',
    title: 'Suggested projects',
    subtitle: '',
    items: home.sections[0]!.items,
    emptyState: 'empty',
    nextCursor: null,
    nextOffset: null,
    hasMore: false,
  };
  const metrics = buildCaseMetrics({
    archetypeKey: 'mixed',
    modeKey: 'E_both',
    httpStatus: 200,
    requestDurationMs: 12,
    home: home as any,
    materialsSection: {
      key: 'suggested_materials',
      title: 'Suggested materials',
      subtitle: '',
      items: [],
      emptyState: 'empty',
      nextCursor: null,
      nextOffset: null,
      hasMore: false,
    },
    projectsSection: section as any,
    deterministicEquivalent: false,
    unpublishedProjectIds: new Set(),
  });
  assert.equal(metrics.homeBrowseProjectsConsistent, true);
});

test('schema compatibility ignores item payload differences', () => {
  const baseline = homeResponse({
    suggested_materials: [{ type: 'material', score: 1, reasons: [], material: { id: 'm1' } }],
  }) as any;
  const candidate = homeResponse({
    suggested_materials: [{ type: 'material', score: 2, reasons: [], material: { id: 'm2' } }],
  }) as any;
  assert.equal(schemasCompatible(baseline, candidate), true);
  assert.deepEqual(responseSchemaKeys(baseline).topLevel, responseSchemaKeys(candidate).topLevel);
});

test('homeSectionsEqualExcept isolates domain-specific fallback independence', () => {
  const left = homeResponse({
    suggested_materials: [{ type: 'material', score: 1, reasons: [], material: { id: 'm1' } }],
    suggested_projects: [{ type: 'project', score: 1, reasons: [], project: { id: 'p1' } }],
  }) as any;
  const right = homeResponse({
    suggested_materials: [{ type: 'material', score: 1, reasons: [], material: { id: 'm2' } }],
    suggested_projects: [{ type: 'project', score: 1, reasons: [], project: { id: 'p1' } }],
  }) as any;
  assert.equal(homeSectionsEqualExcept(left, right, ['suggested_materials']), true);
  assert.equal(homeSectionsEqualExcept(left, right, []), false);
});

test('redactReport rejects private identifiers and report builder includes required keys', () => {
  const report: Slice4jAReport = {
    runMetadata: { generatedAt: '2026-07-20T00:00:00.000Z', nodeVersion: process.version },
    artifactVersions: { material: 'v2', project: 'v2' },
    featureSchemaVersions: { material: 'runtime-v2', project: 'runtime-v2' },
    evaluatedArchetypes: [{
      archetypeKey: 'mixed',
      archetypeStatus: 'RESOLVED',
      archetypeResolution: 'RESOLVED_CONFIRMED',
      accountCriteriaMatched: true,
      behavioralCriteriaMatched: true,
    }],
    modeComparisons: [],
    correctnessInvariants: { noDuplicatesInServedSections: true },
    qualityProxies: {
      materials: {
        offlineDiagnosticProxy: true,
        disclaimer: 'diagnostic only',
        top5: {},
        top10: {},
      },
      projects: {
        offlineDiagnosticProxy: true,
        disclaimer: 'diagnostic only',
        top5: {},
        top10: {},
      },
    },
    confidenceDistributions: {},
    latencySummary: {},
    fallbackSummary: { totalFallbackCases: 0 },
    releaseBlockers: [],
    warnings: [],
    finalRecommendation: 'READY_WITH_WARNINGS',
    determinism: { stableHash: 'pending', excludes: ['generatedAt'] },
  };
  report.determinism.stableHash = buildStableHash(report);
  const safe = redactReport(report);
  for (const key of REQUIRED_REPORT_KEYS) assert.ok(key in safe);
  assert.throws(() =>
    redactReport({ ...report, runMetadata: { email: 'learner@example.com' } }),
  );
  assert.throws(() =>
    redactReport({ ...report, sampleId: 'cmrmewojm001w4gqcfkazu8rc' }),
  );
});

test('withRecommendationFlags restores environment values after success and failure', async () => {
  const prior = captureRecommendationFlags(env);
  const next = {
    ...prior,
    shadow: !prior.shadow,
    materialServing: !prior.materialServing,
    projectServing: !prior.projectServing,
    materialPath: '/tmp/material.json',
    projectPath: '/tmp/project.json',
  };

  await withRecommendationFlags(env, prior, next, async () => {
    assert.equal(env.recommendationMlShadowEnabled, next.shadow);
    assert.equal(env.recommendationMlMaterialArtifactPath, next.materialPath);
  });
  assert.deepEqual(captureRecommendationFlags(env), prior);

  await assert.rejects(
    () =>
      withRecommendationFlags(env, prior, next, async () => {
        throw new Error('forced_failure');
      }),
    /forced_failure/,
  );
  assert.deepEqual(captureRecommendationFlags(env), prior);
});

test('applyRecommendationFlags changes only recommendation serving fields', () => {
  const prior = captureRecommendationFlags(env);
  applyRecommendationFlags(env, {
    shadow: true,
    materialServing: true,
    projectServing: false,
    materialPath: '/tmp/a.json',
    projectPath: '/tmp/b.json',
  });
  assert.equal(env.recommendationMlShadowEnabled, true);
  assert.equal(env.recommendationMlProjectServingEnabled, false);
  applyRecommendationFlags(env, prior);
  assert.deepEqual(captureRecommendationFlags(env), prior);
});

test('baseline request proof reports zero scorer and fallback observations', () => {
  const observations: ShadowObservation[] = [];
  const proof = createBaselineRequestProof(
    observations,
    { entries: 0, artifactLoadCount: 2 },
    { entries: 0, artifactLoadCount: 2 },
  );
  assert.equal(proof.scorerInvocations, 0);
  assert.equal(proof.requestFallbackCount, 0);
  assert.equal(proof.shadowObservations, 0);
  assert.equal(proof.artifactLoadsAttributed, 0);
  assert.equal(proof.deterministicMode, true);
});

test('baseline mode excludes scored and fallback shadow observations per request', () => {
  const buffer: ShadowObservation[] = [];
  const run = async () => {
    buffer.push({
      domain: 'material',
      status: 'DISABLED',
      recentConfidence: 'NONE',
    } as ShadowObservation);
    return 'ok';
  };
  return collectRequestObservations(buffer, run).then(({ observations }) => {
    assert.equal(observations.some((entry) => entry.status === 'SCORED'), false);
    assert.equal(observations.some((entry) => entry.status === 'FALLBACK'), false);
    assert.equal(countRequestFallbacks(observations), 0);
  });
});

test('collectRequestObservations isolates injected fallback between requests', async () => {
  const buffer: ShadowObservation[] = [
    { domain: 'project', status: 'FALLBACK' } as ShadowObservation,
  ];
  const first = await collectRequestObservations(buffer, async () => 'first');
  buffer.push({ domain: 'material', status: 'FALLBACK' } as ShadowObservation);
  const second = await collectRequestObservations(buffer, async () => 'second');
  assert.equal(countRequestFallbacks(first.observations), 0);
  assert.equal(countRequestFallbacks(second.observations), 0);
});

test('baseline proof attributes artifact loads only to request window', () => {
  const proof = createBaselineRequestProof(
    [],
    { entries: 1, artifactLoadCount: 5 },
    { entries: 2, artifactLoadCount: 5 },
  );
  assert.equal(proof.artifactLoadsAttributed, 0);
  const withLoad = createBaselineRequestProof(
    [],
    { entries: 1, artifactLoadCount: 2 },
    { entries: 2, artifactLoadCount: 5 },
  );
  assert.equal(withLoad.artifactLoadsAttributed, 3);
});

test('required-only component coverage excludes optional concepts', () => {
  const components = [
    {
      isRequired: false,
      taxonomyConcepts: [{ concept: { canonicalKey: 'optional-only' } }],
    },
    {
      isRequired: true,
      taxonomyConcepts: [{ concept: { canonicalKey: 'required-a' } }],
    },
  ];
  const keys = projectComponentCoverageKeys(components);
  assert.deepEqual(keys, ['required-a']);
  assert.equal(keys.includes('optional-only'), false);
});

test('required components are included in coverage aggregate helper', () => {
  const keys = projectComponentCoverageKeys([
    {
      isRequired: true,
      taxonomyConcepts: [
        { concept: { canonicalKey: 'req-1' } },
        { concept: { canonicalKey: 'req-2' } },
      ],
    },
  ]);
  assert.deepEqual(keys, ['req-1', 'req-2']);
});

test('account discovery and archetypeResolution are reported separately', () => {
  const learners: LearnerFixtureRow[] = [
    learner({ id: 'profile', _count: { materialLikes: 0, materialViews: 0, projectSaves: 0, projectLikes: 0, projectBuilds: 0 } }),
  ];
  const selection = selectLearnerArchetypes(learners, 'missing-sparse').find(
    (entry) => entry.archetypeKey === 'profile_only',
  )!;
  const evaluated = resolveEvaluatedArchetype(
    selection,
    learners[0],
    { recentConfidence: 'NONE' } as any,
    { recentConfidence: 'NONE' } as any,
  );
  assert.equal(selection.archetypeStatus, 'RESOLVED');
  assert.equal(evaluated.accountCriteriaMatched, true);
  assert.equal(evaluated.archetypeResolution, 'RESOLVED_CONFIRMED');
});

test('project_coherent with low confidence is behaviorally unconfirmed', () => {
  const coherentLearner = learner({
    id: 'project-coherent',
    projectSaves: [{ projectId: 'p1' }, { projectId: 'p2' }],
    projectLikes: [{ projectId: 'p2' }],
    _count: { materialLikes: 0, materialViews: 0, projectSaves: 2, projectLikes: 1, projectBuilds: 0 },
  });
  const behavior = evaluateArchetypeBehavior(
    'project_coherent',
    coherentLearner,
    undefined,
    { recentConfidence: 'LOW', recentEvidenceCount: 0 } as any,
  );
  assert.equal(behavior.behavioralCriteriaMatched, false);
  const evaluated = resolveEvaluatedArchetype(
    { archetypeKey: 'project_coherent', archetypeStatus: 'RESOLVED', learnerId: coherentLearner.id },
    coherentLearner,
    undefined,
    { recentConfidence: 'LOW', recentEvidenceCount: 0 } as any,
  );
  assert.equal(evaluated.archetypeResolution, 'RESOLVED_UNCONFIRMED');
});

test('classifyReleaseReadiness treats unconfirmed archetypes as warnings not blockers', () => {
  assert.equal(
    classifyReleaseReadiness({
      invariants: { noDuplicatesInServedSections: true },
      warnings: [],
      releaseBlockers: [],
      unresolvedArchetypes: 0,
      unconfirmedArchetypes: 2,
    }),
    'READY_WITH_WARNINGS',
  );
});

test('classifyReleaseReadiness respects blockers warnings and clean passes', () => {
  assert.equal(
    classifyReleaseReadiness({
      invariants: { noDuplicatesInServedSections: true },
      warnings: [],
      releaseBlockers: ['defect'],
      unresolvedArchetypes: 0,
    }),
    'NOT_READY',
  );
  assert.equal(
    classifyReleaseReadiness({
      invariants: { noDuplicatesInServedSections: true },
      warnings: ['sparse seed gap'],
      releaseBlockers: [],
      unresolvedArchetypes: 1,
    }),
    'READY_WITH_WARNINGS',
  );
  assert.equal(
    classifyReleaseReadiness({
      invariants: { noDuplicatesInServedSections: true },
      warnings: [],
      releaseBlockers: [],
      unresolvedArchetypes: 0,
    }),
    'READY_FOR_CONTROLLED_LOCAL_DEMO',
  );
});

test('summarizeDistribution and extractSectionMaterialIds are deterministic', () => {
  const summary = summarizeDistribution([4, 1, 9, 2, 7]);
  assert.equal(summary.sampleCount, 5);
  assert.equal(summary.min, 1);
  assert.equal(summary.max, 9);
  const response = homeResponse({
    suggested_materials: [
      { type: 'material', score: 1, reasons: [], material: { id: 'm1' } },
      { type: 'material', score: 1, reasons: [], material: { id: 'm2' } },
    ],
  }) as any;
  assert.deepEqual(extractSectionMaterialIds(response, 'suggested_materials'), ['m1', 'm2']);
});

test('evaluateSafetyInvariants enforces privacy and hang checks', () => {
  const invariants = evaluateSafetyInvariants({
    cases: [
      {
        archetypeKey: 'mixed',
        modeKey: 'E_both',
        httpStatus: 200,
        requestDurationMs: 20,
        materialRecommendationStatus: 'SCORED',
        projectReadinessStatus: 'READY',
        materialConfidence: 'LOW',
        projectConfidence: 'NONE',
        materialRecentSlotsUsedTop5: 0,
        materialRecentSlotsUsedTop10: 0,
        projectRecentSlotsUsedTop5: 0,
        projectRecentSlotsUsedTop10: 0,
        deterministicVsServedTop5Overlap: 0.5,
        deterministicVsServedTop10Overlap: 0.5,
        duplicateCount: 0,
        ineligibleCandidateCount: 0,
        unavailableMaterialCount: 0,
        unpublishedProjectCount: 0,
        hydrationMappingFailureCount: 0,
        fallbackOccurred: false,
        fallbackReasonCategory: null,
        homeBrowseMaterialsConsistent: true,
        homeBrowseProjectsConsistent: true,
        responseSchemaCompatible: true,
        deterministicEquivalent: false,
        candidateCountMax: 120,
      },
    ],
    fallbackIndependence: {
      materialFallbackProjectUnchanged: true,
      projectFallbackMaterialUnchanged: true,
      materialFallbackHttp200: true,
      projectFallbackHttp200: true,
    },
    reportSerialized: '{"safe":"report"}',
    latencyHangCount: 0,
  });
  assert.equal(invariants.noPrivateIdentifiersInReportOrLogs, true);
  assert.equal(invariants.noRequestHangs, true);
});
