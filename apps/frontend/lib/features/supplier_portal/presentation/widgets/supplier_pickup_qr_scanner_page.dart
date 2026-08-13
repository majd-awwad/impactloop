import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../application/supplier_pickup_qr_controller.dart';
import '../../data/models/handover_verify_preview.dart';
import '../controllers/supplier_requests_providers.dart';
import '../theme/supplier_theme_extension.dart';

enum PickupQrScanResult { completed, useManualCode, cancelled }

/// Full-screen supplier pickup QR scanner: scan → verify → preview → confirm.
class SupplierPickupQrScannerPage extends ConsumerStatefulWidget {
  const SupplierPickupQrScannerPage({super.key});

  static Future<PickupQrScanResult> open(BuildContext context) async {
    final result = await Navigator.of(context).push<PickupQrScanResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => const SupplierPickupQrScannerPage(),
      ),
    );
    return result ?? PickupQrScanResult.cancelled;
  }

  @override
  ConsumerState<SupplierPickupQrScannerPage> createState() =>
      _SupplierPickupQrScannerPageState();
}

class _SupplierPickupQrScannerPageState
    extends ConsumerState<SupplierPickupQrScannerPage> {
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

  Future<void> _syncScannerWithPhase(SupplierPickupQrPhase phase) async {
    try {
      if (phase == SupplierPickupQrPhase.scanning) {
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
    final controller = ref.read(supplierPickupQrControllerProvider.notifier);
    if (!ref.read(supplierPickupQrControllerProvider).acceptsScans) return;

    final raw = capture.barcodes
        .map((barcode) => barcode.rawValue?.trim() ?? '')
        .firstWhere((value) => value.isNotEmpty, orElse: () => '');
    if (raw.isEmpty) return;
    controller.onCodeDetected(raw);
  }

  Future<void> _handleCompleted(String? reservationId) async {
    if (_handledCompletion) return;
    _handledCompletion = true;
    // Mirror manual completion refresh; snackbar is owned by the shared funnel.
    invalidateReservationSyncProviders(ref, reservationId: reservationId);
    if (!mounted) return;
    Navigator.of(context).pop(PickupQrScanResult.completed);
  }

  String _errorMessage(SupplierPickupQrState state) {
    final l10n = context.l10n;
    switch (state.errorKind) {
      case SupplierPickupQrErrorKind.invalidPayload:
        return l10n.supplierPickupQrInvalidPayload;
      case SupplierPickupQrErrorKind.cameraPermission:
        return l10n.supplierPickupQrCameraPermissionRequired;
      case SupplierPickupQrErrorKind.cameraUnavailable:
        return l10n.supplierPickupQrCameraUnavailable;
      case SupplierPickupQrErrorKind.verifyFailed:
      case SupplierPickupQrErrorKind.confirmFailed:
        if (state.error != null) {
          return localizedApiErrorMessage(state.error!, l10n);
        }
        return state.errorKind == SupplierPickupQrErrorKind.verifyFailed
            ? l10n.supplierPickupQrVerifyFailed
            : l10n.supplierPickupQrConfirmFailed;
      case null:
        return l10n.somethingWentWrong;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final state = ref.watch(supplierPickupQrControllerProvider);
    final controller = ref.read(supplierPickupQrControllerProvider.notifier);

    ref.listen<SupplierPickupQrState>(supplierPickupQrControllerProvider, (
      previous,
      next,
    ) {
      _syncScannerWithPhase(next.phase);
      if (next.phase == SupplierPickupQrPhase.completed) {
        _handleCompleted(
          next.completedReservation?.id ?? next.preview?.reservationId,
        );
      }
    });

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        leading: AppBackAction(
          onBack: () async {
            Navigator.of(context).pop(PickupQrScanResult.cancelled);
          },
        ),
        title: Text(context.l10n.supplierScanPickupQr),
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
                  if (state.phase == SupplierPickupQrPhase.scanning)
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        context.l10n.supplierPickupQrPointCamera,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  if (state.phase == SupplierPickupQrPhase.verifying) ...[
                    const CircularProgressIndicator(color: Colors.white),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      context.l10n.supplierPickupQrVerifying,
                      style: const TextStyle(color: Colors.white),
                    ),
                  ],
                  if (state.phase == SupplierPickupQrPhase.error) ...[
                    Material(
                      color: colors.surfaceSolid,
                      borderRadius: AppRadius.mdAll,
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              _errorMessage(state),
                              style: context.supplierBody(),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            FilledButton(
                              onPressed: controller.resumeScanning,
                              child: Text(
                                state.errorKind ==
                                            SupplierPickupQrErrorKind
                                                .cameraPermission ||
                                        state.errorKind ==
                                            SupplierPickupQrErrorKind
                                                .cameraUnavailable
                                    ? context.l10n.supplierPickupQrTryAgain
                                    : context.l10n.supplierPickupQrScanAgain,
                              ),
                            ),
                            TextButton(
                              onPressed: () => Navigator.of(
                                context,
                              ).pop(PickupQrScanResult.useManualCode),
                              child: Text(
                                context.l10n.supplierPickupQrUseCodeInstead,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (state.phase == SupplierPickupQrPhase.verified ||
                      state.phase == SupplierPickupQrPhase.confirming)
                    _HandoverVerifyPreviewCard(
                      preview: state.preview!,
                      confirming:
                          state.phase == SupplierPickupQrPhase.confirming,
                      onConfirm: controller.confirmHandover,
                      onCancel: controller.resumeScanning,
                    ),
                  if (state.phase == SupplierPickupQrPhase.scanning ||
                      state.phase == SupplierPickupQrPhase.verifying) ...[
                    const SizedBox(height: AppSpacing.md),
                    TextButton(
                      onPressed: () => Navigator.of(
                        context,
                      ).pop(PickupQrScanResult.useManualCode),
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

  final HandoverVerifyPreview preview;
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
    final colors = context.supplierColors;
    final preview = widget.preview;
    final quantityLabel = preview.quantity == preview.quantity.roundToDouble()
        ? preview.quantity.toInt().toString()
        : preview.quantity.toString();

    return Material(
      color: colors.surfaceSolid,
      borderRadius: AppRadius.lgAll,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              context.l10n.supplierPickupQrVerifiedTitle,
              style: context.supplierTitle().copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              preview.materialTitle,
              style: context.supplierTitle().copyWith(fontSize: 16),
            ),
            const SizedBox(height: AppSpacing.sm),
            _PreviewRow(
              label: context.l10n.supplierPickupQrLearnerLabel,
              value: preview.learnerDisplayName,
            ),
            if (preview.payment.requiresCashConfirmation) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                context.l10n.cashToCollect,
                style: context.supplierBody().copyWith(
                  color: colors.textSecondary,
                ),
              ),
              Text(
                '${preview.payment.totalAmount} ${preview.payment.currency}',
                style: context.supplierTitle().copyWith(fontSize: 20),
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
            _PreviewRow(
              label: context.l10n.supplierPickupQrQuantityLabel,
              value: '$quantityLabel ${preview.unit}'.trim(),
            ),
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
                  : Text(context.l10n.supplierPickupQrConfirmHandover),
            ),
            TextButton(
              onPressed: widget.confirming ? null : widget.onCancel,
              child: Text(context.s.cancel),
            ),
          ],
        ),
      ),
    );
  }
}

class _PreviewRow extends StatelessWidget {
  const _PreviewRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 88,
            child: Text(
              label,
              style: context.supplierBody().copyWith(
                color: colors.textSecondary,
              ),
            ),
          ),
          Expanded(child: Text(value, style: context.supplierBody())),
        ],
      ),
    );
  }
}
