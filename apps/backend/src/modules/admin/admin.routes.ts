import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  adminCreateInvitationSchema,
  invitationIdParamSchema,
} from '../invitations/invitations.validation.js';

import {
  createAdminInvitation,
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
import {
  approveAdminCategoryRequest,
  approveAdminPriceRequest,
  getAdminApprovalsSummary,
  listAdminCategoryRequests,
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

export const adminRouter = Router();

adminRouter.get(
  '/dashboard',
  authMiddleware,
  requireRoles('ADMIN'),
  asyncHandler(getAdminDashboard),
);

adminRouter.get(
  '/invitations',
  authMiddleware,
  requireRoles('ADMIN'),
  asyncHandler(listAdminInvitations),
);

adminRouter.post(
  '/invitations',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(adminCreateInvitationSchema),
  asyncHandler(createAdminInvitation),
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

