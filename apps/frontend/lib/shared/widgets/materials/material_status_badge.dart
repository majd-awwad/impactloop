import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_text_styles.dart';
import 'materials_ui_palette.dart';

enum MaterialStatusBadgeTone {
  available,
  reserved,
  reused,
  draft,
}

class MaterialStatusBadge extends StatelessWidget {
  const MaterialStatusBadge({
    super.key,
    required this.label,
    required this.tone,
  });

  final String label;
  final MaterialStatusBadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final palette = switch (tone) {
      MaterialStatusBadgeTone.available => isDark
          ? (
              background: materialAvailableBackground,
              foreground: materialAvailableForeground,
              border: materialAvailableBorder,
            )
          : (
              background: const Color(0xFFE4F4EC),
              foreground: const Color(0xFF0F7A5A),
              border: const Color(0xFFB8D2C3),
            ),
      MaterialStatusBadgeTone.reserved => (
        background: isDark ? materialReservedBackground : const Color(0xFFFFF4DB),
        foreground: isDark ? materialReservedForeground : const Color(0xFF8A5A00),
        border: isDark ? materialReservedBorder : const Color(0xFFE5C574),
      ),
      MaterialStatusBadgeTone.reused => (
        background: isDark ? materialReusedBackground : const Color(0xFFF3F8F4),
        foreground: isDark ? materialReusedForeground : const Color(0xFF647268),
        border: isDark ? materialReusedBorder : const Color(0xFFD4E5D9),
      ),
      MaterialStatusBadgeTone.draft => (
        background: isDark ? materialDraftBackground : const Color(0xFFF3F8F4),
        foreground: isDark ? materialDraftForeground : const Color(0xFF647268),
        border: isDark ? materialDraftBorder : const Color(0xFFD4E5D9),
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
