import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/handover_credential.dart';
import '../data/reservations_repository.dart';

enum HandoverCredentialPhase { idle, loading, loaded, error }

class HandoverCredentialUiState {
  const HandoverCredentialUiState({
    this.phase = HandoverCredentialPhase.idle,
    this.credential,
    this.error,
  });

  final HandoverCredentialPhase phase;
  final HandoverCredential? credential;
  final Object? error;

  bool get isLoading => phase == HandoverCredentialPhase.loading;

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

  HandoverCredentialUiState copyWith({
    HandoverCredentialPhase? phase,
    HandoverCredential? credential,
    Object? error,
    bool clearError = false,
    bool clearCredential = false,
  }) {
    return HandoverCredentialUiState(
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
class HandoverCredentialController extends Notifier<HandoverCredentialUiState> {
  HandoverCredentialController(this.reservationId);

  final String reservationId;

  @override
  HandoverCredentialUiState build() {
    return const HandoverCredentialUiState();
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
      phase: HandoverCredentialPhase.loading,
      clearError: true,
    );

    try {
      final credential = await ref
          .read(reservationsRepositoryProvider)
          .issueHandoverCredential(reservationId);
      if (!ref.mounted) return;
      state = HandoverCredentialUiState(
        phase: HandoverCredentialPhase.loaded,
        credential: credential,
      );
    } catch (error) {
      if (!ref.mounted) return;
      state = HandoverCredentialUiState(
        phase: HandoverCredentialPhase.error,
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
    if (state.phase == HandoverCredentialPhase.error &&
        state.error == 'EXPIRED') {
      return;
    }
    state = state.copyWith(
      phase: HandoverCredentialPhase.error,
      error: 'EXPIRED',
    );
  }
}

final handoverCredentialControllerProvider = NotifierProvider.autoDispose
    .family<HandoverCredentialController, HandoverCredentialUiState, String>(
      HandoverCredentialController.new,
    );
