import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_decorations.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import 'auth_feature_badge.dart';

enum AuthBrandingVariant { full, compact }

class AuthBrandingPanel extends StatelessWidget {
  const AuthBrandingPanel({
    super.key,
    this.variant = AuthBrandingVariant.full,
  });

  final AuthBrandingVariant variant;

  static const _features = [
    (Icons.inventory_2_outlined, 'Find reusable materials nearby'),
    (Icons.lightbulb_outline, 'Build projects smarter'),
    (Icons.recycling_outlined, 'Reduce waste with every reservation'),
  ];

  @override
  Widget build(BuildContext context) {
    final compact = variant == AuthBrandingVariant.compact;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: compact
            ? AppDecorations.mobileHeroGradient
            : AppDecorations.brandingGradient,
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          ...AppDecorations.brandingBlobLayer(compact: compact),
          Padding(
            padding: AppDecorations.authScreenPadding(compact: compact),
            child: compact
                ? SingleChildScrollView(
                    child: _CompactContent(),
                  )
                : _FullContent(),
          ),
        ],
      ),
    );
  }
}

class _FullContent extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: AppSpacing.authContentMaxWidth),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.textOnBrand.withValues(alpha: 0.14),
                    borderRadius: AppRadius.smAll,
                  ),
                  child: const Icon(
                    Icons.eco,
                    color: AppColors.textOnBrand,
                    size: 28,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text('ImpactLoop', style: AppTextStyles.brandingTitle(context)),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Learn. Reuse. Build.',
              style: AppTextStyles.brandingHeadline(context),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'An eco-tech platform where learners discover surplus materials, '
              'find project parts, and build with less waste.',
              style: AppTextStyles.brandingSubtitle(context),
            ),
            const SizedBox(height: AppSpacing.xl),
            for (final feature in AuthBrandingPanel._features) ...[
              AuthFeatureBadge(icon: feature.$1, label: feature.$2),
              const SizedBox(height: AppSpacing.sm),
            ],
          ],
        ),
      ),
    );
  }
}

class _CompactContent extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: AppColors.textOnBrand.withValues(alpha: 0.14),
                borderRadius: AppRadius.smAll,
              ),
              child: const Icon(Icons.eco, color: AppColors.textOnBrand, size: 22),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                'ImpactLoop',
                style: AppTextStyles.mobileHeroTitle(context),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Learn. Reuse. Build.',
          style: AppTextStyles.mobileHeroSubtitle(context),
        ),
        const SizedBox(height: AppSpacing.md),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (var i = 0; i < AuthBrandingPanel._features.length; i++) ...[
                if (i > 0) const SizedBox(width: AppSpacing.sm),
                AuthFeatureBadge(
                  compact: true,
                  icon: AuthBrandingPanel._features[i].$1,
                  label: _shortLabel(AuthBrandingPanel._features[i].$2),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  String _shortLabel(String label) {
    if (label.startsWith('Find reusable')) return 'Find materials';
    if (label.startsWith('Build projects')) return 'Build smarter';
    return 'Reduce waste';
  }
}
