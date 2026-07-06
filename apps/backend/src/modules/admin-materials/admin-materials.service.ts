import { AppError } from '../../utils/app-error.js';
import { decimalToNumber } from '../../utils/decimal.js';

import {
  ADMIN_ACTIVITY_ACTIONS,
  ADMIN_ACTIVITY_TARGET_TYPES,
  logAdminActivity,
} from '../admin/admin-activity-log.js';
import * as repository from './admin-materials.repository.js';
import {
  assertCanHideMaterial,
  assertCanMarkMaterialUnavailable,
  assertCanRestoreMaterial,
  getMaterialModerationPolicy,
} from './admin-materials.moderation-policy.js';
import type {
  AdminMaterialReportsListQuery,
  AdminMaterialsListQuery,
  HideMaterialFromReportInput,
  HideMaterialInput,
  MarkUnavailableInput,
  RejectMaterialReportInput,
  ResolveMaterialReportInput,
  SubmitMaterialReportInput,
} from './admin-materials.validation.js';

const mapSupplierName = (
  material: Awaited<ReturnType<typeof repository.listMaterialsForAdmin>>['items'][number],
) =>
  material.supplierProfile?.publicName ??
  material.owner.displayName ??
  'Unknown supplier';

const mapListItem = (
  material: Awaited<ReturnType<typeof repository.listMaterialsForAdmin>>['items'][number],
  pendingByMaterial: Map<string, number>,
) => ({
  materialId: material.id,
  title: material.title,
  shortDescription:
    material.description.length > 160
      ? `${material.description.slice(0, 157)}...`
      : material.description,
  imageUrl: material.images[0]?.imageUrl ?? null,
  categoryName: material.category.nameEn,
  supplierName: mapSupplierName(material),
  supplierEmail: material.owner.email,
  supplierVerificationStatus:
    material.supplierProfile?.verificationStatus ?? 'NOT_REQUIRED',
  city: material.location.city,
  area: material.location.area,
  quantity: decimalToNumber(material.quantity),
  unit: material.unit,
  condition: material.condition,
  isFree: material.isFree,
  price: material.price == null ? null : decimalToNumber(material.price),
  currency: material.currency,
  status: material.status,
  reportCount: material._count.reports,
  pendingReportCount: pendingByMaterial.get(material.id) ?? 0,
  createdAt: material.createdAt.toISOString(),
  updatedAt: material.updatedAt.toISOString(),
  allowedActions: getMaterialModerationPolicy(material.status),
});

export const getAdminMaterialsSummary = async () => {
  return repository.countMaterialsSummary();
};

export const listAdminMaterials = async (query: AdminMaterialsListQuery) => {
  const result = await repository.listMaterialsForAdmin(query);

  return {
    summary: await repository.countMaterialsSummary(),
    items: result.items.map((item) => mapListItem(item, result.pendingByMaterial)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
    },
  };
};

export const getAdminMaterialById = async (id: string) => {
  const material = await repository.findMaterialByIdForAdmin(id);
  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  const pendingReportCount = material.reports.filter(
    (report) => report.status === 'PENDING',
  ).length;
  const moderationPolicy = getMaterialModerationPolicy(material.status);

  return {
    id: material.id,
    title: material.title,
    description: material.description,
    materialType: material.materialType,
    quantity: decimalToNumber(material.quantity),
    unit: material.unit,
    condition: material.condition,
    sourceType: material.sourceType,
    status: material.status,
    isFree: material.isFree,
    price: material.price == null ? null : decimalToNumber(material.price),
    currency: material.currency,
    pickupAllowed: material.pickupAllowed,
    deliveryAllowed: material.deliveryAllowed,
    pickupNotes: material.pickupNotes,
    suggestedUses: material.suggestedUses,
    viewsCount: material.viewsCount,
    moderationReason: material.moderationReason,
    moderatedAt: material.moderatedAt?.toISOString() ?? null,
    moderatedBy: material.moderatedBy
      ? { id: material.moderatedBy.id, displayName: material.moderatedBy.displayName }
      : null,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
    images: material.images.map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      sortOrder: image.sortOrder,
      isCover: image.isCover,
    })),
    category: material.category,
    location: {
      id: material.location.id,
      country: material.location.country,
      city: material.location.city,
      area: material.location.area,
      addressLine: material.location.addressLine,
      visibility: material.location.visibility,
      isApproximate: material.location.isApproximate,
    },
    supplier: {
      id: material.owner.id,
      displayName: material.owner.displayName,
      email: material.owner.email,
      phone: material.owner.phone,
      publicName: material.supplierProfile?.publicName ?? null,
      verificationStatus:
        material.supplierProfile?.verificationStatus ?? 'NOT_REQUIRED',
      organization: material.supplierProfile?.organizationProfile
        ? {
            organizationName:
              material.supplierProfile.organizationProfile.organizationName,
            organizationType:
              material.supplierProfile.organizationProfile.organizationType,
          }
        : null,
    },
    reportSummary: {
      totalCount: material._count.reports,
      pendingCount: pendingReportCount,
      reservationCount: material._count.reservations,
    },
    latestReports: material.reports.map((report) => ({
      id: report.id,
      reason: report.reason,
      note: report.note,
      status: report.status,
      adminNote: report.adminNote,
      reporter: {
        id: report.reporter.id,
        displayName: report.reporter.displayName,
        email: report.reporter.email,
      },
      reviewedBy: report.reviewedBy
        ? {
            id: report.reviewedBy.id,
            displayName: report.reviewedBy.displayName,
          }
        : null,
      reviewedAt: report.reviewedAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
    })),
    allowedActions: moderationPolicy,
  };
};

