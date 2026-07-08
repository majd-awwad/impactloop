import { prisma } from '../../database/prisma.js';

export const DRIVER_RECENT_LOCATION_PING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type DriverReferencePoint = {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  area: string | null;
  source: 'recent_ping' | 'profile_text' | 'none';
};

const decimalToNumber = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    const numeric = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(numeric) ? numeric : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveDriverReferencePoint = async (
  driverProfileId: string,
): Promise<DriverReferencePoint> => {
  const recentCutoff = new Date(Date.now() - DRIVER_RECENT_LOCATION_PING_MAX_AGE_MS);

  const latestPing = await prisma.deliveryLocationPing.findFirst({
    where: {
      driverProfileId,
      capturedAt: { gte: recentCutoff },
    },
    orderBy: { capturedAt: 'desc' },
    select: {
      latitude: true,
      longitude: true,
    },
  });

  if (latestPing) {
    const latitude = decimalToNumber(latestPing.latitude);
    const longitude = decimalToNumber(latestPing.longitude);

    if (latitude != null && longitude != null) {
      return {
        latitude,
        longitude,
        city: null,
        area: null,
        source: 'recent_ping',
      };
    }
  }

  const profile = await prisma.driverProfile.findUnique({
    where: { id: driverProfileId },
    select: { city: true, area: true },
  });

  if (!profile) {
    return {
      latitude: null,
      longitude: null,
      city: null,
      area: null,
      source: 'none',
    };
  }

  return {
    latitude: null,
    longitude: null,
    city: profile.city.trim() || null,
    area: profile.area.trim() || null,
    source: 'profile_text',
  };
};
