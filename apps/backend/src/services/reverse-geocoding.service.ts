import { env } from '../config/env.js';
import {
  checkRateLimit,
  type RateLimitPolicy,
} from '../middlewares/rate-limit.middleware.js';
import { AppError } from '../utils/app-error.js';

export type ReverseGeocodeResult = {
  country: string | null;
  city: string | null;
  area: string | null;
  addressLine: string | null;
  displayName: string | null;
  provider: 'nominatim';
};

export type ForwardGeocodeInput = {
  country?: string | null;
  city: string;
  area?: string | null;
  addressLine?: string | null;
};

export type ForwardGeocodeResult = ReverseGeocodeResult & {
  latitude: number;
  longitude: number;
};

type NominatimAddress = Record<string, string | undefined>;

type NominatimReverseResponse = {
  display_name?: string;
  address?: NominatimAddress;
};

type NominatimSearchResponseItem = NominatimReverseResponse & {
  lat?: string;
  lon?: string;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  lastAccessAt: number;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1_000;
const MIN_REQUEST_INTERVAL_MS = 1_000;
const NOMINATIM_REQUEST_TIMEOUT_MS = 10_000;

const GEOCODE_USER_QUOTA: RateLimitPolicy = {
  name: 'geocode',
  windowMs: 60_000,
  max: 60,
};

let geocodeUserQuotaPolicy: RateLimitPolicy = GEOCODE_USER_QUOTA;

class BoundedTtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  clear(): void {
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }

  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    entry.lastAccessAt = Date.now();
    return entry.value;
  }

  set(key: string, value: T): void {
    const now = Date.now();
    const existing = this.entries.get(key);

    if (existing) {
      existing.value = value;
      existing.expiresAt = now + this.ttlMs;
      existing.lastAccessAt = now;
      return;
    }

    this.evictOneIfNeeded();
    this.entries.set(key, {
      value,
      expiresAt: now + this.ttlMs,
      lastAccessAt: now,
    });
  }

  private evictOneIfNeeded(): void {
    if (this.entries.size < this.maxEntries) {
      return;
    }

    const now = Date.now();
    for (const [entryKey, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(entryKey);
      }
    }

    if (this.entries.size < this.maxEntries) {
      return;
    }

    let oldestKey: string | undefined;
    let oldestAccessAt = Infinity;

    for (const [entryKey, entry] of this.entries) {
      if (entry.lastAccessAt < oldestAccessAt) {
        oldestAccessAt = entry.lastAccessAt;
        oldestKey = entryKey;
      }
    }

    if (oldestKey) {
      this.entries.delete(oldestKey);
    }
  }
}

const cache = new BoundedTtlCache<ReverseGeocodeResult>(
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
);
const forwardCache = new BoundedTtlCache<ForwardGeocodeResult>(
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
);

let lastExternalRequestAt = 0;
let externalRequestChain: Promise<unknown> = Promise.resolve();

export const roundCoordinate = (value: number): number =>
  Number(value.toFixed(5));

export const buildReverseGeocodeCacheKey = (
  latitude: number,
  longitude: number,
): string => `${roundCoordinate(latitude)},${roundCoordinate(longitude)}`;

const normalizeText = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized ? normalized : null;
};

export const buildForwardGeocodeQuery = (
  input: ForwardGeocodeInput,
): string => {
  const parts = [
    normalizeText(input.addressLine),
    normalizeText(input.area),
    normalizeText(input.city),
    normalizeText(input.country) ?? 'Palestine',
  ].filter((part): part is string => Boolean(part));

  return parts.join(', ');
};

export const buildForwardGeocodeCacheKey = (
  input: ForwardGeocodeInput,
): string => buildForwardGeocodeQuery(input).toLowerCase();

