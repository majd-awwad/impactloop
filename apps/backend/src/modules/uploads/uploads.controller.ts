import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import {
  mapUploadedMaterialImages,
  mapUploadedProfileImage,
} from './uploads.service.js';
import { mapUploadedVerificationDocument } from './verification-uploads.storage.js';

export const uploadMaterialImagesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const images = await mapUploadedMaterialImages(files);

  res.status(201).json(successResponse('Images uploaded.', { images }));
};

export const uploadProfileImageHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const image = mapUploadedProfileImage(req.file);

  res.status(201).json(successResponse('Profile image uploaded.', { image }));
};

export const uploadSupplierVerificationDocumentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const file = req.file;
  const document = mapUploadedVerificationDocument(file);

  res
    .status(201)
    .json(successResponse('Verification document uploaded.', { document }));
};
