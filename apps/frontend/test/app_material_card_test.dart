import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/shared/widgets/entity_attribution_footer.dart';

import 'package:frontend/shared/widgets/materials/app_material_card.dart';
import 'package:frontend/shared/widgets/materials/material_condition_badge.dart';
import 'package:frontend/shared/widgets/materials/material_status_badge.dart';
import 'package:frontend/shared/widgets/materials/materials_ui_palette.dart';

void main() {
  testWidgets('shows fallback icon when image url is missing', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 340,
              child: AppMaterialCard(
                title: 'Wood panels',
                description: 'Reusable surplus wood',
                category: 'Wood',
                conditionLabel: 'Good',
                conditionTone: MaterialConditionBadgeTone.good,
                statusLabel: 'Available',
                statusTone: MaterialStatusBadgeTone.available,
                quantityLabel: '4 sheet',
                priceLabel: 'Free',
                locationLabel: 'Nablus',
                availabilityLabel: 'Pickup only',
                deliveryAvailable: false,
                isFree: true,
                gradientColors: const [
                  materialFallbackStart,
                  materialFallbackEnd,
                ],
                fallbackIcon: Icons.carpenter_outlined,
                variant: AppMaterialCardVariant.compact,
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.byIcon(Icons.carpenter_outlined), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });

  testWidgets('renders network image when url is provided', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 340,
              child: AppMaterialCard(
                title: 'Arduino boards',
                description: 'Electronics surplus',
                category: 'Electronics',
                conditionLabel: 'Good',
                conditionTone: MaterialConditionBadgeTone.good,
                statusLabel: 'Available',
                statusTone: MaterialStatusBadgeTone.available,
                quantityLabel: '2 piece',
                priceLabel: 'Free',
                locationLabel: 'Ramallah',
                availabilityLabel: 'Delivery available',
                deliveryAvailable: true,
                isFree: true,
                gradientColors: const [Color(0xFF1C3F66), Color(0xFF121E2D)],
                imageUrl: 'https://example.com/material.jpg',
                fallbackIcon: Icons.memory_rounded,
                variant: AppMaterialCardVariant.compact,
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.byType(Image), findsOneWidget);
  });

  testWidgets('shows supplier attribution row when supplier data is provided', (
    tester,
  ) async {
    var supplierTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 340,
              child: AppMaterialCard(
                title: 'Wood panels',
                description: 'Reusable surplus wood',
                category: 'Wood',
                conditionLabel: 'Good',
                conditionTone: MaterialConditionBadgeTone.good,
                statusLabel: 'Available',
                statusTone: MaterialStatusBadgeTone.available,
                quantityLabel: '4 sheet',
                priceLabel: 'Free',
                locationLabel: 'Nablus',
                availabilityLabel: 'Pickup only',
                deliveryAvailable: false,
                isFree: true,
                gradientColors: const [
                  materialFallbackStart,
                  materialFallbackEnd,
                ],
                fallbackIcon: Icons.carpenter_outlined,
                variant: AppMaterialCardVariant.compact,
                supplierDisplayName: 'Workshop One',
                onSupplierTap: () => supplierTapped = true,
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Workshop One'), findsOneWidget);
    expect(find.byType(EntityAttributionFooter), findsOneWidget);
    expect(find.byIcon(Icons.chevron_right_rounded), findsNothing);

    await tester.tap(find.text('Workshop One'));
    await tester.pump();

    expect(supplierTapped, isTrue);
  });

  testWidgets('supplier attribution shows initial fallback and verified badge', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 340,
              child: AppMaterialCard(
                title: 'Wood panels',
                description: 'Reusable surplus wood',
                category: 'Wood',
                conditionLabel: 'Good',
                conditionTone: MaterialConditionBadgeTone.good,
                statusLabel: 'Available',
                statusTone: MaterialStatusBadgeTone.available,
                quantityLabel: '4 sheet',
                priceLabel: 'Free',
                locationLabel: 'Nablus',
                availabilityLabel: 'Pickup only',
                deliveryAvailable: false,
                isFree: true,
                gradientColors: const [
                  materialFallbackStart,
                  materialFallbackEnd,
                ],
                fallbackIcon: Icons.carpenter_outlined,
                variant: AppMaterialCardVariant.compact,
                supplierDisplayName: 'Majd Tech Reuse Workshop',
                supplierVerified: true,
                onSupplierTap: () {},
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text('M'), findsOneWidget);
    expect(find.byIcon(Icons.verified_rounded), findsOneWidget);
  });

  testWidgets('hides supplier attribution row for existing callers', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 340,
              child: AppMaterialCard(
                title: 'Wood panels',
                description: 'Reusable surplus wood',
                category: 'Wood',
                conditionLabel: 'Good',
                conditionTone: MaterialConditionBadgeTone.good,
                statusLabel: 'Available',
                statusTone: MaterialStatusBadgeTone.available,
                quantityLabel: '4 sheet',
                priceLabel: 'Free',
                locationLabel: 'Nablus',
                availabilityLabel: 'Pickup only',
                deliveryAvailable: false,
                isFree: true,
                gradientColors: const [
                  materialFallbackStart,
                  materialFallbackEnd,
                ],
                fallbackIcon: Icons.carpenter_outlined,
                variant: AppMaterialCardVariant.compact,
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Workshop One'), findsNothing);
  });

  testWidgets('supplier tap does not invoke material onTap', (tester) async {
    var materialTapped = false;
    var supplierTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 340,
              child: AppMaterialCard(
                title: 'Wood panels',
                description: 'Reusable surplus wood',
                category: 'Wood',
                conditionLabel: 'Good',
                conditionTone: MaterialConditionBadgeTone.good,
                statusLabel: 'Available',
                statusTone: MaterialStatusBadgeTone.available,
                quantityLabel: '4 sheet',
                priceLabel: 'Free',
                locationLabel: 'Nablus',
                availabilityLabel: 'Pickup only',
                deliveryAvailable: false,
                isFree: true,
                gradientColors: const [
                  materialFallbackStart,
                  materialFallbackEnd,
                ],
                fallbackIcon: Icons.carpenter_outlined,
                variant: AppMaterialCardVariant.compact,
                onTap: () => materialTapped = true,
                supplierDisplayName: 'Workshop One',
                onSupplierTap: () => supplierTapped = true,
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Workshop One'));
    await tester.pump();

    expect(supplierTapped, isTrue);
    expect(materialTapped, isFalse);
  });

  testWidgets('material tap remains unchanged when supplier row is present', (
    tester,
  ) async {
    var materialTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 340,
              child: AppMaterialCard(
                title: 'Wood panels',
                description: 'Reusable surplus wood',
                category: 'Wood',
                conditionLabel: 'Good',
                conditionTone: MaterialConditionBadgeTone.good,
                statusLabel: 'Available',
                statusTone: MaterialStatusBadgeTone.available,
                quantityLabel: '4 sheet',
                priceLabel: 'Free',
                locationLabel: 'Nablus',
                availabilityLabel: 'Pickup only',
                deliveryAvailable: false,
                isFree: true,
                gradientColors: const [
                  materialFallbackStart,
                  materialFallbackEnd,
                ],
                fallbackIcon: Icons.carpenter_outlined,
                variant: AppMaterialCardVariant.compact,
                onTap: () => materialTapped = true,
                supplierDisplayName: 'Workshop One',
                onSupplierTap: () {},
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Wood panels'));
    await tester.pump();

    expect(materialTapped, isTrue);
  });

  testWidgets('grid card keeps supplier attribution visible with full metadata', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 300,
              height: ImpactMaterialGridCard.heightForWidth(
                300,
                includesSupplierAttribution: true,
              ),
              child: ImpactMaterialGridCard(
                title: 'Community Jumper Wire Pieces',
                description: 'Individual jumper wire pieces donated for builds.',
                category: 'Electronics & Components',
                conditionLabel: 'Good',
                conditionTone: MaterialConditionBadgeTone.good,
                statusLabel: 'Available',
                statusTone: MaterialStatusBadgeTone.available,
                quantityLabel: '24 pieces',
                priceLabel: 'Free',
                locationLabel: 'Hebron, University District',
                availabilityLabel: 'Pickup only',
                deliveryAvailable: false,
                isFree: true,
                gradientColors: const [
                  materialFallbackStart,
                  materialFallbackEnd,
                ],
                fallbackIcon: Icons.memory_rounded,
                supplierDisplayName: 'Majd Tech Reuse Workshop',
                onSupplierTap: () {},
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Majd Tech Reuse Workshop'), findsOneWidget);
  });
}
