import { z } from 'zod';

import { MATERIAL_UPLOAD_PUBLIC_PREFIX } from '../constants/material-upload.js';

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
