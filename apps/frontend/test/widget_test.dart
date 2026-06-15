import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/app/app.dart';
import 'package:frontend/features/health/application/health_controller.dart';
import 'package:frontend/features/health/data/health_remote_data_source.dart';
import 'package:go_router/go_router.dart';

void main() {
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
}
