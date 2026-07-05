import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/saved_location.dart';
import '../data/saved_locations_api.dart';

final savedLocationsApiProvider = Provider<SavedLocationsApi>((ref) {
  return SavedLocationsApi(ref.watch(apiClientProvider));
});

final savedLocationsProvider = FutureProvider<List<SavedLocation>>((ref) {
  return ref.watch(savedLocationsApiProvider).fetchSavedLocations();
});

final savedLocationsControllerProvider =
    NotifierProvider<SavedLocationsController, AsyncValue<void>>(
      SavedLocationsController.new,
    );

class SavedLocationsController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  Future<void> create(SavedLocationPayload payload) async {
    await _runMutation(
      () => ref.read(savedLocationsApiProvider).createSavedLocation(payload),
    );
  }

  Future<void> update(String id, SavedLocationPayload payload) async {
    await _runMutation(
      () =>
          ref.read(savedLocationsApiProvider).updateSavedLocation(id, payload),
    );
  }

  Future<void> setDefault(String id) async {
    await _runMutation(
      () => ref.read(savedLocationsApiProvider).setDefaultSavedLocation(id),
    );
  }

  Future<void> delete(String id) async {
    await _runMutation(
      () => ref.read(savedLocationsApiProvider).deleteSavedLocation(id),
    );
  }

  Future<void> _runMutation(Future<Object?> Function() mutation) async {
    state = const AsyncLoading();
    try {
      await mutation();
      ref.invalidate(savedLocationsProvider);
      state = const AsyncData(null);
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }
}
