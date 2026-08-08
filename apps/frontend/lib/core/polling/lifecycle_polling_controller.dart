import 'dart:async';

typedef LifecyclePollingCallback = void Function();

/// Periodic refresh that can be paused while a route is hidden or the app is
/// backgrounded.
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

  bool get isPollingActive => _enabled && !_paused && _timer != null;

  void setPaused(bool paused) {
    if (_paused == paused) {
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
    if (enabled == _enabled && (_timer != null || !enabled)) {
      return;
    }

    _enabled = enabled;
    _applyPollingState();
  }

  void _applyPollingState() {
    _timer?.cancel();
    _timer = null;

    if (!_enabled || _paused) {
      return;
    }

    _timer = Timer.periodic(interval, (_) {
      if (!_paused && _enabled) {
        onRefresh();
      }
    });
  }

  void dispose() {
    _timer?.cancel();
    _timer = null;
    _enabled = false;
    _paused = false;
  }
}
