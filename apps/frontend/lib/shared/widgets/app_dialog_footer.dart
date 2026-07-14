import 'package:flutter/material.dart';

import '../../app/theme/app_spacing.dart';

/// Standard action layouts for form and decision dialogs.
class AppDialogFooter extends StatelessWidget {
  const AppDialogFooter.form({super.key, required this.primaryAction})
    : secondaryAction = null,
      actions = null;

  const AppDialogFooter.decision({
    super.key,
    required this.primaryAction,
    required Widget this.secondaryAction,
  }) : actions = null;

  /// Content-sized semantic actions aligned to the logical end.
  ///
  /// Actions wrap naturally on narrow dialogs without becoming full-width.
  const AppDialogFooter.actions({super.key, required this.actions})
    : primaryAction = null,
      secondaryAction = null;

  final Widget? primaryAction;
  final Widget? secondaryAction;
  final List<Widget>? actions;

  bool get _isDecision => secondaryAction != null;

  @override
  Widget build(BuildContext context) {
    if (actions != null) {
      return Wrap(
        alignment: WrapAlignment.end,
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        children: actions!,
      );
    }

    if (!_isDecision) {
      return Align(
        alignment: AlignmentDirectional.centerEnd,
        child: primaryAction!,
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 420) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              primaryAction!,
              const SizedBox(height: AppSpacing.sm),
              secondaryAction!,
            ],
          );
        }

        return Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            secondaryAction!,
            const SizedBox(width: AppSpacing.sm),
            primaryAction!,
          ],
        );
      },
    );
  }
}
