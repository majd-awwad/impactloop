import {
  buildCanonicalMaterialRuntimeFeatures,
  buildCanonicalProjectRuntimeFeatures,
  CanonicalRuntimeFeatureBuildError,
  getCanonicalRuntimeFeatureAuthority,
} from './canonical-runtime-item-features.js';
import { resolveCanonicalShadowUserFeatures } from './canonical-shadow-user-features.js';
import type {
  LocalMlActorEvidence,
  LocalMlMaterialLikeSourceRow,
  LocalMlMaterialViewSourceRow,
  LocalMlProjectBuildSourceRow,
  LocalMlProjectToggleSourceRow,
  LocalMlSnapshotSource,
} from './local-ml-training-snapshot.repository.js';
import {
  finalizeLocalMlTrainingSnapshot,
  LOCAL_ML_SNAPSHOT_DIAGNOSTIC_LIMIT,
  LOCAL_ML_SNAPSHOT_EXPORT_MODE,
  LOCAL_ML_SNAPSHOT_SCHEMA_VERSION,
  LocalMlSnapshotDiagnosticsCollector,
  LocalMlSnapshotInvariantError,
  sortUniqueTokens,
  stableOpaqueKey,
  type LocalDemoOrigin,
  type LocalDemoOriginClassification,
  type LocalMlSnapshotMaterialInteraction,
  type LocalMlSnapshotProjectInteraction,
  type LocalMlTrainingSnapshot,
  type MaterialInteractionKind,
  type ProjectInteractionKind,
} from './local-ml-training-snapshot.schema.js';

const asciiCompare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export const classifyLocalDemoOrigin = (input: {
  accountStatus?: string | null;
  evidenceEligibility?: string | null;
  recommendationObservability?: boolean;
  eventSource?: unknown;
}): LocalDemoOriginClassification => {
  if (input.recommendationObservability) {
    if (input.eventSource === null || input.eventSource === undefined) {
      return 'MISSING';
    }
    if (
      input.eventSource === 'TEST' ||
      input.eventSource === 'LOAD_TEST' ||
      input.eventSource === 'SYNTHETIC' ||
      input.eventSource === 'LEGACY_UNCLASSIFIED'
    ) {
      return input.eventSource;
    }
    if (input.eventSource === 'DEMO_SEED') return 'DEMO_SEED';
    if (
      input.eventSource === 'REAL' &&
      input.accountStatus === 'ACTIVE' &&
      input.evidenceEligibility === 'ELIGIBLE'
    ) {
      return 'REAL';
    }
    return 'UNKNOWN';
  }

  if (input.evidenceEligibility === 'EXCLUDED_DEMO') return 'DEMO_SEED';
  if (input.evidenceEligibility === 'EXCLUDED_TEST') return 'TEST';
  if (
    input.evidenceEligibility === 'ELIGIBLE' &&
    input.accountStatus === 'ACTIVE'
  ) {
    return 'REAL';
  }
  return 'UNKNOWN';
};

const allowedOrigin = (
  actor: LocalMlActorEvidence | null | undefined,
): LocalDemoOrigin | null => {
  if (!actor || actor.accountStatus !== 'ACTIVE') return null;
  const origin = classifyLocalDemoOrigin({
    accountStatus: actor.accountStatus,
    evidenceEligibility: actor.recommendationEvidenceEligibility,
  });
  return origin === 'REAL' || origin === 'DEMO_SEED' ? origin : null;
};

const toIso = (date: Date, opaqueKey: string): string => {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new LocalMlSnapshotInvariantError(
      'INVARIANT_INVALID_TIMESTAMP',
      opaqueKey,
    );
  }
  return date.toISOString();
};

const groupBy = <T,>(
  rows: readonly T[],
  key: (row: T) => string,
): Map<string, T[]> => {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = key(row);
    result.set(groupKey, [...(result.get(groupKey) ?? []), row]);
  }
  return result;
};

