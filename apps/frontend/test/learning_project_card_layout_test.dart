import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_material_coverage.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/learning_project_card.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/learning_project_card_layout.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_engagement_strip.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_material_coverage_chip.dart';
import 'package:frontend/shared/models/localized_text.dart';

void main() {
  setUp(() {
    final previousOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      final message = details.exceptionAsString();
      if (message.contains('RenderFlex overflowed')) {
        fail('Layout overflow: $message');
      }
      previousOnError?.call(details);
    };
  });

  group('LearningProjectCard layout', () {
    testWidgets('wide desktop grid width does not overflow', (tester) async {
      await _pumpCard(
        tester,
        cardWidth: LearningProjectCardLayout.itemWidthForGrid(
          gridWidth: 1200,
          columns: 3,
        ),
        project: _overflowProject(),
      );

      expect(tester.takeException(), isNull);
      expect(find.byType(LearningProjectCard), findsOneWidget);
    });

    testWidgets('long project description does not overflow', (tester) async {
      await _pumpCard(
        tester,
        cardWidth: 392,
        project: _overflowProject(
          summary: const LocalizedText(
            en:
                'Build a durable PVC plant stand with adjustable shelves, drainage trays, and weather-resistant fittings for balcony or patio gardening throughout the season.',
            ar: 'وصف طويل',
          ),
        ),
      );

      expect(tester.takeException(), isNull);
    });

    testWidgets('all materials available card label does not overflow', (
      tester,
    ) async {
      await _pumpCard(
        tester,
        cardWidth: 392,
        project: _overflowProject(
          materialCoverage: const ProjectMaterialCoverageSummary(
            totalRequiredComponents: 5,
            availableComponents: 5,
            partialComponents: 0,
            missingComponents: 0,
            unknownComponents: 0,
            availabilityRatio: 1,
            coverageLevel: ProjectMaterialCoverageLevel.full,
          ),
        ),
      );

      expect(find.text('All materials available'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('personal readiness label does not overflow', (tester) async {
      await _pumpCard(
        tester,
        cardWidth: 392,
        project: _overflowProject(
          personalBuildReadiness: const ProjectPersonalBuildReadiness(
            buildId: 'build-1',
            buildStatus: 'IN_PROGRESS',
            readyComponents: 2,
            totalRequiredComponents: 5,
            needsMaterialComponents: 3,
            readinessRatio: 0.4,
          ),
        ),
      );

      expect(find.textContaining('2 of 5 ready in your build'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('engagement footer remains visible', (tester) async {
      await _pumpCard(
        tester,
        cardWidth: 392,
        project: _overflowProject(),
      );

      expect(find.byType(ProjectEngagementStrip), findsOneWidget);
      expect(find.byIcon(Icons.favorite_border), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('desktop row cards remain aligned', (tester) async {
      final width = LearningProjectCardLayout.itemWidthForGrid(
        gridWidth: 1200,
        columns: 3,
      );

      await tester.binding.setSurfaceSize(const Size(1200, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: Row(
                children: [
                  SizedBox(
                    width: width,
                    child: LearningProjectCard(project: _overflowProject()),
                  ),
                  SizedBox(
                    width: width,
                    child: LearningProjectCard(
                      project: _overflowProject(
                        title: const LocalizedText(
                          en: 'Wooden Tool Caddy',
                          ar: 'حامل أدوات خشبي',
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final boxes = tester
          .renderObjectList(find.byType(LearningProjectCard))
          .map((object) => (object as RenderBox).size.height)
          .toList();

      expect(boxes.every((height) => height == boxes.first), isTrue);
      expect(tester.takeException(), isNull);
    });

    testWidgets('tablet width does not overflow', (tester) async {
      await _pumpCard(
        tester,
        cardWidth: LearningProjectCardLayout.itemWidthForGrid(
          gridWidth: 820,
          columns: 2,
        ),
        project: _overflowProject(
          title: const LocalizedText(
            en: 'Reclaimed Wood Birdhouse',
            ar: 'بيت عصفور من خشب معاد تدويره',
          ),
        ),
      );

      expect(tester.takeException(), isNull);
    });

    testWidgets('mobile width does not overflow', (tester) async {
      await _pumpCard(
        tester,
        cardWidth: 390,
        project: _overflowProject(
          title: const LocalizedText(
            en: 'PVC Plant Stand with Adjustable Shelves',
            ar: 'حامل نباتات من البي في سي بأرفف قابلة للتعديل',
          ),
        ),
      );

      expect(tester.takeException(), isNull);
    });

    testWidgets('Arabic RTL card does not overflow', (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            locale: const Locale('ar'),
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [Locale('ar'), Locale('en')],
            home: Scaffold(
              body: SizedBox(
                width: 390,
                child: LearningProjectCard(
                  project: _overflowProject(
                    title: const LocalizedText(
                      en: 'PVC Plant Stand',
                      ar: 'حامل نباتات من البي في سي',
                    ),
                    materialCoverage: const ProjectMaterialCoverageSummary(
                      totalRequiredComponents: 5,
                      availableComponents: 5,
                      partialComponents: 0,
                      missingComponents: 0,
                      unknownComponents: 0,
                      availabilityRatio: 1,
                      coverageLevel: ProjectMaterialCoverageLevel.full,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('جميع المواد متوفرة'), findsOneWidget);
      expect(
        Directionality.of(tester.element(find.byType(LearningProjectCard))),
        TextDirection.rtl,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('compact coverage chip keeps detail semantics separate', (
      tester,
    ) async {
      const summary = ProjectMaterialCoverageSummary(
        totalRequiredComponents: 3,
        availableComponents: 3,
        partialComponents: 0,
        missingComponents: 0,
        unknownComponents: 0,
        availabilityRatio: 1,
        coverageLevel: ProjectMaterialCoverageLevel.full,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProjectMaterialCoverageChip(
              project: _overflowProject(materialCoverage: summary),
              compact: true,
            ),
          ),
        ),
      );

      expect(find.text('All materials available'), findsOneWidget);
      expect(find.text('All required materials available'), findsNothing);
    });
  });
}

Future<void> _pumpCard(
  WidgetTester tester, {
  required double cardWidth,
  required LearningProject project,
}) async {
  await tester.binding.setSurfaceSize(Size(cardWidth + 32, 900));
  addTearDown(() => tester.binding.setSurfaceSize(null));

  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: cardWidth,
              child: LearningProjectCard(project: project),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

LearningProject _overflowProject({
  LocalizedText? title,
  LocalizedText? summary,
  ProjectMaterialCoverageSummary? materialCoverage,
  ProjectPersonalBuildReadiness? personalBuildReadiness,
}) {
  return LearningProject(
    id: 'proj-overflow',
    category: const LocalizedText(en: 'Woodworking', ar: 'نجارة'),
    title: title ??
        const LocalizedText(en: 'PVC Plant Stand', ar: 'حامل نباتات'),
    summary: summary ??
        const LocalizedText(
          en: 'A sturdy plant stand for indoor and outdoor use.',
          ar: 'حامل نباتات متين',
        ),
    difficulty: const LocalizedText(en: 'Beginner', ar: 'مبتدئ'),
    duration: const LocalizedText(en: '2h', ar: '2س'),
    ratingLabel: const LocalizedText(en: 'learners', ar: 'متعلم'),
    ratingValue: 4.6,
    ratingCount: 12,
    componentCountLabel: const LocalizedText(en: '5 components', ar: '5'),
    components: const [],
    steps: const [],
    links: const [],
    imageUrl: null,
    heroIconData: Icons.architecture_outlined,
    cardGradient: const [0xFF000000, 0xFF111111],
    isFeatured: false,
    materialCoverage: materialCoverage ??
        const ProjectMaterialCoverageSummary(
          totalRequiredComponents: 5,
          availableComponents: 3,
          partialComponents: 1,
          missingComponents: 1,
          unknownComponents: 0,
          availabilityRatio: 0.6,
          coverageLevel: ProjectMaterialCoverageLevel.most,
        ),
    personalBuildReadiness: personalBuildReadiness,
  );
}
