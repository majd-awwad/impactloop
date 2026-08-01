import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_theme_colors.dart';

class MaterialPriceBadge extends StatelessWidget {
  const MaterialPriceBadge({
    super.key,
    required this.label,
    required this.isFree,
    this.dense = false,
  });

  final String label;
  final bool isFree;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final textTheme = Theme.of(context).textTheme;
    final background = isFree ? colors.successSoft : colors.cardSurfaceAlt;
    final border = isFree
        ? colors.primary.withValues(alpha: 0.32)
        : colors.borderSubtle;
    final foreground = isFree ? colors.primary : colors.textSecondary;

    return Container(
      constraints: BoxConstraints(
        minHeight: dense ? AppSpacing.lg : AppSpacing.xl - AppSpacing.xs,
      ),
      padding: EdgeInsetsDirectional.symmetric(
        horizontal: dense ? AppSpacing.sm : AppSpacing.md - AppSpacing.xs,
        vertical: dense ? AppSpacing.xs : AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: textTheme.labelSmall?.copyWith(
          color: foreground,
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
