import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/application/auth_navigation.dart';
import '../widgets/app_mobile_bottom_nav_bar.dart';
import '../../features/auth/presentation/models/registration_wizard_step.dart';
import '../../features/auth/presentation/pages/auth_checking_page.dart';
import '../../features/auth/presentation/widgets/become_supplier_wizard.dart';
import '../../features/auth/presentation/pages/deprecated_onboarding_page.dart';
import '../../features/auth/presentation/pages/forgot_password_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/presentation/pages/reset_password_page.dart';
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
import '../../features/profile/presentation/pages/learner_profile_edit_page.dart';
import '../../features/profile/presentation/pages/profile_edit_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../../features/profile/presentation/pages/profile_security_page.dart';
import '../../features/reservations/presentation/pages/learner_reservations_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_access_denied_page.dart';
import '../../features/supplier_portal/application/supplier_verification_access.dart';
import '../../features/supplier_portal/presentation/pages/supplier_verification_pending_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_verification_status_page.dart';
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
import '../../features/admin_portal/presentation/pages/admin_access_denied_page.dart';
import '../../features/admin_portal/presentation/pages/admin_invitations_page.dart';
import '../../features/admin_portal/presentation/pages/admin_overview_page.dart';
import '../../features/admin_portal/presentation/pages/admin_approvals_page.dart';
import '../../features/admin_portal/presentation/pages/admin_audit_logs_page.dart';
import '../../features/admin_portal/presentation/pages/admin_deliveries_page.dart';
import '../../features/admin_portal/presentation/pages/admin_learning_projects_page.dart';
import '../../features/admin_portal/presentation/pages/admin_no_show_reports_page.dart';
import '../../features/admin_portal/presentation/pages/admin_reservations_page.dart';
import '../../features/admin_portal/presentation/pages/admin_impact_page.dart';
import '../../features/admin_portal/presentation/pages/admin_materials_page.dart';
import '../../features/admin_portal/presentation/pages/admin_people_page.dart';
import '../../features/admin_portal/presentation/pages/admin_supplier_verification_page.dart';
import '../../features/admin_portal/presentation/widgets/admin_shell.dart';
import '../../features/invitations/presentation/pages/invite_accept_page.dart';

const _supplierAccessDeniedRoute = '/supplier/access-denied';
const _adminAccessDeniedRoute = '/admin/access-denied';

enum _RouteAccessLevel { public, authenticated, learner, supplier, driver, admin }

String? legacyOnboardingRedirect(Ref ref, GoRouterState state) {
  final path = state.matchedLocation;

  if (path != '/complete-learner-profile' &&
      path != '/complete-supplier-profile') {
    return null;
  }

  return '/register';
}

bool _isSupplierPortalPath(String path) {
  if (path == _supplierAccessDeniedRoute) {
    return false;
  }

  if (path == becomeSupplierRoute || path == '/supplier/onboarding') {
    return false;
  }

  if (isSupplierVerificationStatusRoute(path) ||
      path == supplierVerificationPendingRoute) {
    return false;
  }

  return path == '/supplier' || path.startsWith('/supplier/');
}

bool _isDriverPortalPath(String path) {
  return path == '/driver' || path.startsWith('/driver/');
}

bool _isAdminPortalPath(String path) {
  if (path == _adminAccessDeniedRoute) {
    return false;
  }

  return path == '/admin' || path.startsWith('/admin/');
}

bool _isCheckingPath(String path) => path == authCheckingRoute;

bool _isAuthPage(String path) =>
    path == loginRoute ||
    path == registerRoute ||
    path == forgotPasswordRoute ||
    path == resetPasswordRoute;

