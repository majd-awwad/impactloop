import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prisma.js";
import {
  loadMlShadowConcepts,
  loadProjectPool,
} from "../src/modules/learner-home/learner-home.repository.js";
import {
  getLearnerHome,
  getLearnerHomeSection,
  invalidateLearnerHomeCache,
} from "../src/modules/learner-home/learner-home.service.js";
import { scorePortableLightFm } from "../src/modules/recommendations/ml-lightfm-scorer.js";
import { loadPortableModelArtifact } from "../src/modules/recommendations/ml-model-artifact.js";
import {
  clearMlArtifactCacheForTests,
  getMlArtifactCacheStatsForTests,
  setMlShadowObserverForTests,
  type ShadowDiagnostics,
} from "../src/modules/recommendations/ml-shadow.service.js";
import {
  captureRecommendationProcessEnv,
  resetAllRecommendationTestStateForTests,
  restoreRecommendationProcessEnv,
} from "../src/modules/recommendations/recommendation-test-isolation.js";
import {
  applyRecommendationFlags,
  captureRecommendationFlags,
  collectRequestObservations,
  createBaselineRequestProof,
  ML_SHADOW_TIMEOUT_MS,
  redactReport,
  resolveArtifactPaths,
  schemasCompatible,
  type RecommendationFlagState,
  type ShadowObservation,
} from "./recommendation-evaluation-report.js";

export const ACCEPTED_MODEL_VERSION = "slice-4c-runtime-v2";
export const ACCEPTED_FEATURE_SCHEMA = "runtime-approved-features-v2";

export type PreflightMode = "deterministic" | "material" | "project" | "both";

export type PreflightCheckResult = {
  ok: boolean;
  [key: string]: unknown;
};

export type PreflightReport = {
  mode: PreflightMode;
  passed: boolean;
  checks: Record<string, PreflightCheckResult>;
  restoration: {
    flagsRestored: boolean;
    artifactPathsRestored: boolean;
  };
};

export const PREFLIGHT_MODES: PreflightMode[] = [
  "deterministic",
  "material",
  "project",
  "both",
];

const categoryKey = (id: string) =>
  createHash("sha256").update(`impactloop-category:${id}`).digest("hex");

const projectItemFeatures = (candidate: {
  categoryId: string;
  difficulty: string;
  conceptKeys: string[];
  componentConceptKeys: string[];
}) => {
  const features: Array<[string, number]> = [
    [`category:${categoryKey(candidate.categoryId)}`, 1],
  ];
  for (const value of candidate.conceptKeys)
    features.push([`concept:${value}`, 1]);
  if (candidate.difficulty)
    features.push([`difficulty:${candidate.difficulty}`, 1]);
  for (const value of candidate.componentConceptKeys)
    features.push([`component:${value}`, 1]);
  return features;
};

export const parseMode = (argv: string[]): PreflightMode | undefined => {
  const modeArg = argv.find((arg) => arg.startsWith("--mode="));
  if (modeArg) {
    const value = modeArg.slice("--mode=".length) as PreflightMode;
    return PREFLIGHT_MODES.includes(value) ? value : undefined;
  }

  const modeIndex = argv.indexOf("--mode");
  if (modeIndex >= 0 && argv[modeIndex + 1]) {
    const value = argv[modeIndex + 1] as PreflightMode;
    return PREFLIGHT_MODES.includes(value) ? value : undefined;
  }

  const envMode = process.env.PREFLIGHT_MODE as PreflightMode | undefined;
  if (envMode && PREFLIGHT_MODES.includes(envMode)) {
    return envMode;
  }

  return undefined;
};

export const buildModeFlags = (
  mode: PreflightMode,
  artifactPaths: { material: string; project: string },
): RecommendationFlagState => {
  const serving = {
    deterministic: {
      shadow: false,
      materialServing: false,
      projectServing: false,
    },
    material: { shadow: true, materialServing: true, projectServing: false },
    project: { shadow: true, materialServing: false, projectServing: true },
    both: { shadow: true, materialServing: true, projectServing: true },
  }[mode];

  return {
    ...serving,
    materialPath: artifactPaths.material,
    projectPath: artifactPaths.project,
  };
};

const deterministicFlags = (artifactPaths: {
  material: string;
  project: string;
}): RecommendationFlagState => ({
  shadow: false,
  materialServing: false,
  projectServing: false,
  materialPath: artifactPaths.material,
  projectPath: artifactPaths.project,
});

