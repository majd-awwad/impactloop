import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../theme/admin_decoration_set.dart';
import '../theme/admin_palette.dart';
import 'admin_dashboard_card.dart';
import 'admin_empty_state.dart';

class AdminBarChartItem {
  const AdminBarChartItem({
    required this.label,
    required this.value,
    this.color,
  });

  final String label;
  final int value;
  final Color? color;
}

class AdminBarChartCard extends StatelessWidget {
  const AdminBarChartCard({
    super.key,
    required this.title,
    required this.items,
    this.subtitle,
    this.horizontal = false,
    this.emptyTitle = 'No category data yet',
    this.emptySubtitle,
  });

  final String title;
  final String? subtitle;
  final List<AdminBarChartItem> items;
  final bool horizontal;
  final String emptyTitle;
  final String? emptySubtitle;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final trimmed = items.where((i) => i.value >= 0).take(8).toList();
    final hasData = trimmed.any((i) => i.value > 0);

    return AdminDashboardCard(
      title: title,
      subtitle: subtitle,
      minHeight: 268,
      child: !hasData
          ? AdminEmptyState(
              icon: Icons.bar_chart,
              title: emptyTitle,
              subtitle: emptySubtitle,
            )
          : horizontal
              ? _HorizontalBars(items: trimmed, palette: palette)
              : SizedBox(
                  height: 230,
                  child: BarChart(_buildVerticalData(trimmed, palette)),
                ),
    );
  }

  BarChartData _buildVerticalData(
    List<AdminBarChartItem> items,
    AdminPalette palette,
  ) {
    final maxY = items.map((i) => i.value).fold(0, (a, b) => a > b ? a : b);
    final top = maxY == 0 ? 4.0 : (maxY * 1.15).ceilToDouble();

    return BarChartData(
      maxY: top,
      gridData: FlGridData(
        show: true,
        drawVerticalLine: false,
        horizontalInterval: top <= 4 ? 1 : (top / 4).ceilToDouble(),
        getDrawingHorizontalLine: (value) => FlLine(
          color: palette.chartGrid,
          strokeWidth: 1,
        ),
      ),
      borderData: FlBorderData(show: false),
      titlesData: FlTitlesData(
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 28,
            interval: top <= 4 ? 1 : (top / 4).ceilToDouble(),
            getTitlesWidget: (value, meta) => Text(
              value.toInt().toString(),
              style: TextStyle(
                color: palette.textMuted,
                fontSize: 10,
              ),
            ),
          ),
        ),
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 36,
            getTitlesWidget: (value, meta) {
              final index = value.toInt();
              if (index < 0 || index >= items.length) {
                return const SizedBox.shrink();
              }
              final label = items[index].label;
              final short = label.length > 8 ? '${label.substring(0, 7)}…' : label;
              return Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  short,
                  style: TextStyle(
                    color: palette.textMuted,
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                ),
              );
            },
          ),
        ),
      ),
      barTouchData: BarTouchData(
        touchTooltipData: BarTouchTooltipData(
          getTooltipColor: (_) => palette.cardBackground,
          getTooltipItem: (group, groupIndex, rod, rodIndex) {
            return BarTooltipItem(
              '${items[group.x.toInt()].label}\n${rod.toY.toInt()}',
              TextStyle(
                color: palette.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            );
          },
        ),
      ),
      barGroups: [
        for (var i = 0; i < items.length; i++)
          BarChartGroupData(
            x: i,
            barRods: [
              BarChartRodData(
                toY: items[i].value.toDouble(),
                width: 18,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    (items[i].color ??
                            palette.categoryBarColors[
                                i % palette.categoryBarColors.length])
                        .withValues(alpha: 0.75),
                    items[i].color ??
                        palette.categoryBarColors[
                            i % palette.categoryBarColors.length],
                  ],
                ),
              ),
            ],
          ),
      ],
    );
  }
}

class _HorizontalBars extends StatelessWidget {
  const _HorizontalBars({required this.items, required this.palette});

  final List<AdminBarChartItem> items;
  final AdminPalette palette;

  @override
  Widget build(BuildContext context) {
    final max = items.map((i) => i.value).fold(0, (a, b) => a > b ? a : b);

    return Column(
      children: [
        for (var i = 0; i < items.length; i++)
          Padding(
            padding: const EdgeInsetsDirectional.only(bottom: 10),
            child: _HorizontalBarRow(
              item: items[i],
              maxValue: max,
              color: items[i].color ??
                  palette.categoryBarColors[i % palette.categoryBarColors.length],
            ),
          ),
      ],
    );
  }
}

class _HorizontalBarRow extends StatelessWidget {
  const _HorizontalBarRow({
    required this.item,
    required this.maxValue,
    required this.color,
  });

  final AdminBarChartItem item;
  final int maxValue;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final fraction = maxValue == 0 ? 0.0 : item.value / maxValue;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                item.label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              item.value.toString(),
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: palette.textPrimary,
                  ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: fraction,
            minHeight: 9,
            backgroundColor: palette.chartGrid,
            color: color,
          ),
        ),
      ],
    );
  }
}
