import { AppError } from '../../../utils/app-error.js';

export type ZoomErrorCode =
  | 'ZOOM_CONFIG_INVALID'
  | 'ZOOM_AUTH_FAILED'
  | 'ZOOM_HOST_INVALID'
  | 'ZOOM_SCOPE_MISSING'
  | 'ZOOM_RATE_LIMITED'
  | 'ZOOM_UNAVAILABLE'
  | 'ZOOM_CREATE_FAILED'
  | 'ZOOM_GET_FAILED'
  | 'ZOOM_DELETE_FAILED'
  | 'ZOOM_RESPONSE_INVALID'
  | 'ZOOM_DISABLED'
  | 'ZOOM_MEETING_NOT_FOUND'
  | 'ZOOM_PERSISTENCE_FAILED';

export class ZoomError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    code: ZoomErrorCode,
    details?: unknown,
  ) {
    super(message, statusCode, code, details);
    this.name = 'ZoomError';
  }
}

export const isZoomError = (error: unknown): error is ZoomError =>
  error instanceof ZoomError;
