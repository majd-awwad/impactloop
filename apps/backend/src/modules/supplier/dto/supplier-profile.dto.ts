export type SupplierProfileUserDto = {
  id: string;
  displayName: string;
  email: string;
  profileImageUrl: string | null;
};

export type SupplierProfileLocationDto = {
  id: string;
  country: string;
  city: string;
  area: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  visibility: string | null;
  isApproximate: boolean;
  locationType: string | null;
};

export type SupplierOrganizationProfileDto = {
  id: string;
  organizationName: string;
  organizationType: string;
  contactPersonName: string | null;
  workingDays: unknown;
  workingHours: unknown;
  verificationDocumentStatus: string | null;
  verificationDocumentUrl: string | null;
  verificationDocumentName: string | null;
  businessLocation: SupplierProfileLocationDto | null;
};

export type SupplierProfileDetailsDto = {
  id: string;
  publicName: string;
  supplierType: string;
  description: string | null;
  coverImageUrl: string | null;
  avatarImageUrl: string | null;
  verificationStatus: string;
  verificationAdminNote: string | null;
  verificationReviewedAt: string | null;
  defaultPickupLocation: SupplierProfileLocationDto | null;
  organizationProfile: SupplierOrganizationProfileDto | null;
};

export type SupplierFollowerListItemDto = {
  user: {
    id: string;
    displayName: string;
    email: string;
    profileImageUrl: string | null;
  };
  followedAt: string;
};

export type SupplierProfileMaterialPreviewDto = {
  id: string;
  title: string;
  imageUrl: string | null;
  category: {
    id: string;
    nameEn: string;
    nameAr: string;
  } | null;
  status: string;
  condition: string;
  isFree: boolean;
  price: number | null;
  currency: string;
  quantity: number;
  unit: string;
  location: {
    city: string;
    area: string | null;
  } | null;
  pickupNotes: string | null;
  pickupAllowed: boolean;
  deliveryAllowed: boolean;
  createdAt: string;
  viewsCount: number;
  likesCount: number;
  reservationsCount: number;
};

export type SupplierProfileStatsDto = {
  materialsCount: number;
  availableMaterialsCount: number;
  reusedMaterialsCount: number;
  followersCount: number;
  totalViews: number;
  totalLikes: number;
  totalReservations: number;
};

export type SupplierProfileResponseDto = {
  hasSupplierProfile: boolean;
  user: SupplierProfileUserDto;
  supplier: SupplierProfileDetailsDto | null;
  stats: SupplierProfileStatsDto;
  latestFollowers: SupplierFollowerListItemDto[];
  materialsPreview: SupplierProfileMaterialPreviewDto[];
};
