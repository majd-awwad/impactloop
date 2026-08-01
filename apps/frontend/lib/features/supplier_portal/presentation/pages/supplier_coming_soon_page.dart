import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_decorations.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/material_listing_foundation_preview.dart';

class SupplierComingSoonPage extends StatelessWidget {
  const SupplierComingSoonPage({
    super.key,
    required this.title,
    required this.description,
    this.standalone = false,
    this.showMaterialFoundationPreview = false,
  });

  final String title;
  final String description;
  final bool standalone;
  final bool showMaterialFoundationPreview;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;

    final content = SingleChildScrollView(
      padding: decorations.pagePadding(compact: compact),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.xl),
        decoration: decorations.dashboardCard,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: decorations.badge(background: colors.chipSelected),
              child: Text(
                l.comingSoon,
                style: context.supplierChip().copyWith(color: colors.accent),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(title, style: context.supplierTitle()),
            const SizedBox(height: AppSpacing.sm),
            Text(description, style: context.supplierBody()),
            if (showMaterialFoundationPreview) ...[
              const SizedBox(height: AppSpacing.lg),
              const MaterialListingFoundationPreview(),
            ],
            const SizedBox(height: AppSpacing.lg),
            OutlinedButton(
              onPressed: () => context.go(standalone ? '/home' : '/supplier'),
              style: OutlinedButton.styleFrom(
                foregroundColor: colors.accent,
                side: BorderSide(
                  color: colors.borderFocused.withValues(alpha: 0.6),
                ),
              ),
              child: Text(standalone ? l.backToHome : l.backToDashboard),
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
        decoration: decorations.pageBackground,
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
