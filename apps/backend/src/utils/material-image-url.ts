import { z } from 'zod';

import { MATERIAL_UPLOAD_PUBLIC_PREFIX } from '../constants/material-upload.js';
import fs from 'node:fs';
import path from 'node:path';
import {
  materialThumbnailPath,
  publicMaterialThumbnailUrl,
} from '../modules/uploads/uploads.storage.js';

export const isMaterialImageUrl = (value: string): boolean => {
  const trimmed = value.trim();

  if (trimmed.startsWith(`${MATERIAL_UPLOAD_PUBLIC_PREFIX}/`)) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const materialImageUrlSchema = z
  .string()
  .trim()
  .refine(isMaterialImageUrl, { message: 'Invalid material image URL' });

export const cardMaterialImageUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith(`${MATERIAL_UPLOAD_PUBLIC_PREFIX}/`)) {
    const filename = path.basename(trimmed);
    return fs.existsSync(materialThumbnailPath(filename))
      ? publicMaterialThumbnailUrl(filename)
      : trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === 'images.unsplash.com') {
      parsed.searchParams.set('w', '480');
      parsed.searchParams.set('fit', 'crop');
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('q', '75');
      return parsed.toString();
    }
  } catch {
    return trimmed;
  }
  return trimmed;
};
