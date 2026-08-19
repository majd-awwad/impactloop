import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/format/localized_formatters.dart';
import '../../../l10n/l10n.dart';
import '../../../shared/widgets/app_dialog_shell.dart';
import '../../../shared/widgets/app_primary_button.dart';
import '../../../shared/widgets/materials/materials_ui_palette.dart';
import '../application/delivery_handover_credential_controller.dart';
import '../data/models/delivery_handover_credential.dart';

Future<void> showDeliveryHandoverQrDialog({
  required BuildContext context,
  required WidgetRef ref,
  required String deliveryId,
  required String materialTitle,
}) {
  ref.read(deliveryHandoverCredentialControllerProvider(deliveryId));

  return showDialog<void>(
    context: context,
    builder: (dialogContext) {
      return DeliveryHandoverQrDialog(
        deliveryId: deliveryId,
        materialTitle: materialTitle,
      );
    },
  );
}

class DeliveryHandoverQrDialog extends ConsumerStatefulWidget {
  const DeliveryHandoverQrDialog({
    super.key,
    required this.deliveryId,
    required this.materialTitle,
  });

  final String deliveryId;
  final String materialTitle;

  @override
  ConsumerState<DeliveryHandoverQrDialog> createState() =>
      _DeliveryHandoverQrDialogState();
}

class _DeliveryHandoverQrDialogState
    extends ConsumerState<DeliveryHandoverQrDialog> {
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
              deliveryHandoverCredentialControllerProvider(
                widget.deliveryId,
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
        .read(deliveryHandoverCredentialControllerProvider(widget.deliveryId))
        .credential;
    if (credential == null) return;

    final remaining = credential.expiresAt.difference(DateTime.now());
    if (remaining.isNegative) {
      ref
          .read(
            deliveryHandoverCredentialControllerProvider(
              widget.deliveryId,
            ).notifier,
          )
          .markExpiredIfNeeded();
      return;
    }

    _expiryTimer = Timer(remaining + const Duration(milliseconds: 50), () {
      if (!mounted) return;
      ref
          .read(
            deliveryHandoverCredentialControllerProvider(
              widget.deliveryId,
            ).notifier,
          )
          .markExpiredIfNeeded();
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final state = ref.watch(
      deliveryHandoverCredentialControllerProvider(widget.deliveryId),
    );
    final controller = ref.read(
      deliveryHandoverCredentialControllerProvider(widget.deliveryId).notifier,
    );

    ref.listen(
      deliveryHandoverCredentialControllerProvider(widget.deliveryId),
      (previous, next) {
        if (previous?.credential?.expiresAt != next.credential?.expiresAt) {
          _scheduleExpiryCheck();
        }
      },
    );

    final credential = state.credential;
    final showExpired =
        state.phase == DeliveryHandoverCredentialPhase.error &&
        (state.error == 'EXPIRED' || (credential?.isExpiredAt() ?? false));

    return AppDialogShell(
      key: const Key('delivery-handover-qr-dialog'),
      maxWidth: 420,
      title: Text(l10n.deliveryQrDialogTitle),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.deliveryQrInstructions,
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.pickupQrMaterialLabel(widget.materialTitle),
            style: AppTextStyles.label(context).copyWith(
              color: palette.textPrimary,
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
          else if (state.phase == DeliveryHandoverCredentialPhase.error)
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
              message: l10n.deliveryQrIssueFailed,
              onRetry: state.isLoading
                  ? null
                  : () => unawaited(controller.ensureIssued()),
            ),
        ],
      ),
    );
  }

  String _issueErrorMessage(Object? error, AppLocalizations l10n) {
    if (error == null) return l10n.deliveryQrIssueFailed;
    if (error == 'EXPIRED') return l10n.deliveryQrExpired;
    if (error is ApiException) {
      switch (error.code) {
        case 'HANDOVER_CREDENTIAL_INVALID':
          return l10n.deliveryQrIssueFailed;
        case 'HANDOVER_WINDOW_NOT_STARTED':
          return l10n.driverHandoverWindowNotStarted;
        case 'HANDOVER_WINDOW_EXPIRED':
          return l10n.driverHandoverWindowExpired;
      }
    }
    return localizedApiErrorMessage(error, l10n);
  }
}

class _QrContent extends StatelessWidget {
  const _QrContent({required this.credential});

  final DeliveryHandoverCredential credential;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
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
            label: l10n.deliveryQrDialogTitle,
            image: true,
            excludeSemantics: true,
            child: Container(
              key: const Key('delivery-handover-qr-image'),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.mdAll,
                border: Border.all(color: palette.borderSubtle),
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
                        l10n.deliveryQrIssueFailed,
                        textAlign: TextAlign.center,
                        style: AppTextStyles.label(context),
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
          l10n.deliveryQrValidUntil(expiresLabel),
          textAlign: TextAlign.center,
          style: AppTextStyles.label(context).copyWith(
            color: palette.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          l10n.deliveryQrManualFallbackNote,
          textAlign: TextAlign.center,
          style: AppTextStyles.label(context).copyWith(
            color: palette.textMuted,
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
    final palette = MaterialsUiPalette.of(context);

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
          style: AppTextStyles.body(context).copyWith(
            color: palette.textSecondary,
          ),
        ),
        if (onRetry != null) ...[
          const SizedBox(height: AppSpacing.md),
          AppPrimaryButton(
            key: const Key('delivery-handover-qr-retry'),
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
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(Icons.schedule_outlined, color: palette.textMuted, size: 36),
        const SizedBox(height: AppSpacing.sm),
        Text(
          l10n.deliveryQrExpired,
          textAlign: TextAlign.center,
          style: AppTextStyles.body(context).copyWith(
            color: palette.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        if (onReissue != null) ...[
          const SizedBox(height: AppSpacing.md),
          AppPrimaryButton(
            key: const Key('delivery-handover-qr-reissue'),
            label: l10n.deliveryQrGenerateNew,
            onPressed: onReissue,
          ),
        ],
      ],
    );
  }
}
