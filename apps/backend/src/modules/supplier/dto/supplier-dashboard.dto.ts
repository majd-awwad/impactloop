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

export type EngagementStatsDto = {
  totalViews: number;
  totalLikes: number;
  followersCount: number;
};

export type OperationalStatsDto = {
  scheduledPickups: number;
  activeMaterials: number;
};

export type DashboardStatsDto = {
  materials: MaterialStatsDto;
  reservations: ReservationStatsDto;
  impact: ImpactStatsDto;
  reviews: ReviewStatsDto;
  notifications: NotificationStatsDto;
  engagement: EngagementStatsDto;
  operational: OperationalStatsDto;
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

export type RecentReservationRequestDto = {
  id: string;
  materialId: string;
  materialTitle: string;
  requesterName: string | null;
  status: string;
  quantityRequested: number;
  requestedAt: string;
};

export type DashboardMaterialInsightDto = {
  id: string;
  title: string;
  status: string;
  categoryName: string | null;
  coverImageUrl: string | null;
  viewsCount: number;
  demandCount: number;
};

export type LatestSupportedProjectDto = {
  projectId: string;
  title: string;
  categoryName: string | null;
  completedAt: string;
};

export type ProjectSupportStatsDto = {
  projectsSupported: number;
  projectComponentsSupported: number;
  learnerBuildsHelped: number;
  completedLinkedReservations: number;
  latestSupportedProjects: LatestSupportedProjectDto[];
};

export const emptyProjectSupportStats = (): ProjectSupportStatsDto => ({
  projectsSupported: 0,
  projectComponentsSupported: 0,
  learnerBuildsHelped: 0,
  completedLinkedReservations: 0,
  latestSupportedProjects: [],
});

export type SupplierDashboardDto = {
  hasSupplierProfile: boolean;
  message?: string;
  supplier?: SupplierSummaryDto;
  stats: DashboardStatsDto;
  projectSupport: ProjectSupportStatsDto;
  recentMaterials: RecentMaterialDto[];
  upcomingPickups: UpcomingPickupDto[];
  recentActivity: RecentActivityDto[];
  recentReservationRequests: RecentReservationRequestDto[];
  mostViewedMaterial: DashboardMaterialInsightDto | null;
  highDemandMaterials: DashboardMaterialInsightDto[];
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

export const emptyEngagementStats = (): EngagementStatsDto => ({
  totalViews: 0,
  totalLikes: 0,
  followersCount: 0,
});

export const emptyOperationalStats = (): OperationalStatsDto => ({
  scheduledPickups: 0,
  activeMaterials: 0,
});

export const emptyDashboardStats = (): DashboardStatsDto => ({
  materials: emptyMaterialStats(),
  reservations: emptyReservationStats(),
  impact: { reusedMaterials: 0, reusedQuantity: 0 },
  reviews: { averageRating: 0, totalReviews: 0 },
  notifications: { unread: 0 },
  engagement: emptyEngagementStats(),
  operational: emptyOperationalStats(),
});

export const normalizeVerificationStatus = (status: string): string => {
  const normalized = normalizeSupplierVerificationStatus(status);
  return normalized === 'APPROVED' ? 'VERIFIED' : normalized;
};
