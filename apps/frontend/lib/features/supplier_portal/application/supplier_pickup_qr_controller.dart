import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/handover_verify_preview.dart';
import '../data/models/supplier_incoming_request.dart';
import '../data/supplier_requests_api_repository.dart';
import 'pickup_qr_payload.dart';

enum SupplierPickupQrPhase {
  scanning,
  verifying,
  verified,
  confirming,
  completed,
  error,
}

enum SupplierPickupQrErrorKind {
  invalidPayload,
  verifyFailed,
  confirmFailed,
  cameraPermission,
  cameraUnavailable,
}

class SupplierPickupQrState {
  const SupplierPickupQrState({
    this.phase = SupplierPickupQrPhase.scanning,
    this.scannedPayload,
    this.preview,
    this.completedReservation,
    this.errorKind,
    this.error,
  });

  final SupplierPickupQrPhase phase;
  final String? scannedPayload;
  final HandoverVerifyPreview? preview;
  final SupplierIncomingRequest? completedReservation;
  final SupplierPickupQrErrorKind? errorKind;
  final Object? error;

  bool get isBusy =>
      phase == SupplierPickupQrPhase.verifying ||
      phase == SupplierPickupQrPhase.confirming;

  bool get acceptsScans => phase == SupplierPickupQrPhase.scanning;

  SupplierPickupQrState copyWith({
    SupplierPickupQrPhase? phase,
    String? scannedPayload,
    HandoverVerifyPreview? preview,
    SupplierIncomingRequest? completedReservation,
    SupplierPickupQrErrorKind? errorKind,
    Object? error,
    bool clearError = false,
    bool clearPreview = false,
    bool clearPayload = false,
    bool clearCompleted = false,
  }) {
    return SupplierPickupQrState(
      phase: phase ?? this.phase,
      scannedPayload: clearPayload ? null : (scannedPayload ?? this.scannedPayload),
      preview: clearPreview ? null : (preview ?? this.preview),
      completedReservation: clearCompleted
          ? null
          : (completedReservation ?? this.completedReservation),
      errorKind: clearError ? null : (errorKind ?? this.errorKind),
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// Scan → verify → preview → confirm state machine with a hard scan lock.
class SupplierPickupQrController extends Notifier<SupplierPickupQrState> {
  var _confirmInFlight = false;

  @override
  SupplierPickupQrState build() => const SupplierPickupQrState();

  /// Injected scan event (camera or tests). Duplicate frames are ignored while locked.
  Future<void> onCodeDetected(String raw) async {
    if (!state.acceptsScans) return;

    final payload = raw.trim();
    if (!looksLikeImpactLoopPickupQr(payload)) {
      state = state.copyWith(
        phase: SupplierPickupQrPhase.error,
        errorKind: SupplierPickupQrErrorKind.invalidPayload,
        clearPreview: true,
        clearPayload: true,
      );
      return;
    }

    state = state.copyWith(
      phase: SupplierPickupQrPhase.verifying,
      scannedPayload: payload,
      clearError: true,
      clearPreview: true,
      clearCompleted: true,
    );

    try {
      final preview = await ref
          .read(supplierRequestsRepositoryProvider)
          .verifyHandoverCredential(payload);
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: SupplierPickupQrPhase.verified,
        preview: preview,
        scannedPayload: payload,
        clearError: true,
      );
    } catch (error) {
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: SupplierPickupQrPhase.error,
        errorKind: SupplierPickupQrErrorKind.verifyFailed,
        error: error,
        clearPreview: true,
      );
    }
  }

  Future<void> confirmHandover() async {
    if (_confirmInFlight) return;
    if (state.phase != SupplierPickupQrPhase.verified) return;

    final payload = state.scannedPayload;
    if (payload == null || payload.isEmpty) return;

    _confirmInFlight = true;
    state = state.copyWith(
      phase: SupplierPickupQrPhase.confirming,
      clearError: true,
    );

    try {
      final completed = await ref
          .read(supplierRequestsRepositoryProvider)
          .confirmHandoverCredential(payload);
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: SupplierPickupQrPhase.completed,
        completedReservation: completed,
        clearError: true,
      );
    } catch (error) {
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: SupplierPickupQrPhase.error,
        errorKind: SupplierPickupQrErrorKind.confirmFailed,
        error: error,
      );
    } finally {
      _confirmInFlight = false;
    }
  }

  void resumeScanning() {
    _confirmInFlight = false;
    state = const SupplierPickupQrState();
  }

  void markCameraPermissionDenied() {
    state = state.copyWith(
      phase: SupplierPickupQrPhase.error,
      errorKind: SupplierPickupQrErrorKind.cameraPermission,
      clearPreview: true,
      clearPayload: true,
    );
  }

  void markCameraUnavailable() {
    state = state.copyWith(
      phase: SupplierPickupQrPhase.error,
      errorKind: SupplierPickupQrErrorKind.cameraUnavailable,
      clearPreview: true,
      clearPayload: true,
    );
  }
}

final supplierPickupQrControllerProvider =
    NotifierProvider.autoDispose<SupplierPickupQrController, SupplierPickupQrState>(
      SupplierPickupQrController.new,
    );
