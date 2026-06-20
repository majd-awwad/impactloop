import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_text_styles.dart';
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
    final background = isFree
        ? (isDark ? materialPriceFreeBackground : const Color(0xFFE4F4EC))
        : (isDark ? materialPricePaidBackground : const Color(0xFFF3F8F4));
    final border = isFree
        ? (isDark ? materialPriceFreeBorder : const Color(0xFFB8D2C3))
        : (isDark ? materialPricePaidBorder : const Color(0xFFD4E5D9));
    final foreground = isFree
        ? (isDark ? materialPriceFreeForeground : const Color(0xFF0F7A5A))
        : (isDark ? materialPricePaidForeground : const Color(0xFF506258));

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
