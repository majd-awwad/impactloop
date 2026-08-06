import { logger } from '../../../observability/logger.js';
import { ZoomError, type ZoomErrorCode } from './zoom-errors.js';
import type { ZoomRealConfig } from './zoom-config.js';
import { getZoomAccessToken, invalidateZoomAccessToken } from './zoom-token-manager.js';

export const ZOOM_HTTP_TIMEOUT_MS = 9_000;

type ZoomFetchOptions = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  failureCode: ZoomErrorCode;
};

type ZoomFetchDeps = {
  fetchImpl?: typeof fetch;
  getToken?: (config: ZoomRealConfig) => Promise<string>;
};

const mapHttpStatusToCode = (status: number, failureCode: ZoomErrorCode): ZoomErrorCode => {
  if (status === 401) {
    return 'ZOOM_AUTH_FAILED';
  }
  if (status === 403) {
    return 'ZOOM_SCOPE_MISSING';
  }
  if (status === 404) {
    return 'ZOOM_MEETING_NOT_FOUND';
  }
  if (status === 429) {
    return 'ZOOM_RATE_LIMITED';
  }
  if (status >= 500) {
    return 'ZOOM_UNAVAILABLE';
  }
  return failureCode;
};

const redactMeetingId = (meetingId: string) => {
  const digits = meetingId.replace(/\D/g, '');
  if (digits.length <= 4) {
    return '****';
  }
  return `****${digits.slice(-4)}`;
};

export const zoomApiRequest = async <T>(
  config: ZoomRealConfig,
  options: ZoomFetchOptions,
  deps: ZoomFetchDeps = {},
): Promise<T> => {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const getToken = deps.getToken ?? ((c) => getZoomAccessToken(c, fetchImpl));

  const execute = async (retryOnUnauthorized: boolean): Promise<T> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ZOOM_HTTP_TIMEOUT_MS);
    try {
      const token = await getToken(config);
      const response = await fetchImpl(`${config.apiBaseUrl}${options.path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });

      if (response.status === 401 && retryOnUnauthorized) {
        invalidateZoomAccessToken();
        return execute(false);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      let payload: unknown = null;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        payload = await response.json();
      }

      if (!response.ok) {
        const code = mapHttpStatusToCode(response.status, options.failureCode);
        throw new ZoomError(`Zoom API request failed (${code}).`, response.status >= 500 ? 502 : response.status, code);
      }

      return payload as T;
    } catch (error) {
      if (error instanceof ZoomError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ZoomError('Zoom API request timed out.', 504, 'ZOOM_UNAVAILABLE');
      }
      throw new ZoomError(`Zoom API request failed (${options.failureCode}).`, 502, options.failureCode);
    } finally {
      clearTimeout(timeout);
    }
  };

  return execute(true);
};

export const logZoomCleanupFailure = (input: {
  sessionId: string;
  meetingId: string;
  errorCode: ZoomErrorCode;
}) => {
  logger.error(
    {
      operation: 'project-help-session.zoom.cleanup-failed',
      sessionId: input.sessionId,
      meetingId: redactMeetingId(input.meetingId),
      errorCode: input.errorCode,
    },
    'Failed to delete orphaned Zoom meeting after persistence failure',
  );
};