_RouteAccessLevel _routeAccessForPath(String path) {
  if (path == becomeSupplierRoute || path == '/supplier/onboarding') {
    return _RouteAccessLevel.authenticated;
  }

  if (isSupplierVerificationStatusRoute(path) ||
      path == supplierVerificationPendingRoute) {
    return _RouteAccessLevel.supplier;
  }

  if (_isSupplierPortalPath(path)) {
    return _RouteAccessLevel.supplier;
  }

  if (_isDriverPortalPath(path)) {
    return _RouteAccessLevel.driver;
  }

  if (_isAdminPortalPath(path)) {
    return _RouteAccessLevel.admin;
  }

  if (path == '/learner/reservations' ||
      path.startsWith('/learner/deliveries/')) {
    return _RouteAccessLevel.learner;
  }

  if (path == '/home' ||
      path == '/profile' ||
      path.startsWith('/profile/') ||
      path == _supplierAccessDeniedRoute) {
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

bool _userHasAdminRole(AuthState authState) {
  return userHasRole(authState.user, 'ADMIN');
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
    if (accessLevel == _RouteAccessLevel.public) {
      return null;
    }

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

  if (accessLevel == _RouteAccessLevel.admin && !_userHasAdminRole(authState)) {
    return _adminAccessDeniedRoute;
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

String? _resolveSupplierVerificationRedirect(
  AuthState authState,
  String path,
) {
  if (_isAuthPage(path) ||
      path == '/complete-supplier-profile' ||
      path == '/complete-learner-profile' ||
      path == registerRoute) {
    return null;
  }

  if (!authState.isAuthenticated || authState.user == null) {
    return null;
  }

  if (!userHasSupplierRole(authState.user)) {
    return null;
  }

  final profile = authState.user!.supplierProfile;
  final gate = supplierVerificationGateRoute(
    supplierType: profile?.supplierType,
    verificationStatus: profile?.verificationStatus,
  );

  final onVerificationPage = isSupplierVerificationStatusRoute(path) ||
      path == supplierVerificationPendingRoute;

  if (gate != null && _isSupplierPortalPath(path) && !onVerificationPage) {
    return gate;
  }

  if (gate == null && onVerificationPage) {
    return supplierPortalRoute;
  }

  return null;
}

bool _isLearnerPortalHomePath(String path) {
  return path == '/home' ||
      path == '/learner/reservations' ||
      path.startsWith('/learner/deliveries/');
}

String? _resolveActivePortalRedirect(AuthState authState, String path) {
  if (!authState.isAuthenticated || authState.user == null) {
    return null;
  }

  final user = authState.user!;

  if (user.isSupplierMode &&
      _isLearnerPortalHomePath(path) &&
      user.canSwitchToSupplier) {
    return supplierOverviewRoute;
  }

  if (user.isLearnerMode &&
      _isSupplierPortalPath(path) &&
      path != becomeSupplierRoute &&
      path != '/supplier/onboarding' &&
      user.canSwitchToSupplier) {
    return learningHubRoute;
  }

  return null;
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

  final verificationRedirect = _resolveSupplierVerificationRedirect(
    authState,
    path,
  );
  if (verificationRedirect != null) {
    return verificationRedirect;
  }

  final portalRedirect = _resolveActivePortalRedirect(authState, path);
  if (portalRedirect != null) {
    return portalRedirect;
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
      ShellRoute(
        builder: (context, state, child) =>
            AppMobileNavigationShell(child: child),
        routes: [
          GoRoute(
            path: '/home',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: HomePage()),
          ),
          GoRoute(
            path: '/materials',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: MaterialsDiscoveryPage()),
          ),
          GoRoute(
            path: '/learning',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: LearningHubPage()),
          ),
          GoRoute(
            path: '/learner/reservations',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: LearnerReservationsPage()),
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: ProfilePage()),
          ),
        ],
      ),
      GoRoute(
        path: '/profile/edit',
        builder: (context, state) => const ProfileEditPage(),
      ),
      GoRoute(
        path: '/profile/learner/edit',
        builder: (context, state) => const LearnerProfileEditPage(),
      ),
      GoRoute(
        path: '/profile/security',
        builder: (context, state) => const ProfileSecurityPage(),
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
        path: forgotPasswordRoute,
        builder: (context, state) => _AuthPageGuard(
          child: ForgotPasswordPage(
            initialEmail: state.uri.queryParameters['email'],
          ),
        ),
      ),
      GoRoute(
        path: resetPasswordRoute,
        builder: (context, state) => _AuthPageGuard(
          child: ResetPasswordPage(token: state.uri.queryParameters['token']),
        ),
      ),
      GoRoute(
        path: registerRoute,
        builder: (context, state) {
          final initialIntent = registrationIntentFromQuery(
            state.uri.queryParameters['intent'],
          );

          return _AuthPageGuard(
            child: RegisterPage(initialIntent: initialIntent),
          );
        },
      ),
      GoRoute(
        path: '/complete-learner-profile',
        builder: (context, state) => const DeprecatedOnboardingPage(),
      ),
      GoRoute(
        path: '/complete-supplier-profile',
        builder: (context, state) => const DeprecatedOnboardingPage(),
      ),
      GoRoute(
        path: becomeSupplierRoute,
        builder: (context, state) => const BecomeSupplierPage(),
      ),
      GoRoute(
        path: '/supplier/onboarding',
        redirect: (context, state) => becomeSupplierRoute,
      ),
      GoRoute(
        path: '/invite/accept',
        builder: (context, state) {
          final token = state.uri.queryParameters['token'] ?? '';
          return InviteAcceptPage(token: token);
        },
      ),
      GoRoute(
        path: supplierVerificationPendingRoute,
        builder: (context, state) => const SupplierVerificationPendingPage(),
      ),
      GoRoute(
        path: supplierVerificationStatusRoute,
        builder: (context, state) => const SupplierVerificationStatusPage(),
      ),
      GoRoute(
        path: _supplierAccessDeniedRoute,
        builder: (context, state) => const SupplierAccessDeniedPage(),
      ),
      GoRoute(
        path: _adminAccessDeniedRoute,
        builder: (context, state) => const AdminAccessDeniedPage(),
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
            redirect: (context, state) => supplierOverviewRoute,
          ),
          GoRoute(
            path: '/supplier/overview',
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
      ShellRoute(
        builder: (context, state, child) => AdminShell(child: child),
        routes: [
          GoRoute(
            path: '/admin',
            builder: (context, state) => const AdminOverviewPage(),
          ),
          GoRoute(
            path: '/admin/users',
            builder: (context, state) => AdminPeoplePage(
              initialRole: state.uri.queryParameters['role'],
              initialTab: state.uri.queryParameters['tab'],
            ),
          ),
          GoRoute(
            path: '/admin/suppliers',
            redirect: (context, state) => '/admin/users?role=SUPPLIER',
          ),
          GoRoute(
            path: '/admin/supplier-verification',
            builder: (context, state) =>
                const AdminSupplierVerificationPage(),
          ),
          GoRoute(
            path: '/admin/materials',
            builder: (context, state) => AdminMaterialsPage(
              initialStatus: state.uri.queryParameters['status'],
            ),
          ),
          GoRoute(
            path: '/admin/approvals',
            builder: (context, state) => AdminApprovalsPage(
              initialStatus: state.uri.queryParameters['status'],
            ),
          ),
          GoRoute(
            path: '/admin/invitations',
            builder: (context, state) => AdminInvitationsPage(
              initialStatus: state.uri.queryParameters['status'],
            ),
          ),
          GoRoute(
            path: '/admin/impact',
            builder: (context, state) => const AdminImpactPage(),
          ),
          GoRoute(
            path: '/admin/audit-logs',
            builder: (context, state) => const AdminAuditLogsPage(),
          ),
          GoRoute(
            path: '/admin/reservations',
            builder: (context, state) => const AdminReservationsPage(),
          ),
          GoRoute(
            path: '/admin/no-show-reports',
            builder: (context, state) => const AdminNoShowReportsPage(),
          ),
          GoRoute(
            path: '/admin/deliveries',
            builder: (context, state) => AdminDeliveriesPage(
              initialOpenDeliveryId: state.uri.queryParameters['open'],
            ),
          ),
          GoRoute(
            path: '/admin/learning-projects',
            builder: (context, state) => const AdminLearningProjectsPage(),
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
