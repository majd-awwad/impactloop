import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../app/theme/app_theme_colors.dart';
import 'materials_ui_palette.dart';

enum MaterialStatusBadgeTone { available, reserved, reused, draft }

class MaterialStatusBadge extends StatelessWidget {
  const MaterialStatusBadge({
    super.key,
    required this.label,
    required this.tone,
  });

  final String label;
  final MaterialStatusBadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = AppThemeColors.of(context);
    final palette = switch (tone) {
      MaterialStatusBadgeTone.available =>
        isDark
            ? (
                background: materialAvailableBackground,
                foreground: materialAvailableForeground,
                border: materialAvailableBorder,
              )
            : (
                background: colors.successSoft,
                foreground: colors.success,
                border: colors.borderStrong,
              ),
      MaterialStatusBadgeTone.reserved => (
        background: isDark ? materialReservedBackground : colors.warningSoft,
        foreground: isDark ? materialReservedForeground : colors.warningText,
        border: isDark ? materialReservedBorder : colors.warningBorder,
      ),
      MaterialStatusBadgeTone.reused => (
        background: isDark ? materialReusedBackground : colors.cardSurfaceAlt,
        foreground: isDark ? materialReusedForeground : colors.textMuted,
        border: isDark ? materialReusedBorder : colors.borderSubtle,
      ),
      MaterialStatusBadgeTone.draft => (
        background: isDark ? materialDraftBackground : colors.cardSurfaceAlt,
        foreground: isDark ? materialDraftForeground : colors.textMuted,
        border: isDark ? materialDraftBorder : colors.borderSubtle,
      ),
    };

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: materialBadgeHorizontalPadding,
        vertical: materialBadgeVerticalPadding,
      ),
      decoration: BoxDecoration(
        color: palette.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.border),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: palette.foreground,
          fontSize: materialBadgeFontSize,
          fontWeight: FontWeight.w700,
          height: 1.1,
        ),
        textAlign: TextAlign.start,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}
