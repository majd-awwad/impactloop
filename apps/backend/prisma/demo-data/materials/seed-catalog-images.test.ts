import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

import {
  communityDemoMaterialImageDiskPath,
  communityDemoMaterialImageUrl,
} from "../../../src/constants/community-demo-materials.js";
import { isAllowedSeedImageUrl } from "../../../src/utils/allowed-seed-image-url.js";
import { CORE_MATERIAL_SUPPLEMENT_IMAGE_PATHS } from "../visual-assets/manifests/core-material-supplement.data.js";
import {
  isVisualAssetMaterialPath,
  resolveMaterialImageDiskPath,
  resolveMaterialImagePublicUrl,
} from "../visual-assets/manifests/resolve-core-material-images.js";
import { SEED_CATALOG_REAL_IMAGE_PATHS } from "./seed-catalog-images.data.js";

const assertLocalMaterialMapping = (
  label: string,
  mappings: Readonly<Record<string, readonly string[]>>,
) => {
  for (const [seedKey, relativePaths] of Object.entries(mappings)) {
    assert.ok(relativePaths.length >= 1, `${label}:${seedKey} needs images`);

    relativePaths.forEach((relativePath, index) => {
      assert.doesNotMatch(
        relativePath,
        /^https?:\/\//,
        `${label}:${seedKey}[${index}] must be a local relative path`,
      );

      if (label === "seed-catalog") {
        assert.equal(
          isVisualAssetMaterialPath(relativePath),
          false,
          `${label}:${seedKey}[${index}] must stay under community-materials source tree`,
        );
      }

      const diskPath = resolveMaterialImageDiskPath(relativePath);
      assert.equal(
        fs.existsSync(diskPath),
        true,
        `missing demo asset for ${label}:${seedKey}: ${diskPath}`,
      );

      const publicUrl = resolveMaterialImagePublicUrl(relativePath);
      assert.equal(isAllowedSeedImageUrl(publicUrl), true);
    });
  }
};

describe("seed catalog real material images", () => {
  it("maps seed keys to existing repository demo assets with allowed URLs", () => {
    const entries = Object.entries(SEED_CATALOG_REAL_IMAGE_PATHS);
    assert.ok(entries.length >= 70, "expected curated seed-catalog mappings");
    assertLocalMaterialMapping("seed-catalog", SEED_CATALOG_REAL_IMAGE_PATHS);
  });

  it("maps supplement keys to existing local demo assets", () => {
    const entries = Object.entries(CORE_MATERIAL_SUPPLEMENT_IMAGE_PATHS);
    assert.equal(entries.length, 81, "expected 81 supplement mappings");
    assertLocalMaterialMapping(
      "supplement",
      CORE_MATERIAL_SUPPLEMENT_IMAGE_PATHS,
    );
  });

  it("covers representative recovered materials", () => {
    assert.deepEqual(SEED_CATALOG_REAL_IMAGE_PATHS["majd-arduino-uno-r3"], [
      "seed-catalog/majd-arduino-uno-r3-01.jpg",
      "seed-catalog/majd-arduino-uno-r3-02.jpg",
    ]);
    assert.deepEqual(CORE_MATERIAL_SUPPLEMENT_IMAGE_PATHS["israa-wax-molds"], [
      "core-materials/material-israa-wax-molds.png",
    ]);
  });
});
