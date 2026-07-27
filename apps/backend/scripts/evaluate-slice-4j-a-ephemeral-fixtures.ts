import { randomUUID } from "node:crypto";

import { prisma } from "../src/database/prisma.js";
import type { ShadowDiagnostics } from "../src/modules/recommendations/ml-shadow.service.js";
import type {
  ArchetypeKey,
  EvaluatedArchetype,
  LearnerFixtureRow,
} from "./evaluate-slice-4j-a-report.js";

export const MATERIAL_BURST_WINDOW_HOURS = 24;
export const PROJECT_BURST_WINDOW_HOURS = 72;

export type EphemeralArchetypeKey =
  "cold_start" | "material_coherent" | "project_scattered";

export type FixtureCleanupStatus = "SUCCESS" | "FAILED" | "SKIPPED";

export type FixtureRunState = {
  runId: string;
  marker: string;
  evaluationNow: Date;
  createdUserIds: string[];
  createdRowIds: {
    materialViews: string[];
    materialLikes: string[];
    projectSaves: string[];
    projectLikes: string[];
    projectFollows: string[];
    projectBuilds: string[];
    outboxIds: string[];
  };
  materialViewCountDeltas: Map<string, number>;
  cleaned: boolean;
};

export type EphemeralFixtureResult = {
  runState: FixtureRunState;
  forcedArchetypeLearners: Partial<Record<ArchetypeKey, string>>;
  learnerRows: LearnerFixtureRow[];
};

export type MaterialCandidateRow = {
  id: string;
  status: string;
  quantity: number;
  categoryId: string;
  conceptKey: string | null;
};

export type ProjectCandidateRow = {
  id: string;
  status: string;
  hiddenAt: Date | null;
  archivedAt: Date | null;
  conceptKey: string | null;
};

export type ArchetypeBehavioralEvidence = {
  confirmed: boolean;
  materialConfidence: string;
  projectConfidence: string;
  recentSlotsUsedTop5: number;
  recentSlotsUsedTop10: number;
  burstDistinctProjectCount?: number;
  dominantCategoryShare?: number;
  projectReadinessStatus?: string;
};

export type FixtureSummary = {
  fixtureMode: "EPHEMERAL";
  fixturesCreated: number;
  fixturesCleaned: boolean;
  cleanupStatus: FixtureCleanupStatus;
  cleanupFailureCategory?: string;
  preRunFixtureRecordCount: number;
  postRunFixtureRecordCount: number;
  archetypeBehavioralConfirmation: Partial<
    Record<EphemeralArchetypeKey, ArchetypeBehavioralEvidence>
  >;
};

const learnerSelect = {
  id: true,
  learnerProfile: { select: { interests: true } },
  _count: {
    select: {
      materialLikes: true,
      materialViews: true,
      projectSaves: true,
      projectLikes: true,
      projectBuilds: true,
    },
  },
  projectSaves: { select: { projectId: true }, take: 20 },
  projectLikes: { select: { projectId: true }, take: 20 },
  materialLikes: {
    select: { material: { select: { categoryId: true } } },
    take: 30,
  },
  materialViews: {
    select: { material: { select: { categoryId: true } } },
    take: 30,
  },
} as const;

export const createFixtureRunId = () => randomUUID();

export const createFixtureRunState = (
  runId = createFixtureRunId(),
): FixtureRunState => ({
  runId,
  marker: `slice4j-eval-${runId}`,
  evaluationNow: new Date(),
  createdUserIds: [],
  createdRowIds: {
    materialViews: [],
    materialLikes: [],
    projectSaves: [],
    projectLikes: [],
    projectFollows: [],
    projectBuilds: [],
    outboxIds: [],
  },
  materialViewCountDeltas: new Map(),
  cleaned: false,
});

export const fixtureTimestampInsideMaterialBurst = (
  evaluationNow: Date,
  hoursAgo = 2,
) => new Date(evaluationNow.getTime() - hoursAgo * 60 * 60 * 1000);

export const fixtureTimestampInsideProjectBurst = (
  evaluationNow: Date,
  hoursAgo = 12,
) => new Date(evaluationNow.getTime() - hoursAgo * 60 * 60 * 1000);

