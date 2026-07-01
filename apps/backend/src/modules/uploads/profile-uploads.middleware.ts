import type { NextFunction, Request, Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';

import { PROFILE_UPLOAD_MAX_BYTES } from '../../constants/profile-upload.js';
import { AppError } from '../../utils/app-error.js';

import {
  buildProfileImageFilename,
  ensureProfileUploadsDir,
  isAllowedProfileImageMime,
  PROFILE_UPLOADS_DIR,
} from './profile-uploads.storage.js';

ensureProfileUploadsDir();

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    ensureProfileUploadsDir();
    callback(null, PROFILE_UPLOADS_DIR);
  },
  filename: (req, file, callback) => {
    try {
      const userId = req.auth?.sub ?? 'anonymous';
      callback(null, buildProfileImageFilename(userId, file.mimetype));
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
  if (!isAllowedProfileImageMime(file.mimetype)) {
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

      next(new AppError(message, 400, 'VALIDATION_ERROR'));
      return;
    }

    next(error);
  });
};
