import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_text_styles.dart';
import 'materials_ui_palette.dart';

enum MaterialConditionBadgeTone {
  likeNew,
  good,
  fair,
  mixed,
}

class MaterialConditionBadge extends StatelessWidget {
  const MaterialConditionBadge({
    super.key,
    required this.label,
    required this.tone,
  });

  final String label;
  final MaterialConditionBadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final palette = switch (tone) {
      MaterialConditionBadgeTone.likeNew => (
        background: materialConditionLikeNewBackground,
        foreground: materialConditionLikeNewForeground,
        border: materialBorderStrong,
      ),
      MaterialConditionBadgeTone.good => (
        background: materialConditionGoodBackground,
        foreground: materialConditionGoodForeground,
        border: materialBorderStrong,
      ),
      MaterialConditionBadgeTone.fair => (
        background: materialConditionFairBackground,
        foreground: materialConditionFairForeground,
        border: materialReservedBorder,
      ),
      MaterialConditionBadgeTone.mixed => (
        background: materialConditionMixedBackground,
        foreground: materialConditionMixedForeground,
        border: materialBorderSubtle,
      ),
    };

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: materialBadgeHorizontalPadding,
        vertical: materialBadgeVerticalPadding,
      ),
      decoration: BoxDecoration(
        color: palette.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.border),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(
          context,
        ).copyWith(
          color: palette.foreground,
          fontSize: materialBadgeFontSize,
          fontWeight: FontWeight.w700,
          height: 1.1,
        ),
        textAlign: TextAlign.start,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}
