import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prisma.js";
import {
  getLearnerHome,
  getLearnerHomeSection,
  invalidateLearnerHomeCache,
} from "../src/modules/learner-home/learner-home.service.js";
import type { LearnerHomeResponse } from "../src/modules/learner-home/learner-home.types.js";
import {
  clearMlArtifactCacheForTests,
  getMlArtifactCacheStatsForTests,
  setMlShadowObserverForTests,
  type ShadowDiagnostics,
} from "../src/modules/recommendations/ml-shadow.service.js";
import {
  aggregateConfidenceDistribution,
  applyRecommendationFlags,
  ARCHETYPE_KEYS,
  buildCaseMetrics,
  buildMarkdownSummary,
  buildStableHash,
  captureRecommendationFlags,
  classifyReleaseReadiness,
  collectRequestObservations,
  computeMaterialQualityProxies,
  computeProjectQualityProxies,
  countRequestFallbacks,
  createBaselineRequestProof,
  EVALUATION_MODES,
  evaluateSafetyInvariants,
  extractSectionMaterialIds,
  extractSectionMaterials,
  extractSectionProjectIds,
  extractSectionProjects,
  ML_SHADOW_TIMEOUT_MS,
  redactReport,
  REQUIRED_REPORT_KEYS,
  resolveArtifactPaths,
  resolveEvaluatedArchetype,
  selectLearnerArchetypes,
  serializeReportForPrivacyScan,
  summarizeDistribution,
  type ArchetypeKey,
  type CaseMetrics,
  type EvaluatedArchetype,
  type EvaluationModeKey,
  type LearnerFixtureRow,
  type RecommendationFlagState,
  type Slice4jAReport,
} from "./evaluate-slice-4j-a-report.js";
import {
  buildFixtureSummary,
  cleanupEphemeralFixtures,
  countFixtureRecords,
  createEphemeralFixtures,
  syncOutboxIdsForFixtureUsers,
  type EphemeralArchetypeKey,
  type EphemeralFixtureResult,
  type FixtureCleanupStatus,
  type FixtureRunState,
} from "./evaluate-slice-4j-a-ephemeral-fixtures.js";

const repositoryRoot = path.resolve(process.cwd(), "../..");
const artifactPaths = resolveArtifactPaths(repositoryRoot);
const outputDir = path.join(process.cwd(), "generated/evaluation");
const jsonOutputPath = path.join(outputDir, "slice-4j-a-evaluation.json");
const markdownOutputPath = path.join(
  outputDir,
  "slice-4j-a-evaluation-summary.md",
);

const priorFlags = captureRecommendationFlags(env);
const allObservations: Array<
  ShadowDiagnostics & { domain: "material" | "project" }
> = [];
const releaseBlockers: string[] = [];
const warnings: string[] = [];
const modeComparisons: CaseMetrics[] = [];
const baselineByArchetype = new Map<ArchetypeKey, LearnerHomeResponse>();
let latencyHangCount = 0;
let fixtureState: FixtureRunState | undefined;
let fixtureCleanupStatus: FixtureCleanupStatus = "SKIPPED";
let fixtureCleanupFailureCategory: string | undefined;
const fixtureCleanupBlockers: string[] = [];
let preRunFixtureRecordCount = 0;
let postRunFixtureRecordCount = 0;
const ephemeralDiagnosticsByArchetype = new Map<
  EphemeralArchetypeKey,
  { material?: ShadowDiagnostics; project?: ShadowDiagnostics }
>();

