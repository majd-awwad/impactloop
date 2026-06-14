import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_radius.dart';
import 'app_spacing.dart';

/// Gradients, shadows, and reusable visual decorations.
abstract final class AppDecorations {
  static const LinearGradient brandingGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      AppColors.brandingGradientStart,
      AppColors.brandingGradientEnd,
    ],
  );

  static const LinearGradient mobileHeroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      AppColors.brandingGradientStart,
      AppColors.brandingGradientMid,
    ],
  );

  static BoxDecoration get authFormCard => BoxDecoration(
    color: AppColors.surfaceElevated,
    borderRadius: AppRadius.lgAll,
    boxShadow: const [
      BoxShadow(
        color: AppColors.shadow,
        blurRadius: 28,
        offset: Offset(0, 10),
      ),
      BoxShadow(
        color: AppColors.shadow,
        blurRadius: 8,
        offset: Offset(0, 2),
      ),
    ],
  );

  static BoxDecoration get featureBadge => BoxDecoration(
    color: AppColors.textOnBrand.withValues(alpha: 0.12),
    borderRadius: AppRadius.mdAll,
    border: Border.all(
      color: AppColors.textOnBrand.withValues(alpha: 0.18),
    ),
  );

  static BoxDecoration get mobileFeatureChip => BoxDecoration(
    color: AppColors.textOnBrand.withValues(alpha: 0.14),
    borderRadius: AppRadius.pillAll,
    border: Border.all(
      color: AppColors.textOnBrand.withValues(alpha: 0.2),
    ),
  );

  static BoxDecoration blob({
    required Color color,
    required double size,
  }) {
    return BoxDecoration(
      color: color,
      shape: BoxShape.circle,
    );
  }

  static List<Widget> brandingBlobLayer({bool compact = false}) {
    if (compact) {
      return const [
        Positioned(
          top: -28,
          right: -18,
          child: _BlobCircle(color: AppColors.blobPrimary, size: 120),
        ),
        Positioned(
          bottom: -36,
          left: -24,
          child: _BlobCircle(color: AppColors.blobSecondary, size: 96),
        ),
      ];
    }

    return const [
      Positioned(
        top: -60,
        right: -40,
        child: _BlobCircle(color: AppColors.blobPrimary, size: 220),
      ),
      Positioned(
        top: 120,
        left: -70,
        child: _BlobCircle(color: AppColors.blobSecondary, size: 180),
      ),
      Positioned(
        bottom: -50,
        right: 80,
        child: _BlobCircle(color: AppColors.blobAccent, size: 140),
      ),
    ];
  }

  static EdgeInsets authScreenPadding({required bool compact}) {
    return EdgeInsets.symmetric(
      horizontal: compact ? AppSpacing.md : AppSpacing.xl,
      vertical: compact ? AppSpacing.lg : AppSpacing.xl,
    );
  }
}

class _BlobCircle extends StatelessWidget {
  const _BlobCircle({
    required this.color,
    required this.size,
  });

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: AppDecorations.blob(color: color, size: size),
    );
  }
}
