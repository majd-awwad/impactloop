import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import { SUPPLIER_VERIFICATION_UPLOAD_MAX_BYTES } from '../../constants/supplier-verification-upload.js';
import { AppError } from '../../utils/app-error.js';

import {
  buildSupplierVerificationDocumentFilename,
  isAllowedSupplierVerificationDocumentMime,
  SUPPLIER_VERIFICATION_UPLOADS_DIR,
} from './verification-uploads.storage.js';

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, SUPPLIER_VERIFICATION_UPLOADS_DIR);
  },
  filename: (req, file, callback) => {
    try {
      const filename = buildSupplierVerificationDocumentFilename(
        req.auth!.sub,
        file.mimetype,
      );
      callback(null, filename);
    } catch (error) {
      callback(error as Error, '');
    }
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
          'VALIDATION_ERROR',
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
          'VALIDATION_ERROR',
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
