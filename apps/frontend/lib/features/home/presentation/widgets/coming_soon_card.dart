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
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.lgAll,
        child: Container(
          constraints: const BoxConstraints(minHeight: 172),
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: materialPanelSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: materialBorderSubtle),
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
                      color: materialMutedSurface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: materialBorderSubtle),
                    ),
                    child: Icon(icon, color: materialTextSecondary, size: 21),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: materialMutedSurface,
                      borderRadius: AppRadius.pillAll,
                      border: Border.all(color: materialBorderSubtle),
                    ),
                    child: Text(
                      'Coming soon',
                      style: AppTextStyles.label(context).copyWith(
                        color: materialTextSecondary,
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
                ).copyWith(color: materialTextPrimary, letterSpacing: 0),
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                description,
                style: AppTextStyles.body(context).copyWith(
                  color: materialTextSecondary,
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
