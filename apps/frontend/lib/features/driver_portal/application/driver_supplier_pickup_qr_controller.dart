import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/driver_deliveries_repository.dart';
import '../data/models/driver_delivery.dart';
import '../data/models/supplier_pickup_handover_verify_preview.dart';
import 'supplier_pickup_handover_qr_payload.dart';

enum DriverSupplierPickupQrPhase {
  scanning,
  verifying,
  verified,
  confirming,
  completed,
  error,
}

enum DriverSupplierPickupQrErrorKind {
  invalidPayload,
  verifyFailed,
  confirmFailed,
  cameraPermission,
  cameraUnavailable,
}

class DriverSupplierPickupQrState {
  const DriverSupplierPickupQrState({
    this.phase = DriverSupplierPickupQrPhase.scanning,
    this.scannedPayload,
    this.preview,
    this.completedDelivery,
    this.errorKind,
    this.error,
  });

  final DriverSupplierPickupQrPhase phase;
  final String? scannedPayload;
  final SupplierPickupHandoverVerifyPreview? preview;
  final DriverDelivery? completedDelivery;
  final DriverSupplierPickupQrErrorKind? errorKind;
  final Object? error;

  bool get isBusy =>
      phase == DriverSupplierPickupQrPhase.verifying ||
      phase == DriverSupplierPickupQrPhase.confirming;

  bool get acceptsScans => phase == DriverSupplierPickupQrPhase.scanning;

  DriverSupplierPickupQrState copyWith({
    DriverSupplierPickupQrPhase? phase,
    String? scannedPayload,
    SupplierPickupHandoverVerifyPreview? preview,
    DriverDelivery? completedDelivery,
    DriverSupplierPickupQrErrorKind? errorKind,
    Object? error,
    bool clearError = false,
    bool clearPreview = false,
    bool clearPayload = false,
    bool clearCompleted = false,
  }) {
    return DriverSupplierPickupQrState(
      phase: phase ?? this.phase,
      scannedPayload:
          clearPayload ? null : (scannedPayload ?? this.scannedPayload),
      preview: clearPreview ? null : (preview ?? this.preview),
      completedDelivery: clearCompleted
          ? null
          : (completedDelivery ?? this.completedDelivery),
      errorKind: clearError ? null : (errorKind ?? this.errorKind),
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// Scan → verify → preview → confirm state machine with a hard scan lock.
class DriverSupplierPickupQrController
    extends Notifier<DriverSupplierPickupQrState> {
  var _confirmInFlight = false;

  @override
  DriverSupplierPickupQrState build() => const DriverSupplierPickupQrState();

  Future<void> onCodeDetected(String raw) async {
    if (!state.acceptsScans) return;

    final payload = raw.trim();
    if (!looksLikeImpactLoopSupplierPickupHandoverQr(payload)) {
      state = state.copyWith(
        phase: DriverSupplierPickupQrPhase.error,
        errorKind: DriverSupplierPickupQrErrorKind.invalidPayload,
        clearPreview: true,
        clearPayload: true,
      );
      return;
    }

    state = state.copyWith(
      phase: DriverSupplierPickupQrPhase.verifying,
      scannedPayload: payload,
      clearError: true,
      clearPreview: true,
      clearCompleted: true,
    );

    try {
      final preview = await ref
          .read(driverDeliveriesRepositoryProvider)
          .verifySupplierPickupHandoverCredential(payload);
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: DriverSupplierPickupQrPhase.verified,
        preview: preview,
        scannedPayload: payload,
        clearError: true,
      );
    } catch (error) {
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: DriverSupplierPickupQrPhase.error,
        errorKind: DriverSupplierPickupQrErrorKind.verifyFailed,
        error: error,
        clearPreview: true,
      );
    }
  }

  Future<void> confirmPickup() async {
    if (_confirmInFlight) return;
    if (state.phase != DriverSupplierPickupQrPhase.verified) return;

    final payload = state.scannedPayload;
    if (payload == null || payload.isEmpty) return;

    _confirmInFlight = true;
    state = state.copyWith(
      phase: DriverSupplierPickupQrPhase.confirming,
      clearError: true,
    );

    try {
      final completed = await ref
          .read(driverDeliveriesRepositoryProvider)
          .confirmSupplierPickupHandoverCredential(payload);
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: DriverSupplierPickupQrPhase.completed,
        completedDelivery: completed,
        clearError: true,
      );
    } catch (error) {
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: DriverSupplierPickupQrPhase.error,
        errorKind: DriverSupplierPickupQrErrorKind.confirmFailed,
        error: error,
      );
    } finally {
      _confirmInFlight = false;
    }
  }

  void resumeScanning() {
    _confirmInFlight = false;
    state = const DriverSupplierPickupQrState();
  }

  void markCameraPermissionDenied() {
    state = state.copyWith(
      phase: DriverSupplierPickupQrPhase.error,
      errorKind: DriverSupplierPickupQrErrorKind.cameraPermission,
      clearPreview: true,
      clearPayload: true,
    );
  }

  void markCameraUnavailable() {
    state = state.copyWith(
      phase: DriverSupplierPickupQrPhase.error,
      errorKind: DriverSupplierPickupQrErrorKind.cameraUnavailable,
      clearPreview: true,
      clearPayload: true,
    );
  }
}

final driverSupplierPickupQrControllerProvider =
    NotifierProvider.autoDispose<
      DriverSupplierPickupQrController,
      DriverSupplierPickupQrState
    >(DriverSupplierPickupQrController.new);
