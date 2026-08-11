import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/shared/widgets/supplier/supplier_identity_widgets.dart';
import 'package:frontend/shared/widgets/user_avatar.dart';

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

    expect(find.byType(UserAvatar), findsOneWidget);
    expect(find.byType(Image), findsNothing);
    expect(find.text('M'), findsOneWidget);
    expect(find.byIcon(Icons.storefront_outlined), findsNothing);
  });

  testWidgets(
    'shows initials for DiceBear placeholder URLs without loading network image',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData.light(),
          home: const Scaffold(
            body: SupplierIdentityAvatar(
              displayName: 'نور حسين',
              avatarUrl:
                  'https://api.dicebear.com/9.x/initials/png?seed=%D9%86%D9%88%D8%B1%20%D8%AD%D8%B3%D9%8A%D9%86',
              radius: 14,
            ),
          ),
        ),
      );

      expect(find.byType(Image), findsNothing);
      expect(find.text('ن'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('shows network image when a real avatar url is set', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: const Scaffold(
          body: SupplierIdentityAvatar(
            displayName: 'Workshop One',
            avatarUrl: '/uploads/profiles/profile_test.webp',
            radius: 14,
          ),
        ),
      ),
    );

    expect(find.byType(Image), findsOneWidget);
    expect(find.text('W'), findsNothing);
  });

  testWidgets('falls back to initials when network image fails to load', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: const Scaffold(
          body: SupplierIdentityAvatar(
            displayName: 'Workshop One',
            avatarUrl: 'https://invalid.invalid/avatar.png',
            radius: 14,
          ),
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(seconds: 2));

    expect(find.text('W'), findsOneWidget);
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
