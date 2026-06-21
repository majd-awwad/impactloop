import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

void showSupplierInfoSnackBar(BuildContext context, String message) {
  _showSupplierSnackBar(
    context,
    message: message,
    icon: Icons.check_circle_outline,
    accent: context.supplierColors.accent,
  );
}

void showSupplierErrorSnackBar(BuildContext context, String message) {
  _showSupplierSnackBar(
    context,
    message: message,
    icon: Icons.error_outline,
    accent: context.supplierColors.error,
  );
}

void _showSupplierSnackBar(
  BuildContext context, {
  required String message,
  required IconData icon,
  required Color accent,
}) {
  final colors = context.supplierColors;
  final messenger = ScaffoldMessenger.of(context);

  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: colors.surfaceSolid,
        elevation: 8,
        margin: const EdgeInsets.all(AppSpacing.lg),
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.mdAll,
          side: BorderSide(color: colors.border.withValues(alpha: 0.55)),
        ),
        content: Row(
          children: [
            Icon(icon, color: accent, size: 20),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: TextStyle(color: colors.textPrimary),
              ),
            ),
          ],
        ),
      ),
    );
}
