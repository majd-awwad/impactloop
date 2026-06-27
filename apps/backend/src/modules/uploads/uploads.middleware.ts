import type { NextFunction, Request, Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';

import {
  MATERIAL_UPLOAD_MAX_BYTES,
  MATERIAL_UPLOAD_MAX_FILES,
} from '../../constants/material-upload.js';
import { AppError } from '../../utils/app-error.js';

import {
  buildMaterialImageFilename,
  ensureMaterialUploadsDir,
  isAllowedMaterialImageMime,
  MATERIAL_UPLOADS_DIR,
} from './uploads.storage.js';

ensureMaterialUploadsDir();

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    ensureMaterialUploadsDir();
    callback(null, MATERIAL_UPLOADS_DIR);
  },
  filename: (req, file, callback) => {
    try {
      const userId = req.auth?.sub ?? 'anonymous';
      callback(null, buildMaterialImageFilename(userId, file.mimetype));
    } catch (error) {
      callback(error as Error, '');
    }
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
): void => {
  if (!isAllowedMaterialImageMime(file.mimetype)) {
    callback(
      new AppError(
        'Only JPG, PNG, and WebP images are allowed.',
        400,
        'VALIDATION_ERROR',
      ),
    );
    return;
  }

  callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MATERIAL_UPLOAD_MAX_BYTES,
    files: MATERIAL_UPLOAD_MAX_FILES,
  },
});

export const materialImagesUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  upload.array('images', MATERIAL_UPLOAD_MAX_FILES)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'Each image must be 5 MB or smaller.'
          : error.code === 'LIMIT_FILE_COUNT'
            ? 'You can upload up to 5 images per request.'
            : 'Image upload failed.';

      next(new AppError(message, 400, 'VALIDATION_ERROR'));
      return;
    }

    next(error);
  });
};
