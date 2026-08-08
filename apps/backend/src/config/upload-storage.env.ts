/**
 * Upload filesystem root configuration.
 *
 * Production deployments must mount a persistent volume at UPLOAD_ROOT_DIR
 * (see docs/deployment.md). Object storage is not implemented; all uploads
 * use the local filesystem under this directory.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const defaultUploadRootDir = path.join(backendRoot, 'uploads');

export const resolveUploadRootDir = (
  processEnv: NodeJS.Dict<string> = process.env,
): string => {
  const configured = processEnv.UPLOAD_ROOT_DIR?.trim();
  if (!configured) {
    return defaultUploadRootDir;
  }

  return path.isAbsolute(configured)
    ? path.resolve(configured)
    : path.resolve(backendRoot, configured);
};

export const uploadRootDir = resolveUploadRootDir();

export const resolveUploadSubdir = (
  segment: string,
  processEnv: NodeJS.Dict<string> = process.env,
): string => path.join(resolveUploadRootDir(processEnv), segment);
