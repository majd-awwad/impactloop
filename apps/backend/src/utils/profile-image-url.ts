import { z } from 'zod';

import { PROFILE_UPLOAD_PUBLIC_PREFIX } from '../constants/profile-upload.js';

export const isProfileImageUrl = (value: string): boolean => {
  const trimmed = value.trim();

  if (trimmed.startsWith(`${PROFILE_UPLOAD_PUBLIC_PREFIX}/`)) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const profileImageUrlSchema = z
  .string()
  .trim()
  .refine(isProfileImageUrl, { message: 'Invalid profile image URL' });
