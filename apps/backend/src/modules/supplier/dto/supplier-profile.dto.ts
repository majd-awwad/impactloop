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
  verificationStatus: string;
  verificationAdminNote: string | null;
  defaultPickupLocation: SupplierProfileLocationDto | null;
  organizationProfile: SupplierOrganizationProfileDto | null;
};

export type SupplierProfileResponseDto = {
  hasSupplierProfile: boolean;
  user: SupplierProfileUserDto;
  supplier: SupplierProfileDetailsDto | null;
};
