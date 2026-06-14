import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';

class AuthRoleCard extends StatelessWidget {
  const AuthRoleCard({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    required this.isSelected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: isSelected,
      label: title,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.mdAll,
          child: Ink(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primaryContainer : AppColors.surface,
            borderRadius: AppRadius.mdAll,
            border: Border.all(
              color: isSelected ? AppColors.borderFocused : AppColors.border,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.primary.withValues(alpha: 0.14)
                      : AppColors.secondaryContainer,
                  borderRadius: AppRadius.smAll,
                ),
                child: Icon(
                  icon,
                  color: AppColors.primary,
                  size: 24,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppTextStyles.title(context)),
                    const SizedBox(height: AppSpacing.xs),
                    Text(description, style: AppTextStyles.subtitle(context)),
                  ],
                ),
              ),
              if (isSelected) ...[
                const SizedBox(width: AppSpacing.sm),
                Icon(
                  Icons.check_circle,
                  color: AppColors.primary,
                  size: AppSpacing.lg,
                ),
              ],
            ],
          ),
        ),
        ),
      ),
    );
  }
}
