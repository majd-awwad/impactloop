import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  adminCreateInvitationSchema,
  invitationIdParamSchema,
} from '../invitations/invitations.validation.js';
import { moderateCommentHandler } from '../comments/comments.controller.js';
import { adminCommentIdParamSchema } from '../comments/comments.validation.js';

import {
  createAdminInvitation,
  getAdminInvitation,
  issueAdminInvitationLink,
  listAdminInvitations,
  resendAdminInvitation,
  revokeAdminInvitation,
} from './admin-invitations.controller.js';
import {
  approveAdminSupplierVerification,
  getAdminSupplierVerification,
  listAdminSupplierVerifications,
  rejectAdminSupplierVerification,
  requestChangesAdminSupplierVerification,
} from '../admin-supplier-verifications/admin-supplier-verifications.controller.js';
import {
  approveSupplierVerificationSchema,
  listSupplierVerificationsQuerySchema,
  rejectSupplierVerificationSchema,
  requestChangesSupplierVerificationSchema,
  supplierVerificationIdParamSchema,
} from '../admin-supplier-verifications/admin-supplier-verifications.validation.js';
import { getAdminDashboard } from './admin.controller.js';
import { listAdminAuditLogs } from './admin-audit-logs.controller.js';
import { adminAuditLogsListQuerySchema } from './admin-audit-logs.validation.js';
import {
  approveAdminCategoryRequest,
  approveAdminPriceRequest,
  getAdminApprovalsSummary,
  listAdminCategoryRequests,
  listAdminMaterialFamilyOptions,
  listAdminMaterialCategoryOptions,
  listAdminPriceRequests,
  rejectAdminCategoryRequest,
  rejectAdminPriceRequest,
} from '../admin-approvals/admin-approvals.controller.js';
import {
  approvalIdParamSchema,
  approvalsListQuerySchema,
  approveCategoryRequestSchema,
  approvePriceRequestSchema,
  rejectCategoryRequestSchema,
  rejectPriceRequestSchema,
} from '../admin-approvals/admin-approvals.validation.js';
import {
  getAdminMaterial,
  getAdminMaterialReport,
  getAdminMaterialsSummary,
  hideAdminMaterial,
  hideMaterialFromAdminReport,
  listAdminMaterialReports,
  listAdminMaterials,
  markAdminMaterialUnavailable,
  rejectAdminMaterialReport,
  resolveAdminMaterialReport,
  restoreAdminMaterial,
  submitMaterialReport,
} from '../admin-materials/admin-materials.controller.js';
import {
  adminMaterialIdParamSchema,
  adminMaterialReportIdParamSchema,
  adminMaterialReportsListQuerySchema,
  adminMaterialsListQuerySchema,
  hideMaterialFromReportSchema,
  hideMaterialSchema,
  markUnavailableSchema,
  rejectMaterialReportSchema,
  resolveMaterialReportSchema,
  submitMaterialReportSchema,
} from '../admin-materials/admin-materials.validation.js';

