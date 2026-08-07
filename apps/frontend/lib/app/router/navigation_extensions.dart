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

/// Canonical private project notebook route for a specific build attempt.
String learnerBuildNotebookRoute(String buildId, {String? pageId}) {
  final base = '/learner/builds/$buildId/notebook';
  if (pageId == null || pageId.trim().isEmpty) {
    return base;
  }
  return '$base?pageId=${Uri.encodeComponent(pageId.trim())}';
}

extension AppNavigationExtensions on BuildContext {
  void popOrGo(String fallbackLocation) {
    if (canPop()) {
      pop();
      return;
    }

    go(fallbackLocation);
  }
}
