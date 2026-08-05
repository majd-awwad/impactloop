import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MATERIAL_UPLOAD_ALLOWED_MIME_TYPES,
} from '../../constants/material-upload.js';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

export const BUILD_COMPLETION_UPLOADS_DIR = path.join(
  backendRoot,
  'uploads',
  'build-completion',
);

export const BUILD_COMPLETION_UPLOAD_PUBLIC_PREFIX = '/uploads/build-completion';

export const ensureBuildCompletionUploadsDir = (): void => {
  fs.mkdirSync(BUILD_COMPLETION_UPLOADS_DIR, { recursive: true });
};

const extensionForMime = (mimeType: string): string | null => {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
};

export const buildCompletionImageFilename = (
  userId: string,
  mimeType: string,
): string => {
  const extension = extensionForMime(mimeType);

  if (!extension) {
    throw new Error('Unsupported image MIME type');
  }

  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const randomSuffix = randomBytes(8).toString('hex');

  return `build_completion_${safeUserId}_${Date.now()}_${randomSuffix}.${extension}`;
};

export const publicBuildCompletionImageUrl = (filename: string): string =>
  `${BUILD_COMPLETION_UPLOAD_PUBLIC_PREFIX}/${filename}`;

export const isAllowedBuildCompletionImageMime = (mimeType: string): boolean =>
  MATERIAL_UPLOAD_ALLOWED_MIME_TYPES.has(mimeType);
