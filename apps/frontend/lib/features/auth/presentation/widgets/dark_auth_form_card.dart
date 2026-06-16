import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_decorations.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';

class AuthIntentChip extends StatelessWidget {
  const AuthIntentChip({
    super.key,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AuthDarkColors.surface.withValues(alpha: 0),
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: isSelected
                ? AuthDarkColors.chipSelected
                : AuthDarkColors.chipUnselected,
            borderRadius: AppRadius.pillAll,
            border: Border.all(
              color: isSelected
                  ? AuthDarkColors.borderFocused
                  : AuthDarkColors.border,
            ),
          ),
          child: Text(
            label,
            style: AuthDarkTextStyles.chip(context).copyWith(
              color: isSelected
                  ? AuthDarkColors.accent
                  : AuthDarkColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

class DarkAuthFormCard extends StatelessWidget {
  const DarkAuthFormCard({super.key, required this.child, this.footer});

  final Widget child;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final isCompact = MediaQuery.sizeOf(context).width < 420;

    return Container(
      decoration: BoxDecoration(
        color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.96),
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: AuthDarkColors.border),
        boxShadow: [
          BoxShadow(
            color: AuthDarkColors.background.withValues(alpha: 0.28),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: AuthDarkDecorations.glassSurface(
        borderRadius: AppRadius.xlAll,
        padding: EdgeInsets.all(isCompact ? AppSpacing.md : AppSpacing.lg),
        useBlur: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 4,
              width: isCompact ? 56 : 72,
              decoration: BoxDecoration(
                color: AuthDarkColors.accent,
                borderRadius: AppRadius.pillAll,
              ),
            ),
            SizedBox(height: isCompact ? AppSpacing.md : AppSpacing.lg),
            child,
            if (footer != null) ...[
              SizedBox(height: isCompact ? AppSpacing.md : AppSpacing.lg),
              footer!,
            ],
          ],
        ),
      ),
    );
  }
}

class DarkAuthHeader extends StatelessWidget {
  const DarkAuthHeader({
    super.key,
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: AuthDarkTextStyles.display(context)),
        const SizedBox(height: AppSpacing.sm),
        Text(subtitle, style: AuthDarkTextStyles.subtitle(context)),
      ],
    );
  }
}
