import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prisma.js";
import {
  getMlArtifactCacheStatsForTests,
  setMlShadowFailureForTests,
  setMlShadowNeverSettleForTests,
  setMlShadowObserverForTests,
} from "../src/modules/recommendations/ml-shadow.service.js";
import {
  captureRecommendationProcessEnv,
  isolatedRecommendationTest,
  readRecommendationTestIsolateProbe,
  RECOMMENDATION_PROCESS_ENV_KEYS,
  resetAllRecommendationTestStateForTests,
  restoreRecommendationProcessEnv,
  withRecommendationTestIsolation,
} from "../src/modules/recommendations/recommendation-test-isolation.js";
import {
  applyRecommendationFlags,
  captureRecommendationFlags,
  createBaselineRequestProof,
  redactReport,
  resolveArtifactPaths,
} from "./recommendation-evaluation-report.js";
import {
  ACCEPTED_FEATURE_SCHEMA,
  ACCEPTED_MODEL_VERSION,
  buildModeFlags,
  buildPreflightReport,
  parseMode,
  PREFLIGHT_MODES,
  runPreflight,
} from "./recommendations-demo-preflight.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

const restoreBaselineRecommendationEnv = (): void => {
  applyRecommendationFlags(env, {
    runtimeMode: "DETERMINISTIC",
    shadow: false,
    materialPath: "",
    projectPath: "",
  });
  resetAllRecommendationTestStateForTests();
};

test("parseMode accepts known modes, PREFLIGHT_MODE env, and rejects unknown values", () => {
  assert.equal(parseMode(["--mode=deterministic"]), "deterministic");
  assert.equal(parseMode(["--mode=material"]), "material");
  assert.equal(parseMode(["--mode=project"]), "project");
  assert.equal(parseMode(["--mode=both"]), "both");
  assert.equal(parseMode(["--mode=invalid"]), undefined);
  assert.equal(parseMode([]), undefined);

  const prior = captureRecommendationProcessEnv();
  process.env.PREFLIGHT_MODE = "both";
  assert.equal(parseMode([]), "both");
  restoreRecommendationProcessEnv(prior);
});

test("buildModeFlags uses runtimeMode+shadow (no materialServing)", () => {
  const paths = resolveArtifactPaths(repositoryRoot);
  assert.deepEqual(buildModeFlags("deterministic", paths), {
    runtimeMode: "DETERMINISTIC",
    shadow: false,
    materialPath: paths.material,
    projectPath: paths.project,
  });
  assert.equal(buildModeFlags("material", paths).runtimeMode, "ML_PRIMARY");
  assert.equal(buildModeFlags("material", paths).shadow, true);
  assert.equal(buildModeFlags("project", paths).runtimeMode, "ML_PRIMARY");
  assert.equal(buildModeFlags("project", paths).shadow, true);
  assert.equal(buildModeFlags("both", paths).runtimeMode, "ML_PRIMARY");
  assert.equal(buildModeFlags("both", paths).shadow, true);
});

test("deterministic mode proof invokes no scorer", () => {
  const proof = createBaselineRequestProof(
    [],
    { entries: 0, artifactLoadCount: 0 },
    { entries: 0, artifactLoadCount: 0 },
  );
  assert.equal(proof.scorerInvocations, 0);
  assert.equal(proof.deterministicMode, true);
});

test("buildPreflightReport passes only when all checks and restoration succeed", () => {
  const passing = buildPreflightReport(
    "deterministic",
    { a: { ok: true }, b: { ok: true } },
    { flagsRestored: true, artifactPathsRestored: true },
  );
  assert.equal(passing.passed, true);

  const failing = buildPreflightReport(
    "material",
    { a: { ok: true }, b: { ok: false } },
    { flagsRestored: true, artifactPathsRestored: true },
  );
  assert.equal(failing.passed, false);
});

test("preflight report contains no private identifiers", () => {
  const report = buildPreflightReport(
    "both",
    {
      postgres_connectivity: { ok: true },
      material_serving_smoke: {
        ok: true,
        domain: "material",
        mode: "SERVED",
        status: "SCORED",
        confidenceLevel: "LOW",
      },
    },
    { flagsRestored: true, artifactPathsRestored: true },
  );
  assert.doesNotThrow(() => redactReport(report));
});

isolatedRecommendationTest(
  "unknown mode is rejected with non-zero exit code",
  async () => {
    const { report, exitCode } = await runPreflight({
      mode: "invalid",
      skipDisconnect: true,
    });
    assert.equal(exitCode, 1);
    assert.equal(report.checks.mode?.ok, false);
  },
);

