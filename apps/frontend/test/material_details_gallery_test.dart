import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/domain/discovery_material_image.dart';
import 'package:frontend/features/material_discovery/presentation/widgets/material_details_gallery.dart';
import 'package:frontend/shared/models/localized_text.dart';

void main() {
  testWidgets('shows fallback when no images are available', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MaterialDetailsGallery(
            images: const [],
            imageAltText: const LocalizedText(en: 'Wood panels', ar: 'Wood panels'),
            fallbackIcon: Icons.inventory_2_outlined,
            gradientColors: const [Color(0xFF20504D), Color(0xFF152724)],
          ),
        ),
      ),
    );

    expect(find.byIcon(Icons.inventory_2_outlined), findsOneWidget);
    expect(find.byType(ListView), findsNothing);
  });

  testWidgets('shows one image without thumbnails', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MaterialDetailsGallery(
            images: const [
              DiscoveryMaterialImage(
                id: 'img-1',
                url: 'https://example.com/material.jpg',
                isCover: true,
                isPrimary: true,
              ),
            ],
            imageAltText: const LocalizedText(en: 'Arduino board', ar: 'Arduino board'),
            fallbackIcon: Icons.memory_rounded,
            gradientColors: const [Color(0xFF1C3F66), Color(0xFF121E2D)],
          ),
        ),
      ),
    );

    expect(find.byType(Image), findsOneWidget);
    expect(find.byType(ListView), findsNothing);
  });

  testWidgets('shows thumbnails when multiple images exist', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MaterialDetailsGallery(
            images: const [
              DiscoveryMaterialImage(
                id: 'img-1',
                url: 'https://example.com/cover.jpg',
                isCover: true,
                isPrimary: true,
              ),
              DiscoveryMaterialImage(
                id: 'img-2',
                url: 'https://example.com/secondary.jpg',
              ),
            ],
            imageAltText: const LocalizedText(en: 'Motor driver', ar: 'Motor driver'),
            fallbackIcon: Icons.memory_rounded,
            gradientColors: const [Color(0xFF1C3F66), Color(0xFF121E2D)],
          ),
        ),
      ),
    );

    expect(find.byType(ListView), findsOneWidget);
    expect(find.byType(InkWell), findsNWidgets(2));
  });
}
