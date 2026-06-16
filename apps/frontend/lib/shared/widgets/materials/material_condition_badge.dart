import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
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
      ),
      MaterialConditionBadgeTone.good => (
        background: materialConditionGoodBackground,
        foreground: materialConditionGoodForeground,
      ),
      MaterialConditionBadgeTone.fair => (
        background: materialConditionFairBackground,
        foreground: materialConditionFairForeground,
      ),
      MaterialConditionBadgeTone.mixed => (
        background: materialConditionMixedBackground,
        foreground: materialConditionMixedForeground,
      ),
    };

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.background,
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        label,
        style: AppTextStyles.label(
          context,
        ).copyWith(color: palette.foreground, fontSize: 12),
        textAlign: TextAlign.start,
      ),
    );
  }
}
