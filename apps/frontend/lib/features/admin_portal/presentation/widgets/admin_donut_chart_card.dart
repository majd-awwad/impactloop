import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../theme/admin_decoration_set.dart';
import 'admin_dashboard_card.dart';
import 'admin_empty_state.dart';

class AdminDonutSegment {
  const AdminDonutSegment({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final int value;
  final Color color;
}

class AdminDonutChartCard extends StatelessWidget {
  const AdminDonutChartCard({
    super.key,
    required this.title,
    required this.segments,
    this.subtitle,
    this.centerLabel,
    this.centerValue,
    this.emptyTitle = 'No data yet',
    this.emptySubtitle,
  });

  final String title;
  final String? subtitle;
  final List<AdminDonutSegment> segments;
  final String? centerLabel;
  final String? centerValue;
  final String emptyTitle;
  final String? emptySubtitle;

  int get _total => segments.fold(0, (sum, s) => sum + s.value);

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final active = segments.where((s) => s.value > 0).toList();
    final total = _total;

    return AdminDashboardCard(
      title: title,
      subtitle: subtitle,
      minHeight: 268,
      child: total == 0
          ? AdminEmptyState(
              icon: Icons.donut_large_outlined,
              title: emptyTitle,
              subtitle: emptySubtitle,
            )
          : SizedBox(
              height: 220,
              child: Row(
                children: [
                  Expanded(
                    flex: 5,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        PieChart(
                          PieChartData(
                            sectionsSpace: 2,
                            centerSpaceRadius: 52,
                            startDegreeOffset: -90,
                            sections: [
                              for (final segment in active)
                                PieChartSectionData(
                                  value: segment.value.toDouble(),
                                  color: segment.color,
                                  radius: 38,
                                  showTitle: false,
                                ),
                            ],
                          ),
                          duration: const Duration(milliseconds: 300),
                        ),
                        if (centerValue != null)
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                centerValue!,
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      color: palette.textPrimary,
                                    ),
                              ),
                              if (centerLabel != null)
                                Text(
                                  centerLabel!,
                                  style: Theme.of(context)
                                      .textTheme
                                      .labelSmall
                                      ?.copyWith(
                                        color: palette.textSecondary,
                                      ),
                                ),
                            ],
                          ),
                      ],
                    ),
                  ),
                  Expanded(
                    flex: 6,
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        return SingleChildScrollView(
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              minHeight: constraints.maxHeight,
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                for (final segment in active)
                                  Padding(
                                    padding: const EdgeInsetsDirectional.only(
                                      bottom: 6,
                                    ),
                                    child: _LegendRow(
                                      color: segment.color,
                                      label: segment.label,
                                      value: segment.value,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({
    required this.color,
    required this.label,
    required this.value,
  });

  final Color color;
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: palette.textSecondary,
                ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        Text(
          value.toString(),
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w800,
                color: palette.textPrimary,
              ),
        ),
      ],
    );
  }
}
