import type { ReservationStatus } from '../../generated/prisma/client.js';

import * as adminRepository from './admin.repository.js';
import { estimateCo2KgFromReusedMaterials } from './admin-impact-estimator.js';

export type AdminDashboardResponse = {
  summary: {
    totalUsers: number;
    totalSuppliers: number;
    totalMaterials: number;
    availableMaterials: number;
    pendingApprovals: number;
    activeInvitations: number;
    completedReuse: number;
    activeDrivers: number;
  };
  pendingActions: {
    supplierVerifications: number;
    categoryRequests: number;
    priceRequests: number;
    reports: number;
  };
  impact: {
    reusedMaterials: number;
    completedReservations: number;
    learnersBenefited: number;
    suppliersContributed: number;
    topCategory: null | {
      id: string;
      nameEn: string;
      nameAr: string;
      reusedCount: number;
    };
    reuseByMonth: { month: string; count: number }[];
    estimatedCo2Kg: number;
    estimatedCo2Label: string;
    estimatedCo2Method: string;
    reuseCompletionRate: number;
    co2ReuseProgress: number;
  };
  materialsByCategory: { id: string; nameEn: string; nameAr: string; count: number }[];
  reservationStatusBreakdown: { status: ReservationStatus; count: number }[];
  recentInvitations: {
    id: string;
    targetEmail: string | null;
    targetRole: string;
    status: string;
    expiresAt: string;
    createdAt: string;
  }[];
  supplierVerificationPreview: unknown[];
  recentActivity: unknown[];
};

const monthKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const lastNMonths = (count: number): { key: string; start: Date; end: Date }[] => {
  const months: { key: string; start: Date; end: Date }[] = [];
  const now = new Date();
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  for (let i = count - 1; i >= 0; i -= 1) {
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i + 1, 1));
    months.push({ key: monthKey(start), start, end });
  }

  return months;
};

export const buildAdminDashboard = async (): Promise<AdminDashboardResponse> => {
  const sixMonths = lastNMonths(6);
  const reuseWindowStart = sixMonths[0]!.start;

  const [
    totalUsers,
    totalSuppliers,
    totalMaterials,
    availableMaterials,
    activeInvitations,
    activeDrivers,
    reusedMaterials,
    completedReservations,
    learnersBenefited,
    suppliersContributed,
    topCategory,
    materialsByCategory,
    reservationStatusBreakdown,
    reuseByMonthCounts,
    pendingCategoryRequests,
    pendingPriceRequests,
    totalReservations,
    reusedMaterialsForCo2,
  ] = await Promise.all([
    adminRepository.countUsers(),
    adminRepository.countSuppliersByRole(),
    adminRepository.countMaterials(),
    adminRepository.countAvailableMaterials(),
    adminRepository.countActiveInvitations(),
    adminRepository.countActiveDriversByRole(),
    adminRepository.countReusedMaterials(),
    adminRepository.countCompletedReservations(),
    adminRepository.countLearnersBenefited(),
    adminRepository.countSuppliersContributed(),
    adminRepository.findTopReuseCategory(),
    adminRepository.groupMaterialsByCategory(),
    adminRepository.groupReservationsByStatus(),
    adminRepository.groupReuseByMonth(reuseWindowStart),
    adminRepository.countPendingCategoryRequests(),
    adminRepository.countPendingPriceRequests(),
    adminRepository.countTotalReservations(),
    adminRepository.listReusedMaterialsForCo2Estimate(),
  ]);

  const reuseByMonthMap = new Map<string, number>();
  for (const item of reuseByMonthCounts) {
    reuseByMonthMap.set(item.month, item.count);
  }

  const reuseByMonth = sixMonths.map(({ key }) => ({
    month: key,
    count: reuseByMonthMap.get(key) ?? 0,
  }));

  // This phase does not implement supplier verification workflow or reports schema.
  const supplierVerifications = 0;
  const reports = 0;
  const pendingApprovals = supplierVerifications + pendingCategoryRequests + pendingPriceRequests + reports;

  const co2Estimate = estimateCo2KgFromReusedMaterials(reusedMaterialsForCo2);
  const reuseCompletionRate =
    totalReservations === 0 ? 0 : completedReservations / totalReservations;
  const co2ReuseProgress =
    totalMaterials === 0 ? 0 : Math.min(reusedMaterials / totalMaterials, 1);

  return {
    summary: {
      totalUsers,
      totalSuppliers,
      totalMaterials,
      availableMaterials,
      pendingApprovals,
      activeInvitations,
      // "completedReuse" uses material reuse (source of truth: materials.status=REUSED).
      completedReuse: reusedMaterials,
      // No driver_profiles table exists; use DRIVER role count.
      activeDrivers,
    },
    pendingActions: {
      supplierVerifications,
      categoryRequests: pendingCategoryRequests,
      priceRequests: pendingPriceRequests,
      reports,
    },
    impact: {
      reusedMaterials,
      completedReservations,
      learnersBenefited,
      suppliersContributed,
      topCategory,
      reuseByMonth,
      estimatedCo2Kg: co2Estimate.estimatedCo2Kg,
      estimatedCo2Label: co2Estimate.estimatedCo2Label,
      estimatedCo2Method: co2Estimate.estimatedCo2Method,
      reuseCompletionRate,
      co2ReuseProgress,
    },
    materialsByCategory,
    reservationStatusBreakdown,
    recentInvitations: await adminRepository.listRecentInvitations(5),
    supplierVerificationPreview: [],
    recentActivity: [],
  };
};

