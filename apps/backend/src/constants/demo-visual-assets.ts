import path from "node:path";
import { fileURLToPath } from "node:url";

/** Public URL prefix for curated demo visual assets (people + core material supplements). */
export const DEMO_VISUAL_ASSETS_PUBLIC_PREFIX = "/demo-assets/visual-assets";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** On-disk demo visual assets committed under prisma/demo-data/visual-assets/. */
export const DEMO_VISUAL_ASSETS_DIR = path.join(
  backendRoot,
  "prisma",
  "demo-data",
  "visual-assets",
);

export const demoVisualAssetUrl = (relativePath: string): string => {
  const normalized = relativePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  return `${DEMO_VISUAL_ASSETS_PUBLIC_PREFIX}/${normalized}`;
};

export const demoVisualAssetDiskPath = (relativePath: string): string => {
  const normalized = relativePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  return path.join(DEMO_VISUAL_ASSETS_DIR, ...normalized.split("/"));
};
