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
          constraints: const BoxConstraints(minHeight: 172),
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: palette.panelSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: palette.mutedSurface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: palette.borderSubtle),
                    ),
                    child: Icon(icon, color: palette.textSecondary, size: 21),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: palette.mutedSurface,
                      borderRadius: AppRadius.pillAll,
                      border: Border.all(color: palette.borderSubtle),
                    ),
                    child: Text(
                      'Coming soon',
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textSecondary,
                        fontSize: 12,
                        letterSpacing: 0,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                title,
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textPrimary, letterSpacing: 0),
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                description,
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textSecondary,
                  height: 1.45,
                  letterSpacing: 0,
                ),
                textAlign: TextAlign.start,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
