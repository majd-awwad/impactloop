import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';

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

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: EdgeInsets.all(compact ? AppSpacing.xs : AppSpacing.sm),
          decoration: BoxDecoration(
            color: AuthDarkColors.accentSoft,
            borderRadius: AppRadius.smAll,
            border: Border.all(color: AuthDarkColors.border),
          ),
          child: Icon(
            Icons.eco,
            color: AuthDarkColors.accent,
            size: iconSize,
          ),
        ),
        if (showWordmark) ...[
          SizedBox(width: compact ? AppSpacing.sm : AppSpacing.md),
          Text(
            'ImpactLoop',
            style: compact
                ? AuthDarkTextStyles.navBrand(context)
                : AuthDarkTextStyles.brandingHeadline(context).copyWith(
                    fontSize: compact ? 18 : 22,
                  ),
          ),
        ],
      ],
    );
  }
}
