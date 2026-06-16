import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
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
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
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
        ),
        textAlign: TextAlign.start,
      ),
    );
  }
}
