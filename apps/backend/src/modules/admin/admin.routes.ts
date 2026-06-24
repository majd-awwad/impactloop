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

