import assert from "node:assert/strict";
import path from "node:path";
import { after, describe, test } from "node:test";

import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prisma.js";
import {
  getLearnerHome,
  invalidateLearnerHomeCache,
} from "../src/modules/learner-home/learner-home.service.js";
import {
  clearMlArtifactCacheForTests,
  setMlShadowObserverForTests,
} from "../src/modules/recommendations/ml-shadow.service.js";
import {
  cleanupEphemeralFixtures,
  countFixtureRecords,
  createEphemeralFixtures,
  syncOutboxIdsForFixtureUsers,
} from "./evaluate-slice-4j-a-ephemeral-fixtures.js";
import {
  applyRecommendationFlags,
  captureRecommendationFlags,
  classifyReleaseReadiness,
  EVALUATION_MODES,
  resolveArtifactPaths,
} from "./evaluate-slice-4j-a-report.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe(
  "evaluate-slice-4j-a ephemeral fixtures",
  { skip: !hasDatabase },
  () => {
    after(async () => {
      await prisma.$disconnect();
    });

    test("create and cleanup leaves zero tracked fixture records", async () => {
      const fixture = await createEphemeralFixtures();
      assert.equal(fixture.runState.createdUserIds.length, 3);
      const beforeCleanup = await countFixtureRecords(fixture.runState);
      assert.ok(beforeCleanup > 0);
      await cleanupEphemeralFixtures(fixture.runState);
      assert.equal(await countFixtureRecords(fixture.runState), 0);
    });

    test("cleanup preserves pre-existing seed learner rows", async () => {
      const before = await prisma.user.count({
        where: { roles: { some: { role: "LEARNER" } } },
      });
      const fixture = await createEphemeralFixtures();
      await cleanupEphemeralFixtures(fixture.runState);
      const after = await prisma.user.count({
        where: { roles: { some: { role: "LEARNER" } } },
      });
      assert.equal(before, after);
    });

    test("cleanup runs after forced evaluation failure", async () => {
      const fixture = await createEphemeralFixtures();
      await assert.rejects(async () => {
        throw new Error("forced_evaluation_failure");
      });
      await cleanupEphemeralFixtures(fixture.runState);
      assert.equal(await countFixtureRecords(fixture.runState), 0);
    });

    test("cleanup runs after simulated report-writing failure", async () => {
      const fixture = await createEphemeralFixtures();
      try {
        throw new Error("forced_report_write_failure");
      } catch {
        await cleanupEphemeralFixtures(fixture.runState);
      }
      assert.equal(await countFixtureRecords(fixture.runState), 0);
    });

    test("cleanup is idempotent", async () => {
      const fixture = await createEphemeralFixtures();
      await cleanupEphemeralFixtures(fixture.runState);
      await cleanupEphemeralFixtures(fixture.runState);
      assert.equal(await countFixtureRecords(fixture.runState), 0);
    });

    test("cleanup failure classification helper returns NOT_READY", () => {
      assert.equal(
        classifyReleaseReadiness({
          invariants: { noDuplicatesInServedSections: true },
          warnings: [],
          releaseBlockers: [],
          unresolvedArchetypes: 0,
          cleanupVerified: false,
          cleanupBlockers: ["ephemeral_fixture_cleanup_failed"],
        }),
        "NOT_READY",
      );
    });

    test("each ephemeral archetype runs through all five evaluation modes", async () => {
      const prior = captureRecommendationFlags(env);
      const artifactPaths = resolveArtifactPaths(
        path.resolve(process.cwd(), "../.."),
      );
      const fixture = await createEphemeralFixtures();
      const observations: Array<{ domain: "material" | "project" }> = [];
      setMlShadowObserverForTests((value) => {
        observations.push(value);
      });

      try {
        for (const archetypeKey of [
          "cold_start",
          "material_coherent",
          "project_scattered",
        ] as const) {
          const learnerId = fixture.forcedArchetypeLearners[archetypeKey];
          assert.ok(learnerId);
          for (const modeKey of Object.keys(EVALUATION_MODES)) {
            applyRecommendationFlags(env, {
              ...EVALUATION_MODES[modeKey as keyof typeof EVALUATION_MODES],
              materialPath: artifactPaths.material,
              projectPath: artifactPaths.project,
            });
            clearMlArtifactCacheForTests();
            invalidateLearnerHomeCache(learnerId);
            observations.length = 0;
            const home = await getLearnerHome(learnerId);
            assert.ok(home.sections.length > 0);
          }
        }
      } finally {
        setMlShadowObserverForTests(undefined);
        applyRecommendationFlags(env, prior);
        clearMlArtifactCacheForTests();
        await syncOutboxIdsForFixtureUsers(fixture.runState);
        await cleanupEphemeralFixtures(fixture.runState);
      }

      assert.equal(await countFixtureRecords(fixture.runState), 0);
    });

    test("post-run fixture record count is zero", async () => {
      const fixture = await createEphemeralFixtures();
      await syncOutboxIdsForFixtureUsers(fixture.runState);
      await cleanupEphemeralFixtures(fixture.runState);
      const postRun = await countFixtureRecords(fixture.runState);
      assert.equal(postRun, 0);
      const markerUsers = await prisma.user.count({
        where: { email: { contains: `@evaluation.invalid` } },
      });
      assert.equal(markerUsers, 0);
    });
  },
);