export const hideAdminMaterial = async (
  adminUserId: string,
  materialId: string,
  input: HideMaterialInput,
) => {
  const material = await repository.findMaterialById(materialId);
  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  await assertCanHideMaterial(materialId, material.status);

  const updated = await repository.hideMaterial({
    materialId,
    reason: input.reason.trim(),
    adminUserId,
  });

  await repository.createMaterialModerationNotification({
    userId: material.ownerId,
    title: 'Material hidden by admin',
    body: `Your material '${material.title}' was hidden by admin. Reason: ${input.reason.trim()}.`,
    materialId,
  });

  await logAdminActivity({
    actorUserId: adminUserId,
    action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_HIDDEN,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.MATERIAL,
    targetId: materialId,
    targetLabel: material.title,
    metadata: {
      reason: input.reason.trim(),
      previousStatus: material.status,
      newStatus: updated.status,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    moderationReason: updated.moderationReason,
  };
};

export const markAdminMaterialUnavailable = async (
  adminUserId: string,
  materialId: string,
  input: MarkUnavailableInput,
) => {
  const material = await repository.findMaterialById(materialId);
  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  await assertCanMarkMaterialUnavailable(materialId, material.status);

  const updated = await repository.markMaterialUnavailable({
    materialId,
    reason: input.reason?.trim(),
    adminUserId,
  });

  if (input.reason?.trim()) {
    await repository.createMaterialModerationNotification({
      userId: material.ownerId,
      title: 'Material marked unavailable',
      body: `Your material '${material.title}' was marked unavailable. Reason: ${input.reason.trim()}.`,
      materialId,
    });
  }

  await logAdminActivity({
    actorUserId: adminUserId,
    action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_MARKED_UNAVAILABLE,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.MATERIAL,
    targetId: materialId,
    targetLabel: material.title,
    metadata: {
      reason: input.reason?.trim() ?? null,
      previousStatus: material.status,
      newStatus: updated.status,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    moderationReason: updated.moderationReason,
  };
};

export const restoreAdminMaterial = async (
  adminUserId: string,
  materialId: string,
) => {
  const material = await repository.findMaterialById(materialId);
  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  assertCanRestoreMaterial(material.status);

  const updated = await repository.restoreMaterial(materialId);

  await repository.createMaterialModerationNotification({
    userId: material.ownerId,
    title: 'Material restored',
    body: `Your material '${material.title}' was restored and is visible again.`,
    materialId,
  });

  await logAdminActivity({
    actorUserId: adminUserId,
    action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_RESTORED,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.MATERIAL,
    targetId: materialId,
    targetLabel: material.title,
    metadata: {
      previousStatus: material.status,
      newStatus: updated.status,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    restoredByAdminId: adminUserId,
  };
};

export const listAdminMaterialReports = async (
  query: AdminMaterialReportsListQuery,
) => {
  const result = await repository.listMaterialReportsForAdmin(query);

  return {
    items: result.items.map((report) => ({
      reportId: report.id,
      reason: report.reason,
      note: report.note,
      status: report.status,
      reporterName: report.reporter.displayName,
      reporterEmail: report.reporter.email,
      materialTitle: report.material.title,
      materialId: report.material.id,
      materialStatus: report.material.status,
      canHideMaterial: getMaterialModerationPolicy(report.material.status).canHide,
      supplierName:
        report.material.owner.supplierProfile?.publicName ??
        report.material.owner.displayName,
      supplierVerificationStatus:
        report.material.owner.supplierProfile?.verificationStatus ?? 'NOT_REQUIRED',
      createdAt: report.createdAt.toISOString(),
      reviewedAt: report.reviewedAt?.toISOString() ?? null,
      adminNote: report.adminNote,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
    },
  };
};

export const getAdminMaterialReportById = async (id: string) => {
  const report = await repository.findMaterialReportByIdForAdmin(id);
  if (!report) {
    throw new AppError('Report not found', 404, 'NOT_FOUND');
  }

  return {
    id: report.id,
    reason: report.reason,
    note: report.note,
    status: report.status,
    adminNote: report.adminNote,
    reviewedAt: report.reviewedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
    reporter: {
      id: report.reporter.id,
      displayName: report.reporter.displayName,
      email: report.reporter.email,
    },
    reviewedBy: report.reviewedBy
      ? { id: report.reviewedBy.id, displayName: report.reviewedBy.displayName }
      : null,
    material: {
      id: report.material.id,
      title: report.material.title,
      status: report.material.status,
      imageUrl: report.material.images[0]?.imageUrl ?? null,
      category: report.material.category,
      location: report.material.location,
      supplier: {
        id: report.material.owner.id,
        displayName: report.material.owner.displayName,
        email: report.material.owner.email,
        publicName: report.material.owner.supplierProfile?.publicName ?? null,
        verificationStatus:
          report.material.owner.supplierProfile?.verificationStatus ?? 'NOT_REQUIRED',
        organization: report.material.owner.supplierProfile?.organizationProfile
          ? {
              organizationName:
                report.material.owner.supplierProfile.organizationProfile
                  .organizationName,
              organizationType:
                report.material.owner.supplierProfile.organizationProfile
                  .organizationType,
            }
          : null,
      },
    },
  };
};

const assertPendingReport = (
  report: NonNullable<Awaited<ReturnType<typeof repository.findMaterialReportByIdForAdmin>>>,
) => {
  if (report.status !== 'PENDING') {
    throw new AppError('This report was already reviewed.', 409, 'CONFLICT');
  }
};

export const resolveAdminMaterialReport = async (
  adminUserId: string,
  reportId: string,
  input: ResolveMaterialReportInput,
) => {
  const report = await repository.findMaterialReportByIdForAdmin(reportId);
  if (!report) {
    throw new AppError('Report not found', 404, 'NOT_FOUND');
  }

  assertPendingReport(report);

  const updated = await repository.resolveMaterialReport({
    reportId,
    adminUserId,
    adminNote: input.adminNote?.trim(),
  });

  await logAdminActivity({
    actorUserId: adminUserId,
    action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_REPORT_RESOLVED,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.MATERIAL_REPORT,
    targetId: reportId,
    targetLabel: report.material.title,
    metadata: {
      materialId: report.materialId,
      reportReason: report.reason,
      adminNote: input.adminNote?.trim() ?? null,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    adminNote: updated.adminNote,
  };
};

export const rejectAdminMaterialReport = async (
  adminUserId: string,
  reportId: string,
  input: RejectMaterialReportInput,
) => {
  const report = await repository.findMaterialReportByIdForAdmin(reportId);
  if (!report) {
    throw new AppError('Report not found', 404, 'NOT_FOUND');
  }

  assertPendingReport(report);

  const updated = await repository.rejectMaterialReport({
    reportId,
    adminUserId,
    adminNote: input.adminNote.trim(),
  });

  await repository.createMaterialModerationNotification({
    userId: report.reporterId,
    title: 'Report reviewed',
    body: `Your report for '${report.material.title}' was reviewed.`,
    materialId: report.materialId,
  });

  await logAdminActivity({
    actorUserId: adminUserId,
    action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_REPORT_REJECTED,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.MATERIAL_REPORT,
    targetId: reportId,
    targetLabel: report.material.title,
    metadata: {
      materialId: report.materialId,
      reportReason: report.reason,
      adminNote: input.adminNote.trim(),
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    adminNote: updated.adminNote,
  };
};

export const hideMaterialFromAdminReport = async (
  adminUserId: string,
  reportId: string,
  input: HideMaterialFromReportInput,
) => {
  const report = await repository.findMaterialReportByIdForAdmin(reportId);
  if (!report) {
    throw new AppError('Report not found', 404, 'NOT_FOUND');
  }

  assertPendingReport(report);
  await assertCanHideMaterial(report.materialId, report.material.status);

  const ownerId = report.material.owner.id;

  const { material } = await repository.hideMaterialAndResolveReport({
    reportId,
    materialId: report.materialId,
    adminUserId,
    adminNote: input.adminNote.trim(),
  });

  await repository.createMaterialModerationNotification({
    userId: ownerId,
    title: 'Material hidden after report review',
    body: `Your material '${material.title}' was hidden after admin review. Reason: ${input.adminNote.trim()}.`,
    materialId: report.materialId,
  });

  await logAdminActivity({
    actorUserId: adminUserId,
    action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_REPORT_HIDE_MATERIAL,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.MATERIAL,
    targetId: report.materialId,
    targetLabel: material.title,
    metadata: {
      reportId,
      reportReason: report.reason,
      adminNote: input.adminNote.trim(),
      materialStatus: material.status,
    },
  });

  return {
    reportId,
    reportStatus: 'RESOLVED',
    materialId: material.id,
    materialStatus: material.status,
    adminNote: input.adminNote.trim(),
  };
};

export const submitMaterialReport = async (
  reporterId: string,
  materialId: string,
  input: SubmitMaterialReportInput,
) => {
  const material = await repository.findReportableMaterial(materialId);
  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  if (material.ownerId === reporterId) {
    throw new AppError('You cannot report your own material.', 400, 'VALIDATION_ERROR');
  }

  const existing = await repository.findPendingReportByReporter({
    materialId,
    reporterId,
  });
  if (existing) {
    throw new AppError(
      'You already reported this material. Admin will review it.',
      409,
      'CONFLICT',
      { reason: 'DUPLICATE_PENDING_REPORT' },
    );
  }

  const report = await repository.createMaterialReport({
    materialId,
    reporterId,
    reason: input.reason,
    note: input.note?.trim(),
  });

  return {
    id: report.id,
    status: report.status,
    message: 'Report submitted. Admin will review this material.',
  };
};