const ensureFixtureCleanup = async (reason: string) => {
  if (!fixtureState) {
    fixtureCleanupStatus = "SKIPPED";
    return;
  }
  if (fixtureState.cleaned) return;
  try {
    await syncOutboxIdsForFixtureUsers(fixtureState);
    await cleanupEphemeralFixtures(fixtureState);
    postRunFixtureRecordCount = await countFixtureRecords(fixtureState);
    if (postRunFixtureRecordCount > 0) {
      fixtureCleanupStatus = "FAILED";
      fixtureCleanupFailureCategory = `residual_records_after_${reason}`;
      if (
        !fixtureCleanupBlockers.includes("ephemeral_fixture_cleanup_failed")
      ) {
        fixtureCleanupBlockers.push("ephemeral_fixture_cleanup_failed");
      }
    } else {
      fixtureCleanupStatus = "SUCCESS";
    }
  } catch (error) {
    fixtureCleanupStatus = "FAILED";
    fixtureCleanupFailureCategory =
      error instanceof Error ? error.message : `cleanup_error_${reason}`;
    if (!fixtureCleanupBlockers.includes("ephemeral_fixture_cleanup_failed")) {
      fixtureCleanupBlockers.push("ephemeral_fixture_cleanup_failed");
    }
  }
};

const registerFixtureSignalHandlers = () => {
  const handleSignal = (signal: "SIGINT" | "SIGTERM") => {
    void ensureFixtureCleanup(signal).finally(() => {
      restoreEnvironment();
      process.exit(signal === "SIGINT" ? 130 : 143);
    });
  };
  process.once("SIGINT", () => handleSignal("SIGINT"));
  process.once("SIGTERM", () => handleSignal("SIGTERM"));
};

const observationsForRun: Array<
  ShadowDiagnostics & { domain: "material" | "project" }
> = [];
setMlShadowObserverForTests((value) => {
  observationsForRun.push(value);
  allObservations.push(value);
});

const restoreEnvironment = () => {
  applyRecommendationFlags(env, priorFlags);
  clearMlArtifactCacheForTests();
  setMlShadowObserverForTests(undefined);
};

const flagsForMode = (modeKey: EvaluationModeKey): RecommendationFlagState => ({
  ...EVALUATION_MODES[modeKey],
  materialPath: artifactPaths.material,
  projectPath: artifactPaths.project,
});

const parseCliOptions = () => {
  const modeArg = process.argv
    .find((argument) => argument.startsWith("--mode="))
    ?.slice("--mode=".length);
  const latencyOnly = process.argv.includes("--latency-only");
  const modeFilter =
    modeArg && modeArg in EVALUATION_MODES
      ? (modeArg as EvaluationModeKey)
      : undefined;
  return { modeFilter, latencyOnly };
};

const probeArchetypes = async (
  selections: ReturnType<typeof selectLearnerArchetypes>,
  learners: LearnerFixtureRow[],
): Promise<EvaluatedArchetype[]> => {
  applyRecommendationFlags(env, flagsForMode("B_shadow"));
  clearMlArtifactCacheForTests();
  const evaluated: EvaluatedArchetype[] = [];
  for (const selection of selections) {
    if (!selection.learnerId) {
      evaluated.push(
        resolveEvaluatedArchetype(selection, undefined, undefined, undefined),
      );
      continue;
    }
    const learner = learners.find((row) => row.id === selection.learnerId);
    const { observations } = await collectRequestObservations(
      observationsForRun,
      async () => {
        invalidateLearnerHomeCache(selection.learnerId!);
        await getLearnerHome(selection.learnerId!);
      },
    );
    evaluated.push(
      resolveEvaluatedArchetype(
        selection,
        learner,
        observations.find((entry) => entry.domain === "material"),
        observations.find((entry) => entry.domain === "project"),
      ),
    );
    if (
      selection.archetypeKey === "cold_start" ||
      selection.archetypeKey === "material_coherent" ||
      selection.archetypeKey === "project_scattered"
    ) {
      ephemeralDiagnosticsByArchetype.set(selection.archetypeKey, {
        material: observations.find((entry) => entry.domain === "material"),
        project: observations.find((entry) => entry.domain === "project"),
      });
    }
  }
  return evaluated;
};

const loadLearners = async (): Promise<LearnerFixtureRow[]> =>
  prisma.user.findMany({
    where: { roles: { some: { role: "LEARNER" } } },
    orderBy: { createdAt: "asc" },
    take: 40,
    select: {
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
    },
  });

