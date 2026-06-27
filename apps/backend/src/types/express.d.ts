import type { AccessTokenPayload } from '../utils/jwt.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}

export {};
