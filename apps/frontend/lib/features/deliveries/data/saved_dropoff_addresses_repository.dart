import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/saved_dropoff_address.dart';
import 'saved_dropoff_addresses_api.dart';

final savedDropoffAddressesApiProvider = Provider<SavedDropoffAddressesApi>(
  (ref) => SavedDropoffAddressesApi(ref.watch(apiClientProvider)),
);

final savedDropoffAddressesRepositoryProvider =
    Provider<SavedDropoffAddressesRepository>(
  (ref) => SavedDropoffAddressesRepository(
    ref.watch(savedDropoffAddressesApiProvider),
  ),
);

class SavedDropoffAddressesRepository {
  const SavedDropoffAddressesRepository(this._api);

  final SavedDropoffAddressesApi _api;

  Future<List<SavedDropoffAddress>> fetchSavedAddresses() {
    return _api.fetchSavedAddresses();
  }

  Future<SavedDropoffAddress> createSavedAddress({
    required String label,
    required SavedDropoffLocation location,
    bool isDefault = false,
  }) {
    return _api.createSavedAddress(
      label: label,
      location: location,
      isDefault: isDefault,
    );
  }

  Future<SavedDropoffAddress> updateSavedAddress(
    String id, {
    String? label,
    SavedDropoffLocation? location,
    bool? isDefault,
  }) {
    return _api.updateSavedAddress(
      id,
      label: label,
      location: location,
      isDefault: isDefault,
    );
  }

  Future<void> deleteSavedAddress(String id) {
    return _api.deleteSavedAddress(id);
  }
}

final savedDropoffAddressesProvider =
    FutureProvider<List<SavedDropoffAddress>>((ref) {
  return ref.watch(savedDropoffAddressesRepositoryProvider).fetchSavedAddresses();
});
