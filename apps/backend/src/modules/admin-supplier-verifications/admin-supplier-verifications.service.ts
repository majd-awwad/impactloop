import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';

import {
  ADMIN_ACTIVITY_ACTIONS,
  logAdminActivity,
} from '../admin/admin-activity-log.js';
import { resolveLocalSupplierVerificationDocument } from '../uploads/verification-uploads.storage.js';

import * as repository from './admin-supplier-verifications.repository.js';
import {
  mapAdminStatusToDocumentStatus,
  mapAdminVerificationStatusToDb,
  mapDbVerificationStatusToAdmin,
  type AdminSupplierVerificationStatus,
} from './admin-supplier-verifications.status.js';
import type {
  ApproveSupplierVerificationInput,
  ListSupplierVerificationsQuery,
  RejectSupplierVerificationInput,
  RequestChangesSupplierVerificationInput,
} from './admin-supplier-verifications.validation.js';

type VerificationLocationDto = {
  city: string | null;
  area: string | null;
  addressLine: string | null;
  country: string | null;
};

type VerificationListItemDto = {
  supplierProfileId: string;
  organizationName: string;
  supplierType: string;
  ownerName: string;
  ownerEmail: string;
  city: string | null;
  area: string | null;
  verificationStatus: AdminSupplierVerificationStatus;
  verificationSubmittedAt: string | null;
  verificationReviewedAt: string | null;
  documentName: string | null;
  documentUrl: string | null;
};

type VerificationSummaryDto = {
  pending: number;
  approved: number;
  rejected: number;
  changesRequested: number;
};

type VerificationOwnerDto = {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
};

type VerificationOrganizationDto = {
  id: string;
  organizationName: string;
  organizationType: string;
  contactPersonName: string | null;
  verificationDocumentStatus: string | null;
  verificationDocumentUrl: string | null;
  verificationDocumentName: string | null;
  businessLocation: VerificationLocationDto | null;
};

type VerificationSupplierDto = {
  id: string;
  publicName: string | null;
  supplierType: string | null;
  description: string | null;
  verificationStatus: AdminSupplierVerificationStatus;
  verificationSubmittedAt: string | null;
  verificationReviewedAt: string | null;
  verificationAdminNote: string | null;
};

type VerificationReviewedByDto = {
  id: string;
  displayName: string;
  email: string;
} | null;

export type SupplierVerificationDetailDto = {
  supplierProfileId: string;
  supplier: VerificationSupplierDto;
  organization: VerificationOrganizationDto;
  owner: VerificationOwnerDto;
  location: VerificationLocationDto | null;
  verificationDocumentUrl: string | null;
  verificationDocumentName: string | null;
  verificationStatus: AdminSupplierVerificationStatus;
  adminNote: string | null;
  reviewedBy: VerificationReviewedByDto;
  reviewedAt: string | null;
  submittedAt: string | null;
};

