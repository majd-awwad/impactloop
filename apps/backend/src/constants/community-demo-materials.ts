import path from "node:path";
import { fileURLToPath } from "node:url";

/** Public URL prefix for community demo material originals (no localhost). */
export const COMMUNITY_DEMO_MATERIALS_PUBLIC_PREFIX =
  "/demo-assets/community-materials";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** On-disk originals committed/kept under prisma/demo-data. */
export const COMMUNITY_DEMO_MATERIALS_SOURCE_IMAGES_DIR = path.join(
  backendRoot,
  "prisma",
  "demo-data",
  "materials",
  "source-images",
);

export const communityDemoMaterialImageUrl = (
  extractedImageRelativePath: string,
): string => {
  const normalized = extractedImageRelativePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  return `${COMMUNITY_DEMO_MATERIALS_PUBLIC_PREFIX}/${normalized}`;
};

export const communityDemoMaterialImageDiskPath = (
  extractedImageRelativePath: string,
): string => {
  const normalized = extractedImageRelativePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  return path.join(
    COMMUNITY_DEMO_MATERIALS_SOURCE_IMAGES_DIR,
    ...normalized.split("/"),
  );
};
