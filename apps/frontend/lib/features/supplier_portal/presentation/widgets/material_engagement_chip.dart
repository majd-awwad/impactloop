import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_theme_colors.dart';

enum MaterialEngagementChipTone { views, likes, neutral }

class MaterialEngagementChip extends StatelessWidget {
  const MaterialEngagementChip({
    super.key,
    required this.icon,
    required this.count,
    this.tone = MaterialEngagementChipTone.neutral,
  });

  final IconData icon;
  final int count;
  final MaterialEngagementChipTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final textTheme = Theme.of(context).textTheme;
    final palette = switch (tone) {
      MaterialEngagementChipTone.views => (
          background: colors.cardSurface.withValues(alpha: 0.90),
          foreground: colors.primary,
        ),
      MaterialEngagementChipTone.likes => (
          background: colors.cardSurface.withValues(alpha: 0.90),
          foreground: colors.primary,
        ),
      MaterialEngagementChipTone.neutral => (
          background: colors.cardSurface.withValues(alpha: 0.90),
          foreground: colors.textSecondary,
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: palette.foreground),
          const SizedBox(width: 4),
          Text(
            '$count',
            style: textTheme.labelSmall?.copyWith(
              color: palette.foreground,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
