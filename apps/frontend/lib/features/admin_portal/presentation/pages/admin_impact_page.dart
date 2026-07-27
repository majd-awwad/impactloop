import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/admin_dashboard_providers.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_bar_chart_card.dart';
import '../widgets/admin_impact_card.dart';
import '../widgets/admin_kpi_card.dart';
import '../widgets/admin_line_chart_card.dart';

class AdminImpactPage extends ConsumerStatefulWidget {
  const AdminImpactPage({super.key});

  @override
  ConsumerState<AdminImpactPage> createState() => _AdminImpactPageState();
}

class _AdminImpactPageState extends ConsumerState<AdminImpactPage> {
  bool _co2ShouldAnimate = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _co2ShouldAnimate = true);
    });
  }

  String _fmtInt(int value) => value.toString();

  String _fmtPercent(double rate) {
    if (!rate.isFinite || rate <= 0) return '0%';
    return '${(rate * 100).round()}%';
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final asyncDashboard = ref.watch(adminDashboardProvider);
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 900
        ? 4
        : width >= 560
        ? 2
        : 1;
    const spacing = 10.0;

    return ColoredBox(
      color: palette.pageBackground,
      child: asyncDashboard.when(
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
                onPressed: () => ref.invalidate(adminDashboardProvider),
                child: Text(l.t('Retry', 'إعادة المحاولة')),
              ),
            ],
          ),
        ),
        data: (dashboard) {
          final summary = dashboard.summary;
          final impact = dashboard.impact;

          final linePoints = impact.reuseByMonth
              .map(
                (entry) => AdminLineChartPoint(
                  label: entry.month.length >= 7
                      ? entry.month.substring(5)
                      : entry.month,
                  value: entry.count,
                ),
              )
              .toList();

          final materialCategoryItems = dashboard.materialsByCategory
              .take(8)
              .toList()
              .asMap()
              .entries
              .map(
                (entry) => AdminBarChartItem(
                  label: l.isArabic ? entry.value.nameAr : entry.value.nameEn,
                  value: entry.value.count,
                  color:
                      palette.categoryBarColors[entry.key %
                          palette.categoryBarColors.length],
                ),
              )
              .toList();

          final summaryCards = <AdminKpiCard>[
            AdminKpiCard(
              label: l.estimatedCo2Avoided,
              value: impact.estimatedCo2Label,
              helper: l.estimatedCo2ShortHelper,
              icon: Icons.eco_outlined,
              accent: palette.brightTeal,
              badge: l.estimatedBadge,
              helperMaxLines: 1,
            ),
            AdminKpiCard(
              label: l.statCompletedReuse,
              value: _fmtInt(summary.completedReuse),
              helper: l.hintCompletedReuse,
              icon: Icons.autorenew,
              accent: palette.green,
            ),
            AdminKpiCard(
              label: l.reuseCompletionRateLabel,
              value: _fmtPercent(impact.reuseCompletionRate),
              helper: l.t(
                'Completed reservations / total reservations',
                'الحجوزات المكتملة / إجمالي الحجوزات',
              ),
              icon: Icons.percent_outlined,
              accent: palette.purple,
            ),
            AdminKpiCard(
              label: l.impactLearnersBenefited,
              value: _fmtInt(impact.learnersBenefited),
              helper: l.t(
                'Learners with completed reuse',
                'المتعلمون مع إعادة استخدام مكتملة',
              ),
              icon: Icons.school_outlined,
              accent: palette.blue,
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
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
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
            );
          }

          return ListView(
            padding: const EdgeInsetsDirectional.fromSTEB(20, 16, 20, 28),
            children: [
              Text(
                l.navImpactAnalytics,
                style: AdminTypography.pageTitle(palette),
              ),
              const SizedBox(height: 4),
              Text(
                l.opImpactDesc,
                style: AdminTypography.pageSubtitle(palette),
              ),
              const SizedBox(height: 20),
              ...kpiRows,
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 14, 12),
                decoration: BoxDecoration(
                  color: palette.isDark
                      ? palette.cardBackground
                      : palette.primaryTeal.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: palette.primaryTeal.withValues(alpha: 0.2),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.info_outline,
                      color: palette.primaryTeal,
                      size: 18,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        l.impactEnvironmentalNote,
                        style: AdminTypography.kpiHelper(
                          palette,
                        ).copyWith(color: palette.textPrimary, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              AdminImpactCard(
                impact: impact,
                co2ShouldAnimate: _co2ShouldAnimate,
              ),
              const SizedBox(height: 16),
              AdminLineChartCard(
                title: l.reuseActivityTitle,
                subtitle: l.reuseActivitySubtitle,
                points: linePoints,
              ),
              if (materialCategoryItems.isNotEmpty) ...[
                const SizedBox(height: 16),
                AdminBarChartCard(
                  title: l.materialsByCategoryTitle,
                  subtitle: l.t(
                    'Material listings by category, not reuse-specific.',
                    'قوائم المواد حسب الفئة، وليست خاصة بإعادة الاستخدام.',
                  ),
                  items: materialCategoryItems,
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