export type SupplierVerificationListResponseDto = {
  items: VerificationListItemDto[];
  summary: VerificationSummaryDto;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

export type SupplierVerificationDashboardPreviewItem = {
  supplierProfileId: string;
  ownerName: string;
  organizationName: string;
  supplierType: string;
  verificationStatus: AdminSupplierVerificationStatus;
  submittedAt: string | null;
};

const mapLocation = (
  location: {
    city: string;
    area: string | null;
    addressLine: string | null;
    country: string;
  } | null,
): VerificationLocationDto | null => {
  if (!location) {
    return null;
  }

  return {
    city: location.city,
    area: location.area,
    addressLine: location.addressLine,
    country: location.country,
  };
};

const resolveSubmittedAt = (
  profile: repository.SupplierVerificationRecord,
): string | null => {
  if (profile.verificationSubmittedAt) {
    return profile.verificationSubmittedAt.toISOString();
  }

  return profile.organizationProfile?.createdAt.toISOString() ?? null;
};

const mapListItem = (
  profile: repository.SupplierVerificationRecord,
): VerificationListItemDto => {
  const organization = profile.organizationProfile!;
  const location = organization.businessLocation;

  return {
    supplierProfileId: profile.id,
    organizationName: organization.organizationName,
    supplierType: profile.supplierType ?? organization.organizationType,
    ownerName: profile.user.displayName,
    ownerEmail: profile.user.email,
    city: location?.city ?? null,
    area: location?.area ?? null,
    verificationStatus: mapDbVerificationStatusToAdmin(profile.verificationStatus),
    verificationSubmittedAt: resolveSubmittedAt(profile),
    verificationReviewedAt: profile.verificationReviewedAt?.toISOString() ?? null,
    documentName: organization.verificationDocumentName,
    documentUrl: organization.verificationDocumentUrl,
  };
};

const mapDetail = (
  profile: repository.SupplierVerificationRecord,
): SupplierVerificationDetailDto => {
  const organization = profile.organizationProfile!;
  const location = mapLocation(organization.businessLocation);

  return {
    supplierProfileId: profile.id,
    supplier: {
      id: profile.id,
      publicName: profile.publicName,
      supplierType: profile.supplierType,
      description: profile.description,
      verificationStatus: mapDbVerificationStatusToAdmin(profile.verificationStatus),
      verificationSubmittedAt: resolveSubmittedAt(profile),
      verificationReviewedAt: profile.verificationReviewedAt?.toISOString() ?? null,
      verificationAdminNote: profile.verificationAdminNote,
    },
    organization: {
      id: organization.id,
      organizationName: organization.organizationName,
      organizationType: organization.organizationType,
      contactPersonName: organization.contactPersonName,
      verificationDocumentStatus: organization.verificationDocumentStatus,
      verificationDocumentUrl: organization.verificationDocumentUrl,
      verificationDocumentName: organization.verificationDocumentName,
      businessLocation: location,
    },
    owner: {
      id: profile.user.id,
      displayName: profile.user.displayName,
      email: profile.user.email,
      phone: profile.user.phone,
    },
    location,
    verificationDocumentUrl: organization.verificationDocumentUrl,
    verificationDocumentName: organization.verificationDocumentName,
    verificationStatus: mapDbVerificationStatusToAdmin(profile.verificationStatus),
    adminNote: profile.verificationAdminNote,
    reviewedBy: profile.verificationReviewedBy
      ? {
          id: profile.verificationReviewedBy.id,
          displayName: profile.verificationReviewedBy.displayName,
          email: profile.verificationReviewedBy.email,
        }
      : null,
    reviewedAt: profile.verificationReviewedAt?.toISOString() ?? null,
    submittedAt: resolveSubmittedAt(profile),
  };
};

const buildSummary = (
  profiles: { verificationStatus: string }[],
): VerificationSummaryDto => {
  const summary: VerificationSummaryDto = {
    pending: 0,
    approved: 0,
    rejected: 0,
    changesRequested: 0,
  };

  for (const profile of profiles) {
    const status = mapDbVerificationStatusToAdmin(profile.verificationStatus);
    switch (status) {
      case 'APPROVED':
        summary.approved += 1;
        break;
      case 'REJECTED':
        summary.rejected += 1;
        break;
      case 'CHANGES_REQUESTED':
        summary.changesRequested += 1;
        break;
      default:
        summary.pending += 1;
        break;
    }
  }

  return summary;
};

const loadVerificationOrThrow = async (id: string) => {
  const profile = await repository.findOrganizationSupplierVerificationById(id);

  if (!profile) {
    throw new AppError(
      'Supplier verification request not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  return profile;
};

const notifySupplier = async (input: {
  userId: string;
  supplierProfileId: string;
  title: string;
  body: string;
  eventKey: string;
  actorId: string;
}) => {
  await repository.createSupplierVerificationNotification({
    userId: input.userId,
    supplierProfileId: input.supplierProfileId,
    title: input.title,
    body: input.body,
    eventKey: input.eventKey,
    actorId: input.actorId,
  });
};

export const listSupplierVerificationsForAdmin = async (
  query: ListSupplierVerificationsQuery,
): Promise<SupplierVerificationListResponseDto> => {
  const { items, total } =
    await repository.listOrganizationSupplierVerifications(query);
  const statusRows =
    await repository.countOrganizationSupplierVerificationsByStatus();

  return {
    items: items.map(mapListItem),
    summary: buildSummary(statusRows),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
    },
  };
};

export const countPendingSupplierVerificationsForDashboard = async () =>
  repository.countPendingOrganizationSupplierVerifications();

export const listSupplierVerificationDashboardPreview = async (
  limit: number,
): Promise<SupplierVerificationDashboardPreviewItem[]> => {
  const { items } = await repository.listOrganizationSupplierVerifications({
    status: 'PENDING',
    page: 1,
    limit,
    search: undefined,
    city: undefined,
    supplierType: undefined,
  });

  return items.map((profile) => {
    const organization = profile.organizationProfile!;
    return {
      supplierProfileId: profile.id,
      ownerName: profile.user.displayName,
      organizationName: organization.organizationName,
      supplierType: profile.supplierType ?? organization.organizationType,
      verificationStatus: mapDbVerificationStatusToAdmin(profile.verificationStatus),
      submittedAt: resolveSubmittedAt(profile),
    };
  });
};

export const getSupplierVerificationForAdmin = async (
  id: string,
): Promise<SupplierVerificationDetailDto> => {
  const profile = await loadVerificationOrThrow(id);
  return mapDetail(profile);
};

export const getSupplierVerificationDocumentForAdmin = async (id: string) => {
  const profile = await loadVerificationOrThrow(id);

  return {
    document: resolveLocalSupplierVerificationDocument(
      profile.organizationProfile?.verificationDocumentUrl,
    ),
    downloadName:
      profile.organizationProfile?.verificationDocumentName ?? null,
  };
};

export const approveSupplierVerification = async (
  adminId: string,
  id: string,
  input: ApproveSupplierVerificationInput,
): Promise<SupplierVerificationDetailDto> => {
  const existing = await loadVerificationOrThrow(id);
  const adminStatus: AdminSupplierVerificationStatus = 'APPROVED';
  const dbStatus = mapAdminVerificationStatusToDb(adminStatus);

  const updated = await repository.updateSupplierVerificationReview({
    supplierProfileId: existing.id,
    verificationStatus: dbStatus,
    verificationDocumentStatus: mapAdminStatusToDocumentStatus(adminStatus),
    adminId,
    adminNote: input.adminNote?.trim() || null,
  });

  const noteSuffix = input.adminNote?.trim()
    ? ` Note: ${input.adminNote.trim()}`
    : '';

  await notifySupplier({
    userId: existing.userId,
    supplierProfileId: existing.id,
    title: 'Supplier verification approved',
    body: `Your organization verification was approved.${noteSuffix}`,
    eventKey: `supplier-verification:${existing.id}:APPROVED:${updated.updatedAt.toISOString()}`,
    actorId: adminId,
  });

  const organizationName =
    existing.organizationProfile?.organizationName ?? existing.publicName ?? 'Supplier';

  await logAdminActivity({
    actorUserId: adminId,
    action: ADMIN_ACTIVITY_ACTIONS.SUPPLIER_VERIFICATION_APPROVED,
    targetType: 'SUPPLIER_PROFILE',
    targetId: existing.id,
    targetLabel: organizationName,
  });

  return mapDetail(updated);
};

export const rejectSupplierVerification = async (
  adminId: string,
  id: string,
  input: RejectSupplierVerificationInput,
): Promise<SupplierVerificationDetailDto> => {
  const existing = await loadVerificationOrThrow(id);
  const adminStatus: AdminSupplierVerificationStatus = 'REJECTED';
  const adminNote = input.adminNote.trim();

  const updated = await repository.updateSupplierVerificationReview({
    supplierProfileId: existing.id,
    verificationStatus: mapAdminVerificationStatusToDb(adminStatus),
    verificationDocumentStatus: mapAdminStatusToDocumentStatus(adminStatus),
    adminId,
    adminNote,
  });

  await notifySupplier({
    userId: existing.userId,
    supplierProfileId: existing.id,
    title: 'Supplier verification rejected',
    body: `Your organization verification was rejected. Reason: ${adminNote}`,
    eventKey: `supplier-verification:${existing.id}:REJECTED:${updated.updatedAt.toISOString()}`,
    actorId: adminId,
  });

  const organizationName =
    existing.organizationProfile?.organizationName ?? existing.publicName ?? 'Supplier';

  await logAdminActivity({
    actorUserId: adminId,
    action: ADMIN_ACTIVITY_ACTIONS.SUPPLIER_VERIFICATION_REJECTED,
    targetType: 'SUPPLIER_PROFILE',
    targetId: existing.id,
    targetLabel: organizationName,
    metadata: { reason: adminNote },
  });

  return mapDetail(updated);
};

export const requestChangesForSupplierVerification = async (
  adminId: string,
  id: string,
  input: RequestChangesSupplierVerificationInput,
): Promise<SupplierVerificationDetailDto> => {
  const existing = await loadVerificationOrThrow(id);
  const adminStatus: AdminSupplierVerificationStatus = 'CHANGES_REQUESTED';
  const adminNote = input.adminNote.trim();

  const updated = await repository.updateSupplierVerificationReview({
    supplierProfileId: existing.id,
    verificationStatus: mapAdminVerificationStatusToDb(adminStatus),
    verificationDocumentStatus: mapAdminStatusToDocumentStatus(adminStatus),
    adminId,
    adminNote,
  });

  await notifySupplier({
    userId: existing.userId,
    supplierProfileId: existing.id,
    title: 'Supplier verification changes requested',
    body: `Please update your verification submission. Admin note: ${adminNote}`,
    eventKey: `supplier-verification:${existing.id}:CHANGES_REQUESTED:${updated.updatedAt.toISOString()}`,
    actorId: adminId,
  });

  const organizationName =
    existing.organizationProfile?.organizationName ?? existing.publicName ?? 'Supplier';

  await logAdminActivity({
    actorUserId: adminId,
    action: ADMIN_ACTIVITY_ACTIONS.SUPPLIER_VERIFICATION_CHANGES_REQUESTED,
    targetType: 'SUPPLIER_PROFILE',
    targetId: existing.id,
    targetLabel: organizationName,
    metadata: { note: adminNote },
  });

  return mapDetail(updated);
};