import {
  getAdminPerson,
  getAdminPeopleSummary,
  listAdminPeople,
  reactivateAdminPerson,
  suspendAdminPerson,
} from '../admin-people/admin-people.controller.js';
import {
  adminPeopleListQuerySchema,
  adminPeopleUserIdParamSchema,
  suspendUserSchema,
} from '../admin-people/admin-people.validation.js';
import {
  exportAdminReservationsHandler,
  getAdminReservationHandler,
  listAdminReservationsHandler,
  preflightAdminReservationsExportHandler,
} from '../admin-reservations/admin-reservations.controller.js';
import {
  adminReservationIdParamSchema,
  adminReservationsExportDownloadQuerySchema,
  adminReservationsExportFiltersSchema,
  adminReservationsListQuerySchema,
} from '../admin-reservations/admin-reservations.validation.js';
import {
  getAdminDeliveryHandler,
  listAdminDeliveriesHandler,
  reopenAdminDeliveryDriverAssignmentHandler,
} from '../admin-deliveries/admin-deliveries.controller.js';
import {
  adminDeliveriesListQuerySchema,
  adminDeliveryIdParamSchema,
} from '../admin-deliveries/admin-deliveries.validation.js';
import {
  approveAdminLearningProjectHandler,
  archiveAdminLearningProjectHandler,
  getAdminLearningProjectHandler,
  getSavedAdminLearningProjectAiReviewHandler,
  hideAdminLearningProjectHandler,
  listAdminLearningProjectsHandler,
  rejectAdminLearningProjectHandler,
  requestChangesAdminLearningProjectHandler,
  restoreAdminLearningProjectHandler,
  reviewAdminLearningProjectWithAiHandler,
  updateAdminLearningProjectComponentHandler,
} from '../admin-learning-projects/admin-learning-projects.controller.js';
import {
  adminAiReviewBodySchema,
  adminLearningProjectComponentParamsSchema,
  adminLearningProjectIdParamSchema,
  adminLearningProjectsListQuerySchema,
  moderationReasonSchema,
  updateAdminLearningProjectComponentSchema,
} from '../admin-learning-projects/admin-learning-projects.validation.js';
import {
  getAdminNoShowReportHandler,
  listAdminNoShowReportsHandler,
  rejectAdminNoShowReportHandler,
  requestSupplierRescheduleAdminNoShowReportHandler,
  cancelReleaseHoldAdminNoShowReportHandler,
  resolveAdminNoShowReportHandler,
  verifyAdminNoShowReportHandler,
} from '../admin-no-show-reports/admin-no-show-reports.controller.js';
import {
  adminNoShowReportIdParamSchema,
  adminNoShowReportsListQuerySchema,
  cancelReleaseHoldSchema,
  requestSupplierRescheduleSchema,
  reviewNoShowReportSchema,
} from '../admin-no-show-reports/admin-no-show-reports.validation.js';

export const adminRouter = Router();

adminRouter.get(
  '/dashboard',
  authMiddleware,
  requireRoles('ADMIN'),
  asyncHandler(getAdminDashboard),
);

adminRouter.get(
  '/audit-logs',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminAuditLogsListQuerySchema, 'query'),
  asyncHandler(listAdminAuditLogs),
);

adminRouter.get(
  '/invitations',
  authMiddleware,
  requireRoles('ADMIN'),
  asyncHandler(listAdminInvitations),
);

adminRouter.get(
  '/invitations/:id',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(invitationIdParamSchema, 'params'),
  asyncHandler(getAdminInvitation),
);

adminRouter.post(
  '/invitations',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminCreateInvitationSchema),
  asyncHandler(createAdminInvitation),
);

adminRouter.post(
  '/invitations/:id/issue-link',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(invitationIdParamSchema, 'params'),
  asyncHandler(issueAdminInvitationLink),
);

adminRouter.post(
  '/invitations/:id/resend',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(invitationIdParamSchema, 'params'),
  asyncHandler(resendAdminInvitation),
);

adminRouter.patch(
  '/invitations/:id/revoke',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(invitationIdParamSchema, 'params'),
  asyncHandler(revokeAdminInvitation),
);

adminRouter.get(
  '/supplier-verifications',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(listSupplierVerificationsQuerySchema, 'query'),
  asyncHandler(listAdminSupplierVerifications),
);

adminRouter.get(
  '/supplier-verifications/:id',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(supplierVerificationIdParamSchema, 'params'),
  asyncHandler(getAdminSupplierVerification),
);

adminRouter.patch(
  '/supplier-verifications/:id/approve',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(supplierVerificationIdParamSchema, 'params'),
  validate(approveSupplierVerificationSchema),
  asyncHandler(approveAdminSupplierVerification),
);

adminRouter.patch(
  '/supplier-verifications/:id/reject',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(supplierVerificationIdParamSchema, 'params'),
  validate(rejectSupplierVerificationSchema),
  asyncHandler(rejectAdminSupplierVerification),
);

