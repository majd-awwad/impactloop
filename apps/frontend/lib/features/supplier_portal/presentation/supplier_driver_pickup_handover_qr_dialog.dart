import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/format/localized_formatters.dart';
import '../../../l10n/l10n.dart';
import '../../../shared/widgets/app_dialog_shell.dart';
import '../../../shared/widgets/app_primary_button.dart';
import '../application/supplier_driver_pickup_handover_credential_controller.dart';
import '../../reservations/data/models/handover_credential.dart';
import 'theme/supplier_theme_extension.dart';

Future<void> showSupplierDriverPickupHandoverQrDialog({
  required BuildContext context,
  required WidgetRef ref,
  required String reservationId,
  required String materialTitle,
}) {
  ref.read(supplierDriverPickupHandoverCredentialControllerProvider(reservationId));

  return showDialog<void>(
    context: context,
    builder: (dialogContext) {
      return SupplierDriverPickupHandoverQrDialog(
        reservationId: reservationId,
        materialTitle: materialTitle,
      );
    },
  );
}

class SupplierDriverPickupHandoverQrDialog extends ConsumerStatefulWidget {
  const SupplierDriverPickupHandoverQrDialog({
    super.key,
    required this.reservationId,
    required this.materialTitle,
  });

  final String reservationId;
  final String materialTitle;

  @override
  ConsumerState<SupplierDriverPickupHandoverQrDialog> createState() =>
      _SupplierDriverPickupHandoverQrDialogState();
}

class _SupplierDriverPickupHandoverQrDialogState
    extends ConsumerState<SupplierDriverPickupHandoverQrDialog> {
  Timer? _expiryTimer;
  var _ensureRequested = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _ensureRequested) return;
      _ensureRequested = true;
      unawaited(
        ref
            .read(
              supplierDriverPickupHandoverCredentialControllerProvider(
                widget.reservationId,
              ).notifier,
            )
            .ensureIssued(),
      );
      _scheduleExpiryCheck();
    });
  }

  @override
  void dispose() {
    _expiryTimer?.cancel();
    super.dispose();
  }

  void _scheduleExpiryCheck() {
    _expiryTimer?.cancel();
    final credential = ref
        .read(
          supplierDriverPickupHandoverCredentialControllerProvider(
            widget.reservationId,
          ),
        )
        .credential;
    if (credential == null) return;

    final remaining = credential.expiresAt.difference(DateTime.now());
    if (remaining.isNegative) {
      ref
          .read(
            supplierDriverPickupHandoverCredentialControllerProvider(
              widget.reservationId,
            ).notifier,
          )
          .markExpiredIfNeeded();
      return;
    }

    _expiryTimer = Timer(remaining + const Duration(milliseconds: 50), () {
      if (!mounted) return;
      ref
          .read(
            supplierDriverPickupHandoverCredentialControllerProvider(
              widget.reservationId,
            ).notifier,
          )
          .markExpiredIfNeeded();
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.supplierColors;
    final state = ref.watch(
      supplierDriverPickupHandoverCredentialControllerProvider(
        widget.reservationId,
      ),
    );
    final controller = ref.read(
      supplierDriverPickupHandoverCredentialControllerProvider(
        widget.reservationId,
      ).notifier,
    );

    ref.listen(
      supplierDriverPickupHandoverCredentialControllerProvider(
        widget.reservationId,
      ),
      (previous, next) {
        if (previous?.credential?.expiresAt != next.credential?.expiresAt) {
          _scheduleExpiryCheck();
        }
      },
    );

    final credential = state.credential;
    final showExpired =
        state.phase == SupplierDriverPickupHandoverCredentialPhase.error &&
        (state.error == 'EXPIRED' || (credential?.isExpiredAt() ?? false));

    return AppDialogShell(
      key: const Key('supplier-driver-pickup-handover-qr-dialog'),
      maxWidth: 420,
      title: Text(l10n.supplierDriverPickupQrDialogTitle),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.supplierDriverPickupQrInstructions,
            style: context.supplierBody().copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.pickupQrMaterialLabel(widget.materialTitle),
            style: context.supplierLabel().copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (state.isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
              child: Center(
                child: SizedBox(
                  width: 36,
                  height: 36,
                  child: CircularProgressIndicator(strokeWidth: 3),
                ),
              ),
            )
          else if (showExpired)
            _ExpiredPanel(
              onReissue: state.isLoading
                  ? null
                  : () => unawaited(controller.reissue()),
            )
          else if (state.phase == SupplierDriverPickupHandoverCredentialPhase.error)
            _ErrorPanel(
              message: _issueErrorMessage(state.error, l10n),
              onRetry: state.isLoading
                  ? null
                  : () => unawaited(controller.ensureIssued()),
            )
          else if (credential != null)
            _QrContent(credential: credential)
          else
            _ErrorPanel(
              message: l10n.supplierDriverPickupQrIssueFailed,
              onRetry: state.isLoading
                  ? null
                  : () => unawaited(controller.ensureIssued()),
            ),
        ],
      ),
    );
  }

  String _issueErrorMessage(Object? error, AppLocalizations l10n) {
    if (error == null) return l10n.supplierDriverPickupQrIssueFailed;
    if (error == 'EXPIRED') return l10n.supplierDriverPickupQrExpired;
    return localizedApiErrorMessage(error, l10n);
  }
}