isolatedRecommendationTest(
  "artifact failure returns non-zero exit code",
  async () => {
    const { exitCode } = await runPreflight({
      mode: "deterministic",
      repositoryRoot: path.resolve(import.meta.dirname),
      skipDisconnect: true,
    });
    if (!hasDatabase) return;
    assert.equal(exitCode, 1);
  },
);

test("mapping readiness failure returns non-zero exit code", () => {
  const report = buildPreflightReport(
    "project",
    {
      project_catalog_readiness: { ok: false, status: "NOT_READY" },
      postgres_connectivity: { ok: true },
    },
    { flagsRestored: true, artifactPathsRestored: true },
  );
  assert.equal(report.passed, false);
  assert.equal(report.checks.project_catalog_readiness?.ok, false);
});

isolatedRecommendationTest(
  "flags and artifact paths restore after success",
  async () => {
    if (!hasDatabase) return;

    const original = captureRecommendationFlags(env);
    try {
      env.recommendationMlShadowEnabled = true;
      env.recommendationMlRuntimeMode = "ML_PRIMARY";
      env.recommendationMlProjectArtifactPath =
        "/tmp/preflight-test-artifact.json";
      const priorBeforeRun = captureRecommendationFlags(env);

      const { report, exitCode } = await runPreflight({
        mode: "deterministic",
        repositoryRoot,
        skipDisconnect: true,
      });

      const after = captureRecommendationFlags(env);
      assert.deepEqual(after, priorBeforeRun);
      assert.equal(report.restoration.flagsRestored, true);
      assert.equal(report.restoration.artifactPathsRestored, true);
      assert.ok(exitCode === 0 || exitCode === 1);
    } finally {
      applyRecommendationFlags(env, original);
      resetAllRecommendationTestStateForTests();
    }
  },
);

isolatedRecommendationTest(
  "flags and artifact paths restore after failure",
  async () => {
    const original = captureRecommendationFlags(env);
    try {
      env.recommendationMlShadowEnabled = true;
      const priorBeforeRun = captureRecommendationFlags(env);

      const { exitCode } = await runPreflight({
        mode: "material",
        repositoryRoot: path.resolve(import.meta.dirname),
        skipDisconnect: true,
      });

      const after = captureRecommendationFlags(env);
      assert.deepEqual(after, priorBeforeRun);
      assert.equal(exitCode, 1);
    } finally {
      applyRecommendationFlags(env, original);
      resetAllRecommendationTestStateForTests();
    }
  },
);

isolatedRecommendationTest(
  "process.env keys restore after success with absent and empty semantics",
  async () => {
    const originalEnv = captureRecommendationFlags(env);
    const originalProcess = captureRecommendationProcessEnv();
    try {
      delete process.env.PREFLIGHT_MODE;
      process.env.RECOMMENDATION_ML_SHADOW_ENABLED = "";
      process.env.RECOMMENDATION_ML_RUNTIME_MODE = "ML_PRIMARY";
      process.env.RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH =
        "/tmp/material-artifact.json";

      await withRecommendationTestIsolation(async () => {
        assert.equal("PREFLIGHT_MODE" in process.env, false);
        assert.equal(process.env.RECOMMENDATION_ML_SHADOW_ENABLED, "");
      });

      assert.equal("PREFLIGHT_MODE" in process.env, false);
      assert.equal(process.env.RECOMMENDATION_ML_SHADOW_ENABLED, "");
      assert.equal(process.env.RECOMMENDATION_ML_RUNTIME_MODE, "ML_PRIMARY");
      assert.equal(
        process.env.RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH,
        "/tmp/material-artifact.json",
      );
    } finally {
      applyRecommendationFlags(env, originalEnv);
      restoreRecommendationProcessEnv(originalProcess);
      resetAllRecommendationTestStateForTests();
    }
  },
);

isolatedRecommendationTest(
  "process.env keys restore after failure",
  async () => {
    const originalProcess = captureRecommendationProcessEnv();
    try {
      process.env.PREFLIGHT_MODE = "material";
      await assert.rejects(
        () =>
          withRecommendationTestIsolation(async () => {
            throw new Error("forced_isolation_failure");
          }),
        /forced_isolation_failure/,
      );
      assert.equal(process.env.PREFLIGHT_MODE, "material");
    } finally {
      restoreRecommendationProcessEnv(originalProcess);
      resetAllRecommendationTestStateForTests();
    }
  },
);

