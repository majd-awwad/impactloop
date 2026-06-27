import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../app/theme/app_theme_colors.dart';
import 'materials_ui_palette.dart';

enum MaterialConditionBadgeTone { likeNew, good, fair, mixed }

class MaterialConditionBadge extends StatelessWidget {
  const MaterialConditionBadge({
    super.key,
    required this.label,
    required this.tone,
  });

  final String label;
  final MaterialConditionBadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = AppThemeColors.of(context);
    final palette = switch (tone) {
      MaterialConditionBadgeTone.likeNew => (
        background: isDark
            ? materialConditionLikeNewBackground
            : colors.cardSurfaceAlt,
        foreground: isDark
            ? materialConditionLikeNewForeground
            : colors.textPrimary,
        border: isDark ? materialBorderStrong : colors.borderSubtle,
      ),
      MaterialConditionBadgeTone.good => (
        background: isDark
            ? materialConditionGoodBackground
            : colors.cardSurfaceAlt,
        foreground: isDark
            ? materialConditionGoodForeground
            : colors.textSecondary,
        border: isDark ? materialBorderStrong : colors.borderSubtle,
      ),
      MaterialConditionBadgeTone.fair => (
        background: isDark
            ? materialConditionFairBackground
            : colors.warningSoft,
        foreground: isDark
            ? materialConditionFairForeground
            : colors.warningText,
        border: isDark ? materialReservedBorder : colors.warningBorder,
      ),
      MaterialConditionBadgeTone.mixed => (
        background: isDark
            ? materialConditionMixedBackground
            : colors.cardSurfaceAlt,
        foreground: isDark
            ? materialConditionMixedForeground
            : colors.textSecondary,
        border: isDark ? materialBorderSubtle : colors.borderSubtle,
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
