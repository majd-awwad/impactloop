import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

typedef HelpSessionBoundaryCallback = void Function();

class HelpSessionBoundaryRefresh extends ConsumerStatefulWidget {
  const HelpSessionBoundaryRefresh({
    super.key,
    required this.boundaryAt,
    required this.isBoundaryReached,
    required this.onBoundary,
    required this.child,
  });

  final DateTime? boundaryAt;
  final bool isBoundaryReached;
  final HelpSessionBoundaryCallback onBoundary;
  final Widget child;

  @override
  ConsumerState<HelpSessionBoundaryRefresh> createState() =>
      _HelpSessionBoundaryRefreshState();
}

class _HelpSessionBoundaryRefreshState
    extends ConsumerState<HelpSessionBoundaryRefresh> {
  Timer? _timer;
  DateTime? _scheduledBoundaryAt;
  bool _pastBoundaryCatchUpScheduled = false;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant HelpSessionBoundaryRefresh oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.boundaryAt != widget.boundaryAt) {
      _pastBoundaryCatchUpScheduled = false;
    }
    _scheduleBoundaryTimer();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scheduleBoundaryTimer());
  }

  void _scheduleBoundaryTimer() {
    final boundary = widget.boundaryAt;
    if (boundary == null || widget.isBoundaryReached) {
      _timer?.cancel();
      _scheduledBoundaryAt = null;
      _pastBoundaryCatchUpScheduled = false;
      return;
    }
    if (_scheduledBoundaryAt == boundary && _timer != null) {
      return;
    }
    _scheduledBoundaryAt = boundary;
    _timer?.cancel();
    final delay = boundary.difference(DateTime.now());
    if (delay.isNegative) {
      if (_pastBoundaryCatchUpScheduled) {
        return;
      }
      _pastBoundaryCatchUpScheduled = true;
      _timer = Timer(const Duration(milliseconds: 500), () {
        if (!mounted || widget.isBoundaryReached) {
          return;
        }
        widget.onBoundary();
      });
      return;
    }
    _pastBoundaryCatchUpScheduled = false;
    _timer = Timer(delay, () {
      if (!mounted) {
        return;
      }
      widget.onBoundary();
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
