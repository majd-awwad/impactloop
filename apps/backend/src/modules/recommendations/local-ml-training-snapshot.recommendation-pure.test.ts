import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { LearnerInterestRegistryConcept } from '../taxonomy/learner-interest-resolver.js';
import {
  canonicalJson,
  LocalMlSnapshotDiagnosticsCollector,
  LocalMlSnapshotInputError,
  LocalMlSnapshotInvariantError,
  parseEvaluationTimestamp,
  serializeLocalMlTrainingSnapshot,
  sortUniqueTokens,
  stableOpaqueKey,
} from './local-ml-training-snapshot.schema.js';
import type {
  LocalMlActorEvidence,
  LocalMlSnapshotSource,
  LocalMlSourceBucket,
} from './local-ml-training-snapshot.repository.js';
import {
  buildLocalMlTrainingSnapshot,
  classifyLocalDemoOrigin,
} from './local-ml-training-snapshot.js';

const evaluationTime = new Date('2026-07-26T12:00:00.000Z');
const before = new Date('2026-07-26T10:00:00.000Z');
const completed = new Date('2026-07-26T11:00:00.000Z');

const realActor: LocalMlActorEvidence = {
  id: 'user-real-pii@example.invalid',
  accountStatus: 'ACTIVE',
  recommendationEvidenceEligibility: 'ELIGIBLE',
};
const demoActor: LocalMlActorEvidence = {
  id: 'user-demo-+970599999999',
  accountStatus: 'ACTIVE',
  recommendationEvidenceEligibility: 'EXCLUDED_DEMO',
};

const registry = (): LearnerInterestRegistryConcept[] => [
  {
    id: 'registry-arduino',
    canonicalKey: 'interest:arduino',
    conceptType: 'INTEREST',
    status: 'ACTIVE',
    labelEn: 'Arduino',
    labelAr: 'Arduino',
    aliases: [],
    learnerInterests: [
      { id: 'legacy-arduino', learnerInterestKey: 'arduino' },
    ],
  },
];

const bucket = <T,>(
  rows: T[],
  overrides: Partial<LocalMlSourceBucket<T>> = {},
): LocalMlSourceBucket<T> => ({
  total: rows.length,
  rows,
  futureCount: 0,
  futureSampleIds: [],
  ...overrides,
});

