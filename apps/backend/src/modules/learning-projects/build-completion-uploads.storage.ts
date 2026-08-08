import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { resolveUploadSubdir } from '../../config/upload-storage.env.js';
import {
  MATERIAL_UPLOAD_ALLOWED_MIME_TYPES,
} from '../../constants/material-upload.js';
import { AppError } from '../../utils/app-error.js';

export const BUILD_COMPLETION_UPLOADS_DIR = resolveUploadSubdir(
  'build-completion',
);

/** Internal storage prefix — not served via anonymous static middleware. */
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

export const buildCompletionPhotoContentPath = (
  buildId: string,
  photoId: string,
): string =>
  `/api/learner/builds/${buildId}/completion-story/photos/${photoId}/content`;

export const isAllowedBuildCompletionImageMime = (mimeType: string): boolean =>
  MATERIAL_UPLOAD_ALLOWED_MIME_TYPES.has(mimeType);

export type ResolvedBuildCompletionImage = {
  absolutePath: string;
  filename: string;
  mimeType: string;
};

const BUILD_COMPLETION_FILENAME_PATTERN =
  /^build_completion_[a-zA-Z0-9_-]+_\d+_[a-f0-9]+\.(?:jpe?g|png|webp)$/i;

const mimeTypeForBuildCompletionFilename = (filename: string): string => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
};

const assertPathInsideUploadsDir = (absolutePath: string): void => {
  const uploadsRoot = path.resolve(BUILD_COMPLETION_UPLOADS_DIR);
  const resolved = path.resolve(absolutePath);
  const prefix = uploadsRoot.endsWith(path.sep)
    ? uploadsRoot
    : `${uploadsRoot}${path.sep}`;

  if (resolved !== uploadsRoot && !resolved.startsWith(prefix)) {
    throw new AppError(
      'Completion photo is not available for download.',
      404,
      'NOT_FOUND',
    );
  }
};

/**
 * Resolves a stored completion photo object key
 * (`/uploads/build-completion/<filename>`) to a local file.
 * Remote/non-local URLs are not downloadable through this path.
 */
export const resolveLocalBuildCompletionImage = (
  imageUrl: string | null | undefined,
): ResolvedBuildCompletionImage => {
  const trimmed = imageUrl?.trim() ?? '';

  if (!trimmed) {
    throw new AppError('Completion photo not found.', 404, 'NOT_FOUND');
  }

  const prefix = `${BUILD_COMPLETION_UPLOAD_PUBLIC_PREFIX}/`;
  if (!trimmed.startsWith(prefix)) {
    throw new AppError(
      'Completion photo is not available for download.',
      404,
      'NOT_FOUND',
    );
  }

  const filename = path.basename(trimmed.slice(prefix.length));
  if (!BUILD_COMPLETION_FILENAME_PATTERN.test(filename)) {
    throw new AppError(
      'Completion photo is not available for download.',
      404,
      'NOT_FOUND',
    );
  }

  const absolutePath = path.join(BUILD_COMPLETION_UPLOADS_DIR, filename);
  assertPathInsideUploadsDir(absolutePath);

  if (!fs.existsSync(absolutePath)) {
    throw new AppError('Completion photo file not found.', 404, 'NOT_FOUND');
  }

  return {
    absolutePath,
    filename,
    mimeType: mimeTypeForBuildCompletionFilename(filename),
  };
};
