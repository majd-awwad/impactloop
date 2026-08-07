import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

/// Soft tinted semantic surfaces for reservation detail cards.
enum ReservationDetailSemantic {
  success,
  pickup,
  delivery,
  waiting,
  payment,
  resolution,
  neutral,
}

extension ReservationDetailSemanticX on ReservationDetailSemantic {
  Color background(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return switch (this) {
      ReservationDetailSemantic.success => colors.successSoft,
      ReservationDetailSemantic.pickup => colors.accentMint.withValues(alpha: 0.14),
      ReservationDetailSemantic.delivery => colors.accentBlue.withValues(alpha: 0.14),
      ReservationDetailSemantic.waiting => colors.warningSoft,
      ReservationDetailSemantic.payment => colors.dangerSoft,
      ReservationDetailSemantic.resolution =>
        colors.purpleStart.withValues(alpha: 0.12),
      ReservationDetailSemantic.neutral => colors.surfaceMuted,
    };
  }

  Color border(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return switch (this) {
      ReservationDetailSemantic.success => colors.success.withValues(alpha: 0.35),
      ReservationDetailSemantic.pickup => colors.accentMint.withValues(alpha: 0.45),
      ReservationDetailSemantic.delivery => colors.accentBlue.withValues(alpha: 0.45),
      ReservationDetailSemantic.waiting => colors.warningBorder,
      ReservationDetailSemantic.payment => colors.danger.withValues(alpha: 0.35),
      ReservationDetailSemantic.resolution =>
        colors.purpleEnd.withValues(alpha: 0.4),
      ReservationDetailSemantic.neutral => colors.borderSubtle,
    };
  }

  Color foreground(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return switch (this) {
      ReservationDetailSemantic.success => colors.success,
      ReservationDetailSemantic.pickup => colors.accentMint,
      ReservationDetailSemantic.delivery => colors.accentBlue,
      ReservationDetailSemantic.waiting => colors.warningText,
      ReservationDetailSemantic.payment => colors.danger,
      ReservationDetailSemantic.resolution => colors.purpleEnd,
      ReservationDetailSemantic.neutral => colors.textSecondary,
    };
  }
}

class ReservationDetailSurfaceCard extends StatelessWidget {
  const ReservationDetailSurfaceCard({
    super.key,
    required this.semantic,
    required this.child,
    this.title,
    this.titleIcon,
    this.padding = const EdgeInsetsDirectional.all(AppSpacing.md),
    this.tintBackground = true,
  });

  final ReservationDetailSemantic semantic;
  final Widget child;
  final String? title;
  final IconData? titleIcon;
  final EdgeInsetsDirectional padding;

  /// When false (or [semantic] is neutral), uses the white card surface so the
  /// page does not become a wall of tinted panels.
  final bool tintBackground;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final accent = semantic.foreground(context);
    final useTint =
        tintBackground && semantic != ReservationDetailSemantic.neutral;

    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: useTint ? semantic.background(context) : colors.cardSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(
          color: useTint ? semantic.border(context) : colors.borderSubtle,
        ),
        boxShadow: [
          BoxShadow(
            color: colors.shadow,
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null) ...[
            Row(
              children: [
                if (titleIcon != null) ...[
                  Icon(titleIcon, size: 18, color: accent),
                  const SizedBox(width: AppSpacing.xs),
                ],
                Expanded(
                  child: Text(
                    title!,
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          child,
        ],
      ),
    );
  }
}
