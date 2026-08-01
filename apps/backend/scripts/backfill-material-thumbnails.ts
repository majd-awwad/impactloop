import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import {
  MATERIAL_UPLOADS_DIR,
  materialThumbnailFilename,
} from '../src/modules/uploads/uploads.storage.js';

const supported = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const entries = await fs.readdir(MATERIAL_UPLOADS_DIR, { withFileTypes: true });
let created = 0;
let skipped = 0;

for (const entry of entries) {
  if (!entry.isFile() || entry.name.startsWith('thumb_')) continue;
  if (!supported.has(path.extname(entry.name).toLowerCase())) continue;
  const output = path.join(
    MATERIAL_UPLOADS_DIR,
    materialThumbnailFilename(entry.name),
  );
  try {
    await fs.access(output);
    skipped += 1;
    continue;
  } catch {
    // Missing thumbnail: create it below.
  }
  await sharp(path.join(MATERIAL_UPLOADS_DIR, entry.name))
    .rotate()
    .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toFile(output);
  created += 1;
}

console.log(JSON.stringify({ created, skipped }));
