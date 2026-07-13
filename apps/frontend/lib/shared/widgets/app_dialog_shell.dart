import 'package:flutter/material.dart';

import '../../app/theme/app_radius.dart';
import '../../app/theme/app_spacing.dart';
import '../../app/theme/app_theme_colors.dart';
import 'app_close_button.dart';

/// Shared, theme-aware chrome for form and information dialogs.
///
/// Decision dialogs should use `AppDialogFooter.decision` so their
/// explicit Cancel action remains available alongside the primary action.
class AppDialogShell extends StatelessWidget {
  const AppDialogShell({
    super.key,
    required this.title,
    required this.child,
    this.footer,
    this.onClose,
    this.maxWidth = 560,
    this.maxHeightFactor = 0.9,
    this.contentPadding = const EdgeInsetsDirectional.fromSTEB(
      AppSpacing.lg,
      AppSpacing.lg,
      AppSpacing.lg,
      AppSpacing.lg,
    ),
  });

  final Widget title;
  final Widget child;
  final Widget? footer;
  final VoidCallback? onClose;
  final double maxWidth;
  final double maxHeightFactor;
  final EdgeInsetsGeometry contentPadding;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final screenSize = MediaQuery.sizeOf(context);

    return Dialog(
      backgroundColor: colors.panelSurface,
      elevation: 8,
      shadowColor: colors.shadow,
      insetPadding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.lg,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: colors.borderSubtle),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: maxWidth,
          maxHeight: screenSize.height * maxHeightFactor,
        ),
        child: Padding(
          padding: contentPadding,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Stack(
                children: [
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: 40),
                    child: DefaultTextStyle.merge(
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                      child: title,
                    ),
                  ),
                  Align(
                    alignment: AlignmentDirectional.topEnd,
                    child: AppCloseButton(
                      onPressed:
                          onClose ?? () => Navigator.of(context).maybePop(),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Flexible(child: SingleChildScrollView(child: child)),
              if (footer != null) ...[
                const SizedBox(height: AppSpacing.md),
                Divider(color: colors.borderSubtle),
                const SizedBox(height: AppSpacing.md),
                footer!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}
