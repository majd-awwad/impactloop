import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

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
}
