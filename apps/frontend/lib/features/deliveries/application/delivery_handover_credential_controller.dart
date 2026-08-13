import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/deliveries_repository.dart';
import '../data/models/delivery_handover_credential.dart';

enum DeliveryHandoverCredentialPhase { idle, loading, loaded, error }

class DeliveryHandoverCredentialUiState {
  const DeliveryHandoverCredentialUiState({
    this.phase = DeliveryHandoverCredentialPhase.idle,
    this.credential,
    this.error,
  });

  final DeliveryHandoverCredentialPhase phase;
  final DeliveryHandoverCredential? credential;
  final Object? error;

  bool get isLoading => phase == DeliveryHandoverCredentialPhase.loading;

  bool hasValidCredential([DateTime? now]) {
    final value = credential;
    if (value == null) return false;
    return !value.isExpiredAt(now);
  }

  bool get isExpired {
    final value = credential;
    if (value == null) return false;
    return value.isExpiredAt();
  }

  DeliveryHandoverCredentialUiState copyWith({
    DeliveryHandoverCredentialPhase? phase,
    DeliveryHandoverCredential? credential,
    Object? error,
    bool clearError = false,
    bool clearCredential = false,
  }) {
    return DeliveryHandoverCredentialUiState(
      phase: phase ?? this.phase,
      credential: clearCredential ? null : (credential ?? this.credential),
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// Family controller keyed by delivery id (constructor arg).
///
/// Issuance is explicit (`ensureIssued` / `reissue`). Rebuilds and repeated
/// `ensureIssued` calls reuse a still-valid local credential and never POST
/// again while loading.
class DeliveryHandoverCredentialController
    extends Notifier<DeliveryHandoverCredentialUiState> {
  DeliveryHandoverCredentialController(this.deliveryId);

  final String deliveryId;

  @override
  DeliveryHandoverCredentialUiState build() {
    return const DeliveryHandoverCredentialUiState();
  }

  /// Ensures a usable credential exists without reissuing on rebuilds.
  Future<void> ensureIssued() async {
    if (state.isLoading) return;
    if (state.hasValidCredential()) return;
    await _issue(force: false);
  }

  /// Forces a new backend credential (invalidates any prior QR).
  Future<void> reissue() async {
    if (state.isLoading) return;
    await _issue(force: true);
  }

  Future<void> _issue({required bool force}) async {
    if (state.isLoading) return;
    if (!force && state.hasValidCredential()) return;

    state = state.copyWith(
      phase: DeliveryHandoverCredentialPhase.loading,
      clearError: true,
    );

    try {
      final credential = await ref
          .read(deliveriesRepositoryProvider)
          .issueDeliveryHandoverCredential(deliveryId);
      if (!ref.mounted) return;
      state = DeliveryHandoverCredentialUiState(
        phase: DeliveryHandoverCredentialPhase.loaded,
        credential: credential,
      );
    } catch (error) {
      if (!ref.mounted) return;
      state = DeliveryHandoverCredentialUiState(
        phase: DeliveryHandoverCredentialPhase.error,
        credential: state.credential,
        error: error,
      );
    }
  }

  /// Marks a locally held credential as expired without calling the API.
  void markExpiredIfNeeded([DateTime? now]) {
    final credential = state.credential;
    if (credential == null) return;
    if (!credential.isExpiredAt(now)) return;
    if (state.phase == DeliveryHandoverCredentialPhase.error &&
        state.error == 'EXPIRED') {
      return;
    }
    state = state.copyWith(
      phase: DeliveryHandoverCredentialPhase.error,
      error: 'EXPIRED',
    );
  }
}

final deliveryHandoverCredentialControllerProvider = NotifierProvider
    .autoDispose
    .family<
      DeliveryHandoverCredentialController,
      DeliveryHandoverCredentialUiState,
      String
    >(DeliveryHandoverCredentialController.new);
