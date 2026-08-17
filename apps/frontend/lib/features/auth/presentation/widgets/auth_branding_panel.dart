import 'package:flutter/material.dart';

import '../../../../l10n/l10n.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_decorations.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import 'auth_feature_badge.dart';

enum AuthBrandingVariant { full, compact }

class AuthBrandingPanel extends StatelessWidget {
  const AuthBrandingPanel({super.key, this.variant = AuthBrandingVariant.full});

  final AuthBrandingVariant variant;

  static List<(IconData, String)> _features(AppLocalizations l10n) => [
    (Icons.inventory_2, l10n.authFeatureFindNearbyLong),
    (Icons.lightbulb, l10n.authFeatureBuildSmarter),
    (Icons.recycling, l10n.authFeatureReduceWasteReservation),
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
                ? SingleChildScrollView(child: _CompactContent())
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
    final colors = AppThemeColors.of(context);

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          maxWidth: AppSpacing.authContentMaxWidth,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: colors.textOnPrimary.withValues(alpha: 0.14),
                    borderRadius: AppRadius.smAll,
                  ),
                  child: Icon(Icons.eco, color: colors.textOnPrimary, size: 28),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(context.l10n.authBrandTitle, style: AppTextStyles.brandingTitle(context)),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              context.l10n.learnReuseBuild,
              style: AppTextStyles.brandingHeadline(context),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              context.l10n.authBrandingSubtitle,
              style: AppTextStyles.brandingSubtitle(context),
            ),
            const SizedBox(height: AppSpacing.xl),
            for (final feature in AuthBrandingPanel._features(context.l10n)) ...[
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
    final colors = AppThemeColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: colors.textOnPrimary.withValues(alpha: 0.14),
                borderRadius: AppRadius.smAll,
              ),
              child: Icon(Icons.eco, color: colors.textOnPrimary, size: 22),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                context.l10n.authBrandTitle,
                style: AppTextStyles.mobileHeroTitle(context),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          context.l10n.learnReuseBuild,
          style: AppTextStyles.mobileHeroSubtitle(context),
        ),
        const SizedBox(height: AppSpacing.md),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (var i = 0; i < AuthBrandingPanel._features(context.l10n).length; i++) ...[
                if (i > 0) const SizedBox(width: AppSpacing.sm),
                AuthFeatureBadge(
                  compact: true,
                  icon: AuthBrandingPanel._features(context.l10n)[i].$1,
                  label: _shortLabel(context.l10n, i),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  String _shortLabel(AppLocalizations l10n, int index) {
    return switch (index) {
      0 => l10n.authFeatureFindMaterialsShort,
      1 => l10n.authFeatureBuildSmarterShort,
      _ => l10n.authFeatureReduceWasteShort,
    };
  }
}
