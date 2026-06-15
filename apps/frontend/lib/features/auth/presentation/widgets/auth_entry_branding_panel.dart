import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_decorations.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/widgets/impact_loop_logo.dart';
import 'auth_branding_assets.dart';

enum AuthEntryBrandingVariant { login, register }

class AuthEntryBrandingPanel extends StatelessWidget {
  const AuthEntryBrandingPanel({
    super.key,
    required this.variant,
    this.compact = false,
  });

  final AuthEntryBrandingVariant variant;
  final bool compact;

  static const _features = [
    (Icons.search, 'Find reusable materials'),
    (Icons.inventory_2_outlined, 'Share surplus resources'),
    (Icons.handyman_outlined, 'Build with less waste'),
  ];

  String get _imageAsset => switch (variant) {
        AuthEntryBrandingVariant.login => AuthBrandingAssets.loginImage,
        AuthEntryBrandingVariant.register => AuthBrandingAssets.registerImage,
      };

  String get _headlineMiddle => switch (variant) {
        AuthEntryBrandingVariant.login => 'Reuse',
        AuthEntryBrandingVariant.register => 'Share',
      };

  String get _description => switch (variant) {
        AuthEntryBrandingVariant.login =>
          'Discover reusable materials, share surplus resources, '
          'and bring creative projects to life with less waste.',
        AuthEntryBrandingVariant.register =>
          'Create one account to find components, list surplus materials, '
          'or join as both a learner and a supplier in your community.',
      };

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return AuthDarkDecorations.glassSurface(
        borderRadius: AppRadius.lgAll,
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const ImpactLoopLogo(compact: true),
            const SizedBox(height: AppSpacing.sm),
            _Headline(middle: _headlineMiddle, compact: true),
            const SizedBox(height: AppSpacing.sm),
            Text(_description, style: AuthDarkTextStyles.body(context)),
          ],
        ),
      );
    }

    return AuthDarkDecorations.glassSurface(
      borderRadius: AppRadius.xlAll,
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ImpactLoopLogo(),
          const SizedBox(height: AppSpacing.xl),
          _Headline(middle: _headlineMiddle),
          const SizedBox(height: AppSpacing.md),
          Text(
            _description,
            style: AuthDarkTextStyles.brandingSubtitle(context),
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final feature in _features)
                _FeatureChip(icon: feature.$1, label: feature.$2),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          _MissionStrip(variant: variant),
          const SizedBox(height: AppSpacing.lg),
          _BrandingImage(assetPath: _imageAsset),
        ],
      ),
    );
  }
}

class _Headline extends StatelessWidget {
  const _Headline({required this.middle, this.compact = false});

  final String middle;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return RichText(
      text: TextSpan(
        style: AuthDarkTextStyles.brandingHeadline(context).copyWith(
          fontSize: compact ? 24 : 36,
          height: 1.15,
        ),
        children: [
          const TextSpan(text: 'Learn. '),
          TextSpan(
            text: '$middle. ',
            style: const TextStyle(color: AuthDarkColors.accent),
          ),
          const TextSpan(text: 'Build.'),
        ],
      ),
    );
  }
}

class _FeatureChip extends StatelessWidget {
  const _FeatureChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
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
          Icon(icon, size: 16, color: AuthDarkColors.accent),
          const SizedBox(width: AppSpacing.xs),
          Text(label, style: AuthDarkTextStyles.chip(context)),
        ],
      ),
    );
  }
}

class _MissionStrip extends StatelessWidget {
  const _MissionStrip({required this.variant});

  final AuthEntryBrandingVariant variant;

  @override
  Widget build(BuildContext context) {
    final message = switch (variant) {
      AuthEntryBrandingVariant.login =>
        'Every reuse keeps materials out of landfills and helps '
        'students, makers, and workshops build smarter.',
      AuthEntryBrandingVariant.register =>
        'Join students, makers, and suppliers who are turning surplus '
        'into opportunity across the community.',
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AuthDarkColors.accentSoft,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: AuthDarkColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.eco, color: AuthDarkColors.accent, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(message, style: AuthDarkTextStyles.body(context)),
          ),
        ],
      ),
    );
  }
}

class _BrandingImage extends StatelessWidget {
  const _BrandingImage({required this.assetPath});

  final String assetPath;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.lgAll,
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Image.asset(
          assetPath,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) {
            return Image.asset(
              AuthBrandingAssets.fallbackImage,
              fit: BoxFit.cover,
              errorBuilder: (context, fallbackError, fallbackStack) {
                return _ImagePlaceholder(primaryPath: assetPath);
              },
            );
          },
        ),
      ),
    );
  }
}

class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder({required this.primaryPath});

  final String primaryPath;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AuthDarkColors.surfaceSolid,
        border: Border.all(color: AuthDarkColors.border),
        borderRadius: AppRadius.lgAll,
      ),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.add_photo_alternate_outlined,
                size: 40,
                color: AuthDarkColors.accent.withValues(alpha: 0.7),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Add your image here',
                style: AuthDarkTextStyles.title(context).copyWith(fontSize: 16),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                primaryPath,
                style: AuthDarkTextStyles.label(context).copyWith(
                  color: AuthDarkColors.accent,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
