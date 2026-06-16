import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_decorations.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';

class SupplierAccessDeniedPage extends StatelessWidget {
  const SupplierAccessDeniedPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: SupplierDecorations.pageBackground,
        child: Stack(
          children: [
            ...AuthDarkDecorations.backgroundBlobs(),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: AuthDarkDecorations.glassSurface(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Supplier access required',
                          style: AuthDarkTextStyles.title(context),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          'You need a Supplier role to access the Supplier Portal.',
                          style: AuthDarkTextStyles.body(context),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        Wrap(
                          spacing: AppSpacing.sm,
                          runSpacing: AppSpacing.sm,
                          children: [
                            FilledButton(
                              onPressed: () => context.go('/home'),
                              style: FilledButton.styleFrom(
                                backgroundColor: AuthDarkColors.accent,
                                foregroundColor: AuthDarkColors.textOnAccent,
                                shape: RoundedRectangleBorder(
                                  borderRadius: AppRadius.pillAll,
                                ),
                              ),
                              child: const Text('Go to home'),
                            ),
                            OutlinedButton(
                              onPressed: () => context.go('/login'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AuthDarkColors.textPrimary,
                                side: BorderSide(
                                  color: AuthDarkColors.borderFocused
                                      .withValues(alpha: 0.5),
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: AppRadius.pillAll,
                                ),
                              ),
                              child: const Text('Sign in'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
