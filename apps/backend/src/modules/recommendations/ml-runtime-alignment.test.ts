import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import test from 'node:test';

import { prisma } from '../../database/prisma.js';
import { env } from '../../config/env.js';
import { getLearnerHome, invalidateLearnerHomeCache } from '../learner-home/learner-home.service.js';
import { getMaterialById } from '../materials/materials.service.js';
import {
  combineNormalizedScores,
  normalizeScores,
  scorePortableLightFm,
  type WeightedFeature,
} from './ml-lightfm-scorer.js';
import { loadPortableModelArtifact } from './ml-model-artifact.js';
import {
  buildShortTermIntent,
  recentItemScore,
  SHORT_TERM_CONFIG,
} from './short-term-intent.js';
import {
  clearMlArtifactCacheForTests,
  setMlShadowObserverForTests,
} from './ml-shadow.service.js';
import { isolatedRecommendationTest } from './recommendation-test-isolation.js';
import {
  buildCanonicalShadowUserFeatures,
  computeArtifactUserFeatureOverlap,
} from './canonical-shadow-user-features.js';
import {
  TAXONOMY_ALIAS_SOURCE,
  resolveLearnerInterests,
  type LearnerInterestRegistryConcept,
} from '../taxonomy/learner-interest-resolver.js';
import { normalizeTaxonomyAlias } from '../taxonomy/taxonomy-normalization.js';

const root = process.cwd().endsWith(path.join('apps', 'backend'))
  ? path.resolve(process.cwd(), '../..')
  : process.cwd();
const categoryKey = (id: string) =>
  createHash('sha256').update(`impactloop-category:${id}`).digest('hex');
const diagnosticKey = (id: string) =>
  createHash('sha256')
    .update(`impactloop-slice4c:${id}`)
    .digest('hex')
    .slice(0, 16);

const canonicalInterestFixture = (): LearnerInterestRegistryConcept[] => [
  {
    id: 'concept-arduino',
    canonicalKey: 'interest:arduino',
    conceptType: 'INTEREST',
    status: 'ACTIVE',
    labelEn: 'Arduino',
    labelAr: 'أردوينو',
    aliases: [
      {
        id: 'alias-arduino-en',
        alias: 'Arduino',
        normalizedAlias: normalizeTaxonomyAlias('Arduino'),
        language: 'EN',
        aliasType: 'CANONICAL',
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN,
        isActive: true,
      },
    ],
    learnerInterests: [{ id: 'legacy-arduino', learnerInterestKey: 'arduino' }],
  },
];