const fixtureSource = (): LocalMlSnapshotSource => ({
  interestRegistry: registry(),
  users: bucket([
    {
      ...realActor,
      createdAt: before,
      learnerProfile: { interests: ['interest:arduino', 'interest:arduino'] },
    },
    {
      ...demoActor,
      createdAt: before,
      learnerProfile: { interests: ['arduino'] },
    },
  ]),
  materials: bucket([
    {
      id: 'material-title-private-address-private',
      createdAt: before,
      status: 'AVAILABLE',
      condition: 'GOOD',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: false,
      category: { isActive: true, categoryType: 'BOTH' },
    },
  ]),
  projects: bucket([
    {
      id: 'project-description-private-biography-private',
      createdAt: before,
      reviewedAt: before,
      status: 'PUBLISHED',
      difficulty: 'BEGINNER',
      category: { isActive: true, categoryType: 'BOTH' },
    },
  ]),
  materialConcepts: [
    {
      materialId: 'material-title-private-address-private',
      canonicalKey: 'material-form:arduino-uno',
      conceptType: 'MATERIAL_FORM',
      status: 'ACTIVE',
    },
    {
      materialId: 'material-title-private-address-private',
      canonicalKey: 'material-family:electronics',
      conceptType: 'MATERIAL_FAMILY',
      status: 'ACTIVE',
    },
  ],
  projectConcepts: [
    {
      projectId: 'project-description-private-biography-private',
      canonicalKey: 'project-topic:robotics',
      conceptType: 'PROJECT_TOPIC',
      status: 'ACTIVE',
    },
  ],
  projectComponentConcepts: [
    {
      projectId: 'project-description-private-biography-private',
      canonicalKey: 'component:dc-gear-motors',
      conceptType: 'COMPONENT',
      status: 'ACTIVE',
      isRequired: true,
    },
  ],
  materialLikes: bucket([
    {
      id: 'material-like-1',
      materialId: 'material-title-private-address-private',
      userId: realActor.id,
      createdAt: before,
      actor: realActor,
    },
  ]),
  materialViews: bucket([
    {
      id: 'material-view-2',
      materialId: 'material-title-private-address-private',
      viewerUserId: realActor.id,
      viewSource: 'material_detail',
      createdAt: before,
      actor: realActor,
    },
    {
      id: 'material-view-1',
      materialId: 'material-title-private-address-private',
      viewerUserId: realActor.id,
      viewSource: 'material_detail',
      createdAt: before,
      actor: realActor,
    },
  ]),
  projectSaves: bucket([
    {
      id: 'project-save-1',
      projectId: 'project-description-private-biography-private',
      userId: demoActor.id,
      createdAt: before,
      actor: demoActor,
    },
  ]),
  projectLikes: bucket([]),
  projectFollows: bucket([
    {
      id: 'project-follow-1',
      projectId: 'project-description-private-biography-private',
      userId: demoActor.id,
      createdAt: before,
      actor: demoActor,
    },
  ]),
  projectBuilds: bucket([
    {
      id: 'project-build-started',
      projectId: 'project-description-private-biography-private',
      learnerId: realActor.id,
      status: 'IN_PROGRESS',
      startedAt: before,
      completedAt: null,
      actor: realActor,
    },
    {
      id: 'project-build-completed',
      projectId: 'project-description-private-biography-private',
      learnerId: demoActor.id,
      status: 'COMPLETED',
      startedAt: before,
      completedAt: completed,
      actor: demoActor,
    },
  ]),
  queryStats: { counts: {}, pages: {}, conceptChunks: {} },
});

const reverseSourceCollections = (source: LocalMlSnapshotSource): LocalMlSnapshotSource => ({
  ...source,
  interestRegistry: [...source.interestRegistry].reverse(),
  users: { ...source.users, rows: [...source.users.rows].reverse() },
  materials: { ...source.materials, rows: [...source.materials.rows].reverse() },
  projects: { ...source.projects, rows: [...source.projects.rows].reverse() },
  materialConcepts: [...source.materialConcepts].reverse(),
  projectConcepts: [...source.projectConcepts].reverse(),
  projectComponentConcepts: [...source.projectComponentConcepts].reverse(),
  materialLikes: { ...source.materialLikes, rows: [...source.materialLikes.rows].reverse() },
  materialViews: { ...source.materialViews, rows: [...source.materialViews.rows].reverse() },
  projectSaves: { ...source.projectSaves, rows: [...source.projectSaves.rows].reverse() },
  projectLikes: { ...source.projectLikes, rows: [...source.projectLikes.rows].reverse() },
  projectFollows: { ...source.projectFollows, rows: [...source.projectFollows.rows].reverse() },
  projectBuilds: { ...source.projectBuilds, rows: [...source.projectBuilds.rows].reverse() },
});

