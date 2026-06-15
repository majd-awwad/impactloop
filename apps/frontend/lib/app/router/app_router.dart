import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/registration_draft_notifier.dart';
import '../../features/auth/presentation/models/registration_intent.dart';
import '../../features/auth/presentation/pages/choose_role_page.dart';
import '../../features/auth/presentation/pages/complete_learner_profile_page.dart';
import '../../features/auth/presentation/pages/complete_supplier_profile_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/health/presentation/pages/health_page.dart';
import '../../features/home/presentation/pages/home_page.dart';

String? registrationOnboardingRedirect(
  Ref ref,
  GoRouterState state,
) {
  final draft = ref.read(registrationDraftProvider);
  final path = state.matchedLocation;

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

    if (draft.intent == RegistrationIntent.both && draft.learnerProfile == null) {
      return '/complete-learner-profile?intent=both';
    }
  }

  return null;
}

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    redirect: (context, state) => registrationOnboardingRedirect(ref, state),
    routes: [
      GoRoute(path: '/', builder: (context, state) => const HealthPage()),
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
    ],
  );
});
