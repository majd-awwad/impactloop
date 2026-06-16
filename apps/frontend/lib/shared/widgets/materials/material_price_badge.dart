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
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: materialBadgeHorizontalPadding,
        vertical: materialBadgeVerticalPadding,
      ),
      decoration: BoxDecoration(
        color: isFree ? materialPriceFreeBackground : materialPricePaidBackground,
        borderRadius: AppRadius.pillAll,
        border: Border.all(
          color: isFree ? materialPriceFreeBorder : materialPricePaidBorder,
        ),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: isFree ? materialPriceFreeForeground : materialPricePaidForeground,
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
