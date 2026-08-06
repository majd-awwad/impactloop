import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../help_session_status_utils.dart';

class HelpSessionTimeCard extends StatelessWidget {
  const HelpSessionTimeCard({
    super.key,
    required this.startsAt,
    required this.timezone,
    this.selected = false,
    this.highlighted = false,
    this.selectable = false,
    this.onTap,
    this.relativeLabel,
  });

  final DateTime startsAt;
  final String timezone;
  final bool selected;
  final bool highlighted;
  final bool selectable;
  final VoidCallback? onTap;
  final String? relativeLabel;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final formatted = formatHelpSessionDateTime(context, startsAt, timezone);
    final borderColor = selected || highlighted
        ? palette.mint
        : palette.borderSubtle;
    final background = selected || highlighted
        ? palette.mint.withValues(alpha: 0.08)
        : palette.panelSurface;

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Semantics(
        selected: selected,
        button: selectable && onTap != null,
        label: formatted,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: selectable ? onTap : null,
            borderRadius: AppRadius.mdAll,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: background,
                borderRadius: AppRadius.mdAll,
                border: Border.all(
                  color: borderColor,
                  width: selected || highlighted ? 2 : 1,
                ),
              ),
              child: Row(
                children: [
                  if (selectable)
                    Icon(
                      selected
                          ? Icons.radio_button_checked
                          : Icons.radio_button_off,
                      color: selected ? palette.mint : palette.textMuted,
                    )
                  else if (highlighted)
                    Icon(Icons.star_rounded, color: palette.mint, size: 20)
                  else
                    Icon(Icons.schedule_rounded, color: palette.textMuted),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          formatted,
                          style: AppTextStyles.label(context).copyWith(
                            fontWeight:
                                selected || highlighted ? FontWeight.w700 : null,
                          ),
                        ),
                        if (relativeLabel != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            relativeLabel!,
                            style: AppTextStyles.label(context).copyWith(
                              color: palette.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
