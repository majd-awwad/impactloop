import { PROFILE_UPLOAD_PUBLIC_PREFIX } from '../../constants/profile-upload.js';
import { SUPPLIER_VERIFICATION_UPLOAD_PUBLIC_PREFIX } from '../../constants/supplier-verification-upload.js';

import { PROFILE_UPLOADS_DIR } from './profile-uploads.storage.js';
import { deleteManagedLocalUpload } from './secure-upload.js';
import { SUPPLIER_VERIFICATION_UPLOADS_DIR } from './verification-uploads.storage.js';

const PROFILE_UPLOAD_FILENAME_PATTERN =
  /^profile_[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/i;

const VERIFICATION_UPLOAD_FILENAME_PATTERN =
  /^verification_[a-zA-Z0-9_-]+\.(?:pdf|jpe?g|png)$/i;

export const deleteReplacedProfileUpload = (
  previousPublicUrl: string | null | undefined,
  nextPublicUrl?: string | null,
): void => {
  deleteManagedLocalUpload(previousPublicUrl, {
    uploadsDir: PROFILE_UPLOADS_DIR,
    publicPrefix: PROFILE_UPLOAD_PUBLIC_PREFIX,
    filenamePattern: PROFILE_UPLOAD_FILENAME_PATTERN,
    excludePublicUrl: nextPublicUrl,
  });
};

export const deleteReplacedVerificationUpload = (
  previousPublicUrl: string | null | undefined,
  nextPublicUrl?: string | null,
): void => {
  deleteManagedLocalUpload(previousPublicUrl, {
    uploadsDir: SUPPLIER_VERIFICATION_UPLOADS_DIR,
    publicPrefix: SUPPLIER_VERIFICATION_UPLOAD_PUBLIC_PREFIX,
    filenamePattern: VERIFICATION_UPLOAD_FILENAME_PATTERN,
    excludePublicUrl: nextPublicUrl,
  });
};