adminRouter.patch(
  '/supplier-verifications/:id/request-changes',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(supplierVerificationIdParamSchema, 'params'),
  validate(requestChangesSupplierVerificationSchema),
  asyncHandler(requestChangesAdminSupplierVerification),
);

adminRouter.get(
  '/approvals/summary',
  authMiddleware,
  requireRoles('ADMIN'),
  asyncHandler(getAdminApprovalsSummary),
);

adminRouter.get(
  '/approvals/category-requests',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(approvalsListQuerySchema, 'query'),
  asyncHandler(listAdminCategoryRequests),
);

adminRouter.get(
  '/approvals/material-family-options',
  authMiddleware,
  requireRoles('ADMIN'),
  asyncHandler(listAdminMaterialFamilyOptions),
);

adminRouter.get(
  '/approvals/material-category-options',
  authMiddleware,
  requireRoles('ADMIN'),
  asyncHandler(listAdminMaterialCategoryOptions),
);

adminRouter.patch(
  '/approvals/category-requests/:id/approve',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(approvalIdParamSchema, 'params'),
  validate(approveCategoryRequestSchema),
  asyncHandler(approveAdminCategoryRequest),
);

adminRouter.patch(
  '/approvals/category-requests/:id/reject',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(approvalIdParamSchema, 'params'),
  validate(rejectCategoryRequestSchema),
  asyncHandler(rejectAdminCategoryRequest),
);

adminRouter.get(
  '/approvals/price-requests',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(approvalsListQuerySchema, 'query'),
  asyncHandler(listAdminPriceRequests),
);

adminRouter.patch(
  '/approvals/price-requests/:id/approve',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(approvalIdParamSchema, 'params'),
  validate(approvePriceRequestSchema),
  asyncHandler(approveAdminPriceRequest),
);

adminRouter.patch(
  '/approvals/price-requests/:id/reject',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(approvalIdParamSchema, 'params'),
  validate(rejectPriceRequestSchema),
  asyncHandler(rejectAdminPriceRequest),
);

adminRouter.get(
  '/materials/summary',
  authMiddleware,
  requireRoles('ADMIN'),
  asyncHandler(getAdminMaterialsSummary),
);

adminRouter.get(
  '/materials',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminMaterialsListQuerySchema, 'query'),
  asyncHandler(listAdminMaterials),
);

adminRouter.get(
  '/materials/:id',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminMaterialIdParamSchema, 'params'),
  asyncHandler(getAdminMaterial),
);

adminRouter.patch(
  '/materials/:id/hide',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminMaterialIdParamSchema, 'params'),
  validate(hideMaterialSchema),
  asyncHandler(hideAdminMaterial),
);

adminRouter.patch(
  '/materials/:id/mark-unavailable',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminMaterialIdParamSchema, 'params'),
  validate(markUnavailableSchema),
  asyncHandler(markAdminMaterialUnavailable),
);

adminRouter.patch(
  '/materials/:id/restore',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminMaterialIdParamSchema, 'params'),
  asyncHandler(restoreAdminMaterial),
);

adminRouter.get(
  '/material-reports',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminMaterialReportsListQuerySchema, 'query'),
  asyncHandler(listAdminMaterialReports),
);

adminRouter.get(
  '/material-reports/:id',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminMaterialReportIdParamSchema, 'params'),
  asyncHandler(getAdminMaterialReport),
);

adminRouter.patch(
  '/material-reports/:id/resolve',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminMaterialReportIdParamSchema, 'params'),
  validate(resolveMaterialReportSchema),
  asyncHandler(resolveAdminMaterialReport),
);

adminRouter.patch(
  '/material-reports/:id/reject',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminMaterialReportIdParamSchema, 'params'),
  validate(rejectMaterialReportSchema),
  asyncHandler(rejectAdminMaterialReport),
);

