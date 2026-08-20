import 'package:flutter/material.dart';

import '../../data/models/admin_impact_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import 'admin_dashboard_card.dart';
import 'admin_kpi_card.dart' show AdminTypography;

class AdminEnvironmentalEstimateCard extends StatelessWidget {
  const AdminEnvironmentalEstimateCard({super.key, required this.estimate});

  final AdminEnvironmentalEstimate estimate;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final available = estimate.isAvailable;
    final valueText = available
        ? '≈ ${estimate.estimatedCo2eLabel ?? l.environmentalUnavailableValue}'
        : l.environmentalUnavailableValue;

    return AdminDashboardCard(
      title: l.environmentalEstimateTitle,
      subtitle: l.environmentalEstimateSubtitle,
      trailing: Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: 8,
          vertical: 3,
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l.estimatedPotentialCo2eAvoided,
            style: AdminTypography.kpiLabel(palette),
          ),
          const SizedBox(height: 8),
          Text(
            valueText,
            style: AdminTypography.kpiValue(
              palette,
            ).copyWith(fontSize: available ? 28 : 18, height: 1.25),
          ),
          if (!available) ...[
            const SizedBox(height: 6),
            Text(
              l.environmentalUnavailableBody,
              style: AdminTypography.kpiHelper(palette).copyWith(height: 1.4),
            ),
          ],
          const SizedBox(height: 14),
          Text(
            l.environmentalCoverage(
              estimate.includedReuseEvents,
              estimate.totalCompletedReuseEvents,
            ),
            style: AdminTypography.kpiHelper(
              palette,
            ).copyWith(color: palette.textPrimary, fontWeight: FontWeight.w600),
          ),
          if (estimate.totalCompletedReuseEvents > 0) ...[
            const SizedBox(height: 4),
            Text(
              l.environmentalCoveragePercent(estimate.coveragePercent),
              style: AdminTypography.kpiHelper(palette),
            ),
          ],
          const SizedBox(height: 12),
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              childrenPadding: const EdgeInsetsDirectional.only(bottom: 4),
              title: Text(
                l.calculationMethodology,
                style: AdminTypography.kpiLabel(palette).copyWith(fontSize: 13),
              ),
              children: [
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Text(
                    l.environmentalMethodologyBody,
                    style: AdminTypography.kpiHelper(
                      palette,
                    ).copyWith(height: 1.45, color: palette.textPrimary),
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
