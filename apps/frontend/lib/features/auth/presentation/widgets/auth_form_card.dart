import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import 'auth_ui_palette.dart';

class AuthFormCard extends StatelessWidget {
  const AuthFormCard({super.key, this.footer, required this.child});

  final Widget child;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);
    final isCompact = MediaQuery.sizeOf(context).width < 420;

    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.border),
        boxShadow: [
          BoxShadow(
            color: colors.textPrimary.withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: EdgeInsets.all(isCompact ? AppSpacing.md : AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Container(
                height: 4,
                width: isCompact ? 56 : 72,
                decoration: BoxDecoration(
                  color: colors.primary,
                  borderRadius: AppRadius.pillAll,
                ),
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
