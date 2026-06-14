import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response.js";

import {
  getAuthenticatedUser,
  loginUser,
  logoutUser,
  refreshAuthSession,
  registerUser,
  requestPasswordReset,
  resetPasswordWithToken,
} from "./auth.service.js";

import type {
  ForgotPasswordInput,
  LoginInput,
  RefreshTokenInput,
  RegisterInput,
  ResetPasswordInput,
} from "./auth.validation.js";

export const register = async (req: Request, res: Response): Promise<void> => {
  const result = await registerUser(req.body as RegisterInput);

  res.status(201).json(successResponse("Registration successful", result));
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const result = await loginUser(req.body as LoginInput);

  res.json(successResponse("Login successful", result));
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as RefreshTokenInput;

  const result = await refreshAuthSession(refreshToken);

  res.json(successResponse("Token refreshed successfully", result));
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as RefreshTokenInput;

  await logoutUser(refreshToken);

  res.json(successResponse("Logout successful", null));
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = await getAuthenticatedUser(req.auth!.sub);

  res.json(successResponse("Authenticated user loaded", { user }));
};

export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email } = req.body as ForgotPasswordInput;
  const result = await requestPasswordReset(email);

  res.json(successResponse(result.message, result.resetToken ? { resetToken: result.resetToken } : null));
};

export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { token, newPassword } = req.body as ResetPasswordInput;

  await resetPasswordWithToken(token, newPassword);

  res.json(successResponse("Password reset successful", null));
};
