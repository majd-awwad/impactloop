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
          Icon(Icons.eco_outlined, color: colors.accent, size: 28),
          const SizedBox(height: AppSpacing.md),
          Text(context.s.noMaterialsListedYet, style: context.supplierTitle()),
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
              onPressed: () => context.push('/supplier/materials/new'),
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
          Icon(Icons.account_circle_outlined, color: colors.accent, size: 28),
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
              onPressed: () => context.push('/supplier/profile'),
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
          Text(context.s.dashboardLoadError, style: context.supplierTitle()),
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
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact =
            constraints.maxWidth < AppSpacing.supplierLayoutBreakpoint;
        final wide = constraints.maxWidth >= 1180;
        final kpiColumns = wide
            ? 4
            : constraints.maxWidth >= 520
            ? 2
            : 1;
        final kpiWidth =
            (constraints.maxWidth - (AppSpacing.md * (kpiColumns - 1))) /
            kpiColumns;

        return SingleChildScrollView(
          padding: context.supplierDecorations.pagePadding(compact: compact),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _DashboardSkeletonCard(height: 204),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.md,
                children: List.generate(
                  4,
                  (_) => SizedBox(
                    width: kpiWidth,
                    child: const _DashboardSkeletonCard(height: 112),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              const _DashboardSkeletonCard(height: 70),
              const SizedBox(height: AppSpacing.md),
              if (wide)
                const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 3,
                      child: _DashboardSkeletonCard(height: 270),
                    ),
                    SizedBox(width: AppSpacing.md),
                    Expanded(
                      flex: 2,
                      child: _DashboardSkeletonCard(height: 270),
                    ),
                  ],
                )
              else ...[
                const _DashboardSkeletonCard(height: 270),
                const SizedBox(height: AppSpacing.md),
                const _DashboardSkeletonCard(height: 190),
              ],
              const SizedBox(height: AppSpacing.md),
              if (wide)
                const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 5,
                      child: _DashboardSkeletonCard(height: 220),
                    ),
                    SizedBox(width: AppSpacing.md),
                    Expanded(
                      flex: 2,
                      child: _DashboardSkeletonCard(height: 220),
                    ),
                    SizedBox(width: AppSpacing.md),
                    Expanded(
                      flex: 3,
                      child: _DashboardSkeletonCard(height: 220),
                    ),
                  ],
                )
              else ...[
                const _DashboardSkeletonCard(height: 200),
                const SizedBox(height: AppSpacing.md),
                const _DashboardSkeletonCard(height: 200),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _DashboardSkeletonCard extends StatelessWidget {
  const _DashboardSkeletonCard({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: height,
      decoration: context.supplierDecorations.dashboardCard,
    );
  }
}
