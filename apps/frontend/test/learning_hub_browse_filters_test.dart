import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/learning_projects_result.dart';
import 'package:frontend/features/learning_hub/domain/models/project_material_coverage.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/learning_hub_coverage_l10n.dart';

void main() {
  group('Learning Hub browse filters and sorting', () {
    test('availability filter values serialize correctly', () {
      final params = const LearningProjectsQuery(
        page: 1,
        limit: 12,
        availability: 'FULL',
        sort: 'MOST_AVAILABLE',
      ).toApiQueryParameters();

      expect(params['availability'], 'FULL');
      expect(params['sort'], 'MOST_AVAILABLE');
    });

    test('default availability and sort are omitted from query', () {
      final params = const LearningProjectsQuery(
        page: 1,
        limit: 12,
      ).toApiQueryParameters();

      expect(params.containsKey('availability'), isFalse);
      expect(params.containsKey('sort'), isFalse);
    });

    test('all six sorting options serialize correctly', () {
      const sorts = [
        'DEFAULT',
        'MOST_AVAILABLE',
        'SHORTEST_DURATION',
        'EASIEST',
        'MOST_POPULAR',
        'NEWEST',
      ];

      for (final sort in sorts) {
        final params = LearningProjectsQuery(
          page: 1,
          limit: 12,
          sort: sort,
        ).toApiQueryParameters();

        if (sort == 'DEFAULT') {
          expect(params.containsKey('sort'), isFalse);
        } else {
          expect(params['sort'], sort);
        }
      }
    });

    test('search category difficulty tag and availability compose in query', () {
      final params = const LearningProjectsQuery(
        page: 2,
        limit: 8,
        q: 'arduino',
        categoryId: 'cat-1',
        difficulty: 'BEGINNER',
        tag: 'robotics',
        availability: 'MOST',
        sort: 'EASIEST',
      ).toApiQueryParameters();

      expect(params['q'], 'arduino');
      expect(params['categoryId'], 'cat-1');
      expect(params['difficulty'], 'BEGINNER');
      expect(params['tag'], 'robotics');
      expect(params['availability'], 'MOST');
      expect(params['sort'], 'EASIEST');
    });
  });

  group('Learning Hub coverage labels', () {
    testWidgets('FULL label never says Ready for build', (tester) async {
      const summary = ProjectMaterialCoverageSummary(
        totalRequiredComponents: 2,
        availableComponents: 2,
        partialComponents: 0,
        missingComponents: 0,
        unknownComponents: 0,
        availabilityRatio: 1,
        coverageLevel: ProjectMaterialCoverageLevel.full,
      );

      late LearningHubCoverageL10n l10n;
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              l10n = LearningHubCoverageL10n.of(context);
              return Text(l10n.publicCoverageSummary(summary));
            },
          ),
        ),
      );

      expect(find.text('All required materials available'), findsOneWidget);
      expect(find.textContaining('Ready for build'), findsNothing);
    });

    testWidgets('Arabic filter and sort labels are available', (tester) async {
      late LearningHubCoverageL10n l10n;
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ar'),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('ar'), Locale('en')],
          home: Builder(
            builder: (context) {
              l10n = LearningHubCoverageL10n.of(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      expect(l10n.filterAny, 'أي حالة توفر');
      expect(l10n.filterFull, 'جميع المواد متوفرة');
      expect(l10n.sortRecommended, 'مقترحة');
      expect(l10n.sortMostAvailable, 'الأكثر توفرًا للمواد');
      expect(l10n.sortShortestDuration, 'الأقصر مدة');
    });
  });
}
