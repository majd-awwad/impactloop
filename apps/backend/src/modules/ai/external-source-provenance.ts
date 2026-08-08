export type ExternalSourceProvenance = 'authoritative' | 'unverified';

/**
 * Host suffixes for manufacturer docs and established technical references.
 * Matching is exact hostname or subdomain suffix only (not substring).
 */
const AUTHORITATIVE_HOST_SUFFIXES: readonly string[] = [
  'arduino.cc',
  'raspberrypi.com',
  'raspberrypi.org',
  'espressif.com',
  'adafruit.com',
  'sparkfun.com',
  'arm.com',
  'nxp.com',
  'st.com',
  'ti.com',
  'analog.com',
  'microchip.com',
  'silabs.com',
  'atmel.com',
  'platformio.org',
  'learn.microsoft.com',
  'developer.mozilla.org',
  'docs.python.org',
];

const normalizeHostname = (hostname: string): string =>
  hostname.trim().toLowerCase().replace(/^www\./, '');

export const isAuthoritativeExternalHostname = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return false;
  }

  return AUTHORITATIVE_HOST_SUFFIXES.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
};

export const scoreExternalSourceProvenance = (url: string): ExternalSourceProvenance => {
  try {
    const hostname = new URL(url).hostname;
    return isAuthoritativeExternalHostname(hostname) ? 'authoritative' : 'unverified';
  } catch {
    return 'unverified';
  }
};