const flagsEqual = (
  left: RecommendationFlagState,
  right: RecommendationFlagState,
) =>
  left.shadow === right.shadow &&
  left.materialServing === right.materialServing &&
  left.projectServing === right.projectServing &&
  left.materialPath === right.materialPath &&
  left.projectPath === right.projectPath;

const sanitizeDiagnostics = (diagnostics?: ShadowDiagnostics) => ({
  domain: (diagnostics as ShadowObservation | undefined)?.domain,
  mode: diagnostics?.mode,
  status: diagnostics?.status,
  projectReadinessStatus: diagnostics?.projectReadinessStatus,
  confidenceLevel: diagnostics?.recentConfidence,
  confidenceSource: diagnostics?.confidenceSource,
  recentSlotsUsedTop5: diagnostics?.recentSlotsUsedTop5,
  recentSlotsUsedTop10: diagnostics?.recentSlotsUsedTop10,
  fallbackReason: diagnostics?.fallbackReason,
  scorerDurationMs:
    diagnostics?.scorerDurationMs ?? diagnostics?.scoringDurationMs,
  fusionDurationMs: diagnostics?.fusionDurationMs,
  totalRecommendationDurationMs:
    diagnostics?.totalRecommendationDurationMs ??
    diagnostics?.totalProjectRecommendationDurationMs,
});

const terminates = (diagnostics?: ShadowDiagnostics) =>
  diagnostics?.status === "SCORED" || diagnostics?.status === "FALLBACK";

export const assessProjectCatalogReadiness = async (
  projectArtifactPath: string,
) => {
  const projects = await loadProjectPool(120);
  const concepts = await loadMlShadowConcepts(
    [],
    projects.map((project) => project.id),
  );
  const candidates = projects.map((project) => ({
    candidateKey: project.id,
    categoryId: project.category.id,
    difficulty: project.difficulty,
    conceptKeys: concepts.projectConcepts.get(project.id) ?? [],
    componentConceptKeys:
      concepts.projectComponentConcepts.get(project.id) ?? [],
  }));

  const artifact = await loadPortableModelArtifact(
    projectArtifactPath,
    "project",
  );
  const artifactNames = new Set(
    artifact.item_features.map((feature) => feature.name),
  );

  let artifactMappedCandidateCount = 0;
  for (const candidate of candidates) {
    const names = projectItemFeatures(candidate).map(([name]) => name);
    if (names.every((name) => artifactNames.has(name))) {
      artifactMappedCandidateCount += 1;
    }
  }

  const scored = scorePortableLightFm(
    artifact,
    [],
    candidates.map((candidate) => ({
      candidateKey: candidate.candidateKey,
      features: projectItemFeatures(candidate),
    })),
  );

  const runtimeKeys = candidates.map((candidate) => candidate.candidateKey);
  const scoredKeys = scored.scored.map((candidate) => candidate.candidateKey);
  const duplicateRuntime = runtimeKeys.length - new Set(runtimeKeys).size;
  const duplicateScored = scoredKeys.length - new Set(scoredKeys).size;
  const nonFinite = scored.scored.filter(
    (candidate) => !Number.isFinite(candidate.score),
  ).length;
  const runtimeCandidatesMissingFromArtifact =
    candidates.length - artifactMappedCandidateCount;
  const hydratedMappingFailureCount =
    duplicateRuntime +
    scoredKeys.filter((key) => !new Set(runtimeKeys).has(key)).length;

  const projectReadinessStatus =
    nonFinite > 0 ||
    duplicateRuntime > 0 ||
    duplicateScored > 0 ||
    runtimeCandidatesMissingFromArtifact > 0 ||
    hydratedMappingFailureCount > 0
      ? "NOT_READY"
      : "READY";

  return {
    ok: projectReadinessStatus === "READY",
    status: projectReadinessStatus,
    runtimeCandidateCount: candidates.length,
    artifactMappedCandidateCount,
    runtimeCandidatesMissingFromArtifact,
    duplicateRuntimeCandidateCount: duplicateRuntime,
    duplicateScoredCandidateCount: duplicateScored,
    nonFiniteScoreCount: nonFinite,
    hydratedMappingFailureCount,
  };
};

const selectSmokeLearnerId = async (): Promise<string> => {
  const learners = await prisma.user.findMany({
    where: { roles: { some: { role: "LEARNER" } } },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: {
      id: true,
      _count: {
        select: {
          materialLikes: true,
          materialViews: true,
          projectSaves: true,
          projectLikes: true,
          projectBuilds: true,
        },
      },
    },
  });

  if (!learners.length) {
    throw new Error("no_learner_available");
  }

  const engagement = (learner: (typeof learners)[number]) =>
    learner._count.materialLikes +
    learner._count.materialViews +
    learner._count.projectSaves +
    learner._count.projectLikes +
    learner._count.projectBuilds;

  return (learners.find((learner) => engagement(learner) > 0) ?? learners[0])
    .id;
};

