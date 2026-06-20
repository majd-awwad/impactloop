import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_decorations.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import 'impact_loop_logo.dart';

enum DarkAuthBrandingVariant { full, compact }

class DarkAuthBrandingPanel extends StatelessWidget {
  const DarkAuthBrandingPanel({
    super.key,
    this.variant = DarkAuthBrandingVariant.full,
  });

  final DarkAuthBrandingVariant variant;

  static const _features = [
    (Icons.inventory_2_outlined, 'Find reusable materials nearby'),
    (Icons.lightbulb_outline, 'Build projects with less waste'),
    (Icons.recycling_outlined, 'Share surplus resources'),
  ];

  @override
  Widget build(BuildContext context) {
    final compact = variant == DarkAuthBrandingVariant.compact;

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: AuthDarkDecorations.brandingGradient,
      ),
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          ...AuthDarkDecorations.backgroundBlobs(compact: compact),
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: compact ? AppSpacing.lg : AppSpacing.xxl,
              vertical: compact ? AppSpacing.lg : AppSpacing.xxl,
            ),
            child: compact ? _CompactContent() : const _FullContent(),
          ),
        ],
      ),
    );
  }
}

class _FullContent extends StatelessWidget {
  const _FullContent();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          maxWidth: AppSpacing.authContentMaxWidth,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const ImpactLoopLogo(),
            const SizedBox(height: AppSpacing.xl),
            Text(
              'Learn. Reuse. Build.',
              style: AuthDarkTextStyles.brandingHeadline(context),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Discover reusable materials, share surplus resources, '
              'and build projects with less waste.',
              style: AuthDarkTextStyles.brandingSubtitle(context),
            ),
            const SizedBox(height: AppSpacing.xl),
            for (final feature in DarkAuthBrandingPanel._features) ...[
              _FeatureRow(icon: feature.$1, label: feature.$2),
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
        const ImpactLoopLogo(compact: true),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Learn. Reuse. Build.',
          style: AuthDarkTextStyles.subtitle(context),
        ),
      ],
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AuthDarkColors.accent, size: 20),
        const SizedBox(width: AppSpacing.sm),
        Expanded(child: Text(label, style: AuthDarkTextStyles.body(context))),
      ],
    );
  }
}
