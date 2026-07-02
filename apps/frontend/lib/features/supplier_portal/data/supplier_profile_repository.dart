import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'locations_api.dart';
import 'models/reverse_geocode_result.dart';
import 'models/supplier_profile.dart';
import 'models/update_supplier_profile_request.dart';
import 'models/update_supplier_profile_images_request.dart';
import 'supplier_profile_api.dart';

final supplierProfileApiProvider = Provider<SupplierProfileApi>((ref) {
  return SupplierProfileApi(ref.watch(apiClientProvider));
});

final locationsApiProvider = Provider<LocationsApi>((ref) {
  return LocationsApi(ref.watch(apiClientProvider));
});

final supplierProfileRepositoryProvider = Provider<SupplierProfileRepository>((
  ref,
) {
  return SupplierProfileRepository(
    ref.watch(supplierProfileApiProvider),
    ref.watch(locationsApiProvider),
  );
});

class SupplierProfileRepository {
  const SupplierProfileRepository(this._profileApi, this._locationsApi);

  final SupplierProfileApi _profileApi;
  final LocationsApi _locationsApi;

  Future<SupplierProfileResponse> fetchProfile() => _profileApi.fetchProfile();

  Future<SupplierProfileResponse> updateProfile(
    UpdateSupplierProfileRequest request,
  ) {
    return _profileApi.updateProfile(request);
  }

  Future<SupplierProfileResponse> updateProfileImages(
    UpdateSupplierProfileImagesRequest request,
  ) {
    return _profileApi.updateProfileImages(request);
  }

  Future<ReverseGeocodeResult> reverseGeocode({
    required double latitude,
    required double longitude,
  }) {
    return _locationsApi.reverseGeocode(
      latitude: latitude,
      longitude: longitude,
    );
  }
}
