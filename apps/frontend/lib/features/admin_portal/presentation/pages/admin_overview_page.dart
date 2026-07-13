import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/admin_dashboard_providers.dart';
import '../../data/models/admin_dashboard_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_bar_chart_card.dart';
import '../widgets/admin_donut_chart_card.dart';
import '../widgets/admin_impact_card.dart';
import '../widgets/admin_kpi_card.dart';
import '../widgets/admin_line_chart_card.dart';
import '../widgets/admin_review_section.dart';
import '../widgets/admin_welcome_banner.dart';

class AdminOverviewPage extends ConsumerWidget {
  const AdminOverviewPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.adminPalette;
    final asyncDashboard = ref.watch(adminDashboardProvider);

    return ColoredBox(
      color: palette.pageBackground,
      child: asyncDashboard.when(
        loading: () => const _OverviewSkeleton(),
        error: (_, _) =>
            _ErrorState(onRetry: () => ref.invalidate(adminDashboardProvider)),
        data: (dashboard) => _DashboardBody(dashboard: dashboard),
      ),
    );
  }
}

class _OverviewSkeleton extends StatelessWidget {
  const _OverviewSkeleton();

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: palette.primaryTeal),
            const SizedBox(height: 16),
            Text(
              'Loading dashboard…',
              style: AdminTypography.pageSubtitle(palette),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, color: palette.red, size: 40),
            const SizedBox(height: 12),
            Text(
              l.t('Failed to load dashboard', 'فشل تحميل لوحة التحكم'),
              style: AdminTypography.sectionTitle(palette),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: onRetry,
              style: AppStatusButtonStyle.filled(
                context,
                AppStatusTone.primary,
              ),
              child: Text(l.t('Retry', 'إعادة المحاولة')),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashboardBody extends StatefulWidget {
  const _DashboardBody({required this.dashboard});

  final AdminDashboardResponse dashboard;

  @override
  State<_DashboardBody> createState() => _DashboardBodyState();
}

class _DashboardBodyState extends State<_DashboardBody> {
  final _scrollController = ScrollController();
  final _impactSectionKey = GlobalKey();
  bool _co2ShouldAnimate = false;
  bool _co2RevealChecked = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_checkImpactVisibility);
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkImpactVisibility());
  }

  @override
  void dispose() {
    _scrollController.removeListener(_checkImpactVisibility);
    _scrollController.dispose();
    super.dispose();
  }

  void _checkImpactVisibility() {
    if (_co2RevealChecked) return;

    final context = _impactSectionKey.currentContext;
    if (context == null) return;

    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return;

    final topLeft = box.localToGlobal(Offset.zero);
    final bottom = topLeft.dy + box.size.height;
    final viewportHeight = MediaQuery.sizeOf(this.context).height;

    final isVisible = bottom > 48 && topLeft.dy < viewportHeight * 0.92;
    if (isVisible) {
      setState(() {
        _co2ShouldAnimate = true;
        _co2RevealChecked = true;
      });
    }
  }

  String _fmt(int value) => value.toString();

  @override
  Widget build(BuildContext context) {
    final dashboard = widget.dashboard;
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final width = MediaQuery.sizeOf(context).width;
    final chartColumns = width >= 900;

    final linePoints = dashboard.impact.reuseByMonth
        .map(
          (e) => AdminLineChartPoint(
            label: e.month.length >= 7 ? e.month.substring(5) : e.month,
            value: e.count,
          ),
        )
        .toList();

    final barItems = dashboard.materialsByCategory
        .take(8)
        .toList()
        .asMap()
        .entries
        .map(
          (entry) => AdminBarChartItem(
            label: l.isArabic ? entry.value.nameAr : entry.value.nameEn,
            value: entry.value.count,
            color: palette.categoryBarColors[
                entry.key % palette.categoryBarColors.length],
          ),
        )
        .toList();

    final platformSegments = [
      AdminDonutSegment(
        label: l.statUsers,
        value: dashboard.summary.totalUsers,
        color: palette.blue,
      ),
      AdminDonutSegment(
        label: l.statSuppliers,
        value: dashboard.summary.totalSuppliers,
        color: palette.amber,
      ),
      AdminDonutSegment(
        label: l.statActiveDrivers,
        value: dashboard.summary.activeDrivers,
        color: palette.purple,
      ),
    ];

    final reservationSegments = dashboard.reservationStatusBreakdown
        .map(
          (e) => AdminDonutSegment(
            label: _formatStatus(e.status, l),
            value: e.count,
            color: palette.statusColor(e.status),
          ),
        )
        .toList();

    final reservationTotal =
        reservationSegments.fold<int>(0, (sum, s) => sum + s.value);

    return ListView(
      controller: _scrollController,
      padding: const EdgeInsetsDirectional.only(bottom: 20),
      children: [
        const AdminWelcomeBanner(),
        const SizedBox(height: 14),
        Text(l.platformMetricsTitle, style: AdminTypography.sectionTitle(palette)),
        const SizedBox(height: 10),
        AdminKpiGrid(dashboard: dashboard),
        const SizedBox(height: 18),
        Text(l.chartsAnalyticsTitle, style: AdminTypography.sectionTitle(palette)),
        const SizedBox(height: 10),
        if (chartColumns) ...[
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: AdminDonutChartCard(
                    title: l.platformDistributionTitle,
                    subtitle: l.platformDistributionSubtitle,
                    segments: platformSegments,
                    centerValue: _fmt(dashboard.summary.totalUsers),
                    centerLabel: l.t('Accounts', 'الحسابات'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AdminLineChartCard(
                    title: l.reuseActivityTitle,
                    subtitle: l.reuseActivitySubtitle,
                    points: linePoints,
                    emptySubtitle: l.t(
                      'Completed reuse will appear here over time.',
                      'ستظهر عمليات إعادة الاستخدام المكتملة هنا مع الوقت.',
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: AdminDonutChartCard(
                    title: l.reservationStatusTitle,
                    subtitle: l.reservationStatusSubtitle,
                    segments: reservationSegments,
                    centerValue: _fmt(reservationTotal),
                    centerLabel: l.t('Total', 'الإجمالي'),
                    emptyTitle: l.emptyNoDataYet,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AdminBarChartCard(
                    title: l.materialsByCategoryTitle,
                    subtitle: l.materialsByCategorySubtitle,
                    items: barItems,
                    horizontal: barItems.length <= 4,
                  ),
                ),
              ],
            ),
          ),
        ] else ...[
          AdminDonutChartCard(
            title: l.platformDistributionTitle,
            subtitle: l.platformDistributionSubtitle,
            segments: platformSegments,
            centerValue: _fmt(dashboard.summary.totalUsers),
            centerLabel: l.t('Accounts', 'الحسابات'),
          ),
          const SizedBox(height: 10),
          AdminLineChartCard(
            title: l.reuseActivityTitle,
            subtitle: l.reuseActivitySubtitle,
            points: linePoints,
          ),
          const SizedBox(height: 10),
          AdminDonutChartCard(
            title: l.reservationStatusTitle,
            subtitle: l.reservationStatusSubtitle,
            segments: reservationSegments,
            centerValue: _fmt(reservationTotal),
            centerLabel: l.t('Total', 'الإجمالي'),
          ),
          const SizedBox(height: 10),
          AdminBarChartCard(
            title: l.materialsByCategoryTitle,
            subtitle: l.materialsByCategorySubtitle,
            items: barItems,
            horizontal: true,
          ),
        ],
        const SizedBox(height: 18),
        KeyedSubtree(
          key: _impactSectionKey,
          child: AdminImpactCard(
            impact: dashboard.impact,
            co2ShouldAnimate: _co2ShouldAnimate,
          ),
        ),
        const SizedBox(height: 16),
        AdminReviewSection(
          supplierVerificationPreview: dashboard.supplierVerificationPreview,
          recentInvitations: dashboard.recentInvitations,
          recentActivity: dashboard.recentActivity,
        ),
      ],
    );
  }

  String _formatStatus(String status, AdminL10n l) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return l.t('Pending', 'معلّق');
      case 'ACCEPTED':
        return l.t('Accepted', 'مقبول');
      case 'COMPLETED':
        return l.t('Completed', 'مكتمل');
      case 'REJECTED':
        return l.t('Rejected', 'مرفوض');
      case 'CANCELLED':
        return l.t('Cancelled', 'ملغى');
      default:
        return status;
    }
  }
}
