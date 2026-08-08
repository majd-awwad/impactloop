import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { resolveUploadSubdir } from '../../config/upload-storage.env.js';
import {
  SUPPLIER_VERIFICATION_UPLOAD_ALLOWED_MIME_TYPES,
  SUPPLIER_VERIFICATION_UPLOAD_PUBLIC_PREFIX,
} from '../../constants/supplier-verification-upload.js';
import { AppError } from '../../utils/app-error.js';

import {
  finalizeTempUpload,
  safeUnlink,
  validateVerificationDocumentAtPath,
} from './secure-upload.js';

export const SUPPLIER_VERIFICATION_UPLOADS_DIR = resolveUploadSubdir(
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

export type ResolvedSupplierVerificationDocument = {
  absolutePath: string;
  filename: string;
  mimeType: string;
};

const VERIFICATION_FILENAME_PATTERN =
  /^[a-zA-Z0-9_-]+\.(?:pdf|jpe?g|png)$/i;

const mimeTypeForVerificationFilename = (filename: string): string => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  return 'image/jpeg';
};

const assertPathInsideUploadsDir = (absolutePath: string): void => {
  const uploadsRoot = path.resolve(SUPPLIER_VERIFICATION_UPLOADS_DIR);
  const resolved = path.resolve(absolutePath);
  const prefix = uploadsRoot.endsWith(path.sep)
    ? uploadsRoot
    : `${uploadsRoot}${path.sep}`;

  if (resolved !== uploadsRoot && !resolved.startsWith(prefix)) {
    throw new AppError(
      'Verification document is not available for download.',
      404,
      'NOT_FOUND',
    );
  }
};

/**
 * Resolves a stored verification document object key
 * (`/uploads/supplier-verification/<filename>`) to a local file.
 * Remote/non-local URLs are not downloadable through this path.
 */
export const resolveLocalSupplierVerificationDocument = (
  documentUrl: string | null | undefined,
): ResolvedSupplierVerificationDocument => {
  const trimmed = documentUrl?.trim() ?? '';

  if (!trimmed) {
    throw new AppError('Verification document not found.', 404, 'NOT_FOUND');
  }

  const prefix = `${SUPPLIER_VERIFICATION_UPLOAD_PUBLIC_PREFIX}/`;
  if (!trimmed.startsWith(prefix)) {
    throw new AppError(
      'Verification document is not available for download.',
      404,
      'NOT_FOUND',
    );
  }

  const filename = path.basename(trimmed.slice(prefix.length));
  if (!VERIFICATION_FILENAME_PATTERN.test(filename)) {
    throw new AppError(
      'Verification document is not available for download.',
      404,
      'NOT_FOUND',
    );
  }

  const absolutePath = path.join(SUPPLIER_VERIFICATION_UPLOADS_DIR, filename);
  assertPathInsideUploadsDir(absolutePath);

  if (!fs.existsSync(absolutePath)) {
    throw new AppError(
      'Verification document file not found.',
      404,
      'NOT_FOUND',
    );
  }

  return {
    absolutePath,
    filename,
    mimeType: mimeTypeForVerificationFilename(filename),
  };
};

export const buildInlineContentDisposition = (filename: string): string => {
  const safeAscii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  const encoded = encodeURIComponent(filename);
  return `inline; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
};

export const mapUploadedVerificationDocument = async (
  file: Express.Multer.File | undefined,
  userId: string,
): Promise<UploadedVerificationDocument> => {
  if (!file?.path) {
    throw new AppError(
      'Select a verification document to upload.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const tempPath = file.path;

  try {
    const mimeType = await validateVerificationDocumentAtPath(
      tempPath,
      SUPPLIER_VERIFICATION_UPLOAD_ALLOWED_MIME_TYPES,
    );
    const filename = buildSupplierVerificationDocumentFilename(userId, mimeType);
    const finalPath = path.join(SUPPLIER_VERIFICATION_UPLOADS_DIR, filename);

    await finalizeTempUpload(tempPath, finalPath);

    const stat = await fsp.stat(finalPath);

    return {
      url: publicSupplierVerificationDocumentUrl(filename),
      filename,
      name: file.originalname.trim() || filename,
      mimeType,
      sizeBytes: stat.size,
    };
  } catch (error) {
    await safeUnlink(tempPath);
    throw error;
  }
};
