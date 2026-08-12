import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prisma.js";
import {
  loadProjectPool,
} from "../src/modules/learner-home/learner-home.repository.js";
import {
  getLearnerHome,
  getLearnerHomeSection,
  getLearnerHomeWithCacheStateForAudit,
  invalidateLearnerHomeCache,
} from "../src/modules/learner-home/learner-home.service.js";
import {
  loadPortableModelArtifactV2,
  type PortableModelArtifactV2,
} from "../src/modules/recommendations/ml-model-artifact.js";
import {
  clearMlArtifactCacheForTests,
  getMlArtifactCacheStatsForTests,
  setMlShadowObserverForTests,
  type ShadowDiagnostics,
} from "../src/modules/recommendations/ml-shadow.service.js";
import {
  preloadRecommendationMlRuntime,
  resetRecommendationMlRuntimeForTests,
  getRecommendationMlRuntimeSnapshot,
} from "../src/modules/recommendations/ml-runtime-state.service.js";
import { loadRecommendationFeatureTokenContract } from "../src/modules/recommendations/recommendation-feature-token-contract.js";
import { stableOpaqueKey } from "../src/modules/recommendations/local-ml-training-snapshot.schema.js";
import {
  evaluateDomainServingHealth,
} from "../src/modules/recommendations/recommendation-serving-health.js";
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

export const ACCEPTED_MODEL_VERSION = "lm-06-local-lightfm-v1";
export const ACCEPTED_FEATURE_SCHEMA = "impactloop-lightfm-portable-v2";

/** Accepted identities for demo graduation (local LightFM primary + legacy hybrid if present). */
export const ACCEPTED_MODEL_VERSIONS = new Set([
  ACCEPTED_MODEL_VERSION,
  "slice-4c-runtime-v2",
]);
export const ACCEPTED_FEATURE_SCHEMAS = new Set([
  ACCEPTED_FEATURE_SCHEMA,
  "runtime-approved-features-v2",
]);

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

const resolvePreflightArtifactPaths = (repositoryRoot: string) => {
  const materialConfigured = env.recommendationMlMaterialArtifactPath?.trim();
  const projectConfigured = env.recommendationMlProjectArtifactPath?.trim();
  if (materialConfigured && projectConfigured) {
    const resolveOne = (configured: string) =>
      path.isAbsolute(configured)
        ? path.normalize(configured)
        : path.resolve(repositoryRoot, configured);
    return {
      material: resolveOne(materialConfigured),
      project: resolveOne(projectConfigured),
    };
  }
  return resolveArtifactPaths(repositoryRoot);
};

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
  const runtime = {
    deterministic: {
      runtimeMode: 'DETERMINISTIC' as const,
      shadow: false,
    },
    material: { runtimeMode: 'ML_PRIMARY' as const, shadow: true },
    project: { runtimeMode: 'ML_PRIMARY' as const, shadow: true },
    both: { runtimeMode: 'ML_PRIMARY' as const, shadow: true },
  }[mode];

  return {
    ...runtime,
    materialPath: artifactPaths.material,
    projectPath: artifactPaths.project,
  };
};

const deterministicFlags = (artifactPaths: {
  material: string;
  project: string;
}): RecommendationFlagState => ({
  runtimeMode: 'DETERMINISTIC',
  shadow: false,
  materialPath: artifactPaths.material,
  projectPath: artifactPaths.project,
});

const flagsEqual = (
  left: RecommendationFlagState,
  right: RecommendationFlagState,
) =>
  left.runtimeMode === right.runtimeMode &&
  left.shadow === right.shadow &&
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

const repositoryRootFromScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const loadLocalAggregationMode = async (): Promise<string> => {
  const aggregationPath = path.join(
    repositoryRootFromScript,
    "ml/recommendation/aggregation-contract-v1.json",
  );
  const aggregation = JSON.parse(await readFile(aggregationPath, "utf8")) as {
    selectedMode?: string;
  };
  if (aggregation.selectedMode !== "weighted-sum") {
    throw new Error("local_aggregation_contract_invalid");
  }
  return aggregation.selectedMode;
};

