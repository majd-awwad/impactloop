import { normalizeSupplierVerificationStatus } from '../supplier-verification.status.js';

export type SupplierLocationSummaryDto = {
  id: string;
  city: string;
  area: string | null;
  visibility: string | null;
  isApproximate: boolean;
};

export type SupplierOrganizationSummaryDto = {
  organizationName: string;
  organizationType: string;
};

export type SupplierSummaryDto = {
  id: string;
  userId: string;
  publicName: string;
  supplierType: string;
  description: string | null;
  verificationStatus: string;
  defaultLocation: SupplierLocationSummaryDto | null;
  organization: SupplierOrganizationSummaryDto | null;
};

export type MaterialStatsDto = {
  total: number;
  available: number;
  pendingReservation: number;
  reserved: number;
  reused: number;
  unavailable: number;
};

export type ReservationStatsDto = {
  pending: number;
  accepted: number;
  completed: number;
  rejected: number;
  cancelled: number;
  expired: number;
};

export type ImpactStatsDto = {
  reusedMaterials: number;
  reusedQuantity: number;
};

export type ReviewStatsDto = {
  averageRating: number;
  totalReviews: number;
};

export type NotificationStatsDto = {
  unread: number;
};

export type DashboardStatsDto = {
  materials: MaterialStatsDto;
  reservations: ReservationStatsDto;
  impact: ImpactStatsDto;
  reviews: ReviewStatsDto;
  notifications: NotificationStatsDto;
};

export type RecentMaterialDto = {
  id: string;
  title: string;
  status: string;
  quantity: number;
  unit: string;
  viewsCount: number;
  categoryName: string | null;
  coverImageUrl: string | null;
  createdAt: string;
};

export type UpcomingPickupDto = {
  id: string;
  materialTitle: string;
  requesterName: string;
  quantityRequested: number;
  pickupWindowStart: string | null;
  pickupWindowEnd: string | null;
};

export type RecentActivityDto = {
  id: string;
  type: 'NOTIFICATION' | 'RESERVATION';
  title: string;
  body: string;
  createdAt: string;
};

export type SupplierDashboardDto = {
  hasSupplierProfile: boolean;
  message?: string;
  supplier?: SupplierSummaryDto;
  stats: DashboardStatsDto;
  recentMaterials: RecentMaterialDto[];
  upcomingPickups: UpcomingPickupDto[];
  recentActivity: RecentActivityDto[];
};

export const emptyMaterialStats = (): MaterialStatsDto => ({
  total: 0,
  available: 0,
  pendingReservation: 0,
  reserved: 0,
  reused: 0,
  unavailable: 0,
});

export const emptyReservationStats = (): ReservationStatsDto => ({
  pending: 0,
  accepted: 0,
  completed: 0,
  rejected: 0,
  cancelled: 0,
  expired: 0,
});

export const emptyDashboardStats = (): DashboardStatsDto => ({
  materials: emptyMaterialStats(),
  reservations: emptyReservationStats(),
  impact: { reusedMaterials: 0, reusedQuantity: 0 },
  reviews: { averageRating: 0, totalReviews: 0 },
  notifications: { unread: 0 },
});

export const normalizeVerificationStatus = (status: string): string => {
  const normalized = normalizeSupplierVerificationStatus(status);
  return normalized === 'APPROVED' ? 'VERIFIED' : normalized;
};
