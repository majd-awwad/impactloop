import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';

class CheckoutStickyActionBar extends StatelessWidget {
  const CheckoutStickyActionBar({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.icon = Icons.arrow_forward_rounded,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Material(
      elevation: 8,
      color: colors.surface,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.sm + bottom,
        ),
        child: FilledButton.icon(
          key: const Key('checkout_sticky_primary'),
          onPressed: loading ? null : onPressed,
          icon: loading
              ? SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: colors.textOnPrimary,
                  ),
                )
              : Icon(icon, size: 18),
          label: Text(label),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.primary)
              .copyWith(
            minimumSize: const WidgetStatePropertyAll(Size.fromHeight(50)),
          ),
        ),
      ),
    );
  }
}

/// Ensures scroll content clears the sticky bar (+ safe area).
double checkoutStickyContentPadding(BuildContext context) {
  final bottom = MediaQuery.paddingOf(context).bottom;
  // Button 50 + vertical padding 8*2 + safe area + buffer
  return 50 + (AppSpacing.sm * 2) + bottom + AppSpacing.md;
}

String? stickyLabelForPhase(BuildContext context, String phaseName) {
  final l10n = context.l10n;
  return switch (phaseName) {
    'summary' => l10n.checkoutContinueToPayment,
    'method' => l10n.checkoutReviewOrder,
    'confirming' => l10n.checkoutConfirmPayment,
    _ => null,
  };
}
