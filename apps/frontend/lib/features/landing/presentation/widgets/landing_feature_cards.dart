import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/landing_colors.dart';

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
    final colors = LandingColors.of(context);
    final card = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: colors.primarySoft,
            boxShadow: [
              BoxShadow(
                color: colors.primary.withValues(alpha: 0.16),
                blurRadius: 14,
              ),
            ],
          ),
          child: Icon(icon, color: colors.primary, size: 24),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          title,
          style: AuthDarkTextStyles.title(
            context,
          ).copyWith(color: colors.textPrimary, fontSize: 18),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          description,
          style: AuthDarkTextStyles.body(
            context,
          ).copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.md),
        TextButton(
          onPressed: () => context.go(route),
          style: TextButton.styleFrom(
            foregroundColor: colors.primary,
            padding: EdgeInsets.zero,
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            alignment: Alignment.centerLeft,
          ),
          child: Text(
            '$linkLabel ->',
            style: AuthDarkTextStyles.link(
              context,
            ).copyWith(color: colors.primary),
          ),
        ),
      ],
    );

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: isDark ? colors.surfaceGlass : colors.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.border),
        boxShadow: [
          BoxShadow(
            color: colors.primary.withValues(alpha: isDark ? 0.08 : 0.06),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: card,
    );
  }
}
