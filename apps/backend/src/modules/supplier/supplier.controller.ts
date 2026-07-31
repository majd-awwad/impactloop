import type { Request, Response } from "express";

import { readValidatedQuery } from "../../middlewares/validate.middleware.js";
import { successResponse } from "../../utils/api-response.js";

import {
  createSupplierMaterialIdempotent,
  deleteSupplierMaterial,
  getSupplierDashboard,
  getSupplierMaterial,
  getSupplierMaterialRelatedProjects,
  getSupplierMaterials,
  getSupplierProfile,
  getSupplierProfileManagement,
  getSupplierProfileFollowers,
  updateSupplierMaterial,
  updateSupplierProfile,
  updateSupplierProfileImages,
  markSupplierMaterialUnavailable,
  restoreSupplierMaterialAvailable,
} from "./supplier.service.js";
import { setSupplierPrivateCacheHeaders } from "./supplier-response-headers.js";
import { validateIdempotencyKey } from "../../services/idempotency.service.js";
import type {
  CreateSupplierMaterialInput,
  SupplierMaterialsQuery,
  SupplierFollowersQuery,
  SupplierRelatedProjectsQuery,
  UpdateSupplierMaterialInput,
  UpdateSupplierProfileInput,
  UpdateSupplierProfileImagesInput,
} from "./supplier.validation.js";

export const getDashboard = async (
  req: Request,
  res: Response,
): Promise<void> => {
  setSupplierPrivateCacheHeaders(res);
  const dashboard = await getSupplierDashboard(req.auth!.sub);

  res.json(successResponse("Supplier dashboard loaded", dashboard));
};

export const getProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  setSupplierPrivateCacheHeaders(res);
  const profile = await getSupplierProfile(req.auth!.sub);

  res.json(successResponse("Supplier profile loaded", profile));
};

export const getProfileManagement = async (
  req: Request,
  res: Response,
): Promise<void> => {
  setSupplierPrivateCacheHeaders(res);
  const profile = await getSupplierProfileManagement(req.auth!.sub);

  res.json(successResponse("Supplier profile management loaded", profile));
};

export const getProfileFollowers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const followers = await getSupplierProfileFollowers(
    req.auth!.sub,
    readValidatedQuery<SupplierFollowersQuery>(req),
  );

  res.json(successResponse('Supplier followers loaded', followers));
};

export const patchProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const profile = await updateSupplierProfile(
    req.auth!.sub,
    req.body as UpdateSupplierProfileInput,
  );

  res.json(successResponse("Supplier profile updated", profile));
};

export const patchProfileImages = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const profile = await updateSupplierProfileImages(
    req.auth!.sub,
    req.body as UpdateSupplierProfileImagesInput,
  );

  res.json(successResponse("Supplier profile images updated", profile));
};

export const getMaterials = async (
  req: Request,
  res: Response,
): Promise<void> => {
  setSupplierPrivateCacheHeaders(res);
  const materials = await getSupplierMaterials(
    req.auth!.sub,
    readValidatedQuery<SupplierMaterialsQuery>(req),
  );

  res.json(successResponse("Supplier materials loaded", materials));
};

export const getMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const material = await getSupplierMaterial(
    req.auth!.sub,
    req.params.id as string,
  );

  res.json(successResponse("Supplier material loaded", material));
};

export const getMaterialRelatedProjects = async (
  req: Request,
  res: Response,
): Promise<void> => {
  setSupplierPrivateCacheHeaders(res);
  const query = readValidatedQuery<SupplierRelatedProjectsQuery>(req);
  const relatedProjects = await getSupplierMaterialRelatedProjects(
    req.auth!.sub,
    req.params.id as string,
    query.limit,
  );

  res.json(
    successResponse("Supplier material related projects loaded", relatedProjects),
  );
};

export const patchMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const material = await updateSupplierMaterial(
    req.auth!.sub,
    req.params.id as string,
    req.body as UpdateSupplierMaterialInput,
  );

  res.json(successResponse("Material updated successfully.", material));
};

export const deleteMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await deleteSupplierMaterial(req.auth!.sub, req.params.id as string);

  res.json(successResponse("Material deleted successfully.", null));
};

export const markMaterialUnavailable = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const material = await markSupplierMaterialUnavailable(
    req.auth!.sub,
    req.params.id as string,
  );

  res.json(successResponse("Material marked unavailable.", material));
};

export const restoreMaterialAvailable = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const material = await restoreSupplierMaterialAvailable(
    req.auth!.sub,
    req.params.id as string,
  );

  res.json(successResponse("Material restored to available.", material));
};

export const postMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const idempotencyKey = validateIdempotencyKey(req.get("Idempotency-Key"));
  const result = await createSupplierMaterialIdempotent(
    req.auth!.sub,
    req.body as CreateSupplierMaterialInput,
    idempotencyKey,
  );

  res
    .status(result.replayed ? 200 : 201)
    .json(successResponse("Material listed successfully.", result.response));
};
