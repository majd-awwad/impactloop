import type { NextFunction, Request, Response } from 'express';

export const privateNoStoreMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Personalized responses must never be converted to 304s from validators
  // supplied by an earlier response. Public routes retain Express validators.
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  res.setHeader('Cache-Control', 'private, no-store');
  next();
};