const loadUnpublishedProjectIds = async () => {
  const rows = await prisma.learningProject.findMany({
    where: {
      OR: [
        { status: { not: "PUBLISHED" } },
        { hiddenAt: { not: null } },
        { archivedAt: { not: null } },
      ],
    },
    select: { id: true },
    take: 500,
  });
  return new Set(rows.map((row) => row.id));
};

const runLearnerCase = async (input: {
  learnerId: string;
  archetypeKey: ArchetypeKey;
  modeKey: EvaluationModeKey;
  unpublishedProjectIds: Set<string>;
  materialPath?: string;
  projectPath?: string;
}) => {
  const modeFlags = flagsForMode(input.modeKey);
  if (input.materialPath) modeFlags.materialPath = input.materialPath;
  if (input.projectPath) modeFlags.projectPath = input.projectPath;

  applyRecommendationFlags(env, modeFlags);
  clearMlArtifactCacheForTests();
  invalidateLearnerHomeCache(input.learnerId);
  observationsForRun.length = 0;

  const started = performance.now();
  let httpStatus = 200;
  let home: LearnerHomeResponse;
  try {
    home = await getLearnerHome(input.learnerId);
  } catch {
    httpStatus = 500;
    throw new Error(
      `learner_home_failed:${input.archetypeKey}:${input.modeKey}`,
    );
  }
  const requestDurationMs = performance.now() - started;
  if (requestDurationMs > ML_SHADOW_TIMEOUT_MS * 3) {
    latencyHangCount += 1;
  }

  const materialsSection = await getLearnerHomeSection(
    input.learnerId,
    "suggested_materials",
    20,
  );
  const projectsSection = await getLearnerHomeSection(
    input.learnerId,
    "suggested_projects",
    10,
  );

  const materialDiagnostics = observationsForRun.find(
    (value) => value.domain === "material",
  );
  const projectDiagnostics = observationsForRun.find(
    (value) => value.domain === "project",
  );
  const baseline = baselineByArchetype.get(input.archetypeKey);
  const deterministicEquivalent = baseline
    ? JSON.stringify(home) === JSON.stringify(baseline)
    : input.modeKey === "A_baseline";

  if (input.modeKey === "A_baseline") {
    baselineByArchetype.set(input.archetypeKey, home);
  }

  const metrics = buildCaseMetrics({
    archetypeKey: input.archetypeKey,
    modeKey: input.modeKey,
    httpStatus,
    requestDurationMs,
    home,
    materialsSection,
    projectsSection,
    materialDiagnostics,
    projectDiagnostics,
    baselineHome: baseline,
    deterministicEquivalent,
    unpublishedProjectIds: input.unpublishedProjectIds,
  });

  if (
    metrics.unavailableMaterialCount > 0 ||
    metrics.ineligibleCandidateCount > 0
  ) {
    releaseBlockers.push(
      `ranking_correctness_defect:${input.archetypeKey}:${input.modeKey}:ineligible_or_unavailable_material`,
    );
    throw new Error("ranking_correctness_defect_detected");
  }
  if (metrics.unpublishedProjectCount > 0) {
    releaseBlockers.push(
      `ranking_correctness_defect:${input.archetypeKey}:${input.modeKey}:unpublished_project`,
    );
    throw new Error("ranking_correctness_defect_detected");
  }

  modeComparisons.push(metrics);
  return { home, metrics, materialDiagnostics, projectDiagnostics };
};

const discoverSparseCandidateLearner = async (
  learners: LearnerFixtureRow[],
) => {
  applyRecommendationFlags(env, flagsForMode("B_shadow"));
  clearMlArtifactCacheForTests();
  let sparseLearnerId: string | undefined;
  let lowestCandidateCount = Number.MAX_SAFE_INTEGER;
  for (const learner of learners.slice(0, 10)) {
    observationsForRun.length = 0;
    invalidateLearnerHomeCache(learner.id);
    await getLearnerHome(learner.id);
    const candidateCount = Math.min(
      observationsForRun.find((value) => value.domain === "material")
        ?.candidateCount ?? Number.MAX_SAFE_INTEGER,
      observationsForRun.find((value) => value.domain === "project")
        ?.runtimeCandidateCount ??
        observationsForRun.find((value) => value.domain === "project")
          ?.candidateCount ??
        Number.MAX_SAFE_INTEGER,
    );
    if (candidateCount < lowestCandidateCount) {
      lowestCandidateCount = candidateCount;
      sparseLearnerId = learner.id;
    }
  }
  return sparseLearnerId;
};

