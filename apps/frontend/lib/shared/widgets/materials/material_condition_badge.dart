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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final palette = switch (tone) {
      MaterialConditionBadgeTone.likeNew => (
        background: isDark
            ? materialConditionLikeNewBackground
            : const Color(0xFFF3F8F4),
        foreground: isDark
            ? materialConditionLikeNewForeground
            : const Color(0xFF102019),
        border: isDark ? materialBorderStrong : const Color(0xFFD4E5D9),
      ),
      MaterialConditionBadgeTone.good => (
        background: isDark
            ? materialConditionGoodBackground
            : const Color(0xFFF3F8F4),
        foreground: isDark
            ? materialConditionGoodForeground
            : const Color(0xFF506258),
        border: isDark ? materialBorderStrong : const Color(0xFFD4E5D9),
      ),
      MaterialConditionBadgeTone.fair => (
        background: isDark
            ? materialConditionFairBackground
            : const Color(0xFFFFF4DB),
        foreground: isDark
            ? materialConditionFairForeground
            : const Color(0xFF8A5A00),
        border: isDark ? materialReservedBorder : const Color(0xFFE5C574),
      ),
      MaterialConditionBadgeTone.mixed => (
        background: isDark
            ? materialConditionMixedBackground
            : const Color(0xFFF3F8F4),
        foreground: isDark
            ? materialConditionMixedForeground
            : const Color(0xFF506258),
        border: isDark ? materialBorderSubtle : const Color(0xFFD4E5D9),
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
