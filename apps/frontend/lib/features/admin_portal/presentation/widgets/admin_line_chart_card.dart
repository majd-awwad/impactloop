import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../theme/admin_decoration_set.dart';
import '../theme/admin_palette.dart';
import 'admin_dashboard_card.dart';
import 'admin_empty_state.dart';

class AdminLineChartPoint {
  const AdminLineChartPoint({required this.label, required this.value});

  final String label;
  final int value;
}

class AdminLineChartCard extends StatelessWidget {
  const AdminLineChartCard({
    super.key,
    required this.title,
    required this.points,
    this.subtitle,
    this.lineColor,
    this.emptyTitle = 'No reuse activity yet',
    this.emptySubtitle,
  });

  final String title;
  final String? subtitle;
  final List<AdminLineChartPoint> points;
  final Color? lineColor;
  final String emptyTitle;
  final String? emptySubtitle;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final color = lineColor ?? palette.green;
    final hasData = points.any((p) => p.value > 0);

    return AdminDashboardCard(
      title: title,
      subtitle: subtitle,
      minHeight: 268,
      child: !hasData
          ? AdminEmptyState(
              icon: Icons.show_chart,
              title: emptyTitle,
              subtitle: emptySubtitle,
            )
          : SizedBox(
              height: 230,
              child: LineChart(
                _buildData(points, color, palette),
                duration: const Duration(milliseconds: 300),
              ),
            ),
    );
  }

  LineChartData _buildData(
    List<AdminLineChartPoint> points,
    Color color,
    AdminPalette palette,
  ) {
    final maxY = points.map((p) => p.value).fold(0, (a, b) => a > b ? a : b);
    final top = maxY == 0 ? 4.0 : (maxY * 1.2).ceilToDouble();

    return LineChartData(
      minY: 0,
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
      titlesData: FlTitlesData(
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 32,
            interval: top <= 4 ? 1 : (top / 4).ceilToDouble(),
            getTitlesWidget: (value, meta) => Text(
              value.toInt().toString(),
              style: TextStyle(
                color: palette.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 28,
            interval: 1,
            getTitlesWidget: (value, meta) {
              final index = value.toInt();
              if (index < 0 || index >= points.length) {
                return const SizedBox.shrink();
              }
              return Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  points[index].label,
                  style: TextStyle(
                    color: palette.textMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              );
            },
          ),
        ),
      ),
      borderData: FlBorderData(show: false),
      lineTouchData: LineTouchData(
        touchTooltipData: LineTouchTooltipData(
          getTooltipColor: (_) => palette.cardBackground,
          getTooltipItems: (spots) => spots
              .map(
                (spot) => LineTooltipItem(
                  spot.y.toInt().toString(),
                  TextStyle(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              )
              .toList(),
        ),
      ),
      lineBarsData: [
        LineChartBarData(
          spots: [
            for (var i = 0; i < points.length; i++)
              FlSpot(i.toDouble(), points[i].value.toDouble()),
          ],
          isCurved: true,
          curveSmoothness: 0.28,
          color: color,
          barWidth: 3,
          isStrokeCapRound: true,
          dotData: FlDotData(
            show: true,
            getDotPainter: (spot, percent, bar, index) => FlDotCirclePainter(
              radius: 4,
              color: color,
              strokeWidth: 2,
              strokeColor: palette.cardBackground,
            ),
          ),
          belowBarData: BarAreaData(
            show: true,
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                color.withValues(alpha: 0.28),
                color.withValues(alpha: 0.02),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
