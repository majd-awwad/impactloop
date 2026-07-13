import 'package:flutter/material.dart';

import '../../app/theme/app_spacing.dart';

/// Standard action layouts for form and decision dialogs.
class AppDialogFooter extends StatelessWidget {
  const AppDialogFooter.form({
    super.key,
    required this.primaryAction,
  }) : secondaryAction = null;

  const AppDialogFooter.decision({
    super.key,
    required this.primaryAction,
    required Widget this.secondaryAction,
  });

  final Widget primaryAction;
  final Widget? secondaryAction;

  bool get _isDecision => secondaryAction != null;

  @override
  Widget build(BuildContext context) {
    if (!_isDecision) {
      return SizedBox(width: double.infinity, child: primaryAction);
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 420) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              primaryAction,
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
            primaryAction,
          ],
        );
      },
    );
  }
}
