import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/learner_builds/data/models/learner_build_models.dart';
import 'package:frontend/features/learner_builds/presentation/l10n/learner_builds_l10n.dart';
import 'package:frontend/features/learner_builds/presentation/widgets/learner_build_list_widgets.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';

LearnerBuildListItem _item({
  required ProjectBuildStatus status,
  LearnerBuildLearningListSummary? learning,
  PortfolioLearningStory? portfolioLearning,
  int attemptNumber = 1,
}) {
  return LearnerBuildListItem(
    id: 'build-1',
    projectId: 'project-1',
    attemptNumber: attemptNumber,
    status: status,
    project: const LearnerBuildListProject(
      id: 'project-1',
      title: 'LED Lamp',
      shortDescription: 'Build a lamp',
    ),
    startedAt: DateTime.utc(2026, 8, 1),
    updatedAt: DateTime.utc(2026, 8, 2),
    learning: learning,
    portfolioLearning: portfolioLearning,
  );
}

void main() {
  testWidgets('active build shows compact learning status without full goal', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LearnerBuildListCard(
            item: _item(
              status: ProjectBuildStatus.inProgress,
              learning: const LearnerBuildLearningListSummary(
                status: LearnerBuildLearningStatus.inProgress,
                hasLearningGoal: true,
                startCheck: LearnerBuildLearningProgressCounts(
                  handled: 2,
                  total: 3,
                ),
                stepChecks: LearnerBuildLearningProgressCounts(
                  handled: 2,
                  total: 4,
                ),
                finalCheck: LearnerBuildLearningProgressCounts(
                  handled: 0,
                  total: 0,
                ),
                understoodConceptCount: 1,
                reviewConceptCount: 0,
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.textContaining('Learning checks'), findsOneWidget);
    expect(find.textContaining('Learn everything about LED'), findsNothing);
    expect(find.textContaining('pass'), findsNothing);
  });

  testWidgets('paused build keeps Resume as primary action', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LearnerBuildListCard(
            item: _item(
              status: ProjectBuildStatus.paused,
              learning: const LearnerBuildLearningListSummary(
                status: LearnerBuildLearningStatus.notStarted,
                hasLearningGoal: false,
                startCheck: LearnerBuildLearningProgressCounts(
                  handled: 0,
                  total: 3,
                ),
                stepChecks: LearnerBuildLearningProgressCounts(
                  handled: 0,
                  total: 0,
                ),
                finalCheck: LearnerBuildLearningProgressCounts(
                  handled: 0,
                  total: 0,
                ),
                understoodConceptCount: 0,
                reviewConceptCount: 0,
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text(LearnerBuildsL10n.resumeBuild.en), findsOneWidget);
    expect(find.text(LearnerBuildsL10n.startLearningCheck.en), findsOneWidget);
  });

  testWidgets('completed build shows goal outcome chip', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LearnerBuildListCard(
            item: _item(
              status: ProjectBuildStatus.completed,
              learning: const LearnerBuildLearningListSummary(
                status: LearnerBuildLearningStatus.completed,
                hasLearningGoal: true,
                startCheck: LearnerBuildLearningProgressCounts(
                  handled: 3,
                  total: 3,
                ),
                stepChecks: LearnerBuildLearningProgressCounts(
                  handled: 1,
                  total: 1,
                ),
                finalCheck: LearnerBuildLearningProgressCounts(
                  handled: 2,
                  total: 2,
                ),
                understoodConceptCount: 2,
                reviewConceptCount: 0,
                goalOutcome: 'ACHIEVED',
                hasReflection: true,
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text(LearnerBuildsL10n.goalAchieved.en), findsOneWidget);
    expect(find.textContaining('I learned a lot'), findsNothing);
  });

  testWidgets('portfolio learning journey hides empty sections and grades', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PortfolioLearningStorySection(
            story: const PortfolioLearningStory(
              goal: 'Understand polarity',
              goalOutcome: 'PARTIALLY_ACHIEVED',
              confidenceBefore: 2,
              confidenceAfter: 4,
              reflection: 'Polarity matters for LEDs.',
              understoodConcepts: [
                PortfolioLearningConcept(
                  conceptKey: 'polarity',
                  labelEn: 'LED polarity',
                  labelAr: 'قطبية LED',
                ),
              ],
              reviewConcepts: [
                PortfolioLearningConcept(
                  conceptKey: 'resistor',
                  labelEn: 'Current limiting',
                  labelAr: 'تحديد التيار',
                ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.text(LearnerBuildsL10n.learningJourneyTitle.en), findsOneWidget);
    expect(find.textContaining('Understand polarity'), findsOneWidget);
    expect(find.textContaining('LED polarity'), findsOneWidget);
    expect(find.text('polarity'), findsNothing);
    expect(find.textContaining('pass'), findsNothing);
    expect(find.textContaining('2 → 4'), findsOneWidget);
  });

  test('Arabic goal outcome and confidence labels are localized', () {
    expect(LearnerBuildsL10n.goalAchieved.ar, 'تم تحقيق الهدف');
    expect(LearnerBuildsL10n.reviewRecommended.ar, 'يُنصح بالمراجعة');
    expect(
      LearnerBuildsL10n.learningJourneyTitle.ar,
      'رحلة التعلم',
    );
  });

  test('build without learning renders normally from json', () {
    final item = LearnerBuildListItem.fromJson({
      'id': 'b1',
      'projectId': 'p1',
      'attemptNumber': 1,
      'status': 'IN_PROGRESS',
      'startedAt': '2026-08-01T00:00:00.000Z',
      'updatedAt': '2026-08-01T00:00:00.000Z',
      'project': {
        'id': 'p1',
        'title': 'Robot',
        'shortDescription': 'desc',
      },
      'learning': {
        'status': 'NOT_AVAILABLE',
        'hasLearningGoal': false,
        'startCheck': {'handled': 0, 'total': 0},
        'stepChecks': {'handled': 0, 'total': 0},
        'finalCheck': {'handled': 0, 'total': 0},
        'understoodConceptCount': 0,
        'reviewConceptCount': 0,
        'goalOutcome': null,
        'hasReflection': false,
      },
    });

    expect(item.learning?.status, LearnerBuildLearningStatus.notAvailable);
    expect(item.portfolioLearning, isNull);
  });
}
