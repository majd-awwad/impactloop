import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../data/driver_profile_repository.dart';
import '../data/models/driver_operational_profile.dart';
import 'driver_deliveries_provider.dart';

class DriverProfileState {
  const DriverProfileState({
    required this.profile,
    this.isSaving = false,
    this.isUpdatingAvailability = false,
    this.saveError,
    this.availabilityError,
    this.saveSucceeded = false,
  });

  final DriverOperationalProfile profile;
  final bool isSaving;
  final bool isUpdatingAvailability;
  final ApiException? saveError;
  final ApiException? availabilityError;
  final bool saveSucceeded;

  bool get isMutating => isSaving || isUpdatingAvailability;

  DriverProfileState copyWith({
    DriverOperationalProfile? profile,
    bool? isSaving,
    bool? isUpdatingAvailability,
    ApiException? saveError,
    bool clearSaveError = false,
    ApiException? availabilityError,
    bool clearAvailabilityError = false,
    bool? saveSucceeded,
  }) {
    return DriverProfileState(
      profile: profile ?? this.profile,
      isSaving: isSaving ?? this.isSaving,
      isUpdatingAvailability:
          isUpdatingAvailability ?? this.isUpdatingAvailability,
      saveError: clearSaveError ? null : (saveError ?? this.saveError),
      availabilityError: clearAvailabilityError
          ? null
          : (availabilityError ?? this.availabilityError),
      saveSucceeded: saveSucceeded ?? this.saveSucceeded,
    );
  }
}

class DriverProfileNotifier extends AsyncNotifier<DriverProfileState> {
  int _mutationGeneration = 0;

  @override
  Future<DriverProfileState> build() async {
    _mutationGeneration += 1;
    final profile = await ref
        .read(driverProfileRepositoryProvider)
        .fetchProfile();
    return DriverProfileState(profile: profile);
  }

  Future<bool> saveProfile(
    UpdateDriverOperationalProfileRequest request,
  ) async {
    final current = state.value;
    if (current == null ||
        current.isMutating ||
        !current.profile.isAdministrativelyActive) {
      return false;
    }

    final operationGeneration = ++_mutationGeneration;

    state = AsyncData(
      current.copyWith(
        isSaving: true,
        clearSaveError: true,
        saveSucceeded: false,
      ),
    );

    try {
      final updated = await ref
          .read(driverProfileRepositoryProvider)
          .updateProfile(request);
      final latest = _latestForOperation(operationGeneration);
      if (latest == null || !latest.isSaving) {
        return false;
      }
      state = AsyncData(
        latest.copyWith(
          profile: updated,
          isSaving: false,
          clearSaveError: true,
          saveSucceeded: true,
        ),
      );
      ref.invalidate(availableDriverDeliveriesProvider);
      ref.invalidate(activeDriverDeliveriesProvider);
      return true;
    } catch (error) {
      final latest = _latestForOperation(operationGeneration);
      if (latest == null || !latest.isSaving) {
        return false;
      }
      state = AsyncData(
        latest.copyWith(
          isSaving: false,
          saveError: normalizeApiException(error),
          saveSucceeded: false,
        ),
      );
      return false;
    }
  }

  Future<bool> setAcceptingNewJobs(bool acceptingNewJobs) async {
    final current = state.value;
    if (current == null ||
        current.isMutating ||
        !current.profile.isAdministrativelyActive ||
        current.profile.acceptingNewJobs == acceptingNewJobs) {
      return false;
    }

    final operationGeneration = ++_mutationGeneration;

    state = AsyncData(
      current.copyWith(
        isUpdatingAvailability: true,
        clearAvailabilityError: true,
      ),
    );

    try {
      final updated = await ref
          .read(driverProfileRepositoryProvider)
          .updateAvailability(acceptingNewJobs);
      final latest = _latestForOperation(operationGeneration);
      if (latest == null || !latest.isUpdatingAvailability) {
        return false;
      }
      state = AsyncData(
        latest.copyWith(
          profile: updated,
          isUpdatingAvailability: false,
          clearAvailabilityError: true,
        ),
      );
      ref.invalidate(availableDriverDeliveriesProvider);
      ref.invalidate(activeDriverDeliveriesProvider);
      return true;
    } catch (error) {
      final latest = _latestForOperation(operationGeneration);
      if (latest == null || !latest.isUpdatingAvailability) {
        return false;
      }
      state = AsyncData(
        latest.copyWith(
          isUpdatingAvailability: false,
          availabilityError: normalizeApiException(error),
        ),
      );
      return false;
    }
  }

  DriverProfileState? _latestForOperation(int operationGeneration) {
    if (!ref.mounted || operationGeneration != _mutationGeneration) {
      return null;
    }
    return state.value;
  }

  void clearActionFeedback() {
    final current = state.value;
    if (current == null) return;
    state = AsyncData(
      current.copyWith(
        clearSaveError: true,
        clearAvailabilityError: true,
        saveSucceeded: false,
      ),
    );
  }
}

final driverProfileProvider =
    AsyncNotifierProvider<DriverProfileNotifier, DriverProfileState>(
      DriverProfileNotifier.new,
    );
