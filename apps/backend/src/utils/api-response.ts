export type ApiSuccessResponse<TData> = {
  success: true;
  message: string;
  data: TData;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
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
): ApiErrorResponse => ({
  success: false,
  message,
  error: {
    code,
    ...(details === undefined ? {} : { details }),
  },
});
