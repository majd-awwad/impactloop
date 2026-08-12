/**
 * Validates material and project portable v2 artifacts using paths from env.
 * Used by `npm run recommendations:ml:validate:local`.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "../src/config/env.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const trainScript = path.join(scriptDir, "train-local-lightfm.ts");

const runValidate = (artifactPath: string, domain: "material" | "project") => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      trainScript,
      "validate-artifact",
      "--artifact",
      artifactPath,
      "--expected-domain",
      domain,
    ],
    {
      stdio: "inherit",
      env: process.env,
      cwd: path.resolve(scriptDir, ".."),
    },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const materialPath = env.recommendationMlMaterialArtifactPath?.trim();
const projectPath = env.recommendationMlProjectArtifactPath?.trim();

if (!materialPath || !projectPath) {
  process.stderr.write(
    "Local ML validation requires RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH and RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH in apps/backend/.env\n",
  );
  process.exit(1);
}

runValidate(materialPath, "material");
runValidate(projectPath, "project");
