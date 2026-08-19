import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_route_helpers.dart';

/// Closes an in-app scanner dialog, or leaves a deep-link scanner route.
void closeHandoverScanner(
  BuildContext context, {
  required Object result,
  String? closeFallbackRoute,
  String? manualCodeRoute,
  required bool isManualCode,
}) {
  final navigator = Navigator.of(context);
  if (navigator.canPop()) {
    navigator.pop(result);
    return;
  }

  final target = isManualCode
      ? (manualCodeRoute ?? closeFallbackRoute)
      : closeFallbackRoute;
  context.go(target == null || target.isEmpty ? rootRoute : target);
}
