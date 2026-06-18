import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/application/auth_navigation.dart';
import '../../features/auth/application/registration_draft_notifier.dart';
import '../../features/auth/presentation/models/registration_intent.dart';
import '../../features/auth/presentation/pages/choose_role_page.dart';
import '../../features/auth/presentation/pages/complete_learner_profile_page.dart';
import '../../features/auth/presentation/pages/complete_supplier_profile_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/health/presentation/pages/health_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/landing/presentation/pages/landing_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_access_denied_page.dart';
import '../../features/supplier_portal/presentation/pages/add_material_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_coming_soon_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_incoming_requests_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_dashboard_page.dart';
import '../../features/supplier_portal/presentation/pages/supplier_profile_page.dart';
import '../../features/supplier_portal/presentation/shell/supplier_shell.dart';

String? legacyOnboardingRedirect(Ref ref, GoRouterState state) {
  final path = state.matchedLocation;

  if (path != '/choose-role' &&
      path != '/complete-learner-profile' &&
      path != '/complete-supplier-profile') {
    return null;
  }

  final draft = ref.read(registrationDraftProvider);

  if (path == '/choose-role' && !draft.hasBasicInfo) {
    return '/register';
  }

  if (path == '/complete-learner-profile') {
    if (!draft.hasBasicInfo) {
      return '/register';
    }

    if (draft.intent == null) {
      return '/choose-role';
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
      return '/choose-role';
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
  if (path == '/supplier/access-denied') {
    return false;
  }

  return path == '/supplier' ||
      path.startsWith('/supplier/');
}

bool _userHasSupplierRole(AuthState authState) {
  return userHasSupplierRole(authState.user);
}

String? supplierPortalRedirect(Ref ref, GoRouterState state) {
  final path = state.matchedLocation;

  if (!_isSupplierPortalPath(path)) {
    return null;
  }

  final authState = ref.read(authControllerProvider);

  if (!authState.isAuthenticated) {
    return '/login';
  }

  if (!_userHasSupplierRole(authState)) {
    return '/supplier/access-denied';
  }

  return null;
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final refreshListenable = ValueNotifier<int>(0);
  ref.onDispose(refreshListenable.dispose);
  ref.listen<AuthState>(authControllerProvider, (previous, next) {
    refreshListenable.value++;
  });

  return GoRouter(
    refreshListenable: refreshListenable,
    redirect: (context, state) {
      final authState = ref.read(authControllerProvider);
      final path = state.matchedLocation;

      if (!authState.hasBootstrapped) {
        return null;
      }

      if (!authState.isAuthenticated && path == '/home') {
        return '/login';
      }

      if (authState.isAuthenticated &&
          (path == '/login' || path == '/register')) {
        return postAuthRouteForUser(authState.user!);
      }

      final supplierRedirect = supplierPortalRedirect(ref, state);
      if (supplierRedirect != null) {
        return supplierRedirect;
      }

      return legacyOnboardingRedirect(ref, state);
    },
    routes: [
      GoRoute(path: '/', builder: (context, state) => const LandingPage()),
      GoRoute(path: '/health', builder: (context, state) => const HealthPage()),
      GoRoute(path: '/home', builder: (context, state) => const HomePage()),
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterPage(),
      ),
      GoRoute(
        path: '/choose-role',
        builder: (context, state) => const ChooseRolePage(),
      ),
      GoRoute(
        path: '/complete-learner-profile',
        builder: (context, state) {
          final isBothIntent = state.uri.queryParameters['intent'] == 'both';

          return CompleteLearnerProfilePage(
            showSupplierNextHint: isBothIntent,
          );
        },
      ),
      GoRoute(
        path: '/complete-supplier-profile',
        builder: (context, state) => const CompleteSupplierProfilePage(),
      ),
      GoRoute(
        path: '/supplier/access-denied',
        builder: (context, state) => const SupplierAccessDeniedPage(),
      ),
      GoRoute(
        path: '/materials',
        builder: (context, state) => const SupplierComingSoonPage(
          standalone: true,
          title: 'Browse materials',
          description:
              'Public material discovery is coming soon. You will be able to explore reusable parts and surplus components from suppliers across ImpactLoop.',
        ),
      ),
      ShellRoute(
        builder: (context, state, child) => SupplierShell(child: child),
        routes: [
          GoRoute(
            path: '/supplier',
            builder: (context, state) => const SupplierDashboardPage(),
          ),
          GoRoute(
            path: '/supplier/materials',
            builder: (context, state) => const SupplierComingSoonPage(
              title: 'My Materials',
              description:
                  'Manage your listed materials here soon. You will be able to view, edit, and track the status of everything you share.',
            ),
          ),
          GoRoute(
            path: '/supplier/materials/new',
            builder: (context, state) => const AddMaterialPage(),
          ),
          GoRoute(
            path: '/supplier/reservations',
            builder: (context, state) => const SupplierIncomingRequestsPage(),
          ),
          GoRoute(
            path: '/supplier/pickup-schedule',
            builder: (context, state) => const SupplierComingSoonPage(
              title: 'Pickup Schedule',
              description:
                  'Your pickup schedule is coming soon. Accepted reservations with pickup windows will be organized here.',
            ),
          ),
          GoRoute(
            path: '/supplier/notifications',
            builder: (context, state) => const SupplierComingSoonPage(
              title: 'Notifications',
              description:
                  'Supplier notifications are coming soon. Stay updated on reservations, messages, and account activity.',
            ),
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
