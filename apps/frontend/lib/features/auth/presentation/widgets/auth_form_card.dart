import 'package:flutter/material.dart';

import '../../../../app/theme/app_decorations.dart';
import '../../../../app/theme/app_spacing.dart';

class AuthFormCard extends StatelessWidget {
  const AuthFormCard({
    super.key,
    this.footer,
    required this.child,
  });

  final Widget child;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: AppDecorations.authFormCard,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            child,
            if (footer != null) ...[
              const SizedBox(height: AppSpacing.lg),
              footer!,
            ],
          ],
        ),
      ),
    );
  }
}
