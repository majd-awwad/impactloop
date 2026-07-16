import type { AccessTokenPayload } from '../../../utils/jwt.js';
import { AppError } from '../../../utils/app-error.js';
import { loadDefaultSavedLocation, loadLearnerInterests } from '../../learner-home/learner-home.repository.js';
import { listUserSavedLocations } from '../../locations/locations.service.js';
import type { AiToolExecutionContext } from './ai-agent.types.js';

export const buildLearnerViewer = (
  context: AiToolExecutionContext,
): AccessTokenPayload => ({
  sub: context.authenticatedUserId,
  roles: ['LEARNER'],
});

export type LearnerAgentContextSnapshot = {
  interests: string[];
  city: string | null;
  area: string | null;
  hasValidCoordinates: boolean;
  defaultSavedLocationId: string | null;
};

export const loadLearnerAgentContext = async (
  userId: string,
): Promise<LearnerAgentContextSnapshot> => {
  const [interests, savedLocation, savedLocations] = await Promise.all([
    loadLearnerInterests(userId),
    loadDefaultSavedLocation(userId),
    listUserSavedLocations(userId),
  ]);

  const defaultLocation =
    savedLocations.find((location) => location.isDefault) ?? savedLocations[0];

  const hasValidCoordinates =
    defaultLocation?.latitude != null &&
    defaultLocation.longitude != null &&
    Number.isFinite(defaultLocation.latitude) &&
    Number.isFinite(defaultLocation.longitude);

  return {
    interests,
    city: savedLocation.city,
    area: savedLocation.area,
    hasValidCoordinates,
    defaultSavedLocationId: defaultLocation?.id ?? null,
  };
};

export const resolveLearnerCoordinates = async (
  userId: string,
): Promise<{ latitude: number; longitude: number; savedLocationId: string } | null> => {
  const savedLocations = await listUserSavedLocations(userId);
  const defaultLocation =
    savedLocations.find((location) => location.isDefault) ?? savedLocations[0];

  if (
    !defaultLocation ||
    defaultLocation.latitude == null ||
    defaultLocation.longitude == null
  ) {
    return null;
  }

  return {
    latitude: defaultLocation.latitude,
    longitude: defaultLocation.longitude,
    savedLocationId: defaultLocation.id,
  };
};

export const requireLearnerCoordinates = async (userId: string) => {
  const coordinates = await resolveLearnerCoordinates(userId);

  if (!coordinates) {
    throw new AppError(
      'Update your saved location in profile settings to search nearby materials.',
      400,
      'LEARNER_LOCATION_REQUIRED',
    );
  }

  return coordinates;
};
