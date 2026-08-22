import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/core/config/api_config.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_content_blocks.dart';
import 'package:frontend/shared/widgets/app_network_image.dart';
import 'package:frontend/shared/widgets/materials/app_material_card.dart';

void main() {
  Widget buildHarness(Widget child, {Locale locale = const Locale('ar')}) {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => Scaffold(body: child),
        ),
        GoRoute(
          path: '/learning/:id',
          builder: (context, state) =>
              Scaffold(body: Text('project-${state.pathParameters['id']}')),
        ),
        GoRoute(
          path: '/materials/:id',
          builder: (context, state) =>
              Scaffold(body: Text('material-${state.pathParameters['id']}')),
        ),
      ],
    );

    return ProviderScope(
      child: MaterialApp.router(
        locale: locale,
        supportedLocales: const [Locale('en'), Locale('ar')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        routerConfig: router,
      ),
    );
  }

  AiContentBlock projectRecommendationBlock({
    String? thumbnailUrl,
    String reason = 'يطابق اهتمامك بالأردوينو',
  }) {
    return AiContentBlock.fromJson({
      'type': 'recommendations',
      'recommendationType': 'PROJECTS',
      'items': [
        {
          'itemType': 'PROJECT',
          'itemId': 'proj-led',
          'title': 'Simple LED Circuit',
          'thumbnailUrl': thumbnailUrl,
          'difficulty': 'Beginner',
          'estimatedTimeLabel': '45 min',
          'categoryLabel': 'Electronics',
          'reasons': [reason],
        },
      ],
    });
  }

  AiContentBlock materialRecommendationBlock({
    String? thumbnailUrl,
    String reason = 'تتوفر مكونات مطابقة حاليًا',
  }) {
    return AiContentBlock.fromJson({
      'type': 'recommendations',
      'recommendationType': 'MATERIALS',
      'items': [
        {
          'itemType': 'MATERIAL',
          'itemId': 'mat-1',
          'title': 'Breadboard pack',
          'thumbnailUrl': thumbnailUrl,
          'priceLabel': 'Free',
          'categoryLabel': 'Electronics',
          'distanceKm': 2.4,
          'reasons': [reason],
        },
      ],
    });
  }

  AiContentBlock materialResultsBlock({String? thumbnailUrl}) {
    return AiContentBlock.fromJson({
      'type': 'material_results',
      'items': [
        {
          'materialId': 'mat-motor',
          'title': 'DC motor',
          'thumbnailUrl': thumbnailUrl,
          'priceLabel': 'Free',
          'categoryLabel': 'Electronics',
        },
      ],
    });
  }

  group('AI material result images', () {
    testWidgets(
      'resolves an origin-relative thumbnail against the API origin',
      (tester) async {
        const relativeUrl =
            '/demo-assets/community-materials/materials/MAT-036_01.jpg';
        await tester.pumpWidget(
          buildHarness(
            SizedBox(
              width: 320,
              child: AiContentBlockView(
                block: materialResultsBlock(thumbnailUrl: relativeUrl),
                messageBlocks: const [],
                blockIndex: 0,
              ),
            ),
          ),
        );

        final card = tester.widget<ImpactMaterialCompactCard>(
          find.byType(ImpactMaterialCompactCard),
        );
        expect(
          card.imageUrl,
          ApiConfig.backendOrigin.resolve(relativeUrl).toString(),
        );
        expect(find.byType(AppNetworkImage), findsOneWidget);
      },
    );

    testWidgets('preserves a full HTTP thumbnail URL', (tester) async {
      const absoluteUrl = 'https://cdn.example.com/material.jpg';
      await tester.pumpWidget(
        buildHarness(
          SizedBox(
            width: 320,
            child: AiContentBlockView(
              block: materialResultsBlock(thumbnailUrl: absoluteUrl),
              messageBlocks: const [],
              blockIndex: 0,
            ),
          ),
        ),
      );

      final card = tester.widget<ImpactMaterialCompactCard>(
        find.byType(ImpactMaterialCompactCard),
      );
      expect(card.imageUrl, absoluteUrl);
      expect(find.byType(AppNetworkImage), findsOneWidget);
    });

    testWidgets('uses the placeholder only when the thumbnail is absent', (
      tester,
    ) async {
      await tester.pumpWidget(
        buildHarness(
          SizedBox(
            width: 320,
            child: AiContentBlockView(
              block: materialResultsBlock(),
              messageBlocks: const [],
              blockIndex: 0,
            ),
          ),
        ),
      );

      final card = tester.widget<ImpactMaterialCompactCard>(
        find.byType(ImpactMaterialCompactCard),
      );
      expect(card.imageUrl, isNull);
      expect(find.byType(AppNetworkImage), findsNothing);
      expect(find.byIcon(Icons.inventory_2_outlined), findsOneWidget);
    });
  });

  group('AI recommendation cards', () {
    testWidgets('renders project recommendation with image and Arabic reason', (
      tester,
    ) async {
      await tester.pumpWidget(
        buildHarness(
          SizedBox(
            width: 320,
            child: AiContentBlockView(
              block: projectRecommendationBlock(
                thumbnailUrl: 'https://example.com/led.jpg',
              ),
              messageBlocks: const [],
              blockIndex: 0,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Simple LED Circuit'), findsOneWidget);
      expect(find.text('يطابق اهتمامك بالأردوينو'), findsOneWidget);
      expect(find.text('Beginner'), findsOneWidget);
      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('renders material recommendation card', (tester) async {
      await tester.pumpWidget(
        buildHarness(
          SizedBox(
            width: 320,
            child: AiContentBlockView(
              block: materialRecommendationBlock(
                thumbnailUrl: 'https://example.com/breadboard.jpg',
              ),
              messageBlocks: const [],
              blockIndex: 0,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Breadboard pack'), findsOneWidget);
      expect(find.text('Free'), findsOneWidget);
      expect(find.text('تتوفر مكونات مطابقة حاليًا'), findsOneWidget);
    });

    testWidgets('navigates to project details on tap', (tester) async {
      await tester.pumpWidget(
        buildHarness(
          SizedBox(
            width: 320,
            child: AiContentBlockView(
              block: projectRecommendationBlock(),
              messageBlocks: const [],
              blockIndex: 0,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Simple LED Circuit'));
      await tester.pumpAndSettle();

      expect(find.text('project-proj-led'), findsOneWidget);
    });

    testWidgets('navigates to material details on tap', (tester) async {
      await tester.pumpWidget(
        buildHarness(
          SizedBox(
            width: 320,
            child: AiContentBlockView(
              block: materialRecommendationBlock(),
              messageBlocks: const [],
              blockIndex: 0,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Breadboard pack'));
      await tester.pumpAndSettle();

      expect(find.text('material-mat-1'), findsOneWidget);
    });

    testWidgets('shows placeholder layout when image missing', (tester) async {
      await tester.pumpWidget(
        buildHarness(
          SizedBox(
            width: 280,
            child: AiContentBlockView(
              block: projectRecommendationBlock(thumbnailUrl: null),
              messageBlocks: const [],
              blockIndex: 0,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Simple LED Circuit'), findsOneWidget);
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('uses fallback reason label when reasons missing', (
      tester,
    ) async {
      final block = AiContentBlock.fromJson({
        'type': 'recommendations',
        'recommendationType': 'PROJECTS',
        'items': [
          {
            'itemType': 'PROJECT',
            'itemId': 'proj-2',
            'title': 'Robot Car',
            'difficulty': 'Intermediate',
            'reasons': [],
          },
        ],
      });

      await tester.pumpWidget(
        buildHarness(
          SizedBox(
            width: 280,
            child: AiContentBlockView(
              block: block,
              messageBlocks: const [],
              blockIndex: 0,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('موصى به لك'), findsOneWidget);
    });
  });
}