adminRouter.patch(
  '/material-reports/:id/hide-material',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminMaterialReportIdParamSchema, 'params'),
  validate(hideMaterialFromReportSchema),
  asyncHandler(hideMaterialFromAdminReport),
);

adminRouter.get(
  '/people/summary',
  authMiddleware,
  requireRoles('ADMIN'),
  asyncHandler(getAdminPeopleSummary),
);

adminRouter.get(
  '/people',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminPeopleListQuerySchema, 'query'),
  asyncHandler(listAdminPeople),
);

adminRouter.get(
  '/people/:id',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminPeopleUserIdParamSchema, 'params'),
  asyncHandler(getAdminPerson),
);

adminRouter.patch(
  '/people/:id/suspend',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminPeopleUserIdParamSchema, 'params'),
  validate(suspendUserSchema),
  asyncHandler(suspendAdminPerson),
);

adminRouter.patch(
  '/people/:id/reactivate',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminPeopleUserIdParamSchema, 'params'),
  asyncHandler(reactivateAdminPerson),
);

adminRouter.get(
  '/reservations/export/preflight',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminReservationsExportFiltersSchema, 'query'),
  asyncHandler(preflightAdminReservationsExportHandler),
);

adminRouter.get(
  '/reservations/export',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminReservationsExportDownloadQuerySchema, 'query'),
  asyncHandler(exportAdminReservationsHandler),
);

adminRouter.get(
  '/reservations',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminReservationsListQuerySchema, 'query'),
  asyncHandler(listAdminReservationsHandler),
);

adminRouter.get(
  '/reservations/:id',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminReservationIdParamSchema, 'params'),
  asyncHandler(getAdminReservationHandler),
);

adminRouter.get(
  '/deliveries',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminDeliveriesListQuerySchema, 'query'),
  asyncHandler(listAdminDeliveriesHandler),
);

adminRouter.post(
  '/deliveries/:id/reopen-driver-assignment',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminDeliveryIdParamSchema, 'params'),
  asyncHandler(reopenAdminDeliveryDriverAssignmentHandler),
);

adminRouter.get(
  '/deliveries/:id',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminDeliveryIdParamSchema, 'params'),
  asyncHandler(getAdminDeliveryHandler),
);

adminRouter.get(
  '/learning-projects',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminLearningProjectsListQuerySchema, 'query'),
  asyncHandler(listAdminLearningProjectsHandler),
);

adminRouter.get(
  '/learning-projects/:id',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminLearningProjectIdParamSchema, 'params'),
  asyncHandler(getAdminLearningProjectHandler),
);

adminRouter.get(
  '/learning-projects/:id/ai-review',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminLearningProjectIdParamSchema, 'params'),
  validate(adminAiReviewBodySchema, 'query'),
  asyncHandler(getSavedAdminLearningProjectAiReviewHandler),
);

adminRouter.post(
  '/learning-projects/:id/ai-review',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminLearningProjectIdParamSchema, 'params'),
  validate(adminAiReviewBodySchema),
  asyncHandler(reviewAdminLearningProjectWithAiHandler),
);

adminRouter.patch(
  '/learning-projects/:id/approve',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminLearningProjectIdParamSchema, 'params'),
  asyncHandler(approveAdminLearningProjectHandler),
);

adminRouter.patch(
  '/learning-projects/:id/request-changes',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminLearningProjectIdParamSchema, 'params'),
  validate(moderationReasonSchema),
  asyncHandler(requestChangesAdminLearningProjectHandler),
);

adminRouter.patch(
  '/learning-projects/:id/reject',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminLearningProjectIdParamSchema, 'params'),
  validate(moderationReasonSchema),
  asyncHandler(rejectAdminLearningProjectHandler),
);

adminRouter.patch(
  '/learning-projects/:id/hide',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminLearningProjectIdParamSchema, 'params'),
  validate(moderationReasonSchema),
  asyncHandler(hideAdminLearningProjectHandler),
);

