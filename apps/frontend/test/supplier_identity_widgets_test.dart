import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/shared/widgets/materials/materials_ui_palette.dart';
import 'package:frontend/shared/widgets/supplier/supplier_identity_widgets.dart';

void main() {
  testWidgets('renders initial fallback when avatar url is missing', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: const Scaffold(
          body: SupplierIdentityAvatar(
            displayName: 'Majd Tech Reuse Workshop',
            radius: 28,
          ),
        ),
      ),
    );

    expect(find.text('M'), findsOneWidget);
    expect(find.byIcon(Icons.storefront_outlined), findsNothing);
  });

  testWidgets('supplier attribution row shows verified badge', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: Scaffold(
          body: SupplierAttributionRow(
            displayName: 'Workshop One',
            isVerified: true,
            onTap: () {},
          ),
        ),
      ),
    );

    expect(find.text('Workshop One'), findsOneWidget);
    expect(find.byIcon(Icons.verified_rounded), findsOneWidget);
  });
}
