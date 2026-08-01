import type { AdminPeopleExportUserRecord } from './admin-people.repository.js';

export type AdminUserExportMetrics = {
  verifiedStrikeCount: number;
  materialsCount: number;
  reservationsAsRequesterCount: number;
  reservationsAsOwnerCount: number;
  submittedLearningProjectsCount: number;
  projectBuildsCount: number;
  assignedDeliveriesCount: number;
};

export type AdminUserExportRecord = {
  userId: string;
  displayName: string;
  email: string;
  roles: string;
  primaryRole: string | null;
  accountStatus: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  supplierName: string | null;
  supplierType: string | null;
  supplierVerificationStatus: string | null;
  driverStatus: string | null;
  locationCity: string | null;
  locationArea: string | null;
  verifiedStrikeCount: number;
  materialsCount: number;
  reservationsAsRequesterCount: number;
  reservationsAsOwnerCount: number;
  submittedLearningProjectsCount: number;
  projectBuildsCount: number;
  assignedDeliveriesCount: number;
};

type LocationParts = {
  city: string;
  area: string | null;
};

const pickCityArea = (
  location: { city: string; area: string | null } | null | undefined,
): LocationParts | null => {
  if (!location) {
    return null;
  }

  const city = location.city.trim();
  if (!city) {
    return null;
  }

  const area = location.area?.trim();
  return {
    city,
    area: area && area.length > 0 ? area : null,
  };
};

/** Mirrors list resolveListLocation — city/area only, no address/coords. */
const resolveExportLocation = (
  user: AdminPeopleExportUserRecord,
): LocationParts | null => {
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

const mapPrimaryRole = (user: AdminPeopleExportUserRecord): string | null => {
  const primary = user.roles.find((role) => role.isPrimary);
  return primary?.role ?? user.roles[0]?.role ?? null;
};

/**
 * Explicit safe mapper — never pass Prisma records to writers.
 * Omits phones, passwordHash, tokens, exact address/coords, suspension
 * reasons, moderator actor IDs, and raw nested profile data.
 */
export const toAdminUserExportRecord = (
  user: AdminPeopleExportUserRecord,
  metrics: AdminUserExportMetrics,
): AdminUserExportRecord => {
  const location = resolveExportLocation(user);

  return {
    userId: user.id,
    displayName: user.displayName,
    email: user.email,
    roles: user.roles.map((role) => role.role).join(', '),
    primaryRole: mapPrimaryRole(user),
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    supplierName: user.supplierProfile?.publicName ?? null,
    supplierType: user.supplierProfile?.supplierType ?? null,
    supplierVerificationStatus:
      user.supplierProfile?.verificationStatus ?? null,
    driverStatus: user.driverProfile?.status ?? null,
    locationCity: location?.city ?? null,
    locationArea: location?.area ?? null,
    verifiedStrikeCount: metrics.verifiedStrikeCount,
    materialsCount: metrics.materialsCount,
    reservationsAsRequesterCount: metrics.reservationsAsRequesterCount,
    reservationsAsOwnerCount: metrics.reservationsAsOwnerCount,
    submittedLearningProjectsCount: metrics.submittedLearningProjectsCount,
    projectBuildsCount: metrics.projectBuildsCount,
    assignedDeliveriesCount: metrics.assignedDeliveriesCount,
  };
};

export const USER_EXPORT_HEADERS = [
  'User ID',
  'Display Name',
  'Email',
  'Roles',
  'Primary Role',
  'Account Status',
  'Created At',
  'Last Login At',
  'Supplier Name',
  'Supplier Type',
  'Supplier Verification Status',
  'Driver Status',
  'Location City',
  'Location Area',
  'Verified Strike Count',
  'Materials Count',
  'Reservations As Requester',
  'Reservations As Owner',
  'Submitted Learning Projects',
  'Project Builds',
  'Assigned Deliveries',
] as const;

/** 1-based Excel date column indexes. */
export const USER_EXPORT_CREATED_AT_COLUMN = 7;
export const USER_EXPORT_LAST_LOGIN_AT_COLUMN = 8;
export const USER_EXPORT_ROLES_COLUMN = 4;

export const userExportRecordToDetailedCells = (
  record: AdminUserExportRecord,
): unknown[] => [
  record.userId,
  record.displayName,
  record.email,
  record.roles,
  record.primaryRole,
  record.accountStatus,
  record.createdAt,
  record.lastLoginAt,
  record.supplierName,
  record.supplierType,
  record.supplierVerificationStatus,
  record.driverStatus,
  record.locationCity,
  record.locationArea,
  record.verifiedStrikeCount,
  record.materialsCount,
  record.reservationsAsRequesterCount,
  record.reservationsAsOwnerCount,
  record.submittedLearningProjectsCount,
  record.projectBuildsCount,
  record.assignedDeliveriesCount,
];

export const userExportRecordToCsvCells = (
  record: AdminUserExportRecord,
): unknown[] => {
  const cells = userExportRecordToDetailedCells(record);
  cells[6] = record.createdAt.toISOString();
  cells[7] = record.lastLoginAt?.toISOString() ?? null;
  return cells;
};