const runFallbackIndependence = async (input: {
  learnerId: string;
  unpublishedProjectIds: Set<string>;
}) => {
  applyRecommendationFlags(env, flagsForMode("D_project"));
  clearMlArtifactCacheForTests();
  invalidateLearnerHomeCache(input.learnerId);
  const modeDValid = await getLearnerHome(input.learnerId);
  const modeDProjects = extractSectionProjectIds(
    modeDValid,
    "suggested_projects",
  ).slice(0, 4);

  applyRecommendationFlags(env, {
    ...flagsForMode("D_project"),
    materialPath: `${artifactPaths.material}.missing`,
  });
  clearMlArtifactCacheForTests();
  invalidateLearnerHomeCache(input.learnerId);
  observationsForRun.length = 0;
  let materialFallbackHttp200 = true;
  let materialFallbackProjectUnchanged = true;
  try {
    const modeDMaterialBroken = await getLearnerHome(input.learnerId);
    materialFallbackProjectUnchanged =
      JSON.stringify(modeDProjects) ===
      JSON.stringify(
        extractSectionProjectIds(
          modeDMaterialBroken,
          "suggested_projects",
        ).slice(0, 4),
      );
  } catch {
    materialFallbackHttp200 = false;
  }

  applyRecommendationFlags(env, flagsForMode("C_material"));
  clearMlArtifactCacheForTests();
  invalidateLearnerHomeCache(input.learnerId);
  const modeCValid = await getLearnerHome(input.learnerId);
  const modeCMaterials = extractSectionMaterialIds(
    modeCValid,
    "suggested_materials",
  ).slice(0, 4);

  applyRecommendationFlags(env, {
    ...flagsForMode("C_material"),
    projectPath: `${artifactPaths.project}.missing`,
  });
  clearMlArtifactCacheForTests();
  invalidateLearnerHomeCache(input.learnerId);
  observationsForRun.length = 0;
  let projectFallbackHttp200 = true;
  let projectFallbackMaterialUnchanged = true;
  try {
    const modeCProjectBroken = await getLearnerHome(input.learnerId);
    projectFallbackMaterialUnchanged =
      JSON.stringify(modeCMaterials) ===
      JSON.stringify(
        extractSectionMaterialIds(
          modeCProjectBroken,
          "suggested_materials",
        ).slice(0, 4),
      );
  } catch {
    projectFallbackHttp200 = false;
  }

  return {
    materialFallbackProjectUnchanged,
    projectFallbackMaterialUnchanged,
    materialFallbackHttp200,
    projectFallbackHttp200,
  };
};

