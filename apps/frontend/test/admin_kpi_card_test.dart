import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/admin_portal/presentation/widgets/admin_kpi_card.dart';

void main() {
  testWidgets('AdminKpiCard renders value, label, and helper text', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdminKpiCard(
            label: 'Users',
            value: '42',
            helper: 'All registered accounts',
            icon: Icons.people_outline,
            accent: const Color(0xFF2563EB),
          ),
        ),
      ),
    );

    expect(find.text('42'), findsOneWidget);
    expect(find.text('Users'), findsOneWidget);
    expect(find.text('All registered accounts'), findsOneWidget);
    expect(find.byIcon(Icons.people_outline), findsOneWidget);
  });
}
