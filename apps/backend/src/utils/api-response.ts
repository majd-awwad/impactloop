import { getRequestId } from '../observability/request-context.js';

export type ApiSuccessResponse<TData> = {
  success: true;
  message: string;
  data: TData;
};

export type ApiErrorBody = {
  code: string;
  requestId: string;
  details?: unknown;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  error: ApiErrorBody;
};

export const successResponse = <TData>(
  message: string,
  data: TData,
): ApiSuccessResponse<TData> => ({
  success: true,
  message,
  data,
});

export const errorResponse = (
  message: string,
  code: string,
  details?: unknown,
  requestId?: string,
): ApiErrorResponse => ({
  success: false,
  message,
  error: {
    code,
    requestId: requestId ?? getRequestId() ?? 'unknown',
    ...(details === undefined ? {} : { details }),
  },
});