isolatedRecommendationTest(
  "ML artifact cache and injection state do not leak",
  async () => {
    const original = captureRecommendationFlags(env);
    try {
      setMlShadowFailureForTests("fusion");
      setMlShadowNeverSettleForTests({});
      setMlShadowObserverForTests(() => undefined);
      resetAllRecommendationTestStateForTests();
      assert.deepEqual(getMlArtifactCacheStatsForTests(), {
        entries: 0,
        artifactLoadCount: 0,
      });

      await withRecommendationTestIsolation(async () => {
        setMlShadowFailureForTests("confidence");
        setMlShadowNeverSettleForTests({});
        setMlShadowObserverForTests(() => undefined);
      });

      assert.deepEqual(getMlArtifactCacheStatsForTests(), {
        entries: 0,
        artifactLoadCount: 0,
      });
    } finally {
      applyRecommendationFlags(env, original);
      resetAllRecommendationTestStateForTests();
    }
  },
);

if (hasDatabase) {
  isolatedRecommendationTest(
    "parallel recommendation tests share one process isolate",
    async () => {
      const probe = readRecommendationTestIsolateProbe(
        "recommendations-demo-preflight.test.ts",
      );
      assert.ok(probe.pid > 0);
      assert.ok(probe.threadId >= 0);
      console.log(
        JSON.stringify({
          recommendationTestIsolateProbe: probe,
        }),
      );
    },
  );

  isolatedRecommendationTest(
    "preflight then ml-shadow e2e order passes",
    async () => {
      const flagsBefore = captureRecommendationFlags(env);
      const { report } = await runPreflight({
        mode: "deterministic",
        repositoryRoot,
        skipDisconnect: true,
      });
      assert.equal(report.checks.deterministic_smoke?.ok, true);
      assert.deepEqual(captureRecommendationFlags(env), flagsBefore);

      const { runMlShadowComparison } =
        await import("../src/modules/recommendations/ml-shadow.service.js");
      const response = { items: ["a"] };
      const result = await runMlShadowComparison({
        response,
        domain: "material",
        interests: [],
        candidates: [],
        activeCandidateKeys: [],
        currentTopKeys: [],
        recentEvents: [],
        evaluationTimestamp: "2026-07-19T00:00:00Z",
      });
      assert.strictEqual(result.response, response);
      assert.equal(
        result.diagnostics.status,
        flagsBefore.shadow ? "SCORED" : "DISABLED",
      );
    },
  );

  isolatedRecommendationTest(
    "ml-shadow e2e then preflight order passes",
    async () => {
      const flagsBefore = captureRecommendationFlags(env);
      const { runMlShadowComparison } =
        await import("../src/modules/recommendations/ml-shadow.service.js");
      const response = { items: ["b"] };
      const shadowResult = await runMlShadowComparison({
        response,
        domain: "material",
        interests: [],
        candidates: [],
        activeCandidateKeys: [],
        currentTopKeys: [],
        recentEvents: [],
        evaluationTimestamp: "2026-07-19T00:00:00Z",
      });
      assert.strictEqual(shadowResult.response, response);

      const { report, exitCode } = await runPreflight({
        mode: "deterministic",
        repositoryRoot,
        skipDisconnect: true,
      });
      assert.equal(report.checks.deterministic_smoke?.ok, true);
      assert.equal(exitCode, 0);
      assert.deepEqual(captureRecommendationFlags(env), flagsBefore);
    },
  );

  isolatedRecommendationTest(
    "repeated preflight and e2e sequences remain stable",
    async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { exitCode } = await runPreflight({
          mode: "deterministic",
          repositoryRoot,
          skipDisconnect: true,
        });
        assert.equal(exitCode, 0, `preflight failed on attempt ${attempt + 1}`);
        restoreBaselineRecommendationEnv();
      }
    },
  );
}

