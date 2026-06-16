import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../../../shared/widgets/app_primary_button.dart';

class SupplierEmptyDashboardState extends StatelessWidget {
  const SupplierEmptyDashboardState({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.eco_outlined,
            color: AuthDarkColors.accent,
            size: 28,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'No materials listed yet',
            style: AuthDarkTextStyles.title(context),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Start by sharing unused parts, project leftovers, or surplus components.',
            style: AuthDarkTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: 280,
            child: AppPrimaryButton(
              label: 'Add your first material',
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.account_circle_outlined,
            color: AuthDarkColors.accent,
            size: 28,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Complete your supplier profile',
            style: AuthDarkTextStyles.title(context),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Add your public supplier name and pickup location before listing materials.',
            style: AuthDarkTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: 240,
            child: AppPrimaryButton(
              label: 'Complete profile',
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'We could not load your supplier dashboard.',
            style: AuthDarkTextStyles.title(context),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Please check your connection and try again.',
            style: AuthDarkTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: 160,
            child: OutlinedButton(
              onPressed: onRetry,
              style: OutlinedButton.styleFrom(
                foregroundColor: AuthDarkColors.accent,
                side: BorderSide(
                  color: AuthDarkColors.borderFocused.withValues(alpha: 0.6),
                ),
                shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
              ),
              child: const Text('Retry'),
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
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 140,
            width: double.infinity,
            decoration: SupplierDecorations.dashboardCard,
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
                decoration: SupplierDecorations.statCard,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