export const isTimestampInsideBurstWindow = (
  timestamp: Date,
  evaluationNow: Date,
  windowHours: number,
) => {
  const ageMs = evaluationNow.getTime() - timestamp.getTime();
  return ageMs >= 0 && ageMs <= windowHours * 60 * 60 * 1000;
};

export const isMaterialCandidateEligible = (row: MaterialCandidateRow) =>
  row.status === "AVAILABLE" && row.quantity > 0 && Boolean(row.conceptKey);

export const isProjectCandidateEligible = (row: ProjectCandidateRow) =>
  row.status === "PUBLISHED" &&
  row.hiddenAt === null &&
  row.archivedAt === null &&
  Boolean(row.conceptKey);

export const groupCoherentMaterialCandidates = (
  materials: MaterialCandidateRow[],
) => {
  const groups = new Map<string, MaterialCandidateRow[]>();
  for (const material of materials.filter(isMaterialCandidateEligible)) {
    const key = `${material.categoryId}:${material.conceptKey}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(material);
    groups.set(key, bucket);
  }
  return [...groups.values()].find((group) => group.length >= 4) ?? null;
};

export const selectScatteredProjectCandidates = (
  projects: ProjectCandidateRow[],
) => {
  const selected: ProjectCandidateRow[] = [];
  const seenConcepts = new Set<string>();
  for (const project of projects.filter(isProjectCandidateEligible)) {
    const concept = project.conceptKey!;
    if (seenConcepts.has(concept)) continue;
    seenConcepts.add(concept);
    selected.push(project);
    if (selected.length >= 4) break;
  }
  return selected.length >= 4 ? selected : null;
};

export const buildColdStartFixtureRow = (
  userId: string,
): LearnerFixtureRow => ({
  id: userId,
  learnerProfile: { interests: [] },
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
});

const createLearnerUser = async (
  state: FixtureRunState,
  archetype: EphemeralArchetypeKey,
  interests: string[] = [],
) => {
  const user = await prisma.user.create({
    data: {
      displayName: `Slice4J Eval ${archetype}`,
      email: `slice4j-${state.runId}-${archetype}@evaluation.invalid`,
      passwordHash: "evaluation-only-hash",
      accountStatus: "ACTIVE",
      emailVerifiedAt: state.evaluationNow,
      activeRole: "LEARNER",
      roles: { create: [{ role: "LEARNER", isPrimary: true }] },
      learnerProfile: { create: { interests } },
    },
    select: { id: true },
  });
  state.createdUserIds.push(user.id);
  return user.id;
};

const createTrackedMaterialView = async (
  state: FixtureRunState,
  materialId: string,
  userId: string,
  createdAt: Date,
) => {
  const view = await prisma.materialView.create({
    data: {
      materialId,
      viewerUserId: userId,
      viewSource: "evaluation_fixture",
      createdAt,
    },
    select: { id: true },
  });
  state.createdRowIds.materialViews.push(view.id);
  state.materialViewCountDeltas.set(
    materialId,
    (state.materialViewCountDeltas.get(materialId) ?? 0) + 1,
  );
  await prisma.material.update({
    where: { id: materialId },
    data: { viewsCount: { increment: 1 } },
  });
};

const createTrackedProjectSave = async (
  state: FixtureRunState,
  projectId: string,
  userId: string,
  createdAt: Date,
) => {
  const row = await prisma.projectSave.create({
    data: { projectId, userId, createdAt },
    select: { id: true },
  });
  state.createdRowIds.projectSaves.push(row.id);
};

const createTrackedProjectFollow = async (
  state: FixtureRunState,
  projectId: string,
  userId: string,
  createdAt: Date,
) => {
  const row = await prisma.projectFollow.create({
    data: { projectId, userId, createdAt },
    select: { id: true },
  });
  state.createdRowIds.projectFollows.push(row.id);
};

const findCoherentMaterialCandidates = async (): Promise<
  MaterialCandidateRow[]
> => {
  const materials = await prisma.material.findMany({
    where: {
      status: "AVAILABLE",
      quantity: { gt: 0 },
      category: { isActive: true, categoryType: { in: ["MATERIAL", "BOTH"] } },
      taxonomyConcepts: { some: { concept: { status: "ACTIVE" } } },
    },
    select: {
      id: true,
      status: true,
      quantity: true,
      categoryId: true,
      taxonomyConcepts: {
        where: { concept: { status: "ACTIVE" } },
        select: { concept: { select: { canonicalKey: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const rows: MaterialCandidateRow[] = materials.map((material) => ({
    id: material.id,
    status: material.status,
    quantity: material.quantity,
    categoryId: material.categoryId,
    conceptKey: material.taxonomyConcepts[0]?.concept.canonicalKey ?? null,
  }));
  const group = groupCoherentMaterialCandidates(rows);
  if (!group) {
    throw new Error(
      "fixture_candidate_insufficient:material_coherent:need_4_materials_same_category_concept",
    );
  }
  return group;
};

const findScatteredProjectCandidates = async (): Promise<
  ProjectCandidateRow[]
> => {
  const projects = await prisma.learningProject.findMany({
    where: {
      status: "PUBLISHED",
      hiddenAt: null,
      archivedAt: null,
      category: { isActive: true, categoryType: { in: ["PROJECT", "BOTH"] } },
      taxonomyConcepts: { some: { concept: { status: "ACTIVE" } } },
      requiredComponents: {
        some: { taxonomyConcepts: { some: { concept: { status: "ACTIVE" } } } },
      },
    },
    select: {
      id: true,
      status: true,
      hiddenAt: true,
      archivedAt: true,
      taxonomyConcepts: {
        where: { concept: { status: "ACTIVE" } },
        select: { concept: { select: { canonicalKey: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
    take: 120,
  });
  const rows: ProjectCandidateRow[] = projects.map((project) => ({
    id: project.id,
    status: project.status,
    hiddenAt: project.hiddenAt,
    archivedAt: project.archivedAt,
    conceptKey: project.taxonomyConcepts[0]?.concept.canonicalKey ?? null,
  }));
  const selected = selectScatteredProjectCandidates(rows);
  if (!selected) {
    throw new Error(
      "fixture_candidate_insufficient:project_scattered:need_4_distinct_concept_projects",
    );
  }
  return selected;
};

const findDistinctMaterialCandidates = async (count: number) => {
  const materials = await prisma.material.findMany({
    where: {
      status: "AVAILABLE",
      quantity: { gt: 0 },
      category: { isActive: true, categoryType: { in: ["MATERIAL", "BOTH"] } },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: count + 10,
  });
  if (materials.length < count) {
    throw new Error(
      `fixture_candidate_insufficient:project_scattered:need_${count}_available_materials`,
    );
  }
  return materials.slice(0, count).map((row) => row.id);
};

const loadLearnerFixtureRows = async (userIds: string[]) =>
  prisma.user.findMany({
    where: { id: { in: userIds } },
    select: learnerSelect,
  }) as Promise<LearnerFixtureRow[]>;

export const createEphemeralFixtures = async (
  runState = createFixtureRunState(),
): Promise<EphemeralFixtureResult> => {
  const coherentMaterials = await findCoherentMaterialCandidates();
  const scatteredProjects = await findScatteredProjectCandidates();
  const engagementMaterials = await findDistinctMaterialCandidates(5);

  const materialBurstAt = fixtureTimestampInsideMaterialBurst(
    runState.evaluationNow,
    2,
  );
  const projectBurstAt = fixtureTimestampInsideProjectBurst(
    runState.evaluationNow,
    12,
  );
  const saveAt = fixtureTimestampInsideProjectBurst(runState.evaluationNow, 48);

  const coldUserId = await createLearnerUser(runState, "cold_start");
  const materialUserId = await createLearnerUser(runState, "material_coherent");
  const projectUserId = await createLearnerUser(runState, "project_scattered");

  for (const material of coherentMaterials) {
    await createTrackedMaterialView(
      runState,
      material.id,
      materialUserId,
      materialBurstAt,
    );
  }

  for (const project of scatteredProjects) {
    await createTrackedProjectSave(runState, project.id, projectUserId, saveAt);
  }
  for (const materialId of engagementMaterials) {
    await createTrackedMaterialView(
      runState,
      materialId,
      projectUserId,
      fixtureTimestampInsideProjectBurst(runState.evaluationNow, 36),
    );
  }
  for (const project of scatteredProjects.slice(0, 3)) {
    await createTrackedProjectFollow(
      runState,
      project.id,
      projectUserId,
      projectBurstAt,
    );
  }

  const learnerRows = await loadLearnerFixtureRows([
    coldUserId,
    materialUserId,
    projectUserId,
  ]);

  return {
    runState,
    forcedArchetypeLearners: {
      cold_start: coldUserId,
      material_coherent: materialUserId,
      project_scattered: projectUserId,
    },
    learnerRows,
  };
};

export const syncOutboxIdsForFixtureUsers = async (state: FixtureRunState) => {
  if (!state.createdUserIds.length) return;
  const rows = await prisma.recommendationEventOutbox.findMany({
    select: { id: true, payload: true },
  });
  const known = new Set(state.createdRowIds.outboxIds);
  for (const row of rows) {
    if (known.has(row.id)) continue;
    const payload = row.payload as { learnerId?: unknown };
    if (
      typeof payload.learnerId === "string" &&
      state.createdUserIds.includes(payload.learnerId)
    ) {
      state.createdRowIds.outboxIds.push(row.id);
      known.add(row.id);
    }
  }
};

export const countFixtureRecords = async (state: FixtureRunState) => {
  const [
    users,
    materialViews,
    materialLikes,
    projectSaves,
    projectLikes,
    projectFollows,
    projectBuilds,
    outbox,
  ] = await Promise.all([
    state.createdUserIds.length
      ? prisma.user.count({ where: { id: { in: state.createdUserIds } } })
      : 0,
    state.createdRowIds.materialViews.length
      ? prisma.materialView.count({
          where: { id: { in: state.createdRowIds.materialViews } },
        })
      : 0,
    state.createdRowIds.materialLikes.length
      ? prisma.materialLike.count({
          where: { id: { in: state.createdRowIds.materialLikes } },
        })
      : 0,
    state.createdRowIds.projectSaves.length
      ? prisma.projectSave.count({
          where: { id: { in: state.createdRowIds.projectSaves } },
        })
      : 0,
    state.createdRowIds.projectLikes.length
      ? prisma.projectLike.count({
          where: { id: { in: state.createdRowIds.projectLikes } },
        })
      : 0,
    state.createdRowIds.projectFollows.length
      ? prisma.projectFollow.count({
          where: { id: { in: state.createdRowIds.projectFollows } },
        })
      : 0,
    state.createdRowIds.projectBuilds.length
      ? prisma.projectBuild.count({
          where: { id: { in: state.createdRowIds.projectBuilds } },
        })
      : 0,
    state.createdRowIds.outboxIds.length
      ? prisma.recommendationEventOutbox.count({
          where: { id: { in: state.createdRowIds.outboxIds } },
        })
      : 0,
  ]);
  return (
    users +
    materialViews +
    materialLikes +
    projectSaves +
    projectLikes +
    projectFollows +
    projectBuilds +
    outbox
  );
};

export const cleanupEphemeralFixtures = async (state: FixtureRunState) => {
  if (state.cleaned) return;
  await syncOutboxIdsForFixtureUsers(state);

  if (state.createdRowIds.outboxIds.length) {
    await prisma.recommendationEventOutbox.deleteMany({
      where: { id: { in: state.createdRowIds.outboxIds } },
    });
  }

  if (state.createdRowIds.projectBuilds.length) {
    await prisma.projectBuildItem.deleteMany({
      where: { buildId: { in: state.createdRowIds.projectBuilds } },
    });
    await prisma.projectBuild.deleteMany({
      where: { id: { in: state.createdRowIds.projectBuilds } },
    });
  }

  if (state.createdRowIds.projectFollows.length) {
    await prisma.projectFollow.deleteMany({
      where: { id: { in: state.createdRowIds.projectFollows } },
    });
  }
  if (state.createdRowIds.projectLikes.length) {
    await prisma.projectLike.deleteMany({
      where: { id: { in: state.createdRowIds.projectLikes } },
    });
  }
  if (state.createdRowIds.projectSaves.length) {
    await prisma.projectSave.deleteMany({
      where: { id: { in: state.createdRowIds.projectSaves } },
    });
  }
  if (state.createdRowIds.materialLikes.length) {
    await prisma.materialLike.deleteMany({
      where: { id: { in: state.createdRowIds.materialLikes } },
    });
  }
  if (state.createdRowIds.materialViews.length) {
    await prisma.materialView.deleteMany({
      where: { id: { in: state.createdRowIds.materialViews } },
    });
    for (const [materialId, delta] of state.materialViewCountDeltas.entries()) {
      if (delta <= 0) continue;
      await prisma.material.update({
        where: { id: materialId },
        data: { viewsCount: { decrement: delta } },
      });
    }
  }

  if (state.createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: state.createdUserIds } },
    });
  }

  state.cleaned = true;
};

export const buildArchetypeBehavioralEvidence = (
  archetypeKey: EphemeralArchetypeKey,
  evaluated: EvaluatedArchetype | undefined,
  materialDiagnostics?: ShadowDiagnostics,
  projectDiagnostics?: ShadowDiagnostics,
): ArchetypeBehavioralEvidence => ({
  confirmed: evaluated?.archetypeResolution === "RESOLVED_CONFIRMED",
  materialConfidence: String(
    evaluated?.observedMaterialConfidence ??
      materialDiagnostics?.recentConfidence ??
      "NONE",
  ),
  projectConfidence: String(
    evaluated?.observedProjectConfidence ??
      projectDiagnostics?.recentConfidence ??
      "NONE",
  ),
  recentSlotsUsedTop5: Math.max(
    materialDiagnostics?.recentSlotsUsedTop5 ?? 0,
    projectDiagnostics?.recentSlotsUsedTop5 ?? 0,
  ),
  recentSlotsUsedTop10: Math.max(
    materialDiagnostics?.recentSlotsUsedTop10 ?? 0,
    projectDiagnostics?.recentSlotsUsedTop10 ?? 0,
  ),
  burstDistinctProjectCount: projectDiagnostics?.burstDistinctProjectCount,
  dominantCategoryShare: materialDiagnostics?.dominantCategoryShare,
  projectReadinessStatus: projectDiagnostics?.projectReadinessStatus,
});

export const buildFixtureSummary = (input: {
  runState?: FixtureRunState;
  evaluatedArchetypes: EvaluatedArchetype[];
  materialDiagnosticsByArchetype?: Partial<
    Record<EphemeralArchetypeKey, ShadowDiagnostics>
  >;
  projectDiagnosticsByArchetype?: Partial<
    Record<EphemeralArchetypeKey, ShadowDiagnostics>
  >;
  cleanupStatus: FixtureCleanupStatus;
  cleanupFailureCategory?: string;
  preRunFixtureRecordCount: number;
  postRunFixtureRecordCount: number;
}): FixtureSummary => {
  const ephemeralKeys: EphemeralArchetypeKey[] = [
    "cold_start",
    "material_coherent",
    "project_scattered",
  ];
  const archetypeBehavioralConfirmation: FixtureSummary["archetypeBehavioralConfirmation"] =
    {};
  for (const key of ephemeralKeys) {
    const evaluated = input.evaluatedArchetypes.find(
      (entry) => entry.archetypeKey === key,
    );
    archetypeBehavioralConfirmation[key] = buildArchetypeBehavioralEvidence(
      key,
      evaluated,
      input.materialDiagnosticsByArchetype?.[key],
      input.projectDiagnosticsByArchetype?.[key],
    );
  }
  return {
    fixtureMode: "EPHEMERAL",
    fixturesCreated: input.runState?.createdUserIds.length ?? 0,
    fixturesCleaned: input.cleanupStatus === "SUCCESS",
    cleanupStatus: input.cleanupStatus,
    cleanupFailureCategory: input.cleanupFailureCategory,
    preRunFixtureRecordCount: input.preRunFixtureRecordCount,
    postRunFixtureRecordCount: input.postRunFixtureRecordCount,
    archetypeBehavioralConfirmation,
  };
};
