import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/data/learning_hub_api_mapper.dart';
import 'package:frontend/features/learning_hub/domain/models/project_material_coverage.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/learning_hub_coverage_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_material_coverage_chip.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/shared/models/localized_text.dart';

void main() {
  group('Project material coverage models', () {
    test('parses materialCoverage and personalBuildReadiness', () {
      final summary = ProjectMaterialCoverageSummary.fromJson({
        'totalRequiredComponents': 5,
        'availableComponents': 4,
        'partialComponents': 1,
        'missingComponents': 0,
        'unknownComponents': 0,
        'availabilityRatio': 0.8,
        'coverageLevel': 'MOST',
      });

      expect(summary.coverageLevel, ProjectMaterialCoverageLevel.most);
      expect(summary.availableComponents, 4);
    });

    test('mapper maps browse coverage fields', () {
      final project = LearningHubApiMapper.fromListItemJson({
        'id': 'proj-1',
        'title': 'Robot Car',
        'shortDescription': 'Build a robot',
        'category': {'id': 'cat-1', 'nameEn': 'Robotics', 'nameAr': 'روبوتات'},
        'difficulty': 'BEGINNER',
        'estimatedDurationMinutes': 60,
        'materialCoverage': {
          'totalRequiredComponents': 2,
          'availableComponents': 2,
          'partialComponents': 0,
          'missingComponents': 0,
          'unknownComponents': 0,
          'availabilityRatio': 1,
          'coverageLevel': 'FULL',
        },
      });

      expect(project.materialCoverage?.coverageLevel,
          ProjectMaterialCoverageLevel.full);
    });
  });

  group('ProjectMaterialCoverageChip', () {
    testWidgets('shows public availability without mixing build readiness', (
      tester,
    ) async {
      final project = _project(
        materialCoverage: const ProjectMaterialCoverageSummary(
          totalRequiredComponents: 5,
          availableComponents: 4,
          partialComponents: 0,
          missingComponents: 1,
          unknownComponents: 0,
          availabilityRatio: 0.8,
          coverageLevel: ProjectMaterialCoverageLevel.most,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProjectMaterialCoverageChip(project: project),
          ),
        ),
      );

      expect(find.textContaining('1 material currently missing'), findsOneWidget);
      expect(find.textContaining('Ready for build'), findsNothing);
    });

    testWidgets('shows personal readiness when active build exists', (
      tester,
    ) async {
      final project = _project(
        personalBuildReadiness: const ProjectPersonalBuildReadiness(
          buildId: 'build-1',
          buildStatus: 'IN_PROGRESS',
          readyComponents: 3,
          totalRequiredComponents: 5,
          needsMaterialComponents: 2,
          readinessRatio: 0.6,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProjectMaterialCoverageChip(project: project),
          ),
        ),
      );

      expect(find.textContaining('3 of 5 ready in your build'), findsOneWidget);
    });

    testWidgets('Arabic public coverage label renders', (tester) async {
      final project = _project(
        materialCoverage: const ProjectMaterialCoverageSummary(
          totalRequiredComponents: 5,
          availableComponents: 4,
          partialComponents: 0,
          missingComponents: 0,
          unknownComponents: 0,
          availabilityRatio: 0.8,
          coverageLevel: ProjectMaterialCoverageLevel.most,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ar'),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('ar'), Locale('en')],
          home: Scaffold(
            body: Builder(
              builder: (context) {
                final l10n = LearningHubCoverageL10n.of(context);
                return Text(l10n.publicCoverageSummary(project.materialCoverage!));
              },
            ),
          ),
        ),
      );

      expect(find.textContaining('4 من 5'), findsOneWidget);
    });
  });
}

LearningProject _project({
  ProjectMaterialCoverageSummary? materialCoverage,
  ProjectPersonalBuildReadiness? personalBuildReadiness,
}) {
  return LearningProject(
    id: 'proj-1',
    category: const LocalizedText(en: 'Robotics', ar: 'روبوتات'),
    title: const LocalizedText(en: 'Robot Car', ar: 'سيارة روبوت'),
    summary: const LocalizedText(en: 'Build', ar: 'ابن'),
    difficulty: const LocalizedText(en: 'Easy', ar: 'سهل'),
    duration: const LocalizedText(en: '1h', ar: '1س'),
    ratingLabel: const LocalizedText(en: 'learners', ar: 'متعلم'),
    ratingValue: 4.5,
    ratingCount: 2,
    componentCountLabel: const LocalizedText(en: '2 components', ar: '2'),
    components: const [],
    steps: const [],
    links: const [],
    imageUrl: null,
    heroIconData: Icons.architecture_outlined,
    cardGradient: const [0xFF000000, 0xFF111111],
    isFeatured: false,
    materialCoverage: materialCoverage,
    personalBuildReadiness: personalBuildReadiness,
  );
}
