import 'package:flutter/material.dart';

import '../../app/theme/app_spacing.dart';
import '../../app/theme/app_theme_colors.dart';
import 'app_section_card.dart';
import 'app_status_badge.dart';

/// A cross-feature empty or unavailable state with optional display actions.
class AppEmptyStateCard extends StatelessWidget {
  const AppEmptyStateCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actions = const [],
    this.tone = AppStatusTone.neutral,
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final List<Widget> actions;
  final AppStatusTone tone;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final statusStyle = AppStatusStyle.of(context, tone);
    final iconSize = compact ? 28.0 : 40.0;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: AppSectionCard(
          tone: tone,
          padding: EdgeInsetsDirectional.all(
            compact ? AppSpacing.lg : AppSpacing.xl,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: iconSize, color: statusStyle.foreground),
              SizedBox(height: compact ? AppSpacing.sm : AppSpacing.md),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              SizedBox(height: compact ? AppSpacing.xs : AppSpacing.sm),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colors.textSecondary,
                ),
              ),
              if (actions.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  alignment: WrapAlignment.center,
                  children: actions,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
