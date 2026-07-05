import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

extension AppNavigationExtensions on BuildContext {
  void popOrGo(String fallbackLocation) {
    if (canPop()) {
      pop();
      return;
    }

    go(fallbackLocation);
  }
}
