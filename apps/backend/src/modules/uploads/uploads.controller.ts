import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { mapUploadedMaterialImages } from './uploads.service.js';

export const uploadMaterialImagesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const images = mapUploadedMaterialImages(files);

  res.status(201).json(successResponse('Images uploaded.', { images }));
};
