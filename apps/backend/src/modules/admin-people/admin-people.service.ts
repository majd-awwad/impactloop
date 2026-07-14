import { AppError } from '../../utils/app-error.js';

import {
  ADMIN_ACTIVITY_ACTIONS,
  logAdminActivity,
} from '../admin/admin-activity-log.js';
import { countVerifiedStrikesForUser } from '../reservations/account-suspension.js';

import * as repository from './admin-people.repository.js';
import {
  assertActorMayChangeUserStatus,
  buildStatusActionFlags,
} from './admin-people.safety.js';
import type {
  AdminPeopleListQuery,
  SuspendUserInput,
} from './admin-people.validation.js';
import { suspendUserSchema } from './admin-people.validation.js';

type UserRecord = NonNullable<
  Awaited<ReturnType<typeof repository.findUserWithRoles>>
>;

const mapModeratorSummary = (
  user: { id: string; displayName: string; email: string } | null,
) =>
  user
    ? {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
      }
    : null;

const mapPrimaryRole = (user: UserRecord) => {
  const primary = user.roles.find((role) => role.isPrimary);
  return primary?.role ?? user.roles[0]?.role ?? null;
};

type LocationParts = {
  city: string;
  area: string | null;
};

const pickCityArea = (
  location: { city: string; area: string | null } | null | undefined,
): LocationParts | null => {
  const city = location?.city?.trim();
  if (!city) {
    return null;
  }

  const area = location.area?.trim();
  return {
    city,
    area: area && area.length > 0 ? area : null,
  };
};

const formatLocationLabel = (
  city: string | null,
  area: string | null,
): string | null => {
  if (city && area) {
    return `${city} · ${area}`;
  }
  if (city) {
    return city;
  }
  if (area) {
    return area;
  }
  return null;
};

const resolveListLocation = (user: UserRecord): LocationParts | null => {
  const supplierBusinessLocation =
    user.supplierProfile?.organizationProfile?.businessLocation;
  const supplierPickupLocation = user.supplierProfile?.defaultPickupLocation;
  const supplierLocation =
    pickCityArea(supplierBusinessLocation) ?? pickCityArea(supplierPickupLocation);
  if (supplierLocation) {
    return supplierLocation;
  }

  if (user.driverProfile) {
    const city = user.driverProfile.city?.trim();
    if (city) {
      const area = user.driverProfile.area?.trim();
      return {
        city,
        area: area && area.length > 0 ? area : null,
      };
    }
  }

  const savedLocations = user.savedLocations ?? [];
  if (savedLocations.length === 1) {
    return pickCityArea(savedLocations[0]?.location);
  }

  return null;
};

type AdminPeopleListMetrics = {
  verifiedStrikeCount?: number;
  materialsCount?: number;
  reservationsAsRequesterCount?: number;
  reservationsAsOwnerCount?: number;
  submittedLearningProjectsCount?: number;
  projectBuildsCount?: number;
  assignedDeliveriesCount?: number;
};

const mapListItem = (
  user: UserRecord,
  actorId: string,
  metrics: AdminPeopleListMetrics = {},
) => {
  const flags = buildStatusActionFlags(user, actorId);
  const isLearnerOnly =
    user.roles.some((role) => role.role === 'LEARNER') &&
    !user.roles.some((role) =>
      ['SUPPLIER', 'DRIVER', 'MODERATOR', 'ADMIN'].includes(role.role),
    );

  const location = resolveListLocation(user);

  return {
    userId: user.id,
    displayName: user.displayName,
    email: user.email,
    roles: user.roles.map((role) => role.role),
    primaryRole: mapPrimaryRole(user),
    accountStatus: user.accountStatus,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    supplierName: user.supplierProfile?.publicName ?? null,
    supplierType: user.supplierProfile?.supplierType ?? null,
    verificationStatus: user.supplierProfile?.verificationStatus ?? null,
    driverStatus: user.driverProfile?.status ?? null,
    isLearnerOnly,
    suspensionReasonPreview:
      user.accountStatus === 'SUSPENDED' ? user.suspensionReason : null,
    verifiedStrikeCount: metrics.verifiedStrikeCount ?? 0,
    materialsCount: metrics.materialsCount ?? 0,
    reservationsAsRequesterCount: metrics.reservationsAsRequesterCount ?? 0,
    reservationsAsOwnerCount: metrics.reservationsAsOwnerCount ?? 0,
    submittedLearningProjectsCount: metrics.submittedLearningProjectsCount ?? 0,
    projectBuildsCount: metrics.projectBuildsCount ?? 0,
    assignedDeliveriesCount: metrics.assignedDeliveriesCount ?? 0,
    locationCity: location?.city ?? null,
    locationArea: location?.area ?? null,
    locationLabel: location
      ? formatLocationLabel(location.city, location.area)
      : null,
    ...flags,
  };
};

