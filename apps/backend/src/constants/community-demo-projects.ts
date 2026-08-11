import path from "node:path";
import { fileURLToPath } from "node:url";

/** Public URL prefix for community demo project covers (no localhost). */
export const COMMUNITY_DEMO_PROJECTS_PUBLIC_PREFIX =
  "/demo-assets/community-projects";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** On-disk originals under prisma/demo-data/projects/source-images. */
export const COMMUNITY_DEMO_PROJECTS_SOURCE_IMAGES_DIR = path.join(
  backendRoot,
  "prisma",
  "demo-data",
  "projects",
  "source-images",
);

export const communityDemoProjectImageUrl = (
  extractedImageRelativePath: string,
): string => {
  const normalized = extractedImageRelativePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  return `${COMMUNITY_DEMO_PROJECTS_PUBLIC_PREFIX}/${normalized}`;
};

export const communityDemoProjectImageDiskPath = (
  extractedImageRelativePath: string,
): string => {
  const normalized = extractedImageRelativePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  return path.join(
    COMMUNITY_DEMO_PROJECTS_SOURCE_IMAGES_DIR,
    ...normalized.split("/"),
  );
};