export const buildPreflightReport = (
  mode: PreflightMode,
  checks: Record<string, PreflightCheckResult>,
  restoration: PreflightReport["restoration"],
): PreflightReport => ({
  mode,
  passed: Object.values(checks).every((check) => check.ok),
  checks,
  restoration,
});

export type RunPreflightOptions = {
  mode: PreflightMode | string;
  repositoryRoot?: string;
  learnerId?: string;
  skipDisconnect?: boolean;
};

export const runPreflight = async (
  options: RunPreflightOptions,
): Promise<{ report: PreflightReport; exitCode: number }> => {
  const mode =
    typeof options.mode === "string" &&
    PREFLIGHT_MODES.includes(options.mode as PreflightMode)
      ? (options.mode as PreflightMode)
      : undefined;

  if (!mode) {
    const report = buildPreflightReport(
      "deterministic",
      {
        mode: { ok: false, reason: "unknown_mode" },
      },
      { flagsRestored: true, artifactPathsRestored: true },
    );
    return { report, exitCode: 1 };
  }

  const repositoryRoot =
    options.repositoryRoot ?? path.resolve(process.cwd(), "../..");
  const artifactPaths = resolveArtifactPaths(repositoryRoot);
  const processPrior = captureRecommendationProcessEnv();
  const prior = captureRecommendationFlags(env);
  const checks: Record<string, PreflightCheckResult> = {};
  const observations: ShadowObservation[] = [];
  let restoration = { flagsRestored: false, artifactPathsRestored: false };

  setMlShadowObserverForTests((value) => observations.push(value));

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres_connectivity = { ok: true };

    const loadedArtifacts: Record<
      "material" | "project",
      Awaited<ReturnType<typeof loadPortableModelArtifact>>
    > = {
      material: {} as Awaited<ReturnType<typeof loadPortableModelArtifact>>,
      project: {} as Awaited<ReturnType<typeof loadPortableModelArtifact>>,
    };

    for (const domain of ["material", "project"] as const) {
      const artifactPath = artifactPaths[domain];
      await access(artifactPath);
      loadedArtifacts[domain] = await loadPortableModelArtifact(
        artifactPath,
        domain,
      );
    }
    checks.artifact_files_readable = { ok: true };

    const versionOk =
      loadedArtifacts.material.model_version === ACCEPTED_MODEL_VERSION &&
      loadedArtifacts.material.feature_schema_version ===
        ACCEPTED_FEATURE_SCHEMA &&
      loadedArtifacts.project.model_version === ACCEPTED_MODEL_VERSION &&
      loadedArtifacts.project.feature_schema_version ===
        ACCEPTED_FEATURE_SCHEMA;

    checks.artifact_versions = {
      ok: versionOk,
      material: {
        modelVersion: loadedArtifacts.material.model_version,
        featureSchemaVersion: loadedArtifacts.material.feature_schema_version,
      },
      project: {
        modelVersion: loadedArtifacts.project.model_version,
        featureSchemaVersion: loadedArtifacts.project.feature_schema_version,
      },
    };

    const catalogReadiness = await assessProjectCatalogReadiness(
      artifactPaths.project,
    );
    checks.project_catalog_readiness = catalogReadiness;

    const fixtureUsers = await prisma.user.count({
      where: { email: { contains: "@evaluation.invalid" } },
    });
    const fixtureViews = await prisma.materialView.count({
      where: { viewSource: "evaluation_fixture" },
    });
    checks.no_fixture_users = {
      ok: fixtureUsers === 0 && fixtureViews === 0,
      fixtureUserCount: fixtureUsers,
      fixtureViewCount: fixtureViews,
    };

    const learnerId = options.learnerId ?? (await selectSmokeLearnerId());

    applyRecommendationFlags(env, deterministicFlags(artifactPaths));
    clearMlArtifactCacheForTests();
    invalidateLearnerHomeCache(learnerId);
    observations.length = 0;

    const baselineStatsBefore = getMlArtifactCacheStatsForTests();
    const baselineStarted = performance.now();
    const { result: baselineHome, observations: baselineObservations } =
      await collectRequestObservations(observations, () =>
        getLearnerHome(learnerId),
      );
    const baselineDurationMs = performance.now() - baselineStarted;
    const baselineStatsAfter = getMlArtifactCacheStatsForTests();
    const baselineProof = createBaselineRequestProof(
      baselineObservations,
      baselineStatsBefore,
      baselineStatsAfter,
    );

    checks.deterministic_smoke = {
      ok:
        baselineProof.scorerInvocations === 0 &&
        baselineProof.deterministicMode &&
        baselineDurationMs <= ML_SHADOW_TIMEOUT_MS * 3,
      scorerInvocations: baselineProof.scorerInvocations,
      deterministicMode: baselineProof.deterministicMode,
      requestDurationMs: Math.round(baselineDurationMs),
    };

    if (mode !== "deterministic") {
      applyRecommendationFlags(env, buildModeFlags(mode, artifactPaths));
      clearMlArtifactCacheForTests();
      invalidateLearnerHomeCache(learnerId);
      observations.length = 0;

      const servingStarted = performance.now();
      const { result: servedHome, observations: servingObservations } =
        await collectRequestObservations(observations, () =>
          getLearnerHome(learnerId),
        );
      const servingDurationMs = performance.now() - servingStarted;

      const materialDiagnostics = servingObservations.find(
        (entry) => entry.domain === "material",
      );
      const projectDiagnostics = servingObservations.find(
        (entry) => entry.domain === "project",
      );

      const schemaOk = schemasCompatible(baselineHome, servedHome);
      checks.response_schema_compatible = { ok: schemaOk };

      const servingTimedOut = servingDurationMs > ML_SHADOW_TIMEOUT_MS * 3;
      checks.serving_smoke_timeout = {
        ok: !servingTimedOut,
        requestDurationMs: Math.round(servingDurationMs),
      };

      if (mode === "material" || mode === "both") {
        invalidateLearnerHomeCache(learnerId);
        await getLearnerHomeSection(learnerId, "suggested_materials", 20);
        const materialAfterSection = observations.find(
          (entry) => entry.domain === "material",
        );
        const materialDiag = materialAfterSection ?? materialDiagnostics;
        const projectInactive =
          !projectDiagnostics ||
          projectDiagnostics.status === "DISABLED" ||
          !projectDiagnostics.rankedCandidateKeys?.length;

        checks.material_serving_smoke = {
          ok:
            terminates(materialDiag) &&
            !servingTimedOut &&
            (mode === "material" ? projectInactive : true),
          ...sanitizeDiagnostics(materialDiag),
        };
      }

      if (mode === "project" || mode === "both") {
        invalidateLearnerHomeCache(learnerId);
        await getLearnerHomeSection(learnerId, "suggested_projects", 4);
        const projectAfterSection = [...observations]
          .reverse()
          .find((entry) => entry.domain === "project");
        const projectDiag = projectAfterSection ?? projectDiagnostics;
        const readinessOk = projectDiag?.projectReadinessStatus === "READY";

        checks.project_serving_smoke = {
          ok: readinessOk && terminates(projectDiag) && !servingTimedOut,
          ...sanitizeDiagnostics(projectDiag),
        };
      }

      if (mode === "both") {
        checks.independent_serving = {
          ok:
            Boolean(checks.material_serving_smoke?.ok) &&
            Boolean(checks.project_serving_smoke?.ok),
        };
      }
    }
  } catch (error) {
    checks.unhandled_failure = {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown_error",
    };
  } finally {
    applyRecommendationFlags(env, prior);
    restoreRecommendationProcessEnv(processPrior);
    resetAllRecommendationTestStateForTests();

    const after = captureRecommendationFlags(env);
    restoration = {
      flagsRestored: flagsEqual(after, prior),
      artifactPathsRestored:
        after.materialPath === prior.materialPath &&
        after.projectPath === prior.projectPath,
    };

    if (!options.skipDisconnect) {
      await prisma.$disconnect();
    }
  }

  const report = buildPreflightReport(mode, checks, restoration);
  return {
    report,
    exitCode:
      report.passed &&
      restoration.flagsRestored &&
      restoration.artifactPathsRestored
        ? 0
        : 1,
  };
};

const main = async () => {
  const mode = parseMode(process.argv.slice(2));
  if (!mode) {
    console.error(
      JSON.stringify({
        recommendationsDemoPreflight: {
          passed: false,
          error: "unknown_or_missing_mode",
          acceptedModes: PREFLIGHT_MODES,
        },
      }),
    );
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const { report, exitCode } = await runPreflight({
    mode,
    skipDisconnect: true,
  });
  const payload = { recommendationsDemoPreflight: redactReport(report) };
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = exitCode;
  await prisma.$disconnect();
};

const isMainModule =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  await main();
}