const registerOpaqueKey = (
  seen: Map<string, string>,
  opaqueKey: string,
  sourceIdentity: string,
): void => {
  const prior = seen.get(opaqueKey);
  if (prior !== undefined && prior !== sourceIdentity) {
    throw new LocalMlSnapshotInvariantError(
      'INVARIANT_DUPLICATE_OPAQUE_KEY',
      opaqueKey,
    );
  }
  seen.set(opaqueKey, sourceIdentity);
};

const futureSamples = (
  sourceName: string,
  ids: readonly string[],
  namespace: 'user' | 'material' | 'project' | 'interaction',
): string[] =>
  ids.map((id) =>
    stableOpaqueKey(namespace, namespace === 'interaction' ? `${sourceName}:${id}` : id),
  );

const interactionSort = <
  T extends { occurredAtUtc: string; interactionKey: string },
>(left: T, right: T): number =>
  asciiCompare(left.occurredAtUtc, right.occurredAtUtc) ||
  asciiCompare(left.interactionKey, right.interactionKey);

const actorInteractionEligibility = (input: {
  actor: LocalMlActorEvidence | null | undefined;
  rawUserId: string | null;
  userKeyById: ReadonlyMap<string, string>;
  interactionKey: string;
  diagnostics: LocalMlSnapshotDiagnosticsCollector;
}): { origin: LocalDemoOrigin; userKey: string } | null => {
  const origin = allowedOrigin(input.actor);
  if (!origin) {
    input.diagnostics.record(
      'INTERACTION_ORIGIN_NOT_LOCAL_DEMO',
      input.interactionKey,
    );
    return null;
  }
  const userKey = input.rawUserId
    ? input.userKeyById.get(input.rawUserId)
    : undefined;
  if (!userKey) {
    input.diagnostics.record('INTERACTION_USER_EXCLUDED', input.interactionKey);
    return null;
  }
  return { origin, userKey };
};

