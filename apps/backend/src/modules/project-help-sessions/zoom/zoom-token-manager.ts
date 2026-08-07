import { ZoomError } from './zoom-errors.js';
import type { ZoomRealConfig } from './zoom-config.js';

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const ZOOM_HTTP_TIMEOUT_MS = 9_000;

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedToken: CachedToken | null = null;
let inFlightTokenRequest: Promise<string> | null = null;

type TokenFetcher = typeof fetch;

const defaultFetch: TokenFetcher = (...args) => fetch(...args);

const parseTokenResponse = (payload: unknown): { accessToken: string; expiresInSec: number } => {
  if (!payload || typeof payload !== 'object') {
    throw new ZoomError('Zoom token response was invalid.', 502, 'ZOOM_AUTH_FAILED');
  }
  const record = payload as Record<string, unknown>;
  const accessToken = typeof record.access_token === 'string' ? record.access_token : null;
  const expiresIn =
    typeof record.expires_in === 'number'
      ? record.expires_in
      : typeof record.expires_in === 'string'
        ? Number(record.expires_in)
        : NaN;
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new ZoomError('Zoom token response was invalid.', 502, 'ZOOM_AUTH_FAILED');
  }
  return { accessToken, expiresInSec: expiresIn };
};

const requestAccessToken = async (
  config: ZoomRealConfig,
  fetchImpl: TokenFetcher,
): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ZOOM_HTTP_TIMEOUT_MS);
  try {
    const credentials = Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
      'utf8',
    ).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: config.accountId,
    });
    const response = await fetchImpl(config.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ZoomError(
        'Zoom authentication failed.',
        response.status === 429 ? 429 : 502,
        response.status === 429 ? 'ZOOM_RATE_LIMITED' : 'ZOOM_AUTH_FAILED',
      );
    }
    const payload = await response.json();
    const parsed = parseTokenResponse(payload);
    cachedToken = {
      accessToken: parsed.accessToken,
      expiresAtMs: Date.now() + parsed.expiresInSec * 1000,
    };
    return parsed.accessToken;
  } catch (error) {
    if (error instanceof ZoomError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ZoomError('Zoom authentication timed out.', 504, 'ZOOM_UNAVAILABLE');
    }
    throw new ZoomError('Zoom authentication failed.', 502, 'ZOOM_AUTH_FAILED');
  } finally {
    clearTimeout(timeout);
  }
};

export const resetZoomTokenCacheForTests = () => {
  cachedToken = null;
  inFlightTokenRequest = null;
};

export const invalidateZoomAccessToken = () => {
  cachedToken = null;
};

export const getZoomAccessToken = async (
  config: ZoomRealConfig,
  fetchImpl: TokenFetcher = defaultFetch,
): Promise<string> => {
  if (cachedToken && cachedToken.expiresAtMs - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
    return cachedToken.accessToken;
  }

  if (!inFlightTokenRequest) {
    inFlightTokenRequest = requestAccessToken(config, fetchImpl).finally(() => {
      inFlightTokenRequest = null;
    });
  }

  try {
    return await inFlightTokenRequest;
  } catch (error) {
    inFlightTokenRequest = null;
    cachedToken = null;
    throw error;
  }
};
