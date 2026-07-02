export const SUPPLIER_VERIFICATION_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const SUPPLIER_VERIFICATION_UPLOAD_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export const SUPPLIER_VERIFICATION_UPLOAD_PUBLIC_PREFIX =
  '/uploads/supplier-verification';