const runLatencyBenchmark = async (
  resolvedArchetypes: Array<{ archetypeKey: ArchetypeKey; learnerId: string }>,
  modeFilter?: EvaluationModeKey,
) => {
  const summary: Record<string, unknown> = {};
  const modes = (
    modeFilter ? [modeFilter] : Object.keys(EVALUATION_MODES)
  ) as EvaluationModeKey[];

  for (const modeKey of modes) {
    const warmDurations: number[] = [];
    let fallbackCount = 0;

    applyRecommendationFlags(env, flagsForMode(modeKey));
    clearMlArtifactCacheForTests();
    observationsForRun.length = 0;

    const coldLearner = resolvedArchetypes[0]!.learnerId;
    const artifactBeforeCold = getMlArtifactCacheStatsForTests();
    const coldSample = await collectRequestObservations(
      observationsForRun,
      async () => {
        invalidateLearnerHomeCache(coldLearner);
        const coldStarted = performance.now();
        await getLearnerHome(coldLearner);
        return performance.now() - coldStarted;
      },
    );
    const coldDurationMs = coldSample.result;
    fallbackCount += countRequestFallbacks(coldSample.observations);
    const baselineProof =
      modeKey === "A_baseline"
        ? createBaselineRequestProof(
            coldSample.observations,
            artifactBeforeCold,
            getMlArtifactCacheStatsForTests(),
          )
        : undefined;

    for (let index = 0; index < 8; index += 1) {
      const learner = resolvedArchetypes[index % resolvedArchetypes.length]!;
      const warmSample = await collectRequestObservations(
        observationsForRun,
        async () => {
          invalidateLearnerHomeCache(learner.learnerId);
          const started = performance.now();
          await getLearnerHome(learner.learnerId);
          return performance.now() - started;
        },
      );
      warmDurations.push(warmSample.result);
      fallbackCount += countRequestFallbacks(warmSample.observations);
    }

    summary[modeKey] = {
      cold: { sampleCount: 1, durationMs: Math.round(coldDurationMs) },
      warm: summarizeDistribution(warmDurations),
      fallbackCount,
      ...(baselineProof ? { baselineProof } : {}),
      environmentalVarianceNote:
        "Home-path latency may include database and cache variance; existing scorer thresholds are not modified.",
    };
  }
  return summary;
};

const runBaselineOnly = async (
  resolvedArchetypes: Array<{ archetypeKey: ArchetypeKey; learnerId: string }>,
) => {
  const latencySummary = await runLatencyBenchmark(
    resolvedArchetypes,
    "A_baseline",
  );
  const baseline = latencySummary.A_baseline as {
    fallbackCount: number;
    baselineProof?: ReturnType<typeof createBaselineRequestProof>;
  };
  const envelope = {
    slice4jABaselineValidation: {
      mode: "A_baseline",
      latencySummary,
      baselineProof: baseline.baselineProof,
      fallbackCount: baseline.fallbackCount,
    },
  };
  console.log(JSON.stringify(envelope, null, 2));
};

const buildQualityProxies = (
  cases: CaseMetrics[],
  diagnostics: Array<ShadowDiagnostics & { domain: "material" | "project" }>,
  learnerContexts: Map<
    ArchetypeKey,
    {
      interests: string[];
      savedCity: string | null;
      prefersDelivery: boolean;
      prefersFree: boolean;
      hasContinueProjects: boolean;
      home: LearnerHomeResponse;
    }
  >,
) => {
  const servedCases = cases.filter(
    (entry) =>
      entry.modeKey === "C_material" ||
      entry.modeKey === "D_project" ||
      entry.modeKey === "E_both",
  );
  const archetypeKey = servedCases[0]?.archetypeKey ?? "mixed";
  const context = learnerContexts.get(archetypeKey);
  const materialDiagnostics = diagnostics.find(
    (entry) => entry.domain === "material",
  );
  const projectDiagnostics = diagnostics.find(
    (entry) => entry.domain === "project",
  );
  const home = context?.home;
  return {
    materials: computeMaterialQualityProxies({
      materials: home ? extractSectionMaterials(home) : [],
      interests: context?.interests ?? [],
      savedCity: context?.savedCity ?? null,
      prefersDelivery: context?.prefersDelivery ?? false,
      prefersFree: context?.prefersFree ?? false,
      recentDomainRepresentation:
        materialDiagnostics?.fusedTop5RecentDomainCount ?? 0,
      longTermRecentOverlap:
        materialDiagnostics?.longTermRecentTop5OverlapCount ?? 0,
      recentSlotsUsed: materialDiagnostics?.recentSlotsUsedTop5 ?? 0,
    }),
    projects: computeProjectQualityProxies({
      projects: home ? extractSectionProjects(home) : [],
      interests: context?.interests ?? [],
      recentDomainRepresentation:
        projectDiagnostics?.fusedTop5RecentDomainCount ?? 0,
      longTermRecentOverlap:
        projectDiagnostics?.longTermRecentTop5OverlapCount ?? 0,
      recentSlotsUsed: projectDiagnostics?.recentSlotsUsedTop5 ?? 0,
      hasContinueProjects: context?.hasContinueProjects ?? false,
    }),
  };
};

