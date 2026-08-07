import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

import sharp from 'sharp';

import { PROFILE_UPLOAD_ALLOWED_MIME_TYPES } from '../../constants/profile-upload.js';
import { AppError } from '../../utils/app-error.js';

import { deleteReplacedProfileUpload } from './local-upload-cleanup.js';
import { PROFILE_UPLOADS_DIR } from './profile-uploads.storage.js';
import {
  detectImageMimeTypeFromBytes,
  detectPdfFromBytes,
  finalizeTempUpload,
  safeUnlink,
  UPLOAD_TEMP_DIR,
  validateImageFileAtPath,
  validatePdfFileAtPath,
  validateVerificationDocumentAtPath,
} from './secure-upload.js';

const createTempDir = async (): Promise<string> => {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'secure-upload-test-'));
};

describe('secure upload validation', () => {
  let tempDir = '';

  before(async () => {
    tempDir = await createTempDir();
    fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
    fs.mkdirSync(PROFILE_UPLOADS_DIR, { recursive: true });
  });

  after(async () => {
    await fsp.rm(tempDir, { force: true, recursive: true });
  });

  test('detects image mime types from magic bytes', () => {
    assert.equal(
      detectImageMimeTypeFromBytes(Buffer.from([0xff, 0xd8, 0xff, 0xdb])),
      'image/jpeg',
    );
    assert.equal(
      detectImageMimeTypeFromBytes(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
      'image/png',
    );
    assert.equal(
      detectImageMimeTypeFromBytes(
        Buffer.concat([
          Buffer.from('RIFF', 'ascii'),
          Buffer.alloc(4),
          Buffer.from('WEBP', 'ascii'),
        ]),
      ),
      'image/webp',
    );
    assert.equal(detectImageMimeTypeFromBytes(Buffer.from('not-an-image')), null);
  });

  test('detects PDF magic bytes', () => {
    assert.equal(detectPdfFromBytes(Buffer.from('%PDF-1.4')), true);
    assert.equal(detectPdfFromBytes(Buffer.from('plain-text')), false);
  });

  test('rejects non-image bytes even when client MIME claims image/jpeg', async () => {
    const fakeImagePath = path.join(tempDir, 'fake.jpg');
    await fsp.writeFile(fakeImagePath, 'this is not a real jpeg file');

    await assert.rejects(
      () =>
        validateImageFileAtPath(fakeImagePath, PROFILE_UPLOAD_ALLOWED_MIME_TYPES),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  test('accepts a real encoded image and finalize moves it atomically', async () => {
    const tempPath = path.join(tempDir, 'source.part');
    const finalPath = path.join(tempDir, 'profile_test.webp');

    await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: '#336699',
      },
    })
      .webp()
      .toFile(tempPath);

    const mimeType = await validateImageFileAtPath(
      tempPath,
      PROFILE_UPLOAD_ALLOWED_MIME_TYPES,
    );
    assert.equal(mimeType, 'image/webp');

    await finalizeTempUpload(tempPath, finalPath);

    assert.equal(fs.existsSync(tempPath), false);
    assert.equal(fs.existsSync(finalPath), true);
  });

  test('validates PDF structure before accepting upload', async () => {
    const invalidPdfPath = path.join(tempDir, 'invalid.pdf');
    await fsp.writeFile(invalidPdfPath, '%PDF-1.4\nnot-a-real-pdf');

    await assert.rejects(
      () => validatePdfFileAtPath(invalidPdfPath),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        return true;
      },
    );

    const validPdfPath = path.join(tempDir, 'valid.pdf');
    await fsp.writeFile(
      validPdfPath,
      '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n',
    );

    await validatePdfFileAtPath(validPdfPath);
    const mimeType = await validateVerificationDocumentAtPath(validPdfPath, new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
    ]));
    assert.equal(mimeType, 'application/pdf');
  });

  test('cleans up temp files on validation failure', async () => {
    const tempPath = path.join(UPLOAD_TEMP_DIR, `cleanup-test-${Date.now()}.part`);
    await fsp.writeFile(tempPath, 'invalid');

    await assert.rejects(() =>
      validateImageFileAtPath(tempPath, PROFILE_UPLOAD_ALLOWED_MIME_TYPES),
    );

    await safeUnlink(tempPath);
    assert.equal(fs.existsSync(tempPath), false);
  });

  test('deletes replaced profile uploads without touching unrelated urls', async () => {
    const filename = `profile_testuser_${Date.now()}_abc12345.webp`;
    const filePath = path.join(PROFILE_UPLOADS_DIR, filename);
    const publicUrl = `/uploads/profiles/${filename}`;

    await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: '#ff0000',
      },
    })
      .webp()
      .toFile(filePath);

    deleteReplacedProfileUpload(publicUrl, '/uploads/profiles/other-file.webp');
    assert.equal(fs.existsSync(filePath), false);

    deleteReplacedProfileUpload('https://cdn.example.com/avatar.png');
    deleteReplacedProfileUpload('/uploads/profiles/../secrets.txt');
  });
});
