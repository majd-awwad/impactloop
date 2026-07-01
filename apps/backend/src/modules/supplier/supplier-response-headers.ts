import type { Response } from 'express';

export const setSupplierPrivateCacheHeaders = (res: Response): void => {
  res.set('Cache-Control', 'no-store, private');
  res.removeHeader('ETag');
};
