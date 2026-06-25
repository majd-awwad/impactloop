import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/application/auth_navigation.dart';
import '../../features/auth/application/registration_draft_notifier.dart';
import '../../features/auth/presentation/models/registration_intent.dart';
import '../../features/auth/presentation/pages/auth_checking_page.dart';
import '../../features/auth/presentation/pages/complete_learner_profile_page.dart';
import '../../features/auth/presentation/pages/complete_supplier_profile_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/health/presentation/pages/health_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/deliveries/presentation/pages/learner_delivery_detail_page.dart';
import '../../features/driver_portal/presentation/pages/driver_delivery_detail_page.dart';
import '../../features/driver_portal/presentation/pages/driver_jobs_page.dart';
import '../../features/driver_portal/presentation/shell/driver_portal_shell.dart';
import '../../features/learning_hub/presentation/pages/learning_add_draft_page.dart';
import '../../features/learning_hub/presentation/pages/learning_hub_page.dart';
import '../../features/learning_hub/presentation/pages/learning_project_details_page.dart';
import '../../features/landing/presentation/pages/landing_page.dart';
import '../../features/material_discovery/presentation/pages/material_details_page.dart';
import '../../features/material_discovery/presentation/pages/materials_discovery_page.dart';
import '../../features/reservations/presentation/pages/learner_reservations_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_access_denied_page.dart';
import '../../features/supplier_portal/presentation/pages/add_material_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_edit_material_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_my_materials_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_owned_material_detail_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_incoming_requests_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_notifications_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_pickup_schedule_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_dashboard_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_profile_page.dart';
import '../../features/supplier_portal/presentation/shell/supplier_shell.dart';

const _supplierAccessDeniedRoute = '/supplier/access-denied';

enum _RouteAccessLevel { public, authenticated, learner, supplier, driver }

String? legacyOnboardingRedirect(Ref ref, GoRouterState state) {
  final path = state.matchedLocation;

  if (path != '/complete-learner-profile' &&
      path != '/complete-supplier-profile') {
    return null;
  }

  final draft = ref.read(registrationDraftProvider);

  if (path == '/complete-learner-profile') {
    if (!draft.hasBasicInfo) {
      return '/register';
    }

    if (draft.intent == null) {
      return '/register';
    }

    if (draft.intent == RegistrationIntent.supplier) {
      return '/complete-supplier-profile';
    }
  }

  if (path == '/complete-supplier-profile') {
    if (!draft.hasBasicInfo) {
      return '/register';
    }

    if (draft.intent == null) {
      return '/register';
    }

    if (draft.intent == RegistrationIntent.learner) {
      return '/complete-learner-profile';
    }

    if (draft.intent == RegistrationIntent.both &&
        draft.learnerProfile == null) {
      return '/complete-learner-profile?intent=both';
    }
  }

  return null;
}

bool _isSupplierPortalPath(String path) {
  if (path == _supplierAccessDeniedRoute) {
    return false;
  }

  return path == '/supplier' || path.startsWith('/supplier/');
}

bool _isDriverPortalPath(String path) {
  return path == '/driver' || path.startsWith('/driver/');
}

bool _isCheckingPath(String path) => path == authCheckingRoute;

bool _isAuthPage(String path) => path == loginRoute || path == registerRoute;

_RouteAccessLevel _routeAccessForPath(String path) {
  if (_isSupplierPortalPath(path)) {
    return _RouteAccessLevel.supplier;
  }

  if (_isDriverPortalPath(path)) {
    return _RouteAccessLevel.driver;
  }

  if (path == '/learner/reservations' ||
      path.startsWith('/learner/deliveries/')) {
    return _RouteAccessLevel.learner;
  }

  if (path == '/home' || path == _supplierAccessDeniedRoute) {
    return _RouteAccessLevel.authenticated;
  }

  return _RouteAccessLevel.public;
}

bool _userHasSupplierRole(AuthState authState) {
  return userHasSupplierRole(authState.user);
}

bool _userHasLearnerRole(AuthState authState) {
  return userHasRole(authState.user, 'LEARNER');
}

