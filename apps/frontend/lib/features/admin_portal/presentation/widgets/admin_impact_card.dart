import 'package:flutter/material.dart';

import '../../data/models/admin_dashboard_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import 'admin_co2_progress_ring.dart';
import 'admin_dashboard_card.dart';
import 'admin_kpi_card.dart' show AdminTypography;

class AdminImpactCard extends StatelessWidget {
  const AdminImpactCard({
    super.key,
    required this.impact,
    required this.co2ShouldAnimate,
  });

  final AdminImpactSnapshot impact;
  final bool co2ShouldAnimate;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final top = impact.topCategory;

    return AdminDashboardCard(
      title: l.impactSectionTitle,
      subtitle: l.impactSnapshotSubtitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsetsDirectional.fromSTEB(14, 14, 14, 14),
            decoration: BoxDecoration(
              color: palette.isDark
                  ? const Color(0xFF152A24)
                  : const Color(0xFFF0FDF9),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: palette.primaryTeal.withValues(alpha: 0.22),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      l.estimatedCo2Avoided,
                      style: AdminTypography.kpiLabel(palette).copyWith(
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: palette.primaryTeal.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        l.estimatedBadge,
                        style: AdminTypography.kpiHelper(palette).copyWith(
                          color: palette.primaryTeal,
                          fontWeight: FontWeight.w700,
                          fontSize: 10,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                AdminCo2ProgressRing(
                  shouldAnimate: co2ShouldAnimate,
                  progress: impact.co2ReuseProgress,
                  co2Kg: impact.estimatedCo2Kg,
                  centerLabel: l.estimatedCo2Avoided,
                  helperText: impact.estimatedCo2Method.isNotEmpty
                      ? impact.estimatedCo2Method
                      : l.estimatedCo2Helper,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          LayoutBuilder(
            builder: (context, constraints) {
              final metrics = [
                _ImpactMetric(
                  label: l.impactReusedMaterials,
                  value: impact.reusedMaterials.toString(),
                  icon: Icons.recycling_outlined,
                  color: palette.green,
                ),
                _ImpactMetric(
                  label: l.impactCompletedReservations,
                  value: impact.completedReservations.toString(),
                  icon: Icons.check_circle_outline,
                  color: palette.primaryTeal,
                ),
                _ImpactMetric(
                  label: l.impactLearnersBenefited,
                  value: impact.learnersBenefited.toString(),
                  icon: Icons.school_outlined,
                  color: palette.blue,
                ),
                _ImpactMetric(
                  label: l.impactSuppliersContributed,
                  value: impact.suppliersContributed.toString(),
                  icon: Icons.storefront_outlined,
                  color: palette.amber,
                ),
              ];

              final wide = constraints.maxWidth >= 720;
              if (wide) {
                return Row(
                  children: [
                    for (var i = 0; i < metrics.length; i++) ...[
                      if (i > 0) const SizedBox(width: 10),
                      Expanded(child: metrics[i]),
                    ],
                  ],
                );
              }

              return Wrap(
                spacing: 10,
                runSpacing: 10,
                children: metrics
                    .map(
                      (m) => SizedBox(
                        width: constraints.maxWidth >= 400
                            ? (constraints.maxWidth - 10) / 2
                            : constraints.maxWidth,
                        child: m,
                      ),
                    )
                    .toList(),
              );
            },
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsetsDirectional.fromSTEB(12, 10, 12, 10),
            decoration: BoxDecoration(
              color: palette.isDark
                  ? palette.cardBackground
                  : const Color(0xFFF9FAFB),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: palette.cardBorder),
            ),
            child: Row(
              children: [
                Icon(Icons.category_outlined, size: 16, color: palette.amber),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    top == null
                        ? l.impactTopCategoryEmpty
                        : (l.isArabic
                            ? '${l.impactTopCategory}: ${top.nameAr} (${top.reusedCount})'
                            : '${l.impactTopCategory}: ${top.nameEn} (${top.reusedCount})'),
                    style: AdminTypography.kpiHelper(palette).copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ImpactMetric extends StatelessWidget {
  const _ImpactMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: palette.isDark
            ? const Color(0xFF152A24)
            : const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: AdminTypography.kpiValue(palette).copyWith(
                    fontSize: 18,
                  ),
                ),
                Text(
                  label,
                  style: AdminTypography.kpiHelper(palette),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
