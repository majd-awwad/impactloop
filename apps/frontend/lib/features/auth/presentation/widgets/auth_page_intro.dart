import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';

class AuthPageIntro extends StatelessWidget {
  const AuthPageIntro({
    super.key,
    required this.badge,
    required this.title,
    this.highlight,
    this.subtitle,
    this.align = CrossAxisAlignment.start,
  });

  final String badge;
  final String title;
  final String? highlight;
  final String? subtitle;
  final CrossAxisAlignment align;

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.sizeOf(context).width >= 960;

    return Column(
      crossAxisAlignment: align,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: AuthDarkColors.chipUnselected,
            borderRadius: AppRadius.pillAll,
            border: Border.all(color: AuthDarkColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.eco, size: 16, color: AuthDarkColors.accent),
              const SizedBox(width: AppSpacing.xs),
              Text(
                badge,
                style: AuthDarkTextStyles.chip(context).copyWith(
                  color: AuthDarkColors.accent,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (highlight != null)
          RichText(
            textAlign: align == CrossAxisAlignment.center
                ? TextAlign.center
                : TextAlign.start,
            text: TextSpan(
              style: AuthDarkTextStyles.brandingHeadline(context).copyWith(
                fontSize: isWide ? 40 : 32,
              ),
              children: [
                TextSpan(text: title),
                TextSpan(
                  text: highlight,
                  style: const TextStyle(color: AuthDarkColors.accent),
                ),
              ],
            ),
          )
        else
          Text(
            title,
            textAlign: align == CrossAxisAlignment.center
                ? TextAlign.center
                : TextAlign.start,
            style: AuthDarkTextStyles.brandingHeadline(context).copyWith(
              fontSize: isWide ? 40 : 32,
            ),
          ),
        if (subtitle != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            subtitle!,
            textAlign: align == CrossAxisAlignment.center
                ? TextAlign.center
                : TextAlign.start,
            style: AuthDarkTextStyles.brandingSubtitle(context),
          ),
        ],
      ],
    );
  }
}
