import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/presentation/widgets/discovery_location_privacy_panel.dart';

void main() {
  testWidgets('location privacy panel does not mention fake nearby map', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: DiscoveryLocationPrivacyPanel())),
    );

    expect(find.textContaining('5 km'), findsNothing);
    expect(find.textContaining('Radius'), findsNothing);
    expect(find.textContaining('Nearby Material Map'), findsNothing);
    expect(
      find.textContaining('Map browsing is coming later'),
      findsOneWidget,
    );
  });
}