describe('LM-04 schema and origin policy', () => {
  test('normalizes zoned RFC3339 input and rejects local, invalid, and missing values', () => {
    assert.equal(
      parseEvaluationTimestamp('2026-07-26T14:00:00+02:00').toISOString(),
      '2026-07-26T12:00:00.000Z',
    );
    assert.equal(
      parseEvaluationTimestamp('2026-07-26T12:00:00Z').toISOString(),
      '2026-07-26T12:00:00.000Z',
    );
    for (const value of ['', '2026-07-26', '2026-07-26T12:00:00', '2026-02-30T12:00:00Z', '2026-07-26T12:00:00Zjunk']) {
      assert.throws(() => parseEvaluationTimestamp(value), LocalMlSnapshotInputError);
    }
  });

  test('canonicalizes object keys and numbers and applies the explicit origin allowlist', () => {
    assert.equal(canonicalJson({ z: -0, a: { d: 2, c: 1 } }), '{"a":{"c":1,"d":2},"z":0}');
    assert.deepEqual(sortUniqueTokens(['z', 'a', 'z']), ['a', 'z']);
    assert.equal(classifyLocalDemoOrigin({ accountStatus: 'ACTIVE', evidenceEligibility: 'ELIGIBLE' }), 'REAL');
    assert.equal(classifyLocalDemoOrigin({ accountStatus: 'ACTIVE', evidenceEligibility: 'EXCLUDED_DEMO' }), 'DEMO_SEED');
    assert.equal(classifyLocalDemoOrigin({ accountStatus: 'ACTIVE', evidenceEligibility: 'EXCLUDED_TEST' }), 'TEST');
    for (const eventSource of ['TEST', 'LOAD_TEST', 'SYNTHETIC', 'LEGACY_UNCLASSIFIED'] as const) {
      assert.equal(classifyLocalDemoOrigin({ recommendationObservability: true, eventSource }), eventSource);
    }
    assert.equal(classifyLocalDemoOrigin({ recommendationObservability: true, eventSource: null }), 'MISSING');
    assert.equal(classifyLocalDemoOrigin({ recommendationObservability: true, eventSource: 'new-source' }), 'UNKNOWN');
  });
});

describe('LM-04 deterministic semantic snapshot', () => {
  test('sorts equivalent shuffled input identically, preserves repeated views, and emits no PII fields', async () => {
    const first = await buildLocalMlTrainingSnapshot({ evaluationTime, source: fixtureSource() });
    const second = await buildLocalMlTrainingSnapshot({
      evaluationTime,
      source: reverseSourceCollections(fixtureSource()),
    });
    const firstBytes = serializeLocalMlTrainingSnapshot(first);
    assert.deepEqual(second, first);
    assert.equal(serializeLocalMlTrainingSnapshot(second), firstBytes);
    assert.match(first.hashes.semanticContent.value, /^[a-f0-9]{64}$/);
    assert.equal(first.materialInteractions.filter((row) => row.kind === 'MATERIAL_VIEW').length, 2);
    assert.deepEqual(first.projectInteractions.map((row) => row.kind).sort(), [
      'PROJECT_BUILD_COMPLETED',
      'PROJECT_BUILD_STARTED',
      'PROJECT_FOLLOW',
      'PROJECT_SAVE',
    ]);
    assert.ok(firstBytes.endsWith('\n'));
    assert.equal(firstBytes.endsWith('\n\n'), false);
    for (const forbidden of [
      realActor.id,
      demoActor.id,
      'material-title-private-address-private',
      'project-description-private-biography-private',
      'email',
      'title',
      'description',
      'reservation',
    ]) {
      assert.equal(firstBytes.toLowerCase().includes(forbidden.toLowerCase()), false);
    }
    assert.deepEqual(Object.keys(first.users[0]!).sort(), ['featureTokens', 'userKey']);
    assert.deepEqual(Object.keys(first.materialItems[0]!).sort(), ['eligibilityState', 'featureTokens', 'materialKey']);
    assert.deepEqual(Object.keys(first.projectItems[0]!).sort(), ['eligibilityState', 'featureTokens', 'projectKey']);
  });

  test('deduplicates an identical source view identity and rejects conflicting duplicates', async () => {
    const same = fixtureSource();
    same.materialViews.rows.push({ ...same.materialViews.rows[0]! });
    const snapshot = await buildLocalMlTrainingSnapshot({ evaluationTime, source: same });
    assert.equal(snapshot.materialInteractions.filter((row) => row.kind === 'MATERIAL_VIEW').length, 2);

    const conflicting = fixtureSource();
    conflicting.materialViews.rows.push({
      ...conflicting.materialViews.rows[0]!,
      createdAt: new Date('2026-07-26T10:01:00.000Z'),
    });
    await assert.rejects(
      buildLocalMlTrainingSnapshot({ evaluationTime, source: conflicting }),
      (error: unknown) =>
        error instanceof LocalMlSnapshotInvariantError &&
        error.code === 'INVARIANT_CONFLICTING_SOURCE_IDENTITY',
    );
  });

  test('changes the semantic hash when a semantic field changes', async () => {
    const first = await buildLocalMlTrainingSnapshot({ evaluationTime, source: fixtureSource() });
    const changedSource = fixtureSource();
    changedSource.materialLikes.rows[0]!.createdAt = new Date('2026-07-26T10:00:01.000Z');
    const changed = await buildLocalMlTrainingSnapshot({ evaluationTime, source: changedSource });
    assert.notEqual(changed.hashes.semanticContent.value, first.hashes.semanticContent.value);
  });
});

