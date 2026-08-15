import fs from "node:fs";

import {
  communityDemoMaterialImageDiskPath,
  communityDemoMaterialImageUrl,
} from "../../../../src/constants/community-demo-materials.js";
import {
  demoVisualAssetDiskPath,
  demoVisualAssetUrl,
} from "../../../../src/constants/demo-visual-assets.js";
import { isAllowedSeedImageUrl } from "../../../../src/utils/allowed-seed-image-url.js";
import { SEED_CATALOG_REAL_IMAGE_PATHS } from "../../materials/seed-catalog-images.data.js";
import { CORE_MATERIAL_SUPPLEMENT_IMAGE_PATHS } from "./core-material-supplement.data.js";
import {
  CORE_DEMO_PEOPLE_EMAILS,
  CORE_DEMO_PEOPLE_IMAGES,
  communityDemoOrganizationCoverRelativePath,
  communityDemoPersonAvatarRelativePath,
} from "./demo-people-images.data.js";

export type CoreMaterialImageSource = "seed-catalog" | "supplement" | "patch";

export const isVisualAssetMaterialPath = (relativePath: string): boolean =>
  relativePath.startsWith("core-materials/");

export const resolveMaterialImagePublicUrl = (relativePath: string): string =>
  isVisualAssetMaterialPath(relativePath)
    ? demoVisualAssetUrl(relativePath)
    : communityDemoMaterialImageUrl(relativePath);

export const resolveMaterialImageDiskPath = (relativePath: string): string =>
  isVisualAssetMaterialPath(relativePath)
    ? demoVisualAssetDiskPath(relativePath)
    : communityDemoMaterialImageDiskPath(relativePath);

export const resolveCoreMaterialImageRelativePaths = (
  materialKey: string,
): readonly string[] | null => {
  const catalogPaths = SEED_CATALOG_REAL_IMAGE_PATHS[materialKey];
  if (catalogPaths?.length) return catalogPaths;

  const supplementPaths = CORE_MATERIAL_SUPPLEMENT_IMAGE_PATHS[materialKey];
  if (supplementPaths?.length) return supplementPaths;

  return null;
};

export const resolveCoreMaterialImageUrls = (
  materialKey: string,
): readonly string[] => {
  const relativePaths = resolveCoreMaterialImageRelativePaths(materialKey);
  if (!relativePaths?.length) {
    throw new Error(
      `Missing local image mapping for core material key "${materialKey}".`,
    );
  }

  return relativePaths.map((relativePath) =>
    resolveMaterialImagePublicUrl(relativePath),
  );
};

export const assertCoreMaterialImageMappingExistsOnDisk = (
  materialKey: string,
): void => {
  const relativePaths = resolveCoreMaterialImageRelativePaths(materialKey);
  if (!relativePaths?.length) {
    throw new Error(`Missing image mapping for core material key "${materialKey}".`);
  }

  relativePaths.forEach((relativePath, index) => {
    const diskPath = resolveMaterialImageDiskPath(relativePath);
    if (!fs.existsSync(diskPath)) {
      throw new Error(
        `Missing on-disk image for ${materialKey}[${index}]: ${diskPath}`,
      );
    }

    const publicUrl = resolveMaterialImagePublicUrl(relativePath);
    if (!isAllowedSeedImageUrl(publicUrl)) {
      throw new Error(`Disallowed seed image URL for ${materialKey}: ${publicUrl}`);
    }
  });
};

export const assertDemoVisualAssetExistsOnDisk = (relativePath: string): void => {
  const diskPath = demoVisualAssetDiskPath(relativePath);
  if (!fs.existsSync(diskPath)) {
    throw new Error(`Missing demo visual asset: ${diskPath}`);
  }

  const publicUrl = demoVisualAssetUrl(relativePath);
  if (!isAllowedSeedImageUrl(publicUrl)) {
    throw new Error(`Disallowed demo visual asset URL: ${publicUrl}`);
  }
};

export const assertCoreDemoPeopleAssetsExist = (): void => {
  for (const email of CORE_DEMO_PEOPLE_EMAILS) {
    const assets = CORE_DEMO_PEOPLE_IMAGES[email];
    assertDemoVisualAssetExistsOnDisk(
      assets.profileImageUrl.replace("/demo-assets/visual-assets/", ""),
    );

    if (assets.supplierAvatarImageUrl) {
      assertDemoVisualAssetExistsOnDisk(
        assets.supplierAvatarImageUrl.replace("/demo-assets/visual-assets/", ""),
      );
    }

    if (assets.supplierCoverImageUrl) {
      assertDemoVisualAssetExistsOnDisk(
        assets.supplierCoverImageUrl.replace("/demo-assets/visual-assets/", ""),
      );
    }
  }
};

export const assertCommunityDemoPersonAssetsExist = (
  email: string,
  supplierKind: "INDIVIDUAL" | "ORGANIZATION",
): void => {
  assertDemoVisualAssetExistsOnDisk(communityDemoPersonAvatarRelativePath(email));

  if (supplierKind === "ORGANIZATION") {
    assertDemoVisualAssetExistsOnDisk(
      communityDemoOrganizationCoverRelativePath(email),
    );
  }
};