export const buildLocalMlTrainingSnapshot = async (input: {
  evaluationTime: Date;
  source: LocalMlSnapshotSource;
}): Promise<LocalMlTrainingSnapshot> => {
  const evaluationTimestampUtc = toIso(
    input.evaluationTime,
    stableOpaqueKey('interaction', 'evaluation-time'),
  );
  const diagnostics = new LocalMlSnapshotDiagnosticsCollector();
  const opaqueKeys = new Map<string, string>();

  diagnostics.recordMany(
    'USER_CREATED_AFTER_EVALUATION',
    input.source.users.futureCount,
    futureSamples('users', input.source.users.futureSampleIds, 'user'),
  );
  diagnostics.recordMany(
    'MATERIAL_CREATED_AFTER_EVALUATION',
    input.source.materials.futureCount,
    futureSamples('materials', input.source.materials.futureSampleIds, 'material'),
  );
  diagnostics.recordMany(
    'PROJECT_CREATED_AFTER_EVALUATION',
    input.source.projects.futureCount,
    futureSamples('projects', input.source.projects.futureSampleIds, 'project'),
  );

  const users: LocalMlTrainingSnapshot['users'] = [];
  const userKeyById = new Map<string, string>();
  for (const row of input.source.users.rows) {
    const userKey = stableOpaqueKey('user', row.id);
    registerOpaqueKey(opaqueKeys, userKey, `user:${row.id}`);
    if (row.accountStatus !== 'ACTIVE') {
      diagnostics.record('USER_ACCOUNT_INACTIVE', userKey);
      continue;
    }
    if (!allowedOrigin(row)) {
      diagnostics.record('USER_ORIGIN_NOT_LOCAL_DEMO', userKey);
      continue;
    }

    let built: Awaited<ReturnType<typeof resolveCanonicalShadowUserFeatures>>;
    try {
      built = await resolveCanonicalShadowUserFeatures({
        storedInterests: row.learnerProfile?.interests,
        loadRegistry: async () => input.source.interestRegistry,
      });
    } catch {
      throw new LocalMlSnapshotInvariantError(
        'INVARIANT_CANONICAL_BUILDER_FAILURE',
        userKey,
      );
    }

    if (built.resolutionStatus === 'NO_INTERESTS') {
      diagnostics.record('USER_NO_INTERESTS', userKey);
      continue;
    }
    if (built.resolutionStatus === 'PARTIALLY_MAPPED') {
      diagnostics.record('USER_PARTIALLY_MAPPED', userKey);
      continue;
    }
    if (built.resolutionStatus === 'UNMAPPED_INTERESTS') {
      diagnostics.record('USER_UNMAPPED_INTERESTS', userKey);
      continue;
    }
    const featureTokens = sortUniqueTokens(
      built.features.map(([token]) => token),
    );
    if (
      built.resolutionStatus !== 'FULLY_MAPPED' ||
      !built.hasDeclaredInterestFeatures ||
      featureTokens.length === 0
    ) {
      diagnostics.record('USER_RUNTIME_REPRESENTATION_INVALID', userKey);
      continue;
    }
    users.push({ userKey, featureTokens });
    userKeyById.set(row.id, userKey);
  }
  users.sort((left, right) => asciiCompare(left.userKey, right.userKey));

  const materialConcepts = groupBy(
    input.source.materialConcepts,
    (row) => row.materialId,
  );
  const projectConcepts = groupBy(
    input.source.projectConcepts,
    (row) => row.projectId,
  );
  const projectComponentConcepts = groupBy(
    input.source.projectComponentConcepts,
    (row) => row.projectId,
  );
  const authority = await getCanonicalRuntimeFeatureAuthority();

  const materialItems: LocalMlTrainingSnapshot['materialItems'] = [];
  const materialKeyById = new Map<string, string>();
  for (const row of input.source.materials.rows) {
    const materialKey = stableOpaqueKey('material', row.id);
    registerOpaqueKey(opaqueKeys, materialKey, `material:${row.id}`);
    if (row.status !== 'AVAILABLE') {
      diagnostics.record('MATERIAL_STATE_INELIGIBLE', materialKey);
      continue;
    }
    if (
      !row.category.isActive ||
      (row.category.categoryType !== 'MATERIAL' &&
        row.category.categoryType !== 'BOTH')
    ) {
      diagnostics.record('MATERIAL_CATEGORY_INELIGIBLE', materialKey);
      continue;
    }
    try {
      const built = buildCanonicalMaterialRuntimeFeatures({
        authority,
        concepts: (materialConcepts.get(row.id) ?? []).map((concept) => ({
          canonicalKey: concept.canonicalKey,
          conceptType: concept.conceptType,
          status: concept.status,
        })),
        condition: row.condition,
        isFree: row.isFree,
        pickupAllowed: row.pickupAllowed,
        deliveryAllowed: row.deliveryAllowed,
      });
      if (!built.scoringEligible) {
        diagnostics.record('MATERIAL_MISSING_CRITICAL_FEATURE_GROUP', materialKey);
        continue;
      }
      materialItems.push({
        materialKey,
        eligibilityState: 'AVAILABLE',
        featureTokens: sortUniqueTokens(built.features.map(([token]) => token)),
      });
      materialKeyById.set(row.id, materialKey);
    } catch (error) {
      if (error instanceof CanonicalRuntimeFeatureBuildError) {
        throw new LocalMlSnapshotInvariantError(
          'INVARIANT_CANONICAL_BUILDER_FAILURE',
          materialKey,
        );
      }
      throw error;
    }
  }
  materialItems.sort((left, right) =>
    asciiCompare(left.materialKey, right.materialKey),
  );

  const projectItems: LocalMlTrainingSnapshot['projectItems'] = [];
  const projectKeyById = new Map<string, string>();
  for (const row of input.source.projects.rows) {
    const projectKey = stableOpaqueKey('project', row.id);
    registerOpaqueKey(opaqueKeys, projectKey, `project:${row.id}`);
    if (row.status !== 'PUBLISHED') {
      diagnostics.record('PROJECT_STATE_INELIGIBLE', projectKey);
      continue;
    }
    if (
      !row.category.isActive ||
      (row.category.categoryType !== 'PROJECT' &&
        row.category.categoryType !== 'BOTH')
    ) {
      diagnostics.record('PROJECT_CATEGORY_INELIGIBLE', projectKey);
      continue;
    }
    if (!row.reviewedAt) {
      diagnostics.record('PROJECT_PUBLISHED_TIMESTAMP_MISSING', projectKey);
      continue;
    }
    if (row.reviewedAt > input.evaluationTime) {
      diagnostics.record('PROJECT_PUBLISHED_AFTER_EVALUATION', projectKey);
      continue;
    }
    try {
      const built = buildCanonicalProjectRuntimeFeatures({
        authority,
        topicConcepts: (projectConcepts.get(row.id) ?? []).map((concept) => ({
          canonicalKey: concept.canonicalKey,
          conceptType: concept.conceptType,
          status: concept.status,
        })),
        componentConcepts: (projectComponentConcepts.get(row.id) ?? []).map(
          (concept) => ({
            canonicalKey: concept.canonicalKey,
            conceptType: concept.conceptType,
            status: concept.status,
            isRequired: concept.isRequired,
          }),
        ),
        difficulty: row.difficulty,
      });
      if (!built.scoringEligible) {
        diagnostics.record('PROJECT_MISSING_CRITICAL_FEATURE_GROUP', projectKey);
        continue;
      }
      projectItems.push({
        projectKey,
        eligibilityState: 'PUBLISHED',
        featureTokens: sortUniqueTokens(built.features.map(([token]) => token)),
      });
      projectKeyById.set(row.id, projectKey);
    } catch (error) {
      if (error instanceof CanonicalRuntimeFeatureBuildError) {
        throw new LocalMlSnapshotInvariantError(
          'INVARIANT_CANONICAL_BUILDER_FAILURE',
          projectKey,
        );
      }
      throw error;
    }
  }
  projectItems.sort((left, right) =>
    asciiCompare(left.projectKey, right.projectKey),
  );

  const materialInteractions: LocalMlSnapshotMaterialInteraction[] = [];
  const projectInteractions: LocalMlSnapshotProjectInteraction[] = [];

  const recordInteractionFuture = (
    sourceName: string,
    bucket: { futureCount: number; futureSampleIds: string[] },
  ) =>
    diagnostics.recordMany(
      'INTERACTION_AFTER_EVALUATION',
      bucket.futureCount,
      futureSamples(sourceName, bucket.futureSampleIds, 'interaction'),
    );
  recordInteractionFuture('material_likes', input.source.materialLikes);
  recordInteractionFuture('material_views', input.source.materialViews);
  recordInteractionFuture('project_saves', input.source.projectSaves);
  recordInteractionFuture('project_likes', input.source.projectLikes);
  recordInteractionFuture('project_follows', input.source.projectFollows);
  recordInteractionFuture('project_builds', input.source.projectBuilds);

  const addMaterialInteraction = (
    row: LocalMlMaterialLikeSourceRow | LocalMlMaterialViewSourceRow,
    sourceName: 'material_likes' | 'material_views',
    kind: MaterialInteractionKind,
    rawUserId: string | null,
  ): void => {
    const interactionKey = stableOpaqueKey(
      'interaction',
      `${sourceName}:${row.id}`,
    );
    registerOpaqueKey(opaqueKeys, interactionKey, `${sourceName}:${row.id}`);
    const actor = actorInteractionEligibility({
      actor: row.actor,
      rawUserId,
      userKeyById,
      interactionKey,
      diagnostics,
    });
    if (!actor) return;
    const materialKey = materialKeyById.get(row.materialId);
    if (!materialKey) {
      diagnostics.record('MATERIAL_INTERACTION_ITEM_EXCLUDED', interactionKey);
      return;
    }
    materialInteractions.push({
      interactionKey,
      domain: 'material',
      kind,
      userKey: actor.userKey,
      materialKey,
      origin: actor.origin,
      occurredAtUtc: toIso(row.createdAt, interactionKey),
    });
  };

  for (const row of input.source.materialLikes.rows) {
    addMaterialInteraction(row, 'material_likes', 'MATERIAL_LIKE', row.userId);
  }

  const viewIdentity = new Map<string, string>();
  for (const row of input.source.materialViews.rows) {
    const interactionKey = stableOpaqueKey(
      'interaction',
      `material_views:${row.id}`,
    );
    const normalizedCreatedAt = toIso(row.createdAt, interactionKey);
    const fingerprint = [
      row.materialId,
      row.viewerUserId ?? '',
      row.viewSource ?? '',
      normalizedCreatedAt,
    ].join('|');
    const prior = viewIdentity.get(row.id);
    if (prior !== undefined) {
      if (prior !== fingerprint) {
        throw new LocalMlSnapshotInvariantError(
          'INVARIANT_CONFLICTING_SOURCE_IDENTITY',
          interactionKey,
        );
      }
      continue;
    }
    viewIdentity.set(row.id, fingerprint);
    if (!row.viewerUserId) {
      diagnostics.record('MATERIAL_VIEW_ANONYMOUS', interactionKey);
      continue;
    }
    if (row.viewSource !== 'material_detail') {
      diagnostics.record('MATERIAL_VIEW_SOURCE_UNSUPPORTED', interactionKey);
      continue;
    }
    addMaterialInteraction(
      row,
      'material_views',
      'MATERIAL_VIEW',
      row.viewerUserId,
    );
  }

  const addProjectToggle = (
    row: LocalMlProjectToggleSourceRow,
    sourceName: 'project_saves' | 'project_likes' | 'project_follows',
    kind: ProjectInteractionKind,
  ): void => {
    const interactionKey = stableOpaqueKey(
      'interaction',
      `${sourceName}:${row.id}`,
    );
    registerOpaqueKey(opaqueKeys, interactionKey, `${sourceName}:${row.id}`);
    const actor = actorInteractionEligibility({
      actor: row.actor,
      rawUserId: row.userId,
      userKeyById,
      interactionKey,
      diagnostics,
    });
    if (!actor) return;
    const projectKey = projectKeyById.get(row.projectId);
    if (!projectKey) {
      diagnostics.record('PROJECT_INTERACTION_ITEM_EXCLUDED', interactionKey);
      return;
    }
    projectInteractions.push({
      interactionKey,
      domain: 'project',
      kind,
      userKey: actor.userKey,
      projectKey,
      origin: actor.origin,
      occurredAtUtc: toIso(row.createdAt, interactionKey),
    });
  };
  for (const row of input.source.projectSaves.rows) {
    addProjectToggle(row, 'project_saves', 'PROJECT_SAVE');
  }
  for (const row of input.source.projectLikes.rows) {
    addProjectToggle(row, 'project_likes', 'PROJECT_LIKE');
  }
  for (const row of input.source.projectFollows.rows) {
    addProjectToggle(row, 'project_follows', 'PROJECT_FOLLOW');
  }

  for (const row of input.source.projectBuilds.rows) {
    const interactionKey = stableOpaqueKey(
      'interaction',
      `project_builds:${row.id}`,
    );
    registerOpaqueKey(opaqueKeys, interactionKey, `project_builds:${row.id}`);
    if (row.status !== 'IN_PROGRESS' && row.status !== 'COMPLETED') {
      diagnostics.record('PROJECT_BUILD_STATUS_INELIGIBLE', interactionKey);
      continue;
    }
    if (row.status === 'COMPLETED' && !row.completedAt) {
      throw new LocalMlSnapshotInvariantError(
        'INVARIANT_COMPLETED_BUILD_TIMESTAMP_MISSING',
        interactionKey,
      );
    }
    const actor = actorInteractionEligibility({
      actor: row.actor,
      rawUserId: row.learnerId,
      userKeyById,
      interactionKey,
      diagnostics,
    });
    if (!actor) continue;
    const projectKey = projectKeyById.get(row.projectId);
    if (!projectKey) {
      diagnostics.record('PROJECT_INTERACTION_ITEM_EXCLUDED', interactionKey);
      continue;
    }
    const completedByEvaluation =
      row.status === 'COMPLETED' && row.completedAt! <= input.evaluationTime;
    const occurredAt = completedByEvaluation ? row.completedAt! : row.startedAt;
    if (completedByEvaluation && occurredAt < row.startedAt) {
      throw new LocalMlSnapshotInvariantError(
        'INVARIANT_INVALID_TIMESTAMP',
        interactionKey,
      );
    }
    projectInteractions.push({
      interactionKey,
      domain: 'project',
      kind: completedByEvaluation
        ? 'PROJECT_BUILD_COMPLETED'
        : 'PROJECT_BUILD_STARTED',
      userKey: actor.userKey,
      projectKey,
      origin: actor.origin,
      occurredAtUtc: toIso(occurredAt, interactionKey),
    });
  }

  materialInteractions.sort(interactionSort);
  projectInteractions.sort(interactionSort);

  const materialByKind: Record<MaterialInteractionKind, number> = {
    MATERIAL_LIKE: 0,
    MATERIAL_VIEW: 0,
  };
  for (const row of materialInteractions) materialByKind[row.kind] += 1;
  const projectByKind: Record<ProjectInteractionKind, number> = {
    PROJECT_SAVE: 0,
    PROJECT_LIKE: 0,
    PROJECT_FOLLOW: 0,
    PROJECT_BUILD_STARTED: 0,
    PROJECT_BUILD_COMPLETED: 0,
  };
  for (const row of projectInteractions) projectByKind[row.kind] += 1;

  const materialInteractionTotal =
    input.source.materialLikes.total + input.source.materialViews.total;
  const projectInteractionTotal =
    input.source.projectSaves.total +
    input.source.projectLikes.total +
    input.source.projectFollows.total +
    input.source.projectBuilds.total;

  return finalizeLocalMlTrainingSnapshot({
    metadata: {
      schemaVersion: LOCAL_ML_SNAPSHOT_SCHEMA_VERSION,
      evaluationTimestampUtc,
      exportMode: LOCAL_ML_SNAPSHOT_EXPORT_MODE,
      originPolicy: {
        included: ['REAL', 'DEMO_SEED'],
        excluded: [
          'TEST',
          'LOAD_TEST',
          'SYNTHETIC',
          'LEGACY_UNCLASSIFIED',
          'MISSING',
          'UNKNOWN',
        ],
      },
      counts: {
        users: {
          sourceTotal: input.source.users.total,
          exported: users.length,
          excluded: input.source.users.total - users.length,
        },
        materialItems: {
          sourceTotal: input.source.materials.total,
          exported: materialItems.length,
          excluded: input.source.materials.total - materialItems.length,
        },
        projectItems: {
          sourceTotal: input.source.projects.total,
          exported: projectItems.length,
          excluded: input.source.projects.total - projectItems.length,
        },
        materialInteractions: {
          sourceTotal: materialInteractionTotal,
          exported: materialInteractions.length,
          excluded: materialInteractionTotal - materialInteractions.length,
          byKind: materialByKind,
        },
        projectInteractions: {
          sourceTotal: projectInteractionTotal,
          exported: projectInteractions.length,
          excluded: projectInteractionTotal - projectInteractions.length,
          byKind: projectByKind,
        },
      },
      exclusionTotals: diagnostics.totals(),
      diagnostics: {
        sampleLimit: LOCAL_ML_SNAPSHOT_DIAGNOSTIC_LIMIT,
        reasons: diagnostics.diagnostics(),
      },
    },
    users,
    materialItems,
    projectItems,
    materialInteractions,
    projectInteractions,
  });
};