bool _userHasDriverRole(AuthState authState) {
  return userHasDriverRole(authState.user);
}

String _withFrom(String path, String from) {
  final encodedFrom = Uri.encodeQueryComponent(from);
  return '$path?from=$encodedFrom';
}

String _safeFrom(GoRouterState state) {
  return state.uri.toString();
}

String? _resolveProtectedRoute(
  AuthState authState,
  _RouteAccessLevel accessLevel,
  String destination,
) {
  if (authState.status == AuthStatus.unknown) {
    return _withFrom(authCheckingRoute, destination);
  }

  if (accessLevel == _RouteAccessLevel.public) {
    return null;
  }

  if (authState.status == AuthStatus.unauthenticated) {
    return _withFrom(loginRoute, destination);
  }

  if (accessLevel == _RouteAccessLevel.supplier &&
      !_userHasSupplierRole(authState)) {
    return _supplierAccessDeniedRoute;
  }

  if (accessLevel == _RouteAccessLevel.learner &&
      !_userHasLearnerRole(authState)) {
    return homeRoute;
  }

  if (accessLevel == _RouteAccessLevel.driver &&
      !_userHasDriverRole(authState)) {
    return homeRoute;
  }

  return null;
}

String? _resolveAuthCheckingRedirect(AuthState authState, GoRouterState state) {
  if (authState.status == AuthStatus.unknown) {
    return null;
  }

  final target = sanitizeRedirectTarget(
    state.uri.queryParameters['from'],
    fallback: authState.user != null
        ? postAuthRouteForUser(authState.user!)
        : loginRoute,
  );
  final accessLevel = _routeAccessForPath(Uri.parse(target).path);
  return _resolveProtectedRoute(authState, accessLevel, target) ?? target;
}

String? _resolveAuthPageRedirect(AuthState authState, GoRouterState state) {
  if (authState.status != AuthStatus.authenticated || authState.user == null) {
    return null;
  }

  final target = sanitizeRedirectTarget(
    state.uri.queryParameters['from'],
    fallback: postAuthRouteForUser(authState.user!),
  );
  final accessLevel = _routeAccessForPath(Uri.parse(target).path);
  return _resolveProtectedRoute(authState, accessLevel, target) ?? target;
}

