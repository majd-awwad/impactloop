import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/driver_deliveries_repository.dart';
import '../data/models/delivery_handover_verify_preview.dart';
import '../data/models/driver_delivery.dart';
import 'delivery_handover_qr_payload.dart';

enum DriverDeliveryQrPhase {
  scanning,
  verifying,
  verified,
  confirming,
  completed,
  error,
}

enum DriverDeliveryQrErrorKind {
  invalidPayload,
  verifyFailed,
  confirmFailed,
  cameraPermission,
  cameraUnavailable,
}

class DriverDeliveryQrState {
  const DriverDeliveryQrState({
    this.phase = DriverDeliveryQrPhase.scanning,
    this.scannedPayload,
    this.preview,
    this.completedDelivery,
    this.errorKind,
    this.error,
  });

  final DriverDeliveryQrPhase phase;
  final String? scannedPayload;
  final DeliveryHandoverVerifyPreview? preview;
  final DriverDelivery? completedDelivery;
  final DriverDeliveryQrErrorKind? errorKind;
  final Object? error;

  bool get isBusy =>
      phase == DriverDeliveryQrPhase.verifying ||
      phase == DriverDeliveryQrPhase.confirming;

  bool get acceptsScans => phase == DriverDeliveryQrPhase.scanning;

  DriverDeliveryQrState copyWith({
    DriverDeliveryQrPhase? phase,
    String? scannedPayload,
    DeliveryHandoverVerifyPreview? preview,
    DriverDelivery? completedDelivery,
    DriverDeliveryQrErrorKind? errorKind,
    Object? error,
    bool clearError = false,
    bool clearPreview = false,
    bool clearPayload = false,
    bool clearCompleted = false,
  }) {
    return DriverDeliveryQrState(
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
class DriverDeliveryQrController extends Notifier<DriverDeliveryQrState> {
  var _confirmInFlight = false;

  @override
  DriverDeliveryQrState build() => const DriverDeliveryQrState();

  /// Injected scan event (camera or tests). Duplicate frames are ignored while locked.
  Future<void> onCodeDetected(String raw) async {
    if (!state.acceptsScans) return;

    final payload = raw.trim();
    if (!looksLikeImpactLoopDeliveryHandoverQr(payload)) {
      state = state.copyWith(
        phase: DriverDeliveryQrPhase.error,
        errorKind: DriverDeliveryQrErrorKind.invalidPayload,
        clearPreview: true,
        clearPayload: true,
      );
      return;
    }

    state = state.copyWith(
      phase: DriverDeliveryQrPhase.verifying,
      scannedPayload: payload,
      clearError: true,
      clearPreview: true,
      clearCompleted: true,
    );

    try {
      final preview = await ref
          .read(driverDeliveriesRepositoryProvider)
          .verifyDeliveryHandoverCredential(payload);
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: DriverDeliveryQrPhase.verified,
        preview: preview,
        scannedPayload: payload,
        clearError: true,
      );
    } catch (error) {
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: DriverDeliveryQrPhase.error,
        errorKind: DriverDeliveryQrErrorKind.verifyFailed,
        error: error,
        clearPreview: true,
      );
    }
  }

  Future<void> confirmHandover() async {
    if (_confirmInFlight) return;
    if (state.phase != DriverDeliveryQrPhase.verified) return;

    final payload = state.scannedPayload;
    if (payload == null || payload.isEmpty) return;

    _confirmInFlight = true;
    state = state.copyWith(
      phase: DriverDeliveryQrPhase.confirming,
      clearError: true,
    );

    try {
      final completed = await ref
          .read(driverDeliveriesRepositoryProvider)
          .confirmDeliveryHandoverCredential(payload);
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: DriverDeliveryQrPhase.completed,
        completedDelivery: completed,
        clearError: true,
      );
    } catch (error) {
      if (!ref.mounted) return;
      state = state.copyWith(
        phase: DriverDeliveryQrPhase.error,
        errorKind: DriverDeliveryQrErrorKind.confirmFailed,
        error: error,
      );
    } finally {
      _confirmInFlight = false;
    }
  }

  void resumeScanning() {
    _confirmInFlight = false;
    state = const DriverDeliveryQrState();
  }

  void markCameraPermissionDenied() {
    state = state.copyWith(
      phase: DriverDeliveryQrPhase.error,
      errorKind: DriverDeliveryQrErrorKind.cameraPermission,
      clearPreview: true,
      clearPayload: true,
    );
  }

  void markCameraUnavailable() {
    state = state.copyWith(
      phase: DriverDeliveryQrPhase.error,
      errorKind: DriverDeliveryQrErrorKind.cameraUnavailable,
      clearPreview: true,
      clearPayload: true,
    );
  }
}

final driverDeliveryQrControllerProvider =
    NotifierProvider.autoDispose<DriverDeliveryQrController, DriverDeliveryQrState>(
      DriverDeliveryQrController.new,
    );
