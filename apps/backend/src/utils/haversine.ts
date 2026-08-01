const EARTH_RADIUS_KM = 6371;

export const haversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const formatDistanceLabel = (distanceKm: number | null | undefined) => {
  if (distanceKm == null || !Number.isFinite(distanceKm)) {
    return null;
  }

  const rounded =
    distanceKm < 10
      ? Math.round(distanceKm * 10) / 10
      : Math.round(distanceKm);

  return `${rounded} km away`;
};
