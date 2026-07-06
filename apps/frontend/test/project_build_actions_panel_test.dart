import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_build_actions_panel.dart';

void main() {
  testWidgets('starts build checklist and searches materials by component', (
    tester,
  ) async {
    final router = GoRouter(
      initialLocation: '/learning/test-project',
      routes: [
        GoRoute(
          path: '/learning/:id',
          builder: (context, state) => Scaffold(
            body: SingleChildScrollView(
              child: ProjectBuildActionsPanel(project: _project()),
            ),
          ),
        ),
        GoRoute(
          path: '/materials',
          builder: (context, state) {
            return Scaffold(
              body: Text('materials:${state.uri.queryParameters['q'] ?? ''}'),
            );
          },
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    expect(find.text('Plan this build'), findsOneWidget);
    expect(find.text('Start build'), findsOneWidget);

    await tester.tap(find.text('Start build'));
    await tester.pumpAndSettle();

    expect(find.text('Build checklist'), findsOneWidget);
    expect(find.text('Required component checklist'), findsOneWidget);
    expect(find.text('Arduino board'), findsOneWidget);
    expect(find.text('Missing'), findsWidgets);

    await tester.tap(find.text('Already owned').first);
    await tester.pumpAndSettle();

    expect(find.text('1/2 ready'), findsOneWidget);

    await tester.tap(
      find.widgetWithText(OutlinedButton, 'Find materials').first,
    );
    await tester.pumpAndSettle();

    expect(find.text('materials:Arduino board'), findsOneWidget);
  });
}

LearningProject _project() {
  return const LearningProject(
    id: 'test-project',
    category: LocalizedText(en: 'Robotics', ar: 'Robotics'),
    title: LocalizedText(en: 'Sensor station', ar: 'Sensor station'),
    summary: LocalizedText(en: 'Build a station', ar: 'Build a station'),
    difficulty: LocalizedText(en: 'Easy', ar: 'Easy'),
    duration: LocalizedText(en: '45 min', ar: '45 min'),
    ratingLabel: LocalizedText(en: 'learners', ar: 'learners'),
    ratingValue: 0,
    ratingCount: 0,
    componentCountLabel: LocalizedText(en: '2 components', ar: '2 components'),
    components: [
      LocalizedText(en: 'Arduino board', ar: 'Arduino board'),
      LocalizedText(en: 'Jumper wires', ar: 'Jumper wires'),
    ],
    steps: [
      ProjectStep(
        title: LocalizedText(en: 'Connect parts', ar: 'Connect parts'),
      ),
    ],
    links: [],
    imageUrl: null,
    heroIconData: Icons.memory_rounded,
    cardGradient: [0xFF1F2937, 0xFF243B53],
    isFeatured: false,
    hasRatings: false,
  );
}
