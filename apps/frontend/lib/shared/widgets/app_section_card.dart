import 'package:flutter/material.dart';

import '../../app/theme/app_radius.dart';
import '../../app/theme/app_spacing.dart';
import '../../app/theme/app_theme_colors.dart';
import 'app_status_badge.dart';

/// A theme-aware, content-agnostic section surface for app-level UI.
class AppSectionCard extends StatelessWidget {
  const AppSectionCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
    this.height,
    this.borderRadius,
    this.tone,
    this.emphasized = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double? height;
  final BorderRadiusGeometry? borderRadius;
  final AppStatusTone? tone;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final statusStyle = tone == null
        ? null
        : AppStatusStyle.of(context, tone!);

    return Container(
      width: double.infinity,
      height: height,
      padding: padding,
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: borderRadius ?? AppRadius.lgAll,
        border: Border.all(
          color: statusStyle?.border ?? colors.borderSubtle,
        ),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: emphasized ? 0.12 : 0.08),
            blurRadius: emphasized ? 18 : 16,
            offset: Offset(0, emphasized ? 8 : 6),
          ),
        ],
      ),
      child: child,
    );
  }
}
