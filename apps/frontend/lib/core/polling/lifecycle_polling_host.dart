import 'package:flutter/widgets.dart';

import 'lifecycle_polling_controller.dart';

/// Wires [LifecyclePollingController] to route visibility and app lifecycle.
mixin LifecyclePollingHost<T extends StatefulWidget>
    on State<T>, WidgetsBindingObserver {
  LifecyclePollingController get lifecyclePollingController;

  bool _routeVisible = true;
  bool _appPaused = false;

  void initLifecyclePollingHost() {
    WidgetsBinding.instance.addObserver(this);
  }

  void disposeLifecyclePollingHost() {
    WidgetsBinding.instance.removeObserver(this);
    lifecyclePollingController.dispose();
  }

  @override
  void activate() {
    super.activate();
    _routeVisible = true;
    _syncPollingPause();
    onLifecyclePollingRouteVisible();
  }

  @override
  void deactivate() {
    _routeVisible = false;
    lifecyclePollingController.setPaused(true);
    super.deactivate();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        _appPaused = false;
        _syncPollingPause();
        if (_routeVisible) {
          onLifecyclePollingAppResumed();
        }
      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
        _appPaused = true;
        lifecyclePollingController.setPaused(true);
      case AppLifecycleState.detached:
        break;
    }
  }

  void _syncPollingPause() {
    lifecyclePollingController.setPaused(_appPaused || !_routeVisible);
  }

  void onLifecyclePollingRouteVisible() {}

  void onLifecyclePollingAppResumed() {}
}
