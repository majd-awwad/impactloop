import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/driver_delivery_action_controller.dart';
import '../../application/driver_delivery_qr_controller.dart';
import '../../data/models/delivery_handover_verify_preview.dart';

enum DeliveryQrScanResult { completed, useManualCode, cancelled }

/// Full-screen driver delivery QR scanner: scan → verify → preview → confirm.
class DriverDeliveryQrScannerPage extends ConsumerStatefulWidget {
  const DriverDeliveryQrScannerPage({super.key});

  static Future<DeliveryQrScanResult> open(BuildContext context) async {
    final result = await Navigator.of(context).push<DeliveryQrScanResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => const DriverDeliveryQrScannerPage(),
      ),
    );
    return result ?? DeliveryQrScanResult.cancelled;
  }

  @override
  ConsumerState<DriverDeliveryQrScannerPage> createState() =>
      _DriverDeliveryQrScannerPageState();
}

class _DriverDeliveryQrScannerPageState
    extends ConsumerState<DriverDeliveryQrScannerPage> {
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
  }

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _syncScannerWithPhase(DriverDeliveryQrPhase phase) async {
    try {
      if (phase == DriverDeliveryQrPhase.scanning) {
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
    final controller = ref.read(driverDeliveryQrControllerProvider.notifier);
    if (!ref.read(driverDeliveryQrControllerProvider).acceptsScans) return;

    final raw = capture.barcodes
        .map((barcode) => barcode.rawValue?.trim() ?? '')
        .firstWhere((value) => value.isNotEmpty, orElse: () => '');
    if (raw.isEmpty) return;
    controller.onCodeDetected(raw);
  }

  Future<void> _handleCompleted(DriverDeliveryQrState state) async {
    if (_handledCompletion) return;
    _handledCompletion = true;

    final deliveryId = state.completedDelivery?.id ?? state.preview?.deliveryId;
    final reservationId = state.preview?.items.isNotEmpty == true
        ? state.preview!.items.first.reservationId
        : null;

    invalidateDriverDeliverySyncProviders(
      ref,
      deliveryId: deliveryId,
      reservationId: reservationId,
    );
    if (!mounted) return;
    Navigator.of(context).pop(DeliveryQrScanResult.completed);
  }

  String _errorMessage(DriverDeliveryQrState state) {
    final l10n = context.l10n;
    switch (state.errorKind) {
      case DriverDeliveryQrErrorKind.invalidPayload:
        return l10n.driverDeliveryQrInvalidPayload;
      case DriverDeliveryQrErrorKind.cameraPermission:
        return l10n.driverDeliveryQrCameraPermissionRequired;
      case DriverDeliveryQrErrorKind.cameraUnavailable:
        return l10n.driverDeliveryQrCameraUnavailable;
      case DriverDeliveryQrErrorKind.verifyFailed:
      case DriverDeliveryQrErrorKind.confirmFailed:
        if (state.error != null) {
          return localizedApiErrorMessage(state.error!, l10n);
        }
        return state.errorKind == DriverDeliveryQrErrorKind.verifyFailed
            ? l10n.driverDeliveryQrVerifyFailed
            : l10n.driverDeliveryQrConfirmFailed;
      case null:
        return l10n.somethingWentWrong;
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final state = ref.watch(driverDeliveryQrControllerProvider);
    final controller = ref.read(driverDeliveryQrControllerProvider.notifier);

    ref.listen<DriverDeliveryQrState>(driverDeliveryQrControllerProvider, (
      previous,
      next,
    ) {
      _syncScannerWithPhase(next.phase);
      if (next.phase == DriverDeliveryQrPhase.completed) {
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
            Navigator.of(context).pop(DeliveryQrScanResult.cancelled);
          },
        ),
        title: Text(context.l10n.driverScanDeliveryQr),
      ),
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
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
            ),
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
                  if (state.phase == DriverDeliveryQrPhase.scanning)
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        context.l10n.driverDeliveryQrPointCamera,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  if (state.phase == DriverDeliveryQrPhase.verifying) ...[
                    const CircularProgressIndicator(color: Colors.white),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      context.l10n.driverDeliveryQrVerifying,
                      style: const TextStyle(color: Colors.white),
                    ),
                  ],
                  if (state.phase == DriverDeliveryQrPhase.error) ...[
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
                              onPressed: controller.resumeScanning,
                              child: Text(
                                state.errorKind ==
                                            DriverDeliveryQrErrorKind
                                                .cameraPermission ||
                                        state.errorKind ==
                                            DriverDeliveryQrErrorKind
                                                .cameraUnavailable
                                    ? context.l10n.retry
                                    : context.l10n.supplierPickupQrScanAgain,
                              ),
                            ),
                            TextButton(
                              onPressed: () => Navigator.of(
                                context,
                              ).pop(DeliveryQrScanResult.useManualCode),
                              child: Text(
                                context.l10n.supplierPickupQrUseCodeInstead,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (state.phase == DriverDeliveryQrPhase.verified ||
                      state.phase == DriverDeliveryQrPhase.confirming)
                    _HandoverVerifyPreviewCard(
                      preview: state.preview!,
                      confirming:
                          state.phase == DriverDeliveryQrPhase.confirming,
                      onConfirm: controller.confirmHandover,
                      onCancel: controller.resumeScanning,
                    ),
                  if (state.phase == DriverDeliveryQrPhase.scanning ||
                      state.phase == DriverDeliveryQrPhase.verifying) ...[
                    const SizedBox(height: AppSpacing.md),
                    TextButton(
                      onPressed: () => Navigator.of(
                        context,
                      ).pop(DeliveryQrScanResult.useManualCode),
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.white,
                      ),
                      child: Text(context.l10n.supplierPickupQrUseCodeInstead),
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

class _HandoverVerifyPreviewCard extends StatefulWidget {
  const _HandoverVerifyPreviewCard({
    required this.preview,
    required this.confirming,
    required this.onConfirm,
    required this.onCancel,
  });

  final DeliveryHandoverVerifyPreview preview;
  final bool confirming;
  final void Function({bool cashReceivedConfirmed}) onConfirm;
  final VoidCallback onCancel;

  @override
  State<_HandoverVerifyPreviewCard> createState() =>
      _HandoverVerifyPreviewCardState();
}

class _HandoverVerifyPreviewCardState
    extends State<_HandoverVerifyPreviewCard> {
  var _cashConfirmed = false;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final preview = widget.preview;
    final destination = [
      preview.destinationArea,
      preview.destinationCity,
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
              context.l10n.driverDeliveryQrVerifiedTitle,
              style: AppTextStyles.title(
                context,
              ).copyWith(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: AppSpacing.md),
            _PreviewRow(
              label: context.l10n.driverDeliveryQrLearnerLabel,
              value: preview.learnerDisplayName,
            ),
            if (destination.isNotEmpty)
              _PreviewRow(label: context.l10n.dropoff, value: destination),
            for (final item in preview.items)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      item.materialTitle,
                      style: AppTextStyles.label(
                        context,
                      ).copyWith(fontWeight: FontWeight.w600),
                    ),
                    _PreviewRow(
                      label: context.l10n.supplierPickupQrQuantityLabel,
                      value: _quantityLabel(item),
                    ),
                  ],
                ),
              ),
            if (preview.payment.requiresCashConfirmation) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                context.l10n.cashToCollect,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
              Text(
                '${preview.payment.totalAmount} ${preview.payment.currency}',
                style: AppTextStyles.title(context).copyWith(fontSize: 20),
              ),
              const SizedBox(height: AppSpacing.xs),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _cashConfirmed,
                title: Text(context.l10n.cashReceivedConfirmation),
                onChanged: widget.confirming
                    ? null
                    : (value) => setState(() => _cashConfirmed = value == true),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            FilledButton(
              onPressed: widget.confirming ||
                      (preview.payment.requiresCashConfirmation &&
                          !_cashConfirmed)
                  ? null
                  : () => widget.onConfirm(
                        cashReceivedConfirmed: _cashConfirmed,
                      ),
              child: widget.confirming
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(context.l10n.driverDeliveryQrConfirmHandover),
            ),
            TextButton(
              onPressed: widget.confirming ? null : widget.onCancel,
              child: Text(context.l10n.driverCancelAction),
            ),
          ],
        ),
      ),
    );
  }

  String _quantityLabel(DeliveryHandoverVerifyPreviewItem item) {
    final quantityLabel = item.quantity == item.quantity.roundToDouble()
        ? item.quantity.toInt().toString()
        : item.quantity.toString();
    return '$quantityLabel ${item.unit}'.trim();
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
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          ),
          Expanded(child: Text(value, style: AppTextStyles.body(context))),
        ],
      ),
    );
  }
}
