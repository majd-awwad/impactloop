import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'driver_profile_api.dart';
import 'models/driver_operational_profile.dart';

final driverProfileApiProvider = Provider<DriverProfileApi>((ref) {
  return DriverProfileApi(ref.read(apiClientProvider));
});

final driverProfileRepositoryProvider = Provider<DriverProfileRepository>((
  ref,
) {
  return DriverProfileRepository(ref.read(driverProfileApiProvider));
});

class DriverProfileRepository {
  const DriverProfileRepository(this._api);

  final DriverProfileApi _api;

  Future<DriverOperationalProfile> fetchProfile() => _api.fetchProfile();

  Future<DriverOperationalProfile> updateProfile(
    UpdateDriverOperationalProfileRequest request,
  ) => _api.updateProfile(request);

  Future<DriverOperationalProfile> updateAvailability(bool acceptingNewJobs) {
    return _api.updateAvailability(
      UpdateDriverAvailabilityRequest(acceptingNewJobs: acceptingNewJobs),
    );
  }
}
