import 'package:flutter/material.dart';

import '../../app/theme/app_radius.dart';
import '../../app/theme/app_spacing.dart';
import '../../app/theme/app_theme_colors.dart';

/// Cross-feature visual meanings for lifecycle, workflow, and feedback states.
enum AppStatusTone { primary, success, warning, danger, info, neutral }

/// Theme-aware visual values for a semantic status tone.
class AppStatusStyle {
  const AppStatusStyle({
    required this.background,
    required this.foreground,
    required this.border,
    required this.selectedBackground,
    required this.selectedBorder,
  });

  final Color background;
  final Color foreground;
  final Color border;
  final Color selectedBackground;
  final Color selectedBorder;

  factory AppStatusStyle.of(BuildContext context, AppStatusTone tone) {
    final colors = AppThemeColors.of(context);
    final palette = switch (tone) {
      AppStatusTone.primary => (
        background: colors.primarySoft,
        foreground: colors.primary,
        border: colors.primary.withValues(alpha: 0.32),
      ),
      AppStatusTone.success => (
        background: colors.successSoft,
        foreground: colors.success,
        border: colors.success.withValues(alpha: 0.36),
      ),
      AppStatusTone.warning => (
        background: colors.warningSoft,
        foreground: colors.warningText,
        border: colors.warningBorder,
      ),
      AppStatusTone.danger => (
        background: colors.dangerSoft,
        foreground: colors.danger,
        border: colors.danger.withValues(alpha: 0.38),
      ),
      AppStatusTone.info => (
        background: colors.info.withValues(alpha: 0.12),
        foreground: colors.info,
        border: colors.info.withValues(alpha: 0.38),
      ),
      AppStatusTone.neutral => (
        background: colors.surfaceMuted,
        foreground: colors.textSecondary,
        border: colors.borderSubtle,
      ),
    };

    return AppStatusStyle(
      background: palette.background,
      foreground: palette.foreground,
      border: palette.border,
      selectedBackground: palette.foreground.withValues(alpha: 0.16),
      selectedBorder: palette.foreground.withValues(alpha: 0.58),
    );
  }
}

/// Compact, route-independent presentation for a semantic status label.
class AppStatusBadge extends StatelessWidget {
  const AppStatusBadge({
    super.key,
    required this.label,
    required this.tone,
    this.dense = false,
  });

  final String label;
  final AppStatusTone tone;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, tone);

    return Container(
      padding: EdgeInsetsDirectional.symmetric(
        horizontal: dense
            ? AppSpacing.sm + 2
            : AppSpacing.md - AppSpacing.xs,
        vertical: dense ? AppSpacing.xs : AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: style.border),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: style.foreground,
          fontWeight: FontWeight.w700,
          height: 1.1,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

/// Semantic button styles for actions that confirm, reject, or advance a flow.
abstract final class AppStatusButtonStyle {
  static ButtonStyle filled(
    BuildContext context,
    AppStatusTone tone, {
    EdgeInsetsGeometry? padding,
    VisualDensity? visualDensity,
  }) {
    final status = AppStatusStyle.of(context, tone);

    return FilledButton.styleFrom(
      backgroundColor: status.foreground,
      foregroundColor: AppThemeColors.of(context).textOnPrimary,
      padding: padding,
      visualDensity: visualDensity,
    );
  }

  static ButtonStyle outlined(BuildContext context, AppStatusTone tone) {
    final status = AppStatusStyle.of(context, tone);

    return OutlinedButton.styleFrom(
      foregroundColor: status.foreground,
      side: BorderSide(color: status.border),
    );
  }

  static ButtonStyle text(BuildContext context, AppStatusTone tone) =>
      TextButton.styleFrom(
        foregroundColor: AppStatusStyle.of(context, tone).foreground,
      );
}
