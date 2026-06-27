import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../app/theme/app_theme_colors.dart';
import 'materials_ui_palette.dart';

class MaterialPriceBadge extends StatelessWidget {
  const MaterialPriceBadge({
    super.key,
    required this.label,
    required this.isFree,
  });

  final String label;
  final bool isFree;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = AppThemeColors.of(context);
    final background = isFree
        ? (isDark ? materialPriceFreeBackground : colors.successSoft)
        : (isDark ? materialPricePaidBackground : colors.cardSurfaceAlt);
    final border = isFree
        ? (isDark ? materialPriceFreeBorder : colors.borderStrong)
        : (isDark ? materialPricePaidBorder : colors.borderSubtle);
    final foreground = isFree
        ? (isDark ? materialPriceFreeForeground : colors.success)
        : (isDark ? materialPricePaidForeground : colors.textSecondary);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: materialBadgeHorizontalPadding,
        vertical: materialBadgeVerticalPadding,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: foreground,
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
