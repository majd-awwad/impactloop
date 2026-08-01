import { AppError } from '../../utils/app-error.js';
import sharp from 'sharp';

import {
  isAllowedMaterialImageMime,
  publicMaterialImageUrl,
  publicMaterialThumbnailUrl,
  materialThumbnailPath,
} from './uploads.storage.js';
import {
  isAllowedProfileImageMime,
  publicProfileImageUrl,
} from './profile-uploads.storage.js';

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

export const mapUploadedProfileImage = (
  file: Express.Multer.File | undefined,
): UploadedProfileImage => {
  if (!file) {
    throw new AppError('Select an image to upload.', 400, 'VALIDATION_ERROR');
  }

  if (!isAllowedProfileImageMime(file.mimetype)) {
    throw new AppError(
      'Only JPG, PNG, and WebP images are allowed.',
      400,
      'VALIDATION_ERROR',
    );
  }

  return {
    url: publicProfileImageUrl(file.filename),
    filename: file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  };
};
