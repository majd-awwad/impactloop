import 'dart:async';

typedef LifecyclePollingCallback = FutureOr<void> Function();

/// Periodic refresh that can be paused while a route is hidden or the app is
/// backgrounded.
///
/// At most one [onRefresh] invocation runs at a time. Ticks that arrive while a
/// refresh is in flight are skipped (no backlog).
class LifecyclePollingController {
  LifecyclePollingController({
    required this.onRefresh,
    required this.interval,
  });

  final LifecyclePollingCallback onRefresh;
  final Duration interval;

  Timer? _timer;
  bool _enabled = false;
  bool _paused = false;
  bool _disposed = false;
  bool _inFlight = false;

  bool get isPollingActive =>
      !_disposed && _enabled && !_paused && _timer != null;

  bool get isRefreshInFlight => _inFlight;

  void setPaused(bool paused) {
    if (_disposed || _paused == paused) {
      return;
    }

    _paused = paused;
    if (_paused) {
      _timer?.cancel();
      _timer = null;
      return;
    }

    _applyPollingState();
  }

  void syncEnabled(bool enabled) {
    if (_disposed) {
      return;
    }

    if (enabled == _enabled && (_timer != null || !enabled)) {
      return;
    }

    _enabled = enabled;
    _applyPollingState();
  }

  void _applyPollingState() {
    _timer?.cancel();
    _timer = null;

    if (_disposed || !_enabled || _paused) {
      return;
    }

    _timer = Timer.periodic(interval, (_) {
      unawaited(_runRefreshTick());
    });
  }

  Future<void> _runRefreshTick() async {
    if (_disposed || !_enabled || _paused || _inFlight) {
      return;
    }

    _inFlight = true;
    try {
      await Future<void>.sync(onRefresh);
    } catch (_) {
      // Callers surface errors in their own UI; never stick in-flight.
    } finally {
      _inFlight = false;
    }
  }

  void dispose() {
    _disposed = true;
    _timer?.cancel();
    _timer = null;
    _enabled = false;
    _paused = false;
  }
}