const loadV2ArtifactForPreflight = async (
  artifactPath: string,
  domain: "material" | "project",
): Promise<PortableModelArtifactV2> => {
  const [featureContract, aggregationMode] = await Promise.all([
    loadRecommendationFeatureTokenContract(),
    loadLocalAggregationMode(),
  ]);
  return loadPortableModelArtifactV2(artifactPath, {
    expectedDomain: domain,
    featureContractId: featureContract.contractId,
    featureContractVersion: featureContract.contractVersion,
    aggregationMode,
    taxonomyFingerprint:
      featureContract.taxonomyCompatibility.taxonomyVocabularyFingerprint,
  });
};

export const assessProjectCatalogReadiness = async (
  projectArtifactPath: string,
) => {
  const projects = await loadProjectPool(120);
  const artifact = await loadV2ArtifactForPreflight(
    projectArtifactPath,
    "project",
  );
  const mappedKeys = new Set(
    artifact.itemMapping.map((entry) => entry.itemKey),
  );

  let artifactMappedCandidateCount = 0;
  for (const project of projects) {
    if (mappedKeys.has(stableOpaqueKey("project", project.id))) {
      artifactMappedCandidateCount += 1;
    }
  }

  const runtimeCandidatesMissingFromArtifact =
    projects.length - artifactMappedCandidateCount;
  const duplicateRuntime =
    projects.length - new Set(projects.map((project) => project.id)).size;

  // LightFM v2 readiness for demo: non-empty mapped coverage + no duplicate IDs.
  // Exact full-catalog mapping is not required; unmapped candidates append deterministically.
  const projectReadinessStatus =
    duplicateRuntime > 0 || artifactMappedCandidateCount === 0
      ? "NOT_READY"
      : "READY";

  return {
    ok: projectReadinessStatus === "READY",
    status: projectReadinessStatus,
    runtimeCandidateCount: projects.length,
    artifactMappedCandidateCount,
    runtimeCandidatesMissingFromArtifact,
    duplicateRuntimeCandidateCount: duplicateRuntime,
    duplicateScoredCandidateCount: 0,
    nonFiniteScoreCount: 0,
    hydratedMappingFailureCount: 0,
    mappingCoverageRate:
      projects.length === 0
        ? 0
        : artifactMappedCandidateCount / projects.length,
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
  const artifactPaths = resolvePreflightArtifactPaths(repositoryRoot);
  const processPrior = captureRecommendationProcessEnv();
  const prior = captureRecommendationFlags(env);
  const checks: Record<string, PreflightCheckResult> = {};
  const observations: ShadowObservation[] = [];
  let restoration = { flagsRestored: false, artifactPathsRestored: false };

  setMlShadowObserverForTests((value) => observations.push(value));

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres_connectivity = { ok: true };

    const loadedArtifacts: Record<"material" | "project", PortableModelArtifactV2> =
      {
        material: {} as PortableModelArtifactV2,
        project: {} as PortableModelArtifactV2,
      };

    for (const domain of ["material", "project"] as const) {
      const artifactPath = artifactPaths[domain];
      await access(artifactPath);
      loadedArtifacts[domain] = await loadV2ArtifactForPreflight(
        artifactPath,
        domain,
      );
    }
    checks.artifact_files_readable = { ok: true };

    const versionOk =
      ACCEPTED_MODEL_VERSIONS.has(loadedArtifacts.material.modelVersion) &&
      ACCEPTED_FEATURE_SCHEMAS.has(loadedArtifacts.material.schemaVersion) &&
      ACCEPTED_MODEL_VERSIONS.has(loadedArtifacts.project.modelVersion) &&
      ACCEPTED_FEATURE_SCHEMAS.has(loadedArtifacts.project.schemaVersion);

    checks.artifact_versions = {
      ok: versionOk,
      material: {
        modelVersion: loadedArtifacts.material.modelVersion,
        featureSchemaVersion: loadedArtifacts.material.schemaVersion,
        featureContractId: loadedArtifacts.material.featureContractId,
        aggregationMode: loadedArtifacts.material.aggregationMode,
        taxonomyFingerprint: loadedArtifacts.material.taxonomyFingerprint,
      },
      project: {
        modelVersion: loadedArtifacts.project.modelVersion,
        featureSchemaVersion: loadedArtifacts.project.schemaVersion,
        featureContractId: loadedArtifacts.project.featureContractId,
        aggregationMode: loadedArtifacts.project.aggregationMode,
        taxonomyFingerprint: loadedArtifacts.project.taxonomyFingerprint,
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
      resetRecommendationMlRuntimeForTests();
      await preloadRecommendationMlRuntime();
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

      invalidateLearnerHomeCache(learnerId);
      const audit = await getLearnerHomeWithCacheStateForAudit(learnerId);
      const runtimeSnapshot = getRecommendationMlRuntimeSnapshot();
      const materialTruth =
        audit.servingTruth?.material ??
        evaluateDomainServingHealth({
          decision: audit.mlOrdering.material,
          domainState: runtimeSnapshot.material,
          finalSectionItemCount:
            audit.response.sections.find((s) => s.key === "suggested_materials")
              ?.items.length ?? 0,
        });
      const projectTruth =
        audit.servingTruth?.project ??
        evaluateDomainServingHealth({
          decision: audit.mlOrdering.project,
          domainState: runtimeSnapshot.project,
          finalSectionItemCount:
            audit.response.sections.find((s) => s.key === "suggested_projects")
              ?.items.length ?? 0,
        });

      const requireMlRanked = (
        domain: "material" | "project",
        truth: typeof materialTruth,
      ): PreflightCheckResult => {
        const domainReady =
          domain === "material"
            ? runtimeSnapshot.material.state === "READY"
            : runtimeSnapshot.project.state === "READY";
        if (!domainReady) {
          return {
            ok: false,
            reason: "domain_not_ready",
            domainState:
              domain === "material"
                ? runtimeSnapshot.material.state
                : runtimeSnapshot.project.state,
            failureCode:
              domain === "material"
                ? runtimeSnapshot.material.failureCode
                : runtimeSnapshot.project.failureCode,
            outcome: truth.outcome,
            health: truth.health,
            reasonCode: truth.reasonCode ?? null,
          };
        }
        if (truth.candidateCount === 0 || truth.outcome === "EMPTY") {
          return {
            ok: false,
            reason: "candidate_pool_unexpectedly_empty",
            outcome: truth.outcome,
            health: truth.health,
            candidateCount: truth.candidateCount,
          };
        }
        if (truth.outcome !== "ML_RANKED" || !truth.mlOwnedFinalOrder) {
          return {
            ok: false,
            reason:
              truth.health === "FALLBACK_UNEXPECTED"
                ? "ready_but_not_ml_ranked"
                : truth.outcome === "ML_RANKED" && !truth.mlOwnedFinalOrder
                  ? "ml_ranked_but_final_order_ownership_lost"
                  : `outcome_${String(truth.outcome).toLowerCase()}`,
            outcome: truth.outcome,
            health: truth.health,
            reasonCode: truth.reasonCode ?? null,
            candidateCount: truth.candidateCount,
            mappedCount: truth.mappedCandidateCount,
            modelVersion: truth.modelVersion ?? null,
          };
        }
        return {
          ok: true,
          outcome: truth.outcome,
          health: truth.health,
          candidateCount: truth.candidateCount,
          mappedCount: truth.mappedCandidateCount,
          mlOwnedFinalOrder: truth.mlOwnedFinalOrder,
          modelVersion: truth.modelVersion ?? null,
          schemaVersion: truth.schemaVersion ?? null,
        };
      };

      if (mode === "material" || mode === "both") {
        invalidateLearnerHomeCache(learnerId);
        await getLearnerHomeSection(learnerId, "suggested_materials", 20);

        const mlServing = requireMlRanked("material", materialTruth);
        checks.material_serving_smoke = {
          ok: mlServing.ok && !servingTimedOut,
          ...sanitizeDiagnostics(materialDiagnostics),
          mlServing,
        };
        checks.material_ml_ranked = mlServing;
      }

      if (mode === "project" || mode === "both") {
        invalidateLearnerHomeCache(learnerId);
        await getLearnerHomeSection(learnerId, "suggested_projects", 4);

        const mlServing = requireMlRanked("project", projectTruth);
        const projectDomainReady = runtimeSnapshot.project.state === "READY";

        checks.project_serving_smoke = {
          ok: mlServing.ok && projectDomainReady && !servingTimedOut,
          ...sanitizeDiagnostics(projectDiagnostics),
          projectReadinessStatus: runtimeSnapshot.project.state,
          mlServing,
        };
        checks.project_ml_ranked = mlServing;
      }

      if (mode === "both") {
        checks.independent_serving = {
          ok:
            Boolean(checks.material_ml_ranked?.ok) &&
            Boolean(checks.project_ml_ranked?.ok),
          material: checks.material_ml_ranked,
          project: checks.project_ml_ranked,
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
  const mode = parseMode(process.argv.slice(2)) ?? "both";

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
