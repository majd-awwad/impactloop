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
    final palette = switch (tone) {
      MaterialStatusBadgeTone.available => (
        background: materialAvailableBackground,
        foreground: materialAvailableForeground,
        border: materialAvailableBorder,
      ),
      MaterialStatusBadgeTone.reserved => (
        background: materialReservedBackground,
        foreground: materialReservedForeground,
        border: materialReservedBorder,
      ),
      MaterialStatusBadgeTone.reused => (
        background: materialReusedBackground,
        foreground: materialReusedForeground,
        border: materialReusedBorder,
      ),
      MaterialStatusBadgeTone.draft => (
        background: materialDraftBackground,
        foreground: materialDraftForeground,
        border: materialDraftBorder,
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
