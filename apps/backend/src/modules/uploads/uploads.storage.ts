import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MATERIAL_UPLOAD_ALLOWED_MIME_TYPES,
  MATERIAL_UPLOAD_PUBLIC_PREFIX,
} from '../../constants/material-upload.js';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

export const MATERIAL_UPLOADS_DIR = path.join(backendRoot, 'uploads', 'materials');

export const ensureMaterialUploadsDir = (): void => {
  fs.mkdirSync(MATERIAL_UPLOADS_DIR, { recursive: true });
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

export const buildMaterialImageFilename = (
  userId: string,
  mimeType: string,
): string => {
  const extension = extensionForMime(mimeType);

  if (!extension) {
    throw new Error('Unsupported image MIME type');
  }

  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const randomSuffix = randomBytes(8).toString('hex');

  return `material_${safeUserId}_${Date.now()}_${randomSuffix}.${extension}`;
};

export const publicMaterialImageUrl = (filename: string): string =>
  `${MATERIAL_UPLOAD_PUBLIC_PREFIX}/${filename}`;

export const materialThumbnailFilename = (filename: string): string =>
  `thumb_${path.parse(filename).name}.webp`;

export const materialThumbnailPath = (filename: string): string =>
  path.join(MATERIAL_UPLOADS_DIR, materialThumbnailFilename(filename));

export const publicMaterialThumbnailUrl = (filename: string): string =>
  publicMaterialImageUrl(materialThumbnailFilename(filename));

export const isAllowedMaterialImageMime = (mimeType: string): boolean =>
  MATERIAL_UPLOAD_ALLOWED_MIME_TYPES.has(mimeType);
