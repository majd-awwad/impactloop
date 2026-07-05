import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import {
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  isWebClient,
  requireRefreshTokenFromRequest,
  sendAuthSessionResponse,
  sendRefreshSessionResponse,
} from './auth-token-delivery.js';

import {
  getAuthenticatedUser,
  loginUser,
  logoutUser,
  refreshAuthSession,
  registerUser,
  requestPasswordReset,
  resetPasswordWithToken,
  changePasswordForUser,
  becomeSupplier,
  becomeLearner,
  switchActiveRole,
} from './auth.service.js';

import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  BecomeSupplierInput,
  BecomeLearnerInput,
  SwitchRoleInput,
} from './auth.validation.js';

export const register = async (req: Request, res: Response): Promise<void> => {
  const result = await registerUser(req.body as RegisterInput);

  sendAuthSessionResponse(req, res, 'Registration successful', result, 201);
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const result = await loginUser(req.body as LoginInput);

  sendAuthSessionResponse(req, res, 'Login successful', result);
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = requireRefreshTokenFromRequest(req);
  const result = await refreshAuthSession(refreshToken);

  sendRefreshSessionResponse(req, res, 'Token refreshed successfully', result);
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = getRefreshTokenFromRequest(req);

  if (refreshToken) {
    await logoutUser(refreshToken);
  }

  if (isWebClient(req)) {
    clearRefreshTokenCookie(res);
  }

  res.json(successResponse('Logout successful', null));
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = await getAuthenticatedUser(req.auth!.sub);

  res.json(successResponse('Authenticated user loaded', { user }));
};

export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email } = req.body as ForgotPasswordInput;
  const result = await requestPasswordReset(email);

  res.json(successResponse(result.message, null));
};

export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { token, newPassword } = req.body as ResetPasswordInput;

  await resetPasswordWithToken(token, newPassword);

  res.json(successResponse('Password reset successful', null));
};

export const changePassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await changePasswordForUser(req.auth!.sub, req.body as ChangePasswordInput);

  res.json(
    successResponse('Password updated successfully.', {
      success: true,
    }),
  );
};

export const postBecomeSupplier = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const body = req.body as BecomeSupplierInput;
  const result = await becomeSupplier(req.auth!.sub, {
    userId: req.auth!.sub,
    supplierType: body.supplierType,
    publicName: body.publicName,
    description: body.description,
    pickupArea: body.pickupArea,
    workingHours: body.workingHours,
    pickupNotes: body.pickupNotes,
  });

  sendAuthSessionResponse(req, res, 'Supplier profile ready', result);
};

export const postBecomeLearner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const body = req.body as BecomeLearnerInput;
  const result = await becomeLearner(req.auth!.sub, {
    userId: req.auth!.sub,
    learnerType: body.learnerType,
    skillLevel: body.skillLevel,
    interests: body.interests,
    bio: body.bio,
  });

  sendAuthSessionResponse(req, res, 'Learner access added', result);
};

export const postSwitchRole = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { activeRole } = req.body as SwitchRoleInput;
  const result = await switchActiveRole(req.auth!.sub, activeRole);

  sendAuthSessionResponse(req, res, 'Active role updated', result);
};
