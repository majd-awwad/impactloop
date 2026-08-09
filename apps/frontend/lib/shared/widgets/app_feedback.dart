import 'package:flutter/material.dart';

import '../../app/theme/app_radius.dart';
import '../../app/theme/app_spacing.dart';
import '../../core/errors/api_exception.dart';
import '../../l10n/l10n.dart';
import 'app_status_badge.dart';

void showErrorSnackBar(BuildContext context, Object error, {String? message}) {
  _showFeedbackSnackBar(
    context,
    message: message ?? localizedApiErrorMessage(error, context.l10n),
    tone: AppStatusTone.danger,
    icon: Icons.error_outline_rounded,
  );
}

void showInfoSnackBar(BuildContext context, String message) {
  _showFeedbackSnackBar(
    context,
    message: message,
    tone: AppStatusTone.info,
    icon: Icons.info_outline_rounded,
  );
}

void showSuccessSnackBar(BuildContext context, String message) {
  _showFeedbackSnackBar(
    context,
    message: message,
    tone: AppStatusTone.success,
    icon: Icons.check_circle_outline_rounded,
  );
}

void _showFeedbackSnackBar(
  BuildContext context, {
  required String message,
  required AppStatusTone tone,
  required IconData icon,
}) {
  final messenger = ScaffoldMessenger.of(context);
  final theme = Theme.of(context);
  final colorScheme = theme.colorScheme;
  final status = AppStatusStyle.of(context, tone);
  final screenWidth = MediaQuery.sizeOf(context).width;
  final useBoundedWidth = screenWidth > 600;

  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(icon, size: 21, color: status.foreground),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                message,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurface,
                  fontWeight: FontWeight.w700,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ),
        behavior: SnackBarBehavior.floating,
        backgroundColor: colorScheme.surface,
        width: useBoundedWidth ? 420 : null,
        margin: useBoundedWidth
            ? null
            : const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        padding: const EdgeInsetsDirectional.fromSTEB(18, 14, 8, 14),
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.lgAll,
          side: BorderSide(color: colorScheme.outlineVariant),
        ),
        elevation: 10,
        duration: const Duration(seconds: 3),
        showCloseIcon: true,
        closeIconColor: colorScheme.onSurfaceVariant,
      ),
    );
}
