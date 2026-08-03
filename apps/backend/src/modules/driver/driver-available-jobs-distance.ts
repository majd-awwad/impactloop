/**
 * Small helpers for Available Jobs distance presentation and unit conversion.
 * Ordering / membership / cursors use PostGIS geography meters — not these helpers.
 */

export const kmToMeters = (km: number): number => km * 1000;

export const metersToKm = (meters: number | null | undefined): number | null => {
  if (meters == null || !Number.isFinite(meters)) {
    return null;
  }
  return meters / 1000;
};

/** Presentation rounding for API distanceKm (not used as cursor ordering key). */
export const roundPresentationDistanceKm = (
  distanceKm: number | null | undefined,
): number | null => {
  if (distanceKm == null || !Number.isFinite(distanceKm)) {
    return null;
  }

  if (distanceKm < 10) {
    return Math.round(distanceKm * 10) / 10;
  }

  return Math.round(distanceKm);
};

export const isValidLatLng = (latitude: number, longitude: number): boolean =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;
