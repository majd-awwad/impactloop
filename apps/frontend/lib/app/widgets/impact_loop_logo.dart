import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/auth_dark_text_styles.dart';
import '../theme/app_theme_colors.dart';

class ImpactLoopLogo extends StatelessWidget {
  const ImpactLoopLogo({
    super.key,
    this.compact = false,
    this.showWordmark = true,
    this.iconColor,
    this.iconSurfaceColor,
    this.borderColor,
    this.textColor,
  });

  final bool compact;
  final bool showWordmark;
  final Color? iconColor;
  final Color? iconSurfaceColor;
  final Color? borderColor;
  final Color? textColor;

  @override
  Widget build(BuildContext context) {
    final iconSize = compact ? 22.0 : 28.0;
    final colors = AppThemeColors.of(context);
    final accent = iconColor ?? colors.primary;
    final accentSurface = iconSurfaceColor ?? colors.primarySoft;
    final border = borderColor ?? colors.borderSubtle;
    final effectiveTextColor = textColor ?? colors.textPrimary;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: EdgeInsets.all(compact ? AppSpacing.xs : AppSpacing.sm),
          decoration: BoxDecoration(
            color: accentSurface,
            borderRadius: AppRadius.smAll,
            border: Border.all(color: border),
          ),
          child: Icon(Icons.eco, color: accent, size: iconSize),
        ),
        if (showWordmark) ...[
          SizedBox(width: compact ? AppSpacing.sm : AppSpacing.md),
          Text(
            'ImpactLoop',
            style:
                (compact
                        ? AuthDarkTextStyles.navBrand(context)
                        : AuthDarkTextStyles.brandingHeadline(
                            context,
                          ).copyWith(fontSize: compact ? 18 : 22))
                    .copyWith(color: effectiveTextColor),
          ),
        ],
      ],
    );
  }
}
