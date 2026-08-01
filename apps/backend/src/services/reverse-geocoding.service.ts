import { env } from '../config/env.js';
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

type CacheEntry = {
  value: ReverseGeocodeResult;
  expiresAt: number;
};

type ForwardCacheEntry = {
  value: ForwardGeocodeResult;
  expiresAt: number;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 1000;

const cache = new Map<string, CacheEntry>();
const forwardCache = new Map<string, ForwardCacheEntry>();
let lastExternalRequestAt = 0;

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

const readCache = (key: string): ReverseGeocodeResult | null => {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
};

const readForwardCache = (key: string): ForwardGeocodeResult | null => {
  const entry = forwardCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    forwardCache.delete(key);
    return null;
  }

  return entry.value;
};

const writeCache = (key: string, value: ReverseGeocodeResult): void => {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

const writeForwardCache = (
  key: string,
  value: ForwardGeocodeResult,
): void => {
  forwardCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

export const clearReverseGeocodeCache = (): void => {
  cache.clear();
  forwardCache.clear();
  lastExternalRequestAt = 0;
};

const waitForRateLimit = async (): Promise<void> => {
  const elapsed = Date.now() - lastExternalRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed),
    );
  }
};

const fetchFromNominatim = async (
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> => {
  await waitForRateLimit();

  const url = new URL('/reverse', env.nominatimBaseUrl);
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');

  lastExternalRequestAt = Date.now();

  const response = await fetch(url, {
    headers: {
      'User-Agent': env.nominatimUserAgent,
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  });

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
  await waitForRateLimit();

  const url = new URL('/search', env.nominatimBaseUrl);
  url.searchParams.set('q', buildForwardGeocodeQuery(input));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '1');

  lastExternalRequestAt = Date.now();

  const response = await fetch(url, {
    headers: {
      'User-Agent': env.nominatimUserAgent,
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) {
    throw new AppError(
      'Geocoding provider request failed',
      502,
      'GEOCODE_PROVIDER_ERROR',
    );
  }

  const payload = (await response.json()) as NominatimSearchResponseItem[];
  const result = payload.length > 0 ? parseNominatimSearchItem(payload[0]!) : null;

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

export const reverseGeocodeCoordinates = async (
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> => {
  const key = buildReverseGeocodeCacheKey(latitude, longitude);
  const cached = readCache(key);
  if (cached) {
    return cached;
  }

  const result = fetcherOverride
    ? await fetcherOverride(latitude, longitude)
    : await fetchFromNominatim(latitude, longitude);

  writeCache(key, result);
  return result;
};

export const forwardGeocodeLocation = async (
  input: ForwardGeocodeInput,
): Promise<ForwardGeocodeResult> => {
  const key = buildForwardGeocodeCacheKey(input);
  const cached = readForwardCache(key);
  if (cached) {
    return cached;
  }

  const result = forwardFetcherOverride
    ? await forwardFetcherOverride(input)
    : await fetchForwardFromNominatim(input);

  writeForwardCache(key, result);
  return result;
};
