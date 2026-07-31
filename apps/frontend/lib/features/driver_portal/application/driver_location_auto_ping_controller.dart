import 'dart:async';

import '../../../shared/location/current_location_service.dart';
import '../data/models/driver_delivery.dart';

const driverAutoPingInterval = Duration(seconds: 45);

typedef PeriodicTimerFactory =
    Timer Function(Duration duration, void Function(Timer timer) callback);

class DriverLocationAutoPingState {
  const DriverLocationAutoPingState({
    this.enabled = true,
    this.isSharing = false,
    this.lastSharedAt,
    this.inlineError,
    this.isPinging = false,
  });

  final bool enabled;
  final bool isSharing;
  final DateTime? lastSharedAt;
  final String? inlineError;
  final bool isPinging;

  DriverLocationAutoPingState copyWith({
    bool? enabled,
    bool? isSharing,
    DateTime? lastSharedAt,
    String? inlineError,
    bool clearInlineError = false,
    bool? isPinging,
  }) {
    return DriverLocationAutoPingState(
      enabled: enabled ?? this.enabled,
      isSharing: isSharing ?? this.isSharing,
      lastSharedAt: lastSharedAt ?? this.lastSharedAt,
      inlineError: clearInlineError ? null : (inlineError ?? this.inlineError),
      isPinging: isPinging ?? this.isPinging,
    );
  }
}

typedef DriverLocationPingCallback = Future<void> Function();

typedef DriverLocationErrorMessageResolver = String Function(Object error);

class DriverLocationAutoPingController {
  DriverLocationAutoPingController({
    required DriverLocationPingCallback sendPing,
    this.interval = driverAutoPingInterval,
    void Function(DriverLocationAutoPingState state)? onStateChanged,
    PeriodicTimerFactory? periodicTimerFactory,
    DriverLocationErrorMessageResolver? resolveErrorMessage,
  }) : _sendPing = sendPing,
       _onStateChanged = onStateChanged,
       _periodicTimerFactory = periodicTimerFactory ?? Timer.periodic,
       _resolveErrorMessage = resolveErrorMessage ?? _defaultErrorMessage {
    _emit(_state);
  }

  final DriverLocationPingCallback _sendPing;
  final void Function(DriverLocationAutoPingState state)? _onStateChanged;
  final Duration interval;
  final PeriodicTimerFactory _periodicTimerFactory;
  final DriverLocationErrorMessageResolver _resolveErrorMessage;

  DriverLocationAutoPingState _state = const DriverLocationAutoPingState();
  Timer? _timer;
  bool _disposed = false;
  bool _inFlight = false;
  String? _deliveryStatus;

  DriverLocationAutoPingState get state => _state;

  void setEnabled(bool enabled) {
    if (_disposed || _state.enabled == enabled) {
      return;
    }

    _emit(_state.copyWith(enabled: enabled, clearInlineError: enabled));
    _syncSharing();
  }

  void updateDeliveryStatus(String? status) {
    if (_disposed) {
      return;
    }

    _deliveryStatus = status;
    _syncSharing();
  }

  void dispose() {
    if (_disposed) {
      return;
    }

    _disposed = true;
    _stopTimer();
    if (_state.isSharing) {
      _emit(_state.copyWith(isSharing: false));
    }
  }

  bool get _isEligible =>
      _deliveryStatus != null &&
      isDriverAutoPingEligibleStatus(_deliveryStatus!);

  void _syncSharing() {
    if (_disposed) {
      return;
    }

    final shouldShare = _state.enabled && _isEligible;
    if (!shouldShare) {
      _stopTimer();
      if (_state.isSharing) {
        _emit(_state.copyWith(isSharing: false));
      }
      return;
    }

    if (_timer != null) {
      return;
    }

    _emit(_state.copyWith(isSharing: true, clearInlineError: true));
    unawaited(_runPing());
    _timer = _periodicTimerFactory(interval, (_) {
      unawaited(_runPing());
    });
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _runPing() async {
    if (_disposed || !_state.enabled || !_isEligible || _inFlight) {
      return;
    }

    _inFlight = true;
    _emit(_state.copyWith(isPinging: true));

    try {
      await _sendPing();
      if (_disposed) {
        return;
      }

      _emit(
        _state.copyWith(
          isPinging: false,
          lastSharedAt: DateTime.now(),
          clearInlineError: true,
        ),
      );
    } catch (error) {
      if (_disposed) {
        return;
      }

      final message = _resolveErrorMessage(error);
      final permissionBlocked = _isPermissionFailure(error);

      _emit(
        _state.copyWith(
          isPinging: false,
          inlineError: message,
          enabled: permissionBlocked ? false : _state.enabled,
          isSharing: permissionBlocked ? false : _state.isSharing,
        ),
      );

      if (permissionBlocked) {
        _stopTimer();
      }
    } finally {
      _inFlight = false;
    }
  }

  void _emit(DriverLocationAutoPingState next) {
    _state = next;
    _onStateChanged?.call(next);
  }
}

String _defaultErrorMessage(Object error) {
  if (error is CurrentLocationException) {
    return error.message;
  }

  return 'Could not share location. Try again or use Send my location.';
}

bool _isPermissionFailure(Object error) {
  if (error is! CurrentLocationException) {
    return false;
  }

  return error.failure == CurrentLocationFailure.permissionDenied ||
      error.failure == CurrentLocationFailure.permissionDeniedForever;
}
