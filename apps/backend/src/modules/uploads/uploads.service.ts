import { AppError } from '../../utils/app-error.js';

import {
  isAllowedMaterialImageMime,
  publicMaterialImageUrl,
} from './uploads.storage.js';

export type UploadedMaterialImage = {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export const mapUploadedMaterialImages = (
  files: Express.Multer.File[],
): UploadedMaterialImage[] => {
  if (!files.length) {
    throw new AppError('Select at least one image to upload.', 400, 'VALIDATION_ERROR');
  }

  return files.map((file) => {
    if (!isAllowedMaterialImageMime(file.mimetype)) {
      throw new AppError(
        'Only JPG, PNG, and WebP images are allowed.',
        400,
        'VALIDATION_ERROR',
      );
    }

    return {
      url: publicMaterialImageUrl(file.filename),
      filename: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  });
};
