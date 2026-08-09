import type { NextFunction, Request, Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';

import { PROFILE_UPLOAD_MAX_BYTES } from '../../constants/profile-upload.js';
import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';

import { isAllowedProfileImageMime } from './profile-uploads.storage.js';
import {
  buildTempUploadFilename,
  ensureUploadTempDir,
  UPLOAD_TEMP_DIR,
} from './secure-upload.js';

ensureUploadTempDir();

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    ensureUploadTempDir();
    callback(null, UPLOAD_TEMP_DIR);
  },
  filename: (_req, _file, callback) => {
    callback(null, buildTempUploadFilename());
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
): void => {
  if (!isAllowedProfileImageMime(file.mimetype)) {
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
    fileSize: PROFILE_UPLOAD_MAX_BYTES,
    files: 1,
  },
});

export const profileImageUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  upload.single('image')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'The image must be 5 MB or smaller.'
          : error.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Use the image field to upload a profile photo.'
            : 'Image upload failed.';

      next(
        new AppError(message, 400, COMMON_ERROR_CODES.validationError),
      );
      return;
    }

    next(error);
  });
};