const mapDetail = async (user: UserRecord, actorId: string) => {
  const verifiedStrikeCount = await countVerifiedStrikesForUser(user.id);

  return {
    ...mapListItem(user, actorId, { verifiedStrikeCount }),
    phone: user.phone,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    updatedAt: user.updatedAt.toISOString(),
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    suspensionReason: user.suspensionReason,
    suspendedBy: mapModeratorSummary(user.suspendedBy),
    reactivatedAt: user.reactivatedAt?.toISOString() ?? null,
    reactivatedBy: mapModeratorSummary(user.reactivatedBy),
    supplierProfile: user.supplierProfile
      ? {
          publicName: user.supplierProfile.publicName,
          supplierType: user.supplierProfile.supplierType,
          verificationStatus: user.supplierProfile.verificationStatus,
        }
      : null,
    driverProfile: user.driverProfile
      ? {
          status: user.driverProfile.status,
          transportationType: user.driverProfile.transportationType,
        }
      : null,
  };
};

export const getAdminPeopleSummary = async () => repository.countPeopleSummary();

export const listAdminPeople = async (
  actorId: string,
  query: AdminPeopleListQuery,
) => {
  const result = await repository.listUsersForAdmin(query);
  const userIds = result.items.map((item) => item.id);
  const driverProfileIdByUserId = new Map(
    result.items
      .filter((item) => item.driverProfile?.id)
      .map((item) => [item.id, item.driverProfile!.id]),
  );
  const driverProfileIds = [...new Set(driverProfileIdByUserId.values())];
  const [
    strikeCounts,
    materialsCounts,
    requesterReservationCounts,
    ownerReservationCounts,
    submittedLearningProjectsCounts,
    projectBuildsCounts,
    assignedDeliveryCountsByDriverProfileId,
  ] = await Promise.all([
    repository.countVerifiedStrikesForUserIds(userIds),
    repository.countMaterialsByOwnerIds(userIds),
    repository.countReservationsByRequesterIds(userIds),
    repository.countReservationsByOwnerIds(userIds),
    repository.countSubmittedLearningProjectsByCreatorIds(userIds),
    repository.countProjectBuildsByLearnerIds(userIds),
    repository.countAssignedDeliveriesByDriverProfileIds(driverProfileIds),
  ]);

  return {
    summary: await repository.countPeopleSummary(),
    items: result.items.map((item) => {
      const driverProfileId = driverProfileIdByUserId.get(item.id);

      return mapListItem(item, actorId, {
        verifiedStrikeCount: strikeCounts.get(item.id) ?? 0,
        materialsCount: materialsCounts.get(item.id) ?? 0,
        reservationsAsRequesterCount:
          requesterReservationCounts.get(item.id) ?? 0,
        reservationsAsOwnerCount: ownerReservationCounts.get(item.id) ?? 0,
        submittedLearningProjectsCount:
          submittedLearningProjectsCounts.get(item.id) ?? 0,
        projectBuildsCount: projectBuildsCounts.get(item.id) ?? 0,
        assignedDeliveriesCount: driverProfileId
          ? (assignedDeliveryCountsByDriverProfileId.get(driverProfileId) ?? 0)
          : 0,
      });
    }),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
    },
  };
};

export const getAdminPersonById = async (actorId: string, userId: string) => {
  const user = await repository.findUserWithRoles(userId);
  if (!user) {
    throw new AppError('User not found.', 404, 'NOT_FOUND');
  }

  return await mapDetail(user, actorId);
};

export const suspendAdminPerson = async (
  actorId: string,
  userId: string,
  input: SuspendUserInput,
) => {
  const parsed = suspendUserSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.issues[0]?.message ?? 'Suspension reason is required.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const target = await assertActorMayChangeUserStatus(actorId, userId);

  if (
    target.accountStatus !== 'ACTIVE' &&
    target.accountStatus !== 'PENDING_VERIFICATION'
  ) {
    throw new AppError(
      'Only active or pending accounts can be suspended.',
      409,
      'CONFLICT',
      { reason: 'INVALID_STATUS_TRANSITION' },
    );
  }

  const updated = await repository.suspendUserAccount({
    userId,
    actorId,
    reason: parsed.data.reason,
  });

  await logAdminActivity({
    actorUserId: actorId,
    action: ADMIN_ACTIVITY_ACTIONS.USER_SUSPENDED,
    targetType: 'USER',
    targetId: userId,
    targetLabel: updated.displayName,
    metadata: { reason: parsed.data.reason },
  });

  return await mapDetail(updated, actorId);
};

export const reactivateAdminPerson = async (actorId: string, userId: string) => {
  const target = await assertActorMayChangeUserStatus(actorId, userId);

  if (target.accountStatus !== 'SUSPENDED') {
    throw new AppError(
      'Only suspended accounts can be reactivated.',
      409,
      'CONFLICT',
      { reason: 'INVALID_STATUS_TRANSITION' },
    );
  }

  const updated = await repository.reactivateUserAccount({
    userId,
    actorId,
  });

  await logAdminActivity({
    actorUserId: actorId,
    action: ADMIN_ACTIVITY_ACTIONS.USER_REACTIVATED,
    targetType: 'USER',
    targetId: userId,
    targetLabel: updated.displayName,
  });

  return await mapDetail(updated, actorId);
};