String? _resolveRouteRedirect(Ref ref, GoRouterState state) {
  final authState = ref.read(authControllerProvider);
  final path = state.matchedLocation;

  if (_isCheckingPath(path)) {
    return _resolveAuthCheckingRedirect(authState, state);
  }

  if (_isAuthPage(path)) {
    return _resolveAuthPageRedirect(authState, state);
  }

  final accessLevel = _routeAccessForPath(path);
  final protectedRedirect = _resolveProtectedRoute(
    authState,
    accessLevel,
    _safeFrom(state),
  );
  if (protectedRedirect != null) {
    return protectedRedirect;
  }

  if (authState.status == AuthStatus.unknown) {
    return null;
  }

  return legacyOnboardingRedirect(ref, state);
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final refreshListenable = ValueNotifier<int>(0);
  ref.onDispose(refreshListenable.dispose);
  ref.listen<AuthState>(authControllerProvider, (previous, next) {
    refreshListenable.value++;
  });

  return GoRouter(
    refreshListenable: refreshListenable,
    redirect: (context, state) => _resolveRouteRedirect(ref, state),
    routes: [
      GoRoute(path: '/', builder: (context, state) => const LandingPage()),
      GoRoute(path: '/health', builder: (context, state) => const HealthPage()),
      GoRoute(path: '/home', builder: (context, state) => const HomePage()),
      GoRoute(
        path: '/learner/reservations',
        builder: (context, state) => const LearnerReservationsPage(),
      ),
      GoRoute(
        path: '/learner/deliveries/:id',
        builder: (context, state) =>
            LearnerDeliveryDetailPage(deliveryId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: authCheckingRoute,
        builder: (context, state) => const AuthCheckingPage(),
      ),
      GoRoute(
        path: '/learning',
        builder: (context, state) => const LearningHubPage(),
      ),
      GoRoute(
        path: '/learning/add-draft',
        builder: (context, state) => const LearningAddDraftPage(),
      ),
      GoRoute(
        path: '/learning/:id',
        builder: (context, state) {
          final projectId = state.pathParameters['id']!;

          return LearningProjectDetailsPage(projectId: projectId);
        },
      ),
      GoRoute(
        path: '/materials',
        builder: (context, state) => const MaterialsDiscoveryPage(),
      ),
      GoRoute(
        path: '/materials/:id',
        builder: (context, state) {
          final materialId = state.pathParameters['id']!;

          return MaterialDetailsPage(materialId: materialId);
        },
      ),
      GoRoute(
        path: loginRoute,
        builder: (context, state) => const _AuthPageGuard(child: LoginPage()),
      ),
      GoRoute(
        path: registerRoute,
        builder: (context, state) =>
            const _AuthPageGuard(child: RegisterPage()),
      ),
      GoRoute(
        path: '/complete-learner-profile',
        builder: (context, state) {
          final isBothIntent = state.uri.queryParameters['intent'] == 'both';

          return CompleteLearnerProfilePage(showSupplierNextHint: isBothIntent);
        },
      ),
      GoRoute(
        path: '/complete-supplier-profile',
        builder: (context, state) => const CompleteSupplierProfilePage(),
      ),
      GoRoute(
        path: _supplierAccessDeniedRoute,
        builder: (context, state) => const SupplierAccessDeniedPage(),
      ),
      ShellRoute(
        builder: (context, state, child) => DriverPortalShell(child: child),
        routes: [
          GoRoute(
            path: '/driver',
            redirect: (context, state) => '/driver/jobs',
          ),
          GoRoute(
            path: '/driver/jobs',
            builder: (context, state) => const DriverJobsPage(),
          ),
          GoRoute(
            path: '/driver/deliveries/:id',
            builder: (context, state) => DriverDeliveryDetailPage(
              deliveryId: state.pathParameters['id']!,
            ),
          ),
        ],
      ),
      ShellRoute(
        builder: (context, state, child) => SupplierShell(child: child),
        routes: [
          GoRoute(
            path: '/supplier',
            builder: (context, state) => const SupplierDashboardPage(),
          ),
          GoRoute(
            path: '/supplier/materials/new',
            builder: (context, state) => AddMaterialPage(
              categoryRequestId: state.uri.queryParameters['categoryRequestId'],
              priceRuleRequestId:
                  state.uri.queryParameters['priceRuleRequestId'],
            ),
          ),
          GoRoute(
            path: '/supplier/materials/:id/edit',
            builder: (context, state) => SupplierEditMaterialPage(
              key: ValueKey(state.pathParameters['id']),
              materialId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/supplier/materials/:id',
            redirect: (context, state) {
              if (state.pathParameters['id'] == 'new') {
                final query = state.uri.query;
                return query.isEmpty
                    ? '/supplier/materials/new'
                    : '/supplier/materials/new?$query';
              }
              return null;
            },
            builder: (context, state) => SupplierOwnedMaterialDetailPage(
              materialId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/supplier/materials',
            builder: (context, state) => const SupplierMyMaterialsPage(),
          ),
          GoRoute(
            path: '/supplier/reservations',
            builder: (context, state) => SupplierIncomingRequestsPage(
              initialTab: state.uri.queryParameters['tab'],
              focusReservationId: state.uri.queryParameters['focus'],
            ),
          ),
          GoRoute(
            path: '/supplier/pickup-schedule',
            builder: (context, state) => const SupplierPickupSchedulePage(),
          ),
          GoRoute(
            path: '/supplier/notifications',
            builder: (context, state) => const SupplierNotificationsPage(),
          ),
          GoRoute(
            path: '/supplier/profile',
            builder: (context, state) => const SupplierProfilePage(),
          ),
        ],
      ),
    ],
  );
});

class _AuthPageGuard extends ConsumerWidget {
  const _AuthPageGuard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);

    if (authState.status == AuthStatus.unknown) {
      return const AuthCheckingPage();
    }

    return child;
  }
}
