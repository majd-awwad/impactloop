import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SUPPLIER_VERIFICATION_UPLOAD_ALLOWED_MIME_TYPES,
  SUPPLIER_VERIFICATION_UPLOAD_PUBLIC_PREFIX,
} from '../../constants/supplier-verification-upload.js';
import { AppError } from '../../utils/app-error.js';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

export const SUPPLIER_VERIFICATION_UPLOADS_DIR = path.join(
  backendRoot,
  'uploads',
  'supplier-verification',
);

export const ensureSupplierVerificationUploadsDir = (): void => {
  fs.mkdirSync(SUPPLIER_VERIFICATION_UPLOADS_DIR, { recursive: true });
};

const extensionForMime = (mimeType: string): string | null => {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    default:
      return null;
  }
};

export const buildSupplierVerificationDocumentFilename = (
  userId: string,
  mimeType: string,
): string => {
  const extension = extensionForMime(mimeType);

  if (!extension) {
    throw new Error('Unsupported verification document MIME type');
  }

  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const randomSuffix = randomBytes(8).toString('hex');

  return `verification_${safeUserId}_${Date.now()}_${randomSuffix}.${extension}`;
};

export const publicSupplierVerificationDocumentUrl = (filename: string): string =>
  `${SUPPLIER_VERIFICATION_UPLOAD_PUBLIC_PREFIX}/${filename}`;

export const isAllowedSupplierVerificationDocumentMime = (
  mimeType: string,
): boolean => SUPPLIER_VERIFICATION_UPLOAD_ALLOWED_MIME_TYPES.has(mimeType);

export type UploadedVerificationDocument = {
  url: string;
  filename: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

export const mapUploadedVerificationDocument = (
  file: Express.Multer.File | undefined,
): UploadedVerificationDocument => {
  if (!file) {
    throw new AppError(
      'Select a verification document to upload.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (!isAllowedSupplierVerificationDocumentMime(file.mimetype)) {
    throw new AppError(
      'Verification document must be a PDF, JPG, or PNG file.',
      400,
      'VALIDATION_ERROR',
    );
  }

  return {
    url: publicSupplierVerificationDocumentUrl(file.filename),
    filename: file.filename,
    name: file.originalname.trim() || file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  };
};
