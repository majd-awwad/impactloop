import type { NextFunction, Request, Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';

import { MATERIAL_UPLOAD_MAX_BYTES } from '../../constants/material-upload.js';
import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';

import {
  buildCompletionImageFilename,
  BUILD_COMPLETION_UPLOADS_DIR,
  ensureBuildCompletionUploadsDir,
  isAllowedBuildCompletionImageMime,
} from '../learning-projects/build-completion-uploads.storage.js';

ensureBuildCompletionUploadsDir();

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    ensureBuildCompletionUploadsDir();
    callback(null, BUILD_COMPLETION_UPLOADS_DIR);
  },
  filename: (req, file, callback) => {
    try {
      const userId = req.auth?.sub ?? 'anonymous';
      callback(null, buildCompletionImageFilename(userId, file.mimetype));
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
  if (!isAllowedBuildCompletionImageMime(file.mimetype)) {
    callback(
      new AppError(
        'Only JPG, PNG, and WebP images are allowed.',
        400,
        COMMON_ERROR_CODES.validationError,
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
    files: 1,
  },
});

export const buildCompletionPhotoUploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  upload.single('photo')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(
          new AppError(
            'Image exceeds the maximum allowed size.',
            400,
            COMMON_ERROR_CODES.validationError,
          ),
        );
        return;
      }

      next(
        new AppError(
          error.message,
          400,
          COMMON_ERROR_CODES.validationError,
        ),
      );
      return;
    }

    if (error) {
      next(error);
      return;
    }

    next();
  });
};
