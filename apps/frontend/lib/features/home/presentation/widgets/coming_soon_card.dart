import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

class ComingSoonCard extends StatelessWidget {
  const ComingSoonCard({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.lgAll,
        child: Container(
          width: double.infinity,
          constraints: const BoxConstraints(minHeight: 156),
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: palette.panelSurface.withValues(alpha: 0.74),
            borderRadius: AppRadius.lgAll,
            border: Border.all(
              color: palette.borderSubtle.withValues(alpha: 0.82),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: palette.mutedSurface.withValues(alpha: 0.66),
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(
                        color: palette.borderSubtle.withValues(alpha: 0.76),
                      ),
                    ),
                    child: Icon(icon, color: palette.textMuted, size: 20),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: palette.mutedSurface.withValues(alpha: 0.58),
                      borderRadius: AppRadius.pillAll,
                      border: Border.all(
                        color: palette.borderSubtle.withValues(alpha: 0.72),
                      ),
                    ),
                    child: Text(
                      'Coming soon',
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textMuted,
                        fontSize: 11.5,
                        letterSpacing: 0,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                title,
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textSecondary, letterSpacing: 0),
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                description,
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textMuted,
                  height: 1.45,
                  letterSpacing: 0,
                ),
                textAlign: TextAlign.start,
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
