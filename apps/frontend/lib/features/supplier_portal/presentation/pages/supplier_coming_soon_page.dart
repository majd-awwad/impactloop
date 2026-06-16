import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/auth_dark_decorations.dart';
import '../../../../app/theme/supplier_decorations.dart';

class SupplierComingSoonPage extends StatelessWidget {
  const SupplierComingSoonPage({
    super.key,
    required this.title,
    required this.description,
    this.standalone = false,
  });

  final String title;
  final String description;
  final bool standalone;

  @override
  Widget build(BuildContext context) {
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;

    final content = SingleChildScrollView(
      padding: SupplierDecorations.pagePadding(compact: compact),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.xl),
        decoration: SupplierDecorations.dashboardCard,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: SupplierDecorations.badge(
                background: AuthDarkColors.chipSelected,
              ),
              child: Text(
                'Coming soon',
                style: AuthDarkTextStyles.chip(
                  context,
                ).copyWith(color: AuthDarkColors.accent),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(title, style: AuthDarkTextStyles.title(context)),
            const SizedBox(height: AppSpacing.sm),
            Text(description, style: AuthDarkTextStyles.body(context)),
            const SizedBox(height: AppSpacing.lg),
            OutlinedButton(
              onPressed: () => context.go(standalone ? '/home' : '/supplier'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AuthDarkColors.accent,
                side: BorderSide(
                  color: AuthDarkColors.borderFocused.withValues(alpha: 0.6),
                ),
              ),
              child: Text(standalone ? 'Back to home' : 'Back to dashboard'),
            ),
          ],
        ),
      ),
    );

    if (!standalone) {
      return content;
    }

    return Scaffold(
      body: DecoratedBox(
        decoration: SupplierDecorations.pageBackground,
        child: Stack(
          children: [
            ...AuthDarkDecorations.backgroundBlobs(compact: compact),
            SafeArea(child: content),
          ],
        ),
      ),
    );
  }
}
