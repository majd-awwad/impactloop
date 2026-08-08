import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { resolveUploadSubdir } from '../../config/upload-storage.env.js';
import { AppError } from '../../utils/app-error.js';

export const UPLOAD_TEMP_DIR = resolveUploadSubdir('.tmp');

export const ensureUploadTempDir = (): void => {
  fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
};

export const buildTempUploadFilename = (): string =>
  `upload_${Date.now()}_${randomBytes(8).toString('hex')}.part`;

export const safeUnlink = async (filePath: string | undefined): Promise<void> => {
  if (!filePath) {
    return;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fsp.unlink(filePath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return;
      }

      if (code === 'EBUSY' && attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        continue;
      }

      return;
    }
  }
};

export const finalizeTempUpload = async (
  tempPath: string,
  finalPath: string,
): Promise<void> => {
  await fsp.mkdir(path.dirname(finalPath), { recursive: true });

  try {
    await fsp.rename(tempPath, finalPath);
    return;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EXDEV' && code !== 'EBUSY') {
      throw error;
    }
  }

  await fsp.copyFile(tempPath, finalPath);
  await safeUnlink(tempPath);
};

export type DetectedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export type DetectedVerificationDocumentMimeType =
  | DetectedImageMimeType
  | 'application/pdf';

const readFileHeader = async (
  filePath: string,
  byteCount: number,
): Promise<Buffer> => {
  const handle = await fsp.open(filePath, 'r');

  try {
    const buffer = Buffer.alloc(byteCount);
    const { bytesRead } = await handle.read(buffer, 0, byteCount, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

export const detectImageMimeTypeFromBytes = (
  bytes: Buffer,
): DetectedImageMimeType | null => {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }

  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
};

export const detectPdfFromBytes = (bytes: Buffer): boolean =>
  bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-';

const imageFormatToMimeType = (
  format: string | undefined,
): DetectedImageMimeType | null => {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
};

export const validateImageFileAtPath = async (
  filePath: string,
  allowedMimeTypes: ReadonlySet<string>,
  invalidMessage = 'Only JPG, PNG, and WebP images are allowed.',
): Promise<DetectedImageMimeType> => {
  const fileBuffer = await fsp.readFile(filePath);
  const detectedFromBytes = detectImageMimeTypeFromBytes(
    fileBuffer.subarray(0, 16),
  );

  if (!detectedFromBytes || !allowedMimeTypes.has(detectedFromBytes)) {
    throw new AppError(invalidMessage, 400, 'VALIDATION_ERROR');
  }

  try {
    const metadata = await sharp(fileBuffer).metadata();
    const detectedFromDecode = imageFormatToMimeType(metadata.format);

    if (!detectedFromDecode || detectedFromDecode !== detectedFromBytes) {
      throw new Error('Image decode validation failed');
    }
  } catch {
    throw new AppError(invalidMessage, 400, 'VALIDATION_ERROR');
  }

  return detectedFromBytes;
};

const assertPdfStructure = async (filePath: string): Promise<void> => {
  const stat = await fsp.stat(filePath);
  const trailerSize = Math.min(1024, stat.size);
  const trailer = Buffer.alloc(trailerSize);
  const handle = await fsp.open(filePath, 'r');

  try {
    await handle.read(trailer, 0, trailerSize, stat.size - trailerSize);
  } finally {
    await handle.close();
  }

  if (!trailer.includes(Buffer.from('%%EOF'))) {
    throw new Error('PDF structure validation failed');
  }
};

export const validatePdfFileAtPath = async (
  filePath: string,
  invalidMessage = 'Verification document must be a PDF, JPG, or PNG file.',
): Promise<void> => {
  const header = await readFileHeader(filePath, 8);

  if (!detectPdfFromBytes(header)) {
    throw new AppError(invalidMessage, 400, 'VALIDATION_ERROR');
  }

  try {
    await assertPdfStructure(filePath);
  } catch {
    throw new AppError(invalidMessage, 400, 'VALIDATION_ERROR');
  }
};

export const validateVerificationDocumentAtPath = async (
  filePath: string,
  allowedMimeTypes: ReadonlySet<string>,
): Promise<DetectedVerificationDocumentMimeType> => {
  const header = await readFileHeader(filePath, 16);
  const invalidMessage =
    'Verification document must be a PDF, JPG, or PNG file.';

  if (detectPdfFromBytes(header)) {
    if (!allowedMimeTypes.has('application/pdf')) {
      throw new AppError(invalidMessage, 400, 'VALIDATION_ERROR');
    }

    await validatePdfFileAtPath(filePath, invalidMessage);
    return 'application/pdf';
  }

  return validateImageFileAtPath(filePath, allowedMimeTypes, invalidMessage);
};

export const assertPathInsideUploadsDir = (
  absolutePath: string,
  uploadsDir: string,
): void => {
  const uploadsRoot = path.resolve(uploadsDir);
  const resolved = path.resolve(absolutePath);
  const prefix = uploadsRoot.endsWith(path.sep)
    ? uploadsRoot
    : `${uploadsRoot}${path.sep}`;

  if (resolved !== uploadsRoot && !resolved.startsWith(prefix)) {
    throw new Error('Resolved upload path is outside uploads directory');
  }
};

export const deleteManagedLocalUpload = (
  publicUrl: string | null | undefined,
  options: {
    uploadsDir: string;
    publicPrefix: string;
    filenamePattern: RegExp;
    excludePublicUrl?: string | null;
  },
): void => {
  const trimmed = publicUrl?.trim() ?? '';
  if (!trimmed) {
    return;
  }

  const exclude = options.excludePublicUrl?.trim();
  if (exclude && trimmed === exclude) {
    return;
  }

  const prefix = `${options.publicPrefix}/`;
  if (!trimmed.startsWith(prefix)) {
    return;
  }

  const filename = path.basename(trimmed.slice(prefix.length));
  if (!options.filenamePattern.test(filename)) {
    return;
  }

  const absolutePath = path.join(options.uploadsDir, filename);

  try {
    assertPathInsideUploadsDir(absolutePath, options.uploadsDir);
  } catch {
    return;
  }

  try {
    fs.unlinkSync(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      return;
    }
  }
};