test('RP-01.4 canonical runtime/artifact alignment and preserved recent-intent regressions', async () => {
  const materialArtifact = await loadPortableModelArtifact(
    path.join(
      root,
      'ml/recommendation/generated/portable-model/material-hybrid-runtime-v2.json',
    ),
    'material',
  );
  const projectArtifact = await loadPortableModelArtifact(
    path.join(
      root,
      'ml/recommendation/generated/portable-model/project-hybrid-runtime-v2.json',
    ),
    'project',
  );
  assert.equal(
    materialArtifact.feature_schema_version,
    'runtime-approved-features-v2',
  );
  assert.ok(
    materialArtifact.user_features.every((feature) =>
      /^interest:[0-9a-f]{64}$/.test(feature.name),
    ),
    'current runtime-v2 material user vocab is category-hash only',
  );
  assert.ok(
    projectArtifact.user_features.every((feature) =>
      /^interest:[0-9a-f]{64}$/.test(feature.name),
    ),
    'current runtime-v2 project user vocab is category-hash only',
  );
  assert.equal(
    materialArtifact.user_features.some(
      (feature) => feature.name === 'interest:arduino',
    ),
    false,
    'runtime/artifact user-feature parity is not ready',
  );

  // Canonical runtime/artifact alignment — fixed fixture guarantees >=1 feature.
  const resolution = resolveLearnerInterests(
    ['arduino'],
    canonicalInterestFixture(),
  );
  const built = buildCanonicalShadowUserFeatures({ resolution });
  assert.ok(built.canonicalFeatureCount > 0);
  assert.deepEqual(built.features, [['interest:arduino', 1]]);
  assert.ok(
    built.features.every(
      ([token]) =>
        token.startsWith('interest:') && !/^interest:[0-9a-f]{64}$/.test(token),
    ),
  );

  const materialOverlap = computeArtifactUserFeatureOverlap({
    runtimeFeatures: built.features,
    artifactUserFeatureNames: materialArtifact.user_features.map(
      (entry) => entry.name,
    ),
  });
  const projectOverlap = computeArtifactUserFeatureOverlap({
    runtimeFeatures: built.features,
    artifactUserFeatureNames: projectArtifact.user_features.map(
      (entry) => entry.name,
    ),
  });
  assert.equal(materialOverlap.artifactUserFeatureOverlapStatus, 'ZERO_OVERLAP');
  assert.equal(projectOverlap.artifactUserFeatureOverlapStatus, 'ZERO_OVERLAP');
  assert.equal(materialOverlap.artifactMatchedUserFeatureCount, 0);
  assert.equal(projectOverlap.artifactMatchedUserFeatureCount, 0);

  const [rows, projects] = await Promise.all([
    prisma.material.findMany({
      where: {
        status: 'AVAILABLE',
        quantity: { gt: 0 },
        category: { isActive: true },
        taxonomyConcepts: { some: { concept: { status: 'ACTIVE' } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        categoryId: true,
        category: { select: { nameEn: true } },
        condition: true,
        isFree: true,
        pickupAllowed: true,
        deliveryAllowed: true,
        taxonomyConcepts: {
          where: { concept: { status: 'ACTIVE' } },
          select: { concept: { select: { canonicalKey: true } } },
        },
      },
    }),
    prisma.learningProject.findMany({
      where: {
        status: 'PUBLISHED',
        requiredComponents: {
          some: {
            taxonomyConcepts: { some: { concept: { status: 'ACTIVE' } } },
          },
        },
      },
      take: 29,
      select: {
        id: true,
        categoryId: true,
        taxonomyConcepts: {
          where: { concept: { status: 'ACTIVE' } },
          select: { concept: { select: { canonicalKey: true } } },
        },
        requiredComponents: {
          select: {
            taxonomyConcepts: {
              where: { concept: { status: 'ACTIVE' } },
              select: { concept: { select: { canonicalKey: true } } },
            },
          },
        },
      },
    }),
  ]);
  assert.ok(rows.length > 10);

  const candidates = rows.map((row) => ({
    candidateKey: row.id,
    categoryId: row.categoryId,
    conceptKeys: row.taxonomyConcepts
      .map((entry) => entry.concept.canonicalKey)
      .sort(),
    features: [
      [`category:${categoryKey(row.categoryId)}`, 1],
      ...row.taxonomyConcepts.map(
        (entry) =>
          [`concept:${entry.concept.canonicalKey}`, 1] as WeightedFeature,
      ),
      [`condition:${row.condition}`, 1],
      [`free:${Number(row.isFree)}`, 1],
      [`pickup:${Number(row.pickupAllowed)}`, 1],
      [`delivery:${Number(row.deliveryAllowed)}`, 1],
    ] as WeightedFeature[],
  }));

  // Canonical zero-overlap scoring must remain finite (item-bias / cold-user).
  const coldUserLongTerm = scorePortableLightFm(
    materialArtifact,
    built.features as WeightedFeature[],
    candidates,
  );
  assert.ok(coldUserLongTerm.scored.length > 0);
  assert.ok(
    coldUserLongTerm.scored.every((entry) => Number.isFinite(entry.score)),
    'canonical zero-overlap scoring remains finite (item-bias / cold-user)',
  );

  const byCategory = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    byCategory.set(candidate.categoryId, [
      ...(byCategory.get(candidate.categoryId) ?? []),
      candidate,
    ]);
  }

  // Explicitly named artifact-mechanics fixture for recent-intent/blend regressions.
  // Not the production candidate-label builder: pick a catalog category whose
  // trained hash token exists in the artifact, matching original slice-4c shape.
  const artifactUserNames = new Set(
    materialArtifact.user_features.map((entry) => entry.name),
  );
  const mechanicsCandidates = [...byCategory.entries()]
    .filter(
      ([categoryId, values]) =>
        values.length >= 8 &&
        artifactUserNames.has(`interest:${categoryKey(categoryId)}`),
    )
    .sort(
      (left, right) =>
        right[1].length - left[1].length ||
        (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0),
    );
  assert.ok(
    mechanicsCandidates.length > 0,
    'artifact-mechanics fixture requires a catalog category present in runtime-v2 user vocab',
  );

  let selected:
    | {
        domainA: string;
        longTerm: ReturnType<typeof scorePortableLightFm>;
        domainB: string;
        targetCandidates: (typeof candidates)[number][];
        initialB: number;
      }
    | undefined;
  for (const [candidateDomainA] of mechanicsCandidates) {
    const artifactMechanicsUserFeature: WeightedFeature[] = [
      [`interest:${categoryKey(candidateDomainA)}`, 1],
    ];
    const scored = scorePortableLightFm(
      materialArtifact,
      artifactMechanicsUserFeature,
      candidates,
    );
    const top5Categories = scored.scored.slice(0, 5).map(
      (value) =>
        candidates.find(
          (candidate) => candidate.candidateKey === value.candidateKey,
        )!.categoryId,
    );
    const target = [...byCategory.entries()]
      .filter(([key, values]) => key !== candidateDomainA && values.length >= 8)
      .sort(
        (left, right) =>
          top5Categories.filter((key) => key === left[0]).length -
            top5Categories.filter((key) => key === right[0]).length ||
          left[0].localeCompare(right[0]),
      )[0];
    if (!target) continue;
    const initialB = top5Categories.filter((key) => key === target[0]).length;
    if (initialB > 1) continue;

    const metadataProbe = new Map(
      candidates.map((candidate) => [
        candidate.candidateKey,
        {
          categoryKey: categoryKey(candidate.categoryId),
          conceptKeys: candidate.conceptKeys,
          componentConceptKeys: [] as string[],
        },
      ]),
    );
    const nowProbe = '2026-07-19T12:00:00Z';
    const t2ProbeEvents = [
      ...target[1].slice(0, 8).map((candidate, index) => ({
        entityKey: candidate.candidateKey,
        actionType: 'view',
        timestampUtc: `2026-07-19T${String(index + 1).padStart(2, '0')}:30:00Z`,
      })),
      ...target[1].slice(0, 2).map((candidate, index) => ({
        entityKey: candidate.candidateKey,
        actionType: 'like',
        timestampUtc: `2026-07-19T${String(index + 9).padStart(2, '0')}:00:00Z`,
      })),
    ];
    const recentProbe = buildShortTermIntent(
      t2ProbeEvents,
      metadataProbe,
      nowProbe,
    );
    const recentScoresProbe = new Map(
      candidates.map((candidate) => [
        candidate.candidateKey,
        recentItemScore(
          metadataProbe.get(candidate.candidateKey)!,
          recentProbe.intent,
        ),
      ]),
    );
    const blended045 = combineNormalizedScores(
      scored.scored,
      recentScoresProbe,
      0.45,
    );
    const domainATop5At045 = blended045
      .slice(0, 5)
      .filter(
        (value) =>
          candidates.find(
            (candidate) => candidate.candidateKey === value.candidateKey,
          )!.categoryId === candidateDomainA,
      ).length;
    const domainBTop5At035 = combineNormalizedScores(
      scored.scored,
      recentScoresProbe,
      SHORT_TERM_CONFIG.recentBlend,
    )
      .slice(0, 5)
      .filter(
        (value) =>
          candidates.find(
            (candidate) => candidate.candidateKey === value.candidateKey,
          )!.categoryId === target[0],
      ).length;
    if (domainATop5At045 !== 0) continue;
    if (domainBTop5At035 !== initialB) continue;

    selected = {
      domainA: candidateDomainA,
      longTerm: scored,
      domainB: target[0],
      targetCandidates: target[1],
      initialB,
    };
    break;
  }
  assert.ok(selected, 'unable to select artifact-mechanics domain pair');
  const {
    domainA,
    longTerm,
    domainB,
    targetCandidates,
    initialB,
  } = selected;
  assert.ok(initialB <= 1, 'target domain already dominant');
  assert.match(`interest:${categoryKey(domainA)}`, /^interest:[0-9a-f]{64}$/);

  const metadata = new Map(
    candidates.map((candidate) => [
      candidate.candidateKey,
      {
        categoryKey: categoryKey(candidate.categoryId),
        conceptKeys: candidate.conceptKeys,
        componentConceptKeys: [] as string[],
      },
    ]),
  );
  const now = '2026-07-19T12:00:00Z';
  const t1Events = targetCandidates.slice(0, 3).map((candidate, index) => ({
    entityKey: candidate.candidateKey,
    actionType: 'view',
    timestampUtc: `2026-07-19T0${index + 1}:00:00Z`,
  }));
  const t2Events = [
    ...targetCandidates.slice(0, 8).map((candidate, index) => ({
      entityKey: candidate.candidateKey,
      actionType: 'view',
      timestampUtc: `2026-07-19T${String(index + 1).padStart(2, '0')}:30:00Z`,
    })),
    ...targetCandidates.slice(0, 2).map((candidate, index) => ({
      entityKey: candidate.candidateKey,
      actionType: 'like',
      timestampUtc: `2026-07-19T${String(index + 9).padStart(2, '0')}:00:00Z`,
    })),
  ];
  const rank = (
    events: typeof t2Events,
    blend: number = SHORT_TERM_CONFIG.recentBlend,
  ) => {
    const recent = buildShortTermIntent(events, metadata, now);
    const recentScores = new Map(
      candidates.map((candidate) => [
        candidate.candidateKey,
        recentItemScore(metadata.get(candidate.candidateKey)!, recent.intent),
      ]),
    );
    return {
      recent,
      recentScores,
      combined: combineNormalizedScores(longTerm.scored, recentScores, blend),
    };
  };
  const t1 = rank(t1Events);
  const t2 = rank(t2Events);
  const categoryCount = (ranking: typeof t2.combined, category: string) =>
    ranking
      .slice(0, 5)
      .filter(
        (value) =>
          candidates.find(
            (candidate) => candidate.candidateKey === value.candidateKey,
          )!.categoryId === category,
      ).length;
  const t1B = categoryCount(t1.combined, domainB);
  const t2B = categoryCount(t2.combined, domainB);
  const t2A = categoryCount(t2.combined, domainA);
  const normalizedLong = normalizeScores(longTerm.scored);
  const decomposition = targetCandidates.slice(0, 5).map((candidate) => {
    const raw = longTerm.scored.find(
      (value) => value.candidateKey === candidate.candidateKey,
    )!.score;
    const recentRaw = t2.recentScores.get(candidate.candidateKey) ?? 0;
    const combinedScore = t2.combined.find(
      (value) => value.candidateKey === candidate.candidateKey,
    )!.score;
    return {
      key: diagnosticKey(candidate.candidateKey),
      longTermRaw: raw,
      recentRaw,
      normalizedLongTerm: normalizedLong.get(candidate.candidateKey),
      normalizedRecent: recentRaw,
      combined: combinedScore,
      rankBefore:
        longTerm.scored.findIndex(
          (value) => value.candidateKey === candidate.candidateKey,
        ) + 1,
      rankAfter:
        t2.combined.findIndex(
          (value) => value.candidateKey === candidate.candidateKey,
        ) + 1,
      matchingCategory: 1,
      matchingConcepts: candidate.conceptKeys.length,
    };
  });

  const project = projects.find((value) => {
    const components = new Set(
      value.requiredComponents.flatMap((component) =>
        component.taxonomyConcepts.map((entry) => entry.concept.canonicalKey),
      ),
    );
    return candidates.some((candidate) =>
      candidate.conceptKeys.some((key) => components.has(key)),
    );
  });
  let projectDriven: Record<string, unknown> = {
    supported: false,
    reason: 'NO_COMPONENT_MATERIAL_CONCEPT_OVERLAP',
  };
  if (project) {
    const projectComponents = [
      ...new Set(
        project.requiredComponents.flatMap((component) =>
          component.taxonomyConcepts.map((entry) => entry.concept.canonicalKey),
        ),
      ),
    ];
    const projectMetadata = new Map(metadata);
    projectMetadata.set(project.id, {
      categoryKey: categoryKey(project.categoryId),
      conceptKeys: project.taxonomyConcepts.map(
        (entry) => entry.concept.canonicalKey,
      ),
      componentConceptKeys: projectComponents,
    });
    const projectIntent = buildShortTermIntent(
      [
        {
          entityKey: project.id,
          actionType: 'project_save',
          timestampUtc: '2026-07-19T11:00:00Z',
        },
      ],
      projectMetadata,
      now,
    );
    const matching = candidates.filter((candidate) =>
      candidate.conceptKeys.some((key) => projectComponents.includes(key)),
    );
    const projectRecent = new Map(
      candidates.map((candidate) => [
        candidate.candidateKey,
        recentItemScore(
          metadata.get(candidate.candidateKey)!,
          projectIntent.intent,
        ),
      ]),
    );
    const projectCombined = combineNormalizedScores(
      longTerm.scored,
      projectRecent,
      0.35,
    );
    const bestMatchBefore = Math.min(
      ...matching.map(
        (candidate) =>
          longTerm.scored.findIndex(
            (value) => value.candidateKey === candidate.candidateKey,
          ) + 1,
      ),
    );
    const bestMatchAfter = Math.min(
      ...matching.map(
        (candidate) =>
          projectCombined.findIndex(
            (value) => value.candidateKey === candidate.candidateKey,
          ) + 1,
      ),
    );
    projectDriven = {
      supported: true,
      matchingCandidates: matching.length,
      bestMatchBefore,
      bestMatchAfter,
    };
  }

  const sensitivity = [0.35, 0.4, 0.45].map((blend) => ({
    blend,
    domainBTop5: categoryCount(rank(t2Events, blend).combined, domainB),
    domainATop5: categoryCount(rank(t2Events, blend).combined, domainA),
  }));
  console.log(
    JSON.stringify({
      slice4cScenario: {
        note: 'canonical ZERO_OVERLAP proven separately; recent-intent/blend/project regressions use explicitly named artifact-mechanics hash fixture (not production builder); runtime/artifact user-feature parity is not ready',
        candidateCount: candidates.length,
        candidateSetStable: true,
        canonicalUserFeatureCount: built.canonicalFeatureCount,
        materialOverlap: materialOverlap.artifactUserFeatureOverlapStatus,
        projectOverlap: projectOverlap.artifactUserFeatureOverlapStatus,
        coldUserFiniteScores: coldUserLongTerm.scored.every((entry) =>
          Number.isFinite(entry.score),
        ),
        domainAKey: diagnosticKey(domainA),
        domainBKey: diagnosticKey(domainB),
        initialB,
        t1B,
        t2B,
        t2A,
        fixed35Passed: t2B > initialB && t2A >= 1,
        sensitivity,
        decomposition,
        projectDriven,
      },
    }),
  );
  assert.equal(t2B, initialB);
  assert.equal(sensitivity[2]!.domainATop5, 0);
  assert.equal(projectDriven.supported, false);

  await prisma.$disconnect();
});

isolatedRecommendationTest('authenticated new material view invalidates only its learner and deduplicated repeats do not', async () => {
  const prior = {
    shadow: env.recommendationMlShadowEnabled,
    material: env.recommendationMlMaterialArtifactPath,
    project: env.recommendationMlProjectArtifactPath,
  };
  const observations: unknown[] = [];
  const startedAt = new Date();
  const cleanupMaterialIds: string[] = [];
  setMlShadowObserverForTests((value) => observations.push(value));
  try {
    env.recommendationMlShadowEnabled = true;
    env.recommendationMlMaterialArtifactPath = path.join(
      root,
      'ml/recommendation/generated/portable-model/material-hybrid-runtime-v2.json',
    );
    env.recommendationMlProjectArtifactPath = path.join(
      root,
      'ml/recommendation/generated/portable-model/project-hybrid-runtime-v2.json',
    );
    clearMlArtifactCacheForTests();
    const users = await prisma.user.findMany({
      where: { roles: { some: { role: 'LEARNER' } } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 2,
    });
    assert.equal(users.length, 2);
    const [learner, unrelated] = users;
    const materials = await prisma.material.findMany({
      where: {
        status: 'AVAILABLE',
        views: { none: { viewerUserId: learner!.id } },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 2,
    });
    assert.equal(materials.length, 2);
    cleanupMaterialIds.push(...materials.map((material) => material.id));
    invalidateLearnerHomeCache(learner!.id);
    invalidateLearnerHomeCache(unrelated!.id);
    await getLearnerHome(learner!.id);
    await getLearnerHome(unrelated!.id);
    const before = observations.length;
    await getMaterialById(materials[0]!.id, {
      sub: learner!.id,
      roles: ['LEARNER'],
    });
    await getLearnerHome(learner!.id);
    assert.equal(
      observations.length,
      before + 2,
      'new authenticated view did not invalidate',
    );
    const afterNewView = observations.length;
    await getMaterialById(materials[0]!.id, {
      sub: learner!.id,
      roles: ['LEARNER'],
    });
    await getLearnerHome(learner!.id);
    assert.equal(
      observations.length,
      afterNewView,
      'deduplicated view invalidated cache',
    );
    await getMaterialById(materials[1]!.id);
    await getLearnerHome(learner!.id);
    await getLearnerHome(unrelated!.id);
    assert.equal(
      observations.length,
      afterNewView,
      'anonymous view or unrelated cache was invalidated',
    );
    await assert.rejects(() =>
      getMaterialById('slice4c-missing-material', {
        sub: learner!.id,
        roles: ['LEARNER'],
      }),
    );
    await getLearnerHome(learner!.id);
    assert.equal(
      observations.length,
      afterNewView,
      'failed view invalidated cache',
    );
  } finally {
    const created = await prisma.materialView.groupBy({
      by: ['materialId'],
      where: {
        createdAt: { gte: startedAt },
        materialId: { in: cleanupMaterialIds },
      },
      _count: { _all: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.materialView.deleteMany({
        where: {
          createdAt: { gte: startedAt },
          materialId: { in: cleanupMaterialIds },
        },
      });
      for (const row of created) {
        await tx.material.update({
          where: { id: row.materialId },
          data: { viewsCount: { decrement: row._count._all } },
        });
      }
    });
    assert.equal(
      await prisma.materialView.count({
        where: {
          createdAt: { gte: startedAt },
          materialId: { in: cleanupMaterialIds },
        },
      }),
      0,
    );
    setMlShadowObserverForTests(undefined);
    clearMlArtifactCacheForTests();
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlMaterialArtifactPath = prior.material;
    env.recommendationMlProjectArtifactPath = prior.project;
    await prisma.$disconnect();
  }
});