describe('LM-04 exclusion and invariant behavior', () => {
  test('keeps true totals while bounding diagnostics to the smallest eight opaque keys', () => {
    const collector = new LocalMlSnapshotDiagnosticsCollector();
    const keys = Array.from({ length: 12 }, (_, index) => `key-${String(11 - index).padStart(2, '0')}`);
    for (const key of keys) collector.record('USER_NO_INTERESTS', key);
    const diagnostic = collector.diagnostics()[0]!;
    assert.equal(diagnostic.total, 12);
    assert.equal(diagnostic.sampleOpaqueKeys.length, 8);
    assert.deepEqual(diagnostic.sampleOpaqueKeys, [...keys].sort().slice(0, 8));
    assert.equal(diagnostic.truncated, true);
  });

  test('uses origin, user, then item terminal precedence and keeps optional material form absence eligible', async () => {
    const source = fixtureSource();
    source.materialConcepts = source.materialConcepts.filter((row) => row.conceptType === 'MATERIAL_FAMILY');
    source.materialLikes.rows.push(
      {
        ...source.materialLikes.rows[0]!,
        id: 'origin-excluded',
        actor: { ...realActor, recommendationEvidenceEligibility: 'EXCLUDED_TEST' },
      },
      {
        ...source.materialLikes.rows[0]!,
        id: 'user-excluded',
        userId: 'missing-user',
        actor: { ...realActor, id: 'missing-user' },
      },
      {
        ...source.materialLikes.rows[0]!,
        id: 'item-excluded',
        materialId: 'missing-material',
      },
    );
    source.materialLikes.total += 3;
    const snapshot = await buildLocalMlTrainingSnapshot({ evaluationTime, source });
    assert.equal(snapshot.materialItems.length, 1);
    assert.equal(snapshot.metadata.exclusionTotals.INTERACTION_ORIGIN_NOT_LOCAL_DEMO, 1);
    assert.equal(snapshot.metadata.exclusionTotals.INTERACTION_USER_EXCLUDED, 1);
    assert.equal(snapshot.metadata.exclusionTotals.MATERIAL_INTERACTION_ITEM_EXCLUDED, 1);
  });

  test('fails safely when a completed build has no authoritative completion timestamp', async () => {
    const source = fixtureSource();
    source.projectBuilds.rows[1]!.completedAt = null;
    await assert.rejects(
      buildLocalMlTrainingSnapshot({ evaluationTime, source }),
      (error: unknown) =>
        error instanceof LocalMlSnapshotInvariantError &&
        error.code === 'INVARIANT_COMPLETED_BUILD_TIMESTAMP_MISSING' &&
        error.message.includes('project-build-completed') === false,
    );
  });

  test('hash namespaces never expose raw identities or cross material/project domains', async () => {
    const snapshot = await buildLocalMlTrainingSnapshot({ evaluationTime, source: fixtureSource() });
    assert.equal(snapshot.users[0]?.userKey.length, 64);
    assert.notEqual(stableOpaqueKey('material', 'same'), stableOpaqueKey('project', 'same'));
    assert.ok(snapshot.materialInteractions.every((row) => row.domain === 'material' && 'materialKey' in row && !('projectKey' in row)));
    assert.ok(snapshot.projectInteractions.every((row) => row.domain === 'project' && 'projectKey' in row && !('materialKey' in row)));
  });
});
