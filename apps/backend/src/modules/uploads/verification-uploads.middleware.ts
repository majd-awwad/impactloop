import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import { SUPPLIER_VERIFICATION_UPLOAD_MAX_BYTES } from '../../constants/supplier-verification-upload.js';
import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';

import {
  buildTempUploadFilename,
  ensureUploadTempDir,
  UPLOAD_TEMP_DIR,
} from './secure-upload.js';
import { isAllowedSupplierVerificationDocumentMime } from './verification-uploads.storage.js';

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

const upload = multer({
  storage,
  limits: {
    fileSize: SUPPLIER_VERIFICATION_UPLOAD_MAX_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedSupplierVerificationDocumentMime(file.mimetype)) {
      callback(
        new AppError(
          'Verification document must be a PDF, JPG, or PNG file.',
          400,
          COMMON_ERROR_CODES.validationError,
        ),
      );
      return;
    }

    callback(null, true);
  },
});

export const supplierVerificationDocumentUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  upload.single('document')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      next(
        new AppError(
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Verification document must be 5MB or smaller.'
            : 'Verification document upload failed.',
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
