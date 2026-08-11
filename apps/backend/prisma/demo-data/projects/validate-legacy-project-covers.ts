/**
 * Validate local cover assets for the original 30 demo projects.
 * Confirms on-disk files exist and decode via sharp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import {
  LEGACY_PROJECT_COVERS,
  findLegacyCoverFilename,
  legacyCoverDiskPath,
} from './legacy-project-covers.data.js';
import { communityDemoProjectImageDiskPath } from '../../../src/constants/community-demo-projects.js';

const CONCURRENCY = 4;

export type CoverValidationResult = {
  key: string;
  url: string;
  ok: boolean;
  status: number | null;
  contentType: string | null;
  width?: number;
  height?: number;
  format?: string;
  error?: string;
};

const validateLocalUrl = async (
  key: string,
  url: string,
): Promise<CoverValidationResult> => {
  try {
    const legacyName = findLegacyCoverFilename(key);
    const diskPath = legacyName
      ? legacyCoverDiskPath(legacyName)
      : communityDemoProjectImageDiskPath(
          url.replace(/^\/demo-assets\/community-projects\//, ''),
        );
    if (!fs.existsSync(diskPath)) {
      return {
        key,
        url,
        ok: false,
        status: null,
        contentType: null,
        error: `local file missing: ${diskPath}`,
      };
    }
    const meta = await sharp(diskPath).metadata();
    if (!meta.width || !meta.height || !meta.format) {
      return {
        key,
        url,
        ok: false,
        status: null,
        contentType: null,
        error: 'sharp could not decode local image metadata',
      };
    }
    return {
      key,
      url,
      ok: true,
      status: 200,
      contentType: `image/${meta.format}`,
      width: meta.width,
      height: meta.height,
      format: meta.format,
    };
  } catch (error) {
    return {
      key,
      url,
      ok: false,
      status: null,
      contentType: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const validateOne = async (
  key: string,
  url: string,
): Promise<CoverValidationResult> => {
  if (url.startsWith('/demo-assets/')) {
    return validateLocalUrl(key, url);
  }

  return {
    key,
    url,
    ok: false,
    status: null,
    contentType: null,
    error: `Expected local /demo-assets/ cover URL, got: ${url}`,
  };
};

const runPool = async <T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const runner = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runner()),
  );
  return results;
};

export const validateLegacyProjectCovers = async (): Promise<{
  validated: CoverValidationResult[];
  okCount: number;
  failed: CoverValidationResult[];
}> => {
  const entries = Object.entries(LEGACY_PROJECT_COVERS);
  if (entries.length !== 30) {
    throw new Error(
      `Expected 30 LEGACY_PROJECT_COVERS entries, found ${entries.length}`,
    );
  }

  const validated = await runPool(
    entries,
    ([key, url]) => validateOne(key, url),
    CONCURRENCY,
  );
  const failed = validated.filter((row) => !row.ok);
  return {
    validated,
    okCount: validated.length - failed.length,
    failed,
  };
};

const isDirectRun = () => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (isDirectRun()) {
  const report = await validateLegacyProjectCovers();
  console.log(
    JSON.stringify(
      {
        total: report.validated.length,
        ok: report.okCount,
        failed: report.failed,
        sample: report.validated.slice(0, 5),
      },
      null,
      2,
    ),
  );

  if (report.failed.length > 0) {
    process.exitCode = 1;
  }
}
