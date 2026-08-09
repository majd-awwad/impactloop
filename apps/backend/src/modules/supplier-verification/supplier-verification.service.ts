import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';

import {
  canSupplierPublishMaterials,
  isOrganizationSupplierType,
  isSupplierVerificationRevisionRequired,
  normalizeSupplierVerificationStatus,
  requiresOrganizationVerification,
  resolveSupplierVerificationEligibility,
} from '../supplier/supplier-verification.status.js';
import { deleteReplacedVerificationUpload } from '../uploads/local-upload-cleanup.js';
import { resolveLocalSupplierVerificationDocument } from '../uploads/verification-uploads.storage.js';

import * as repository from './supplier-verification.repository.js';
import type {
  ResubmitSupplierVerificationInput,
  SubmitSupplierVerificationInput,
} from './supplier-verification.validation.js';

export type SupplierVerificationStatusDto = {
  supplierType: string;
  verificationStatus: string;
  verificationAdminNote: string | null;
  verificationSubmittedAt: string | null;
  verificationReviewedAt: string | null;
  verificationDocumentName: string | null;
  verificationDocumentUrl: string | null;
  organizationName: string | null;
  canPublishMaterials: boolean;
  canAccessSupplierPortal: boolean;
};

const mapStatusDto = (
  profile: NonNullable<
    Awaited<ReturnType<typeof repository.findSupplierVerificationContext>>
  >,
): SupplierVerificationStatusDto => {
  const status = normalizeSupplierVerificationStatus(profile.verificationStatus);
  const adminNote = isSupplierVerificationRevisionRequired(status)
    ? profile.verificationAdminNote
    : null;

  return {
    supplierType: profile.supplierType ?? '',
    verificationStatus: status,
    verificationAdminNote: adminNote,
    verificationSubmittedAt:
      profile.verificationSubmittedAt?.toISOString() ?? null,
    verificationReviewedAt: profile.verificationReviewedAt?.toISOString() ?? null,
    verificationDocumentName:
      profile.organizationProfile?.verificationDocumentName ?? null,
    verificationDocumentUrl:
      profile.organizationProfile?.verificationDocumentUrl ?? null,
    organizationName: profile.organizationProfile?.organizationName ?? null,
    canPublishMaterials: canSupplierPublishMaterials({
      supplierType: profile.supplierType,
      verificationStatus: profile.verificationStatus,
    }),
    canAccessSupplierPortal: canSupplierPublishMaterials({
      supplierType: profile.supplierType,
      verificationStatus: profile.verificationStatus,
    }),
  };
};

export const getSupplierVerificationStatus = async (userId: string) => {
  const profile = await repository.findSupplierVerificationContext(userId);

  if (!profile) {
    throw new AppError(
      'Supplier profile not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  return mapStatusDto(profile);
};

export const getSupplierVerificationDocumentForOwner = async (userId: string) => {
  const profile = await repository.findSupplierVerificationContext(userId);

  if (!profile) {
    throw new AppError(
      'Supplier profile not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  if (!requiresOrganizationVerification(profile.supplierType)) {
    throw new AppError(
      'Verification documents are only available for organization suppliers.',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  return {
    document: resolveLocalSupplierVerificationDocument(
      profile.organizationProfile?.verificationDocumentUrl,
    ),
    downloadName:
      profile.organizationProfile?.verificationDocumentName ?? null,
  };
};

export const submitSupplierVerification = async (
  userId: string,
  input: SubmitSupplierVerificationInput,
) => {
  if (!isOrganizationSupplierType(input.supplierType)) {
    throw new AppError(
      'Verification submission is only required for organization suppliers',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  const existing = await repository.findSupplierVerificationContext(userId);
  const previousDocumentUrl =
    existing?.organizationProfile?.verificationDocumentUrl ?? null;

  const profile = await repository.submitSupplierVerificationRecord({
    userId,
    supplierType: input.supplierType,
    publicName: input.organizationName,
    description: input.description ?? null,
    phone: input.phone ?? null,
    contactPersonName: input.contactPersonName ?? null,
    defaultPickupLocation: input.defaultPickupLocation,
    businessLocation: input.businessLocation,
    verificationDocumentUrl: input.verificationDocumentUrl,
    verificationDocumentName: input.verificationDocumentName,
  });

  deleteReplacedVerificationUpload(
    previousDocumentUrl,
    input.verificationDocumentUrl,
  );

  return mapStatusDto(profile);
};

export const resubmitSupplierVerification = async (
  userId: string,
  input: ResubmitSupplierVerificationInput,
) => {
  const existing = await repository.findSupplierVerificationContext(userId);

  if (!existing) {
    throw new AppError(
      'Supplier profile not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  if (!requiresOrganizationVerification(existing.supplierType)) {
    throw new AppError(
      'Verification resubmission is only for organization suppliers',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  const currentStatus = normalizeSupplierVerificationStatus(
    existing.verificationStatus,
  );

  const eligibility = resolveSupplierVerificationEligibility({
    supplierType: existing.supplierType,
    verificationStatus: currentStatus,
  });

  if (!eligibility.canResubmit) {
    throw new AppError(
      'Verification document can only be resubmitted after rejection or changes requested',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  const previousDocumentUrl =
    existing.organizationProfile?.verificationDocumentUrl ?? null;

  const profile = await repository.resubmitSupplierVerificationRecord({
    userId,
    verificationDocumentUrl: input.verificationDocumentUrl,
    verificationDocumentName: input.verificationDocumentName,
    organizationName: input.organizationName,
    description: input.description,
    contactPersonName: input.contactPersonName,
    phone: input.phone,
    defaultPickupLocation: input.defaultPickupLocation,
    businessLocation: input.businessLocation,
  });

  deleteReplacedVerificationUpload(
    previousDocumentUrl,
    input.verificationDocumentUrl,
  );

  return mapStatusDto(profile);
};

export const assertSupplierCanPublishMaterials = (input: {
  supplierType: string | null | undefined;
  verificationStatus: string;
}) => {
  if (canSupplierPublishMaterials(input)) {
    return;
  }

  const status = normalizeSupplierVerificationStatus(input.verificationStatus);

  if (status === 'PENDING') {
    throw new AppError(
      'Your supplier account is waiting for admin approval. You can publish materials after approval.',
      403,
      'SUPPLIER_VERIFICATION_PENDING',
    );
  }

  if (isSupplierVerificationRevisionRequired(status)) {
    throw new AppError(
      'Your supplier verification must be approved before publishing materials.',
      403,
      'SUPPLIER_VERIFICATION_BLOCKED',
    );
  }

  throw new AppError(
    'Your supplier account is not approved to publish materials yet.',
    403,
    'SUPPLIER_VERIFICATION_BLOCKED',
  );
};
