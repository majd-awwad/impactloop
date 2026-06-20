import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_decorations.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';

class LandingFeatureCards extends StatelessWidget {
  const LandingFeatureCards({super.key});

  static const _features = [
    (
      Icons.search,
      'Find reusable materials',
      'Browse a wide range of materials donated by your community.',
      'Explore materials',
      '/register',
    ),
    (
      Icons.inventory_2_outlined,
      'Share surplus materials',
      'List what you no longer need and help others build more.',
      'Share materials',
      '/register',
    ),
    (
      Icons.handyman_outlined,
      'Build with less waste',
      'Save money, reduce waste, and bring creative projects to life.',
      'Start building',
      '/register',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final useColumn = MediaQuery.sizeOf(context).width < 960;

    if (useColumn) {
      return Column(
        children: [
          for (var i = 0; i < _features.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.md),
            _FeatureCard(feature: _features[i]),
          ],
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < _features.length; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.md),
          Expanded(child: _FeatureCard(feature: _features[i])),
        ],
      ],
    );
  }
}

class _FeatureCard extends StatelessWidget {
  const _FeatureCard({required this.feature});

  final (IconData, String, String, String, String) feature;

  @override
  Widget build(BuildContext context) {
    final (icon, title, description, linkLabel, route) = feature;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final card = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isDark ? AuthDarkColors.accentSoft : AppColors.accentSoft,
            boxShadow: [
              BoxShadow(
                color: (isDark ? AuthDarkColors.accent : AppColors.primary)
                    .withValues(alpha: 0.16),
                blurRadius: 14,
              ),
            ],
          ),
          child: Icon(
            icon,
            color: isDark ? AuthDarkColors.accent : AppColors.primary,
            size: 24,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          title,
          style: AuthDarkTextStyles.title(context).copyWith(
            color: isDark ? AuthDarkColors.textPrimary : AppColors.textPrimary,
            fontSize: 18,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          description,
          style: AuthDarkTextStyles.body(context).copyWith(
            color: isDark
                ? AuthDarkColors.textSecondary
                : AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        TextButton(
          onPressed: () => context.go(route),
          style: TextButton.styleFrom(
            foregroundColor: isDark ? AuthDarkColors.accent : AppColors.primary,
            padding: EdgeInsets.zero,
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            alignment: Alignment.centerLeft,
          ),
          child: Text(
            '$linkLabel ->',
            style: AuthDarkTextStyles.link(context).copyWith(
              color: isDark ? AuthDarkColors.accent : AppColors.primary,
            ),
          ),
        ),
      ],
    );

    if (!isDark) {
      return Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: AppRadius.lgAll,
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: card,
      );
    }

    return AuthDarkDecorations.glassSurface(
      padding: const EdgeInsets.all(AppSpacing.lg),
      borderRadius: AppRadius.lgAll,
      child: card,
    );
  }
}
