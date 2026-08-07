import fsp from 'node:fs/promises';
import path from 'node:path';

import { AppError } from '../../utils/app-error.js';
import sharp from 'sharp';

import { PROFILE_UPLOAD_ALLOWED_MIME_TYPES } from '../../constants/profile-upload.js';

import {
  buildProfileImageFilename,
  PROFILE_UPLOADS_DIR,
  publicProfileImageUrl,
} from './profile-uploads.storage.js';
import {
  finalizeTempUpload,
  safeUnlink,
  validateImageFileAtPath,
} from './secure-upload.js';
import {
  isAllowedMaterialImageMime,
  publicMaterialImageUrl,
  publicMaterialThumbnailUrl,
  materialThumbnailPath,
} from './uploads.storage.js';

export type UploadedMaterialImage = {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl?: string;
};

export type UploadedProfileImage = UploadedMaterialImage;

export const mapUploadedMaterialImages = async (
  files: Express.Multer.File[],
): Promise<UploadedMaterialImage[]> => {
  if (!files.length) {
    throw new AppError('Select at least one image to upload.', 400, 'VALIDATION_ERROR');
  }

  return Promise.all(files.map(async (file) => {
    if (!isAllowedMaterialImageMime(file.mimetype)) {
      throw new AppError(
        'Only JPG, PNG, and WebP images are allowed.',
        400,
        'VALIDATION_ERROR',
      );
    }

    await sharp(file.path)
      .rotate()
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(materialThumbnailPath(file.filename));

    return {
      url: publicMaterialImageUrl(file.filename),
      thumbnailUrl: publicMaterialThumbnailUrl(file.filename),
      filename: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }));
};

export const mapUploadedProfileImage = async (
  file: Express.Multer.File | undefined,
  userId: string,
): Promise<UploadedProfileImage> => {
  if (!file?.path) {
    throw new AppError('Select an image to upload.', 400, 'VALIDATION_ERROR');
  }

  const tempPath = file.path;

  try {
    const mimeType = await validateImageFileAtPath(
      tempPath,
      PROFILE_UPLOAD_ALLOWED_MIME_TYPES,
    );
    const filename = buildProfileImageFilename(userId, mimeType);
    const finalPath = path.join(PROFILE_UPLOADS_DIR, filename);

    await finalizeTempUpload(tempPath, finalPath);

    const stat = await fsp.stat(finalPath);

    return {
      url: publicProfileImageUrl(filename),
      filename,
      mimeType,
      sizeBytes: stat.size,
    };
  } catch (error) {
    await safeUnlink(tempPath);
    throw error;
  }
};