export const pickCity = (address: NominatimAddress): string | null => {
  for (const key of [
    'city',
    'town',
    'village',
    'municipality',
    'county',
    'state_district',
  ]) {
    const value = address[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
};

export const pickArea = (address: NominatimAddress): string | null => {
  for (const key of [
    'suburb',
    'neighbourhood',
    'quarter',
    'residential',
    'city_district',
  ]) {
    const value = address[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
};

export const pickAddressLine = (
  address: NominatimAddress,
  displayName?: string,
): string | null => {
  const road = address.road?.trim();
  const houseNumber = address.house_number?.trim();

  if (road && houseNumber) {
    return `${houseNumber} ${road}`.slice(0, 250);
  }

  if (road) {
    return road.slice(0, 250);
  }

  if (displayName?.trim()) {
    return displayName
      .split(',')
      .slice(0, 2)
      .join(',')
      .trim()
      .slice(0, 250);
  }

  return null;
};

export const parseNominatimResponse = (
  payload: NominatimReverseResponse,
): ReverseGeocodeResult => {
  const address = payload.address ?? {};
  const displayName = payload.display_name?.trim() || null;

  return {
    country: address.country?.trim() || null,
    city: pickCity(address),
    area: pickArea(address),
    addressLine: pickAddressLine(address, displayName ?? undefined),
    displayName,
    provider: 'nominatim',
  };
};

const assertGeocodeUserQuota = (userId: string | undefined): void => {
  if (!userId) {
    return;
  }

  checkRateLimit(`user:${userId}`, geocodeUserQuotaPolicy);
};

const isAbortTimeoutError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'TimeoutError' || error.name === 'AbortError');

const fetchNominatim = async (
  url: URL,
  timeoutCode: string,
): Promise<Response> => {
  try {
    return await fetch(url, {
      headers: {
        'User-Agent': env.nominatimUserAgent,
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(NOMINATIM_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isAbortTimeoutError(error)) {
      throw new AppError(
        'Geocoding provider request timed out',
        504,
        timeoutCode,
      );
    }

    throw error;
  }
};

const runSerializedExternalRequest = <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  const scheduled = externalRequestChain.then(async () => {
    const elapsed = Date.now() - lastExternalRequestAt;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed),
      );
    }

    lastExternalRequestAt = Date.now();
    return operation();
  });

  externalRequestChain = scheduled.catch(() => undefined);
  return scheduled;
};

const fetchFromNominatim = async (
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> => {
  const url = new URL('/reverse', env.nominatimBaseUrl);
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');

  const response = await fetchNominatim(
    url,
    'REVERSE_GEOCODE_PROVIDER_TIMEOUT',
  );

  if (!response.ok) {
    throw new AppError(
      'Reverse geocoding provider request failed',
      502,
      'REVERSE_GEOCODE_PROVIDER_ERROR',
    );
  }

  const payload = (await response.json()) as NominatimReverseResponse;
  return parseNominatimResponse(payload);
};

const parseNominatimSearchItem = (
  item: NominatimSearchResponseItem,
): ForwardGeocodeResult | null => {
  const latitude = Number(item.lat);
  const longitude = Number(item.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    ...parseNominatimResponse(item),
    latitude,
    longitude,
  };
};

const fetchForwardFromNominatim = async (
  input: ForwardGeocodeInput,
): Promise<ForwardGeocodeResult> => {
  const url = new URL('/search', env.nominatimBaseUrl);
  url.searchParams.set('q', buildForwardGeocodeQuery(input));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '1');

  const response = await fetchNominatim(url, 'GEOCODE_PROVIDER_TIMEOUT');

  if (!response.ok) {
    throw new AppError(
      'Geocoding provider request failed',
      502,
      'GEOCODE_PROVIDER_ERROR',
    );
  }

  const payload = (await response.json()) as NominatimSearchResponseItem[];
  const result =
    payload.length > 0 ? parseNominatimSearchItem(payload[0]!) : null;

  if (!result) {
    throw new AppError(
      'No matching location found',
      404,
      'GEOCODE_NOT_FOUND',
    );
  }

  return result;
};

export type ReverseGeocodeFetcher = (
  latitude: number,
  longitude: number,
) => Promise<ReverseGeocodeResult>;

export type ForwardGeocodeFetcher = (
  input: ForwardGeocodeInput,
) => Promise<ForwardGeocodeResult>;

export type GeocodeRequestOptions = {
  userId?: string;
};

let fetcherOverride: ReverseGeocodeFetcher | null = null;
let forwardFetcherOverride: ForwardGeocodeFetcher | null = null;

export const setReverseGeocodeFetcherForTests = (
  fetcher: ReverseGeocodeFetcher | null,
): void => {
  fetcherOverride = fetcher;
};

export const setForwardGeocodeFetcherForTests = (
  fetcher: ForwardGeocodeFetcher | null,
): void => {
  forwardFetcherOverride = fetcher;
};

export const clearReverseGeocodeCache = (): void => {
  cache.clear();
  forwardCache.clear();
  lastExternalRequestAt = 0;
  externalRequestChain = Promise.resolve();
  geocodeUserQuotaPolicy = GEOCODE_USER_QUOTA;
};

export const setGeocodeUserQuotaPolicyForTests = (
  policy: RateLimitPolicy | null,
): void => {
  geocodeUserQuotaPolicy = policy ?? GEOCODE_USER_QUOTA;
};

export const getReverseGeocodeCacheSizeForTests = (): number => cache.size();

export const getForwardGeocodeCacheSizeForTests = (): number =>
  forwardCache.size();

export const populateReverseGeocodeCacheForTests = (
  entries: Array<{ latitude: number; longitude: number; value: ReverseGeocodeResult }>,
): void => {
  for (const entry of entries) {
    cache.set(
      buildReverseGeocodeCacheKey(entry.latitude, entry.longitude),
      entry.value,
    );
  }
};

export const populateForwardGeocodeCacheForTests = (
  entries: Array<{ input: ForwardGeocodeInput; value: ForwardGeocodeResult }>,
): void => {
  for (const entry of entries) {
    forwardCache.set(buildForwardGeocodeCacheKey(entry.input), entry.value);
  }
};

export const reverseGeocodeCoordinates = async (
  latitude: number,
  longitude: number,
  options?: GeocodeRequestOptions,
): Promise<ReverseGeocodeResult> => {
  const key = buildReverseGeocodeCacheKey(latitude, longitude);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  assertGeocodeUserQuota(options?.userId);

  const result = await runSerializedExternalRequest(() =>
    fetcherOverride
      ? fetcherOverride(latitude, longitude)
      : fetchFromNominatim(latitude, longitude),
  );

  cache.set(key, result);
  return result;
};

export const forwardGeocodeLocation = async (
  input: ForwardGeocodeInput,
  options?: GeocodeRequestOptions,
): Promise<ForwardGeocodeResult> => {
  const key = buildForwardGeocodeCacheKey(input);
  const cached = forwardCache.get(key);
  if (cached) {
    return cached;
  }

  assertGeocodeUserQuota(options?.userId);

  const result = await runSerializedExternalRequest(() =>
    forwardFetcherOverride
      ? forwardFetcherOverride(input)
      : fetchForwardFromNominatim(input),
  );

  forwardCache.set(key, result);
  return result;
};
