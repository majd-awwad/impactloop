import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/admin_impact_providers.dart';
import '../../data/models/admin_impact_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_bar_chart_card.dart';
import '../widgets/admin_environmental_estimate_card.dart';
import '../widgets/admin_kpi_card.dart';
import '../widgets/admin_learning_impact_card.dart';
import '../widgets/admin_line_chart_card.dart';

class AdminImpactPage extends ConsumerWidget {
  const AdminImpactPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final asyncImpact = ref.watch(adminImpactAnalyticsProvider);

    return ColoredBox(
      color: palette.pageBackground,
      child: asyncImpact.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                l.t(
                  'Failed to load impact analytics',
                  'فشل تحميل تحليلات الأثر',
                ),
                style: AdminTypography.pageSubtitle(palette),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => ref.invalidate(adminImpactAnalyticsProvider),
                child: Text(l.t('Retry', 'إعادة المحاولة')),
              ),
            ],
          ),
        ),
        data: (impact) => _AdminImpactBody(impact: impact),
      ),
    );
  }
}

class _AdminImpactBody extends StatelessWidget {
  const _AdminImpactBody({required this.impact});

  final AdminImpactAnalytics impact;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 900
        ? 4
        : width >= 560
        ? 2
        : 1;
    const spacing = 10.0;
    const kpiMinHeight = 156.0;

    final verified = impact.verifiedImpact;
    final fourthIsLearning = impact.learningImpact.componentsFulfilled > 0;

    final summaryCards = <AdminKpiCard>[
      AdminKpiCard(
        label: l.completedReuseEvents,
        value: verified.completedReuseEvents.toString(),
        helper: l.completedReuseEventsHelper,
        icon: Icons.handshake_outlined,
        accent: palette.green,
        labelMaxLines: 2,
        minHeight: kpiMinHeight,
      ),
      AdminKpiCard(
        label: l.impactLearnersBenefited,
        value: verified.learnersBenefited.toString(),
        helper: l.learnersBenefitedHelper,
        icon: Icons.school_outlined,
        accent: palette.blue,
        labelMaxLines: 2,
        minHeight: kpiMinHeight,
      ),
      AdminKpiCard(
        label: l.impactSuppliersContributed,
        value: verified.suppliersContributed.toString(),
        helper: l.suppliersContributedHelper,
        icon: Icons.storefront_outlined,
        accent: palette.amber,
        labelMaxLines: 2,
        minHeight: kpiMinHeight,
      ),
      if (fourthIsLearning)
        AdminKpiCard(
          label: l.projectComponentsFulfilled,
          value: impact.learningImpact.componentsFulfilled.toString(),
          helper: l.projectComponentsFulfilledHelper,
          icon: Icons.playlist_add_check_rounded,
          accent: palette.primaryTeal,
          labelMaxLines: 2,
          minHeight: kpiMinHeight,
        )
      else
        AdminKpiCard(
          label: l.distinctMaterialsReused,
          value: verified.distinctMaterialsReused.toString(),
          helper: l.distinctMaterialsReusedHelper,
          icon: Icons.recycling_outlined,
          accent: palette.primaryTeal,
          labelMaxLines: 2,
          minHeight: kpiMinHeight,
        ),
    ];

    final kpiRows = <Widget>[];
    for (var i = 0; i < summaryCards.length; i += columns) {
      final rowCards = summaryCards.skip(i).take(columns).toList();
      kpiRows.add(
        Padding(
          padding: EdgeInsets.only(
            bottom: i + columns < summaryCards.length ? spacing : 0,
          ),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var j = 0; j < columns; j++) ...[
                  if (j > 0) SizedBox(width: spacing),
                  Expanded(
                    child: j < rowCards.length
                        ? rowCards[j]
                        : const SizedBox.shrink(),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    final categoryItems = impact.reuseByCategory
        .take(8)
        .toList()
        .asMap()
        .entries
        .map(
          (entry) => AdminBarChartItem(
            label: l.isArabic ? entry.value.nameAr : entry.value.nameEn,
            value: entry.value.completedReuseEvents,
            color:
                palette.categoryBarColors[entry.key %
                    palette.categoryBarColors.length],
          ),
        )
        .toList();

    final linePoints = impact.monthlyReuse
        .map(
          (entry) => AdminLineChartPoint(
            label: entry.month,
            value: entry.completedReuseEvents,
          ),
        )
        .toList();

    return ListView(
      padding: const EdgeInsetsDirectional.fromSTEB(20, 16, 20, 28),
      children: [
        Text(l.navImpactAnalytics, style: AdminTypography.pageTitle(palette)),
        const SizedBox(height: 4),
        Text(
          l.impactPageSubtitle,
          style: AdminTypography.pageSubtitle(palette),
        ),
        const SizedBox(height: 20),
        ...kpiRows,
        const SizedBox(height: 20),
        AdminBarChartCard(
          title: l.completedReuseByCategoryTitle,
          subtitle: l.completedReuseByCategorySubtitle,
          items: categoryItems,
          horizontal: true,
          emptyTitle: l.impactEmptyCategoryTitle,
          emptySubtitle: l.impactEmptyCategorySubtitle,
        ),
        if (impact.hasLearningImpact) ...[
          const SizedBox(height: 16),
          AdminLearningImpactCard(
            componentsFulfilled: impact.learningImpact.componentsFulfilled,
            buildsSupported: impact.learningImpact.buildsSupported,
            projectsSupported: impact.learningImpact.projectsSupported,
          ),
        ],
        const SizedBox(height: 16),
        AdminLineChartCard(
          title: l.completedReuseOverTimeTitle,
          subtitle: l.completedReuseOverTimeSubtitle,
          points: linePoints,
          emptyTitle: l.impactEmptyMonthlyTitle,
          emptySubtitle: l.impactEmptyMonthlySubtitle,
        ),
        const SizedBox(height: 16),
        AdminEnvironmentalEstimateCard(estimate: impact.environmentalEstimate),
      ],
    );
  }
}
