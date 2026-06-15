import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';

class DarkAuthPrimaryButton extends StatelessWidget {
  const DarkAuthPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: AuthDarkColors.accent,
          foregroundColor: AuthDarkColors.textOnAccent,
          disabledBackgroundColor: AuthDarkColors.accentSoft,
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
        onPressed: isLoading ? null : onPressed,
        child: isLoading
            ? const SizedBox(
                height: AppSpacing.lg,
                width: AppSpacing.lg,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AuthDarkColors.textOnAccent,
                ),
              )
            : Text(label),
      ),
    );
  }
}

class DarkAuthOutlinedButton extends StatelessWidget {
  const DarkAuthOutlinedButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          foregroundColor: AuthDarkColors.textPrimary,
          side: const BorderSide(color: AuthDarkColors.border),
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
        onPressed: onPressed,
        child: Text(label),
      ),
    );
  }
}
