import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/handover/handover_qr_payload.dart';
import '../../../../shared/handover/handover_scanner_navigation.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../supplier_portal/presentation/controllers/supplier_requests_providers.dart';
import '../../application/driver_delivery_action_controller.dart';
import '../../application/driver_supplier_pickup_qr_controller.dart';
import '../../data/models/supplier_pickup_handover_verify_preview.dart';

enum SupplierPickupQrScanResult { completed, useManualCode, cancelled }

/// Full-screen driver supplier pickup QR scanner: scan → verify → preview → confirm.
class DriverSupplierPickupQrScannerPage extends ConsumerStatefulWidget {
  const DriverSupplierPickupQrScannerPage({
    super.key,
    this.initialPayload,
    this.closeFallbackRoute,
    this.manualCodeRoute,
  });

  final String? initialPayload;
  final String? closeFallbackRoute;
  final String? manualCodeRoute;

  static Future<SupplierPickupQrScanResult> open(BuildContext context) async {
    final result = await Navigator.of(context).push<SupplierPickupQrScanResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => const DriverSupplierPickupQrScannerPage(),
      ),
    );
    return result ?? SupplierPickupQrScanResult.cancelled;
  }

  @override
  ConsumerState<DriverSupplierPickupQrScannerPage> createState() =>
      _DriverSupplierPickupQrScannerPageState();
}