class _QrContent extends StatelessWidget {
  const _QrContent({required this.credential});

  final HandoverCredential credential;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.supplierColors;
    final expiresLabel = LocalizedFormatters(l10n).dateTime(credential.expiresAt);
    final size = (MediaQuery.sizeOf(context).shortestSide * 0.55).clamp(
      180.0,
      260.0,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Semantics(
            label: l10n.supplierDriverPickupQrDialogTitle,
            image: true,
            excludeSemantics: true,
            child: Container(
              key: const Key('supplier-driver-pickup-handover-qr-image'),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.mdAll,
                border: Border.all(color: colors.border),
              ),
              child: QrImageView(
                data: credential.qrPayload,
                version: QrVersions.auto,
                size: size,
                backgroundColor: Colors.white,
                eyeStyle: const QrEyeStyle(
                  eyeShape: QrEyeShape.square,
                  color: Color(0xFF000000),
                ),
                dataModuleStyle: const QrDataModuleStyle(
                  dataModuleShape: QrDataModuleShape.square,
                  color: Color(0xFF000000),
                ),
                gapless: true,
                errorStateBuilder: (context, error) {
                  return SizedBox(
                    width: size,
                    height: size,
                    child: Center(
                      child: Text(
                        l10n.supplierDriverPickupQrIssueFailed,
                        textAlign: TextAlign.center,
                        style: context.supplierLabel(),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          l10n.supplierDriverPickupQrValidUntil(expiresLabel),
          textAlign: TextAlign.center,
          style: context.supplierLabel().copyWith(
            color: colors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          l10n.supplierDriverPickupQrManualFallbackNote,
          textAlign: TextAlign.center,
          style: context.supplierLabel().copyWith(
            color: colors.textMuted,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(
          Icons.error_outline_rounded,
          color: Theme.of(context).colorScheme.error,
          size: 36,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          message,
          textAlign: TextAlign.center,
          style: context.supplierBody().copyWith(color: colors.textSecondary),
        ),
        if (onRetry != null) ...[
          const SizedBox(height: AppSpacing.md),
          AppPrimaryButton(
            key: const Key('supplier-driver-pickup-handover-qr-retry'),
            label: l10n.retry,
            onPressed: onRetry,
          ),
        ],
      ],
    );
  }
}

class _ExpiredPanel extends StatelessWidget {
  const _ExpiredPanel({this.onReissue});

  final VoidCallback? onReissue;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(Icons.schedule_outlined, color: colors.textMuted, size: 36),
        const SizedBox(height: AppSpacing.sm),
        Text(
          l10n.supplierDriverPickupQrExpired,
          textAlign: TextAlign.center,
          style: context.supplierBody().copyWith(
            color: colors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        if (onReissue != null) ...[
          const SizedBox(height: AppSpacing.md),
          AppPrimaryButton(
            key: const Key('supplier-driver-pickup-handover-qr-reissue'),
            label: l10n.supplierDriverPickupQrGenerateNew,
            onPressed: onReissue,
          ),
        ],
      ],
    );
  }
}
