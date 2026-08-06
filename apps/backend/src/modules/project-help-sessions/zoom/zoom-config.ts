import { ZoomError } from './zoom-errors.js';

export type ZoomIntegrationMode = 'fake' | 'real' | 'disabled';

export type ZoomRealConfig = {
  mode: 'real';
  accountId: string;
  clientId: string;
  clientSecret: string;
  hostUserId: string;
  apiBaseUrl: string;
  tokenUrl: string;
};

export type ZoomConfig =
  | { mode: 'fake' }
  | { mode: 'disabled' }
  | ZoomRealConfig;

const parseMode = (value: string | undefined): ZoomIntegrationMode => {
  const normalized = (value ?? 'fake').trim().toLowerCase();
  if (normalized === 'fake' || normalized === 'real' || normalized === 'disabled') {
    return normalized;
  }
  throw new ZoomError(
    'Zoom integration mode is invalid.',
    500,
    'ZOOM_CONFIG_INVALID',
  );
};

const parseHttpUrl = (value: string, fieldName: string) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ZoomError(
      `Zoom ${fieldName} must be a valid URL.`,
      500,
      'ZOOM_CONFIG_INVALID',
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ZoomError(
      `Zoom ${fieldName} must use http or https.`,
      500,
      'ZOOM_CONFIG_INVALID',
    );
  }
  return parsed.toString().replace(/\/$/, '');
};

const requireField = (value: string | undefined, fieldName: string) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new ZoomError(
      `Zoom ${fieldName} is required when ZOOM_INTEGRATION_MODE=real.`,
      500,
      'ZOOM_CONFIG_INVALID',
    );
  }
  return trimmed;
};

export const loadZoomConfig = (): ZoomConfig => {
  const mode = parseMode(process.env.ZOOM_INTEGRATION_MODE);
  if (mode === 'fake' || mode === 'disabled') {
    return { mode };
  }

  return {
    mode: 'real',
    accountId: requireField(process.env.ZOOM_ACCOUNT_ID, 'account ID'),
    clientId: requireField(process.env.ZOOM_CLIENT_ID, 'client ID'),
    clientSecret: requireField(process.env.ZOOM_CLIENT_SECRET, 'client secret'),
    hostUserId: requireField(process.env.ZOOM_HOST_USER_ID, 'host user ID'),
    apiBaseUrl: parseHttpUrl(
      process.env.ZOOM_API_BASE_URL?.trim() || 'https://api.zoom.us/v2',
      'API base URL',
    ),
    tokenUrl: parseHttpUrl(
      process.env.ZOOM_TOKEN_URL?.trim() || 'https://zoom.us/oauth/token',
      'token URL',
    ),
  };
};
