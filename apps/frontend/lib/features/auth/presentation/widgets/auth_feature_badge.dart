import 'package:flutter/material.dart';

import '../../../../app/theme/app_decorations.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';

class AuthFeatureBadge extends StatelessWidget {
  const AuthFeatureBadge({
    super.key,
    required this.icon,
    required this.label,
    this.compact = false,
  });

  final IconData icon;
  final String label;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    if (compact) {
      return Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: AppDecorations.mobileFeatureChip,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 16,
              color: AppTextStyles.badgeLabel(context).color,
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(label, style: AppTextStyles.badgeLabel(context)),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: AppDecorations.featureBadge,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: colors.textOnPrimary.withValues(alpha: 0.14),
              borderRadius: AppRadius.smAll,
            ),
            child: Icon(icon, color: colors.textOnPrimary, size: 22),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(label, style: AppTextStyles.badgeLabel(context)),
          ),
        ],
      ),
    );
  }
}