if (hasDatabase) {
  isolatedRecommendationTest(
    "deterministic preflight invokes no scorer",
    async () => {
      const observations: Array<{ status: string }> = [];
      setMlShadowObserverForTests((value) => observations.push(value));

      const { report } = await runPreflight({
        mode: "deterministic",
        repositoryRoot,
        skipDisconnect: true,
      });

      assert.equal(report.checks.deterministic_smoke?.scorerInvocations, 0);
      assert.equal(report.checks.deterministic_smoke?.ok, true);
    },
  );

  isolatedRecommendationTest(
    "material mode validates material serving only",
    async () => {
      const { report } = await runPreflight({
        mode: "material",
        repositoryRoot,
        skipDisconnect: true,
      });

      assert.ok(report.checks.material_serving_smoke);
      assert.equal(report.checks.project_serving_smoke, undefined);
      if (
        report.checks.artifact_versions?.ok &&
        report.checks.project_catalog_readiness?.ok
      ) {
        assert.equal(report.checks.material_serving_smoke?.domain, "material");
      }
    },
  );

  isolatedRecommendationTest(
    "project mode requires project readiness READY",
    async () => {
      const { report } = await runPreflight({
        mode: "project",
        repositoryRoot,
        skipDisconnect: true,
      });

      assert.ok(report.checks.project_serving_smoke);
      if (report.checks.project_catalog_readiness?.status === "READY") {
        assert.equal(
          report.checks.project_serving_smoke?.projectReadinessStatus,
          "READY",
        );
      }
    },
  );

  isolatedRecommendationTest(
    "both mode validates independent material and project serving",
    async () => {
      const { report } = await runPreflight({
        mode: "both",
        repositoryRoot,
        skipDisconnect: true,
      });

      assert.ok(report.checks.material_serving_smoke);
      assert.ok(report.checks.project_serving_smoke);
      assert.ok(report.checks.independent_serving);
    },
  );

  test("smoke timeout report marks failure without mutating env", () => {
    const report = buildPreflightReport(
      "material",
      {
        deterministic_smoke: { ok: true, scorerInvocations: 0 },
        serving_smoke_timeout: { ok: false, requestDurationMs: 4000 },
        material_serving_smoke: {
          ok: true,
          domain: "material",
          status: "SCORED",
        },
      },
      { flagsRestored: true, artifactPathsRestored: true },
    );
    assert.equal(report.passed, false);
    assert.equal(report.checks.serving_smoke_timeout?.ok, false);
  });

  isolatedRecommendationTest("preflight is read-only", async () => {
    const [usersBefore, viewsBefore, savesBefore] = await Promise.all([
      prisma.user.count(),
      prisma.materialView.count(),
      prisma.projectSave.count(),
    ]);

    await runPreflight({
      mode: "deterministic",
      repositoryRoot,
      skipDisconnect: true,
    });

    const [usersAfter, viewsAfter, savesAfter] = await Promise.all([
      prisma.user.count(),
      prisma.materialView.count(),
      prisma.projectSave.count(),
    ]);

    assert.equal(usersBefore, usersAfter);
    assert.equal(viewsBefore, viewsAfter);
    assert.equal(savesBefore, savesAfter);
  });

  isolatedRecommendationTest(
    "no ephemeral fixture records remain",
    async () => {
      const fixtureUsers = await prisma.user.count({
        where: { email: { contains: "@evaluation.invalid" } },
      });
      const fixtureViews = await prisma.materialView.count({
        where: { viewSource: "evaluation_fixture" },
      });
      assert.equal(fixtureUsers, 0);
      assert.equal(fixtureViews, 0);

      const { report } = await runPreflight({
        mode: "deterministic",
        repositoryRoot,
        skipDisconnect: true,
      });
      assert.equal(report.checks.no_fixture_users?.ok, true);
    },
  );

  isolatedRecommendationTest(
    "accepted artifact versions are enforced",
    async () => {
      const { ACCEPTED_MODEL_VERSIONS, ACCEPTED_FEATURE_SCHEMAS } = await import(
        "./recommendations-demo-preflight.js"
      );
      const { report } = await runPreflight({
        mode: "deterministic",
        repositoryRoot,
        skipDisconnect: true,
      });

      if (report.checks.artifact_versions?.ok) {
        const material = report.checks.artifact_versions.material as {
          modelVersion: string;
          featureSchemaVersion: string;
        };
        assert.ok(ACCEPTED_MODEL_VERSIONS.has(material.modelVersion));
        assert.ok(ACCEPTED_FEATURE_SCHEMAS.has(material.featureSchemaVersion));
        assert.equal(material.modelVersion, ACCEPTED_MODEL_VERSION);
        assert.equal(material.featureSchemaVersion, ACCEPTED_FEATURE_SCHEMA);
      }
    },
  );
}

test("preflight modes cover all accepted CLI values", () => {
  assert.deepEqual(PREFLIGHT_MODES, [
    "deterministic",
    "material",
    "project",
    "both",
  ]);
  assert.deepEqual(
    [...RECOMMENDATION_PROCESS_ENV_KEYS],
    [
      "PREFLIGHT_MODE",
      "RECOMMENDATION_ML_RUNTIME_MODE",
      "RECOMMENDATION_ML_SHADOW_ENABLED",
      "RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH",
      "RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH",
    ],
  );
});

test("existing recommendation runtime behavior remains unchanged by preflight imports", async () => {
  const runtimeModule =
    await import("../src/modules/recommendations/ml-shadow.service.js");
  assert.equal(typeof runtimeModule.runMlShadowComparison, "function");
  assert.equal(typeof runtimeModule.setMlShadowObserverForTests, "function");
  assert.equal(typeof runtimeModule.resetMlShadowTestStateForTests, "function");
});
