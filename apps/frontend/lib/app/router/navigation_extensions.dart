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

extension AppNavigationExtensions on BuildContext {
  void popOrGo(String fallbackLocation) {
    if (canPop()) {
      pop();
      return;
    }

    go(fallbackLocation);
  }
}
