import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../app/theme/app_theme_colors.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../reservations/data/models/reservation_quote.dart';

class ReservationSubmitBar extends StatelessWidget {
  const ReservationSubmitBar({
    super.key,
    required this.isSubmitting,
    required this.canSubmit,
    required this.onSubmit,
    required this.onCancel,
    this.quote,
    this.showTotal = true,
    this.disabledReason,
  });

  final bool isSubmitting;
  final bool canSubmit;
  final VoidCallback? onSubmit;
  final VoidCallback onCancel;
  final ReservationQuote? quote;
  final bool showTotal;
  final String? disabledReason;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final l10n = context.l10n;
    final amountText = quote != null
        ? l10n.reservationMoneyAmountWithCurrency(
            quote!.totalAmount == quote!.totalAmount.roundToDouble()
                ? quote!.totalAmount.toStringAsFixed(0)
                : quote!.totalAmount.toStringAsFixed(2),
          )
        : null;

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.lg,
          AppSpacing.sm,
          AppSpacing.lg,
          AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: palette.panelSurface,
          border: Border(top: BorderSide(color: palette.borderSubtle)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!canSubmit && disabledReason != null) ...[
              Text(
                disabledReason!,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted, fontSize: 12),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            LayoutBuilder(
              builder: (context, constraints) {
                final narrow = constraints.maxWidth < 520;

                final cancelButton = TextButton(
                  onPressed: isSubmitting ? null : onCancel,
                  style: TextButton.styleFrom(
                    minimumSize: const Size(0, 44),
                    foregroundColor: palette.textSecondary,
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: AppSpacing.md,
                    ),
                  ),
                  child: Text(l10n.close),
                );

                final submitButton = FilledButton.icon(
                  key: const ValueKey('reservation-submit-button'),
                  onPressed: isSubmitting || !canSubmit ? null : onSubmit,
                  style: ButtonStyle(
                    minimumSize: const WidgetStatePropertyAll(Size(140, 46)),
                    padding: const WidgetStatePropertyAll(
                      EdgeInsetsDirectional.symmetric(
                        horizontal: AppSpacing.lg,
                      ),
                    ),
                    backgroundColor: WidgetStateProperty.resolveWith((states) {
                      if (states.contains(WidgetState.disabled)) {
                        return palette.mutedSurface;
                      }
                      return colors.primary;
                    }),
                    foregroundColor: WidgetStateProperty.resolveWith((states) {
                      if (states.contains(WidgetState.disabled)) {
                        return palette.textMuted;
                      }
                      return colors.textOnPrimary;
                    }),
                    shape: WidgetStatePropertyAll(
                      RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
                    ),
                    elevation: const WidgetStatePropertyAll(0),
                  ),
                  icon: isSubmitting
                      ? SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: colors.textOnPrimary,
                          ),
                        )
                      : const Icon(Icons.send_rounded, size: 18),
                  label: Text(
                    l10n.sendRequest,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                );

                if (narrow) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (showTotal && amountText != null) ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              l10n.reservationTotalToPayLabel,
                              style: AppTextStyles.label(context).copyWith(
                                color: palette.textSecondary,
                              ),
                            ),
                            Text(
                              amountText,
                              style: AppTextStyles.body(context).copyWith(
                                fontWeight: FontWeight.w700,
                                color: palette.mint,
                                fontSize: 16,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                      ],
                      submitButton,
                      const SizedBox(height: AppSpacing.xs),
                      Center(child: cancelButton),
                    ],
                  );
                }

                return Row(
                  children: [
                    if (showTotal && amountText != null) ...[
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            l10n.reservationTotalToPayLabel,
                            style: AppTextStyles.label(context).copyWith(
                              color: palette.textMuted,
                              fontSize: 12,
                            ),
                          ),
                          Text(
                            amountText,
                            style: AppTextStyles.body(context).copyWith(
                              fontWeight: FontWeight.w700,
                              color: palette.mint,
                              fontSize: 18,
                            ),
                          ),
                        ],
                      ),
                      const Spacer(),
                    ] else
                      const Spacer(),
                    cancelButton,
                    const SizedBox(width: AppSpacing.sm),
                    submitButton,
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
