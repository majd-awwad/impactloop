export {
  cancelAndReleaseHoldForPickupRecoveryReport as cancelAndReleaseHoldForNoDriverReport,
  isNoDriverAvailableSystemReport,
  requestSupplierRescheduleForPickupRecoveryReport as requestSupplierRescheduleForNoDriverReport,
} from './admin-delivery-pickup-recovery.repository.js';

export type { PickupRecoveryKind } from './admin-delivery-pickup-recovery.repository.js';

export type AdminNoDriverResolutionReport = import('./admin-no-show-reports.repository.js').AdminNoShowReportRecord;

export type AdminNoDriverResolutionResult =
  | Awaited<
      ReturnType<
        typeof import('./admin-delivery-pickup-recovery.repository.js').requestSupplierRescheduleForPickupRecoveryReport
      >
    >
  | Awaited<
      ReturnType<
        typeof import('./admin-delivery-pickup-recovery.repository.js').cancelAndReleaseHoldForPickupRecoveryReport
      >
    >;
