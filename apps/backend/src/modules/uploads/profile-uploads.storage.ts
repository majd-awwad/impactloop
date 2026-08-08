import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

import { resolveUploadSubdir } from '../../config/upload-storage.env.js';
import {
  PROFILE_UPLOAD_ALLOWED_MIME_TYPES,
  PROFILE_UPLOAD_PUBLIC_PREFIX,
} from '../../constants/profile-upload.js';

export const PROFILE_UPLOADS_DIR = resolveUploadSubdir('profiles');

export const ensureProfileUploadsDir = (): void => {
  fs.mkdirSync(PROFILE_UPLOADS_DIR, { recursive: true });
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

export const buildProfileImageFilename = (
  userId: string,
  mimeType: string,
): string => {
  const extension = extensionForMime(mimeType);

  if (!extension) {
    throw new Error('Unsupported image MIME type');
  }

  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const randomSuffix = randomBytes(8).toString('hex');

  return `profile_${safeUserId}_${Date.now()}_${randomSuffix}.${extension}`;
};

export const publicProfileImageUrl = (filename: string): string =>
  `${PROFILE_UPLOAD_PUBLIC_PREFIX}/${filename}`;

export const isAllowedProfileImageMime = (mimeType: string): boolean =>
  PROFILE_UPLOAD_ALLOWED_MIME_TYPES.has(mimeType);
