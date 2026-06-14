import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/app/app.dart';
import 'package:frontend/features/health/application/health_controller.dart';
import 'package:frontend/features/health/data/health_remote_data_source.dart';

void main() {
  testWidgets('shows backend health status', (tester) async {
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

    expect(find.text('ImpactLoop'), findsOneWidget);
    expect(find.text('Backend health'), findsOneWidget);
    expect(find.text('ok'), findsOneWidget);
  });
}
