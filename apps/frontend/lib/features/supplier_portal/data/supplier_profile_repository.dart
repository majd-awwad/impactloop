import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/supplier_profile.dart';
import 'models/update_supplier_profile_request.dart';
import 'supplier_profile_api.dart';

final supplierProfileApiProvider = Provider<SupplierProfileApi>((ref) {
  return SupplierProfileApi(ref.watch(apiClientProvider));
});

final supplierProfileRepositoryProvider = Provider<SupplierProfileRepository>((
  ref,
) {
  return SupplierProfileRepository(ref.watch(supplierProfileApiProvider));
});

class SupplierProfileRepository {
  const SupplierProfileRepository(this._api);

  final SupplierProfileApi _api;

  Future<SupplierProfileResponse> fetchProfile() => _api.fetchProfile();

  Future<SupplierProfileResponse> updateProfile(
    UpdateSupplierProfileRequest request,
  ) {
    return _api.updateProfile(request);
  }
}
