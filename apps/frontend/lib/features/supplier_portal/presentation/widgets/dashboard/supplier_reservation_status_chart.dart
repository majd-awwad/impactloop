import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_dashboard_chart_card.dart';
import 'supplier_dashboard_colors.dart';

class SupplierReservationStatusChart extends StatelessWidget {
  const SupplierReservationStatusChart({
    super.key,
    required this.pending,
    required this.accepted,
    required this.completed,
  });

  final int pending;
  final int accepted;
  final int completed;

  int get _total => pending + accepted + completed;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final segments = [
      SupplierDashboardChartSegment(
        label: context.s.tabPending,
        value: pending,
        color: SupplierDashboardColors.pending,
      ),
      SupplierDashboardChartSegment(
        label: context.s.tabAccepted,
        value: accepted,
        color: SupplierDashboardColors.accepted,
      ),
      SupplierDashboardChartSegment(
        label: context.s.tabCompleted,
        value: completed,
        color: SupplierDashboardColors.completed,
      ),
    ];

    if (_total == 0) {
      return SupplierDashboardChartEmptyState(
        message: context.s.reservationChartEmpty,
        icon: Icons.donut_large_outlined,
      );
    }

    return Column(
      children: [
        SizedBox(
          height: 180,
          child: Row(
            children: [
              Expanded(
                child: CustomPaint(
                  painter: _DonutChartPainter(
                    segments: segments,
                    innerFillColor: colors.surfaceSolid.withValues(alpha: 0.92),
                  ),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '$_total',
                          style: context.supplierTitle().copyWith(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          context.s.totalLabel,
                          style: context.supplierBody().copyWith(
                            color: colors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: segments
                      .map(
                        (segment) => Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _SegmentRow(
                            label: segment.label,
                            value: segment.value,
                            color: segment.color,
                            percent: segment.value / _total,
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        SupplierDashboardChartLegend(
          items: segments
              .map(
                (segment) => (
                  label: segment.label,
                  value: segment.value,
                  color: segment.color,
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _SegmentRow extends StatelessWidget {
  const _SegmentRow({
    required this.label,
    required this.value,
    required this.color,
    required this.percent,
  });

  final String label;
  final int value;
  final Color color;
  final double percent;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: context.supplierBody().copyWith(fontSize: 12),
              ),
            ),
            Text(
              '$value',
              style: context.supplierLabel().copyWith(
                color: color,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            minHeight: 5,
            value: percent.clamp(0, 1),
            backgroundColor: colors.chipUnselected.withValues(alpha: 0.6),
            color: color,
          ),
        ),
      ],
    );
  }
}

class _DonutChartPainter extends CustomPainter {
  _DonutChartPainter({required this.segments, required this.innerFillColor});

  final List<SupplierDashboardChartSegment> segments;
  final Color innerFillColor;

  @override
  void paint(Canvas canvas, Size size) {
    final total = segments.fold<int>(0, (sum, item) => sum + item.value);
    if (total == 0) {
      return;
    }

    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 - 8;
    const strokeWidth = 22.0;
    var startAngle = -math.pi / 2;

    for (final segment in segments) {
      if (segment.value == 0) {
        continue;
      }

      final sweep = (segment.value / total) * math.pi * 2;
      final paint = Paint()
        ..color = segment.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.butt;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        sweep,
        false,
        paint,
      );
      startAngle += sweep;
    }

    final innerPaint = Paint()
      ..color = innerFillColor
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, radius - strokeWidth + 2, innerPaint);
  }

  @override
  bool shouldRepaint(covariant _DonutChartPainter oldDelegate) {
    return oldDelegate.segments != segments ||
        oldDelegate.innerFillColor != innerFillColor;
  }
}
