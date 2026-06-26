import 'package:flutter/material.dart';

import '../theme/admin_decoration_set.dart';
import 'admin_kpi_card.dart' show AdminTypography;

/// Animates CO₂ ring and value when [shouldAnimate] becomes true (once per mount).
class AdminCo2ProgressRing extends StatefulWidget {
  const AdminCo2ProgressRing({
    super.key,
    required this.shouldAnimate,
    required this.progress,
    required this.co2Kg,
    required this.centerLabel,
    required this.helperText,
    this.size = 148,
  });

  final bool shouldAnimate;
  /// 0–1 visual progress from API (`impact.co2ReuseProgress`).
  final double progress;
  final double co2Kg;
  final String centerLabel;
  final String helperText;
  final double size;

  @override
  State<AdminCo2ProgressRing> createState() => _AdminCo2ProgressRingState();
}

class _AdminCo2ProgressRingState extends State<AdminCo2ProgressRing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late Animation<double> _animation;
  bool _hasStarted = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    _animation = CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);
    if (widget.shouldAnimate) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _startAnimation());
    }
  }

  @override
  void didUpdateWidget(AdminCo2ProgressRing oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.shouldAnimate && !_hasStarted) {
      _startAnimation();
    }
  }

  void _startAnimation() {
    if (_hasStarted) return;
    _hasStarted = true;
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _formatCo2(double kg) {
    if (!kg.isFinite || kg < 0) return '0 kg CO₂e';
    final rounded = (kg * 10).roundToDouble() / 10;
    return '$rounded kg CO₂e';
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final stroke = widget.size * 0.085;
    final targetProgress = widget.progress.clamp(0.0, 1.0);

    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        final t = _hasStarted ? _animation.value : 0.0;
        final animatedProgress = targetProgress * t;
        final animatedKg = widget.co2Kg * t;

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: widget.size,
              height: widget.size,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: widget.size,
                    height: widget.size,
                    child: CircularProgressIndicator(
                      value: 1,
                      strokeWidth: stroke,
                      color: palette.chartGrid,
                      backgroundColor: Colors.transparent,
                    ),
                  ),
                  SizedBox(
                    width: widget.size,
                    height: widget.size,
                    child: CircularProgressIndicator(
                      value: animatedProgress,
                      strokeWidth: stroke,
                      strokeCap: StrokeCap.round,
                      color: palette.primaryTeal,
                      backgroundColor: Colors.transparent,
                    ),
                  ),
                  Padding(
                    padding: EdgeInsets.all(stroke + 6),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _formatCo2(animatedKg),
                          textAlign: TextAlign.center,
                          style: AdminTypography.kpiValue(palette).copyWith(
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          widget.centerLabel,
                          textAlign: TextAlign.center,
                          style: AdminTypography.kpiHelper(palette).copyWith(
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  Text(
                    '${(animatedProgress * 100).round()}%',
                    style: AdminTypography.kpiValue(palette).copyWith(
                      fontSize: 28,
                      color: palette.primaryTeal,
                    ),
                  ),
                  Text(
                    widget.centerLabel,
                    style: AdminTypography.kpiLabel(palette),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    widget.helperText,
                    style: AdminTypography.kpiHelper(palette),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
