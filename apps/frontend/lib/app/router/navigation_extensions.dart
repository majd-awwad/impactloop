import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Top-level learner tabs rendered inside [AppMobileNavigationShell].
/// Navigate between these with [GoRouter.go], not [GoRouter.push], so Flutter
/// web keeps the browser URL aligned with the visible shell page.
const learnerShellTabRoutes = {
  '/home',
  '/materials',
  '/learning',
  '/learner/reservations',
  '/profile',
};

/// Top-level supplier tabs rendered inside [SupplierShell].
/// Sibling shell pages must use [GoRouter.go]; [GoRouter.push] stacks a second
/// copy of the same shell page and crashes the Navigator with duplicate keys.
const supplierShellTabRoutes = {
  '/supplier',
  '/supplier/overview',
  '/supplier/materials',
  '/supplier/materials/new',
  '/supplier/reservations',
  '/supplier/pickup-schedule',
  '/supplier/material-requests',
  '/supplier/notifications',
  '/supplier/profile',
};

/// Canonical learner private Portfolio route (registered in [appRouterProvider]).
const learnerPortfolioRoute = '/learner/portfolio';

/// Canonical My Builds list route.
const learnerBuildsRoute = '/learner/builds';

/// Canonical learner help sessions list route.
const learnerHelpSessionsRoute = '/learner/help-sessions';

/// Canonical private learner help session detail route.
String learnerHelpSessionDetailRoute(String sessionId) =>
    '/learner/help-sessions/$sessionId';

/// Canonical creator (project author) help sessions list route.
const creatorHelpSessionsRoute = '/creator/help-sessions';

/// Canonical private creator help session detail route.
String creatorHelpSessionDetailRoute(String sessionId) =>
    '/creator/help-sessions/$sessionId';

/// Canonical project author help-session offering settings route.
String creatorProjectHelpSessionSettingsRoute(String projectId) =>
    '/creator/projects/$projectId/help-sessions/settings';

/// Canonical project submission detail route for a learner-authored project.
String learningProjectSubmissionDetailRoute(String projectId) =>
    '/learning/submissions/$projectId';

/// Canonical public learning project detail route.
String learningProjectPublicDetailRoute(
  String projectId, {
  String? focus,
}) {
  final normalizedFocus = focus?.trim().toLowerCase();
  if (normalizedFocus == null || normalizedFocus.isEmpty) {
    return '/learning/$projectId';
  }
  return Uri(
    path: '/learning/$projectId',
    queryParameters: {'focus': normalizedFocus},
  ).toString();
}

/// Canonical project build route. Supplying [buildId] opens that exact attempt.
String learnerProjectBuildRoute(String projectId, {String? buildId}) {
  final path = '/learning/$projectId/build';
  if (buildId == null || buildId.trim().isEmpty) {
    return path;
  }
  return Uri(path: path, queryParameters: {'buildId': buildId.trim()})
      .toString();
}

/// Canonical private project notebook route for a specific build attempt.
String learnerBuildNotebookRoute(String buildId, {String? pageId}) {
  final base = '/learner/builds/$buildId/notebook';
  if (pageId == null || pageId.trim().isEmpty) {
    return base;
  }
  return '$base?pageId=${Uri.encodeComponent(pageId.trim())}';
}

extension AppNavigationExtensions on BuildContext {
  /// Replaces the current shell page for sibling portal tabs; otherwise pushes.
  void goShellTabOrPush(String location) {
    final path = Uri.tryParse(location)?.path ?? location;
    if (learnerShellTabRoutes.contains(path) ||
        supplierShellTabRoutes.contains(path)) {
      go(location);
      return;
    }
    push(location);
  }

  /// Requests a normal Navigator pop and uses [fallbackLocation] only when the
  /// request bubbles because there is no route in the app stack to pop.
  ///
  /// `Navigator.maybePop` returns `true` both when a route pops and when a
  /// [PopScope] handles/vetoes the request. Awaiting that result before deciding
  /// about the fallback prevents a guard from being bypassed.
  Future<void> popOrGo(String fallbackLocation) async {
    final handled = await Navigator.of(this).maybePop();
    if (handled || !mounted) {
      return;
    }

    go(fallbackLocation);
  }
}