adminRouter.patch(
  '/learning-projects/:id/restore',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminLearningProjectIdParamSchema, 'params'),
  asyncHandler(restoreAdminLearningProjectHandler),
);

adminRouter.patch(
  '/learning-projects/:id/archive',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminLearningProjectIdParamSchema, 'params'),
  validate(moderationReasonSchema),
  asyncHandler(archiveAdminLearningProjectHandler),
);

adminRouter.patch(
  '/learning-projects/:id/components/:componentId',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminLearningProjectComponentParamsSchema, 'params'),
  validate(updateAdminLearningProjectComponentSchema),
  asyncHandler(updateAdminLearningProjectComponentHandler),
);

adminRouter.get(
  '/no-show-reports',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportsListQuerySchema, 'query'),
  asyncHandler(listAdminNoShowReportsHandler),
);

adminRouter.get(
  '/no-show-reports/:id',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportIdParamSchema, 'params'),
  asyncHandler(getAdminNoShowReportHandler),
);

adminRouter.patch(
  '/no-show-reports/:id/verify',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportIdParamSchema, 'params'),
  validate(reviewNoShowReportSchema),
  asyncHandler(verifyAdminNoShowReportHandler),
);

adminRouter.patch(
  '/no-show-reports/:id/reject',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportIdParamSchema, 'params'),
  validate(reviewNoShowReportSchema),
  asyncHandler(rejectAdminNoShowReportHandler),
);

adminRouter.patch(
  '/no-show-reports/:id/resolve',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportIdParamSchema, 'params'),
  validate(reviewNoShowReportSchema),
  asyncHandler(resolveAdminNoShowReportHandler),
);

adminRouter.post(
  '/no-show-reports/:id/request-supplier-reschedule',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportIdParamSchema, 'params'),
  validate(requestSupplierRescheduleSchema),
  asyncHandler(requestSupplierRescheduleAdminNoShowReportHandler),
);

adminRouter.post(
  '/no-show-reports/:id/cancel-release-hold',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportIdParamSchema, 'params'),
  validate(cancelReleaseHoldSchema),
  asyncHandler(cancelReleaseHoldAdminNoShowReportHandler),
);

adminRouter.get(
  '/reservation-reports',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportsListQuerySchema, 'query'),
  asyncHandler(listAdminNoShowReportsHandler),
);

adminRouter.get(
  '/reservation-reports/:id',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportIdParamSchema, 'params'),
  asyncHandler(getAdminNoShowReportHandler),
);

adminRouter.post(
  '/reservation-reports/:id/verify',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportIdParamSchema, 'params'),
  validate(reviewNoShowReportSchema),
  asyncHandler(verifyAdminNoShowReportHandler),
);

adminRouter.post(
  '/reservation-reports/:id/reject',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportIdParamSchema, 'params'),
  validate(reviewNoShowReportSchema),
  asyncHandler(rejectAdminNoShowReportHandler),
);

adminRouter.post(
  '/reservation-reports/:id/resolve',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportIdParamSchema, 'params'),
  validate(reviewNoShowReportSchema),
  asyncHandler(resolveAdminNoShowReportHandler),
);

adminRouter.post(
  '/reservation-reports/:id/request-supplier-reschedule',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportIdParamSchema, 'params'),
  validate(requestSupplierRescheduleSchema),
  asyncHandler(requestSupplierRescheduleAdminNoShowReportHandler),
);

adminRouter.post(
  '/reservation-reports/:id/cancel-release-hold',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminNoShowReportIdParamSchema, 'params'),
  validate(cancelReleaseHoldSchema),
  asyncHandler(cancelReleaseHoldAdminNoShowReportHandler),
);

adminRouter.delete(
  '/comments/:id',
  authMiddleware,
  requireRoles('ADMIN', 'MODERATOR'),
  validate(adminCommentIdParamSchema, 'params'),
  asyncHandler(moderateCommentHandler),
);
