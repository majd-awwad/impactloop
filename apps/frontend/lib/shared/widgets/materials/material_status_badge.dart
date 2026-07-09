import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_theme_colors.dart';

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
    final colors = AppThemeColors.of(context);
    final textTheme = Theme.of(context).textTheme;
    final palette = switch (tone) {
      MaterialStatusBadgeTone.available => (
        background: colors.successSoft,
        foreground: colors.primary,
        border: colors.primary.withValues(alpha: 0.32),
      ),
      MaterialStatusBadgeTone.reserved => (
        background: colors.warningSoft,
        foreground: colors.warningText,
        border: colors.warningBorder,
      ),
      MaterialStatusBadgeTone.reused => (
        background: colors.cardSurfaceAlt,
        foreground: colors.textMuted,
        border: colors.borderSubtle,
      ),
      MaterialStatusBadgeTone.draft => (
        background: colors.surfaceMuted,
        foreground: colors.textSecondary,
        border: colors.borderSubtle,
      ),
    };

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md - AppSpacing.xs,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: palette.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.border),
      ),
      child: Text(
        label,
        style: textTheme.labelSmall?.copyWith(
          color: palette.foreground,
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
