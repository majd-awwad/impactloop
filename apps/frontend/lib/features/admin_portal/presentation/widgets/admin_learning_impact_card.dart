import 'package:flutter/material.dart';

import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import 'admin_dashboard_card.dart';
import 'admin_kpi_card.dart' show AdminTypography;

class AdminLearningImpactCard extends StatelessWidget {
  const AdminLearningImpactCard({
    super.key,
    required this.componentsFulfilled,
    required this.buildsSupported,
    required this.projectsSupported,
  });

  final int componentsFulfilled;
  final int buildsSupported;
  final int projectsSupported;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final metrics = [
      _LearningMetric(
        value: componentsFulfilled.toString(),
        label: l.learningComponentsFulfilled,
        icon: Icons.playlist_add_check_rounded,
        color: palette.green,
      ),
      _LearningMetric(
        value: buildsSupported.toString(),
        label: l.learningBuildsSupported,
        icon: Icons.construction_outlined,
        color: palette.primaryTeal,
      ),
      _LearningMetric(
        value: projectsSupported.toString(),
        label: l.learningProjectsSupported,
        icon: Icons.auto_stories_outlined,
        color: palette.blue,
      ),
    ];

    return AdminDashboardCard(
      title: l.learningImpactTitle,
      subtitle: l.learningImpactSubtitle,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 640;
          if (wide) {
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < metrics.length; i++) ...[
                  if (i > 0) const SizedBox(width: 10),
                  Expanded(child: metrics[i]),
                ],
              ],
            );
          }

          return Column(
            children: [
              for (var i = 0; i < metrics.length; i++) ...[
                if (i > 0) const SizedBox(height: 10),
                metrics[i],
              ],
            ],
          );
        },
      ),
    );
  }
}

class _LearningMetric extends StatelessWidget {
  const _LearningMetric({
    required this.value,
    required this.label,
    required this.icon,
    required this.color,
  });

  final String value;
  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.fromSTEB(12, 12, 12, 12),
      decoration: BoxDecoration(
        color: palette.isDark
            ? const Color(0xFF152A24)
            : const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 8),
          Text(
            value,
            style: AdminTypography.kpiValue(palette).copyWith(fontSize: 22),
          ),
          const SizedBox(height: 4),
          Text(label, style: AdminTypography.kpiHelper(palette), maxLines: 3),
        ],
      ),
    );
  }
}
