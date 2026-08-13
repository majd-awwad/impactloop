import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../reservations/data/models/handover_credential.dart';
import '../data/supplier_requests_api_repository.dart';

enum SupplierDriverPickupHandoverCredentialPhase {
  idle,
  loading,
  loaded,
  error,
}

class SupplierDriverPickupHandoverCredentialUiState {
  const SupplierDriverPickupHandoverCredentialUiState({
    this.phase = SupplierDriverPickupHandoverCredentialPhase.idle,
    this.credential,
    this.error,
  });

  final SupplierDriverPickupHandoverCredentialPhase phase;
  final HandoverCredential? credential;
  final Object? error;

  bool get isLoading =>
      phase == SupplierDriverPickupHandoverCredentialPhase.loading;

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

  SupplierDriverPickupHandoverCredentialUiState copyWith({
    SupplierDriverPickupHandoverCredentialPhase? phase,
    HandoverCredential? credential,
    Object? error,
    bool clearError = false,
    bool clearCredential = false,
  }) {
    return SupplierDriverPickupHandoverCredentialUiState(
      phase: phase ?? this.phase,
      credential: clearCredential ? null : (credential ?? this.credential),
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// Family controller keyed by reservation id (constructor arg).
///
/// Issuance is explicit (`ensureIssued` / `reissue`). Rebuilds and repeated
/// `ensureIssued` calls reuse a still-valid local credential and never POST
/// again while loading.
class SupplierDriverPickupHandoverCredentialController
    extends Notifier<SupplierDriverPickupHandoverCredentialUiState> {
  SupplierDriverPickupHandoverCredentialController(this.reservationId);

  final String reservationId;

  @override
  SupplierDriverPickupHandoverCredentialUiState build() {
    return const SupplierDriverPickupHandoverCredentialUiState();
  }

  Future<void> ensureIssued() async {
    if (state.isLoading) return;
    if (state.hasValidCredential()) return;
    await _issue(force: false);
  }

  Future<void> reissue() async {
    if (state.isLoading) return;
    await _issue(force: true);
  }

  Future<void> _issue({required bool force}) async {
    if (state.isLoading) return;
    if (!force && state.hasValidCredential()) return;

    state = state.copyWith(
      phase: SupplierDriverPickupHandoverCredentialPhase.loading,
      clearError: true,
    );

    try {
      final credential = await ref
          .read(supplierRequestsRepositoryProvider)
          .issueDriverPickupHandoverCredential(reservationId);
      if (!ref.mounted) return;
      state = SupplierDriverPickupHandoverCredentialUiState(
        phase: SupplierDriverPickupHandoverCredentialPhase.loaded,
        credential: credential,
      );
    } catch (error) {
      if (!ref.mounted) return;
      state = SupplierDriverPickupHandoverCredentialUiState(
        phase: SupplierDriverPickupHandoverCredentialPhase.error,
        credential: state.credential,
        error: error,
      );
    }
  }

  void markExpiredIfNeeded([DateTime? now]) {
    final credential = state.credential;
    if (credential == null) return;
    if (!credential.isExpiredAt(now)) return;
    if (state.phase == SupplierDriverPickupHandoverCredentialPhase.error &&
        state.error == 'EXPIRED') {
      return;
    }
    state = state.copyWith(
      phase: SupplierDriverPickupHandoverCredentialPhase.error,
      error: 'EXPIRED',
    );
  }
}

final supplierDriverPickupHandoverCredentialControllerProvider =
    NotifierProvider.autoDispose
        .family<
          SupplierDriverPickupHandoverCredentialController,
          SupplierDriverPickupHandoverCredentialUiState,
          String
        >(SupplierDriverPickupHandoverCredentialController.new);
