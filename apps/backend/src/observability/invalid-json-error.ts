export const INVALID_JSON_ERROR_CODE = 'INVALID_JSON';

export const isInvalidJsonBodyError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as Record<string, unknown>;

  if (record.type === 'entity.parse.failed' || record.type === 'entity.verify.failed') {
    return true;
  }

  if (error instanceof SyntaxError) {
    const status = (error as { status?: unknown }).status;
    const expose = (error as { expose?: unknown }).expose;

    return status === 400 || expose === true;
  }

  return false;
};
