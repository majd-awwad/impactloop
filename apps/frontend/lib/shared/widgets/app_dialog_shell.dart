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
    required this.content,
    this.footer,
    this.onClose,
    this.closeEnabled = true,
    this.maxWidth = 560,
    this.maxHeightFactor = 0.9,
    this.contentPadding = const EdgeInsetsDirectional.fromSTEB(
      AppSpacing.lg,
      AppSpacing.lg,
      AppSpacing.lg,
      AppSpacing.lg,
    ),
    this.borderRadius,
  });

  final Widget title;
  final Widget content;
  final Widget? footer;
  final VoidCallback? onClose;
  final bool closeEnabled;
  final double maxWidth;
  final double maxHeightFactor;
  final EdgeInsetsGeometry contentPadding;

  /// Overrides the default corner radius for dialogs that need a softer,
  /// more spacious shape (e.g. wide status-aware detail dialogs).
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final screenSize = MediaQuery.sizeOf(context);

    return Dialog(
      backgroundColor: colors.panelSurface,
      elevation: 8,
      shadowColor: colors.shadow,
      insetPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.lg,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: borderRadius ?? AppRadius.lgAll,
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
                      onPressed: closeEnabled
                          ? (onClose ?? () => Navigator.of(context).maybePop())
                          : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Flexible(child: SingleChildScrollView(child: content)),
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
