import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../data/models/supplier_category_demand.dart';
import '../../../data/supplier_category_demand_api.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_dashboard_colors.dart';

class SupplierCategoryDemandPanel extends ConsumerWidget {
  const SupplierCategoryDemandPanel({
    super.key,
    this.debugAsyncOverride,
    this.debugOnRetry,
  });

  /// Test-only seam so widget tests can force loading/error/data without HTTP.
  @visibleForTesting
  final AsyncValue<SupplierCategoryDemandResult>? debugAsyncOverride;

  /// Test-only retry hook used with [debugAsyncOverride].
  @visibleForTesting
  final VoidCallback? debugOnRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<SupplierCategoryDemandResult> async =
        debugAsyncOverride ?? ref.watch(supplierCategoryDemandProvider);
    final l = context.s;
    final colors = context.supplierColors;
    final mobile = MediaQuery.sizeOf(context).width < 600;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(mobile ? AppSpacing.md : AppSpacing.lg),
      decoration: context.supplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l.categoryDemandTitle,
            style: context.supplierSectionTitle(),
          ),
          SizedBox(height: mobile ? AppSpacing.xs : AppSpacing.sm),
          Text(
            l.categoryDemandSubtitle,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 13,
              height: 1.35,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l.categoryDemandPeriodLabel,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: mobile ? AppSpacing.md : AppSpacing.lg),
          async.when(
            loading: () => const _CategoryDemandSkeleton(),
            error: (_, _) => _CategoryDemandError(
              message: l.categoryDemandLoadError,
              retryLabel: l.categoryDemandRetry,
              onRetry:
                  debugOnRetry ??
                  () => ref.invalidate(supplierCategoryDemandProvider),
            ),
            data: (result) => SupplierCategoryDemandPanelContent(result: result),
          ),
        ],
      ),
    );
  }
}

/// Presentational content used by the panel and widget tests.
class SupplierCategoryDemandPanelContent extends StatelessWidget {
  const SupplierCategoryDemandPanelContent({
    super.key,
    required this.result,
    this.languageCode,
  });

  final SupplierCategoryDemandResult result;
  final String? languageCode;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final lang = languageCode ?? Localizations.localeOf(context).languageCode;

    if (result.items.isEmpty) {
      final message = switch (result.emptyStateReason) {
        SupplierCategoryDemandEmptyReason.noActiveCategories =>
          l.categoryDemandNoActiveCategories,
        SupplierCategoryDemandEmptyReason.noRecentActivity ||
        SupplierCategoryDemandEmptyReason.none =>
          l.categoryDemandNoRecentActivity,
      };
      return Text(
        message,
        style: context.supplierBody().copyWith(color: colors.textSecondary),
      );
    }

    final summaryNames = result.summaryCategories
        .map((item) => item.localizedName(lang))
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l.categoryDemandSummary(summaryNames),
          style: context.supplierBody().copyWith(
            fontWeight: FontWeight.w600,
            height: 1.35,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        for (var index = 0; index < result.items.length; index++) ...[
          if (index > 0) const SizedBox(height: AppSpacing.sm),
          _CategoryDemandRow(
            rank: index + 1,
            item: result.items[index],
            languageCode: lang,
          ),
        ],
      ],
    );
  }
}

class _CategoryDemandRow extends StatelessWidget {
  const _CategoryDemandRow({
    required this.rank,
    required this.item,
    required this.languageCode,
  });

  final int rank;
  final SupplierCategoryDemandItem item;
  final String languageCode;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final name = item.localizedName(languageCode);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.chipUnselected.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: colors.border.withValues(alpha: 0.7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$rank.',
                style: context.supplierBody().copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.supplierBody().copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Flexible(
                child: Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: _DemandLevelBadge(level: item.demandLevel),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l.categoryDemandReason(item.primaryReason),
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 12,
              height: 1.3,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _SignalChip(
                label: l.categoryDemandViewsChip(item.signals.views),
              ),
              _SignalChip(
                label: l.categoryDemandLikesChip(item.signals.likes),
              ),
              _SignalChip(
                label: l.categoryDemandReservationsChip(
                  item.signals.reservations,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DemandLevelBadge extends StatelessWidget {
  const _DemandLevelBadge({required this.level});

  final SupplierCategoryDemandLevel level;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final color = switch (level) {
      SupplierCategoryDemandLevel.high => SupplierDashboardColors.accepted,
      SupplierCategoryDemandLevel.moderate => SupplierDashboardColors.pending,
      SupplierCategoryDemandLevel.emerging => SupplierDashboardColors.available,
      SupplierCategoryDemandLevel.unknown => context.supplierColors.textSecondary,
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Text(
        l.categoryDemandLevelLabel(level),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: context.supplierBody().copyWith(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _SignalChip extends StatelessWidget {
  const _SignalChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: colors.border.withValues(alpha: 0.8)),
      ),
      child: Text(
        label,
        style: context.supplierBody().copyWith(
          fontSize: 11,
          color: colors.textSecondary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _CategoryDemandSkeleton extends StatelessWidget {
  const _CategoryDemandSkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    Widget bar({required double width, required double height}) => Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: colors.chipUnselected,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        bar(width: double.infinity, height: 14),
        const SizedBox(height: AppSpacing.md),
        bar(width: double.infinity, height: 56),
        const SizedBox(height: AppSpacing.sm),
        bar(width: double.infinity, height: 56),
      ],
    );
  }
}

class _CategoryDemandError extends StatelessWidget {
  const _CategoryDemandError({
    required this.message,
    required this.retryLabel,
    required this.onRetry,
  });

  final String message;
  final String retryLabel;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          message,
          style: context.supplierBody().copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextButton(onPressed: onRetry, child: Text(retryLabel)),
      ],
    );
  }
}
