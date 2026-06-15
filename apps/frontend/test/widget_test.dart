import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/app/app.dart';
import 'package:frontend/features/auth/data/models/register_request.dart';
import 'package:frontend/features/auth/data/models/registration_draft.dart';
import 'package:frontend/features/auth/presentation/pages/login_page.dart';
import 'package:frontend/features/health/application/health_controller.dart';
import 'package:frontend/features/health/data/health_remote_data_source.dart';
import 'package:frontend/features/auth/presentation/models/registration_intent.dart';
import 'package:frontend/features/auth/presentation/pages/register_page.dart';
import 'package:frontend/features/landing/presentation/pages/landing_page.dart';
import 'package:go_router/go_router.dart';

void main() {
  Future<void> pumpResponsivePage(
    WidgetTester tester,
    Widget page, {
    required Size surfaceSize,
  }) async {
    tester.view.physicalSize = surfaceSize;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(home: page),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('RegisterRequest.fromFormValues', () {
    test('maps learner registrations to learner-only payloads', () {
      final request = RegisterRequest.fromFormValues(
        intent: RegistrationIntent.learner,
        displayName: 'Learner User',
        email: 'learner@example.com',
        password: 'password123',
        learnerProfile: const LearnerProfileDraft(
          learnerType: 'University student',
          skillLevel: 'Beginner',
        ),
      );

      expect(request.roles, const ['LEARNER']);
      expect(request.learnerProfile, isNotNull);
      expect(request.supplierProfile, isNull);
    });

    test('maps supplier registrations to supplier-only payloads', () {
      final request = RegisterRequest.fromFormValues(
        intent: RegistrationIntent.supplier,
        displayName: 'Supplier User',
        email: 'supplier@example.com',
        password: 'password123',
        supplierProfile: const SupplierProfileDraft(
          supplierType: 'Workshop',
          publicName: 'Workshop Hub',
          pickupArea: 'Nablus, Rafidia',
        ),
      );

      expect(request.roles, const ['SUPPLIER']);
      expect(request.learnerProfile, isNull);
      expect(request.supplierProfile, isNotNull);
    });

    test('maps dual-intent registrations to combined payloads', () {
      final request = RegisterRequest.fromFormValues(
        intent: RegistrationIntent.both,
        displayName: 'Dual User',
        email: 'dual@example.com',
        password: 'password123',
        learnerProfile: const LearnerProfileDraft(
          learnerType: 'Self learner',
          skillLevel: 'Advanced',
        ),
        supplierProfile: const SupplierProfileDraft(
          supplierType: 'Educational institution',
          publicName: 'Campus Lab',
          pickupArea: 'Nablus, New Campus',
        ),
      );

      expect(request.roles, const ['LEARNER', 'SUPPLIER']);
      expect(request.learnerProfile, isNotNull);
      expect(request.supplierProfile, isNotNull);
    });
  });

  testWidgets('shows backend health status on /health', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          healthStatusProvider.overrideWith(
            (ref) async => HealthStatus(
              status: 'ok',
              uptime: 1.2,
              timestamp: DateTime(2026),
            ),
          ),
        ],
        child: const ImpactLoopApp(),
      ),
    );

    await tester.pumpAndSettle();

    GoRouter.of(
      tester.element(find.text('Build a better future')),
    ).go('/health');
    await tester.pumpAndSettle();

    expect(find.text('ImpactLoop'), findsWidgets);
    expect(find.text('Backend health'), findsOneWidget);
    expect(find.text('ok'), findsOneWidget);
  });

  testWidgets('shows landing page on /', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: ImpactLoopApp()),
    );

    await tester.pumpAndSettle();

    expect(find.text('Build a better future'), findsOneWidget);
    expect(find.text('Create account'), findsWidgets);
  });

  testWidgets('landing page stays stable on mobile width', (tester) async {
    await pumpResponsivePage(
      tester,
      const LandingPage(),
      surfaceSize: const Size(390, 844),
    );

    expect(find.text('Build a better future'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('dark login stays stable on short laptop height', (tester) async {
    await pumpResponsivePage(
      tester,
      const LoginPage(),
      surfaceSize: const Size(1280, 720),
    );

    expect(find.text('Welcome back'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('unified register stays stable for dual intent on mobile', (
    tester,
  ) async {
    await pumpResponsivePage(
      tester,
      const RegisterPage(),
      surfaceSize: const Size(390, 844),
    );

    final doBothFinder = find.text('Do both');
    await tester.ensureVisible(doBothFinder);
    await tester.tap(doBothFinder);
    await tester.pumpAndSettle();

    expect(find.text('Learner profile'), findsOneWidget);
    expect(find.text('Supplier profile'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
