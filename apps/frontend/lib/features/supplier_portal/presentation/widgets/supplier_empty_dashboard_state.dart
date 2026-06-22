import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
import '../../../../shared/widgets/app_primary_button.dart';

class SupplierEmptyDashboardState extends StatelessWidget {
  const SupplierEmptyDashboardState({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: decorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.eco_outlined,
            color: colors.accent,
            size: 28,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            context.s.noMaterialsListedYet,
            style: context.supplierTitle(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            context.s.noMaterialsListedSubtitle,
            style: context.supplierBody(),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: 280,
            child: AppPrimaryButton(
              label: context.s.addFirstMaterial,
              onPressed: () => context.go('/supplier/materials/new'),
            ),
          ),
        ],
      ),
    );
  }
}

class SupplierMissingProfileCard extends StatelessWidget {
  const SupplierMissingProfileCard({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: decorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.account_circle_outlined,
            color: colors.accent,
            size: 28,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            context.s.completeSupplierProfileTitle,
            style: context.supplierTitle(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            context.s.completeSupplierProfileSubtitle,
            style: context.supplierBody(),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: 240,
            child: AppPrimaryButton(
              label: context.s.completeProfile,
              onPressed: () => context.go('/supplier/profile'),
            ),
          ),
        ],
      ),
    );
  }
}

class SupplierDashboardErrorCard extends StatelessWidget {
  const SupplierDashboardErrorCard({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: decorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.s.dashboardLoadError,
            style: context.supplierTitle(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            context.s.dashboardLoadErrorMessage,
            style: context.supplierBody(),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: 160,
            child: OutlinedButton(
              onPressed: onRetry,
              style: OutlinedButton.styleFrom(
                foregroundColor: colors.accent,
                side: BorderSide(
                  color: colors.borderFocused.withValues(alpha: 0.6),
                ),
                shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
              ),
              child: Text(context.s.tryAgain),
            ),
          ),
        ],
      ),
    );
  }
}

class SupplierDashboardLoading extends StatelessWidget {
  const SupplierDashboardLoading({super.key});

  @override
  Widget build(BuildContext context) {
    final decorations = context.supplierDecorations;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 140,
            width: double.infinity,
            decoration: decorations.dashboardCard,
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.md,
            children: List.generate(
              6,
              (_) => Container(
                width: 140,
                height: 80,
                decoration: decorations.statCard,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
