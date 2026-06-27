import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_decorations.dart';
import '../theme/supplier_theme_extension.dart';

class SupplierAccessDeniedPage extends StatelessWidget {
  const SupplierAccessDeniedPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    return Scaffold(
      body: DecoratedBox(
        decoration: decorations.pageBackground,
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
                          l.supplierAccessRequired,
                          style: context.supplierTitle(),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          l.supplierAccessRequiredMessage,
                          style: context.supplierBody(),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        Wrap(
                          spacing: AppSpacing.sm,
                          runSpacing: AppSpacing.sm,
                          children: [
                            FilledButton(
                              onPressed: () => context.go('/home'),
                              style: FilledButton.styleFrom(
                                backgroundColor: colors.accent,
                                foregroundColor: colors.textOnAccent,
                                shape: RoundedRectangleBorder(
                                  borderRadius: AppRadius.pillAll,
                                ),
                              ),
                              child: Text(l.goToHome),
                            ),
                            OutlinedButton(
                              onPressed: () => context.go('/login'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: colors.textPrimary,
                                side: BorderSide(
                                  color: colors.borderFocused
                                      .withValues(alpha: 0.5),
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: AppRadius.pillAll,
                                ),
                              ),
                              child: Text(l.signIn),
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
