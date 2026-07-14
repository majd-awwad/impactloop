import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/app_status_badge.dart';

class AuthPrimaryButton extends StatelessWidget {
  const AuthPrimaryButton({
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
    final colors = AppThemeColors.of(context);

    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: isLoading ? null : onPressed,
        style: AppStatusButtonStyle.filled(context, AppStatusTone.primary),
        child: isLoading
            ? SizedBox(
                height: AppSpacing.lg,
                width: AppSpacing.lg,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colors.textOnPrimary,
                ),
              )
            : Text(label),
      ),
    );
  }
}

class AuthOutlinedButton extends StatelessWidget {
  const AuthOutlinedButton({
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
        onPressed: onPressed,
        style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral),
        child: Text(label),
      ),
    );
  }
}
