import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';

/// Visual tokens for the reservation form — mostly neutral, green as accent only.
class ReservationFormTheme {
  const ReservationFormTheme._();

  static const sectionGap = 26.0;
  static const titleToContentGap = 12.0;
  static const fieldGap = 14.0;
  static const selectorCardMinHeight = 88.0;
  static const selectorCardMaxHeight = 100.0;

  static const sectionIconSize = 21.0;
  static const cardIconSize = 24.0;
  static const metaIconSize = 17.0;
  static const ctaIconSize = 18.0;

  static Color selectedTint(MaterialsUiPalette palette) =>
      palette.mint.withValues(alpha: 0.04);

  static Color selectedBorder(MaterialsUiPalette palette) => palette.mint;

  static BoxDecoration surfaceCard(MaterialsUiPalette palette) {
    return BoxDecoration(
      color: palette.panelSurface,
      borderRadius: AppRadius.mdAll,
      border: Border.all(color: palette.borderSubtle),
    );
  }

  static BoxDecoration selectorDecoration({
    required MaterialsUiPalette palette,
    required bool selected,
    required bool enabled,
  }) {
    return BoxDecoration(
      color: selected ? selectedTint(palette) : palette.panelSurface,
      borderRadius: AppRadius.mdAll,
      border: Border.all(
        color: selected
            ? selectedBorder(palette)
            : palette.borderSubtle,
        width: selected ? 1.5 : 1,
      ),
    );
  }

  static InputDecoration inputDecoration(
    BuildContext context, {
    String? hintText,
    String? helperText,
    String? labelText,
  }) {
    final palette = MaterialsUiPalette.of(context);

    return InputDecoration(
      labelText: labelText,
      hintText: hintText,
      helperText: helperText,
      helperStyle: AppTextStyles.label(
        context,
      ).copyWith(color: palette.textMuted, fontSize: 12),
      filled: true,
      fillColor: palette.panelSurface,
      contentPadding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.sm,
      ),
      border: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: BorderSide(color: palette.borderSubtle),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: BorderSide(color: palette.borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: BorderSide(color: palette.mint, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: BorderSide(color: materialDanger),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: BorderSide(color: materialDanger, width: 1.5),
      ),
    );
  }

  static TextStyle sectionTitleStyle(
    BuildContext context,
    MaterialsUiPalette palette,
  ) {
    return AppTextStyles.body(context).copyWith(
      color: palette.textPrimary,
      fontWeight: FontWeight.w600,
      fontSize: 15,
      height: 1.3,
    );
  }

  static TextStyle fieldLabelStyle(
    BuildContext context,
    MaterialsUiPalette palette,
  ) {
    return AppTextStyles.label(context).copyWith(
      color: palette.textPrimary,
      fontWeight: FontWeight.w500,
      fontSize: 13,
    );
  }

  static TextStyle helperStyle(
    BuildContext context,
    MaterialsUiPalette palette,
  ) {
    return AppTextStyles.label(context).copyWith(
      color: palette.textMuted,
      fontSize: 12,
      height: 1.4,
    );
  }
}

/// Compact horizontal option card for fulfillment / payment selectors.
class ReservationOptionCard extends StatelessWidget {
  const ReservationOptionCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool selected;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: AppRadius.mdAll,
        hoverColor: enabled
            ? palette.borderSubtle.withValues(alpha: 0.35)
            : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          constraints: const BoxConstraints(
            minHeight: ReservationFormTheme.selectorCardMinHeight,
            maxHeight: ReservationFormTheme.selectorCardMaxHeight,
          ),
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.sm,
            AppSpacing.sm,
            AppSpacing.sm,
            AppSpacing.sm,
          ),
          decoration: ReservationFormTheme.selectorDecoration(
            palette: palette,
            selected: selected,
            enabled: enabled,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: ReservationFormTheme.cardIconSize,
                color: selected
                    ? palette.mint
                    : (enabled ? palette.textPrimary : palette.textMuted),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.body(context).copyWith(
                        color: enabled
                            ? palette.textPrimary
                            : palette.textMuted,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: ReservationFormTheme.helperStyle(context, palette),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              if (selected)
                Icon(
                  Icons.check_circle_rounded,
                  color: palette.mint,
                  size: 20,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