const main = async () => {
  const { modeFilter, latencyOnly } = parseCliOptions();
  registerFixtureSignalHandlers();
  let gitHead: string | null = null;
  let ephemeralFixture: EphemeralFixtureResult | undefined;
  let evaluatedArchetypes: EvaluatedArchetype[] = [];

  try {
    gitHead = execSync("git rev-parse HEAD", {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    gitHead = null;
  }

  try {
    const unpublishedProjectIds = await loadUnpublishedProjectIds();
    const seedLearners = await loadLearners();
    if (!seedLearners.length) {
      throw new Error("seeded_learner_fixtures_required");
    }

    ephemeralFixture = await createEphemeralFixtures();
    fixtureState = ephemeralFixture.runState;
    preRunFixtureRecordCount = 0;

    const forcedIds = new Set(
      Object.values(ephemeralFixture.forcedArchetypeLearners).filter(
        Boolean,
      ) as string[],
    );
    const learners = [
      ...ephemeralFixture.learnerRows,
      ...seedLearners.filter((row) => !forcedIds.has(row.id)),
    ];

    const sparseLearnerId = await discoverSparseCandidateLearner(learners);
    const archetypeSelections = selectLearnerArchetypes(
      learners,
      sparseLearnerId,
      ephemeralFixture.forcedArchetypeLearners,
    );
    evaluatedArchetypes = await probeArchetypes(archetypeSelections, learners);

    const unresolvedArchetypes = evaluatedArchetypes.filter(
      (entry) => entry.archetypeResolution === "UNRESOLVED",
    );
    const unconfirmedArchetypes = evaluatedArchetypes.filter(
      (entry) => entry.archetypeResolution === "RESOLVED_UNCONFIRMED",
    );
    if (unresolvedArchetypes.length) {
      warnings.push(
        `Unresolved archetypes: ${unresolvedArchetypes.map((entry) => entry.archetypeKey).join(", ")}`,
      );
    }
    if (unconfirmedArchetypes.length) {
      warnings.push(
        `Behaviorally unconfirmed archetypes: ${unconfirmedArchetypes.map((entry) => entry.archetypeKey).join(", ")}`,
      );
    }

    const resolvedArchetypes = evaluatedArchetypes
      .filter(
        (entry) =>
          entry.archetypeStatus === "RESOLVED" && entry.accountCriteriaMatched,
      )
      .map((entry) => ({
        archetypeKey: entry.archetypeKey,
        learnerId: archetypeSelections.find(
          (row) => row.archetypeKey === entry.archetypeKey,
        )!.learnerId!,
      }));

    if (modeFilter === "A_baseline") {
      if (!resolvedArchetypes.length)
        throw new Error("no_resolved_archetypes_for_baseline");
      await runBaselineOnly(resolvedArchetypes);
      return;
    }

    const learnerContexts = new Map<
      ArchetypeKey,
      {
        interests: string[];
        savedCity: string | null;
        prefersDelivery: boolean;
        prefersFree: boolean;
        hasContinueProjects: boolean;
        home: LearnerHomeResponse;
      }
    >();

    for (const archetype of resolvedArchetypes) {
      for (const modeKey of Object.keys(
        EVALUATION_MODES,
      ) as EvaluationModeKey[]) {
        const result = await runLearnerCase({
          learnerId: archetype.learnerId,
          archetypeKey: archetype.archetypeKey,
          modeKey,
          unpublishedProjectIds,
        });
        if (
          modeKey === "E_both" &&
          !learnerContexts.has(archetype.archetypeKey)
        ) {
          const profile = learners.find(
            (learner) => learner.id === archetype.learnerId,
          );
          learnerContexts.set(archetype.archetypeKey, {
            interests: profile?.learnerProfile?.interests ?? [],
            savedCity: null,
            prefersDelivery: false,
            prefersFree: false,
            hasContinueProjects: Boolean(
              result.home.sections.find(
                (section) => section.key === "continue_projects",
              )?.items.length,
            ),
            home: result.home,
          });
        }
      }
    }

    const fallbackIndependence = resolvedArchetypes[0]
      ? await runFallbackIndependence({
          learnerId: resolvedArchetypes[0].learnerId,
          unpublishedProjectIds,
        })
      : {
          materialFallbackProjectUnchanged: true,
          projectFallbackMaterialUnchanged: true,
          materialFallbackHttp200: true,
          projectFallbackHttp200: true,
        };

    const latencySummary = resolvedArchetypes.length
      ? await runLatencyBenchmark(resolvedArchetypes, modeFilter)
      : {};

    const artifactVersions = {
      material:
        allObservations.find((entry) => entry.domain === "material")
          ?.artifactVersion ?? "unknown",
      project:
        allObservations.find((entry) => entry.domain === "project")
          ?.artifactVersion ?? "unknown",
    };
    const featureSchemaVersions = {
      material:
        allObservations.find((entry) => entry.domain === "material")
          ?.featureSchemaVersion ?? "unknown",
      project:
        allObservations.find((entry) => entry.domain === "project")
          ?.featureSchemaVersion ?? "unknown",
    };

    const confidenceDistributions = aggregateConfidenceDistribution(
      modeComparisons,
      allObservations,
    );
    const qualityProxies = buildQualityProxies(
      modeComparisons,
      allObservations,
      learnerContexts,
    );
    const fallbackSummary = {
      totalFallbackCases: modeComparisons.filter(
        (entry) => entry.fallbackOccurred,
      ).length,
      byReason: modeComparisons.reduce<Record<string, number>>(
        (accumulator, entry) => {
          const reason = entry.fallbackReasonCategory ?? "none";
          accumulator[reason] =
            (accumulator[reason] ?? 0) + (entry.fallbackOccurred ? 1 : 0);
          return accumulator;
        },
        {},
      ),
    };

    await ensureFixtureCleanup("evaluation_complete");
    if (fixtureCleanupBlockers.length) {
      releaseBlockers.push(...fixtureCleanupBlockers);
    }

    const reportDraft: Slice4jAReport = {
      runMetadata: {
        generatedAt: new Date().toISOString(),
        nodeVersion: process.version,
        gitHeadPrefix: gitHead ? gitHead.slice(0, 12) : null,
        restoredFlags: {
          shadow: priorFlags.shadow,
          materialServing: priorFlags.materialServing,
          projectServing: priorFlags.projectServing,
        },
        evaluationModes: Object.keys(EVALUATION_MODES),
        archetypeKeys: ARCHETYPE_KEYS,
        fixtureSummary: buildFixtureSummary({
          runState: fixtureState,
          evaluatedArchetypes,
          materialDiagnosticsByArchetype: {
            cold_start:
              ephemeralDiagnosticsByArchetype.get("cold_start")?.material,
            material_coherent:
              ephemeralDiagnosticsByArchetype.get("material_coherent")
                ?.material,
            project_scattered:
              ephemeralDiagnosticsByArchetype.get("project_scattered")
                ?.material,
          },
          projectDiagnosticsByArchetype: {
            cold_start:
              ephemeralDiagnosticsByArchetype.get("cold_start")?.project,
            material_coherent:
              ephemeralDiagnosticsByArchetype.get("material_coherent")?.project,
            project_scattered:
              ephemeralDiagnosticsByArchetype.get("project_scattered")?.project,
          },
          cleanupStatus: fixtureCleanupStatus,
          cleanupFailureCategory: fixtureCleanupFailureCategory,
          preRunFixtureRecordCount,
          postRunFixtureRecordCount,
        }),
      },
      artifactVersions,
      featureSchemaVersions,
      evaluatedArchetypes,
      modeComparisons,
      correctnessInvariants: {},
      qualityProxies,
      confidenceDistributions,
      latencySummary,
      fallbackSummary,
      releaseBlockers,
      warnings,
      finalRecommendation: "NOT_READY",
      determinism: {
        stableHash: "",
        excludes: ["generatedAt", "requestDurationMs", "latencySummary"],
      },
    };

    reportDraft.correctnessInvariants = evaluateSafetyInvariants({
      cases: modeComparisons,
      fallbackIndependence,
      reportSerialized: serializeReportForPrivacyScan(reportDraft),
      latencyHangCount,
    });

    reportDraft.finalRecommendation = classifyReleaseReadiness({
      invariants: reportDraft.correctnessInvariants,
      warnings,
      releaseBlockers,
      unresolvedArchetypes: unresolvedArchetypes.length,
      unconfirmedArchetypes: unconfirmedArchetypes.length,
      cleanupVerified: fixtureCleanupStatus === "SUCCESS",
      cleanupBlockers: fixtureCleanupBlockers,
    });

    reportDraft.determinism.stableHash = buildStableHash(reportDraft);
    const report = redactReport(reportDraft);

    for (const key of REQUIRED_REPORT_KEYS) {
      if (!(key in report)) {
        throw new Error(`report_missing_required_key:${key}`);
      }
    }

    await mkdir(outputDir, { recursive: true });
    const envelope = { slice4jAValidation: report };
    await writeFile(
      jsonOutputPath,
      `${JSON.stringify(envelope, null, 2)}\n`,
      "utf8",
    );
    await writeFile(markdownOutputPath, buildMarkdownSummary(report), "utf8");

    console.log(JSON.stringify(envelope, null, 2));
    console.error(`Wrote ${jsonOutputPath}`);
    console.error(`Wrote ${markdownOutputPath}`);
    if (fixtureCleanupBlockers.length) {
      process.exitCode = 1;
    }
  } catch (error) {
    if (releaseBlockers.length) {
      const partial: Slice4jAReport = {
        runMetadata: {
          generatedAt: new Date().toISOString(),
          nodeVersion: process.version,
          halted: true,
        },
        artifactVersions: { material: "unknown", project: "unknown" },
        featureSchemaVersions: { material: "unknown", project: "unknown" },
        evaluatedArchetypes: evaluatedArchetypes.map((entry) => ({
          archetypeKey: entry.archetypeKey,
          archetypeStatus: entry.archetypeStatus,
          archetypeResolution: entry.archetypeResolution,
          accountCriteriaMatched: entry.accountCriteriaMatched,
          behavioralCriteriaMatched: entry.behavioralCriteriaMatched,
        })),
        modeComparisons,
        correctnessInvariants: evaluateSafetyInvariants({
          cases: modeComparisons,
          fallbackIndependence: {
            materialFallbackProjectUnchanged: false,
            projectFallbackMaterialUnchanged: false,
            materialFallbackHttp200: false,
            projectFallbackHttp200: false,
          },
          reportSerialized: JSON.stringify({ releaseBlockers }),
          latencyHangCount,
        }),
        qualityProxies: {
          materials: {
            offlineDiagnosticProxy: true,
            disclaimer: "partial run",
            top5: {},
            top10: {},
          },
          projects: {
            offlineDiagnosticProxy: true,
            disclaimer: "partial run",
            top5: {},
            top10: {},
          },
        },
        confidenceDistributions: {},
        latencySummary: {},
        fallbackSummary: { totalFallbackCases: 0, byReason: {} },
        releaseBlockers,
        warnings,
        finalRecommendation: "NOT_READY",
        determinism: { stableHash: "partial", excludes: [] },
      };
      await mkdir(outputDir, { recursive: true });
      await writeFile(
        jsonOutputPath,
        `${JSON.stringify({ slice4jAValidation: partial }, null, 2)}\n`,
        "utf8",
      );
    }
    throw error;
  } finally {
    if (fixtureState && !fixtureState.cleaned) {
      await ensureFixtureCleanup("finally");
    }
    if (fixtureCleanupBlockers.length) {
      process.exitCode = 1;
    }
    restoreEnvironment();
  }
};

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main()
    .catch((error) => {
      console.error(
        error instanceof Error ? (error.stack ?? error.message) : error,
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { main };
