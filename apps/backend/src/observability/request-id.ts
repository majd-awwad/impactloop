import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';
export const REQUEST_ID_MAX_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const readHeaderValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value;
};

export const isValidRequestId = (value: string): boolean => {
  const trimmed = value.trim();

  if (!trimmed || trimmed.length > REQUEST_ID_MAX_LENGTH) {
    return false;
  }

  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return false;
  }

  return REQUEST_ID_PATTERN.test(trimmed);
};

export const resolveRequestId = (headerValue: unknown): string => {
  const candidate = readHeaderValue(headerValue);

  if (!candidate) {
    return randomUUID();
  }

  const trimmed = candidate.trim();

  if (!isValidRequestId(trimmed)) {
    return randomUUID();
  }

  return trimmed;
};
