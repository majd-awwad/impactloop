import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/auth_dark_colors.dart';
import '../theme/auth_dark_text_styles.dart';

class ImpactLoopLogo extends StatelessWidget {
  const ImpactLoopLogo({
    super.key,
    this.compact = false,
    this.showWordmark = true,
  });

  final bool compact;
  final bool showWordmark;

  @override
  Widget build(BuildContext context) {
    final iconSize = compact ? 22.0 : 28.0;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = isDark ? AuthDarkColors.accent : AppColors.primary;
    final accentSurface = isDark
        ? AuthDarkColors.accentSoft
        : AppColors.primaryContainer;
    final border = isDark ? AuthDarkColors.border : AppColors.border;
    final textColor = isDark ? AuthDarkColors.textPrimary : AppColors.textPrimary;

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
                    .copyWith(color: textColor),
          ),
        ],
      ],
    );
  }
}