class _DriverSupplierPickupQrScannerPageState
    extends ConsumerState<DriverSupplierPickupQrScannerPage> {
  late final MobileScannerController _scannerController;
  var _handledCompletion = false;

  @override
  void initState() {
    super.initState();
    _scannerController = MobileScannerController(
      facing: kIsWeb ? CameraFacing.front : CameraFacing.back,
      detectionSpeed: DetectionSpeed.noDuplicates,
      formats: const [BarcodeFormat.qrCode],
    );
    final initialPayload = widget.initialPayload?.trim();
    if (initialPayload != null && initialPayload.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final controller = ref.read(
          driverSupplierPickupQrControllerProvider.notifier,
        );
        controller.resumeScanning();
        controller.onCodeDetected(initialPayload);
      });
    }
  }

  @override
  void didUpdateWidget(covariant DriverSupplierPickupQrScannerPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = widget.initialPayload?.trim() ?? '';
    final prev = oldWidget.initialPayload?.trim() ?? '';
    if (next.isEmpty || next == prev) return;
    final nextParsed = parseHandoverQr(next);
    final prevParsed = parseHandoverQr(prev);
    if (nextParsed != null &&
        prevParsed != null &&
        nextParsed.type == prevParsed.type &&
        nextParsed.token == prevParsed.token) {
      return;
    }
    _handledCompletion = false;
    final controller = ref.read(
      driverSupplierPickupQrControllerProvider.notifier,
    );
    controller.resumeScanning();
    controller.onCodeDetected(next);
  }

  bool get _fromDeepLink =>
      widget.initialPayload != null && widget.initialPayload!.trim().isNotEmpty;

  void _leave(SupplierPickupQrScanResult result) {
    closeHandoverScanner(
      context,
      result: result,
      closeFallbackRoute: widget.closeFallbackRoute,
      manualCodeRoute: widget.manualCodeRoute,
      isManualCode: result == SupplierPickupQrScanResult.useManualCode,
    );
  }

  void _retry() {
    final controller = ref.read(
      driverSupplierPickupQrControllerProvider.notifier,
    );
    controller.resumeScanning();
    final payload = widget.initialPayload?.trim();
    if (payload != null && payload.isNotEmpty) {
      controller.onCodeDetected(payload);
    }
  }

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _syncScannerWithPhase(DriverSupplierPickupQrPhase phase) async {
    try {
      if (phase == DriverSupplierPickupQrPhase.scanning) {
        if (!_scannerController.value.isRunning) {
          await _scannerController.start();
        }
      } else {
        if (_scannerController.value.isRunning) {
          await _scannerController.pause();
        }
      }
    } catch (_) {
      // Camera lifecycle errors are surfaced via onDetectError / error UI.
    }
  }

  void _onDetect(BarcodeCapture capture) {
    final controller = ref.read(driverSupplierPickupQrControllerProvider.notifier);
    if (!ref.read(driverSupplierPickupQrControllerProvider).acceptsScans) return;

    final raw = capture.barcodes
        .map((barcode) => barcode.rawValue?.trim() ?? '')
        .firstWhere((value) => value.isNotEmpty, orElse: () => '');
    if (raw.isEmpty) return;
    controller.onCodeDetected(raw);
  }

  Future<void> _handleCompleted(DriverSupplierPickupQrState state) async {
    if (_handledCompletion) return;
    _handledCompletion = true;

    final deliveryId =
        state.completedDelivery?.id ?? state.preview?.deliveryId;
    final reservationId = state.preview?.reservationId;

    invalidateDriverDeliverySyncProviders(
      ref,
      deliveryId: deliveryId,
      reservationId: reservationId,
    );
    invalidateReservationSyncProviders(
      ref,
      reservationId: reservationId,
    );
    if (!mounted) return;
    _leave(SupplierPickupQrScanResult.completed);
  }

  String _errorMessage(DriverSupplierPickupQrState state) {
    final l10n = context.l10n;
    switch (state.errorKind) {
      case DriverSupplierPickupQrErrorKind.invalidPayload:
        return l10n.driverSupplierPickupQrInvalidPayload;
      case DriverSupplierPickupQrErrorKind.cameraPermission:
        return l10n.driverSupplierPickupQrCameraPermissionRequired;
      case DriverSupplierPickupQrErrorKind.cameraUnavailable:
        return l10n.driverSupplierPickupQrCameraUnavailable;
      case DriverSupplierPickupQrErrorKind.verifyFailed:
      case DriverSupplierPickupQrErrorKind.confirmFailed:
        if (state.error != null) {
          return localizedApiErrorMessage(state.error!, l10n);
        }
        return state.errorKind == DriverSupplierPickupQrErrorKind.verifyFailed
            ? l10n.driverSupplierPickupQrVerifyFailed
            : l10n.driverSupplierPickupQrConfirmFailed;
      case null:
        return l10n.somethingWentWrong;
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final state = ref.watch(driverSupplierPickupQrControllerProvider);
    final controller = ref.read(driverSupplierPickupQrControllerProvider.notifier);

    ref.listen<DriverSupplierPickupQrState>(driverSupplierPickupQrControllerProvider, (
      previous,
      next,
    ) {
      if (!_fromDeepLink) {
        _syncScannerWithPhase(next.phase);
      }
      if (next.phase == DriverSupplierPickupQrPhase.completed) {
        _handleCompleted(next);
      }
    });

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        leading: AppBackAction(
          onBack: () async {
            _leave(SupplierPickupQrScanResult.cancelled);
          },
        ),
        title: Text(context.l10n.driverScanSupplierPickupQr),
      ),
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (!_fromDeepLink)
              MobileScanner(
                controller: _scannerController,
                onDetect: _onDetect,
                errorBuilder: (context, error) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    final code = error.errorCode;
                    if (code == MobileScannerErrorCode.permissionDenied) {
                      controller.markCameraPermissionDenied();
                    } else {
                      controller.markCameraUnavailable();
                    }
                  });
                  return const SizedBox.shrink();
                },
              )
            else
              const ColoredBox(color: Colors.black),
            IgnorePointer(
              child: Center(
                child: Container(
                  width: 240,
                  height: 240,
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.white70, width: 2),
                    borderRadius: AppRadius.mdAll,
                  ),
                ),
              ),
            ),
            Positioned(
              left: AppSpacing.lg,
              right: AppSpacing.lg,
              bottom: AppSpacing.lg,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (state.phase == DriverSupplierPickupQrPhase.scanning &&
                      !_fromDeepLink)
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        context.l10n.driverSupplierPickupQrPointCamera,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white, fontSize: 15),
                      ),
                    ),
                  if (state.phase == DriverSupplierPickupQrPhase.verifying) ...[
                    const CircularProgressIndicator(color: Colors.white),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      context.l10n.driverSupplierPickupQrVerifying,
                      style: const TextStyle(color: Colors.white),
                    ),
                  ],
                  if (state.phase == DriverSupplierPickupQrPhase.error) ...[
                    Material(
                      color: palette.cardSurface,
                      borderRadius: AppRadius.mdAll,
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              _errorMessage(state),
                              style: AppTextStyles.body(context),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            FilledButton(
                              onPressed: _retry,
                              child: Text(
                                state.errorKind ==
                                            DriverSupplierPickupQrErrorKind
                                                .cameraPermission ||
                                        state.errorKind ==
                                            DriverSupplierPickupQrErrorKind
                                                .cameraUnavailable
                                    ? context.l10n.retry
                                    : context.l10n.driverSupplierPickupQrScanAgain,
                              ),
                            ),
                            TextButton(
                              onPressed: () => _leave(
                                SupplierPickupQrScanResult.useManualCode,
                              ),
                              child: Text(
                                context.l10n.useSupplierHandoverCodeInstead,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (state.phase == DriverSupplierPickupQrPhase.verified ||
                      state.phase == DriverSupplierPickupQrPhase.confirming)
                    _PickupVerifyPreviewCard(
                      preview: state.preview!,
                      confirming:
                          state.phase == DriverSupplierPickupQrPhase.confirming,
                      onConfirm: controller.confirmPickup,
                      onCancel: _fromDeepLink
                          ? () => _leave(SupplierPickupQrScanResult.cancelled)
                          : controller.resumeScanning,
                    ),
                  if (state.phase == DriverSupplierPickupQrPhase.scanning ||
                      state.phase == DriverSupplierPickupQrPhase.verifying) ...[
                    const SizedBox(height: AppSpacing.md),
                    TextButton(
                      onPressed: () =>
                          _leave(SupplierPickupQrScanResult.useManualCode),
                      style: TextButton.styleFrom(foregroundColor: Colors.white),
                      child: Text(context.l10n.useSupplierHandoverCodeInstead),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PickupVerifyPreviewCard extends StatelessWidget {
  const _PickupVerifyPreviewCard({
    required this.preview,
    required this.confirming,
    required this.onConfirm,
    required this.onCancel,
  });

  final SupplierPickupHandoverVerifyPreview preview;
  final bool confirming;
  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final pickup = [
      preview.pickupArea,
      preview.pickupCity,
    ].where((part) => part != null && part.trim().isNotEmpty).join(', ');

    return Material(
      color: palette.cardSurface,
      borderRadius: AppRadius.lgAll,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              context.l10n.driverSupplierPickupQrVerifiedTitle,
              style: AppTextStyles.title(context).copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _PreviewRow(
              label: context.l10n.supplier,
              value: preview.supplierDisplayName,
            ),
            if (pickup.isNotEmpty)
              _PreviewRow(
                label: context.l10n.driverPickupLabel,
                value: pickup,
              ),
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    preview.materialTitle,
                    style: AppTextStyles.label(context).copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  _PreviewRow(
                    label: context.l10n.supplierPickupQrQuantityLabel,
                    value: _quantityLabel(preview),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            FilledButton(
              onPressed: confirming ? null : onConfirm,
              child: confirming
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(context.l10n.confirmPickup),
            ),
            TextButton(
              onPressed: confirming ? null : onCancel,
              child: Text(context.l10n.driverCancelAction),
            ),
          ],
        ),
      ),
    );
  }

  String _quantityLabel(SupplierPickupHandoverVerifyPreview preview) {
    final quantityLabel = preview.quantity == preview.quantity.roundToDouble()
        ? preview.quantity.toInt().toString()
        : preview.quantity.toString();
    return '$quantityLabel ${preview.unit}'.trim();
  }
}

class _PreviewRow extends StatelessWidget {
  const _PreviewRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 88,
            child: Text(
              label,
              style: AppTextStyles.body(context).copyWith(
                color: palette.textSecondary,
              ),
            ),
          ),
          Expanded(
            child: Text(value, style: AppTextStyles.body(context)),
          ),
        ],
      ),
    );
  }
}
